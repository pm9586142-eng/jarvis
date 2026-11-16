import { detectLanguageMode } from './brainEngine.js';
import { formatTextForSpeech, splitSpeechIntoChunks } from './speechFormatter';

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
      return fallbackBcp47 || 'en-GB';
  }
}

export interface SpeakOptions {
  text: string;
  bcp47Lang: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  muted?: boolean;
  onStart?: () => void;
  onPauseChange?: (paused: boolean) => void;
  onEnd?: () => void;
}

export class WebVoiceEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyserTimer: number | null = null;

  // Chunked TTS state for reliable Pause / Resume / Stop & long responses
  private ttsSessionId = 0;
  private activeChunks: string[] = [];
  private activeChunkIdx = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isPausedFlag = false;
  private lastSpeakParams: {
    bcp47Lang: string;
    rate: number;
    pitch: number;
    volume: number;
    onStart?: () => void;
    onPauseChange?: (paused: boolean) => void;
    onEnd?: () => void;
  } | null = null;

  get isPausedState(): boolean {
    return this.isPausedFlag;
  }

  speak(
    textOrOptions: string | SpeakOptions,
    bcp47Lang = 'en-GB',
    rate = 1.0,
    pitch = 1.0,
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

    const spokenText = formatTextForSpeech(opts.text);
    const chunks = splitSpeechIntoChunks(spokenText, 220);
    if (chunks.length === 0) {
      opts.onPauseChange?.(false);
      opts.onEnd?.();
      return false;
    }

    const targetLang = resolveTtsLangForText(spokenText, opts.bcp47Lang);

    try {
      this.stopSpeaking(false);
      const sessionId = ++this.ttsSessionId;
      this.activeChunks = chunks;
      this.activeChunkIdx = 0;
      this.isPausedFlag = false;
      this.lastSpeakParams = {
        bcp47Lang: targetLang,
        rate: Math.min(2, Math.max(0.5, opts.rate ?? 1.0)),
        pitch: Math.min(2, Math.max(0.5, opts.pitch ?? 1.0)),
        volume: Math.min(1, Math.max(0, opts.volume ?? 1.0)),
        onStart: opts.onStart,
        onPauseChange: opts.onPauseChange,
        onEnd: opts.onEnd,
      };

      opts.onPauseChange?.(false);
      this.speakChunkAtIndex(sessionId, true);
      return true;
    } catch {
      this.resetTtsState();
      opts.onPauseChange?.(false);
      opts.onEnd?.();
      return false;
    }
  }

  private speakChunkAtIndex(sessionId: number, isFirst: boolean): void {
    if (sessionId !== this.ttsSessionId || this.isPausedFlag) return;
    const params = this.lastSpeakParams;
    if (!params || !isSpeechSynthesisSupported()) return;

    if (this.activeChunkIdx >= this.activeChunks.length) {
      const doneCb = params.onEnd;
      this.resetTtsState();
      doneCb?.();
      return;
    }

    const chunk = this.activeChunks[this.activeChunkIdx];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = params.bcp47Lang;
    utterance.rate = params.rate;
    utterance.pitch = params.pitch;
    utterance.volume = params.volume;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.toLowerCase() === params.bcp47Lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(params.bcp47Lang.toLowerCase())) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(params.bcp47Lang.slice(0, 2).toLowerCase()));
    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.onstart = () => {
      if (sessionId === this.ttsSessionId && isFirst) {
        params.onStart?.();
      }
    };

    utterance.onend = () => {
      if (sessionId !== this.ttsSessionId || this.isPausedFlag) return;
      this.activeChunkIdx += 1;
      this.speakChunkAtIndex(sessionId, false);
    };

    utterance.onerror = () => {
      if (sessionId !== this.ttsSessionId || this.isPausedFlag) return;
      const doneCb = params.onEnd;
      this.resetTtsState();
      doneCb?.();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  pauseSpeaking(): boolean {
    if (!isSpeechSynthesisSupported() || this.activeChunks.length === 0 || this.isPausedFlag) {
      return false;
    }
    this.isPausedFlag = true;
    try {
      // Cancel active browser utterance cleanly while keeping chunk cursor at activeChunkIdx so resume works universally (including Android Chrome)
      this.ttsSessionId += 1;
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cancel errors
    }
    this.lastSpeakParams?.onPauseChange?.(true);
    return true;
  }

  resumeSpeaking(): boolean {
    if (!isSpeechSynthesisSupported() || !this.isPausedFlag || this.activeChunks.length === 0) {
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

  private resetTtsState(): void {
    this.activeChunks = [];
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

    // Request mic stream for real-time RMS acoustic visualizer only after user gesture
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
      rec.lang = params.bcp47Lang || 'en-GB';
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
          params.onTranscript(finalStr.trim(), true);
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
