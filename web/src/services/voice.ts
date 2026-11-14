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

export class WebVoiceEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyserTimer: number | null = null;

  speak(
    text: string,
    bcp47Lang: string,
    rate = 1.0,
    pitch = 1.0,
    onStart?: () => void,
    onEnd?: () => void
  ): boolean {
    if (!isSpeechSynthesisSupported() || !text.trim()) {
      onEnd?.();
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      // Strip markdown code fences / asterisks for clean natural speech
      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code block generated on screen.')
        .replace(/[*_`#]/g, '')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = bcp47Lang;
      utterance.rate = Math.min(2, Math.max(0.5, rate));
      utterance.pitch = Math.min(2, Math.max(0.5, pitch));

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang.toLowerCase().startsWith(bcp47Lang.toLowerCase())) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(bcp47Lang.slice(0, 2).toLowerCase()));
      if (preferred) {
        utterance.voice = preferred;
      }

      utterance.onstart = () => onStart?.();
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();

      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      onEnd?.();
      return false;
    }
  }

  stopSpeaking(): void {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  async startListening(params: {
    bcp47Lang: string;
    onStart: () => void;
    onTranscript: (text: string, isFinal: boolean) => void;
    onAudioLevel: (rms: number) => void;
    onError: (message: string) => void;
    onEnd: () => void;
  }): Promise<void> {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      params.onError(
        'Web Speech Recognition is not supported in this browser. Try Google Chrome or Microsoft Edge, or type your command.'
      );
      return;
    }

    this.stopSpeaking();
    this.stopListening();

    // Start Web Audio RMS meter if mic stream is permitted
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
    } catch {
      // Proceed with SpeechRecognition even if AudioContext meter fails
    }

    try {
      const rec = new Ctor();
      rec.lang = params.bcp47Lang;
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
          'not-allowed': 'Microphone permission denied by browser.',
          'no-speech': 'No speech detected. Please speak clearly.',
          network: 'Browser speech recognition network error.',
          aborted: 'Voice capture stopped.',
        };
        params.onError(map[event.error] || `Voice recognition error: ${event.error}`);
        this.cleanupAudioMeter();
        params.onEnd();
      };

      rec.onend = () => {
        this.cleanupAudioMeter();
        params.onEnd();
      };

      this.recognition = rec;
      rec.start();
    } catch (err) {
      this.cleanupAudioMeter();
      params.onError(err instanceof Error ? err.message : 'Unable to initialize speech recognition.');
      params.onEnd();
    }
  }

  stopListening(): void {
    try {
      this.recognition?.stop();
    } catch {
      // Ignore stop errors
    }
    this.recognition = null;
    this.cleanupAudioMeter();
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
