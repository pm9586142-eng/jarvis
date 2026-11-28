import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import {
  formatTextForSpeech,
  splitSpeechIntoBilingualSegments,
} from '../src/services/speechFormatter.js';

export const ELEVENLABS_VOICE_ID = 'ohvvU75FpBEB8fdaLOMh';
export const ELEVENLABS_VOICE_NAME = 'Monika Sogam – Lively E-com Support';
export const ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_flash_v2_5';
export const ELEVENLABS_API_BASE_URL = 'https://api.elevenlabs.io/v1';

export const DEFAULT_TTS_VOICE_STYLE = 'laila_soft';

export const LAILA_VOICE_PROFILES = {
  laila_soft: {
    id: 'laila_soft',
    label: 'Laila Soft & Enchanting (Default)',
    description:
      'Soft, sweet, warm & soothing feminine cadence with gentle phrasing and unhurried inter-sentence pauses.',
    baseRateRatio: 0.9,
    greetingRateShift: -0.02,
    questionPitchHz: 2,
    greetingPitchHz: 1,
    statementPitchHz: -1,
    sentencePauseMs: 260,
    clauseEndPauseMs: 320,
  },
  warm_welcome: {
    id: 'warm_welcome',
    label: 'Warm Expressive Greeting',
    description: 'Gentle welcoming warmth tuned for greetings and personal check-ins.',
    baseRateRatio: 0.9,
    greetingRateShift: -0.02,
    questionPitchHz: 3,
    greetingPitchHz: 2,
    statementPitchHz: 0,
    sentencePauseMs: 280,
    clauseEndPauseMs: 340,
  },
  calm_assistant: {
    id: 'calm_assistant',
    label: 'Calm Intelligent Assistant',
    description: 'Poised, soothing conversational clarity for longer explanations and technical briefs.',
    baseRateRatio: 0.94,
    greetingRateShift: 0,
    questionPitchHz: 1,
    greetingPitchHz: 1,
    statementPitchHz: 0,
    sentencePauseMs: 220,
    clauseEndPauseMs: 280,
  },
};

export const RECOMMENDED_FEMALE_NEURAL_VOICES = {
  'hi-IN': ['hi-IN-SwaraNeural', 'en-IN-NeerjaExpressiveNeural', 'en-IN-NeerjaNeural'],
  'en-IN': ['en-IN-NeerjaExpressiveNeural', 'en-IN-NeerjaNeural', 'en-US-AvaMultilingualNeural'],
  'en-US': ['en-US-AvaMultilingualNeural', 'en-IN-NeerjaExpressiveNeural', 'en-US-EmmaMultilingualNeural', 'en-US-AriaNeural'],
  'en-GB': ['en-GB-SoniaNeural', 'en-IN-NeerjaExpressiveNeural', 'en-US-AvaMultilingualNeural'],
  'gu-IN': ['gu-IN-DhwaniNeural', 'hi-IN-SwaraNeural', 'en-IN-NeerjaNeural'],
};

export const STANDARD_MALE_NEURAL_VOICES = {
  'hi-IN': ['hi-IN-MadhurNeural'],
  'en-IN': ['en-IN-PrabhatNeural'],
  'en-US': ['en-US-AndrewNeural', 'en-US-GuyNeural'],
  'en-GB': ['en-GB-RyanNeural'],
  'gu-IN': ['gu-IN-NiranjanNeural'],
};

export const NEURAL_VOICE_CATALOG = [
  {
    id: 'hi-IN-SwaraNeural',
    name: 'Swara Neural (Soft Hindi & Hinglish)',
    lang: 'hi-IN',
    gender: 'Female',
    recommendedFor: ['HINDI', 'HINGLISH'],
    defaultProfile: 'laila_soft',
  },
  {
    id: 'en-IN-NeerjaExpressiveNeural',
    name: 'Neerja Expressive Neural (Warm English & Hinglish)',
    lang: 'en-IN',
    gender: 'Female',
    recommendedFor: ['ENGLISH', 'HINGLISH'],
    defaultProfile: 'laila_soft',
  },
  {
    id: 'en-IN-NeerjaNeural',
    name: 'Neerja Neural (Calm Indian English)',
    lang: 'en-IN',
    gender: 'Female',
    recommendedFor: ['ENGLISH', 'HINGLISH'],
    defaultProfile: 'calm_assistant',
  },
  {
    id: 'en-US-AvaMultilingualNeural',
    name: 'Ava Multilingual Neural (Gentle Global English)',
    lang: 'en-US',
    gender: 'Female',
    recommendedFor: ['ENGLISH'],
    defaultProfile: 'laila_soft',
  },
  {
    id: 'en-GB-SoniaNeural',
    name: 'Sonia Neural (Warm British English)',
    lang: 'en-GB',
    gender: 'Female',
    recommendedFor: ['ENGLISH'],
    defaultProfile: 'calm_assistant',
  },
  {
    id: 'gu-IN-DhwaniNeural',
    name: 'Dhwani Neural (Soft Gujarati)',
    lang: 'gu-IN',
    gender: 'Female',
    recommendedFor: ['GUJARATI'],
    defaultProfile: 'laila_soft',
  },
];

const GREETING_CUE_REGEX =
  /\b(hello|hi|hey|welcome|good\s+(?:morning|afternoon|evening)|namaste|namaskar|namaste sir|suno|acha|accha|swagat)\b|नमस्ते|स्वागत|अच्छा|सुनो/i;

const DEVANAGARI_REGEX = /[\u0900-\u097F]/g;
const GUJARATI_REGEX = /[\u0A80-\u0AFF]/g;
const LATIN_WORD_REGEX = /[A-Za-z]{2,}/g;
const HINGLISH_HINT_REGEX =
  /\b(namaste|kaise|kaisa|kaisi|ho|hain|hai|aap|aapka|aapki|tum|main|mein|mera|meri|mere|kya|kyun|kab|kahan|nahi|nahin|haan|ji|bhai|dost|theek|thik|accha|achha|batao|bataiye|karo|kijiye|chahiye|samjhao|shukriya|dhanyavaad|madad|kaam|kal|aaj|abhi|baat|yaad|rakhna|hamesha|bahut|bohot|zaroori|lekin|aur|par|se|ko|ka|ki|ke|bilkul|sahi|galat)\b/gi;

export function escapeXmlForSsml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function shapeSoftProsodyText(text) {
  const formatted = formatTextForSpeech(String(text || ''));
  if (!formatted) return '';
  return formatted
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function resolveNeuralVoiceChain({
  lang = 'en-IN',
  femaleVoiceEnabled = true,
  preferredVoiceName = '',
} = {}) {
  const normalizedLang = String(lang || 'en-IN').trim().replace('_', '-');
  const lower = normalizedLang.toLowerCase();

  let chain;
  if (femaleVoiceEnabled) {
    if (lower.startsWith('hi')) chain = RECOMMENDED_FEMALE_NEURAL_VOICES['hi-IN'];
    else if (lower.startsWith('gu')) chain = RECOMMENDED_FEMALE_NEURAL_VOICES['gu-IN'];
    else if (lower === 'en-us') chain = RECOMMENDED_FEMALE_NEURAL_VOICES['en-US'];
    else if (lower === 'en-gb') chain = RECOMMENDED_FEMALE_NEURAL_VOICES['en-GB'];
    else chain = RECOMMENDED_FEMALE_NEURAL_VOICES['en-IN'];
  } else {
    if (lower.startsWith('hi')) chain = STANDARD_MALE_NEURAL_VOICES['hi-IN'];
    else if (lower.startsWith('gu')) chain = STANDARD_MALE_NEURAL_VOICES['gu-IN'];
    else if (lower === 'en-us') chain = STANDARD_MALE_NEURAL_VOICES['en-US'];
    else if (lower === 'en-gb') chain = STANDARD_MALE_NEURAL_VOICES['en-GB'];
    else chain = STANDARD_MALE_NEURAL_VOICES['en-IN'];
  }

  const trimmedPreferred = String(preferredVoiceName || '').trim();
  const isKnownNeuralShortName = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(trimmedPreferred);
  if (isKnownNeuralShortName) {
    return [trimmedPreferred, ...chain.filter((v) => v !== trimmedPreferred)];
  }
  return [...chain];
}

export function computeExpressiveProsody({
  segmentText = '',
  rate = 0.9,
  pitch = 1.0,
  stylePreset = DEFAULT_TTS_VOICE_STYLE,
  femaleVoiceEnabled = true,
} = {}) {
  const profile = LAILA_VOICE_PROFILES[stylePreset] || LAILA_VOICE_PROFILES[DEFAULT_TTS_VOICE_STYLE];
  const userRate = Math.min(2.0, Math.max(0.5, Number(rate) || profile.baseRateRatio));
  const userPitch = Math.min(1.5, Math.max(0.7, Number(pitch) || 1.0));

  const trimmed = String(segmentText || '').trim();
  const isQuestion = trimmed.endsWith('?') || trimmed.endsWith('?');
  const isGreeting = GREETING_CUE_REGEX.test(trimmed);

  let effectiveRateRatio = userRate;
  if (femaleVoiceEnabled && isGreeting && effectiveRateRatio > 0.85) {
    effectiveRateRatio += profile.greetingRateShift;
  }
  const ratePct = Math.max(-35, Math.min(55, Math.round((effectiveRateRatio - 1.0) * 100)));
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;

  const sliderHzOffset = Math.round((userPitch - 1.0) * 18);
  let emotionalHz = 0;
  if (femaleVoiceEnabled) {
    if (isQuestion) emotionalHz = profile.questionPitchHz;
    else if (isGreeting) emotionalHz = profile.greetingPitchHz;
    else emotionalHz = profile.statementPitchHz;
  }
  const totalHz = Math.max(-18, Math.min(18, sliderHzOffset + emotionalHz));
  const pitchStr = `${totalHz >= 0 ? '+' : ''}${totalHz}Hz`;

  return {
    profileId: profile.id,
    rateStr,
    pitchStr,
    isQuestion,
    isGreeting,
  };
}

export function computeSegmentPauseMs(segmentText, index, segments, profile) {
  if (index >= segments.length - 1) return 0;
  const trimmed = String(segmentText || '').trim();
  const nextSeg = segments[index + 1];
  const langChanged = nextSeg && nextSeg.lang !== segments[index].lang;
  if (/[?!।]$/.test(trimmed) || trimmed.endsWith('...')) {
    return profile.clauseEndPauseMs;
  }
  if (langChanged) {
    return Math.max(profile.sentencePauseMs, 280);
  }
  return profile.sentencePauseMs;
}

/**
 * Determines the ElevenLabs ISO-639-1 language_code hint for eleven_flash_v2_5.
 * Returns undefined for mixed Hindi+English / Hinglish so eleven_flash_v2_5
 * code-switches seamlessly without forcing an unnatural single-language accent.
 */
export function detectElevenLabsLanguageCode(text, bcp47Lang = 'en-IN', autoDetect = true) {
  const sample = String(text || '').trim();
  if (!sample) return undefined;

  if (!autoDetect) {
    const lower = String(bcp47Lang || '').toLowerCase();
    if (lower.startsWith('hi')) return 'hi';
    if (lower.startsWith('en')) return 'en';
    return undefined;
  }

  const devanagariCount = (sample.match(DEVANAGARI_REGEX) || []).length;
  const gujaratiCount = (sample.match(GUJARATI_REGEX) || []).length;
  const latinWords = sample.match(LATIN_WORD_REGEX) || [];
  const hinglishHits = (sample.match(HINGLISH_HINT_REGEX) || []).length;

  if (gujaratiCount >= 2) {
    return undefined;
  }

  // Mixed script (Devanagari + multiple English words) or Romanized Hinglish -> auto code-switch
  if (devanagariCount >= 2 && latinWords.length >= 3) {
    return undefined;
  }
  if (devanagariCount >= 2) {
    return 'hi';
  }
  if (hinglishHits >= 2 || (hinglishHits >= 1 && latinWords.length <= 6)) {
    return undefined;
  }
  return 'en';
}

export function computeElevenLabsVoiceSettings({
  rate = 0.96,
  stylePreset = DEFAULT_TTS_VOICE_STYLE,
  text = '',
} = {}) {
  const profile = LAILA_VOICE_PROFILES[stylePreset] || LAILA_VOICE_PROFILES[DEFAULT_TTS_VOICE_STYLE];
  const numericRate = Number.isFinite(Number(rate)) ? Number(rate) : 0.96;
  const isGreeting = GREETING_CUE_REGEX.test(String(text || ''));

  let stability = 0.48;
  let similarity_boost = 0.78;
  let style = 0.2;
  let speed = numericRate;

  if (profile.id === 'calm_assistant') {
    stability = 0.58;
    similarity_boost = 0.78;
    style = 0.12;
  } else if (profile.id === 'warm_welcome') {
    stability = 0.44;
    similarity_boost = 0.8;
    style = 0.26;
  } else {
    stability = 0.48;
    similarity_boost = 0.78;
    style = 0.2;
  }

  if (isGreeting && speed > 0.88) {
    speed -= 0.02;
  }

  const clampedSpeed = Number(Math.min(1.2, Math.max(0.7, speed)).toFixed(2));
  return {
    stability,
    similarity_boost,
    style,
    use_speaker_boost: true,
    speed: clampedSpeed,
  };
}

export function isValidMpegAudioBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 128) return false;
  // ID3 tag ("ID3") or MPEG frame sync (0xFF 0xE0 mask)
  const hasId3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
  const hasFrameSync = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  return hasId3 || hasFrameSync;
}

export function classifyElevenLabsError(err, upstreamStatus = 0) {
  const status = Number(upstreamStatus || err?.status || err?.upstreamStatus || 0);
  const message = String(err?.message || '').toLowerCase();
  const codeProp = String(err?.code || '').toUpperCase();

  if (codeProp === 'ELEVENLABS_NOT_CONFIGURED') {
    return {
      httpStatus: 503,
      code: 'ELEVENLABS_NOT_CONFIGURED',
      retryable: false,
      cooldownMs: 45_000,
      error: 'ElevenLabs API key is not configured on the backend server. Using device voice.',
    };
  }
  if (codeProp === 'ELEVENLABS_CIRCUIT_OPEN') {
    return {
      httpStatus: 503,
      code: 'ELEVENLABS_CIRCUIT_OPEN',
      retryable: false,
      cooldownMs: 0,
      error: 'ElevenLabs voice is cooling down after a recent error. Using device voice.',
    };
  }
  if (codeProp === 'ELEVENLABS_EMPTY_AUDIO' || codeProp === 'ELEVENLABS_CORRUPT_AUDIO') {
    return {
      httpStatus: 502,
      code: codeProp,
      retryable: false,
      cooldownMs: 25_000,
      error: 'ElevenLabs returned incomplete or invalid audio. Falling back to device voice.',
    };
  }
  if (status === 401 || status === 403 || codeProp === 'ELEVENLABS_AUTH_ERROR') {
    return {
      httpStatus: 503,
      code: 'ELEVENLABS_AUTH_ERROR',
      retryable: false,
      cooldownMs: 120_000,
      error: 'ElevenLabs authentication failed. Using built-in device voice.',
    };
  }
  if (
    status === 402 ||
    codeProp === 'ELEVENLABS_QUOTA_EXCEEDED' ||
    message.includes('quota') ||
    message.includes('credit') ||
    message.includes('character limit')
  ) {
    return {
      httpStatus: 503,
      code: 'ELEVENLABS_QUOTA_EXCEEDED',
      retryable: false,
      cooldownMs: 120_000,
      error: 'ElevenLabs character quota reached. Using built-in device voice.',
    };
  }
  if (status === 429 || codeProp === 'ELEVENLABS_RATE_LIMIT') {
    return {
      httpStatus: 429,
      code: 'ELEVENLABS_RATE_LIMIT',
      retryable: false,
      cooldownMs: 30_000,
      error: 'ElevenLabs rate limit reached. Switching smoothly to built-in device voice.',
    };
  }
  if (status === 404 || status === 422 || codeProp === 'ELEVENLABS_UNSUPPORTED_VOICE') {
    return {
      httpStatus: 502,
      code: 'ELEVENLABS_UNSUPPORTED_VOICE',
      retryable: false,
      cooldownMs: 60_000,
      error: `Monika Sogam (${ELEVENLABS_VOICE_ID}) is temporarily unreachable. Using built-in device voice.`,
    };
  }
  if (err?.name === 'AbortError' || codeProp === 'ELEVENLABS_TIMEOUT' || message.includes('timeout')) {
    return {
      httpStatus: 504,
      code: 'ELEVENLABS_TIMEOUT',
      retryable: false,
      cooldownMs: 25_000,
      error: 'ElevenLabs voice request timed out. Switching cleanly to built-in device voice.',
    };
  }

  return {
    httpStatus: 503,
    code: 'ELEVENLABS_UPSTREAM_ERROR',
    retryable: true,
    cooldownMs: 30_000,
    error: 'ElevenLabs voice service is temporarily unavailable. Using built-in device voice.',
  };
}

export function resolveElevenLabsApiKey(options = {}) {
  const candidate =
    typeof options.elevenLabsApiKey === 'string'
      ? options.elevenLabsApiKey
      : process.env.ELEVENLABS_API_KEY || '';
  const trimmed = String(candidate || '').trim();
  if (
    !trimmed ||
    trimmed.toUpperCase() === 'UNSET' ||
    trimmed === 'your_elevenlabs_api_key' ||
    trimmed === 'your_elevenlabs_api_key_here'
  ) {
    return '';
  }
  return trimmed;
}

async function synthesizeViaElevenLabsHttp({
  apiKey,
  text,
  voiceId = ELEVENLABS_VOICE_ID,
  modelId = ELEVENLABS_DEFAULT_MODEL_ID,
  languageCode,
  voiceSettings,
  timeoutMs = 8500,
  stream = false,
  fetchImpl = globalThis.fetch,
}) {
  if (!apiKey) {
    const err = new Error('ELEVENLABS_API_KEY missing');
    err.code = 'ELEVENLABS_NOT_CONFIGURED';
    throw err;
  }
  if (typeof fetchImpl !== 'function') {
    const err = new Error('Fetch API is unavailable in this runtime.');
    err.code = 'ELEVENLABS_UPSTREAM_ERROR';
    throw err;
  }

  const endpointPath = stream
    ? `/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`
    : `/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;

  const bodyPayload = {
    text,
    model_id: modelId,
    voice_settings: voiceSettings,
  };
  if (languageCode) {
    bodyPayload.language_code = languageCode;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${ELEVENLABS_API_BASE_URL}${endpointPath}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const textBody = await res.text();
        if (textBody) {
          detail = textBody.slice(0, 280);
        }
      } catch {
        // Ignore read error
      }
      const err = new Error(`ElevenLabs upstream error (${res.status}): ${detail}`);
      err.status = res.status;
      err.upstreamStatus = res.status;
      if (detail.toLowerCase().includes('quota') || detail.toLowerCase().includes('credit')) {
        err.code = 'ELEVENLABS_QUOTA_EXCEEDED';
      }
      throw err;
    }

    if (stream && res.body) {
      return { streamResponse: res, controller, timer };
    }

    const arrayBuf = await res.arrayBuffer();
    const out = Buffer.from(arrayBuf);
    if (!out || out.length === 0) {
      const err = new Error('ElevenLabs returned empty audio buffer.');
      err.code = 'ELEVENLABS_EMPTY_AUDIO';
      throw err;
    }
    if (!isValidMpegAudioBuffer(out)) {
      const err = new Error('ElevenLabs returned non-MPEG or corrupted audio payload.');
      err.code = 'ELEVENLABS_CORRUPT_AUDIO';
      throw err;
    }

    return out;
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(`ElevenLabs request timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'AbortError';
      timeoutErr.code = 'ELEVENLABS_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (!stream) {
      clearTimeout(timer);
    }
  }
}

async function synthesizeViaMsEdge({
  text,
  voiceName,
  rateStr,
  pitchStr,
  timeoutMs = 12000,
}) {
  const escaped = escapeXmlForSsml(text);
  if (!escaped) {
    throw new Error('Empty text after SSML sanitization.');
  }

  const tts = new MsEdgeTTS();
  let timer = null;

  try {
    await Promise.race([
      tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Edge TTS metadata timeout for ${voiceName}`)), timeoutMs);
      }),
    ]);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    const { audioStream } = tts.toStream(escaped, {
      rate: rateStr,
      pitch: pitchStr,
      volume: '+0%',
    });

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      let settled = false;
      const doneTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Edge TTS stream timeout for ${voiceName}`));
        }
      }, timeoutMs);

      audioStream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      audioStream.on('end', () => {
        clearTimeout(doneTimer);
        if (!settled) {
          settled = true;
          const out = Buffer.concat(chunks);
          if (out.length === 0) {
            reject(new Error(`Empty audio returned by ${voiceName}`));
          } else {
            resolve(out);
          }
        }
      });
      audioStream.on('error', (err) => {
        clearTimeout(doneTimer);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });

    return buffer;
  } finally {
    if (timer) clearTimeout(timer);
    try {
      tts.close();
    } catch {
      // Ignore close cleanup error
    }
  }
}

export function createTtsService(options = {}) {
  const maxCacheEntries = Number(options.maxCacheEntries) || 48;
  const legacySegmentHook = typeof options.synthesizeSegmentFn === 'function' ? options.synthesizeSegmentFn : null;
  const elevenLabsHook = typeof options.elevenLabsSynthesizeFn === 'function' ? options.elevenLabsSynthesizeFn : null;
  const elevenLabsStreamHook =
    typeof options.elevenLabsStreamFn === 'function' ? options.elevenLabsStreamFn : null;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs) || 8500;
  const nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => Date.now();
  const useLegacyHookOnly = Boolean(legacySegmentHook && !elevenLabsHook && !options.forceElevenLabs);

  const cache = new Map();
  let circuitOpenUntilMs = 0;
  let lastFailureCode = null;
  let lastFailureAt = null;
  let lastSuccessAt = null;

  function resolveModelId() {
    const envModel = String(options.elevenLabsModelId || process.env.ELEVENLABS_MODEL_ID || '').trim();
    return envModel || ELEVENLABS_DEFAULT_MODEL_ID;
  }

  function isElevenLabsConfigured() {
    if (elevenLabsHook) return true;
    return Boolean(resolveElevenLabsApiKey(options));
  }

  function getCircuitStatus() {
    const now = nowFn();
    const isOpen = circuitOpenUntilMs > now;
    return {
      state: isOpen ? 'open' : 'closed',
      openUntilMs: isOpen ? circuitOpenUntilMs : 0,
      retryAfterMs: isOpen ? Math.max(0, circuitOpenUntilMs - now) : 0,
      lastFailureCode,
      lastFailureAt,
      lastSuccessAt,
    };
  }

  function tripCircuit(classified) {
    const cooldown = Number(classified?.cooldownMs) || 0;
    if (cooldown > 0) {
      circuitOpenUntilMs = nowFn() + cooldown;
    }
    lastFailureCode = classified?.code || 'ELEVENLABS_UPSTREAM_ERROR';
    lastFailureAt = new Date(nowFn()).toISOString();
  }

  function resetCircuit() {
    circuitOpenUntilMs = 0;
    lastFailureCode = null;
    lastSuccessAt = new Date(nowFn()).toISOString();
  }

  function getCached(key) {
    if (!cache.has(key)) return null;
    const val = cache.get(key);
    cache.delete(key);
    cache.set(key, val);
    return val;
  }

  function putCached(key, buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length > 512 * 1024) return;
    if (cache.has(key)) cache.delete(key);
    cache.set(key, buffer);
    if (cache.size > maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function listRecommendedVoices() {
    const configured = isElevenLabsConfigured();
    const modelId = resolveModelId();
    return {
      ok: true,
      engine: useLegacyHookOnly ? 'msedge-neural' : 'elevenlabs',
      primaryProvider: 'elevenlabs',
      primaryVoice: {
        id: ELEVENLABS_VOICE_ID,
        name: ELEVENLABS_VOICE_NAME,
        modelId,
        languages: ['en', 'hi', 'hinglish'],
        configured,
      },
      elevenLabsConfigured: configured,
      circuitStatus: getCircuitStatus(),
      defaultStyle: DEFAULT_TTS_VOICE_STYLE,
      referencePersonality: 'monika_sogam_lively_warm_female',
      styles: Object.values(LAILA_VOICE_PROFILES),
      voices: [
        {
          id: ELEVENLABS_VOICE_ID,
          name: ELEVENLABS_VOICE_NAME,
          provider: 'elevenlabs',
          modelId,
          lang: 'multilingual',
          gender: 'Female',
          recommendedFor: ['ENGLISH', 'HINDI', 'HINGLISH'],
          defaultProfile: DEFAULT_TTS_VOICE_STYLE,
        },
        ...NEURAL_VOICE_CATALOG,
      ],
    };
  }

  async function verifyElevenLabsAccess() {
    const apiKey = resolveElevenLabsApiKey(options);
    if (!apiKey && !elevenLabsHook) {
      return {
        ok: false,
        configured: false,
        voiceId: ELEVENLABS_VOICE_ID,
        voiceName: ELEVENLABS_VOICE_NAME,
        modelId: resolveModelId(),
        code: 'ELEVENLABS_NOT_CONFIGURED',
        error: 'ELEVENLABS_API_KEY is missing from server environment variables.',
      };
    }

    const startMs = nowFn();
    try {
      const voiceSettings = computeElevenLabsVoiceSettings({
        rate: 0.96,
        stylePreset: DEFAULT_TTS_VOICE_STYLE,
        text: 'Namaste.',
      });
      const buf = elevenLabsHook
        ? await elevenLabsHook({
            text: 'Namaste.',
            voiceId: ELEVENLABS_VOICE_ID,
            modelId: resolveModelId(),
            languageCode: undefined,
            voiceSettings,
          })
        : await synthesizeViaElevenLabsHttp({
            apiKey,
            text: 'Namaste.',
            voiceId: ELEVENLABS_VOICE_ID,
            modelId: resolveModelId(),
            languageCode: undefined,
            voiceSettings,
            timeoutMs,
            stream: false,
            fetchImpl,
          });

      if (!isValidMpegAudioBuffer(buf)) {
        const err = new Error('Verification received invalid audio bytes.');
        err.code = 'ELEVENLABS_CORRUPT_AUDIO';
        throw err;
      }

      resetCircuit();
      return {
        ok: true,
        configured: true,
        verified: true,
        voiceId: ELEVENLABS_VOICE_ID,
        voiceName: ELEVENLABS_VOICE_NAME,
        modelId: resolveModelId(),
        bytes: buf.length,
        latencyMs: Math.max(0, nowFn() - startMs),
      };
    } catch (err) {
      const classified = classifyElevenLabsError(err);
      tripCircuit(classified);
      return {
        ok: false,
        configured: Boolean(apiKey || elevenLabsHook),
        verified: false,
        voiceId: ELEVENLABS_VOICE_ID,
        voiceName: ELEVENLABS_VOICE_NAME,
        modelId: resolveModelId(),
        code: classified.code,
        error: classified.error,
      };
    }
  }

  async function synthesizeViaElevenLabsSingle({
    text,
    bcp47Lang,
    autoDetectLanguage,
    rate,
    stylePreset,
  }) {
    const modelId = resolveModelId();
    const languageCode = detectElevenLabsLanguageCode(text, bcp47Lang, autoDetectLanguage);
    const voiceSettings = computeElevenLabsVoiceSettings({ rate, stylePreset, text });
    const cacheKey = `${ELEVENLABS_VOICE_ID}|${modelId}|${languageCode || 'auto'}|${voiceSettings.speed}|${stylePreset}|${text}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return { buffer: cached, cached: true, modelId, languageCode, voiceSettings };
    }

    const circuit = getCircuitStatus();
    if (circuit.state === 'open') {
      const err = new Error('ElevenLabs circuit open');
      err.code = 'ELEVENLABS_CIRCUIT_OPEN';
      err.retryAfterMs = circuit.retryAfterMs;
      throw err;
    }

    const apiKey = resolveElevenLabsApiKey(options);
    if (!apiKey && !elevenLabsHook) {
      const err = new Error('ELEVENLABS_API_KEY not configured');
      err.code = 'ELEVENLABS_NOT_CONFIGURED';
      throw err;
    }

    const runAttempt = async () => {
      const buf = elevenLabsHook
        ? await elevenLabsHook({
            text,
            voiceId: ELEVENLABS_VOICE_ID,
            modelId,
            languageCode,
            voiceSettings,
          })
        : await synthesizeViaElevenLabsHttp({
            apiKey,
            text,
            voiceId: ELEVENLABS_VOICE_ID,
            modelId,
            languageCode,
            voiceSettings,
            timeoutMs,
            stream: false,
            fetchImpl,
          });
      if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
        const emptyErr = new Error('ElevenLabs returned empty audio.');
        emptyErr.code = 'ELEVENLABS_EMPTY_AUDIO';
        throw emptyErr;
      }
      if (!isValidMpegAudioBuffer(buf)) {
        const badErr = new Error('ElevenLabs returned corrupted audio.');
        badErr.code = 'ELEVENLABS_CORRUPT_AUDIO';
        throw badErr;
      }
      return buf;
    };

    try {
      const buffer = await runAttempt();
      resetCircuit();
      putCached(cacheKey, buffer);
      return { buffer, cached: false, modelId, languageCode, voiceSettings };
    } catch (firstErr) {
      const classified = classifyElevenLabsError(firstErr);
      if (classified.retryable) {
        try {
          await new Promise((r) => setTimeout(r, 300));
          const retryBuffer = await runAttempt();
          resetCircuit();
          putCached(cacheKey, retryBuffer);
          return { buffer: retryBuffer, cached: false, modelId, languageCode, voiceSettings };
        } catch (secondErr) {
          const secondClassified = classifyElevenLabsError(secondErr);
          tripCircuit(secondClassified);
          const outErr = new Error(secondClassified.error);
          outErr.classified = secondClassified;
          throw outErr;
        }
      }
      tripCircuit(classified);
      const outErr = new Error(classified.error);
      outErr.classified = classified;
      throw outErr;
    }
  }

  async function synthesizeSpeechStream({
    text,
    bcp47Lang = 'en-IN',
    autoDetectLanguage = true,
    rate = 0.96,
    stylePreset = DEFAULT_TTS_VOICE_STYLE,
  } = {}) {
    const shapedText = shapeSoftProsodyText(text);
    if (!shapedText) {
      return {
        ok: false,
        httpStatus: 400,
        code: 'EMPTY_SPEECH_TEXT',
        error: 'Text produced no speakable speech content.',
      };
    }

    const modelId = resolveModelId();
    const languageCode = detectElevenLabsLanguageCode(shapedText, bcp47Lang, autoDetectLanguage);
    const voiceSettings = computeElevenLabsVoiceSettings({ rate, stylePreset, text: shapedText });
    const cacheKey = `${ELEVENLABS_VOICE_ID}|${modelId}|${languageCode || 'auto'}|${voiceSettings.speed}|${stylePreset}|${shapedText}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return {
        ok: true,
        cached: true,
        engine: 'elevenlabs',
        voiceId: ELEVENLABS_VOICE_ID,
        voiceName: ELEVENLABS_VOICE_NAME,
        modelId,
        languageCode: languageCode || 'auto',
        mp3Buffer: cached,
      };
    }

    if (useLegacyHookOnly) {
      const legacy = await synthesizeSpeech({
        text: shapedText,
        bcp47Lang,
        autoDetectLanguage,
        rate,
        stylePreset,
        responseFormat: 'mp3',
      });
      if (!legacy.ok) return legacy;
      return {
        ok: true,
        cached: false,
        engine: legacy.engine,
        voiceId: legacy.voiceNames?.[0] || 'msedge',
        voiceName: legacy.voiceNames?.[0] || 'MsEdge Neural',
        modelId: 'msedge',
        mp3Buffer: legacy.mp3Buffer,
      };
    }

    const circuit = getCircuitStatus();
    if (circuit.state === 'open') {
      const classified = classifyElevenLabsError({ code: 'ELEVENLABS_CIRCUIT_OPEN' });
      return {
        ok: false,
        fallbackRequired: true,
        httpStatus: classified.httpStatus,
        code: classified.code,
        retryAfterMs: circuit.retryAfterMs,
        error: classified.error,
      };
    }

    const apiKey = resolveElevenLabsApiKey(options);
    if (!apiKey && !elevenLabsStreamHook && !elevenLabsHook) {
      const classified = classifyElevenLabsError({ code: 'ELEVENLABS_NOT_CONFIGURED' });
      return {
        ok: false,
        fallbackRequired: true,
        httpStatus: classified.httpStatus,
        code: classified.code,
        error: classified.error,
      };
    }

    if (elevenLabsHook && !elevenLabsStreamHook) {
      try {
        const res = await synthesizeViaElevenLabsSingle({
          text: shapedText,
          bcp47Lang,
          autoDetectLanguage,
          rate,
          stylePreset,
        });
        return {
          ok: true,
          cached: res.cached,
          engine: 'elevenlabs',
          voiceId: ELEVENLABS_VOICE_ID,
          voiceName: ELEVENLABS_VOICE_NAME,
          modelId,
          languageCode: languageCode || 'auto',
          mp3Buffer: res.buffer,
        };
      } catch (err) {
        const classified = err?.classified || classifyElevenLabsError(err);
        return {
          ok: false,
          fallbackRequired: true,
          httpStatus: classified.httpStatus,
          code: classified.code,
          error: classified.error,
        };
      }
    }

    try {
      const result = elevenLabsStreamHook
        ? await elevenLabsStreamHook({
            text: shapedText,
            voiceId: ELEVENLABS_VOICE_ID,
            modelId,
            languageCode,
            voiceSettings,
          })
        : await synthesizeViaElevenLabsHttp({
            apiKey,
            text: shapedText,
            voiceId: ELEVENLABS_VOICE_ID,
            modelId,
            languageCode,
            voiceSettings,
            timeoutMs,
            stream: true,
            fetchImpl,
          });

      const reader = result.streamResponse.body.getReader();
      const firstRead = await reader.read();
      if (firstRead.done || !firstRead.value || firstRead.value.length === 0) {
        clearTimeout(result.timer);
        const emptyErr = new Error('ElevenLabs stream ended before sending audio.');
        emptyErr.code = 'ELEVENLABS_EMPTY_AUDIO';
        throw emptyErr;
      }

      const firstChunk = Buffer.from(firstRead.value);
      if (firstChunk.length >= 3 && !isValidMpegAudioBuffer(Buffer.concat([firstChunk, Buffer.alloc(Math.max(0, 128 - firstChunk.length))]))) {
        clearTimeout(result.timer);
        const corruptErr = new Error('ElevenLabs stream began with invalid non-MPEG data.');
        corruptErr.code = 'ELEVENLABS_CORRUPT_AUDIO';
        throw corruptErr;
      }

      resetCircuit();
      return {
        ok: true,
        engine: 'elevenlabs',
        voiceId: ELEVENLABS_VOICE_ID,
        voiceName: ELEVENLABS_VOICE_NAME,
        modelId,
        languageCode: languageCode || 'auto',
        firstChunk,
        reader,
        timer: result.timer,
        onCompleteBuffer: (fullBuffer) => putCached(cacheKey, fullBuffer),
      };
    } catch (err) {
      const classified = err?.classified || classifyElevenLabsError(err);
      tripCircuit(classified);
      return {
        ok: false,
        fallbackRequired: true,
        httpStatus: classified.httpStatus,
        code: classified.code,
        error: classified.error,
      };
    }
  }

  async function synthesizeSegmentWithFallback({
    text,
    lang,
    femaleVoiceEnabled,
    preferredVoiceName,
    rateStr,
    pitchStr,
  }) {
    const candidates = resolveNeuralVoiceChain({
      lang,
      femaleVoiceEnabled,
      preferredVoiceName,
    });

    const impl = legacySegmentHook || synthesizeViaMsEdge;
    let lastError = null;
    for (const voiceName of candidates) {
      const cacheKey = `${voiceName}|${rateStr}|${pitchStr}|${text}`;
      const hit = getCached(cacheKey);
      if (hit) {
        return { voiceName, buffer: hit, cached: true };
      }

      try {
        const buffer = await impl({
          text,
          voiceName,
          rateStr,
          pitchStr,
        });
        if (Buffer.isBuffer(buffer) && buffer.length > 0) {
          putCached(cacheKey, buffer);
          return { voiceName, buffer, cached: false };
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error(`Unable to synthesize TTS audio for locale ${lang}`);
  }

  async function synthesizeSpeech({
    text,
    bcp47Lang = 'en-IN',
    femaleVoiceEnabled = true,
    autoDetectLanguage = true,
    rate = 0.9,
    pitch = 1.0,
    stylePreset = DEFAULT_TTS_VOICE_STYLE,
    preferredVoiceName = '',
    responseFormat = 'segments',
  } = {}) {
    const shapedText = shapeSoftProsodyText(text);
    if (!shapedText) {
      return {
        ok: false,
        httpStatus: 400,
        code: 'EMPTY_SPEECH_TEXT',
        error: 'Text produced no speakable speech content.',
      };
    }

    const profile =
      LAILA_VOICE_PROFILES[stylePreset] || LAILA_VOICE_PROFILES[DEFAULT_TTS_VOICE_STYLE];

    // Primary Runtime Path: ElevenLabs (Monika Sogam – ohvvU75FpBEB8fdaLOMh, eleven_flash_v2_5)
    if (!useLegacyHookOnly) {
      try {
        if (responseFormat === 'mp3') {
          const single = await synthesizeViaElevenLabsSingle({
            text: shapedText,
            bcp47Lang,
            autoDetectLanguage,
            rate,
            stylePreset: profile.id,
          });
          return {
            ok: true,
            engine: 'elevenlabs',
            voiceId: ELEVENLABS_VOICE_ID,
            voiceName: ELEVENLABS_VOICE_NAME,
            modelId: single.modelId,
            languageCode: single.languageCode || 'auto',
            style: profile.id,
            mimeType: 'audio/mpeg',
            voiceNames: [ELEVENLABS_VOICE_NAME],
            mp3Buffer: single.buffer,
            cached: single.cached,
          };
        }

        const sentenceUnits = shapedText
          .split(/(?<=[.!?।])\s+|\s*\.\.\.\s*/)
          .map((s) => s.trim())
          .filter(Boolean);

        const rawSegments = [];
        for (const unit of sentenceUnits.length > 0 ? sentenceUnits : [shapedText]) {
          const sub = splitSpeechIntoBilingualSegments(unit, {
            fallbackBcp47: bcp47Lang || 'en-IN',
            autoDetect: autoDetectLanguage !== false,
            maxLength: 260,
          });
          if (sub.length > 0) rawSegments.push(...sub);
        }
        if (rawSegments.length === 0) {
          rawSegments.push({ text: shapedText, lang: bcp47Lang || 'en-IN' });
        }

        const synthesizedSegments = [];
        for (let i = 0; i < rawSegments.length; i++) {
          const seg = rawSegments[i];
          const single = await synthesizeViaElevenLabsSingle({
            text: seg.text,
            bcp47Lang: seg.lang,
            autoDetectLanguage,
            rate,
            stylePreset: profile.id,
          });
          synthesizedSegments.push({
            text: seg.text,
            lang: seg.lang,
            voiceId: ELEVENLABS_VOICE_ID,
            voiceName: ELEVENLABS_VOICE_NAME,
            modelId: single.modelId,
            pauseAfterMs: computeSegmentPauseMs(seg.text, i, rawSegments, profile),
            audioBase64: single.buffer.toString('base64'),
          });
        }

        return {
          ok: true,
          engine: 'elevenlabs',
          voiceId: ELEVENLABS_VOICE_ID,
          voiceName: ELEVENLABS_VOICE_NAME,
          modelId: resolveModelId(),
          style: profile.id,
          mimeType: 'audio/mpeg',
          segments: synthesizedSegments,
        };
      } catch (err) {
        const classified = err?.classified || classifyElevenLabsError(err);
        return {
          ok: false,
          fallbackRequired: true,
          httpStatus: classified.httpStatus,
          code: classified.code,
          error: classified.error,
          circuitStatus: getCircuitStatus(),
        };
      }
    }

    // Legacy / explicitly injected test-hook path (voiceLailaUpgrade.test.mjs compatibility)
    const sentenceUnits = shapedText
      .split(/(?<=[.!?।])\s+|\s*\.\.\.\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    const segments = [];
    for (const unit of sentenceUnits.length > 0 ? sentenceUnits : [shapedText]) {
      const unitSegments = splitSpeechIntoBilingualSegments(unit, {
        fallbackBcp47: bcp47Lang || 'en-IN',
        autoDetect: autoDetectLanguage !== false,
        maxLength: 210,
      });
      if (unitSegments.length > 0) {
        segments.push(...unitSegments);
      }
    }
    if (segments.length === 0) {
      segments.push({ text: shapedText, lang: bcp47Lang || 'en-IN' });
    }

    const synthesizedSegments = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const prosody = computeExpressiveProsody({
        segmentText: seg.text,
        rate,
        pitch,
        stylePreset: profile.id,
        femaleVoiceEnabled: femaleVoiceEnabled !== false,
      });

      const resolved = await synthesizeSegmentWithFallback({
        text: seg.text,
        lang: seg.lang,
        femaleVoiceEnabled: femaleVoiceEnabled !== false,
        preferredVoiceName,
        rateStr: prosody.rateStr,
        pitchStr: prosody.pitchStr,
      });

      synthesizedSegments.push({
        text: seg.text,
        lang: seg.lang,
        voiceName: resolved.voiceName,
        rate: prosody.rateStr,
        pitch: prosody.pitchStr,
        cached: resolved.cached,
        pauseAfterMs: computeSegmentPauseMs(seg.text, i, segments, profile),
        buffer: resolved.buffer,
      });
    }

    if (responseFormat === 'mp3') {
      const mp3Buffer = Buffer.concat(synthesizedSegments.map((s) => s.buffer));
      return {
        ok: true,
        engine: 'msedge-neural',
        style: profile.id,
        mimeType: 'audio/mpeg',
        voiceNames: Array.from(new Set(synthesizedSegments.map((s) => s.voiceName))),
        segmentsMeta: synthesizedSegments.map((s) => ({
          text: s.text,
          lang: s.lang,
          voiceName: s.voiceName,
          pauseAfterMs: s.pauseAfterMs,
          bytes: s.buffer.length,
        })),
        mp3Buffer,
      };
    }

    return {
      ok: true,
      engine: 'msedge-neural',
      style: profile.id,
      mimeType: 'audio/mpeg',
      segments: synthesizedSegments.map((s) => ({
        text: s.text,
        lang: s.lang,
        voiceName: s.voiceName,
        rate: s.rate,
        pitch: s.pitch,
        pauseAfterMs: s.pauseAfterMs,
        audioBase64: s.buffer.toString('base64'),
      })),
    };
  }

  return {
    listRecommendedVoices,
    verifyElevenLabsAccess,
    synthesizeSpeech,
    synthesizeSpeechStream,
    getCircuitStatus,
    getCacheSize: () => cache.size,
  };
}
