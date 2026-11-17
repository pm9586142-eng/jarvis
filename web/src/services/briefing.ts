import {
  BrowserTelemetry,
  DailyBriefingData,
  LanguageCode,
  SecurityReport,
  TaskItem,
} from '../types/jarvis';
import { fetchAiBriefingLine } from './api';
import {
  buildSecurityHudSummary,
  composeSpokenDailySummary,
  getTimeGreeting,
} from './dailySummary';

const BRIEFING_CACHE_KEY = 'jarvis_web_daily_briefing_v1';
const BRIEFING_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
};

export function getGreetingForHour(hour = new Date().getHours()): string {
  return getTimeGreeting(hour);
}

export function buildTasksSummary(tasks: TaskItem[]): string {
  const pending = tasks.filter((t) => !t.isCompleted);
  if (pending.length === 0) {
    return 'All scheduled objectives are complete, Sir.';
  }
  const highCount = pending.filter((t) => t.priority === 'HIGH').length;
  const topTitles = pending
    .slice(0, 2)
    .map((t) => t.title)
    .join('; ');
  return `${pending.length} pending (${highCount} high priority): ${topTitles}`;
}

export function buildBatterySummary(telemetry: BrowserTelemetry): string {
  if (telemetry.batteryPercent !== null) {
    return `Power ${telemetry.batteryPercent}% (${telemetry.isCharging ? 'Charging' : 'On Battery'}) • ${telemetry.networkType}`;
  }
  return `Desktop / Browser Power Nominal • ${telemetry.networkType}`;
}

async function resolveCoordinates(): Promise<{ lat: number; lon: number; label: string }> {
  const fallback = { lat: 40.7128, lon: -74.006, label: 'New York Grid' };
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return fallback;
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), 2500);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.clearTimeout(timer);
          resolve({
            lat: Number(pos.coords.latitude.toFixed(3)),
            lon: Number(pos.coords.longitude.toFixed(3)),
            label: 'Local Telemetry',
          });
        },
        () => {
          window.clearTimeout(timer);
          resolve(fallback);
        },
        { timeout: 2200, maximumAge: 600000 }
      );
    } catch {
      window.clearTimeout(timer);
      resolve(fallback);
    }
  });
}

async function fetchOpenMeteoWeather(): Promise<string> {
  try {
    const coords = await resolveCoordinates();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        return `Weather feed HTTP ${res.status} (${coords.label})`;
      }
      const data = (await res.json()) as {
        current_weather?: { temperature?: number; windspeed?: number; weathercode?: number };
      };
      const cw = data?.current_weather;
      if (!cw || typeof cw.temperature !== 'number') {
        return `Weather data standby (${coords.label})`;
      }
      const condition = WEATHER_CODES[cw.weathercode ?? -1] || 'Nominal conditions';
      const wind = typeof cw.windspeed === 'number' ? ` • Wind ${Math.round(cw.windspeed)} km/h` : '';
      return `${Math.round(cw.temperature)}°C, ${condition}${wind} (${coords.label})`;
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return 'Weather unavailable (offline or blocked)';
  }
}

export function getCachedDailyBriefing(): DailyBriefingData | null {
  try {
    const raw = localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyBriefingData;
    if (!parsed || typeof parsed.generatedAt !== 'number') return null;
    if (Date.now() - parsed.generatedAt > BRIEFING_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

let inFlightBriefingPromise: Promise<DailyBriefingData> | null = null;

export async function generateDailyBriefing(params: {
  tasks: TaskItem[];
  telemetry: BrowserTelemetry;
  language: LanguageCode;
  securityReport?: SecurityReport | null;
  forceRefresh?: boolean;
}): Promise<DailyBriefingData> {
  const securitySummary = buildSecurityHudSummary(params.securityReport);

  if (!params.forceRefresh) {
    const cached = getCachedDailyBriefing();
    if (cached) {
      const greeting = getGreetingForHour();
      const tasksSummary = buildTasksSummary(params.tasks);
      const batterySummary = buildBatterySummary(params.telemetry);
      const spokenSummary = composeSpokenDailySummary({
        greeting,
        tasks: params.tasks,
        weatherSummary: cached.weatherSummary,
        securityReport: params.securityReport,
        aiLine: cached.aiLine,
        aiSource: cached.source,
      });
      return {
        ...cached,
        greeting,
        tasksSummary,
        batterySummary,
        securitySummary,
        spokenSummary,
      };
    }

    if (inFlightBriefingPromise) {
      return inFlightBriefingPromise;
    }
  }

  const run = (async (): Promise<DailyBriefingData> => {
    const greeting = getGreetingForHour();
    const tasksSummary = buildTasksSummary(params.tasks);
    const batterySummary = buildBatterySummary(params.telemetry);
    const weatherSummary = await fetchOpenMeteoWeather();

    const aiResult = await fetchAiBriefingLine({
      tasksSummary,
      weatherSummary,
      batterySummary,
      language: params.language,
    });

    const spokenSummary = composeSpokenDailySummary({
      greeting,
      tasks: params.tasks,
      weatherSummary,
      securityReport: params.securityReport,
      aiLine: aiResult.line,
      aiSource: aiResult.source,
    });

    const result: DailyBriefingData = {
      greeting,
      weatherSummary,
      tasksSummary,
      batterySummary,
      securitySummary,
      spokenSummary,
      aiLine: aiResult.line,
      source: aiResult.source,
      generatedAt: Date.now(),
    };

    try {
      localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(result));
    } catch {
      // Ignore storage quota issues
    }

    return result;
  })();

  inFlightBriefingPromise = run.finally(() => {
    if (inFlightBriefingPromise === run) {
      inFlightBriefingPromise = null;
    }
  });

  return inFlightBriefingPromise;
}
