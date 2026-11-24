import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import {
  formatTextForSpeech,
  splitSpeechIntoBilingualSegments,
} from '../src/services/speechFormatter.js';

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

  // Compute Edge TTS percentage rate relative to normal neural speed (1.0 => +0%, 0.90 => -10%)
  let effectiveRateRatio = userRate;
  if (femaleVoiceEnabled && isGreeting && effectiveRateRatio > 0.85) {
    effectiveRateRatio += profile.greetingRateShift;
  }
  const ratePct = Math.max(-35, Math.min(55, Math.round((effectiveRateRatio - 1.0) * 100)));
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;

  // Compute subtle, soothing Hz pitch contour anchored around user's pitch slider (1.0 => 0Hz base)
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
  const synthesizeSegmentImpl = options.synthesizeSegmentFn || synthesizeViaMsEdge;
  const cache = new Map();

  function getCached(key) {
    if (!cache.has(key)) return null;
    const val = cache.get(key);
    cache.delete(key);
    cache.set(key, val);
    return val;
  }

  function putCached(key, buffer) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, buffer);
    if (cache.size > maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function listRecommendedVoices() {
    return {
      ok: true,
      engine: 'msedge-neural',
      defaultStyle: DEFAULT_TTS_VOICE_STYLE,
      referencePersonality: 'laila_soft_warm_expressive_female',
      styles: Object.values(LAILA_VOICE_PROFILES),
      voices: NEURAL_VOICE_CATALOG,
    };
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

    let lastError = null;
    for (const voiceName of candidates) {
      const cacheKey = `${voiceName}|${rateStr}|${pitchStr}|${text}`;
      const hit = getCached(cacheKey);
      if (hit) {
        return { voiceName, buffer: hit, cached: true };
      }

      try {
        const buffer = await synthesizeSegmentImpl({
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
        code: 'EMPTY_SPEECH_TEXT',
        error: 'Text produced no speakable speech content.',
      };
    }

    const profile =
      LAILA_VOICE_PROFILES[stylePreset] || LAILA_VOICE_PROFILES[DEFAULT_TTS_VOICE_STYLE];

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
    synthesizeSpeech,
    getCacheSize: () => cache.size,
  };
}
