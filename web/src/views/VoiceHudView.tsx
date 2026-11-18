import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Mic,
  Pause,
  Play,
  Radio,
  Send,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AudioWaveVisualizer } from '../components/AudioWaveVisualizer';
import { QuantumCoreCanvas } from '../components/QuantumCoreCanvas';
import { JARVIS_LANGUAGES } from '../data/agents';
import {
  AvailableVoiceOption,
  getAvailableVoices,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '../services/voice';
import { LanguageCode } from '../types/jarvis';

interface VoiceHudViewProps {
  language: LanguageCode;
  isVoiceModeEnabled: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isSpeechPaused: boolean;
  isSpeechMuted: boolean;
  isProcessing: boolean;
  isHandsFreeMode: boolean;
  speechRate?: number;
  selectedVoiceUri?: string;
  autoSpeakReplies?: boolean;
  transcript: string;
  voiceError: string | null;
  voicePermissionDenied: boolean;
  audioLevel: number;
  reducedMotion: boolean;
  onEnableVoiceMode: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onSpeechRateChange?: (rate: number) => void;
  onVoiceUriChange?: (voiceUri: string) => void;
  onToggleAutoSpeakReplies?: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onStartHandsFree: () => void;
  onExitHandsFree: () => void;
  onDismissError: () => void;
  onPauseSpeaking: () => void;
  onResumeSpeaking: () => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
  onQuickCommand: (text: string) => void;
}

export const VoiceHudView: React.FC<VoiceHudViewProps> = ({
  language,
  isVoiceModeEnabled,
  isListening,
  isSpeaking,
  isSpeechPaused,
  isSpeechMuted,
  isProcessing,
  isHandsFreeMode,
  speechRate = 1.0,
  selectedVoiceUri = '',
  autoSpeakReplies = false,
  transcript,
  voiceError,
  voicePermissionDenied,
  audioLevel,
  reducedMotion,
  onEnableVoiceMode,
  onLanguageChange,
  onSpeechRateChange,
  onVoiceUriChange,
  onToggleAutoSpeakReplies,
  onStartListening,
  onStopListening,
  onStartHandsFree,
  onExitHandsFree,
  onDismissError,
  onPauseSpeaking,
  onResumeSpeaking,
  onStopSpeaking,
  onToggleMute,
  onQuickCommand,
}) => {
  const sttSupported = isSpeechRecognitionSupported();
  const ttsSupported = isSpeechSynthesisSupported();
  const [typedDirective, setTypedDirective] = useState('');
  const [voices, setVoices] = useState<AvailableVoiceOption[]>(() => getAvailableVoices());

  useEffect(() => {
    if (!ttsSupported) return;
    const refresh = () => setVoices(getAvailableVoices());
    refresh();
    window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', refresh);
  }, [ttsSupported]);

  const handleSubmitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedDirective.trim()) return;
    onQuickCommand(typedDirective.trim());
    setTypedDirective('');
  };

  const visualizerMode = isListening
    ? 'listening'
    : isSpeaking && !isSpeechPaused
      ? 'speaking'
      : isProcessing
        ? 'processing'
        : 'standby';

  return (
    <div className="glass-panel-glow rounded-2xl p-6 flex flex-col items-center justify-between min-h-[calc(100dvh-9rem)] gap-6">
      <div className="text-center space-y-2 w-full max-w-2xl">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h2 className="font-display text-lg sm:text-xl tracking-[0.2em] text-slate-100">
            VOICE INTELLIGENCE MATRIX
          </h2>
          {isHandsFreeMode && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 font-mono-hud text-[10px] font-bold text-emerald-300 animate-pulse">
              CONTINUOUS MODE ACTIVE
            </span>
          )}
          {isSpeechMuted && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 font-mono-hud text-[10px] font-bold text-amber-300">
              VOICE MUTED
            </span>
          )}
        </div>

        <p className="font-mono-hud text-xs text-cyan-300">
          {isSpeaking
            ? isSpeechPaused
              ? 'VOCAL SYNTHESIS PAUSED'
              : 'SPEAKING AI RESPONSE'
            : isProcessing
              ? 'THINKING VIA GEMINI BRAIN'
              : isListening
                ? 'LISTENING TO VOICE INPUT'
                : isHandsFreeMode
                  ? 'CONTINUOUS CONVERSATION STANDBY'
                  : `STANDBY • LANGUAGE: ${language}`}
        </p>

        <p className="font-mono-hud text-[11px] text-slate-400">
          STT: {sttSupported ? 'Web Speech Available' : 'Unavailable (use Chrome/Edge or type below)'} • TTS:{' '}
          {ttsSupported ? 'Available' : 'Unavailable'}
        </p>

        {/* Quick Language Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {Object.values(JARVIS_LANGUAGES).map((langObj) => (
            <button
              key={langObj.code}
              type="button"
              onClick={() => onLanguageChange(langObj.code)}
              className={`px-2.5 py-1 rounded-lg border font-mono-hud text-[10px] font-bold cursor-pointer transition-colors ${
                language === langObj.code
                  ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                  : 'bg-[#040812] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {langObj.shortCode} • {langObj.displayName.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {!isVoiceModeEnabled && (
        <div className="w-full max-w-xl rounded-xl bg-amber-500/15 border border-amber-400/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono-hud text-xs text-amber-200">
            Voice Mode is currently disabled in Settings. Enable it for automatic spoken replies.
          </p>
          <button
            type="button"
            onClick={onEnableVoiceMode}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#02040A] font-mono-hud text-[11px] font-bold cursor-pointer"
          >
            ENABLE VOICE MODE
          </button>
        </div>
      )}

      <div className="w-full max-w-sm h-64">
        <QuantumCoreCanvas
          audioPulse={
            isListening || (isSpeaking && !isSpeechPaused)
              ? Math.max(0.24, audioLevel)
              : isProcessing
                ? 0.14
                : 0.04
          }
          nodeCount={54}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="w-full max-w-xl space-y-4">
        <div className="rounded-xl bg-[#040812] border border-slate-800 p-4 text-center">
          <p className="text-sm text-slate-200">
            {transcript
              ? `"${transcript}"`
              : isListening
                ? 'Listening for voice command (Hindi / English / Hinglish)...'
                : isProcessing
                  ? 'Processing recognized command via Gemini Brain...'
                  : isHandsFreeMode
                    ? 'Continuous conversation engaged: JARVIS listens, replies, speaks cleanly, and resumes automatically.'
                    : sttSupported
                      ? 'Tap Start Speaking for a single prompt, or Start Continuous Mode for hands-free dialogue.'
                      : 'Browser Speech Recognition is unavailable here. Use the command bar or presets below.'}
          </p>
        </div>

        {voiceError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 space-y-2 text-xs text-rose-200 font-mono-hud">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {voicePermissionDenied ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p>{voiceError}</p>
                  {voicePermissionDenied && (
                    <p className="text-[11px] text-amber-200">
                      Browser tip: Open your browser site permissions (lock/sliders icon next to URL) → Microphone → Allow, then retry.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss voice error"
                className="text-rose-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <AudioWaveVisualizer
          audioLevel={audioLevel}
          isActive={isListening || (isSpeaking && !isSpeechPaused) || isProcessing}
          mode={visualizerMode}
          reducedMotion={reducedMotion}
        />

        {/* Primary Mic & Continuous Conversation Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isHandsFreeMode ? (
            <button
              type="button"
              onClick={onExitHandsFree}
              className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Square className="w-4 h-4" />
              <span>STOP VOICE MODE</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={isListening ? onStopListening : onStartListening}
                className={`px-6 py-3 rounded-xl font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
                  isListening
                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_24px_rgba(244,63,94,0.45)]'
                    : 'bg-cyan-400 hover:bg-cyan-300 text-[#02040A] shadow-[0_0_24px_rgba(0,240,255,0.35)]'
                }`}
              >
                {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? 'STOP LISTENING' : 'START SPEAKING'}</span>
              </button>

              <button
                type="button"
                onClick={onStartHandsFree}
                className="px-5 py-3 rounded-xl bg-[#0D1527] border border-emerald-400/60 hover:bg-emerald-500/15 text-emerald-300 font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Radio className="w-4 h-4" />
                <span>START VOICE MODE</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isSpeechMuted ? 'Unmute JARVIS voice' : 'Mute JARVIS voice'}
            className={`px-4 py-3 rounded-xl border font-mono-hud text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              isSpeechMuted
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-[#0D1527] border-slate-700 text-slate-200 hover:border-cyan-400'
            }`}
          >
            {isSpeechMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{isSpeechMuted ? 'UNMUTE' : 'MUTE'}</span>
          </button>
        </div>

        {/* TTS Playback Bar (Play/Pause/Resume/Stop) */}
        {isSpeaking && (
          <div className="flex flex-wrap items-center justify-center gap-2 p-2.5 rounded-xl bg-[#070D18] border border-violet-400/40">
            <span className="font-mono-hud text-[11px] text-violet-200 mr-2">
              {isSpeechPaused ? 'SPEECH PAUSED' : 'SPEAKING RESPONSE'}
            </span>
            {isSpeechPaused ? (
              <button
                type="button"
                onClick={onResumeSpeaking}
                className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-[#02040A] font-mono-hud text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>RESUME</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onPauseSpeaking}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#02040A] font-mono-hud text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>PAUSE</span>
              </button>
            )}
            <button
              type="button"
              onClick={onStopSpeaking}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/60 hover:bg-rose-500/30 text-rose-200 font-mono-hud text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>STOP</span>
            </button>
          </div>
        )}

        {/* Voice Calibration Quick Strip (Voice Selection, Speed & Auto-Speak) */}
        <div className="rounded-xl bg-[#040812] border border-slate-800 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="space-y-1">
            <label className="font-mono-hud text-[10px] text-slate-400 block">VOICE PROFILE</label>
            <select
              aria-label="Select speaking voice"
              value={selectedVoiceUri}
              onChange={(e) => onVoiceUriChange?.(e.target.value)}
              className="w-full bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-hud text-[11px] text-cyan-200 focus:outline-none"
            >
              <option value="">Auto ({language})</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between font-mono-hud text-[10px] text-slate-400">
              <span>SPEECH SPEED</span>
              <span className="text-cyan-300">{speechRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={speechRate}
              aria-label="Voice speech speed"
              onChange={(e) => onSpeechRateChange?.(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <button
              type="button"
              onClick={onToggleAutoSpeakReplies}
              className={`px-3 py-2 rounded-lg border font-mono-hud text-[10px] font-bold cursor-pointer ${
                autoSpeakReplies
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-[#0D1527] border-slate-700 text-slate-300'
              }`}
            >
              AUTO-SPEAK: {autoSpeakReplies ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Typed Directive Fallback for any browser */}
        <form onSubmit={handleSubmitTyped} className="flex gap-2">
          <input
            type="text"
            value={typedDirective}
            onChange={(e) => setTypedDirective(e.target.value)}
            placeholder="Or type a directive for JARVIS to answer & speak..."
            className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!typedDirective.trim()}
            aria-label="Send voice directive"
            className="px-4 py-2.5 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 disabled:opacity-40 text-cyan-300 font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>DISPATCH</span>
          </button>
        </form>

        <div className="space-y-1.5">
          <p className="font-mono-hud text-[10px] text-slate-400 text-center uppercase tracking-wider">
            Instant Offline Voice Commands (zero latency):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              'open security',
              'toggle lockdown',
              "what's my battery",
              'new chat',
              'stop',
            ].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onQuickCommand(cmd)}
                className="px-2.5 py-2 rounded-lg bg-[#0D1527] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[11px] text-cyan-200 cursor-pointer truncate"
              >
                "{cmd}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
