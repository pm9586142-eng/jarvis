/**
 * Pure daily summary composer for JARVIS startup voice synthesis and HUD briefings.
 * Kept framework-agnostic so both the React HUD and Node.js unit tests can import it directly.
 */

const PRIORITY_RANK = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const UNAVAILABLE_WEATHER_MARKERS = [
  'checking weather',
  'unavailable',
  'offline',
  'standby',
  'weather feed http',
  'blocked',
  'error',
];

const NOMINAL_SECURITY_ALERT_MARKERS = [
  'all systems',
  'all browser security',
  'normal security tolerances',
  'no active threats',
  'no critical',
];

export function getTimeGreeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return 'Good morning, Sir.';
  if (hour >= 12 && hour < 17) return 'Good afternoon, Sir.';
  return 'Good evening, Sir.';
}

function cleanSpeechSegment(raw) {
  return String(raw || '')
    .replace(/[*_`~#>[\]]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureSentenceEnding(text) {
  const cleaned = cleanSpeechSegment(text);
  if (!cleaned) return '';
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

export function isWeatherSummaryAvailable(weatherSummary) {
  const text = cleanSpeechSegment(weatherSummary);
  if (!text) return false;
  const lower = text.toLowerCase();
  return !UNAVAILABLE_WEATHER_MARKERS.some((marker) => lower.includes(marker));
}

export function formatWeatherForSpeech(weatherSummary) {
  if (!isWeatherSummaryAvailable(weatherSummary)) return null;
  let cleaned = cleanSpeechSegment(weatherSummary);
  // Remove technical telemetry location tags in parentheses like (Local Telemetry)
  cleaned = cleaned.replace(/\s*\((?:local telemetry|new york grid)\)\s*/gi, ' ').trim();
  // Normalize separators & units for natural voice synthesis
  cleaned = cleaned
    .replace(/(-?\d+(?:\.\d+)?)\s*°\s*C\b/gi, '$1 degrees Celsius')
    .replace(/(-?\d+(?:\.\d+)?)\s*°\s*F\b/gi, '$1 degrees Fahrenheit')
    .replace(/\bkm\/h\b/gi, 'kilometers per hour')
    .replace(/\bmph\b/gi, 'miles per hour')
    .replace(/\s*[•|]\s*/g, ', ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,+$/, '');

  if (!cleaned) return null;
  return ensureSentenceEnding(`Current weather is ${cleaned}`);
}

export function getPrioritizedPendingTasks(tasks = []) {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter((t) => t && !t.isCompleted && cleanSpeechSegment(t.title))
    .slice()
    .sort((a, b) => {
      const rankA = PRIORITY_RANK[String(a.priority || 'MEDIUM').toUpperCase()] ?? 1;
      const rankB = PRIORITY_RANK[String(b.priority || 'MEDIUM').toUpperCase()] ?? 1;
      if (rankA !== rankB) return rankA - rankB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
}

export function buildTasksSpokenSummary(tasks = []) {
  const pending = getPrioritizedPendingTasks(tasks);
  if (pending.length === 0) {
    return 'You have no pending tasks right now. All scheduled objectives are complete.';
  }

  const highCount = pending.filter((t) => String(t.priority).toUpperCase() === 'HIGH').length;

  const formatTaskTitle = (task, includeDue = false) => {
    const title = cleanSpeechSegment(task.title);
    const due = cleanSpeechSegment(task.dueTime);
    if (includeDue && due && due.toLowerCase() !== 'today') {
      return `${title} due ${due}`;
    }
    return title;
  };

  if (pending.length === 1) {
    const only = pending[0];
    const priorityNote = highCount === 1 ? ', marked high priority' : '';
    return ensureSentenceEnding(
      `You have 1 pending task${priorityNote}: ${formatTaskTitle(only, true)}`
    );
  }

  const topTasks = pending.slice(0, 3);
  const topLabels = topTasks.map((t, idx) => formatTaskTitle(t, idx === 0));
  const joinedTitles =
    topLabels.length === 2
      ? `${topLabels[0]} and ${topLabels[1]}`
      : `${topLabels.slice(0, -1).join(', ')}, and ${topLabels[topLabels.length - 1]}`;

  const highNote =
    highCount > 0 ? `, including ${highCount} high priority` : '';
  const remainingNote =
    pending.length > topTasks.length
      ? `, plus ${pending.length - topTasks.length} more`
      : '';

  return ensureSentenceEnding(
    `You have ${pending.length} pending tasks${highNote}. Top priorities are ${joinedTitles}${remainingNote}`
  );
}

export function buildSecurityHudSummary(securityReport) {
  if (!securityReport || typeof securityReport.defconLevel !== 'number') {
    return 'Security telemetry standby';
  }
  const { defconLevel, score } = securityReport;
  if (defconLevel === 1) {
    return `DEFCON 1 • LOCKDOWN (${score}/100)`;
  }
  if (defconLevel <= 4) {
    return `DEFCON ${defconLevel} • ${score}/100 • Review Advised`;
  }
  return `DEFCON 5 • ${score}/100 • Optimal`;
}

export function buildSecuritySpokenSummary(securityReport) {
  if (!securityReport || typeof securityReport.defconLevel !== 'number') {
    return null;
  }

  const defcon = securityReport.defconLevel;
  const score = typeof securityReport.score === 'number' ? securityReport.score : null;
  const alerts = Array.isArray(securityReport.alerts) ? securityReport.alerts : [];
  const activeAlerts = alerts
    .map((a) => cleanSpeechSegment(a))
    .filter((a) => {
      if (!a) return false;
      const lower = a.toLowerCase();
      return !NOMINAL_SECURITY_ALERT_MARKERS.some((marker) => lower.includes(marker));
    });

  if (defcon === 1) {
    return 'Security alert: Emergency Defense Lockdown is active at DEFCON 1. Immediate review is advised.';
  }

  if (defcon <= 4 || activeAlerts.length > 0) {
    const scorePart = score !== null ? ` with an integrity score of ${score} out of 100` : '';
    const alertDetail = activeAlerts.length > 0
      ? ` ${ensureSentenceEnding(activeAlerts[0])}`
      : ' Elevated security events require your review.';
    return `Security update: DEFCON ${defcon}${scorePart}.${alertDetail}`;
  }

  const scorePart = score !== null ? ` with a score of ${score} out of 100` : '';
  return `Security status is optimal at DEFCON 5${scorePart} and no active threats.`;
}

export function composeSpokenDailySummary(params = {}) {
  const {
    greeting,
    hour,
    tasks = [],
    weatherSummary = '',
    securityReport = null,
    aiLine = '',
    aiSource = 'fallback',
    prefix = '',
  } = params;

  const segments = [];

  if (prefix) {
    const cleanPrefix = ensureSentenceEnding(prefix);
    if (cleanPrefix) segments.push(cleanPrefix);
  }

  const resolvedGreeting = ensureSentenceEnding(
    greeting || getTimeGreeting(typeof hour === 'number' ? hour : new Date().getHours())
  );
  if (resolvedGreeting) segments.push(resolvedGreeting);

  segments.push(buildTasksSpokenSummary(tasks));

  const weatherClause = formatWeatherForSpeech(weatherSummary);
  if (weatherClause) {
    segments.push(weatherClause);
  }

  const securityClause = buildSecuritySpokenSummary(securityReport);
  if (securityClause) {
    segments.push(securityClause);
  }

  if (aiSource === 'gemini' && aiLine) {
    const cleanAi = ensureSentenceEnding(aiLine).slice(0, 180);
    if (cleanAi && !segments.some((s) => s.toLowerCase() === cleanAi.toLowerCase())) {
      segments.push(cleanAi);
    }
  }

  return segments.filter(Boolean).join(' ');
}
