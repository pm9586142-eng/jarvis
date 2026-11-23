import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Calculator,
  Clock,
  Code2,
  Cpu,
  Eye,
  Flame,
  Globe,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  Send,
  Shapes,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AudioWaveVisualizer } from '../components/AudioWaveVisualizer';
import { UltronHologramCanvas } from '../components/UltronHologramCanvas';
import { JARVIS_LANGUAGES } from '../data/agents';
import { streamGeminiChat } from '../services/api';
import {
  getNextUltronShape,
  parseUltronVoiceCommand,
  ULTRON_SHAPE_LABELS,
  ULTRON_SHAPE_ORDER,
} from '../services/ultronCommands.js';
import {
  AgentDescriptor,
  BrowserTelemetry,
  ChatMessage,
  ConnectionState,
  LanguageCode,
  MemoryItem,
  UltronChatTurn,
  UltronShapeForm,
  UltronVisualMode,
} from '../types/jarvis';

export interface UltronAssistantViewProps {
  connectionState: ConnectionState;
  telemetry: BrowserTelemetry;
  language: LanguageCode;
  memories: MemoryItem[];
  isListening: boolean;
  isSpeaking: boolean;
  isVoiceMuted: boolean;
  isWakeWordActive: boolean;
  isHandsFreeMode: boolean;
  audioLevel: number;
  transcript: string;
  voiceError: string | null;
  reducedMotion?: boolean;
  visualMode: UltronVisualMode;
  shapeForm: UltronShapeForm;
  lastCommandNotice: string | null;
  activeModelLabel?: string;
  onVisualModeChange: (mode: UltronVisualMode) => void;
  onShapeFormChange: (shape: UltronShapeForm) => void;
  onCycleShape: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onToggleContinuousMode: () => void;
  onToggleWakeWord: () => void;
  onToggleMute: () => void;
  onSpeakText: (text: string) => void;
  onStopSpeaking: () => void;
  onResetToNormal: () => void;
  onExitUltron?: () => void;
  onRegisterVoiceSubmit?: (handler: ((text: string) => void) | null) => void;
}

const ULTRON_AGENT_DESCRIPTOR: AgentDescriptor = {
  id: 'JARVIS_PRIME',
  codename: 'ULTRON CORE',
  designation: 'Holographic Multi-Modal Intelligence',
  specialization: 'Science, Technology, Coding, Calculations & Bilingual Dialogue',
  accentColor: '#00E5FF',
  enableWebSearch: true,
  systemPrompt:
    'You are ULTRON AI, a futuristic holographic artificial intelligence assistant. ' +
    'You answer general questions clearly, explain science and technology deeply yet accessibly, ' +
    'write clean and accurate code when asked, perform exact step-by-step mathematical calculations, ' +
    'and converse fluently in both Hindi (हिंदी) and English (as well as Hinglish when appropriate). ' +
    'Remember all context from earlier turns in the active session and respond concisely, clearly, and politely.',
};

const QUICK_TEST_PROMPTS: Array<{
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}> = [
  {
    id: 'science',
    label: 'Science & Tech',
    icon: Sparkles,
    prompt: 'Explain how quantum entanglement works in simple yet accurate scientific terms.',
  },
  {
    id: 'coding',
    label: 'Coding Help',
    icon: Code2,
    prompt: 'Write a clean TypeScript debounce hook with cleanup and brief explanation.',
  },
  {
    id: 'calc',
    label: 'Calculation',
    icon: Calculator,
    prompt: 'Calculate the escape velocity from Earth surface (G=6.674e-11, M=5.972e24, R=6.371e6) step by step.',
  },
  {
    id: 'hindi',
    label: 'Hindi Query',
    icon: Globe,
    prompt: 'आर्टिफिशियल इंटेलिजेंस और होलोग्राफिक इंटरफ़ेस भविष्य में कैसे मदद करेंगे? हिंदी में बताइए।',
  },
];

const INITIAL_ULTRON_GREETING: UltronChatTurn = {
  id: 'ultron-boot-msg',
  role: 'ultron',
  text:
    'ULTRON AI Holographic Core online. Say "Hey Ultron", speak a voice directive such as ' +
    '"Change your shape", "Activate energy mode", or "Activate hologram mode", or ask me anything in English or Hindi.',
  timestamp: 0,
};

export const UltronAssistantView: React.FC<UltronAssistantViewProps> = ({
  connectionState,
  telemetry,
  language,
  memories,
  isListening,
  isSpeaking,
  isVoiceMuted,
  isWakeWordActive,
  isHandsFreeMode,
  audioLevel,
  transcript,
  voiceError,
  reducedMotion = false,
  visualMode,
  shapeForm,
  lastCommandNotice,
  activeModelLabel,
  onVisualModeChange,
  onShapeFormChange,
  onCycleShape,
  onLanguageChange,
  onStartListening,
  onStopListening,
  onToggleContinuousMode,
  onToggleWakeWord,
  onToggleMute,
  onSpeakText,
  onStopSpeaking,
  onResetToNormal,
  onExitUltron,
  onRegisterVoiceSubmit,
}) => {
  const [clockNow, setClockNow] = useState(() => new Date());
  const [turns, setTurns] = useState<UltronChatTurn[]>([INITIAL_ULTRON_GREETING]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeProviderMeta, setActiveProviderMeta] = useState<string>(
    activeModelLabel || 'Gemini Free Core'
  );
  const [webglReady, setWebglReady] = useState<boolean | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const turnSeqRef = useRef(1);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [turns, streamingText, reducedMotion]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Derive effective visual mode synced with live voice / AI states
  const effectiveVisualMode: UltronVisualMode = useMemo(() => {
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    if (isAiThinking) return 'thinking';
    if (isAnswering) return 'answering';
    return visualMode;
  }, [isSpeaking, isListening, isAiThinking, isAnswering, visualMode]);

  const aiStatusInfo = useMemo(() => {
    switch (effectiveVisualMode) {
      case 'speaking':
        return {
          label: 'SPEAKING',
          badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/60',
          dotClass: 'bg-amber-400 animate-ping',
        };
      case 'answering':
        return {
          label: 'ANSWERING',
          badgeClass: 'bg-cyan-500/20 text-cyan-100 border-cyan-400/60',
          dotClass: 'bg-cyan-300 animate-pulse',
        };
      case 'listening':
        return {
          label: 'LISTENING',
          badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-400/65',
          dotClass: 'bg-sky-400 animate-ping',
        };
      case 'thinking':
        return {
          label: 'THINKING',
          badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-400/65',
          dotClass: 'bg-violet-400 animate-pulse',
        };
      case 'energy':
        return {
          label: 'ENERGY CORE',
          badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/65',
          dotClass: 'bg-amber-400 animate-pulse',
        };
      case 'hologram':
        return {
          label: 'HOLOGRAM MATRIX',
          badgeClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/65',
          dotClass: 'bg-cyan-400 animate-pulse',
        };
      default:
        return {
          label: 'IDLE • READY',
          badgeClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/45',
          dotClass: 'bg-emerald-400',
        };
    }
  }, [effectiveVisualMode]);

  const audioWaveMode = useMemo(() => {
    if (effectiveVisualMode === 'speaking' || effectiveVisualMode === 'answering') return 'speaking';
    if (effectiveVisualMode === 'listening') return 'listening';
    if (effectiveVisualMode === 'thinking') return 'processing';
    return 'standby';
  }, [effectiveVisualMode]);

  const applyLocalUltronAction = useCallback(
    (rawInput: string): boolean => {
      const cmd = parseUltronVoiceCommand(rawInput);
      if (!cmd) return false;

      switch (cmd.type) {
        case 'OPEN_ASSISTANT_MODE':
          onResetToNormal();
          setLocalNotice('ULTRON Holographic Assistant active');
          return true;
        case 'START_LISTENING':
          onStartListening();
          setLocalNotice('Voice matrix listening');
          return true;
        case 'STOP_LISTENING':
          onStopListening();
          setLocalNotice('Microphone paused');
          return true;
        case 'CYCLE_SHAPE': {
          const next = getNextUltronShape(shapeForm);
          onCycleShape();
          setLocalNotice(`Shape transformed → ${ULTRON_SHAPE_LABELS[next]}`);
          onSpeakText(
            language === 'HINDI'
              ? `मेरा आकार ${ULTRON_SHAPE_LABELS[next]} में बदल दिया गया है।`
              : `Shape transformed to ${ULTRON_SHAPE_LABELS[next]}.`
          );
          return true;
        }
        case 'SET_SHAPE':
          onShapeFormChange(cmd.shape);
          setLocalNotice(`Shape locked → ${ULTRON_SHAPE_LABELS[cmd.shape]}`);
          onSpeakText(`Holographic geometry shifted to ${ULTRON_SHAPE_LABELS[cmd.shape]}.`);
          return true;
        case 'SET_MODE':
          onVisualModeChange(cmd.mode);
          setLocalNotice(`Visual state → ${cmd.mode.toUpperCase()} MODE`);
          if (cmd.mode === 'energy') {
            onSpeakText(
              language === 'HINDI' ? 'एनर्जी कोर मोड सक्रिय किया गया।' : 'Energy core mode activated.'
            );
          } else if (cmd.mode === 'hologram') {
            onSpeakText(
              language === 'HINDI'
                ? 'होलोग्राम प्रोजेक्शन मोड सक्रिय किया गया।'
                : 'Hologram projection mode activated.'
            );
          } else if (cmd.mode === 'thinking') {
            onSpeakText('Entering deep thinking mode.');
          } else {
            onResetToNormal();
            onSpeakText('Returned to normal holographic mode.');
          }
          return true;
      }
    },
    [
      language,
      onCycleShape,
      onResetToNormal,
      onShapeFormChange,
      onSpeakText,
      onStartListening,
      onStopListening,
      onVisualModeChange,
      shapeForm,
    ]
  );

  const handleSendPrompt = useCallback(
    async (rawPrompt: string, fromVoice = false) => {
      const clean = rawPrompt.trim();
      if (!clean) return;

      // 1. Intercept shape/mode transformation commands even when typed
      if (applyLocalUltronAction(clean)) {
        setInputText('');
        const seq = ++turnSeqRef.current;
        setTurns((prev) => [
          ...prev,
          { id: `u-${seq}`, role: 'user', text: clean, timestamp: Date.now(), isVoice: fromVoice },
        ]);
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userTurnId = `u-${++turnSeqRef.current}`;
      const userTurn: UltronChatTurn = {
        id: userTurnId,
        role: 'user',
        text: clean,
        timestamp: Date.now(),
        isVoice: fromVoice,
      };

      const sessionHistory: ChatMessage[] = turns
        .filter((t) => !t.isError && t.id !== 'ultron-boot-msg')
        .slice(-18)
        .map((t) => ({
          id: t.id,
          role: t.role === 'user' ? 'user' : 'jarvis',
          text: t.text,
          agentCodename: t.role === 'user' ? 'OWNER' : 'ULTRON CORE',
          timestamp: t.timestamp,
        }));

      setTurns((prev) => [...prev, userTurn]);
      setInputText('');
      setStreamingText('');
      setIsAiThinking(true);
      setIsAnswering(false);
      setLocalNotice(null);

      let latestMetaLabel = activeProviderMeta;

      try {
        await streamGeminiChat({
          prompt: clean,
          agent: ULTRON_AGENT_DESCRIPTOR,
          language: JARVIS_LANGUAGES[language],
          telemetry,
          memories,
          history: sessionHistory,
          enableWebSearch: true,
          responseStyle: 'balanced',
          reasoningPreference: 'auto',
          signal: controller.signal,
          callbacks: {
            onMeta: (meta) => {
              const label = [meta.providerLabel || meta.provider, meta.model]
                .filter(Boolean)
                .join(' • ');
              if (label) {
                latestMetaLabel = label;
                setActiveProviderMeta(label);
              }
            },
            onChunk: (fullText) => {
              setIsAiThinking(false);
              setIsAnswering(true);
              setStreamingText(fullText);
            },
            onComplete: (fullText) => {
              setIsAiThinking(false);
              setIsAnswering(false);
              setStreamingText('');
              const replyId = `a-${++turnSeqRef.current}`;
              setTurns((prev) => [
                ...prev,
                {
                  id: replyId,
                  role: 'ultron',
                  text: fullText,
                  timestamp: Date.now(),
                  model: latestMetaLabel,
                },
              ]);

              if (!isVoiceMuted) {
                onSpeakText(fullText);
              }
            },
            onCancelled: (partial) => {
              setIsAiThinking(false);
              setIsAnswering(false);
              setStreamingText('');
              if (partial.trim()) {
                const replyId = `a-${++turnSeqRef.current}`;
                setTurns((prev) => [
                  ...prev,
                  {
                    id: replyId,
                    role: 'ultron',
                    text: `${partial}\n\n[Generation interrupted]`,
                    timestamp: Date.now(),
                    model: latestMetaLabel,
                  },
                ]);
              }
            },
            onError: (errMsg) => {
              setIsAiThinking(false);
              setIsAnswering(false);
              setStreamingText('');
              const errId = `e-${++turnSeqRef.current}`;
              setTurns((prev) => [
                ...prev,
                {
                  id: errId,
                  role: 'ultron',
                  text: errMsg || 'Unable to reach AI core right now. Check backend connection or free quota.',
                  timestamp: Date.now(),
                  isError: true,
                },
              ]);
            },
          },
        });
      } catch (err) {
        setIsAiThinking(false);
        setIsAnswering(false);
        setStreamingText('');
        const errId = `e-${++turnSeqRef.current}`;
        setTurns((prev) => [
          ...prev,
          {
            id: errId,
            role: 'ultron',
            text: err instanceof Error ? err.message : 'Unexpected connection error.',
            timestamp: Date.now(),
            isError: true,
          },
        ]);
      }
    },
    [
      activeProviderMeta,
      applyLocalUltronAction,
      isVoiceMuted,
      language,
      memories,
      onSpeakText,
      telemetry,
      turns,
    ]
  );

  useEffect(() => {
    if (!onRegisterVoiceSubmit) return undefined;
    onRegisterVoiceSubmit((spokenText: string) => {
      void handleSendPrompt(spokenText, true);
    });
    return () => {
      onRegisterVoiceSubmit(null);
    };
  }, [onRegisterVoiceSubmit, handleSendPrompt]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsAiThinking(false);
    setIsAnswering(false);
    onStopSpeaking();
  }, [onStopSpeaking]);

  const timeFormatted = clockNow.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateFormatted = clockNow.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const activeBannerNotice = localNotice || lastCommandNotice;

  return (
    <section
      aria-label="ULTRON AI Holographic Assistant"
      className="relative rounded-3xl border border-cyan-500/35 bg-[#02050B]/95 shadow-[0_0_50px_rgba(0,229,255,0.12)] overflow-hidden"
    >
      {/* Subtle Futuristic Corner Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-28 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-28 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl"
      />

      {/* Top HUD Telemetry Bar: Title, Live Clock/Date, AI Status & Controls */}
      <div className="relative z-10 border-b border-cyan-500/25 bg-[#040B17]/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.45)] shrink-0">
            <img
              src="/ultron-reference.jpg"
              alt="ULTRON Core Identity"
              className="w-full h-full object-cover object-center scale-150"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-sm sm:text-base font-black tracking-[0.2em] text-slate-100">
                ULTRON <span className="text-[#00E5FF]">AI</span>
              </h2>
              <span
                data-testid="ultron-status-badge"
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono-hud text-[10px] font-bold tracking-wider ${aiStatusInfo.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${aiStatusInfo.dotClass}`} />
                {aiStatusInfo.label}
              </span>
            </div>
            <p className="font-mono-hud text-[10px] text-cyan-300/80 truncate">
              {ULTRON_SHAPE_LABELS[shapeForm]} • {activeProviderMeta}
            </p>
          </div>
        </div>

        {/* Live Clock, Date & Quick Audio/Backend Status */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-testid="ultron-clock-display"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#071326] border border-cyan-500/30 font-mono-hud text-xs"
          >
            <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="font-bold text-slate-100 tabular-nums">{timeFormatted}</span>
            <span className="text-slate-500">|</span>
            <span className="text-[11px] text-cyan-200/90 hidden sm:inline">{dateFormatted}</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#071326] border border-slate-700/80">
            <Globe className="w-3.5 h-3.5 text-cyan-300" />
            <select
              aria-label="Select ULTRON conversation language"
              data-testid="ultron-language-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="bg-transparent font-mono-hud text-[11px] text-cyan-100 focus:outline-none cursor-pointer"
            >
              <option value="ENGLISH" className="bg-[#071326]">English</option>
              <option value="HINDI" className="bg-[#071326]">Hindi (हिंदी)</option>
              <option value="HINGLISH" className="bg-[#071326]">Hinglish</option>
            </select>
          </div>

          {onExitUltron && (
            <button
              type="button"
              onClick={onExitUltron}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-700 hover:border-cyan-400/60 bg-[#071326] font-mono-hud text-[10px] text-slate-300 hover:text-cyan-200 cursor-pointer"
            >
              HUD HOME
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Grid: Left 3D Holographic Core & Voice Controls / Right Conversational AI Brain */}
      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-5 p-4 sm:p-6">
        {/* Left Stage: Holographic Avatar + Dynamic Transforms + Waveform */}
        <div className="xl:col-span-6 flex flex-col gap-4">
          <div className="relative rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#040B17]/95 via-[#02050B] to-[#040B17]/95 p-3 sm:p-4 flex flex-col items-center">
            {/* Corner Identity & WebGL Engine Indicators */}
            <div className="w-full flex items-center justify-between gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#071326]/90 border border-amber-400/35 font-mono-hud text-[10px] text-amber-200">
                <Sparkles className="w-3 h-3 text-amber-400" />
                3D HOLOGRAPHIC CORE
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#071326]/90 border border-cyan-500/30 font-mono-hud text-[10px] text-cyan-200">
                <Cpu className="w-3 h-3 text-[#00E5FF]" />
                {webglReady === false ? '2D HOLOGRAM FALLBACK' : 'THREE.JS WEBGL'}
              </span>
            </div>

            {/* 3D Animated Avatar preserving Uploaded Image */}
            <div className="w-full h-[300px] sm:h-[365px]">
              <UltronHologramCanvas
                mode={effectiveVisualMode}
                shape={shapeForm}
                audioLevel={audioLevel}
                reducedMotion={reducedMotion}
                onCanvasReady={(ok) => setWebglReady(ok)}
              />
            </div>

            {/* Recognized Voice Command & Active Shape Transformation Banner */}
            <div className="w-full mt-2 space-y-2">
              <div
                data-testid="ultron-recognized-speech"
                className="rounded-xl border border-cyan-500/25 bg-[#040B17]/90 px-3.5 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-mono-hud text-[9px] tracking-[0.16em] text-cyan-400 uppercase">
                    RECOGNIZED VOICE COMMAND
                  </p>
                  <p className="text-xs sm:text-sm text-slate-100 truncate">
                    {transcript
                      ? `"${transcript}"`
                      : isListening
                        ? 'Listening for voice command (English / Hindi)...'
                        : 'Say "Hey Ultron" or tap Start Listening below'}
                  </p>
                </div>
                {activeBannerNotice && (
                  <span className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/45 font-mono-hud text-[10px] text-amber-200">
                    {activeBannerNotice}
                  </span>
                )}
              </div>

              {voiceError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono-hud text-[11px] text-rose-200">
                  {voiceError}
                </div>
              )}

              {/* Voice Waveform Visualization */}
              <AudioWaveVisualizer
                audioLevel={isSpeaking ? Math.max(0.35, audioLevel) : audioLevel}
                isActive={isListening || isSpeaking || isAiThinking || isAnswering}
                mode={audioWaveMode}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>

          {/* Primary Voice & Dynamic Transformation Controls */}
          <div className="rounded-2xl border border-cyan-500/25 bg-[#040B17]/90 p-3.5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                data-testid="ultron-listen-btn"
                onClick={() => (isListening ? onStopListening() : onStartListening())}
                className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500/20 border-rose-400/70 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.25)]'
                    : 'bg-[#00E5FF]/15 border-[#00E5FF]/55 text-cyan-100 hover:bg-[#00E5FF]/25'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? 'STOP MIC' : 'START LISTEN'}</span>
              </button>

              <button
                type="button"
                data-testid="ultron-continuous-btn"
                onClick={onToggleContinuousMode}
                className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isHandsFreeMode
                    ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-100'
                    : 'bg-[#071326] border-slate-700 text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>{isHandsFreeMode ? 'CONTINUOUS ON' : 'CONTINUOUS'}</span>
              </button>

              <button
                type="button"
                data-testid="ultron-wakeword-btn"
                onClick={onToggleWakeWord}
                className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isWakeWordActive
                    ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-100'
                    : 'bg-[#071326] border-slate-700 text-slate-300 hover:border-cyan-400/50'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>{isWakeWordActive ? 'HEY ULTRON ON' : 'WAKE WORD'}</span>
              </button>

              <button
                type="button"
                data-testid="ultron-mute-btn"
                onClick={onToggleMute}
                className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isVoiceMuted
                    ? 'bg-amber-500/20 border-amber-400/70 text-amber-100'
                    : 'bg-[#071326] border-slate-700 text-slate-200 hover:border-cyan-400/50'
                }`}
              >
                {isVoiceMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isVoiceMuted ? 'MUTED' : 'VOICE ON'}</span>
              </button>
            </div>

            {/* Dynamic Shape & Visual Mode Transform Deck */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-hud text-[10px] tracking-[0.16em] text-cyan-300/90 uppercase">
                  DYNAMIC AVATAR TRANSFORMATIONS
                </span>
                <span className="font-mono-hud text-[10px] text-amber-300">
                  {shapeForm.replace('_', ' ').toUpperCase()} • {effectiveVisualMode.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="ultron-change-shape-btn"
                  onClick={() => applyLocalUltronAction('Change your shape')}
                  className="min-h-[48px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-400/55 hover:border-amber-400/70 font-mono-hud text-[11px] font-bold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Shapes className="w-4 h-4 text-[#00E5FF]" />
                  <span>CHANGE SHAPE</span>
                </button>

                <button
                  type="button"
                  data-testid="ultron-energy-mode-btn"
                  onClick={() => applyLocalUltronAction('Activate energy mode')}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                    visualMode === 'energy'
                      ? 'bg-amber-500/25 border-amber-400 text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.3)]'
                      : 'bg-[#071326] border-slate-700 text-slate-300 hover:border-amber-400/50'
                  }`}
                >
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>ENERGY MODE</span>
                </button>

                <button
                  type="button"
                  data-testid="ultron-hologram-mode-btn"
                  onClick={() => applyLocalUltronAction('Activate hologram mode')}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                    visualMode === 'hologram'
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-[0_0_18px_rgba(0,229,255,0.3)]'
                      : 'bg-[#071326] border-slate-700 text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  <Eye className="w-4 h-4 text-cyan-300" />
                  <span>HOLOGRAM MODE</span>
                </button>

                <button
                  type="button"
                  data-testid="ultron-thinking-mode-btn"
                  onClick={() => applyLocalUltronAction('Enter thinking mode')}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                    visualMode === 'thinking'
                      ? 'bg-violet-500/25 border-violet-400 text-violet-100'
                      : 'bg-[#071326] border-slate-700 text-slate-300 hover:border-violet-400/50'
                  }`}
                >
                  <Layers className="w-4 h-4 text-violet-300" />
                  <span>THINKING</span>
                </button>

                <button
                  type="button"
                  data-testid="ultron-normal-mode-btn"
                  onClick={() => applyLocalUltronAction('Return to normal mode')}
                  className={`min-h-[48px] px-3 py-2 rounded-xl border font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                    visualMode === 'normal'
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-100'
                      : 'bg-[#071326] border-slate-700 text-slate-300 hover:border-emerald-400/50'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-emerald-300" />
                  <span>NORMAL MODE</span>
                </button>
              </div>

              {/* Direct Geometry Selector */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ULTRON_SHAPE_ORDER.map((form) => (
                  <button
                    key={form}
                    type="button"
                    onClick={() => onShapeFormChange(form)}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg border font-mono-hud text-[10px] cursor-pointer transition-colors ${
                      shapeForm === form
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 font-bold'
                        : 'bg-[#060E1B] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {form.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Stage: Intelligent Conversational AI Brain & Voice Command Console */}
        <div className="xl:col-span-6 flex flex-col rounded-2xl border border-cyan-500/30 bg-[#040B17]/90 overflow-hidden min-h-[460px] max-h-[680px]">
          <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center justify-between gap-2 bg-[#071326]/70">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#00E5FF]" />
              <span className="font-mono-hud text-xs font-bold tracking-wider text-slate-100">
                CONVERSATIONAL NEURAL MATRIX
              </span>
            </div>
            <span
              className={`font-mono-hud text-[10px] px-2 py-0.5 rounded-full border ${
                connectionState === 'online'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-200 border-amber-500/40'
              }`}
            >
              {connectionState === 'online' ? 'SECURE BACKEND LINK' : connectionState.toUpperCase()}
            </span>
          </div>

          {/* Starter Capability Chips */}
          <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex flex-wrap gap-1.5">
            {QUICK_TEST_PROMPTS.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => void handleSendPrompt(chip.prompt, false)}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#071326] hover:bg-cyan-500/15 border border-cyan-500/30 text-[11px] text-cyan-100 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Session Conversation Messages */}
          <div
            data-testid="ultron-chat-log"
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex flex-col ${
                  turn.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    turn.role === 'user'
                      ? 'bg-[#00E5FF]/15 border border-[#00E5FF]/45 text-cyan-50'
                      : turn.isError
                        ? 'bg-rose-500/15 border border-rose-500/45 text-rose-200'
                        : 'bg-[#071326] border border-slate-700/80 text-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="font-mono-hud text-[9px] font-bold tracking-wider uppercase text-cyan-300">
                      {turn.role === 'user'
                        ? turn.isVoice
                          ? 'YOU • VOICE'
                          : 'YOU'
                        : 'ULTRON AI'}
                    </span>
                    {turn.model && (
                      <span className="font-mono-hud text-[9px] text-slate-400">
                        {turn.model}
                      </span>
                    )}
                  </div>
                  <p>{turn.text}</p>
                </div>
              </div>
            ))}

            {(isAiThinking || streamingText) && (
              <div className="flex flex-col items-start">
                <div className="max-w-[90%] rounded-2xl px-3.5 py-2.5 bg-[#071326] border border-cyan-400/50 text-slate-100 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 className="w-3.5 h-3.5 text-[#00E5FF] animate-spin" />
                    <span className="font-mono-hud text-[9px] font-bold text-[#00E5FF]">
                      {isAiThinking ? 'ULTRON THINKING...' : 'ULTRON ANSWERING...'}
                    </span>
                  </div>
                  <p>{streamingText || 'Synthesizing holographic response...'}</p>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Command & Conversation Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendPrompt(inputText, false);
            }}
            className="p-3 border-t border-cyan-500/20 bg-[#071326]/90 flex items-center gap-2"
          >
            <input
              type="text"
              data-testid="ultron-prompt-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='Ask in English or Hindi, or type "Change your shape" / "Energy mode"...'
              aria-label="Ask ULTRON AI or enter a command"
              className="flex-1 min-h-[48px] px-3.5 rounded-xl bg-[#040B17] border border-cyan-500/30 focus:border-[#00E5FF] text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {isAiThinking || isAnswering || isSpeaking ? (
              <button
                type="button"
                onClick={stopGeneration}
                aria-label="Stop response or speech"
                className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 hover:bg-rose-500/30 flex items-center justify-center cursor-pointer"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : null}
            <button
              type="submit"
              data-testid="ultron-send-btn"
              disabled={!inputText.trim() || isAiThinking}
              aria-label="Send message to ULTRON AI"
              className="min-h-[48px] min-w-[48px] px-4 rounded-xl bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 disabled:opacity-45 border border-[#00E5FF]/60 text-cyan-100 font-mono-hud text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">SEND</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
