import React from 'react';
import {
  CloudSun,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Sparkles,
  Square,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BrowserTelemetry, DailyBriefingData } from '../types/jarvis';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';

interface CommandCenterBottomBarProps {
  telemetry: BrowserTelemetry;
  dailyBriefing: DailyBriefingData | null;
  briefingLoading: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  audioLevel: number;
  transcript: string;
  voiceError: string | null;
  speechRecognitionSupported: boolean;
  reducedMotion: boolean;
  onTalkToJarvis: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onExecutiveBriefing: () => void;
}

export const CommandCenterBottomBar: React.FC<CommandCenterBottomBarProps> = ({
  telemetry,
  dailyBriefing,
  briefingLoading,
  isListening,
  isSpeaking,
  isThinking,
  audioLevel,
  transcript,
  voiceError,
  speechRecognitionSupported,
  reducedMotion,
  onTalkToJarvis,
  onStopListening,
  onStopSpeaking,
  onExecutiveBriefing,
}) => {
  const timeZoneLabel = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Sector';
    } catch {
      return 'Local Sector';
    }
  })();

  const weatherLabel = dailyBriefing?.weatherSummary
    ? dailyBriefing.weatherSummary.split('•')[0].trim()
    : briefingLoading
      ? 'Syncing weather...'
      : 'Weather standby';

  return (
    <section
      aria-label="JARVIS Command Center Bottom Voice and Telemetry Bar"
      className="glass-panel-glow rounded-2xl border border-cyan-400/35 bg-[#040916]/95 p-3 sm:p-4 space-y-2.5"
    >
      {/* Live Voice Transcript / Error Strip when active */}
      {(isListening || isSpeaking || isThinking || transcript || voiceError) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#071022] border border-cyan-500/30">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                voiceError
                  ? 'bg-rose-400'
                  : isListening
                    ? 'bg-rose-400 animate-ping'
                    : isSpeaking
                      ? 'bg-cyan-300 animate-pulse'
                      : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <p className="font-mono-hud text-[11px] text-cyan-100 truncate">
              {voiceError
                ? voiceError
                : isListening
                  ? transcript
                    ? `Heard: "${transcript}"`
                    : 'Listening for voice command...'
                  : isThinking
                    ? 'Processing request through JARVIS Neural Core...'
                    : isSpeaking
                      ? 'JARVIS vocal output active...'
                      : `Last transcript: "${transcript}"`}
            </p>
          </div>
          {(isListening || isSpeaking) && (
            <button
              type="button"
              onClick={isListening ? onStopListening : onStopSpeaking}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 font-mono-hud text-[10px] text-rose-200 flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{isListening ? 'Stop Listening' : 'Stop Audio'}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Left: Location, Weather & Network Telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 xl:flex xl:items-center xl:gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#070E1F] border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-mono-hud text-[9px] text-slate-400">LOCATION</p>
              <p className="font-mono-hud text-[11px] text-slate-100 truncate">{timeZoneLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#070E1F] border border-slate-800">
            <CloudSun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <p className="font-mono-hud text-[9px] text-slate-400">WEATHER</p>
              <p className="font-mono-hud text-[11px] text-slate-100 truncate">{weatherLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#070E1F] border border-slate-800">
            {telemetry.online ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-mono-hud text-[9px] text-slate-400">NETWORK</p>
              <p
                className={`font-mono-hud text-[11px] truncate ${
                  telemetry.online ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {telemetry.networkType}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live Animated Voice Waveform */}
        <div className="flex-1 min-w-[160px] h-12 px-3 rounded-xl bg-[#040A16] border border-cyan-500/20 flex items-center gap-3">
          <button
            type="button"
            onClick={isListening ? onStopListening : onTalkToJarvis}
            aria-label={isListening ? 'Stop voice recognition' : 'Start microphone'}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500/25 border border-rose-400 text-rose-200 animate-pulse'
                : 'bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/25'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <div className="flex-1 h-9 overflow-hidden">
            <AudioWaveVisualizer
              isActive={isListening || isSpeaking}
              audioLevel={isSpeaking ? Math.max(0.45, audioLevel) : audioLevel}
              reducedMotion={reducedMotion}
            />
          </div>
          <span className="hidden sm:inline font-mono-hud text-[10px] text-cyan-300/80 shrink-0">
            {!speechRecognitionSupported
              ? 'TTS READY'
              : isListening
                ? 'STT LIVE'
                : isSpeaking
                  ? 'VOCAL OUT'
                  : 'VOICE READY'}
          </span>
        </div>

        {/* Right: Large TALK TO JARVIS + Executive Briefing Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={isListening ? onStopListening : onTalkToJarvis}
            className={`flex-1 sm:flex-initial px-5 py-3 rounded-xl font-display text-xs sm:text-sm font-bold tracking-[0.14em] flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_24px_rgba(244,63,94,0.45)]'
                : 'bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-300 hover:brightness-110 text-[#02040A] shadow-[0_0_24px_rgba(0,240,255,0.4)]'
            }`}
          >
            {isListening ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>STOP LISTENING</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>TALK TO JARVIS</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExecutiveBriefing}
            disabled={briefingLoading}
            className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-[#0B1528] hover:bg-cyan-500/15 border border-cyan-400/45 text-cyan-200 font-display text-xs font-semibold tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer transition-colors"
          >
            {briefingLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-300" />
            )}
            <span>EXECUTIVE BRIEFING</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300 hidden sm:inline" />
          </button>
        </div>
      </div>
    </section>
  );
};
