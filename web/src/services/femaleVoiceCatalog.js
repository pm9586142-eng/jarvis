// Pure ESM helper for AM AI Premium Female Voice scoring, Hindi/English/Hinglish voice matching,
// and the Two-Step Automatic Welcome Sequence (strictly honest about backend health).

export const WELCOME_STEP_1 = 'Hello Sir! Welcome to AM AI. How are you?';
export const WELCOME_STEP_2_ONLINE = 'Sir, all systems are online. I am ready to assist you.';

export const WELCOME_SESSION_STORAGE_KEY = 'am_ai_welcome_played_session_v1';

/**
 * Builds Step 2 of the AM AI Welcome Greeting honestly based on verified backend health.
 * CRITICAL HONESTY RULE: Never announces "Sir, all systems are online" unless actual
 * backend health checks succeeded and at least one free AI provider is configured.
 */
export function buildWelcomeStatusGreeting({ backendOnline = false, aiConfigured = false } = {}) {
  if (backendOnline && aiConfigured) {
    return WELCOME_STEP_2_ONLINE;
  }
  if (backendOnline && !aiConfigured) {
    return 'Sir, the local interface is ready, though server AI API keys are not configured yet. Please check Settings to connect a free AI provider.';
  }
  return 'Sir, the interface is ready in standby mode. Backend services are currently offline or unreachable, so please verify your server connection.';
}

/**
 * Builds the exact two-step AM AI Welcome Sequence.
 */
export function buildWelcomeVoiceSequence({ backendOnline = false, aiConfigured = false } = {}) {
  return [
    {
      id: 'welcome_step_1',
      text: WELCOME_STEP_1,
      pauseAfterMs: 320,
    },
    {
      id: 'welcome_step_2',
      text: buildWelcomeStatusGreeting({ backendOnline, aiConfigured }),
      pauseAfterMs: 0,
    },
  ];
}

// Known high-quality natural female voices across Chrome/Edge/macOS/iOS/Android/Windows
const PREMIUM_FEMALE_VOICE_PATTERNS = [
  // Microsoft Neural / Edge Online Natural Female Voices (English & Hindi)
  /\b(?:swara|neerja|aria|jenny|sonia|libby|sara|emma|ava|ana|michelle|natasha|clara|zoe|elena)\b/i,
  // Google Natural / Chrome / Android Female Voices
  /google\s+(?:us|uk)?\s*english\s*female/i,
  /google\s+हिन्दी|google\s+hindi/i,
  // Apple macOS / iOS Natural Female Voices
  /\b(?:samantha|siri.*female|karen|moira|tessa|veena|lekha|serena|martha|victoria|allison|nicky|kate|fiona|susan)\b/i,
  // Windows Female Voices
  /\b(?:zira|heera|kalpana|hazel|eva|linda|catherine)\b/i,
  // Explicit female markers
  /\bfemale\b|\bwoman\b|\bgirl\b/i,
];

const LIKELY_MALE_VOICE_PATTERNS = [
  /\b(?:madhur|prabhat|ravi|hemant|david|mark|george|ryan|guy|christopher|eric|steffan|brian|andrew|daniel|alex|fred|tom|oliver|arthur|aaron|james|william|male|man)\b/i,
  /google\s+uk\s+english\s+male/i,
];

const NEURAL_QUALITY_PATTERNS = [
  /\b(?:natural|neural|online|enhanced|premium|siri|wavenet|studio)\b/i,
  /^google\s/i,
];

export function isLikelyFemaleVoice(voice) {
  const name = String(voice?.name || '');
  if (!name) return false;
  if (LIKELY_MALE_VOICE_PATTERNS.some((rx) => rx.test(name))) {
    return false;
  }
  return PREMIUM_FEMALE_VOICE_PATTERNS.some((rx) => rx.test(name));
}

export function isLikelyMaleVoice(voice) {
  const name = String(voice?.name || '');
  if (!name) return false;
  return LIKELY_MALE_VOICE_PATTERNS.some((rx) => rx.test(name));
}

export function isNeuralOrNaturalVoice(voice) {
  const name = String(voice?.name || '');
  return NEURAL_QUALITY_PATTERNS.some((rx) => rx.test(name));
}

/**
 * Scores a browser SpeechSynthesisVoice for a target BCP-47 locale with preference for
 * soft, sweet, natural female Hindi & English voices when femaleVoiceEnabled is true.
 */
export function scoreVoiceCandidate(voice, { targetLang = 'en-IN', femaleVoiceEnabled = true } = {}) {
  const vLang = String(voice?.lang || '').toLowerCase().replace('_', '-');
  const tLang = String(targetLang || 'en-IN').toLowerCase().replace('_', '-');
  const tPrefix = tLang.slice(0, 2);
  const vPrefix = vLang.slice(0, 2);
  const name = String(voice?.name || '');

  let score = 0;

  // 1. Language matching (critical for accurate Hindi vs English pronunciation)
  if (vLang === tLang) {
    score += 120;
  } else if (tPrefix === 'hi' && vPrefix === 'hi') {
    score += 110;
  } else if (tPrefix === 'en' && vPrefix === 'en') {
    // Prefer Indian English / US / UK natural accents cleanly
    if (vLang === 'en-in') score += 95;
    else if (vLang === 'en-us' || vLang === 'en-gb') score += 88;
    else score += 75;
  } else if (vPrefix === tPrefix) {
    score += 90;
  } else {
    score -= 100;
  }

  // 2. Female voice priority
  const female = isLikelyFemaleVoice(voice);
  const male = isLikelyMaleVoice(voice);
  if (femaleVoiceEnabled) {
    if (female) score += 70;
    else if (male) score -= 55;
    else score += 10; // Unknown gender (often default female like Google US English / Google हिन्दी)
  }

  // 3. Natural / Neural voice quality boost (avoids robotic voices)
  if (isNeuralOrNaturalVoice(voice)) {
    score += 35;
  }

  // Extra preference for exceptionally smooth Hindi & Indian-English female voices
  if (femaleVoiceEnabled) {
    if (tPrefix === 'hi' && /\b(?:swara|lekha|kalpana)\b|google\s*(?:हिन्दी|hindi)/i.test(name)) {
      score += 30;
    }
    if (tPrefix === 'en' && /\b(?:neerja|aria|jenny|samantha|ava|emma|sonia|heera|veena)\b|google\s+us\s+english/i.test(name)) {
      score += 25;
    }
  }

  // Penalize novelty / robotic / low-fi voices
  if (/\b(?:espeak|compact|whisper|zarvox|trinoids|bubbles|boing|albert|bad news|bells|cello|deranged|good news|hysterical|pipe organ)\b/i.test(name)) {
    score -= 120;
  }

  return score;
}

/**
 * Picks the best matching voice from available browser voices for a target language segment.
 */
export function selectBestVoiceForSegment(
  voices,
  { targetLang = 'en-IN', explicitVoiceUri = '', femaleVoiceEnabled = true, autoDetectLanguage = true } = {}
) {
  const list = Array.isArray(voices) ? voices : [];
  if (list.length === 0) return null;

  const targetPrefix = String(targetLang || 'en-IN').toLowerCase().slice(0, 2);

  // Honor explicit user-selected voice when it matches the segment's script/language
  // (or when auto-detect language switching is disabled)
  if (explicitVoiceUri) {
    const exact = list.find(
      (v) => v.voiceURI === explicitVoiceUri || v.name === explicitVoiceUri
    );
    if (exact) {
      const exactPrefix = String(exact.lang || '').toLowerCase().slice(0, 2);
      if (!autoDetectLanguage || exactPrefix === targetPrefix) {
        return exact;
      }
    }
  }

  let best = null;
  let bestScore = -Infinity;
  for (const voice of list) {
    const score = scoreVoiceCandidate(voice, { targetLang, femaleVoiceEnabled });
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }
  return best;
}

/**
 * Calibrates speaking rate and gentle pitch for a soft, warm, non-robotic female voice
 * while respecting user slider customizations.
 */
export function calibrateVoiceTone({ rate = 0.96, pitch = 1.04, femaleVoiceEnabled = true, voice = null } = {}) {
  const clampedRate = Math.min(2.0, Math.max(0.5, Number(rate) || 0.96));
  let effectivePitch = Math.min(2.0, Math.max(0.5, Number(pitch) || 1.0));

  if (femaleVoiceEnabled) {
    // Keep pitch natural and smooth (never squeaky or robotic)
    const isAlreadyFemale = voice ? isLikelyFemaleVoice(voice) : false;
    if (isAlreadyFemale) {
      // Subtle warmth when native female voice is already active
      effectivePitch = Math.min(1.22, Math.max(0.88, effectivePitch));
    } else if (Math.abs(effectivePitch - 1.0) < 0.02) {
      // Gentle natural lift if browser only has a neutral fallback voice
      effectivePitch = 1.08;
    }
  }

  return {
    rate: Number(clampedRate.toFixed(2)),
    pitch: Number(effectivePitch.toFixed(2)),
  };
}
