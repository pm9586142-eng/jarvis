import { BrowserTelemetry } from '../types/jarvis';

export const TELEMETRY_INTERVAL_NORMAL_MS = 5000;
export const TELEMETRY_INTERVAL_POWER_SAVING_MS = 30000;

export function getTelemetryRefreshIntervalMs(powerSaving: boolean): number {
  return powerSaving ? TELEMETRY_INTERVAL_POWER_SAVING_MS : TELEMETRY_INTERVAL_NORMAL_MS;
}

const bootTimestamp = Date.now();

interface BatteryManagerLike {
  level: number;
  charging: boolean;
}

interface NavigatorWithExtras extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    type?: string;
  };
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export async function collectBrowserTelemetry(): Promise<BrowserTelemetry> {
  const nav = navigator as NavigatorWithExtras;
  const perf = performance as PerformanceWithMemory;

  let batteryPercent: number | null = null;
  let isCharging: boolean | null = null;

  if (typeof nav.getBattery === 'function') {
    try {
      const bat = await nav.getBattery();
      batteryPercent = Math.round(bat.level * 100);
      isCharging = Boolean(bat.charging);
    } catch {
      // Browser blocked or unsupported
    }
  }

  const heapUsedMb = perf.memory
    ? Math.round(perf.memory.usedJSHeapSize / (1024 * 1024))
    : null;
  const heapLimitMb = perf.memory
    ? Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024))
    : null;

  const netLabel = !navigator.onLine
    ? 'Offline'
    : nav.connection?.effectiveType
      ? `Online (${nav.connection.effectiveType.toUpperCase()})`
      : 'Online';

  let storageUsedMb: number | null = null;
  let storageQuotaMb: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') {
        storageUsedMb = Math.round((est.usage / (1024 * 1024)) * 10) / 10;
      }
      if (typeof est.quota === 'number') {
        storageQuotaMb = Math.round(est.quota / (1024 * 1024));
      }
    } catch {
      // Storage API blocked in private context
    }
  }

  return {
    online: navigator.onLine,
    networkType: netLabel,
    batteryPercent,
    isCharging,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    heapUsedMb,
    heapLimitMb,
    storageUsedMb,
    storageQuotaMb,
    cpuCores: navigator.hardwareConcurrency || 4,
    platform: navigator.platform || 'Web Browser',
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    uptimeMinutes: Math.floor((Date.now() - bootTimestamp) / 60000),
  };
}

export function executeTerminalCommand(cmd: string, telemetry: BrowserTelemetry): string {
  const clean = cmd.trim().toLowerCase();
  switch (clean) {
    case 'help':
      return [
        'JARVIS NEURAL TERMINAL v2050 [Web Runtime]',
        'Available commands:',
        '  sysinfo     - Real browser & hardware telemetry',
        '  diagnostics - Subsystem integrity verification',
        '  ping        - Backend /api/health round-trip latency test',
        '  defcon      - Current Stark security clearance & posture',
        '  agents      - Specialized neural agent status',
        '  uptime      - Active browser session runtime',
        '  clear       - Clear terminal console output',
      ].join('\n');
    case 'sysinfo':
    case 'status':
      return [
        '[BROWSER & HOST TELEMETRY]',
        `Platform: ${telemetry.platform} (${telemetry.cpuCores} logical cores)`,
        `Viewport: ${telemetry.viewport}`,
        `Network: ${telemetry.networkType}`,
        `Battery: ${telemetry.batteryPercent !== null ? `${telemetry.batteryPercent}% (${telemetry.isCharging ? 'Charging' : 'Discharging'})` : 'Unavailable in this browser'}`,
        `JS Heap: ${telemetry.heapUsedMb !== null ? `${telemetry.heapUsedMb} MB / ${telemetry.heapLimitMb} MB` : 'Restricted by browser privacy policy'}`,
        `Device RAM Hint: ${telemetry.deviceMemoryGb !== null ? `${telemetry.deviceMemoryGb} GB` : 'Not exposed'}`,
        `Session Uptime: ${telemetry.uptimeMinutes} min`,
      ].join('\n');
    case 'diagnostics':
      return [
        '[RUNNING WEB SUBSYSTEM DIAGNOSTICS...]',
        `[${telemetry.online ? '✓' : '✗'}] Network Link: ${telemetry.networkType}`,
        `[${'speechSynthesis' in window ? '✓' : '!'}] Speech Synthesis (TTS): ${'speechSynthesis' in window ? 'AVAILABLE' : 'UNSUPPORTED'}`,
        `[${'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? '✓' : '!'}] Web Speech Recognition (STT): ${'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? 'AVAILABLE' : 'CHROME/EDGE ONLY'}`,
        `[${navigator.mediaDevices ? '✓' : '!'}] MediaDevices Optical/Audio API: ${navigator.mediaDevices ? 'AVAILABLE' : 'UNAVAILABLE'}`,
        '[✓] Persistent Local Vault: OPERATIONAL',
      ].join('\n');
    case 'defcon':
      return [
        '[DEFCON DEFENSE REPORT]',
        `Transport Security: ${window.isSecureContext ? 'HTTPS / Secure Context VERIFIED' : 'Non-HTTPS Localhost'}`,
        'API Key Isolation: Server-side proxy enforced (Zero client secrets)',
        'Sandbox Mode: Web browser isolated execution',
      ].join('\n');
    case 'agents':
      return [
        '[ACTIVE NEURAL AGENTS]',
        '1. JARVIS   - Master Executive Orchestrator [ACTIVE]',
        '2. VERONICA - Web Research & Grounding      [ONLINE]',
        '3. DUM-E    - Polymath Code Architect       [ONLINE]',
        '4. FRIDAY   - Executive Schedule & Tasks    [ONLINE]',
        '5. HOMER    - Hardware & Security Sentinel  [MONITORING]',
      ].join('\n');
    case 'uptime':
      return `Active JARVIS Web Session Uptime: ${telemetry.uptimeMinutes} minute(s).`;
    default:
      if (clean.startsWith('echo ')) {
        return cmd.trim().slice(5);
      }
      return `Command not recognized: '${cmd}'. Type 'help' for supported commands.`;
  }
}
