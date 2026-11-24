import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Globe,
  Headphones,
  Mic,
  Pause,
  Play,
  PlayCircle,
  Radio,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AudioWaveVisualizer } from '../components/AudioWaveVisualizer';
import { MediaEqualizer } from '../components/MediaEqualizer';
import { QuantumCoreCanvas } from '../components/QuantumCoreCanvas';
import { JARVIS_LANGUAGES } from '../data/agents';
import {
  AvailableVoiceOption,
  getAvailableVoices,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '../services/voice';
import { LanguageCode } from '../types/jarvis';
import { ReactorHudState } from '../types/media';

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
  voiceVolume?: number;
  selectedVoiceUri?: string;
  autoSpeakReplies?: boolean;
  femaleVoiceEnabled?: boolean;
  welcomeGreetingEnabled?: boolean;
  autoDetectVoiceLanguage?: boolean;
  activeVoiceInfo?: { name: string; lang: string; isFemale: boolean } | null;
  welcomeAutoplayBlocked?: boolean;
  welcomeStepLabel?: string | null;
  transcript: string;
  voiceError: string | null;
  voicePermissionDenied: boolean;
  audioLevel: number;
  reducedMotion: boolean;
  onEnableVoiceMode: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onSpeechRateChange?: (rate: number) => void;
  onVoiceVolumeChange?: (volume: number) => void;
  onVoiceUriChange?: (voiceUri: string) => void;
  onToggleAutoSpeakReplies?: () => void;
  onToggleFemaleVoice?: () => void;
  onToggleWelcomeGreeting?: () => void;
  onToggleAutoDetectVoiceLanguage?: () => void;
  onTestVoice?: () => void;
  onTestVoiceHindi?: () => void;
  onTestVoiceEnglish?: () => void;
  onReplayWelcome?: () => void;
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
  reactorState?: ReactorHudState;
  isExecutingCommand?: boolean;
  isWakeWordActive?: boolean;
  isMediaPlaying?: boolean;
  isMediaPaused?: boolean;
  currentMediaTitle?: string | null;
  onToggleWakeWord?: () => void;
  onOpenMediaControl?: () => void;
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
  speechRate = 0.96,
  voiceVolume = 1.0,
  selectedVoiceUri = '',
  autoSpeakReplies = false,
  femaleVoiceEnabled = true,
  welcomeGreetingEnabled = true,
  autoDetectVoiceLanguage = true,
  activeVoiceInfo = null,
  welcomeAutoplayBlocked = false,
  welcomeStepLabel = null,
  transcript,
  voiceError,
  voicePermissionDenied,
  audioLevel,
  reducedMotion,
  onEnableVoiceMode,
  onLanguageChange,
  onSpeechRateChange,
  onVoiceVolumeChange,
  onVoiceUriChange,
  onToggleAutoSpeakReplies,
  onToggleFemaleVoice,
  onToggleWelcomeGreeting,
  onToggleAutoDetectVoiceLanguage,
  onTestVoice,
  onTestVoiceHindi,
  onTestVoiceEnglish,
  onReplayWelcome,
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
  reactorState,
  isExecutingCommand = false,
  isWakeWordActive = false,
  isMediaPlaying = false,
  isMediaPaused = false,
  currentMediaTitle = null,
  onToggleWakeWord,
  onOpenMediaControl,
}) => {
  const sttSupported = isSpeechRecognitionSupported();
  const ttsSupported = isSpeechSynthesisSupported();
  const [typedDirective, setTypedDirective] = useState('');
  const [voices, setVoices] = useState<AvailableVoiceOption[]>(() =>
    getAvailableVoices(femaleVoiceEnabled)
  );

  useEffect(() => {
    if (!ttsSupported) return;
    const refresh = () => setVoices(getAvailableVoices(femaleVoiceEnabled));
    refresh();
    window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', refresh);
  }, [ttsSupported, femaleVoiceEnabled]);

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
      : isExecutingCommand
        ? 'executing'
        : isProcessing
          ? 'processing'
          : isMediaPlaying
            ? 'playing'
            : isMediaPaused
              ? 'paused'
              : 'standby';

  const effectiveReactorState: ReactorHudState =
    reactorState ||
    (isSpeaking && !isSpeechPaused
      ? 'SPEAKING'
      : isListening
        ? 'LISTENING'
        : isExecutingCommand
          ? 'EXECUTING'
          : isProcessing
            ? 'PROCESSING'
            : isMediaPlaying
              ? 'PLAYING'
              : isMediaPaused
                ? 'PAUSED'
                : 'STANDBY');

  return (
    <div className="glass-panel-glow rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-between min-h-[calc(100dvh-9rem)] gap-6">
      <div className="text-center space-y-2 w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <h2 className="font-display text-lg sm:text-xl tracking-[0.2em] text-slate-100">
            AM AI • VOICE INTELLIGENCE MATRIX
          </h2>
          {femaleVoiceEnabled && (
            <span
              data-testid="female-voice-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/55 font-mono-hud text-[10px] font-bold text-fuchsia-200"
            >
              <Sparkles className="w-3 h-3" />
              <span>PREMIUM FEMALE VOICE</span>
            </span>
          )}
          {autoDetectVoiceLanguage && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/45 font-mono-hud text-[10px] font-bold text-cyan-200">
              <Globe className="w-3 h-3" />
              <span>AUTO HI / EN / HINGLISH</span>
            </span>
          )}
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
              : welcomeStepLabel
                ? `AM AI WELCOME: ${welcomeStepLabel}`
                : 'SPEAKING WITH NATURAL BILINGUAL VOICE'
            : isExecutingCommand
              ? 'EXECUTING MEDIA / WEB COMMAND'
              : isProcessing
                ? 'THINKING VIA MULTI-AI BRAIN'
                : isListening
                  ? 'LISTENING TO VOICE INPUT'
                  : isMediaPlaying && currentMediaTitle
                    ? `PLAYING MEDIA: ${currentMediaTitle}`
                    : isHandsFreeMode
                      ? 'CONTINUOUS CONVERSATION STANDBY'
                      : `STANDBY • LANGUAGE: ${language}`}
        </p>

        {/* 6-State Reactor HUD Telemetry Strip */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {(['SPEAKING', 'LISTENING', 'PROCESSING', 'EXECUTING', 'PLAYING', 'PAUSED'] as ReactorHudState[]).map(
            (st) => {
              const active = effectiveReactorState === st;
              return (
                <span
                  key={st}
                  className={`px-2 py-0.5 rounded-md border font-mono-hud text-[9px] font-bold tracking-wider ${
                    active
                      ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.28)]'
                      : 'bg-[#040812]/80 border-slate-800 text-slate-500'
                  }`}
                >
                  {st}
                </span>
              );
            }
          )}
          {currentMediaTitle && onOpenMediaControl && (
            <button
              type="button"
              onClick={onOpenMediaControl}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/50 text-sky-200 font-mono-hud text-[9px] font-bold cursor-pointer"
            >
              <MediaEqualizer
                isPlaying={isMediaPlaying}
                reducedMotion={reducedMotion}
                barCount={3}
                className="h-2.5"
              />
              <span className="max-w-[140px] truncate">{currentMediaTitle}</span>
              <PlayCircle className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>

        <p className="font-mono-hud text-[11px] text-slate-400">
          STT: {sttSupported ? 'Web Speech Available' : 'Unavailable (use Chrome/Edge or type below)'} • TTS:{' '}
          {ttsSupported ? 'Available' : 'Unavailable'}
          {activeVoiceInfo ? (
            <>
              {' '}• Active Voice:{' '}
              <span className="text-fuchsia-200">
                {activeVoiceInfo.name} ({activeVoiceInfo.lang}
                {activeVoiceInfo.isFemale ? ' • Female' : ''})
              </span>
            </>
          ) : null}
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

      {welcomeAutoplayBlocked && welcomeGreetingEnabled && !isSpeechMuted && (
        <div
          data-testid="welcome-autoplay-banner"
          className="w-full max-w-2xl rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="font-mono-hud text-xs text-fuchsia-100">
            Browser autoplay paused the automatic AM AI Welcome Greeting. Tap anywhere or press Play Welcome to hear it now.
          </p>
          <button
            type="button"
            onClick={onReplayWelcome}
            className="px-3.5 py-1.5 rounded-lg bg-fuchsia-400 hover:bg-fuchsia-300 text-[#02040A] font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>PLAY WELCOME</span>
          </button>
        </div>
      )}

      {!isVoiceModeEnabled && (
        <div className="w-full max-w-2xl rounded-xl bg-amber-500/15 border border-amber-400/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
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

      <div className="w-full max-w-sm h-56">
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

      <div className="w-full max-w-3xl space-y-4">
        <div className="rounded-xl bg-[#040812] border border-slate-800 p-4 text-center">
          <p className="text-sm text-slate-200">
            {transcript
              ? `"${transcript}"`
              : isListening
                ? 'Listening for voice command (Hindi / English / Hinglish)...'
                : isProcessing
                  ? 'Processing recognized command via Multi-AI Brain...'
                  : isHandsFreeMode
                    ? 'Continuous conversation engaged: AM AI listens, replies, speaks smoothly, and resumes automatically.'
                    : sttSupported
                      ? 'Tap Start Speaking for a single prompt, or Start Voice Mode for hands-free bilingual dialogue.'
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

        {/* Primary Mic, Continuous Conversation & Stop Speaking Controls */}
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

          {isSpeaking && (
            <button
              type="button"
              data-testid="voice-stop-speaking-btn"
              onClick={onStopSpeaking}
              className="px-5 py-3 rounded-xl bg-rose-500/20 border border-rose-400/70 hover:bg-rose-500/35 text-rose-100 font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>STOP SPEAKING</span>
            </button>
          )}

          {onToggleWakeWord && (
            <button
              type="button"
              data-testid="voice-wake-word-toggle"
              onClick={onToggleWakeWord}
              className={`px-4 py-3 rounded-xl border font-display text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                isWakeWordActive
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.28)]'
                  : 'bg-[#0D1527] border-slate-700 hover:border-cyan-400 text-slate-200'
              }`}
            >
              <Radio className={`w-4 h-4 ${isWakeWordActive ? 'animate-pulse text-emerald-300' : ''}`} />
              <span>{isWakeWordActive ? 'HEY JARVIS ON' : 'HEY JARVIS'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isSpeechMuted ? 'Unmute AM AI voice' : 'Mute AM AI voice'}
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

        <p className="flex items-center justify-center gap-1.5 font-mono-hud text-[10px] text-slate-400 text-center">
          <Headphones className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            Say &quot;Hey JARVIS&quot; with wake-word enabled, or use the mic button. Headphones reduce speaker echo during playback.
          </span>
        </p>

        {/* Live TTS Playback Bar (Play/Pause/Resume/Stop) */}
        {isSpeaking && (
          <div className="flex flex-wrap items-center justify-center gap-2 p-2.5 rounded-xl bg-[#070D18] border border-fuchsia-400/40">
            <span className="font-mono-hud text-[11px] text-fuchsia-200 mr-2">
              {isSpeechPaused
                ? 'SPEECH PAUSED'
                : welcomeStepLabel
                  ? `PLAYING: ${welcomeStepLabel}`
                  : 'SPEAKING RESPONSE'}
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
              <span>STOP SPEAKING</span>
            </button>
          </div>
        )}

        {/* Dedicated AM AI Premium Female Voice Settings Panel (All 9 Controls) */}
        <div
          data-testid="premium-voice-settings-panel"
          className="rounded-2xl bg-[#040812]/95 border border-fuchsia-500/25 p-4 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
              <span className="font-mono-hud text-xs font-bold text-fuchsia-200 tracking-wider">
                AM AI PREMIUM FEMALE VOICE SETTINGS
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="voice-test-btn"
                onClick={() => onTestVoice?.()}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/50 hover:bg-cyan-500/25 font-mono-hud text-[11px] font-bold text-cyan-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>TEST VOICE</span>
              </button>
              {onTestVoiceHindi && (
                <button
                  type="button"
                  data-testid="voice-test-hi-btn"
                  onClick={onTestVoiceHindi}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0D1527] border border-fuchsia-400/40 hover:border-fuchsia-300 font-mono-hud text-[11px] font-bold text-fuchsia-200 cursor-pointer"
                >
                  TEST HI
                </button>
              )}
              {onTestVoiceEnglish && (
                <button
                  type="button"
                  data-testid="voice-test-en-btn"
                  onClick={onTestVoiceEnglish}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-400/40 hover:border-cyan-300 font-mono-hud text-[11px] font-bold text-cyan-200 cursor-pointer"
                >
                  TEST EN
                </button>
              )}
              <button
                type="button"
                data-testid="voice-replay-welcome-btn"
                onClick={() => onReplayWelcome?.()}
                className="px-3 py-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/50 hover:bg-fuchsia-500/25 font-mono-hud text-[11px] font-bold text-fuchsia-200 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>REPLAY WELCOME</span>
              </button>
            </div>
          </div>

          {/* 4 Toggle Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={femaleVoiceEnabled}
              data-testid="toggle-female-voice"
              onClick={() => onToggleFemaleVoice?.()}
              className={`rounded-xl border px-3 py-2.5 text-left font-mono-hud cursor-pointer transition-colors ${
                femaleVoiceEnabled
                  ? 'bg-fuchsia-500/15 border-fuchsia-400/60 text-fuchsia-100'
                  : 'bg-[#0D1527] border-slate-800 text-slate-400'
              }`}
            >
              <p className="text-[10px] font-bold">FEMALE VOICE</p>
              <p className="text-xs mt-0.5">{femaleVoiceEnabled ? 'ENABLED (SOFT)' : 'DISABLED'}</p>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={welcomeGreetingEnabled}
              data-testid="toggle-welcome-greeting"
              onClick={() => onToggleWelcomeGreeting?.()}
              className={`rounded-xl border px-3 py-2.5 text-left font-mono-hud cursor-pointer transition-colors ${
                welcomeGreetingEnabled
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-100'
                  : 'bg-[#0D1527] border-slate-800 text-slate-400'
              }`}
            >
              <p className="text-[10px] font-bold">WELCOME GREETING</p>
              <p className="text-xs mt-0.5">{welcomeGreetingEnabled ? 'ON (2-STEP)' : 'OFF'}</p>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={autoDetectVoiceLanguage}
              data-testid="toggle-auto-detect-lang"
              onClick={() => onToggleAutoDetectVoiceLanguage?.()}
              className={`rounded-xl border px-3 py-2.5 text-left font-mono-hud cursor-pointer transition-colors ${
                autoDetectVoiceLanguage
                  ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100'
                  : 'bg-[#0D1527] border-slate-800 text-slate-400'
              }`}
            >
              <p className="text-[10px] font-bold">AUTO-DETECT LANG</p>
              <p className="text-xs mt-0.5">{autoDetectVoiceLanguage ? 'ON (HI/EN)' : 'LOCKED'}</p>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={autoSpeakReplies}
              onClick={() => onToggleAutoSpeakReplies?.()}
              className={`rounded-xl border px-3 py-2.5 text-left font-mono-hud cursor-pointer transition-colors ${
                autoSpeakReplies
                  ? 'bg-violet-500/15 border-violet-400/60 text-violet-100'
                  : 'bg-[#0D1527] border-slate-800 text-slate-400'
              }`}
            >
              <p className="text-[10px] font-bold">AUTO-SPEAK REPLIES</p>
              <p className="text-xs mt-0.5">{autoSpeakReplies ? 'ON' : 'OFF'}</p>
            </button>
          </div>

          {/* Voice Selection, Language Preference, Speed & Volume Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="font-mono-hud text-[10px] text-slate-400 block">
                VOICE SELECTION
              </label>
              <select
                aria-label="Select speaking voice"
                value={selectedVoiceUri}
                onChange={(e) => onVoiceUriChange?.(e.target.value)}
                className="w-full bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-2 font-mono-hud text-[11px] text-cyan-200 focus:outline-none"
              >
                <option value="">
                  Auto Best {femaleVoiceEnabled ? 'Female ' : ''}({language})
                </option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}
                    {v.isFemale ? ' • Female' : ''}
                    {v.qualityTier === 'neural' ? ' • Natural' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-mono-hud text-[10px] text-slate-400 block">
                LANGUAGE PREFERENCE
              </label>
              <select
                aria-label="Hindi or English voice language preference"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className="w-full bg-[#0D1527] border border-slate-700 rounded-lg px-2.5 py-2 font-mono-hud text-[11px] text-cyan-200 focus:outline-none"
              >
                {Object.values(JARVIS_LANGUAGES).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono-hud text-[10px] text-slate-400">
                <span>SPEAKING SPEED</span>
                <span className="text-cyan-300">{speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.02}
                value={speechRate}
                aria-label="Voice speech speed"
                onChange={(e) => onSpeechRateChange?.(Number(e.target.value))}
                className="w-full accent-fuchsia-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono-hud text-[10px] text-slate-400">
                <span>VOLUME</span>
                <span className="text-cyan-300">{Math.round(voiceVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voiceVolume}
                aria-label="Voice volume"
                onChange={(e) => onVoiceVolumeChange?.(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Typed Directive Fallback for any browser */}
        <form onSubmit={handleSubmitTyped} className="flex gap-2">
          <input
            type="text"
            value={typedDirective}
            onChange={(e) => setTypedDirective(e.target.value)}
            placeholder="Or type a directive (English, Hindi, or Hinglish) for AM AI to answer & speak..."
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

        <div className="space-y-2">
          <p className="font-mono-hud text-[10px] text-slate-400 text-center uppercase tracking-wider">
            Instant Media, Web &amp; Multi-AI Voice Commands:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[
              'open google',
              'play kesariya',
              'play iron man trailer',
              'pause karo',
              'volume 40',
              'open media control',
              'open multi ai brain',
              'replay welcome',
              'check provider health',
              'open security',
              'new chat',
              'stop',
            ].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => onQuickCommand(cmd)}
                className="px-2.5 py-2 rounded-lg bg-[#0D1527] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[11px] text-cyan-200 cursor-pointer truncate"
              >
                &quot;{cmd}&quot;
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
