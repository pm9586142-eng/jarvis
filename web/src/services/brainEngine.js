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

const AUTO_MEMORY_SIGNAL_REGEX =
  /\b(remember|prefer|preference|always|never|from now on|call me|my name|i am|i'm|i live|i work|my job|my role|my project|our project|we are building|i'm building|i am building|my stack|my tech stack|my team|my goal|my schedule|my favorite|my favourite|i like|i hate|i use|don't use|do not use|switch to|decided to|decision|deadline|mera|meri|mere|mujhe|main\b|hum\b|yaad rakh|pasand)\b|मेरा|मेरी|मेरे|मुझे|मैं|याद रख|पसंद/i;

export function shouldAutoExtractMemories(prompt = '') {
  const trimmed = String(prompt || '').trim();
  if (trimmed.length < 10) return false;
  if (GREETING_ONLY_REGEX.test(trimmed)) return false;
  return AUTO_MEMORY_SIGNAL_REGEX.test(trimmed);
}

export function parseRetryDelaySeconds(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 0) {
    return rawValue;
  }

  const str = String(rawValue).trim();
  if (!str) return null;

  // Google RetryInfo protobuf duration format: "42s", "1.5s", "500ms"
  const msMatch = str.match(/^(\d+(?:\.\d+)?)\s*ms$/i);
  if (msMatch) {
    return Number(msMatch[1]) / 1000;
  }
  const secMatch = str.match(/^(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/i);
  if (secMatch) {
    return Number(secMatch[1]);
  }
  if (/^\d+(?:\.\d+)?$/.test(str)) {
    return Number(str);
  }

  // HTTP-date (RFC 7231) or ISO-8601 timestamp format in Retry-After header
  if (/^(?:[A-Za-z]{3},\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i.test(str)) {
    const parsedDate = Date.parse(str);
    if (Number.isFinite(parsedDate)) {
      const deltaSec = (parsedDate - Date.now()) / 1000;
      return deltaSec > 0 ? Math.ceil(deltaSec) : 0;
    }
  }

  // Inline Google message text: "Please retry in 42.192014s." or "retry after 15 seconds"
  const inlineMatch = str.match(/(?:retry\s+(?:in|after)|try again in)\s+(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds|m|min|minutes)?/i);
  if (inlineMatch) {
    const num = Number(inlineMatch[1]);
    const unit = (inlineMatch[2] || 's').toLowerCase();
    if (!Number.isFinite(num)) return null;
    if (unit === 'ms') return num / 1000;
    if (unit === 'm' || unit.startsWith('min')) return num * 60;
    return num;
  }

  return null;
}

function tryParseEmbeddedJson(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function readHeaderCaseInsensitive(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? null;
  }
  if (typeof headers === 'object') {
    const lowerTarget = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lowerTarget) {
        return Array.isArray(v) ? v[0] : v;
      }
    }
  }
  return null;
}

export function extractGeminiErrorDetails(err) {
  let httpStatus = Number(err?.status ?? err?.statusCode ?? err?.response?.status);
  if (!Number.isFinite(httpStatus) || httpStatus <= 0) httpStatus = undefined;

  let rawMessage = String(err?.message || '').trim();
  let parsedPayload = null;

  if (err?.error && typeof err.error === 'object') {
    parsedPayload = { error: err.error };
  } else if (err?.response?.data && typeof err.response.data === 'object') {
    parsedPayload = err.response.data;
  } else if (err?.body && typeof err.body === 'object') {
    parsedPayload = err.body;
  } else if (typeof err?.body === 'string') {
    parsedPayload = tryParseEmbeddedJson(err.body);
  }

  if (!parsedPayload && rawMessage) {
    parsedPayload = tryParseEmbeddedJson(rawMessage);
  }

  const inner = parsedPayload?.error && typeof parsedPayload.error === 'object' ? parsedPayload.error : parsedPayload;
  const upstreamMessage =
    typeof inner?.message === 'string' && inner.message.trim()
      ? inner.message.trim()
      : rawMessage;

  if (!httpStatus) {
    const candidateCode = Number(inner?.code ?? err?.code);
    if (Number.isFinite(candidateCode) && candidateCode >= 100 && candidateCode <= 599) {
      httpStatus = candidateCode;
    } else if (rawMessage) {
      const statusPrefixMatch = rawMessage.match(/(?:got status:\s*|\[HTTP\s*|\[)(\d{3})\b/i);
      if (statusPrefixMatch) {
        httpStatus = Number(statusPrefixMatch[1]);
      }
    }
  }

  const upstreamStatus =
    typeof inner?.status === 'string' && inner.status.trim()
      ? inner.status.trim()
      : typeof err?.statusText === 'string' && err.statusText.trim()
        ? err.statusText.trim()
        : null;

  const details = Array.isArray(inner?.details)
    ? inner.details
    : Array.isArray(err?.details)
      ? err.details
      : [];

  const quotaViolations = [];
  let retryAfterSeconds = null;
  let errorReason = null;
  const helpLinks = [];

  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue;
    const typeStr = String(detail['@type'] || '');

    if (Array.isArray(detail.violations)) {
      for (const v of detail.violations) {
        if (!v || typeof v !== 'object') continue;
        quotaViolations.push({
          quotaMetric: String(v.quotaMetric || v.subject || '').trim(),
          quotaId: String(v.quotaId || '').trim(),
          quotaValue: v.quotaValue !== undefined && v.quotaValue !== null ? String(v.quotaValue).trim() : '',
          quotaDimensions: v.quotaDimensions && typeof v.quotaDimensions === 'object' ? v.quotaDimensions : {},
          description: String(v.description || '').trim(),
        });
      }
    }

    if (detail.retryDelay !== undefined && retryAfterSeconds === null) {
      retryAfterSeconds = parseRetryDelaySeconds(detail.retryDelay);
    }

    if (
      (typeStr.includes('ErrorInfo') || typeof detail.reason === 'string') &&
      typeof detail.reason === 'string' &&
      detail.reason.trim() &&
      !errorReason
    ) {
      errorReason = detail.reason.trim();
    }

    if (Array.isArray(detail.links)) {
      for (const link of detail.links) {
        if (link?.url) helpLinks.push(String(link.url));
      }
    }
  }

  if (retryAfterSeconds === null) {
    const headerVal =
      readHeaderCaseInsensitive(err?.headers, 'retry-after') ??
      readHeaderCaseInsensitive(err?.response?.headers, 'retry-after');
    if (headerVal !== null && headerVal !== undefined) {
      retryAfterSeconds = parseRetryDelaySeconds(headerVal);
    }
  }

  if (retryAfterSeconds === null && upstreamMessage) {
    retryAfterSeconds = parseRetryDelaySeconds(upstreamMessage);
  }

  return {
    httpStatus,
    upstreamStatus,
    upstreamMessage,
    retryAfterSeconds,
    quotaViolations,
    errorReason,
    helpLinks,
    rawDetails: details,
  };
}

function buildDisplayMessage(httpStatus, label, upstreamMessage, retryAfterSeconds, extraGuidance = '') {
  const statusPart = Number.isFinite(httpStatus) ? `HTTP ${httpStatus} • ` : '';
  const header = `[${statusPart}${label}]`;
  const cleanUpstream = String(upstreamMessage || '').trim();
  const hasRetryInText = cleanUpstream && /retry\s+(?:in|after)\s+\d/i.test(cleanUpstream);
  const retryNote =
    !hasRetryInText && typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? ` (Retry after ${Math.ceil(retryAfterSeconds)}s)`
      : '';
  const body = cleanUpstream || extraGuidance || label;
  const suffix = extraGuidance && cleanUpstream && !cleanUpstream.includes(extraGuidance) ? ` ${extraGuidance}` : '';
  return `${header} ${body}${retryNote}${suffix}`.trim();
}

export function classifyGeminiError(statusCode, rawMessage = '', detailsOrOptions = {}) {
  const msg = String(rawMessage || '').trim();
  const lower = msg.toLowerCase();
  const upstreamStatus = String(detailsOrOptions?.upstreamStatus || '').trim().toUpperCase();
  const errorReason = String(detailsOrOptions?.errorReason || '').trim().toUpperCase();
  const quotaViolations = Array.isArray(detailsOrOptions?.quotaViolations) ? detailsOrOptions.quotaViolations : [];
  const retryAfterSeconds =
    typeof detailsOrOptions?.retryAfterSeconds === 'number' && Number.isFinite(detailsOrOptions.retryAfterSeconds)
      ? detailsOrOptions.retryAfterSeconds
      : parseRetryDelaySeconds(msg);

  const quotaMetrics = [];
  const quotaIds = [];
  let hasZeroQuotaLimit = /\blimit\s*:\s*0\b|\bquota\s+limit\s+of\s+0\b|\blimit\s+is\s+0\b/i.test(msg);

  const combinedParts = [msg, upstreamStatus, errorReason];
  for (const v of quotaViolations) {
    if (v?.quotaMetric) {
      quotaMetrics.push(v.quotaMetric);
      combinedParts.push(v.quotaMetric);
    }
    if (v?.quotaId) {
      quotaIds.push(v.quotaId);
      combinedParts.push(v.quotaId);
    }
    if (v?.description) combinedParts.push(v.description);
    if (v?.quotaValue !== undefined && v?.quotaValue !== null && String(v.quotaValue).trim() === '0') {
      hasZeroQuotaLimit = true;
    }
  }
  const combinedText = combinedParts.join(' ');
  const combinedLower = combinedText.toLowerCase();

  const isQuotaOrRateSignal =
    statusCode === 429 ||
    statusCode === 402 ||
    upstreamStatus === 'RESOURCE_EXHAUSTED' ||
    quotaViolations.length > 0 ||
    /\b(quota|rate[_ -]?limit|resource[_ ]exhausted|too many requests|spend[_ -]?cap|spending limit|monthly spend|budget exceeded|requests per minute|tokens per minute|requests per day|rpm|tpm|rpd)\b/i.test(
      combinedLower
    );

  // 1. Spend cap / budget limit (non-retryable)
  const isSpendCap =
    /\b(spend[_ -]?cap|spending[_ -]?cap|spend[_ -]?limit|spending[_ -]?limit|monthly[_ ]?spend|budget[_ ]?(?:cap|limit|exceeded)|cost[_ ]?limit|spend_limit_exceeded|monthly_spend_cap)\b/i.test(
      combinedLower
    );

  if (isSpendCap) {
    const effectiveStatus = statusCode ?? 429;
    return {
      code: 'GEMINI_QUOTA_SPEND_CAP',
      quotaCategory: 'SPEND_CAP',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
      upstreamMessage: msg,
      retryable: false,
      retryAfterSeconds,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(effectiveStatus, 'Spend Cap Reached', msg, retryAfterSeconds),
    };
  }

  // 2. Billing disabled / zero quota limit / free tier unavailable (non-retryable)
  // Note: Do NOT trigger solely on Google's boilerplate "please check your plan and billing details".
  const isExplicitBilling =
    statusCode === 402 ||
    hasZeroQuotaLimit ||
    errorReason === 'BILLING_DISABLED' ||
    errorReason === 'CLOUD_BILLING_NOT_ENABLED' ||
    errorReason === 'FREE_TIER_NOT_AVAILABLE' ||
    errorReason === 'ACCOUNT_STATE_INVALID' ||
    /\b(billing[_ ]?(?:disabled|not enabled|required|account)|enable billing|free tier is not available|not available on (?:the )?free tier|upgrade to (?:a )?paid|paid tier required|payment required|delinquent|billing_disabled)\b/i.test(
      combinedLower
    );

  if (isExplicitBilling) {
    const effectiveStatus = statusCode ?? 429;
    return {
      code: 'GEMINI_QUOTA_BILLING',
      quotaCategory: 'BILLING',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || (effectiveStatus === 403 ? 'PERMISSION_DENIED' : 'RESOURCE_EXHAUSTED'),
      upstreamMessage: msg,
      retryable: false,
      retryAfterSeconds,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(effectiveStatus, 'Billing / Zero Quota Limit', msg, retryAfterSeconds),
    };
  }

  // 3. Authentication / Permission errors (401 / 403 non-billing)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    errorReason === 'API_KEY_INVALID' ||
    /api[_ ]?key.*invalid|permission denied|unauthorized/i.test(lower)
  ) {
    const effectiveStatus = statusCode ?? 401;
    return {
      code: 'GEMINI_AUTH_ERROR',
      quotaCategory: 'NONE',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || (effectiveStatus === 403 ? 'PERMISSION_DENIED' : 'UNAUTHENTICATED'),
      upstreamMessage: msg,
      retryable: false,
      retryAfterSeconds: null,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(
        effectiveStatus,
        'Gemini Auth Error',
        msg || 'Verify GEMINI_API_KEY permissions and validity on the server.',
        null
      ),
    };
  }

  // 4. Model not found / retired (404)
  if (
    statusCode === 404 ||
    /no longer available|not found for api version|model.*not found|models\/[^\s]+.*(?:not found|deprecated|retired|unavailable)/i.test(
      lower
    )
  ) {
    const effectiveStatus = statusCode ?? 404;
    return {
      code: 'GEMINI_MODEL_NOT_FOUND',
      quotaCategory: 'NONE',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || 'NOT_FOUND',
      upstreamMessage: msg,
      retryable: false,
      retryAfterSeconds: null,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(
        effectiveStatus,
        'Model Not Found',
        msg || 'Configured Gemini model was not found.',
        null,
        '(JARVIS uses gemini-3.8-flash by default; update GEMINI_MODEL if overridden.)'
      ),
    };
  }

  // 5. Quota / Rate-limit errors (distinguish RPD vs TPM vs RPM vs Generic temporary 429)
  if (isQuotaOrRateSignal) {
    const effectiveStatus = statusCode ?? 429;
    const isRpd =
      /per[_ ]?day|requestsperday|requests_per_day|daily[_ ]?(?:quota|limit|request)|\brpd\b|generate_requests_per_day/i.test(
        combinedLower
      );
    if (isRpd) {
      return {
        code: 'GEMINI_QUOTA_RPD',
        quotaCategory: 'RPD',
        httpStatus: effectiveStatus,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        upstreamMessage: msg,
        retryable: false,
        retryAfterSeconds,
        quotaMetrics,
        quotaIds,
        message: buildDisplayMessage(effectiveStatus, 'Daily Quota (RPD) Exhausted', msg, retryAfterSeconds),
      };
    }

    const isTpm =
      /tokens?[_ ]?per[_ ]?minute|tokensperminute|input_token_count|output_token_count|token_count|\btpm\b/i.test(
        combinedLower
      );
    if (isTpm) {
      return {
        code: 'GEMINI_QUOTA_TPM',
        quotaCategory: 'TPM',
        httpStatus: effectiveStatus,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        upstreamMessage: msg,
        retryable: true,
        retryAfterSeconds,
        quotaMetrics,
        quotaIds,
        message: buildDisplayMessage(effectiveStatus, 'TPM Token Rate Limit', msg, retryAfterSeconds),
      };
    }

    const isRpm =
      /requests?[_ ]?per[_ ]?minute|requestsperminute|per[_ ]?minute|\brpm\b/i.test(combinedLower);
    if (isRpm) {
      return {
        code: 'GEMINI_QUOTA_RPM',
        quotaCategory: 'RPM',
        httpStatus: effectiveStatus,
        upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
        upstreamMessage: msg,
        retryable: true,
        retryAfterSeconds,
        quotaMetrics,
        quotaIds,
        message: buildDisplayMessage(effectiveStatus, 'RPM Rate Limit', msg, retryAfterSeconds),
      };
    }

    return {
      code: 'GEMINI_RATE_LIMIT',
      quotaCategory: 'GENERIC_RATE_LIMIT',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || 'RESOURCE_EXHAUSTED',
      upstreamMessage: msg,
      retryable: true,
      retryAfterSeconds,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(
        effectiveStatus,
        'Gemini Rate Limit / Quota',
        msg || 'Upstream HTTP 429 Too Many Requests returned without a detailed Google message.',
        retryAfterSeconds
      ),
    };
  }

  // 6. Temporary upstream overload / 503
  if (statusCode === 503 || /unavailable|overloaded|high demand/i.test(lower)) {
    const effectiveStatus = statusCode ?? 503;
    return {
      code: 'GEMINI_UNAVAILABLE',
      quotaCategory: 'NONE',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || 'UNAVAILABLE',
      upstreamMessage: msg,
      retryable: true,
      retryAfterSeconds,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(
        effectiveStatus,
        'Gemini Temporarily Unavailable',
        msg || 'Upstream service unavailable.',
        retryAfterSeconds
      ),
    };
  }

  // 7. Timeout
  if (statusCode === 504 || /timeout|timed out|aborted|deadline/i.test(lower)) {
    const effectiveStatus = statusCode ?? 504;
    return {
      code: 'GEMINI_TIMEOUT',
      quotaCategory: 'NONE',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || 'DEADLINE_EXCEEDED',
      upstreamMessage: msg,
      retryable: false,
      retryAfterSeconds: null,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(
        effectiveStatus,
        'Gemini Request Timeout',
        msg || 'Upstream request timed out.',
        null
      ),
    };
  }

  // 8. Bad request (400)
  if (statusCode === 400 || /invalid argument|context length/i.test(lower)) {
    const effectiveStatus = statusCode ?? 400;
    return {
      code: 'GEMINI_BAD_REQUEST',
      quotaCategory: 'NONE',
      httpStatus: effectiveStatus,
      upstreamStatus: upstreamStatus || 'INVALID_ARGUMENT',
      upstreamMessage: msg,
      retryable: false,
      retryAfterSeconds: null,
      quotaMetrics,
      quotaIds,
      message: buildDisplayMessage(
        effectiveStatus,
        'Invalid Request',
        msg || 'Gemini rejected the request payload.',
        null
      ),
    };
  }

  const effectiveStatus = statusCode ?? 500;
  return {
    code: 'GEMINI_ERROR',
    quotaCategory: 'NONE',
    httpStatus: effectiveStatus,
    upstreamStatus: upstreamStatus || 'INTERNAL',
    upstreamMessage: msg,
    retryable: false,
    retryAfterSeconds: null,
    quotaMetrics,
    quotaIds,
    message: buildDisplayMessage(
      effectiveStatus,
      'Gemini API Error',
      msg || 'Unexpected error communicating with Gemini API.',
      null
    ),
  };
}

