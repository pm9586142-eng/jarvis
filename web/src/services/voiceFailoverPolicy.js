// Shared Voice Failover, Circuit Breaker, Status Labels, Audio Cache & Pipeline Policy
// Imported by WebVoiceEngine (TypeScript) and tested directly in Node unit/integration tests.

export const ELEVENLABS_VOICE_ID = 'ohvvU75FpBEB8fdaLOMh';
export const ELEVENLABS_VOICE_NAME = 'Monika Sogam – Lively E-com Support';
export const ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

export const VOICE_STATUS_LABELS = {
  ELEVENLABS_ACTIVE: 'ElevenLabs – Monika Sogam',
  BUILTIN_FALLBACK: 'AM AI Built-in Voice – Active',
  ELEVENLABS_RECONNECTING: 'ElevenLabs – Reconnecting',
  VOICE_UNAVAILABLE: 'Voice unavailable',
};

export function createVoiceCircuitBreaker({
  cooldownMs = 45_000,
  nowFn = () => Date.now(),
} = {}) {
  let openUntilMs = 0;
  let lastFailureCode = null;
  let totalTrips = 0;

  return {
    isOpen() {
      return openUntilMs > nowFn();
    },
    shouldAttemptPrimary() {
      return openUntilMs <= nowFn();
    },
    getRemainingCooldownMs() {
      return openUntilMs > nowFn() ? Math.max(0, openUntilMs - nowFn()) : 0;
    },
    getLastFailureCode() {
      return lastFailureCode;
    },
    getTotalTrips() {
      return totalTrips;
    },
    trip(reasonCode = 'TTS_ERROR', customCooldownMs) {
      const waitMs = Number.isFinite(Number(customCooldownMs))
        ? Math.max(1_000, Number(customCooldownMs))
        : cooldownMs;
      openUntilMs = nowFn() + waitMs;
      lastFailureCode = String(reasonCode || 'TTS_ERROR');
      totalTrips += 1;
    },
    recordSuccess() {
      openUntilMs = 0;
      lastFailureCode = null;
    },
    reset() {
      openUntilMs = 0;
      lastFailureCode = null;
      totalTrips = 0;
    },
  };
}

export function resolveTruthfulVoiceStatus({
  hasAnyVoice = true,
  neuralTtsEnabled = true,
  usingBuiltInFallback = false,
  circuitOpen = false,
  isProbingReconnect = false,
} = {}) {
  if (!hasAnyVoice) {
    return VOICE_STATUS_LABELS.VOICE_UNAVAILABLE;
  }
  if (!neuralTtsEnabled || usingBuiltInFallback) {
    return VOICE_STATUS_LABELS.BUILTIN_FALLBACK;
  }
  if (circuitOpen || isProbingReconnect) {
    return VOICE_STATUS_LABELS.ELEVENLABS_RECONNECTING;
  }
  return VOICE_STATUS_LABELS.ELEVENLABS_ACTIVE;
}

export function isValidMpegAudioBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 128) return false;
  const hasId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasFrameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return hasId3 || hasFrameSync;
}

export function createClientAudioCache(maxEntries = 24) {
  const store = new Map();
  const limit = Math.max(4, Number(maxEntries) || 24);

  return {
    get(key) {
      if (!store.has(key)) return null;
      const val = store.get(key);
      store.delete(key);
      store.set(key, val);
      return val;
    },
    set(key, entry) {
      if (!entry || !(entry.bytes instanceof Uint8Array) || entry.bytes.length > 512 * 1024) {
        return;
      }
      if (store.has(key)) store.delete(key);
      store.set(key, entry);
      if (store.size > limit) {
        const oldestKey = store.keys().next().value;
        store.delete(oldestKey);
      }
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}

export function buildAudioCacheKey({
  voiceId = ELEVENLABS_VOICE_ID,
  speed = 0.96,
  stylePreset = 'laila_soft',
  text = '',
}) {
  return `${voiceId}|${ELEVENLABS_MODEL_ID}|${Number(speed).toFixed(2)}|${stylePreset}|${text}`;
}

/**
 * Fetches MP3 bytes for one sentence from the backend `/api/tts/synthesize` endpoint
 * using AbortController timeout + audio corruption validation + LRU cache.
 */
export async function fetchElevenLabsSentenceAudio({
  text,
  bcp47Lang = 'en-IN',
  autoDetectLanguage = true,
  rate = 0.96,
  pitch = 1.0,
  stylePreset = 'laila_soft',
  endpointUrl,
  headers,
  signal,
  timeoutMs = 7000,
  fetchImpl = globalThis.fetch,
  cache = null,
}) {
  const cacheKey = buildAudioCacheKey({
    voiceId: ELEVENLABS_VOICE_ID,
    speed: rate,
    stylePreset,
    text,
  });

  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit && isValidMpegAudioBytes(hit.bytes)) {
      return {
        ok: true,
        cached: true,
        bytes: hit.bytes,
        voiceId: hit.voiceId || ELEVENLABS_VOICE_ID,
        voiceName: hit.voiceName || ELEVENLABS_VOICE_NAME,
        modelId: hit.modelId || ELEVENLABS_MODEL_ID,
      };
    }
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      code: 'FETCH_UNAVAILABLE',
      error: 'Network fetch is unavailable.',
    };
  }

  const localController = new AbortController();
  const timeoutId = setTimeout(() => localController.abort(), timeoutMs);
  const onParentAbort = () => localController.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      return { ok: false, aborted: true, code: 'ABORTED', error: 'Cancelled' };
    }
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const res = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers,
      signal: localController.signal,
      body: JSON.stringify({
        text,
        bcp47Lang,
        femaleVoiceEnabled: true,
        autoDetectLanguage,
        rate,
        pitch,
        stylePreset,
        responseFormat: 'mp3',
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errCode = `HTTP_${res.status}`;
      let errMessage = `TTS HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.code) errCode = String(errJson.code);
        if (errJson?.error) errMessage = String(errJson.error);
      } catch {
        // Ignore JSON parse error on error response
      }
      const cooldownMs = res.status === 401 || res.status === 403 || res.status === 402 ? 120_000 : 35_000;
      return {
        ok: false,
        httpStatus: res.status,
        code: errCode,
        cooldownMs,
        error: errMessage,
      };
    }

    const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      return {
        ok: false,
        code: 'ELEVENLABS_NON_AUDIO_RESPONSE',
        cooldownMs: 35_000,
        error: 'Server returned JSON instead of audio.',
      };
    }

    const arrayBuf = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    if (!isValidMpegAudioBytes(bytes)) {
      return {
        ok: false,
        code: bytes.length === 0 ? 'ELEVENLABS_EMPTY_AUDIO' : 'ELEVENLABS_CORRUPT_AUDIO',
        cooldownMs: 25_000,
        error: 'Received empty or invalid MP3 audio bytes.',
      };
    }

    const voiceId = res.headers?.get?.('x-tts-voice-id') || ELEVENLABS_VOICE_ID;
    const modelId = res.headers?.get?.('x-tts-model') || ELEVENLABS_MODEL_ID;
    const entry = {
      bytes,
      voiceId,
      voiceName: ELEVENLABS_VOICE_NAME,
      modelId,
    };

    if (cache) {
      cache.set(cacheKey, entry);
    }

    return {
      ok: true,
      cached: false,
      ...entry,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (signal?.aborted) {
      return { ok: false, aborted: true, code: 'ABORTED', error: 'Cancelled' };
    }
    const isTimeout = err?.name === 'AbortError';
    return {
      ok: false,
      code: isTimeout ? 'ELEVENLABS_TIMEOUT' : 'NETWORK_ERROR',
      cooldownMs: 30_000,
      error: err?.message || (isTimeout ? 'TTS timed out' : 'Network request failed'),
    };
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onParentAbort);
    }
  }
}
