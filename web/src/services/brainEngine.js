// Pure JS/ESM JARVIS AI Brain Engine — shared by Express backend, React frontend, and Node unit tests.

export const HINGLISH_PHRASES = [
  'kya hai',
  'kaise hai',
  'kaise ho',
  'kaise kaam',
  'kaise kare',
  'kaise karu',
  'kyu ',
  'kyon ',
  'samjhao',
  'batao',
  'bata do',
  'banao',
  'dikhao',
  'kar do',
  'karna hai',
  'chahiye',
  'mujhe',
  'mere ko',
  'aap ',
  'tum ',
  'nhi',
  'nahi',
  'nahin',
  'theek hai',
  'thik hai',
  'sahi hai',
  'accha',
  'achha',
  'aur batao',
  'aur detail',
  'short mein',
  'hindi mein',
  'hinglish mein',
  'iska ',
  'iske ',
  'isko ',
  'uska ',
  'uske ',
  'kya hua',
  'step by step samjhao',
  'madad',
  'yaar',
  'bhai',
  'kaam karta',
  'likh do',
  'fix kar',
  'check kar',
];

const HINGLISH_TOKEN_REGEX =
  /\b(kya|kaise|kyu|kyon|samjhao|batao|banao|dikhao|karo|karna|chahiye|mujhe|mera|meri|mere|tum|aap|hain|hai|nahi|nahin|nhi|theek|thik|accha|achha|sahi|bahut|thoda|iska|iske|isko|uska|uske|isliye|lekin|phir|fir|mein|vala|wali|wale|yaar|bhai|madad|likho|padho)\b/gi;

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const GUJARATI_REGEX = /[\u0A80-\u0AFF]/;

const GREETING_ONLY_REGEX =
  /^(hi|hello|hey|good morning|good afternoon|good evening|namaste|jarvis|hello jarvis|hi jarvis|kaise ho|kya haal hai)[!.,?\s]*$/i;

export function detectLanguageMode(text = '', preferredLanguage = 'ENGLISH') {
  const value = String(text || '').trim();
  const normalizedPref = ['ENGLISH', 'HINDI', 'HINGLISH', 'GUJARATI'].includes(
    String(preferredLanguage).toUpperCase()
  )
    ? String(preferredLanguage).toUpperCase()
    : 'ENGLISH';

  if (!value) return normalizedPref;

  // Check native scripts first
  if (DEVANAGARI_REGEX.test(value)) {
    return 'HINDI';
  }
  if (GUJARATI_REGEX.test(value)) {
    return 'GUJARATI';
  }

  const lower = value.toLowerCase();

  // Explicit request in text
  if (/\bhinglish\b/i.test(lower)) return 'HINGLISH';
  if (/\bin hindi\b|\bhindi mein\b/i.test(lower)) return 'HINDI';

  // Hinglish scoring with boundary protection against accidental English overlap
  const hasExplicitPhrase = HINGLISH_PHRASES.some((phrase) => lower.includes(phrase));
  const tokenMatches = lower.match(HINGLISH_TOKEN_REGEX) || [];
  const uniqueTokens = new Set(tokenMatches.map((t) => t.toLowerCase()));

  if (hasExplicitPhrase || uniqueTokens.size >= 2) {
    return 'HINGLISH';
  }

  if (normalizedPref === 'HINGLISH') return 'HINGLISH';
  if (normalizedPref === 'HINDI') return 'HINDI';
  if (normalizedPref === 'GUJARATI') return 'GUJARATI';
  return 'ENGLISH';
}

export function detectFollowUp(prompt = '', history = []) {
  const validHistory = Array.isArray(history)
    ? history.filter((m) => m && !m.isError && typeof m.text === 'string' && m.text.trim())
    : [];
  if (validHistory.length === 0) return false;

  const trimmed = String(prompt || '').trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  if (GREETING_ONLY_REGEX.test(lower)) return false;

  const explicitFollowUpRegex =
    /\b(explain more|tell me more|elaborate|clarify|continue|go on|what about|how about|and then|next step|step \d+|above|previous|earlier|that code|this error|fix it|fix this|optimize it|improve it|rewrite it|give an example|example do|aur batao|aur detail|iska|iske|isko|uska|uske|phir kya|fir kya|short mein|in short|summarize this|summarize above)\b/i;
  if (explicitFollowUpRegex.test(lower)) return true;

  // Short contextual questions / pronoun-heavy replies during an active thread
  const words = lower.split(/\s+/).filter(Boolean);
  if (
    words.length <= 5 &&
    /\b(why|how|when|where|really|example|more|details|it|this|that|those|these|same|kyu|kaise|kab)\b/i.test(
      lower
    )
  ) {
    return true;
  }

  return false;
}

export function detectIntent(prompt = '', history = []) {
  const lower = String(prompt || '').toLowerCase();

  if (
    /\b(summariz(?:e|ed|ing|ation)?|summary|recap|tl;?dr|key takeaways|highlights|nishkarsh|saaransh)\b/i.test(lower) ||
    /सारांश|निष्कर्ष|संक्षेप/.test(prompt)
  ) {
    return 'SUMMARIZATION';
  }

  if (
    /\b(code|program|script|function|class|component|bug|debug|stack trace|exception|error|typescript|javascript|react|kotlin|compose|python|sql|docker|kubernetes|api|endpoint|regex|css|html|algorithm|refactor|unit test|fix kar|code likh)\b/i.test(
      lower
    ) ||
    /```/.test(lower)
  ) {
    return 'CODING';
  }

  if (
    /\b(plan|roadmap|schedule|reminder|calendar|meeting|todo|to-do|briefing|agenda|step by step|steps to|workflow|strategy|architecture|design a|checklist|plan banao|kaise start)\b/i.test(
      lower
    ) ||
    /योजना|प्लान|शेड्यूल/.test(prompt)
  ) {
    return 'PLANNING';
  }

  if (
    /\b(cpu|ram|memory|storage|battery|terminal|security|defcon|system|hardware|lockdown|audit|telemetry|latency|cloud run|health check)\b/i.test(
      lower
    )
  ) {
    return 'SYSTEM_DIAGNOSTICS';
  }

  if (
    /\b(search|weather|news|fact|research|latest|who is|wikipedia|price|compare|comparison|pros and cons|versus|vs\b|difference between)\b/i.test(
      lower
    )
  ) {
    return 'RESEARCH';
  }

  if (detectFollowUp(prompt, history)) {
    return 'FOLLOW_UP';
  }

  if (
    /\b(explain|what is|how does|how do|why does|why is|teach me|understand|concept|samjhao|kya hota hai|kaise kaam karta)\b/i.test(
      lower
    ) ||
    /समझाओ|क्या है|कैसे काम/.test(prompt)
  ) {
    return 'EXPLANATION';
  }

  return 'CONVERSATION';
}

export function determineReasoningMode({ prompt = '', intent = 'CONVERSATION', isFollowUp = false }) {
  const trimmed = String(prompt || '').trim();
  const lower = trimmed.toLowerCase();

  if (GREETING_ONLY_REGEX.test(lower) && trimmed.length < 40) {
    return { mode: 'fast', thinkingBudget: 0 };
  }

  const deepSignalRegex =
    /\b(step by step|step-by-step|architecture|trade-?off|compare|design|debug|root cause|optimize|multi-step|roadmap|strategy|analyze|analyse|refactor|edge cases|plan banao|deep dive)\b/i;

  if (
    intent === 'PLANNING' ||
    (intent === 'CODING' && (trimmed.length > 120 || deepSignalRegex.test(lower))) ||
    deepSignalRegex.test(lower) ||
    trimmed.length > 350
  ) {
    return { mode: 'deep', thinkingBudget: 1024 };
  }

  if (
    intent === 'CODING' ||
    intent === 'SUMMARIZATION' ||
    intent === 'RESEARCH' ||
    intent === 'EXPLANATION' ||
    intent === 'SYSTEM_DIAGNOSTICS' ||
    isFollowUp
  ) {
    return { mode: 'structured', thinkingBudget: 512 };
  }

  return { mode: 'fast', thinkingBudget: 0 };
}

export function recommendAgentForIntent({ intent, prompt = '' }) {
  const lower = String(prompt || '').toLowerCase();
  if (intent === 'CODING') return 'DUM_E_ENGINEER';
  if (intent === 'RESEARCH') return 'VERONICA_RESEARCH';
  if (intent === 'PLANNING') return 'FRIDAY_COORDINATOR';
  if (intent === 'SYSTEM_DIAGNOSTICS') return 'HOMER_DIAGNOSTICS';
  if (/\b(code|bug|debug|api|script)\b/i.test(lower)) return 'DUM_E_ENGINEER';
  return 'JARVIS_PRIME';
}

export function buildContextWindow(history = [], maxRecent = 16, maxCharsPerTurn = 6000) {
  const valid = Array.isArray(history)
    ? history.filter((m) => m && !m.isError && typeof m.text === 'string' && m.text.trim())
    : [];

  if (valid.length === 0) {
    return {
      recentMessages: [],
      earlierCount: 0,
      earlierContextDigest: '',
    };
  }

  const splitIndex = Math.max(0, valid.length - maxRecent);
  const earlier = valid.slice(0, splitIndex);
  const recent = valid.slice(splitIndex).map((m) => ({
    role: m.role === 'model' || m.role === 'jarvis' ? 'model' : 'user',
    text:
      m.text.trim().length > maxCharsPerTurn
        ? `${m.text.trim().slice(0, maxCharsPerTurn)}... [truncated for window]`
        : m.text.trim(),
  }));

  let earlierContextDigest = '';
  if (earlier.length > 0) {
    const bullets = earlier.slice(-10).map((m) => {
      const speaker = m.role === 'model' || m.role === 'jarvis' ? 'JARVIS' : 'User';
      const compact = m.text.replace(/\s+/g, ' ').trim().slice(0, 140);
      return `- ${speaker}: ${compact}${m.text.trim().length > 140 ? '...' : ''}`;
    });
    earlierContextDigest = `Earlier turns (${earlier.length} archived messages before recent window):\n${bullets.join('\n')}`;
  }

  return {
    recentMessages: recent,
    earlierCount: earlier.length,
    earlierContextDigest,
  };
}

export function buildLanguageDirective(languageMode) {
  switch (languageMode) {
    case 'HINDI':
      return "Language Mode: HINDI (हिंदी). Respond naturally in clear, refined Hindi using Devanagari script (keep technical code identifiers/API names accurate in English). Address the user respectfully as 'Sir'.";
    case 'HINGLISH':
      return "Language Mode: HINGLISH (Natural Hindi + English mix in Latin script). Respond smoothly in natural, intelligent Hinglish — easy-to-read conversational Hindi phrasing mixed with crisp English technical terms, maintaining the elite JARVIS persona and addressing the user as 'Sir'.";
    case 'GUJARATI':
      return "Language Mode: GUJARATI (ગુજરાતી). Respond naturally in refined Gujarati using Gujarati script while keeping technical code/API terms accurate. Address the user respectfully as 'Sir'.";
    case 'ENGLISH':
    default:
      return "Language Mode: ENGLISH. Respond in refined, crisp British-inspired English with calm confidence, precision, and subtle wit. Address the user respectfully as 'Sir'.";
  }
}

export function analyzeBrainRequest({
  prompt = '',
  history = [],
  preferredLanguage = 'ENGLISH',
  conversationSummary = '',
}) {
  const detectedLanguage = detectLanguageMode(prompt, preferredLanguage);
  const isFollowUp = detectFollowUp(prompt, history);
  const intent = detectIntent(prompt, history);
  const reasoning = determineReasoningMode({ prompt, intent, isFollowUp });
  const recommendedAgent = recommendAgentForIntent({ intent, prompt });
  const contextWindow = buildContextWindow(history, 16);

  const summarySections = [];
  if (typeof conversationSummary === 'string' && conversationSummary.trim()) {
    summarySections.push(`Saved Conversation Summary:\n${conversationSummary.trim().slice(0, 1800)}`);
  }
  if (contextWindow.earlierContextDigest) {
    summarySections.push(contextWindow.earlierContextDigest);
  }

  const directiveLines = [
    '[JARVIS COGNITIVE BRAIN DIRECTIVES]',
    buildLanguageDirective(detectedLanguage),
    `Detected Intent: ${intent} | Follow-Up Turn: ${isFollowUp ? 'YES' : 'NO'} | Reasoning Depth: ${reasoning.mode.toUpperCase()}`,
    'Contextual Continuity: Maintain strict continuity with all prior turns and summaries below. Resolve pronouns ("it", "that", "above", "iska", "step 2") accurately from context.',
    'Reasoning & Planning: For multi-step, architectural, or debugging tasks, organize reasoning into clear numbered steps, call out assumptions/trade-offs, and provide complete, runnable code in fenced blocks.',
    'Clarifying Questions: Only if the request is genuinely ambiguous or missing critical constraints, give your best initial guidance and ask 1-3 brief clarifying questions at the end.',
  ];

  if (summarySections.length > 0) {
    directiveLines.push('', '[CONVERSATION MEMORY & PRIOR CONTEXT]', ...summarySections);
  }

  return {
    intent,
    detectedLanguage,
    isFollowUp,
    reasoningMode: reasoning.mode,
    thinkingBudget: reasoning.thinkingBudget,
    recommendedAgent,
    contextWindow,
    brainDirectiveBlock: directiveLines.join('\n'),
  };
}

export function classifyGeminiError(statusCode, rawMessage = '') {
  const msg = String(rawMessage || '').trim();
  const lower = msg.toLowerCase();

  if (statusCode === 401 || statusCode === 403 || /api[_ ]?key.*invalid|permission denied|unauthorized/i.test(lower)) {
    return {
      code: 'GEMINI_AUTH_ERROR',
      message: 'Gemini API authentication failed. Verify GEMINI_API_KEY permissions and validity on the server.',
    };
  }
  if (statusCode === 429 || /quota|rate limit|resource exhausted|too many requests/i.test(lower)) {
    return {
      code: 'GEMINI_RATE_LIMIT',
      message: 'Gemini API rate limit or quota reached. Please wait a moment and retry, Sir.',
    };
  }
  if (statusCode === 503 || /unavailable|overloaded|high demand/i.test(lower)) {
    return {
      code: 'GEMINI_UNAVAILABLE',
      message: 'Gemini service is temporarily overloaded or unavailable. Retry shortly.',
    };
  }
  if (/timeout|timed out|aborted|deadline/i.test(lower)) {
    return {
      code: 'GEMINI_TIMEOUT',
      message: 'Gemini response timed out. Try shortening the prompt or retrying.',
    };
  }
  if (statusCode === 400 || /invalid argument|token|context length/i.test(lower)) {
    return {
      code: 'GEMINI_BAD_REQUEST',
      message: msg || 'Gemini rejected the request payload. Check prompt or attachment size.',
    };
  }
  return {
    code: 'GEMINI_ERROR',
    message: msg || 'Unexpected error communicating with Gemini API.',
  };
}
