import React from 'react';
import { Fingerprint, Mic, SkipForward } from 'lucide-react';
import { BrowserTelemetry, ConnectionState } from '../types/jarvis';
import { QuantumCoreCanvas } from './QuantumCoreCanvas';
import { BiometricPad } from './BiometricPad';

interface OpeningScreenProps {
  telemetry: BrowserTelemetry;
  connectionState: ConnectionState;
  reducedMotion: boolean;
  onInitialize: () => void;
  onEnterVoiceMode: () => void;
}

export const OpeningScreen: React.FC<OpeningScreenProps> = ({
  telemetry,
  connectionState,
  reducedMotion,
  onInitialize,
  onEnterVoiceMode,
}) => {
  const nowStr = new Date().toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative min-h-screen w-full bg-[#02040A] hud-grid-bg text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Ambient nebula background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[460px] h-[460px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      {/* Top Skip / Bypass Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionState === 'online'
                ? 'bg-emerald-400'
                : connectionState === 'key_missing'
                  ? 'bg-amber-400'
                  : connectionState === 'connecting'
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-rose-500'
            }`}
          />
          <span className="font-mono-hud text-[11px] text-slate-400 tracking-wider uppercase">
            STARK OS 2050 • WEB NEURAL INTERFACE
          </span>
        </div>

        <button
          type="button"
          onClick={onInitialize}
          className="flex items-center gap-1.5 font-mono-hud text-xs text-cyan-300 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-[#0D1527]/70"
        >
          <span>BYPASS SCAN</span>
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Responsive Split Layout */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left/Top: Quantum AI Core */}
        <div className="lg:col-span-7 h-[320px] sm:h-[400px] lg:h-[480px] relative flex items-center justify-center">
          <QuantumCoreCanvas nodeCount={58} reducedMotion={reducedMotion} />
        </div>

        {/* Right/Bottom: Typography + Biometric Touch Scanner + Controls */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
          <div>
            <p className="font-mono-hud text-[11px] text-cyan-300 tracking-[0.25em] uppercase">
              STARK INDUSTRIES OS 2050
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-light tracking-[0.22em] text-slate-100 mt-2">
              J·A·R·V·I·S
            </h1>
            <p className="font-mono-hud text-xs text-cyan-400 tracking-widest mt-2">
              JUST A RATHER VERY INTELLIGENT SYSTEM
            </p>
            <p className="text-sm text-slate-400 mt-3 max-w-md">
              Beyond the stars, intelligence awakens. Hold the biometric sensor or authenticate below to enter your personal command universe.
            </p>
          </div>

          <div className="w-full flex justify-center lg:justify-start">
            <BiometricPad onVerified={onInitialize} />
          </div>

          <div className="w-full max-w-sm flex flex-col gap-3">
            <button
              type="button"
              onClick={onInitialize}
              className="w-full py-3.5 px-5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-[0_0_24px_rgba(0,240,255,0.28)]"
            >
              <Fingerprint className="w-4 h-4" />
              <span>ENTER JARVIS UNIVERSE</span>
            </button>

            <button
              type="button"
              onClick={onEnterVoiceMode}
              className="w-full py-3 px-5 rounded-xl border border-cyan-400/50 hover:border-cyan-300 bg-[#0D1527]/80 text-cyan-200 font-display text-xs font-semibold tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>ACTIVATE VOICE MATRIX</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Real System Telemetry Bar */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#02040A]/90 px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 font-mono-hud text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              QUANTUM CORE: READY
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionState === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              GEMINI ENGINE:{' '}
              {connectionState === 'online'
                ? 'ONLINE'
                : connectionState === 'key_missing'
                  ? 'AWAITING KEY'
                  : connectionState === 'connecting'
                    ? 'CONNECTING'
                    : 'OFFLINE'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              BATTERY: {telemetry.batteryPercent !== null ? `${telemetry.batteryPercent}%` : 'AC/WEB'}
            </span>
          </div>
          <span>{nowStr}</span>
        </div>
      </footer>
    </div>
  );
};
