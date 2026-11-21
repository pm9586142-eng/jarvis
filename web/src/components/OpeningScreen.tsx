import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Mic,
  Power,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Terminal,
  WifiOff,
} from 'lucide-react';
import {
  buildReactorSubsystemArcs,
  DiagnosticProbeStatus,
  PreflightDiagnosticsReport,
} from '../services/diagnostics';
import { BrowserTelemetry, ConnectionState, LanguageCode } from '../types/jarvis';
import { AMReactor, AMReactorState } from './AMReactor';
import { BiometricPad } from './BiometricPad';

interface OpeningScreenProps {
  telemetry: BrowserTelemetry;
  connectionState: ConnectionState;
  diagnostics: PreflightDiagnosticsReport | null;
  diagnosticsLoading: boolean;
  startupAnimationMode?: 'full' | 'short' | 'off';
  language: LanguageCode;
  reducedMotion: boolean;
  powerSaving?: boolean;
  onRefreshDiagnostics: () => void;
  onInitialize: (unlockAudio?: boolean) => void;
  onEnterVoiceMode: () => void;
}

type BootPhase = 'spark' | 'rings' | 'reactor' | 'ready';

function statusBadgeClass(status: DiagnosticProbeStatus): string {
  switch (status) {
    case 'ONLINE':
      return 'bg-emerald-500/15 border-emerald-400/45 text-emerald-300';
    case 'DEGRADED':
      return 'bg-amber-500/15 border-amber-400/45 text-amber-200';
    case 'OFFLINE':
      return 'bg-rose-500/15 border-rose-400/45 text-rose-300';
    case 'UNSUPPORTED':
    case 'UNKNOWN':
    default:
      return 'bg-slate-800/80 border-slate-600/60 text-slate-300';
  }
}

export const OpeningScreen: React.FC<OpeningScreenProps> = ({
  telemetry,
  connectionState,
  diagnostics,
  diagnosticsLoading,
  startupAnimationMode = 'full',
  language,
  reducedMotion,
  powerSaving = false,
  onRefreshDiagnostics,
  onInitialize,
  onEnterVoiceMode,
}) => {
  const skipAnimation = reducedMotion || startupAnimationMode === 'off';
  const isShort = startupAnimationMode === 'short';

  const [phase, setPhase] = useState<BootPhase>(() => (skipAnimation ? 'ready' : 'spark'));

  useEffect(() => {
    if (skipAnimation) return;
    const t1 = window.setTimeout(() => setPhase('rings'), isShort ? 120 : 280);
    const t2 = window.setTimeout(() => setPhase('reactor'), isShort ? 260 : 620);
    const t3 = window.setTimeout(() => setPhase('ready'), isShort ? 450 : 1050);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [skipAnimation, isShort]);

  // Allow instant Escape key bypass
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onInitialize(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onInitialize]);

  const reactorState: AMReactorState =
    phase !== 'ready'
      ? 'BOOT'
      : connectionState === 'offline'
        ? 'OFFLINE'
        : connectionState === 'key_missing'
          ? 'ERROR'
          : 'IDLE';

  const subsystemArcs = useMemo(
    () =>
      buildReactorSubsystemArcs({
        connectionState,
        diagnostics,
        speechRecognitionSupported:
          diagnostics?.items.find((i) => i.id === 'stt')?.status === 'ONLINE',
        speechSynthesisSupported:
          diagnostics?.items.find((i) => i.id === 'tts')?.status === 'ONLINE',
        memoriesCount: 0,
        mediaActive: false,
      }),
    [connectionState, diagnostics]
  );

  const visibleLines = useMemo(() => {
    if (diagnostics?.terminalLines?.length) {
      return diagnostics.terminalLines;
    }
    return [
      '[BOOT] Initializing AM AI – Cosmic Intelligence kernel...',
      '[PROBE] Running parallel backend, AI provider, voice, and vault diagnostics...',
    ];
  }, [diagnostics]);

  const greetingPreview =
    language === 'HINDI'
      ? 'Namaste Sir. AM AI online hai. Main aapki kya madad kar sakti hoon?'
      : 'Hello Sir. Welcome to AM AI. Your systems are ready. How may I assist you today?';

  return (
    <div className="relative min-h-screen w-full bg-[#02050B] am-cosmic-bg hud-grid-bg text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Subtle Cosmic Horizon Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-[#00E5FF]/10 blur-[120px] transition-opacity duration-700 ${
            phase === 'spark' ? 'opacity-25' : 'opacity-100'
          }`}
        />
        <div className="absolute bottom-0 right-1/5 w-[420px] h-[420px] rounded-full bg-[#2F8BFF]/10 blur-[120px]" />
      </div>

      {/* Top Status & Skip Header */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              connectionState === 'online'
                ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
                : connectionState === 'key_missing'
                  ? 'bg-[#FFB020]'
                  : connectionState === 'connecting'
                    ? 'bg-[#00E5FF] animate-pulse'
                    : 'bg-[#FF3D3D]'
            }`}
          />
          <span className="font-mono-hud text-[11px] text-cyan-200/90 tracking-[0.18em] uppercase truncate">
            AM AI – COSMIC INTELLIGENCE • PREFLIGHT GATE
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshDiagnostics}
            disabled={diagnosticsLoading}
            aria-label="Re-run system diagnostics"
            className="hidden sm:inline-flex items-center gap-1.5 font-mono-hud text-[11px] text-cyan-300 hover:text-white px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-[#071326]/80 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
            <span>RE-PROBE</span>
          </button>

          <button
            type="button"
            data-testid="startup-skip-btn"
            onClick={() => onInitialize(false)}
            className="inline-flex items-center gap-1.5 font-mono-hud text-xs text-cyan-200 hover:text-white transition-colors cursor-pointer px-3.5 py-2 rounded-lg border border-cyan-400/40 bg-[#071326]/90 min-h-[40px]"
          >
            <span>SKIP</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Center Cosmic Ignition Stage */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: AM Arc Reactor Awakening */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center gap-4">
          <div
            className={`transition-all duration-700 ${
              phase === 'spark'
                ? 'scale-75 opacity-40'
                : phase === 'rings'
                  ? 'scale-95 opacity-85'
                  : 'scale-100 opacity-100'
            }`}
          >
            <AMReactor
              state={reactorState}
              size="lg"
              subsystems={subsystemArcs}
              reducedMotion={reducedMotion}
              powerSaving={powerSaving}
              statusText={
                phase !== 'ready'
                  ? 'AWAKENING COSMIC REACTOR'
                  : diagnostics?.overallStatus === 'ONLINE'
                    ? 'ALL PREFLIGHT CHECKS NOMINAL'
                    : diagnostics?.overallStatus === 'DEGRADED'
                      ? 'STANDBY — PARTIAL SUBSYSTEMS'
                      : diagnosticsLoading
                        ? 'PROBING SUBSYSTEMS...'
                        : 'LOCAL INTERFACE READY'
              }
              onClick={() => onInitialize(true)}
            />
          </div>

          {/* Live Telemetry Diagnostics Pills */}
          <div className="w-full max-w-md grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(diagnostics?.items || []).slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="px-2.5 py-2 rounded-xl bg-[#071326]/85 border border-cyan-500/20 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono-hud text-[10px] text-slate-400 uppercase truncate">
                    {item.label}
                  </span>
                  <span
                    className={`font-mono-hud text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusBadgeClass(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate" title={item.detail}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Identity, Live Terminal Feed, Biometric & Audio-Unlock CTA */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/35">
              <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="font-mono-hud text-[10px] tracking-[0.22em] text-cyan-200 uppercase">
                COSMIC INTELLIGENCE • COMMAND MATRIX
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-black tracking-[0.22em] text-slate-100">
              AM <span className="text-[#00E5FF]">AI</span>
            </h1>

            <p className="font-hud text-sm sm:text-base text-[#AEBBCB] max-w-xl">
              Autonomous personal command center with multilingual female voice intelligence (Hindi + English), YouTube theater, research engine, and zero-cost multi-AI routing.
            </p>
          </div>

          {/* Real Preflight Terminal Diagnostics Box */}
          <div className="w-full glass-panel rounded-2xl p-3.5 border border-cyan-500/30 bg-[#040B17]/90 text-left space-y-2">
            <div className="flex items-center justify-between border-b border-cyan-500/15 pb-1.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span className="font-mono-hud text-[11px] font-bold tracking-wider text-cyan-200">
                  LIVE SYSTEM DIAGNOSTICS
                </span>
              </div>
              <span className="font-mono-hud text-[10px] text-slate-400">
                {diagnostics?.backendHealth
                  ? `API ${diagnostics.items.find((i) => i.id === 'backend')?.latencyMs ?? 0}ms`
                  : telemetry.online
                    ? 'LOCAL PROBE'
                    : 'OFFLINE'}
              </span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1 font-mono-hud text-[11px] leading-relaxed">
              {visibleLines.map((line, idx) => (
                <p
                  key={idx}
                  className={
                    line.includes('OFFLINE')
                      ? 'text-rose-300'
                      : line.includes('DEGRADED') || line.includes('UNSUPPORTED')
                        ? 'text-amber-200'
                        : 'text-cyan-100/90'
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Primary User-Gesture Audio Unlock & Entry Controls */}
          <div className="w-full flex flex-col sm:flex-row items-center gap-4">
            <BiometricPad onVerified={() => onInitialize(true)} />

            <div className="flex-1 w-full flex flex-col gap-2.5">
              <button
                type="button"
                data-testid="tap-to-initialize-btn"
                onClick={() => onInitialize(true)}
                className="w-full min-h-[48px] py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#00E5FF] via-[#2F8BFF] to-[#00E5FF] hover:brightness-110 text-[#02050B] font-display text-xs sm:text-sm font-black tracking-[0.16em] flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-[0_0_28px_rgba(0,229,255,0.38)]"
              >
                <Power className="w-4 h-4 shrink-0" />
                <span>TAP TO INITIALIZE AM AI</span>
              </button>

              <button
                type="button"
                data-testid="startup-voice-matrix-btn"
                onClick={onEnterVoiceMode}
                className="w-full min-h-[44px] py-2.5 px-5 rounded-xl border border-cyan-400/50 hover:border-cyan-300 bg-[#071326]/90 text-cyan-200 font-display text-xs font-semibold tracking-[0.16em] flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4 shrink-0 text-[#00E5FF]" />
                <span>ACTIVATE VOICE MATRIX</span>
              </button>

              <p className="font-mono-hud text-[10px] text-slate-400 leading-snug">
                Tap initializes AudioContext + bilingual voice greeting: &ldquo;{greetingPreview}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Real System Telemetry Footer */}
      <footer className="relative z-10 border-t border-cyan-500/20 bg-[#02050B]/92 px-4 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 font-mono-hud text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
              CORE: AM REACTOR READY
            </span>
            <span className="flex items-center gap-1.5">
              {connectionState === 'online' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : connectionState === 'offline' ? (
                <WifiOff className="w-3.5 h-3.5 text-[#FF3D3D]" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFB020]" />
              )}
              AI ENGINE:{' '}
              {connectionState === 'online'
                ? 'ONLINE'
                : connectionState === 'key_missing'
                  ? 'AWAITING PROVIDER KEY'
                  : connectionState === 'connecting'
                    ? 'PROBING'
                    : 'OFFLINE'}
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#2F8BFF]" />
              POWER: {telemetry.batteryPercent !== null ? `${telemetry.batteryPercent}%` : 'NOMINAL'}
            </span>
          </div>
          <span>PRESS ESC TO ENTER DASHBOARD</span>
        </div>
      </footer>
    </div>
  );
};
