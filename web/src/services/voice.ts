import { detectLanguageMode } from './brainEngine.js';
import {
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

export {
  buildWelcomeStatusGreeting,
  buildWelcomeVoiceSequence,
  WELCOME_SESSION_STORAGE_KEY,
  WELCOME_STEP_1,
  WELCOME_STEP_2_ONLINE,
};

interface SpeechRecognitionResultEventLike {
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
  onVoiceResolved?: (info: { name: string; lang: string; isFemale: boolean }) => void;
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
  onVoiceResolved?: (info: { name: string; lang: string; isFemale: boolean }) => void;
  onEnd?: () => void;
  onError?: (errorCode: string) => void;
}

interface QueuedSpeechSegment {
  text: string;
  lang: string;
  pauseAfterMs?: number;
  stepIndex?: number;
  step?: SequenceStep;
}

export class WebVoiceEngine {
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
  private lastResolvedVoice: { name: string; lang: string; isFemale: boolean } | null = null;
  private lastSpeakParams: {
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
    onVoiceResolved?: (info: { name: string; lang: string; isFemale: boolean }) => void;
    onEnd?: () => void;
    onError?: (errorCode: string) => void;
  } | null = null;

  get isPausedState(): boolean {
    return this.isPausedFlag;
  }

  get activeVoiceInfo(): { name: string; lang: string; isFemale: boolean } | null {
    return this.lastResolvedVoice;
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
    }) as SpeechSynthesisVoice | null;

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
      errCb?.(errCode);
      doneCb?.();
    };

    this.currentUtterance = utterance;
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

  async startListening(params: {
    bcp47Lang: string;
    onStart: () => void;
    onTranscript: (text: string, isFinal: boolean) => void;
    onAudioLevel: (rms: number) => void;
    onError: (message: string, code?: string) => void;
    onEnd: () => void;
  }): Promise<void> {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      params.onError(
        'Voice recognition is not supported in this browser. Try Google Chrome or Microsoft Edge, or type your command below.',
        'unsupported'
      );
      params.onEnd();
      return;
    }

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

    let settled = false;
    const finishOnce = () => {
      if (settled) return;
      settled = true;
      this.cleanupAudioMeter();
      params.onEnd();
    };

    try {
      const rec = new Ctor();
      rec.lang = params.bcp47Lang || 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => params.onStart();

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
  }

  destroy(): void {
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
