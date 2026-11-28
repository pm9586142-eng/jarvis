export const ELEVENLABS_VOICE_ID: string;
export const ELEVENLABS_VOICE_NAME: string;
export const ELEVENLABS_MODEL_ID: string;

export const VOICE_STATUS_LABELS: {
  readonly ELEVENLABS_ACTIVE: string;
  readonly BUILTIN_FALLBACK: string;
  readonly ELEVENLABS_RECONNECTING: string;
  readonly VOICE_UNAVAILABLE: string;
};

export interface VoiceCircuitBreaker {
  isOpen(): boolean;
  shouldAttemptPrimary(): boolean;
  getRemainingCooldownMs(): number;
  getLastFailureCode(): string | null;
  getTotalTrips(): number;
  trip(reasonCode?: string, customCooldownMs?: number): void;
  recordSuccess(): void;
  reset(): void;
}

export function createVoiceCircuitBreaker(opts?: {
  cooldownMs?: number;
  nowFn?: () => number;
}): VoiceCircuitBreaker;

export function resolveTruthfulVoiceStatus(opts?: {
  hasAnyVoice?: boolean;
  neuralTtsEnabled?: boolean;
  usingBuiltInFallback?: boolean;
  circuitOpen?: boolean;
  isProbingReconnect?: boolean;
}): string;

export function isValidMpegAudioBytes(bytes: Uint8Array): boolean;

export interface ClientAudioCacheEntry {
  bytes: Uint8Array;
  voiceId?: string;
  voiceName?: string;
  modelId?: string;
}

export interface ClientAudioCache {
  get(key: string): ClientAudioCacheEntry | null;
  set(key: string, entry: ClientAudioCacheEntry): void;
  clear(): void;
  size(): number;
}

export function createClientAudioCache(maxEntries?: number): ClientAudioCache;

export function buildAudioCacheKey(opts?: {
  voiceId?: string;
  speed?: number;
  stylePreset?: string;
  text?: string;
}): string;

export interface ElevenLabsSentenceFetchResult {
  ok: boolean;
  cached?: boolean;
  aborted?: boolean;
  bytes?: Uint8Array;
  voiceId?: string;
  voiceName?: string;
  modelId?: string;
  httpStatus?: number;
  code?: string;
  cooldownMs?: number;
  error?: string;
}

export function fetchElevenLabsSentenceAudio(opts: {
  text: string;
  bcp47Lang?: string;
  autoDetectLanguage?: boolean;
  rate?: number;
  pitch?: number;
  stylePreset?: string;
  endpointUrl: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  cache?: ClientAudioCache | null;
}): Promise<ElevenLabsSentenceFetchResult>;
