import React, { useState } from 'react';
import {
  Activity,
  Battery,
  Cpu,
  ExternalLink,
  HardDrive,
  RefreshCw,
  Terminal,
  Volume2,
  Wifi,
} from 'lucide-react';
import { checkBackendHealth } from '../services/api';
import { executeTerminalCommand } from '../services/telemetry';
import { BrowserTelemetry, JarvisSettings } from '../types/jarvis';

interface TelemetryCliViewProps {
  telemetry: BrowserTelemetry;
  settings: JarvisSettings;
  onRefreshTelemetry: () => void;
  onUpdateSpeech: (rate: number, pitch: number) => void;
  onTestVoice: () => void;
}

export const TelemetryCliView: React.FC<TelemetryCliViewProps> = ({
  telemetry,
  settings,
  onRefreshTelemetry,
  onUpdateSpeech,
  onTestVoice,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [outputLines, setOutputLines] = useState<string[]>([
    'JARVIS Neural Terminal Ready [Browser Runtime].',
    "Type 'help', 'sysinfo', 'diagnostics', 'ping', 'defcon', or 'agents' and press Enter.",
  ]);
  const [isPinging, setIsPinging] = useState(false);

  const runCommand = async (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    if (lower === 'clear') {
      setOutputLines(['Terminal buffer cleared.']);
      setCommandInput('');
      return;
    }

    if (lower === 'ping') {
      setOutputLines((prev) => [...prev, `> ${trimmed}`, 'Pinging /api/health endpoint...']);
      setCommandInput('');
      setIsPinging(true);
      const t0 = performance.now();
      try {
        const health = await checkBackendHealth(5000);
        const rtt = Math.round(performance.now() - t0);
        setOutputLines((prev) => [
          ...prev,
          `[PONG] HTTP 200 OK in ${rtt} ms | Service: ok | Model: ${health.model} | Gemini Key: ${health.geminiConfigured ? 'CONFIGURED' : 'NOT SET'} | Server Uptime: ${health.uptimeSeconds}s`,
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Backend unreachable';
        setOutputLines((prev) => [...prev, `[TIMEOUT/ERROR] ${msg}`]);
      } finally {
        setIsPinging(false);
      }
      return;
    }

    const result = executeTerminalCommand(trimmed, telemetry);
    setOutputLines((prev) => [...prev, `> ${trimmed}`, result]);
    setCommandInput('');
  };

  const quickTools = [
    { label: 'Google Search', href: 'https://www.google.com' },
    { label: 'AI Studio', href: 'https://aistudio.google.com' },
    { label: 'Cloud Run Console', href: 'https://console.cloud.google.com/run' },
    { label: 'GitHub', href: 'https://github.com' },
  ];

  return (
    <div className="space-y-6">
      {/* Real Browser Telemetry Grid */}
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
              LIVE BROWSER & HOST TELEMETRY
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Collected directly from Web APIs (Navigator, Performance Memory, Battery, Network)
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshTelemetry}
            className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400 text-xs font-mono-hud text-cyan-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-cyan-300 font-mono-hud text-[11px]">
              <Wifi className="w-3.5 h-3.5" />
              <span>NETWORK LINK</span>
            </div>
            <p className="text-sm font-semibold text-slate-100">{telemetry.networkType}</p>
            <p className="text-[11px] text-slate-400">{telemetry.online ? 'Navigator Online' : 'Offline Mode'}</p>
          </div>

          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-mono-hud text-[11px]">
              <Battery className="w-3.5 h-3.5" />
              <span>BATTERY API</span>
            </div>
            <p className="text-sm font-semibold text-slate-100">
              {telemetry.batteryPercent !== null ? `${telemetry.batteryPercent}%` : 'Unsupported'}
            </p>
            <p className="text-[11px] text-slate-400">
              {telemetry.batteryPercent !== null
                ? telemetry.isCharging
                  ? 'Charging AC'
                  : 'Discharging'
                : 'Restricted by browser'}
            </p>
          </div>

          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-amber-300 font-mono-hud text-[11px]">
              <HardDrive className="w-3.5 h-3.5" />
              <span>JS HEAP / RAM</span>
            </div>
            <p className="text-sm font-semibold text-slate-100">
              {telemetry.heapUsedMb !== null
                ? `${telemetry.heapUsedMb} / ${telemetry.heapLimitMb} MB`
                : telemetry.deviceMemoryGb !== null
                  ? `~${telemetry.deviceMemoryGb} GB Device`
                  : 'Private'}
            </p>
            <p className="text-[11px] text-slate-400">
              {telemetry.heapUsedMb !== null ? 'V8 Performance Heap' : 'Device Memory Hint'}
            </p>
          </div>

          <div className="rounded-xl bg-[#040812] border border-slate-800 p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-sky-300 font-mono-hud text-[11px]">
              <Cpu className="w-3.5 h-3.5" />
              <span>RUNTIME / CORES</span>
            </div>
            <p className="text-sm font-semibold text-slate-100">{telemetry.cpuCores} Logical Cores</p>
            <p className="text-[11px] text-slate-400 truncate">
              {telemetry.platform} • {telemetry.viewport}
            </p>
          </div>
        </div>
      </div>

      {/* Speech Calibration & External Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-cyan-300" />
              <h3 className="font-mono-hud text-xs font-bold text-cyan-300 tracking-wider">
                VOCAL SYNTHESIS CALIBRATION
              </h3>
            </div>
            <button
              type="button"
              onClick={onTestVoice}
              className="px-3 py-1 rounded-lg bg-cyan-400/20 border border-cyan-400/50 text-cyan-200 font-mono-hud text-[11px] cursor-pointer hover:bg-cyan-400/30"
            >
              TEST VOICE
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono-hud text-slate-300 mb-1">
                <span>Speech Rate</span>
                <span className="text-cyan-300">{settings.speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={settings.speechRate}
                onChange={(e) => onUpdateSpeech(parseFloat(e.target.value), settings.speechPitch)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono-hud text-slate-300 mb-1">
                <span>Speech Pitch</span>
                <span className="text-cyan-300">{settings.speechPitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={settings.speechPitch}
                onChange={(e) => onUpdateSpeech(settings.speechRate, parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-300" />
            <h3 className="font-mono-hud text-xs font-bold text-sky-300 tracking-wider">
              EXTERNAL COMMAND BRIDGES
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Quick launch verified web consoles & developer portals in a new secure tab.
          </p>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {quickTools.map((tool) => (
              <a
                key={tool.label}
                href={tool.href}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2.5 rounded-xl bg-[#040812] border border-slate-800 hover:border-cyan-400/50 text-xs font-mono-hud text-slate-200 flex items-center justify-between gap-2 transition-colors"
              >
                <span>{tool.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive JARVIS CLI Terminal */}
      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono-hud text-xs font-bold text-emerald-400 tracking-wider">
              JARVIS NEURAL CLI CONSOLE
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['help', 'sysinfo', 'diagnostics', 'ping', 'clear'].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => runCommand(cmd)}
                className="px-2 py-1 rounded bg-[#040812] border border-slate-800 hover:border-emerald-400/50 font-mono-hud text-[10px] text-slate-300 cursor-pointer"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#010308] border border-slate-800 p-4 h-64 overflow-y-auto font-mono-hud text-xs text-emerald-300 whitespace-pre-wrap space-y-2">
          {outputLines.map((line, idx) => (
            <div key={idx} className={line.startsWith('>') ? 'text-cyan-300 font-semibold' : 'text-emerald-300/95'}>
              {line}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runCommand(commandInput);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Enter terminal command (help, sysinfo, diagnostics, ping, defcon)..."
            className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 font-mono-hud text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPinging}
            className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#02040A] font-display text-xs font-bold tracking-wider cursor-pointer"
          >
            {isPinging ? 'RUNNING...' : 'RUN'}
          </button>
        </form>
      </div>
    </div>
  );
};
