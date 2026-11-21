import { detectLanguageMode } from './brainEngine.js';
import {
  buildLocalizedWelcomeSequence,
  buildWelcomeStatusGreeting,
  buildWelcomeVoiceSequence,
  calibrateVoiceTone,
  isLikelyFemaleVoice,
  isNeuralOrNaturalVoice,
  scoreVoiceCandidate,
  selectBestVoiceForSegment,
  WELCOME_SESSION_STORAGE_KEY,
  WELCOME_STEP_1,
  WELCOME_STEP_2_ONLINE,
} from './femaleVoiceCatalog.js';
import {
  formatTextForSpeech,
  splitSpeechIntoBilingualSegments,
} from './speechFormatter.js';
import { detectWakeWordTrigger } from './media/universalCommandRouter.js';

export {
  buildLocalizedWelcomeSequence,
  buildWelcomeStatusGreeting,
  buildWelcomeVoiceSequence,
  WELCOME_SESSION_STORAGE_KEY,
  WELCOME_STEP_1,
  WELCOME_STEP_2_ONLINE,
};

export function unlockBrowserAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      window.setTimeout(() => {
        void ctx.close().catch(() => {});
      }, 300);
    }
  } catch {
    // Ignore AudioContext restriction errors
  }
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  } catch {
    // Ignore speechSynthesis warmup errors
  }
}

interface SpeechRecognitionResultEventLike {
  resultIndex?: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function resolveTtsLangForText(text: string, fallbackBcp47: string): string {
  const detected = detectLanguageMode(text);
  switch (detected) {
    case 'HINDI':
      return 'hi-IN';
    case 'HINGLISH':
      return 'en-IN';
    case 'GUJARATI':
      return 'gu-IN';
    case 'ENGLISH':
    default:
      return fallbackBcp47 || 'en-IN';
  }
}

export interface AvailableVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isLocal: boolean;
  isFemale: boolean;
  qualityTier: 'neural' | 'standard';
}

export function getAvailableVoices(femaleFirst = true): AvailableVoiceOption[] {
  if (!isSpeechSynthesisSupported()) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  const preferredLangPrefixes = ['hi', 'en', 'gu'];
  return [...voices]
    .sort((a, b) => {
      if (femaleFirst) {
        const aScore = scoreVoiceCandidate(a, {
          targetLang: a.lang.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN',
          femaleVoiceEnabled: true,
        });
        const bScore = scoreVoiceCandidate(b, {
          targetLang: b.lang.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN',
          femaleVoiceEnabled: true,
        });
        if (bScore !== aScore) return bScore - aScore;
      }
      const aPref = preferredLangPrefixes.findIndex((p) => a.lang.toLowerCase().startsWith(p));
      const bPref = preferredLangPrefixes.findIndex((p) => b.lang.toLowerCase().startsWith(p));
      const aRank = aPref === -1 ? 99 : aPref;
      const bRank = bPref === -1 ? 99 : bPref;
      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name);
    })
    .map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      isLocal: Boolean(v.localService),
      isFemale: isLikelyFemaleVoice(v),
      qualityTier: isNeuralOrNaturalVoice(v) ? 'neural' : 'standard',
    }));
}

export interface ResolvedVoiceInfo {
  name: string;
  lang: string;
  isFemale: boolean;
}

export interface SpeakOptions {
  text: string;
  bcp47Lang: string;
  voiceUri?: string;
  femaleVoiceEnabled?: boolean;
  autoDetectLanguage?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  muted?: boolean;
  onStart?: () => void;
  onPauseChange?: (paused: boolean) => void;
  onVoiceResolved?: (info: ResolvedVoiceInfo) => void;
  onEnd?: () => void;
  onError?: (errorCode: string) => void;
}

export interface SequenceStep {
  id: string;
  text: string;
  bcp47Lang?: string;
  pauseAfterMs?: number;
}

export interface SpeakSequenceOptions {
  steps: SequenceStep[];
  bcp47Lang: string;
  voiceUri?: string;
  femaleVoiceEnabled?: boolean;
  autoDetectLanguage?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  muted?: boolean;
  onStepStart?: (stepIndex: number, step: SequenceStep) => void;
  onStart?: () => void;
  onPauseChange?: (paused: boolean) => void;
  onVoiceResolved?: (info: ResolvedVoiceInfo) => void;
  onEnd?: () => void;
  onError?: (errorCode: string) => void;
}

export interface ListenOptions {
  bcp47Lang: string;
  onStart: () => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onAudioLevel: (rms: number) => void;
  onError: (message: string, code?: string) => void;
  onEnd: () => void;
}

export interface AudioDuckingCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onListenStart?: () => void;
  onListenEnd?: () => void;
}

export interface WakeWordMonitorOptions {
  bcp47Lang: string;
  onWakeWord: (payload: { inlineCommand: string; rawTranscript: string }) => void;
  onStatusChange?: (active: boolean) => void;
  onError?: (message: string, code?: string) => void;
}

export interface VoiceEngine {
  readonly isPausedState: boolean;
  readonly isSpeakingState: boolean;
  readonly isWakeWordActive: boolean;
  readonly activeVoiceInfo: ResolvedVoiceInfo | null;
  setAudioDuckingCallbacks(callbacks: AudioDuckingCallbacks | null): void;
  startWakeWordMonitor(options: WakeWordMonitorOptions): boolean;
  stopWakeWordMonitor(): void;
  speak(
    textOrOptions: string | SpeakOptions,
    bcp47Lang?: string,
    rate?: number,
    pitch?: number,
    onStart?: () => void,
    onEnd?: () => void,
    volume?: number,
    muted?: boolean,
    onPauseChange?: (paused: boolean) => void
  ): boolean;
  speakSequence(opts: SpeakSequenceOptions): boolean;
  pauseSpeaking(): boolean;
  resumeSpeaking(): boolean;
  stopSpeaking(notifyPauseReset?: boolean): void;
  startListening(params: ListenOptions): Promise<void>;
  stopListening(): void;
  destroy(): void;
}

interface QueuedSpeechSegment {
  text: string;
  lang: string;
  pauseAfterMs?: number;
  stepIndex?: number;
  step?: SequenceStep;
}

interface ActiveSpeakParams {
  bcp47Lang: string;
  voiceUri?: string;
  femaleVoiceEnabled: boolean;
  autoDetectLanguage: boolean;
  rate: number;
  pitch: number;
  volume: number;
  onStart?: () => void;
  onStepStart?: (stepIndex: number, step: SequenceStep) => void;
  onPauseChange?: (paused: boolean) => void;
  onVoiceResolved?: (info: ResolvedVoiceInfo) => void;
  onEnd?: () => void;
  onError?: (errorCode: string) => void;
}

export class WebVoiceEngine implements VoiceEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyserTimer: number | null = null;

  // Duplicate voice transcript guard (prevents rapid double-triggers)
  private lastFinalTranscript = '';
  private lastFinalTranscriptAt = 0;

  // Single unified TTS queue (supports bilingual switching, sequential multi-step greetings, pause/resume/stop)
  private ttsSessionId = 0;
  private activeSegments: QueuedSpeechSegment[] = [];
  private activeChunkIdx = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private pauseGapTimer: number | null = null;
  private isPausedFlag = false;
  private lastResolvedVoice: ResolvedVoiceInfo | null = null;
  private lastSpeakParams: ActiveSpeakParams | null = null;

  // Audio ducking hooks for media playback synchronization
  private duckingCallbacks: AudioDuckingCallbacks | null = null;
  private speechDuckActive = false;
  private listenDuckActive = false;

  // Continuous "Hey JARVIS" wake-word monitor inside the single voice engine (no duplicate engine)
  private wakeRecognition: SpeechRecognitionLike | null = null;
  private wakeOptions: WakeWordMonitorOptions | null = null;
  private wakeEnabledFlag = false;
  private wakeRestartTimer: number | null = null;
  private wakeCommitTimer: number | null = null;
  private lastWakeTriggeredAt = 0;

  get isPausedState(): boolean {
    return this.isPausedFlag;
  }

  get isSpeakingState(): boolean {
    return this.currentUtterance !== null && !this.isPausedFlag;
  }

  get isWakeWordActive(): boolean {
    return this.wakeEnabledFlag;
  }

  get activeVoiceInfo(): ResolvedVoiceInfo | null {
    return this.lastResolvedVoice;
  }

  setAudioDuckingCallbacks(callbacks: AudioDuckingCallbacks | null): void {
    this.duckingCallbacks = callbacks;
  }

  private notifySpeechDuckStart(): void {
    if (this.speechDuckActive) return;
    this.speechDuckActive = true;
    this.duckingCallbacks?.onSpeechStart?.();
  }

  private notifySpeechDuckEnd(): void {
    if (!this.speechDuckActive) return;
    this.speechDuckActive = false;
    this.duckingCallbacks?.onSpeechEnd?.();
  }

  private notifyListenDuckStart(): void {
    if (this.listenDuckActive) return;
    this.listenDuckActive = true;
    this.duckingCallbacks?.onListenStart?.();
  }

  private notifyListenDuckEnd(): void {
    if (!this.listenDuckActive) return;
    this.listenDuckActive = false;
    this.duckingCallbacks?.onListenEnd?.();
  }

  private clearWakeRestartTimer(): void {
    if (this.wakeRestartTimer !== null) {
      window.clearTimeout(this.wakeRestartTimer);
      this.wakeRestartTimer = null;
    }
  }

  private clearWakeCommitTimer(): void {
    if (this.wakeCommitTimer !== null) {
      window.clearTimeout(this.wakeCommitTimer);
      this.wakeCommitTimer = null;
    }
  }

  private suspendWakeWordForSpeechOrCapture(): void {
    this.clearWakeRestartTimer();
    this.clearWakeCommitTimer();
    if (this.wakeRecognition) {
      const rec = this.wakeRecognition;
      this.wakeRecognition = null;
      try {
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.abort();
      } catch {
        // Ignore abort errors
      }
    }
  }

  private scheduleWakeWordResume(delayMs = 500): void {
    if (!this.wakeEnabledFlag || !this.wakeOptions) return;
    if (this.recognition || this.isSpeakingState) return;
    this.clearWakeRestartTimer();
    this.wakeRestartTimer = window.setTimeout(() => {
      this.wakeRestartTimer = null;
      if (!this.wakeEnabledFlag || !this.wakeOptions) return;
      if (this.recognition || this.isSpeakingState || this.wakeRecognition) return;
      this.spawnWakeRecognition();
    }, delayMs);
  }

  startWakeWordMonitor(options: WakeWordMonitorOptions): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      options.onError?.(
        'Wake-word monitoring requires browser SpeechRecognition (Chrome or Edge). Use manual input or Voice HUD.',
        'unsupported'
      );
      options.onStatusChange?.(false);
      return false;
    }

    this.wakeOptions = options;
    this.wakeEnabledFlag = true;
    options.onStatusChange?.(true);

    if (!this.recognition && !this.isSpeakingState) {
      this.suspendWakeWordForSpeechOrCapture();
      this.spawnWakeRecognition();
    }
    return true;
  }

  stopWakeWordMonitor(): void {
    this.wakeEnabledFlag = false;
    const cb = this.wakeOptions?.onStatusChange;
    this.wakeOptions = null;
    this.suspendWakeWordForSpeechOrCapture();
    cb?.(false);
  }

  private spawnWakeRecognition(): void {
    const Ctor = getSpeechRecognitionCtor();
    const opts = this.wakeOptions;
    if (!Ctor || !opts || !this.wakeEnabledFlag) return;
    if (this.recognition || this.isSpeakingState) return;

    try {
      const rec = new Ctor();
      rec.lang = opts.bcp47Lang || 'en-IN';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        if (!this.wakeEnabledFlag || this.isSpeakingState || this.recognition) return;
        // Read only from resultIndex onward so prior continuous phrases never block wake-word detection
        const startIdx =
          typeof event.resultIndex === 'number' && event.resultIndex >= 0 ? event.resultIndex : 0;
        let combined = '';
        let hasFinal = false;
        for (let i = startIdx; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) hasFinal = true;
          combined += ` ${item[0].transcript}`;
        }
        const cleaned = combined.trim();
        if (!cleaned) return;

        const detection = detectWakeWordTrigger(cleaned);
        if (!detection.triggered) return;

        const commitTrigger = () => {
          this.clearWakeCommitTimer();
          if (!this.wakeEnabledFlag || this.isSpeakingState || this.recognition) return;
          const now = Date.now();
          if (now - this.lastWakeTriggeredAt < 2500) return;
          this.lastWakeTriggeredAt = now;

          // Suspend continuous wake monitor while JARVIS responds / listens so it never hears itself
          this.suspendWakeWordForSpeechOrCapture();
          opts.onWakeWord({
            inlineCommand: detection.remainder,
            rawTranscript: cleaned,
          });
        };

        // Commit immediately on finalized speech; otherwise debounce briefly so inline commands
        // after "Hey JARVIS ..." finish speaking instead of truncating prematurely.
        if (hasFinal) {
          commitTrigger();
        } else {
          this.clearWakeCommitTimer();
          this.wakeCommitTimer = window.setTimeout(commitTrigger, 750);
        }
      };

      rec.onerror = (event) => {
        if (!this.wakeEnabledFlag) return;
        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed' ||
          event.error === 'audio-capture'
        ) {
          this.wakeEnabledFlag = false;
          this.suspendWakeWordForSpeechOrCapture();
          opts.onStatusChange?.(false);
          opts.onError?.(
            event.error === 'audio-capture'
              ? 'No microphone detected for Hey JARVIS wake-word listening.'
              : 'Microphone permission denied for Hey JARVIS wake-word listening.',
            event.error
          );
          return;
        }
        // Transient no-speech / network / aborted -> gently restart
        this.wakeRecognition = null;
        this.scheduleWakeWordResume(900);
      };

      rec.onend = () => {
        if (this.wakeRecognition === rec) {
          this.wakeRecognition = null;
        }
        if (this.wakeEnabledFlag && !this.recognition && !this.isSpeakingState) {
          this.scheduleWakeWordResume(450);
        }
      };

      this.wakeRecognition = rec;
      rec.start();
    } catch {
      this.wakeRecognition = null;
      this.scheduleWakeWordResume(1400);
    }
  }

  speak(
    textOrOptions: string | SpeakOptions,
    bcp47Lang = 'en-IN',
    rate = 0.96,
    pitch = 1.04,
    onStart?: () => void,
    onEnd?: () => void,
    volume = 1.0,
    muted = false,
    onPauseChange?: (paused: boolean) => void
  ): boolean {
    const opts: SpeakOptions =
      typeof textOrOptions === 'string'
        ? {
            text: textOrOptions,
            bcp47Lang,
            rate,
            pitch,
            volume,
            muted,
            onStart,
            onPauseChange,
            onEnd,
          }
        : textOrOptions;

    if (opts.muted || !isSpeechSynthesisSupported() || !opts.text.trim()) {
      opts.onPauseChange?.(false);
      opts.onEnd?.();
      return false;
    }

    const autoDetect = opts.autoDetectLanguage !== false;
    const fallbackLang = autoDetect
      ? resolveTtsLangForText(opts.text, opts.bcp47Lang)
      : opts.bcp47Lang || 'en-IN';

    const segments = splitSpeechIntoBilingualSegments(opts.text, {
      fallbackBcp47: fallbackLang,
      autoDetect,
      maxLength: 210,
    });

    if (segments.length === 0) {
      opts.onPauseChange?.(false);
      opts.onEnd?.();
      return false;
    }

    try {
      this.stopSpeaking(false);
      const sessionId = ++this.ttsSessionId;
      this.activeSegments = segments.map((s) => ({ text: s.text, lang: s.lang, pauseAfterMs: 0 }));
      this.activeChunkIdx = 0;
      this.isPausedFlag = false;
      this.lastSpeakParams = {
        bcp47Lang: fallbackLang,
        voiceUri: opts.voiceUri?.trim() || undefined,
        femaleVoiceEnabled: opts.femaleVoiceEnabled !== false,
        autoDetectLanguage: autoDetect,
        rate: Math.min(2, Math.max(0.5, opts.rate ?? 0.96)),
        pitch: Math.min(2, Math.max(0.5, opts.pitch ?? 1.04)),
        volume: Math.min(1, Math.max(0, opts.volume ?? 1.0)),
        onStart: opts.onStart,
        onPauseChange: opts.onPauseChange,
        onVoiceResolved: opts.onVoiceResolved,
        onEnd: opts.onEnd,
        onError: opts.onError,
      };

      opts.onPauseChange?.(false);
      this.speakChunkAtIndex(sessionId, true);
      return true;
    } catch {
      this.resetTtsState();
      opts.onPauseChange?.(false);
      opts.onError?.('init-error');
      opts.onEnd?.();
      return false;
    }
  }

  /**
   * Plays an ordered multi-step voice sequence (e.g., AM AI Two-Step Welcome Greeting)
   * strictly one step at a time with a natural pause between steps and zero audio overlap.
   */
  speakSequence(opts: SpeakSequenceOptions): boolean {
    if (opts.muted || !isSpeechSynthesisSupported() || !Array.isArray(opts.steps) || opts.steps.length === 0) {
      opts.onPauseChange?.(false);
      opts.onEnd?.();
      return false;
    }

    const autoDetect = opts.autoDetectLanguage !== false;
    const queued: QueuedSpeechSegment[] = [];

    opts.steps.forEach((step, stepIndex) => {
      const clean = formatTextForSpeech(step.text);
      if (!clean) return;
      const stepLang = step.bcp47Lang || opts.bcp47Lang || 'en-IN';
      const segs = splitSpeechIntoBilingualSegments(step.text, {
        fallbackBcp47: stepLang,
        autoDetect,
        maxLength: 210,
      });
      segs.forEach((seg, segIdx) => {
        queued.push({
          text: seg.text,
          lang: seg.lang,
          pauseAfterMs: segIdx === segs.length - 1 ? step.pauseAfterMs ?? 280 : 0,
          stepIndex: segIdx === 0 ? stepIndex : undefined,
          step: segIdx === 0 ? step : undefined,
        });
      });
    });

    if (queued.length === 0) {
      opts.onPauseChange?.(false);
      opts.onEnd?.();
      return false;
    }

    try {
      this.stopSpeaking(false);
      const sessionId = ++this.ttsSessionId;
      this.activeSegments = queued;
      this.activeChunkIdx = 0;
      this.isPausedFlag = false;
      this.lastSpeakParams = {
        bcp47Lang: opts.bcp47Lang || 'en-IN',
        voiceUri: opts.voiceUri?.trim() || undefined,
        femaleVoiceEnabled: opts.femaleVoiceEnabled !== false,
        autoDetectLanguage: autoDetect,
        rate: Math.min(2, Math.max(0.5, opts.rate ?? 0.96)),
        pitch: Math.min(2, Math.max(0.5, opts.pitch ?? 1.04)),
        volume: Math.min(1, Math.max(0, opts.volume ?? 1.0)),
        onStart: opts.onStart,
        onStepStart: opts.onStepStart,
        onPauseChange: opts.onPauseChange,
        onVoiceResolved: opts.onVoiceResolved,
        onEnd: opts.onEnd,
        onError: opts.onError,
      };

      opts.onPauseChange?.(false);
      this.speakChunkAtIndex(sessionId, true);
      return true;
    } catch {
      this.resetTtsState();
      opts.onPauseChange?.(false);
      opts.onError?.('init-error');
      opts.onEnd?.();
      return false;
    }
  }

  private speakChunkAtIndex(sessionId: number, isFirst: boolean): void {
    if (sessionId !== this.ttsSessionId || this.isPausedFlag) return;
    const params = this.lastSpeakParams;
    if (!params || !isSpeechSynthesisSupported()) return;

    if (this.activeChunkIdx >= this.activeSegments.length) {
      const doneCb = params.onEnd;
      this.resetTtsState();
      this.notifySpeechDuckEnd();
      this.scheduleWakeWordResume(550);
      doneCb?.();
      return;
    }

    const segment = this.activeSegments[this.activeChunkIdx];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = segment.lang || params.bcp47Lang;

    const voices = window.speechSynthesis.getVoices();
    const preferred = selectBestVoiceForSegment(voices, {
      targetLang: utterance.lang,
      explicitVoiceUri: params.voiceUri || '',
      femaleVoiceEnabled: params.femaleVoiceEnabled,
      autoDetectLanguage: params.autoDetectLanguage,
    });

    if (preferred) {
      utterance.voice = preferred;
      utterance.lang = preferred.lang || utterance.lang;
      const resolved = {
        name: preferred.name,
        lang: preferred.lang,
        isFemale: isLikelyFemaleVoice(preferred),
      };
      this.lastResolvedVoice = resolved;
      params.onVoiceResolved?.(resolved);
    }

    const calibrated = calibrateVoiceTone({
      rate: params.rate,
      pitch: params.pitch,
      femaleVoiceEnabled: params.femaleVoiceEnabled,
      voice: preferred,
    });
    utterance.rate = calibrated.rate;
    utterance.pitch = calibrated.pitch;
    utterance.volume = params.volume;

    utterance.onstart = () => {
      if (sessionId !== this.ttsSessionId) return;
      if (isFirst) {
        this.suspendWakeWordForSpeechOrCapture();
        this.notifySpeechDuckStart();
        params.onStart?.();
      }
      if (segment.step && typeof segment.stepIndex === 'number') {
        params.onStepStart?.(segment.stepIndex, segment.step);
      }
    };

    utterance.onend = () => {
      if (sessionId !== this.ttsSessionId || this.isPausedFlag) return;
      this.activeChunkIdx += 1;
      const pauseMs = segment.pauseAfterMs && segment.pauseAfterMs > 0 ? segment.pauseAfterMs : 0;
      if (pauseMs > 0 && this.activeChunkIdx < this.activeSegments.length) {
        this.pauseGapTimer = window.setTimeout(() => {
          this.pauseGapTimer = null;
          this.speakChunkAtIndex(sessionId, false);
        }, pauseMs);
      } else {
        this.speakChunkAtIndex(sessionId, false);
      }
    };

    utterance.onerror = (event) => {
      if (sessionId !== this.ttsSessionId || this.isPausedFlag) return;
      const errCode = (event as SpeechSynthesisErrorEvent)?.error || 'unknown';
      const errCb = params.onError;
      const doneCb = params.onEnd;
      this.resetTtsState();
      this.notifySpeechDuckEnd();
      this.scheduleWakeWordResume(500);
      errCb?.(errCode);
      doneCb?.();
    };

    this.currentUtterance = utterance;
    this.suspendWakeWordForSpeechOrCapture();
    window.speechSynthesis.speak(utterance);
  }

  pauseSpeaking(): boolean {
    if (!isSpeechSynthesisSupported() || this.activeSegments.length === 0 || this.isPausedFlag) {
      return false;
    }
    this.isPausedFlag = true;
    this.clearPauseGapTimer();
    try {
      this.ttsSessionId += 1;
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cancel errors
    }
    this.notifySpeechDuckEnd();
    this.lastSpeakParams?.onPauseChange?.(true);
    return true;
  }

  resumeSpeaking(): boolean {
    if (!isSpeechSynthesisSupported() || !this.isPausedFlag || this.activeSegments.length === 0) {
      return false;
    }
    this.isPausedFlag = false;
    const sessionId = ++this.ttsSessionId;
    this.lastSpeakParams?.onPauseChange?.(false);
    this.speakChunkAtIndex(sessionId, true);
    return true;
  }

  stopSpeaking(notifyPauseReset = true): void {
    this.ttsSessionId += 1;
    this.clearPauseGapTimer();
    this.resetTtsState();
    this.notifySpeechDuckEnd();
    if (isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
    if (notifyPauseReset) {
      this.lastSpeakParams?.onPauseChange?.(false);
    }
    this.lastSpeakParams = null;
    if (notifyPauseReset) {
      this.scheduleWakeWordResume(500);
    }
  }

  private clearPauseGapTimer(): void {
    if (this.pauseGapTimer !== null) {
      window.clearTimeout(this.pauseGapTimer);
      this.pauseGapTimer = null;
    }
  }

  private resetTtsState(): void {
    this.clearPauseGapTimer();
    this.activeSegments = [];
    this.activeChunkIdx = 0;
    this.currentUtterance = null;
    this.isPausedFlag = false;
  }

  async startListening(params: ListenOptions): Promise<void> {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      params.onError(
        'Voice recognition is not supported in this browser. Try Google Chrome or Microsoft Edge, or type your command below.',
        'unsupported'
      );
      params.onEnd();
      return;
    }

    this.suspendWakeWordForSpeechOrCapture();
    this.stopSpeaking();
    this.stopListening();

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioCtx = new AudioContext();
        const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        this.analyserTimer = window.setInterval(() => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          params.onAudioLevel(Math.min(1, Math.max(0.05, avg / 90)));
        }, 60);
      }
    } catch (permErr) {
      const name = (permErr as Error)?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        params.onError(
          'Microphone permission was denied. Allow microphone access in your browser site settings and try again.',
          'not-allowed'
        );
        params.onEnd();
        return;
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        params.onError(
          'No microphone hardware was detected. Connect or enable a microphone and try again.',
          'audio-capture'
        );
        params.onEnd();
        return;
      }
    }

    let activeRec: SpeechRecognitionLike | null = null;
    let settled = false;
    const finishOnce = () => {
      if (settled) return;
      settled = true;
      if (activeRec && this.recognition === activeRec) {
        this.recognition = null;
      }
      this.cleanupAudioMeter();
      this.notifyListenDuckEnd();
      this.scheduleWakeWordResume(550);
      params.onEnd();
    };

    try {
      const rec = new Ctor();
      activeRec = rec;
      rec.lang = params.bcp47Lang || 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.notifyListenDuckStart();
        params.onStart();
      };

      rec.onresult = (event) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript;
          } else {
            interimStr += res[0].transcript;
          }
        }
        if (finalStr.trim()) {
          const cleaned = finalStr.trim();
          const now = Date.now();
          if (
            cleaned.toLowerCase() === this.lastFinalTranscript.toLowerCase() &&
            now - this.lastFinalTranscriptAt < 2500
          ) {
            return;
          }
          this.lastFinalTranscript = cleaned;
          this.lastFinalTranscriptAt = now;
          params.onTranscript(cleaned, true);
        } else if (interimStr.trim()) {
          params.onTranscript(interimStr.trim(), false);
        }
      };

      rec.onerror = (event) => {
        const map: Record<string, string> = {
          'not-allowed':
            'Microphone permission denied. Click the site settings icon in your browser address bar to allow microphone access.',
          'service-not-allowed':
            'Speech service permission denied by browser settings. Check microphone permissions.',
          'audio-capture':
            'No microphone was detected. Connect a microphone and try again.',
          'no-speech': 'No speech detected, Sir. Please speak a bit louder or closer to the mic.',
          network: 'Speech recognition could not reach the browser speech service. Check your connection.',
          aborted: 'Voice capture stopped.',
        };
        params.onError(
          map[event.error] || `Voice recognition encountered an issue (${event.error}).`,
          event.error
        );
        finishOnce();
      };

      rec.onend = () => {
        finishOnce();
      };

      this.recognition = rec;
      rec.start();
    } catch (err) {
      params.onError(
        err instanceof Error ? err.message : 'Unable to initialize speech recognition.',
        'init-error'
      );
      finishOnce();
    }
  }

  stopListening(): void {
    try {
      this.recognition?.stop();
    } catch {
      try {
        this.recognition?.abort();
      } catch {
        // Ignore abort errors
      }
    }
    this.recognition = null;
    this.cleanupAudioMeter();
    this.notifyListenDuckEnd();
    this.scheduleWakeWordResume(450);
  }

  destroy(): void {
    this.stopWakeWordMonitor();
    this.stopSpeaking(false);
    this.stopListening();
  }

  private cleanupAudioMeter(): void {
    if (this.analyserTimer !== null) {
      window.clearInterval(this.analyserTimer);
      this.analyserTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
