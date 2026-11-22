import React, { useEffect, useState } from 'react';
import { Mic, Radio, Sparkles, Volume2, X } from 'lucide-react';
import { ActiveEngineAttribution } from '../types/jarvis';
import { AMReactor } from './AMReactor';

interface LiveSubtitlesHudProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  transcript: string;
  lastAssistantReply: string;
  activeEngine: ActiveEngineAttribution;
  conversationWindowActive: boolean;
  standbyMode: boolean;
  reducedMotion: boolean;
  powerSaving?: boolean;
  onExitStandby: () => void;
  onStopSpeaking: () => void;
  onStopListening: () => void;
  onDismissCaption?: () => void;
}

export const LiveSubtitlesHud: React.FC<LiveSubtitlesHudProps> = ({
  isListening,
  isSpeaking,
  isThinking,
  transcript,
  lastAssistantReply,
  activeEngine,
  conversationWindowActive,
  standbyMode,
  reducedMotion,
  powerSaving = false,
  onExitStandby,
  onStopSpeaking,
  onStopListening,
  onDismissCaption,
}) => {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    if (!standbyMode) return undefined;
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [standbyMode]);

  useEffect(() => {
    if (!standbyMode) return undefined;
    const handleWake = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        onExitStandby();
      }
    };
    window.addEventListener('keydown', handleWake);
    return () => window.removeEventListener('keydown', handleWake);
  }, [standbyMode, onExitStandby]);

  if (standbyMode) {
    const timeLabel = clock.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateLabel = clock.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    return (
      <div
        role="dialog"
        aria-label="AM AI Standby Hologram Overlay"
        data-testid="am-standby-overlay"
        onClick={onExitStandby}
        className="fixed inset-0 z-50 bg-[#010308]/96 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none"
      >
        <div className="mb-6 space-y-1">
          <p className="font-mono-hud text-xs tracking-[0.28em] text-[#00E5FF] uppercase">
            AM AI – COSMIC STANDBY MODE
          </p>
          <p className="font-display text-5xl sm:text-7xl font-black tracking-[0.14em] text-slate-100 drop-shadow-[0_0_24px_rgba(0,229,255,0.45)]">
            {timeLabel}
          </p>
          <p className="font-mono-hud text-xs tracking-[0.18em] text-[#AEBBCB] uppercase">
            {dateLabel}
          </p>
        </div>

        <AMReactor
          state={isListening ? 'LISTENING' : 'IDLE'}
          size="lg"
          reducedMotion={reducedMotion}
          powerSaving={powerSaving}
          statusText="TAP ANYWHERE OR SAY HEY AM TO WAKE"
          interactive={false}
        />

        <p className="mt-8 font-mono-hud text-[11px] tracking-[0.22em] text-cyan-300/80 uppercase">
          CLICK OR PRESS ANY KEY TO RESUME COMMAND CENTER
        </p>
      </div>
    );
  }

  const showFloatingCaption =
    isListening || isSpeaking || isThinking || conversationWindowActive;
  if (!showFloatingCaption) return null;

  const captionText = isListening
    ? transcript || 'Listening... speak in Hindi, English, or Hinglish...'
    : isThinking
      ? `Synthesizing via ${activeEngine}...`
      : lastAssistantReply
        ? lastAssistantReply.slice(0, 220) + (lastAssistantReply.length > 220 ? '…' : '')
        : 'AM AI audio channel active...';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="live-subtitles-hud"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-2xl rounded-2xl bg-[#020814]/95 border border-cyan-400/50 shadow-[0_0_32px_rgba(0,229,255,0.24)] backdrop-blur-md px-4 py-3 flex items-center gap-3"
    >
      <div
        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
          isListening
            ? 'bg-rose-500/20 border-rose-400/60 text-rose-300'
            : isSpeaking
              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
              : 'bg-sky-500/20 border-sky-400/50 text-sky-200'
        }`}
      >
        {isListening ? (
          <Mic className="w-4 h-4 animate-pulse" />
        ) : isSpeaking ? (
          <Volume2 className="w-4 h-4 animate-pulse" />
        ) : isThinking ? (
          <Sparkles className="w-4 h-4 animate-spin" />
        ) : (
          <Radio className="w-4 h-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-hud text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
            {isListening
              ? 'OPERATOR VOICE'
              : isThinking
                ? 'AM AI PROCESSING'
                : isSpeaking
                  ? 'AM AI SPEAKING'
                  : '8S FOLLOW-UP WINDOW'}
          </span>
          <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-[#071326] border border-cyan-500/35 text-cyan-200">
            {activeEngine}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-100 mt-0.5 line-clamp-2">{captionText}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isListening && (
          <button
            type="button"
            onClick={onStopListening}
            className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 font-mono-hud text-[10px] font-bold text-rose-200 cursor-pointer"
          >
            STOP MIC
          </button>
        )}
        {isSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 font-mono-hud text-[10px] font-bold text-amber-200 cursor-pointer"
          >
            MUTE AUDIO
          </button>
        )}
        {onDismissCaption && !isListening && !isSpeaking && !isThinking && (
          <button
            type="button"
            onClick={onDismissCaption}
            aria-label="Close live caption bar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
