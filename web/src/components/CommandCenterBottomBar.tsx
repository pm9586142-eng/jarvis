import React, { useState } from 'react';
import {
  CloudSun,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Pause,
  Play,
  Search,
  Send,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ActiveEngineAttribution, BrowserTelemetry, DailyBriefingData } from '../types/jarvis';
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
  activeEngine?: ActiveEngineAttribution;
  mediaPlayingTitle?: string | null;
  isMediaPlaying?: boolean;
  onMediaPlayPause?: () => void;
  onMediaNext?: () => void;
  onMediaPrev?: () => void;
  onSubmitCommand?: (rawText: string) => void;
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
  activeEngine = 'Cloud AI',
  mediaPlayingTitle = null,
  isMediaPlaying = false,
  onMediaPlayPause,
  onMediaNext,
  onMediaPrev,
  onSubmitCommand,
  onTalkToJarvis,
  onStopListening,
  onStopSpeaking,
  onExecutiveBriefing,
}) => {
  const [commandInput, setCommandInput] = useState('');

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
      ? 'Syncing...'
      : telemetry.online
        ? 'Weather Standby'
        : 'Offline';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = commandInput.trim();
    if (!q || !onSubmitCommand) return;
    onSubmitCommand(q);
    setCommandInput('');
  };

  return (
    <section
      aria-label="AM AI Command Center Bottom Voice and Telemetry Bar"
      data-testid="command-center-bottom-bar"
      className="am-hud-frame rounded-2xl border border-cyan-400/40 bg-[#02060F]/96 p-3 space-y-2.5 shadow-[0_0_26px_rgba(0,229,255,0.12)]"
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
                    : 'Listening for voice command (Say "Hey AM")...'
                  : isThinking
                    ? `Processing via ${activeEngine}...`
                    : isSpeaking
                      ? 'AM AI vocal output active...'
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
              <span>{isListening ? 'Stop Mic' : 'Mute'}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
        {/* Left: Compact Telemetry & Hardware Chips */}
        <div className="grid grid-cols-3 xl:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#040B17] border border-cyan-500/20 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="font-mono-hud text-[10px] text-slate-200 truncate">{timeZoneLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#040B17] border border-cyan-500/20 min-w-0">
            <CloudSun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="font-mono-hud text-[10px] text-slate-200 truncate">{weatherLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#040B17] border border-cyan-500/20 min-w-0">
            {telemetry.online ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span
              className={`font-mono-hud text-[10px] truncate ${
                telemetry.online ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {telemetry.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Center: Command / Search Input Pill (mirrors reference bottom center search bar) */}
        {onSubmitCommand && (
          <form
            onSubmit={handleSubmit}
            className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#040B17] border border-cyan-400/35 focus-within:border-[#00E5FF]"
          >
            <Search className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <input
              type="text"
              data-testid="cockpit-command-input"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder='Ask AM AI or run command (e.g. "Add task", "Play music", "Note:")...'
              aria-label="AM AI command input"
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none min-h-[30px]"
            />
            <button
              type="submit"
              data-testid="cockpit-command-submit-btn"
              aria-label="Send command"
              className="px-2.5 py-1 rounded-lg bg-[#00E5FF] text-[#02050B] font-mono-hud text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Send className="w-3 h-3" />
              <span className="hidden sm:inline">RUN</span>
            </button>
          </form>
        )}

        {/* Center-Right: Media Transport + Live Voice Waveform */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#040A16] border border-cyan-500/25">
          {onMediaPlayPause && (
            <div className="flex items-center gap-1 pr-2 border-r border-slate-800 shrink-0">
              <button
                type="button"
                onClick={onMediaPrev}
                aria-label="Previous track"
                className="p-1.5 rounded-lg text-slate-300 hover:text-[#00E5FF] cursor-pointer"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onMediaPlayPause}
                aria-label={isMediaPlaying ? 'Pause media' : 'Play media'}
                className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-[#00E5FF] flex items-center justify-center cursor-pointer"
              >
                {isMediaPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onMediaNext}
                aria-label="Next track"
                className="p-1.5 rounded-lg text-slate-300 hover:text-[#00E5FF] cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={isListening ? onStopListening : onTalkToJarvis}
            aria-label={isListening ? 'Stop voice recognition' : 'Start microphone'}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500/25 border border-rose-400 text-rose-200 animate-pulse'
                : 'bg-cyan-500/15 border border-cyan-400/50 text-[#00E5FF] hover:bg-cyan-500/25'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <div className="w-24 sm:w-32 h-8 overflow-hidden">
            <AudioWaveVisualizer
              isActive={isListening || isSpeaking}
              audioLevel={isSpeaking ? Math.max(0.45, audioLevel) : audioLevel}
              reducedMotion={reducedMotion}
            />
          </div>

          <span
            className="hidden md:inline font-mono-hud text-[9px] text-cyan-300/85 truncate max-w-[110px]"
            title={mediaPlayingTitle || undefined}
          >
            {mediaPlayingTitle
              ? mediaPlayingTitle
              : !speechRecognitionSupported
                ? 'TTS READY'
                : isListening
                  ? 'STT LIVE'
                  : 'VOICE READY'}
          </span>
        </div>

        {/* Right: Primary Voice & Briefing Triggers */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="talk-to-am-btn"
            onClick={isListening ? onStopListening : onTalkToJarvis}
            className={`flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl font-display text-xs font-bold tracking-[0.12em] flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_24px_rgba(244,63,94,0.45)]'
                : 'bg-gradient-to-r from-[#00E5FF] via-[#2F8BFF] to-[#00E5FF] hover:brightness-110 text-[#02050B] shadow-[0_0_22px_rgba(0,229,255,0.4)]'
            }`}
          >
            {isListening ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>STOP</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>TALK TO AM AI</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExecutiveBriefing}
            disabled={briefingLoading}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#071326] hover:bg-cyan-500/15 border border-cyan-400/45 text-cyan-200 font-display text-[11px] font-semibold tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer transition-colors"
          >
            {briefingLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#00E5FF]" />
            )}
            <span className="hidden sm:inline">BRIEFING</span>
            <Sparkles className="w-3 h-3 text-amber-300 hidden md:inline" />
          </button>
        </div>
      </div>
    </section>
  );
};
