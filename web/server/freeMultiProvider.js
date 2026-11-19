import {
  classifyGeminiError,
  extractGeminiErrorDetails,
} from '../src/services/brainEngine.js';
import {
  createAllFreeModelsExhaustedError,
  DEFAULT_PRIMARY_MODEL,
  FREE_TIER_GEMINI_MODELS,
  isApprovedFreeTierModel,
  normalizeModelId,
} from './geminiModelFallback.js';

export const AI_PROVIDER_IDS = Object.freeze(['gemini', 'groq', 'openrouter']);
export const DEFAULT_PROVIDER_ORDER = Object.freeze(['gemini', 'groq', 'openrouter']);

export const PROVIDER_LABELS = Object.freeze({
  gemini: 'Google Gemini Free',
  groq: 'Groq Free API',
  openrouter: 'OpenRouter Free',
});

/**
 * Strict curated server-side allowlist of Groq Developer Free Plan open-weight chat models.
 * Audio/TTS/guard/enterprise/paid or unknown model IDs are strictly rejected.
 */
export const FREE_TIER_GROQ_MODELS = Object.freeze([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
]);

export const APPROVED_FREE_GROQ_MODEL_SET = new Set(FREE_TIER_GROQ_MODELS);

/**
 * Strict curated server-side allowlist of OpenRouter FREE-only text/reasoning models.
 * Every model MUST end with ":free" (or equal "openrouter/free") AND pass live $0 pricing verification
 * against OpenRouter's /api/v1/models catalog before a single request is permitted.
 */
export const FREE_TIER_OPENROUTER_MODELS = Object.freeze([
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'cohere/north-mini-code:free',
  'liquid/lfm-2.5-2.6b:free',
  'openrouter/free',
]);

/**
 * Strict curated OpenRouter FREE-only multimodal vision model (also requires live $0 pricing verification).
 */
export const FREE_TIER_OPENROUTER_VISION_MODELS = Object.freeze([
  'nvidia/nemotron-3.5-super-vl:free',
]);

export const APPROVED_FREE_OPENROUTER_MODEL_SET = new Set([
  ...FREE_TIER_OPENROUTER_MODELS,
  ...FREE_TIER_OPENROUTER_VISION_MODELS,
]);

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const CATALOG_CACHE_TTL_MS = 15 * 60 * 1000;
const CATALOG_TIMEOUT_MS = 3500;
const STREAM_TIMEOUT_MS = 55000;
const MIN_COOLDOWN_MS = 35 * 1000;
const MAX_COOLDOWN_MS = 15 * 60 * 1000;
const AUTH_ERROR_COOLDOWN_MS = 10 * 60 * 1000;
const BILLING_BLOCK_COOLDOWN_MS = 30 * 60 * 1000;
const UNAVAILABLE_COOLDOWN_MS = 30 * 60 * 1000;

const GROQ_BLOCKED_PATTERNS = [
  /whisper/i,
  /playai/i,
  /tts/i,
  /guard/i,
  /compound/i,
  /orpheus/i,
  /embedding/i,
];

const PLACEHOLDER_KEYS = new Set([
  '',
  'UNSET',
  'NONE',
  'MY_GEMINI_API_KEY',
  'MY_GROQ_API_KEY',
  'MY_OPENROUTER_API_KEY',
  'your_api_key_here',
  'your_groq_api_key_here',
  'your_openrouter_api_key_here',
]);

export function isConfiguredApiKey(rawKey) {
  const cleaned = String(rawKey || '').trim();
  if (!cleaned) return false;
  if (PLACEHOLDER_KEYS.has(cleaned)) return false;
  if (/^(?:your_|my_|placeholder|replace_me)/i.test(cleaned)) return false;
  return true;
}

export function normalizeProviderId(rawProvider) {
  const cleaned = String(rawProvider || '').trim().toLowerCase();
  if (cleaned === 'google' || cleaned === 'google-gemini' || cleaned === 'gemini') return 'gemini';
  if (cleaned === 'groq') return 'groq';
  if (cleaned === 'openrouter' || cleaned === 'open-router') return 'openrouter';
  return '';
}

export function resolveProviderOrder(rawOrder) {
  let items = [];
  if (Array.isArray(rawOrder)) {
    items = rawOrder;
  } else if (typeof rawOrder === 'string' && rawOrder.trim()) {
    items = rawOrder.split(',');
  }

  const order = [];
  const seen = new Set();
  for (const item of items) {
    const id = normalizeProviderId(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const fallbackId of DEFAULT_PROVIDER_ORDER) {
    if (!seen.has(fallbackId)) {
      seen.add(fallbackId);
      order.push(fallbackId);
    }
  }
  return order;
}

/**
 * Parses a price field from OpenRouter's /api/v1/models pricing object.
 * Returns a finite number, or NaN for unparseable/invalid values.
 */
export function parsePriceField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/**
 * Zero-cost pricing verification predicate.
 * Returns true ONLY when prompt and completion prices exist and are strictly 0,
 * and every other present fee field (request, image, web_search, etc.) is also strictly 0.
 * Fails closed on missing, negative, dynamic (-1), or non-numeric pricing.
 */
export function isPricingStrictlyZero(pricing) {
  if (!pricing || typeof pricing !== 'object') return false;
  const promptCost = parsePriceField(pricing.prompt);
  const completionCost = parsePriceField(pricing.completion);

  if (promptCost !== 0 || completionCost !== 0) {
    return false;
  }

  const auxiliaryFields = [
    'request',
    'image',
    'web_search',
    'internal_reasoning',
    'input_cache_read',
    'input_cache_write',
    'audio',
  ];

  for (const field of auxiliaryFields) {
    if (pricing[field] !== undefined && pricing[field] !== null) {
      const val = parsePriceField(pricing[field]);
      if (val !== 0) {
        return false;
      }
    }
  }

  return true;
}

export function isApprovedFreeGroqModel(rawModel) {
  const cleaned = String(rawModel || '').trim();
  if (!cleaned) return false;
  if (GROQ_BLOCKED_PATTERNS.some((pattern) => pattern.test(cleaned))) return false;
  return APPROVED_FREE_GROQ_MODEL_SET.has(cleaned);
}

export function isApprovedFreeOpenRouterModel(rawModel) {
  const cleaned = String(rawModel || '').trim();
  if (!cleaned) return false;
  const hasFreeSuffixOrRouter = cleaned === 'openrouter/free' || cleaned.endsWith(':free');
  if (!hasFreeSuffixOrRouter) return false;
  return APPROVED_FREE_OPENROUTER_MODEL_SET.has(cleaned);
}

/**
 * Unified server-side zero-cost allowlist validator across all three providers.
 */
export function isApprovedFreeModelForProvider(provider, rawModel) {
  const normalizedProvider = normalizeProviderId(provider);
  if (normalizedProvider === 'gemini') {
    return isApprovedFreeTierModel(rawModel);
  }
  if (normalizedProvider === 'groq') {
    return isApprovedFreeGroqModel(rawModel);
  }
  if (normalizedProvider === 'openrouter') {
    return isApprovedFreeOpenRouterModel(rawModel);
  }
  return false;
}

/**
 * Hard pre-flight security gate invoked before ANY outbound provider API call.
 * Guarantees no paid, unapproved, or unverified-pricing model can ever be requested.
 */
export function assertZeroCostModelAllowed(provider, modelId, { pricingVerified = true } = {}) {
  const normalizedProvider = normalizeProviderId(provider);
  if (!normalizedProvider) {
    const err = new Error(`Rejected unsupported AI provider "${provider}". Only free-tier Gemini, Groq, and OpenRouter are permitted.`);
    err.status = 400;
    err.code = 'PAID_OR_UNKNOWN_MODEL_REJECTED';
    throw err;
  }

  if (!isApprovedFreeModelForProvider(normalizedProvider, modelId)) {
    const err = new Error(
      `Zero-cost security guard rejected model "${modelId}" for provider "${normalizedProvider}". Only strictly allowlisted FREE models are permitted.`
    );
    err.status = 400;
    err.code = 'PAID_OR_UNKNOWN_MODEL_REJECTED';
    throw err;
  }

  if (normalizedProvider === 'openrouter' && !pricingVerified) {
    const err = new Error(
      `Zero-cost security guard blocked OpenRouter model "${modelId}" because live $0 pricing could not be verified.`
    );
    err.status = 403;
    err.code = 'UNVERIFIED_PRICING_REJECTED';
    throw err;
  }
}

export function parseAllowlistedModels(rawList, defaultList, validatorFn) {
  let items = null;
  if (Array.isArray(rawList)) {
    items = rawList.map((m) => String(m || '').trim()).filter(Boolean);
  } else if (typeof rawList === 'string' && rawList.trim()) {
    items = rawList
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }

  const source = items !== null ? items : [...defaultList];
  const allowed = [];
  const rejected = [];
  const seen = new Set();

  for (const candidate of source) {
    if (!candidate || seen.has(candidate)) continue;
    if (!validatorFn(candidate)) {
      rejected.push(candidate);
      continue;
    }
    seen.add(candidate);
    allowed.push(candidate);
  }

  return { allowed, rejected };
}

/**
 * Builds OpenAI-compatible chat messages preserving full system instruction,
 * multi-turn conversation history, and optional image data URL across provider switches.
 */
export function buildOpenAiMessages({
  systemInstruction = '',
  history = [],
  prompt = '',
  imageAttachment = null,
}) {
  const messages = [];
  const cleanSystem = String(systemInstruction || '').trim();
  if (cleanSystem) {
    messages.push({ role: 'system', content: cleanSystem });
  }

  if (Array.isArray(history)) {
    for (const item of history.slice(-16)) {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
      const role =
        item.role === 'model' || item.role === 'jarvis' || item.role === 'assistant'
          ? 'assistant'
          : 'user';
      const text = item.text.trim();
      const prev = messages[messages.length - 1];
      if (prev && prev.role === role && typeof prev.content === 'string') {
        prev.content = `${prev.content}\n\n${text}`;
      } else {
        messages.push({ role, content: text });
      }
    }
  }

  const cleanPrompt = String(prompt || '').trim();
  if (imageAttachment && imageAttachment.cleanBase64 && imageAttachment.mimeType) {
    const dataUrl = `data:${imageAttachment.mimeType};base64,${imageAttachment.cleanBase64}`;
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: cleanPrompt || 'Analyze this image accurately.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    });
  } else if (cleanPrompt) {
    const prev = messages[messages.length - 1];
    if (prev && prev.role === 'user' && typeof prev.content === 'string') {
      prev.content = `${prev.content}\n\n${cleanPrompt}`;
    } else {
      messages.push({ role: 'user', content: cleanPrompt });
    }
  }

  return messages;
}

function parseRetryAfterHeaderSeconds(headers) {
  if (!headers || typeof headers.get !== 'function') return null;
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const numeric = Number(retryAfter);
    if (Number.isFinite(numeric) && numeric > 0) return Math.ceil(numeric);
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      const diffSec = Math.ceil((dateMs - Date.now()) / 1000);
      if (diffSec > 0) return diffSec;
    }
  }

  // Groq returns headers such as x-ratelimit-reset-requests: "1m12s" or "42.5s"
  const resetHeader =
    headers.get('x-ratelimit-reset-requests') || headers.get('x-ratelimit-reset-tokens');
  if (resetHeader) {
    let totalSec = 0;
    const minMatch = resetHeader.match(/(\d+(?:\.\d+)?)m(?!s)/i);
    const secMatch = resetHeader.match(/(\d+(?:\.\d+)?)s/i);
    if (minMatch) totalSec += Number(minMatch[1]) * 60;
    if (secMatch) totalSec += Number(secMatch[1]);
    if (totalSec > 0 && Number.isFinite(totalSec)) {
      return Math.ceil(totalSec);
    }
  }
  return null;
}

function extractOpenAiErrorMessage(rawBody, fallbackStatus) {
  try {
    const parsed = JSON.parse(rawBody);
    const msg =
      parsed?.error?.message ||
      parsed?.message ||
      (typeof parsed?.error === 'string' ? parsed.error : '');
    if (msg) return String(msg).slice(0, 400);
  } catch {
    // plain text body
  }
  return String(rawBody || `Upstream provider returned HTTP ${fallbackStatus}`).slice(0, 400);
}

export function classifyOpenAiProviderError(provider, httpStatus, rawBody, headers = null) {
  const message = extractOpenAiErrorMessage(rawBody, httpStatus);
  const retryAfterSeconds = parseRetryAfterHeaderSeconds(headers);
  const lower = message.toLowerCase();

  if (httpStatus === 429) {
    const isDaily = /per day|daily|rpd|day limit|free-models-per-day/i.test(lower);
    return {
      provider,
      httpStatus: 429,
      code: isDaily ? 'PROVIDER_QUOTA_RPD' : 'PROVIDER_RATE_LIMIT',
      quotaCategory: isDaily ? 'RPD' : 'RPM',
      retryable: true,
      switchable: true,
      retryAfterSeconds: retryAfterSeconds || (isDaily ? 900 : 45),
      upstreamMessage: message,
      message: `${PROVIDER_LABELS[provider] || provider} reached its free rate/quota limit (HTTP 429).`,
    };
  }

  if (httpStatus === 402 || /insufficient credits|payment required|add credits|paid tier/i.test(lower)) {
    return {
      provider,
      httpStatus: httpStatus || 402,
      code: 'PROVIDER_BILLING_REQUIRED',
      quotaCategory: 'BILLING',
      retryable: false,
      switchable: true,
      retryAfterSeconds: 1800,
      upstreamMessage: message,
      message: `${PROVIDER_LABELS[provider] || provider} requested paid credits; blocked by ₹0 zero-cost guard.`,
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      provider,
      httpStatus,
      code: 'PROVIDER_AUTH_ERROR',
      quotaCategory: 'NONE',
      retryable: false,
      switchable: true,
      retryAfterSeconds: 600,
      upstreamMessage: message,
      message: `${PROVIDER_LABELS[provider] || provider} API key was rejected (HTTP ${httpStatus}).`,
    };
  }

  if (
    httpStatus === 404 ||
    httpStatus === 410 ||
    /model.*not found|decommissioned|no endpoints found|does not exist/i.test(lower)
  ) {
    return {
      provider,
      httpStatus: httpStatus || 404,
      code: 'PROVIDER_MODEL_UNAVAILABLE',
      quotaCategory: 'NONE',
      retryable: false,
      switchable: true,
      retryAfterSeconds: 1800,
      upstreamMessage: message,
      message: `${PROVIDER_LABELS[provider] || provider} model is currently unavailable.`,
    };
  }

  if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 529) {
    return {
      provider,
      httpStatus,
      code: 'PROVIDER_UNAVAILABLE',
      quotaCategory: 'NONE',
      retryable: true,
      switchable: true,
      retryAfterSeconds: retryAfterSeconds || 40,
      upstreamMessage: message,
      message: `${PROVIDER_LABELS[provider] || provider} is temporarily overloaded (HTTP ${httpStatus}).`,
    };
  }

  return {
    provider,
    httpStatus: httpStatus || 500,
    code: httpStatus === 400 ? 'PROVIDER_BAD_REQUEST' : 'PROVIDER_ERROR',
    quotaCategory: 'NONE',
    retryable: false,
    switchable: httpStatus !== 400,
    retryAfterSeconds: null,
    upstreamMessage: message,
    message,
  };
}

function formatWaitText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'a few moments';
  if (seconds < 90) return `about ${Math.max(15, Math.ceil(seconds))} seconds`;
  const mins = Math.ceil(seconds / 60);
  return `about ${mins} minute${mins === 1 ? '' : 's'}`;
}

export function createAllFreeProvidersUnavailableError({
  attemptedProviders = [],
  attemptedModels = [],
  retryAfterSeconds = 60,
  totalAttempts = 0,
  lastUpstreamMessage = '',
}) {
  const providerList = attemptedProviders
    .map((p) => PROVIDER_LABELS[p] || p)
    .join(', ');
  const waitText = formatWaitText(retryAfterSeconds);
  const message =
    `All free AI providers (${providerList || 'Google Gemini Free, Groq Free API, OpenRouter Free'}) are temporarily unavailable or have reached their free tier limits. ` +
    `JARVIS enforces a strict ₹0 zero-cost guard and will never switch to paid models or activate billing. ` +
    `Please try again in ${waitText}.`;

  const err = new Error(message);
  err.status = 429;
  err.code = 'ALL_FREE_MODELS_EXHAUSTED';
  err.allModelsExhausted = true;
  err.allProvidersExhausted = true;
  err.attemptedProviders = [...attemptedProviders];
  err.attemptedModels = [...attemptedModels];
  err.attemptsMade = Math.max(1, totalAttempts);
  err.geminiDetails = {
    httpStatus: 429,
    upstreamStatus: 'RESOURCE_EXHAUSTED',
    upstreamMessage: lastUpstreamMessage || message,
    retryAfterSeconds: Math.max(15, Math.ceil(retryAfterSeconds || 60)),
    quotaMetrics: [],
    quotaIds: [],
    quotaValues: [],
    errorReason: 'ALL_FREE_MODELS_EXHAUSTED',
  };
  err.geminiClassified = {
    code: 'ALL_FREE_MODELS_EXHAUSTED',
    quotaCategory: 'RPD',
    httpStatus: 429,
    upstreamStatus: 'RESOURCE_EXHAUSTED',
    upstreamMessage: lastUpstreamMessage || message,
    retryable: true,
    retryAfterSeconds: Math.max(15, Math.ceil(retryAfterSeconds || 60)),
    quotaMetrics: [],
    quotaIds: [],
    message,
  };
  return err;
}

async function fetchJsonWithTimeout(fetchImpl, url, init = {}, timeoutMs = CATALOG_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url, { ...init, signal: controller.signal });
    const rawText = await resp.text();
    let json = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      json = null;
    }
    return { ok: resp.ok, status: resp.status, headers: resp.headers, json, rawText };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Queries OpenRouter /api/v1/models and verifies strictly $0 pricing for allowlisted :free models.
 * Fails closed: any model with non-zero, missing, or unverified pricing is strictly excluded.
 */
export async function verifyOpenRouterFreeCatalog(fetchImpl, apiKey, appReferer = 'https://jarvis-ai.local') {
  const headers = {
    Accept: 'application/json',
    'HTTP-Referer': appReferer,
    'X-Title': 'JARVIS AI',
  };
  if (isConfiguredApiKey(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const resp = await fetchJsonWithTimeout(
      fetchImpl,
      `${OPENROUTER_BASE_URL}/models`,
      { method: 'GET', headers },
      CATALOG_TIMEOUT_MS
    );

    if (!resp.ok || !Array.isArray(resp.json?.data)) {
      return {
        ok: false,
        status: resp.status,
        verifiedModels: new Map(),
        rejectedNonZeroModels: [],
      };
    }

    const verifiedModels = new Map();
    const rejectedNonZeroModels = [];

    for (const entry of resp.json.data) {
      const id = String(entry?.id || '').trim();
      if (!id || !isApprovedFreeOpenRouterModel(id)) continue;

      if (isPricingStrictlyZero(entry.pricing)) {
        verifiedModels.set(id, {
          id,
          pricingVerified: true,
          pricing: entry.pricing,
          contextLength: entry.context_length || null,
        });
      } else {
        rejectedNonZeroModels.push(id);
      }
    }

    return {
      ok: true,
      status: resp.status,
      verifiedModels,
      rejectedNonZeroModels,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      verifiedModels: new Map(),
      rejectedNonZeroModels: [],
    };
  }
}

/**
 * Queries Groq /openai/v1/models to verify which allowlisted free models are currently active.
 */
export async function verifyGroqFreeCatalog(fetchImpl, apiKey) {
  if (!isConfiguredApiKey(apiKey)) {
    return { ok: false, status: 401, activeModels: null };
  }
  try {
    const resp = await fetchJsonWithTimeout(
      fetchImpl,
      `${GROQ_BASE_URL}/models`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
      CATALOG_TIMEOUT_MS
    );

    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, status: resp.status, authError: true, activeModels: new Set() };
    }
    if (!resp.ok || !Array.isArray(resp.json?.data)) {
      return { ok: false, status: resp.status, activeModels: null };
    }

    const activeModels = new Set();
    for (const entry of resp.json.data) {
      const id = String(entry?.id || '').trim();
      if (!id || entry.active === false) continue;
      if (isApprovedFreeGroqModel(id)) {
        activeModels.add(id);
      }
    }
    return { ok: true, status: resp.status, activeModels };
  } catch {
    return { ok: false, status: 0, activeModels: null };
  }
}

function buildProviderHeaders(provider, apiKey, appReferer) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = appReferer || 'https://jarvis-ai.local';
    headers['X-Title'] = 'JARVIS AI';
  }
  return headers;
}

function getProviderChatCompletionsUrl(provider) {
  if (provider === 'groq') return `${GROQ_BASE_URL}/chat/completions`;
  if (provider === 'openrouter') return `${OPENROUTER_BASE_URL}/chat/completions`;
  throw new Error(`Unsupported OpenAI-compatible provider: ${provider}`);
}

async function callOpenAiCompatibleStream({
  fetchImpl,
  provider,
  apiKey,
  modelId,
  pricingVerified,
  messages,
  temperature = 0.7,
  maxTokens = 4096,
  appReferer = 'https://jarvis-ai.local',
  isAborted = () => false,
  onBeforeFirstChunk = null,
  onTextChunk = null,
}) {
  assertZeroCostModelAllowed(provider, modelId, { pricingVerified });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  const payload = {
    model: modelId,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  try {
    const resp = await fetchImpl(getProviderChatCompletionsUrl(provider), {
      method: 'POST',
      headers: buildProviderHeaders(provider, apiKey, appReferer),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      const classified = classifyOpenAiProviderError(provider, resp.status, errBody, resp.headers);
      const err = new Error(classified.message);
      err.providerClassified = classified;
      throw err;
    }

    if (!resp.body || typeof resp.body.getReader !== 'function') {
      // Fallback if mock fetch returned plain JSON without readable stream
      const textBody = await resp.text();
      const parsed = JSON.parse(textBody);
      const content = String(parsed?.choices?.[0]?.message?.content || '');
      if (content) {
        if (typeof onBeforeFirstChunk === 'function') onBeforeFirstChunk();
        if (typeof onTextChunk === 'function') onTextChunk(content);
      }
      return { text: content, emittedChunks: content ? 1 : 0 };
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';
    let emittedChunks = 0;
    let announced = false;

    const processLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) return false;
      if (!line.startsWith('data:')) return false;
      const dataStr = line.slice(5).trim();
      if (!dataStr) return false;
      if (dataStr === '[DONE]') return true;

      try {
        const parsed = JSON.parse(dataStr);
        if (parsed?.error) {
          const errMsg = parsed.error.message || JSON.stringify(parsed.error);
          const errStatus = Number(parsed.error.code) || 500;
          const classified = classifyOpenAiProviderError(provider, errStatus, errMsg);
          const streamErr = new Error(classified.message);
          streamErr.providerClassified = classified;
          throw streamErr;
        }

        const delta = parsed?.choices?.[0]?.delta;
        const chunkText = typeof delta?.content === 'string' ? delta.content : '';
        if (chunkText) {
          if (!announced) {
            announced = true;
            if (typeof onBeforeFirstChunk === 'function') onBeforeFirstChunk();
          }
          emittedChunks += 1;
          accumulated += chunkText;
          if (typeof onTextChunk === 'function') onTextChunk(chunkText);
        }
      } catch (parseErr) {
        if (parseErr?.providerClassified) throw parseErr;
        // Ignore partial non-JSON keepalive comments
      }
      return false;
    };

    while (true) {
      if (isAborted()) {
        controller.abort();
        break;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      let sawDone = false;
      for (const line of lines) {
        if (processLine(line)) {
          sawDone = true;
          break;
        }
      }
      if (sawDone) break;
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (processLine(line)) break;
      }
    }

    return { text: accumulated, emittedChunks };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiCompatibleGenerate({
  fetchImpl,
  provider,
  apiKey,
  modelId,
  pricingVerified,
  messages,
  temperature = 0.3,
  maxTokens = 2048,
  responseJson = false,
  appReferer = 'https://jarvis-ai.local',
}) {
  assertZeroCostModelAllowed(provider, modelId, { pricingVerified });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  const buildBody = (includeJsonFormat) => {
    const body = {
      model: modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };
    if (includeJsonFormat) {
      body.response_format = { type: 'json_object' };
    }
    return body;
  };

  try {
    let includeJson = Boolean(responseJson);
    for (let step = 0; step < 2; step++) {
      const resp = await fetchImpl(getProviderChatCompletionsUrl(provider), {
        method: 'POST',
        headers: buildProviderHeaders(provider, apiKey, appReferer),
        body: JSON.stringify(buildBody(includeJson)),
        signal: controller.signal,
      });

      const rawText = await resp.text().catch(() => '');
      if (!resp.ok) {
        if (
          includeJson &&
          resp.status === 400 &&
          /response_format|json_object|json/i.test(rawText)
        ) {
          includeJson = false;
          continue;
        }
        const classified = classifyOpenAiProviderError(provider, resp.status, rawText, resp.headers);
        const err = new Error(classified.message);
        err.providerClassified = classified;
        throw err;
      }

      const parsed = JSON.parse(rawText);
      const text = String(parsed?.choices?.[0]?.message?.content || '').trim();
      return { text };
    }
    return { text: '' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Creates the unified FREE-ONLY Multi-Provider AI Router coordinating:
 *  1. Google Gemini Free Tier (via existing geminiFallbackManager)
 *  2. Groq Free API (strict open-weight allowlist + catalog check)
 *  3. OpenRouter Free API (strict :free allowlist + mandatory live $0 pricing verification)
 */
export function createFreeMultiProviderRouter({
  geminiFallbackManager,
  getGeminiClient = () => null,
  getGroqApiKey = () => '',
  getOpenRouterApiKey = () => '',
  configuredProviderOrder = null,
  configuredGroqModels = null,
  configuredOpenRouterModels = null,
  fetchImpl = fetch,
  nowFn = Date.now,
  appReferer = 'https://jarvis-ai.local',
} = {}) {
  const groqParsed = parseAllowlistedModels(
    configuredGroqModels,
    FREE_TIER_GROQ_MODELS,
    isApprovedFreeGroqModel
  );
  const openRouterParsed = parseAllowlistedModels(
    configuredOpenRouterModels,
    FREE_TIER_OPENROUTER_MODELS,
    isApprovedFreeOpenRouterModel
  );

  const modelStates = new Map();
  let groqCatalogCache = { fetchedAt: 0, verified: false, activeModels: null, authError: false };
  let openRouterCatalogCache = {
    fetchedAt: 0,
    verified: false,
    verifiedModels: new Map(),
    rejectedNonZeroModels: [],
  };

  const providerOrder = resolveProviderOrder(configuredProviderOrder);

  let lastActiveProvider = 'gemini';
  let lastActiveModel =
    geminiFallbackManager?.getChainInfo?.().primaryModel || DEFAULT_PRIMARY_MODEL;
  let totalProviderSwitches = 0;

  function stateKey(provider, modelId) {
    return `${provider}:${modelId}`;
  }

  function getOrCreateModelState(provider, modelId) {
    const key = stateKey(provider, modelId);
    if (!modelStates.has(key)) {
      modelStates.set(key, {
        provider,
        model: modelId,
        status: 'available',
        cooldownUntilMs: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastUpdatedAt: 0,
      });
    }
    return modelStates.get(key);
  }

  function refreshModelState(state, now) {
    if (state.cooldownUntilMs > 0 && now >= state.cooldownUntilMs) {
      state.status = 'available';
      state.cooldownUntilMs = 0;
    }
    return state;
  }

  function isProviderModelCoolingDown(provider, modelId) {
    const now = nowFn();
    const state = refreshModelState(getOrCreateModelState(provider, modelId), now);
    return state.cooldownUntilMs > now;
  }

  function getProviderModelCooldownSeconds(provider, modelId) {
    const now = nowFn();
    const state = refreshModelState(getOrCreateModelState(provider, modelId), now);
    const rem = state.cooldownUntilMs - now;
    return rem > 0 ? Math.ceil(rem / 1000) : 0;
  }

  function recordProviderModelSuccess(provider, modelId) {
    const now = nowFn();
    const state = getOrCreateModelState(provider, modelId);
    state.status = 'available';
    state.cooldownUntilMs = 0;
    state.lastErrorCode = null;
    state.lastErrorMessage = null;
    state.lastUpdatedAt = now;
    lastActiveProvider = provider;
    lastActiveModel = modelId;
  }

  function recordProviderModelError(provider, modelId, classified) {
    const now = nowFn();
    const state = getOrCreateModelState(provider, modelId);
    state.lastErrorCode = classified?.code || 'PROVIDER_ERROR';
    state.lastErrorMessage = String(classified?.upstreamMessage || classified?.message || '').slice(0, 260);
    state.lastUpdatedAt = now;

    if (classified?.code === 'PROVIDER_BILLING_REQUIRED') {
      state.status = 'billing_blocked';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + BILLING_BLOCK_COOLDOWN_MS);
      return;
    }
    if (classified?.code === 'PROVIDER_AUTH_ERROR') {
      state.status = 'auth_error';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + AUTH_ERROR_COOLDOWN_MS);
      return;
    }
    if (classified?.code === 'PROVIDER_MODEL_UNAVAILABLE') {
      state.status = 'unavailable';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + UNAVAILABLE_COOLDOWN_MS);
      return;
    }
    if (classified?.code === 'PROVIDER_QUOTA_RPD') {
      const retryMs = (classified.retryAfterSeconds || 900) * 1000;
      state.status = 'rpd_exhausted';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + Math.max(MAX_COOLDOWN_MS, retryMs));
      return;
    }

    const retryMs = (classified?.retryAfterSeconds || 45) * 1000;
    const clampedMs = Math.min(MAX_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, retryMs));
    state.status = 'cooldown';
    state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + clampedMs);
  }

  function isGeminiConfigured() {
    return Boolean(getGeminiClient());
  }

  function isGroqConfigured() {
    return isConfiguredApiKey(getGroqApiKey()) && groqParsed.allowed.length > 0;
  }

  function isOpenRouterConfigured() {
    return isConfiguredApiKey(getOpenRouterApiKey()) && openRouterParsed.allowed.length > 0;
  }

  function getConfiguredProviders() {
    return providerOrder.filter((id) => {
      if (id === 'gemini') return isGeminiConfigured();
      if (id === 'groq') return isGroqConfigured();
      if (id === 'openrouter') return isOpenRouterConfigured();
      return false;
    });
  }

  function hasAnyConfiguredProvider() {
    return getConfiguredProviders().length > 0;
  }

  function getPrimaryProviderAndModel() {
    const configured = getConfiguredProviders();
    const primaryProvider = configured[0] || providerOrder[0] || 'gemini';
    if (primaryProvider === 'gemini') {
      return {
        primaryProvider: 'gemini',
        primaryModel:
          geminiFallbackManager?.getChainInfo?.().primaryModel || DEFAULT_PRIMARY_MODEL,
      };
    }
    if (primaryProvider === 'groq') {
      return {
        primaryProvider: 'groq',
        primaryModel: groqParsed.allowed[0] || FREE_TIER_GROQ_MODELS[0],
      };
    }
    return {
      primaryProvider: 'openrouter',
      primaryModel: openRouterParsed.allowed[0] || FREE_TIER_OPENROUTER_MODELS[0],
    };
  }

  async function ensureGroqCatalogFresh() {
    const now = nowFn();
    if (groqCatalogCache.fetchedAt > 0 && now - groqCatalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
      return groqCatalogCache;
    }
    const res = await verifyGroqFreeCatalog(fetchImpl, getGroqApiKey());
    groqCatalogCache = {
      fetchedAt: nowFn(),
      verified: res.ok,
      activeModels: res.activeModels,
      authError: Boolean(res.authError),
    };
    return groqCatalogCache;
  }

  async function ensureOpenRouterCatalogFresh() {
    const now = nowFn();
    if (
      openRouterCatalogCache.fetchedAt > 0 &&
      now - openRouterCatalogCache.fetchedAt < CATALOG_CACHE_TTL_MS
    ) {
      return openRouterCatalogCache;
    }
    const res = await verifyOpenRouterFreeCatalog(fetchImpl, getOpenRouterApiKey(), appReferer);
    openRouterCatalogCache = {
      fetchedAt: nowFn(),
      verified: res.ok,
      verifiedModels: res.verifiedModels,
      rejectedNonZeroModels: res.rejectedNonZeroModels,
    };
    return openRouterCatalogCache;
  }

  async function getGroqCandidateModels() {
    const catalog = await ensureGroqCatalogFresh();
    if (catalog.authError) {
      for (const m of groqParsed.allowed) {
        recordProviderModelError('groq', m, {
          code: 'PROVIDER_AUTH_ERROR',
          upstreamMessage: 'Groq API key authentication failed during model catalog verification.',
        });
      }
      return [];
    }
    if (catalog.verified && catalog.activeModels && catalog.activeModels.size > 0) {
      return groqParsed.allowed.filter(
        (m) => catalog.activeModels.has(m) && !isProviderModelCoolingDown('groq', m)
      );
    }
    return groqParsed.allowed.filter((m) => !isProviderModelCoolingDown('groq', m));
  }

  async function getOpenRouterCandidateModels({ requireVision = false } = {}) {
    const catalog = await ensureOpenRouterCatalogFresh();
    // STRICT FAIL-CLOSED ZERO-COST POLICY: never enable OpenRouter models without verified $0 pricing!
    if (!catalog.verified || catalog.verifiedModels.size === 0) {
      return [];
    }

    const baseCandidates = requireVision
      ? [...FREE_TIER_OPENROUTER_VISION_MODELS]
      : [...openRouterParsed.allowed];

    return baseCandidates.filter((m) => {
      if (isProviderModelCoolingDown('openrouter', m)) return false;
      const entry = catalog.verifiedModels.get(m);
      return Boolean(entry && entry.pricingVerified === true);
    });
  }

  function isAllProvidersCoolingDown() {
    const configured = getConfiguredProviders();
    if (configured.length === 0) return false;
    return configured.every((provider) => {
      if (provider === 'gemini') {
        return Boolean(geminiFallbackManager?.isAllModelsOnCooldown?.());
      }
      if (provider === 'groq') {
        return groqParsed.allowed.every((m) => isProviderModelCoolingDown('groq', m));
      }
      if (provider === 'openrouter') {
        return openRouterParsed.allowed.every((m) => isProviderModelCoolingDown('openrouter', m));
      }
      return true;
    });
  }

  function computeShortestCooldownSecondsAcrossProviders(providersToCheck) {
    const waits = [];
    for (const provider of providersToCheck) {
      if (provider === 'gemini' && geminiFallbackManager) {
        const status = geminiFallbackManager.getPoolStatus();
        if (status.shortestCooldownSeconds > 0) waits.push(status.shortestCooldownSeconds);
      } else if (provider === 'groq') {
        for (const m of groqParsed.allowed) {
          const sec = getProviderModelCooldownSeconds('groq', m);
          if (sec > 0) waits.push(sec);
        }
      } else if (provider === 'openrouter') {
        for (const m of openRouterParsed.allowed) {
          const sec = getProviderModelCooldownSeconds('openrouter', m);
          if (sec > 0) waits.push(sec);
        }
      }
    }
    return waits.length > 0 ? Math.min(...waits) : 60;
  }

  function shouldFailoverFromGeminiError(err, hasOtherProviders, hasEmittedOutput) {
    if (!hasOtherProviders || hasEmittedOutput) return false;
    const details = err?.geminiDetails || extractGeminiErrorDetails(err);
    const classified =
      err?.geminiClassified ||
      classifyGeminiError(details.httpStatus, details.upstreamMessage, details);
    if (err?.allModelsExhausted || classified.code === 'ALL_FREE_MODELS_EXHAUSTED') return true;
    if (classified.code === 'GEMINI_BAD_REQUEST') return false;
    if (
      classified.httpStatus === 429 ||
      classified.code === 'GEMINI_QUOTA_RPM' ||
      classified.code === 'GEMINI_QUOTA_TPM' ||
      classified.code === 'GEMINI_QUOTA_RPD' ||
      classified.code === 'GEMINI_QUOTA_BILLING' ||
      classified.code === 'GEMINI_QUOTA_SPEND_CAP' ||
      classified.code === 'GEMINI_RATE_LIMIT' ||
      classified.code === 'GEMINI_UNAVAILABLE' ||
      classified.code === 'GEMINI_MODEL_NOT_FOUND' ||
      classified.code === 'GEMINI_AUTH_ERROR' ||
      classified.code === 'GEMINI_TIMEOUT'
    ) {
      return true;
    }
    return false;
  }

  async function executeStream({
    geminiRunner = null,
    systemInstruction = '',
    history = [],
    prompt = '',
    imageAttachment = null,
    allowNonGeminiFallback = true,
    temperature = 0.7,
    maxOutputTokens = 4096,
    isAborted = () => false,
    hasEmittedOutput = () => false,
    onProviderSwitch = null,
    onBeforeProviderOutput = null,
    onTextChunk = null,
  }) {
    const configuredProviders = getConfiguredProviders();
    const eligibleProviders = configuredProviders.filter((provider) => {
      if (provider === 'gemini') return typeof geminiRunner === 'function';
      if (!allowNonGeminiFallback) return false;
      // Groq text models cannot accept binary image attachments directly
      if (provider === 'groq' && imageAttachment) return false;
      return true;
    });

    if (eligibleProviders.length === 0) {
      const err = new Error(
        'No free AI provider API key is configured on the server. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in server environment variables.'
      );
      err.status = 424;
      err.code = 'MISSING_API_KEY';
      throw err;
    }

    const { primaryProvider, primaryModel } = getPrimaryProviderAndModel();
    const attemptedProviders = [];
    const attemptedModels = [];
    let totalAttempts = 0;
    let lastError = null;
    let lastUpstreamMessage = '';

    for (let pIdx = 0; pIdx < eligibleProviders.length; pIdx++) {
      const provider = eligibleProviders[pIdx];
      if (isAborted()) break;
      const hasMoreProviders = pIdx < eligibleProviders.length - 1;

      if (provider === 'gemini') {
        attemptedProviders.push('gemini');
        try {
          const outcome = await geminiRunner();
          lastActiveProvider = 'gemini';
          lastActiveModel = outcome.modelUsed;
          const switchedProvider = provider !== primaryProvider;
          if (switchedProvider) totalProviderSwitches += 1;
          return {
            provider: 'gemini',
            providerLabel: PROVIDER_LABELS.gemini,
            modelUsed: outcome.modelUsed,
            primaryProvider,
            primaryModel,
            fallbackUsed: Boolean(outcome.fallbackUsed || switchedProvider),
            switchedFromProvider: switchedProvider ? primaryProvider : null,
            switchedFrom: outcome.switchedFrom || (switchedProvider ? primaryModel : null),
            attemptedProviders,
            attemptedModels: [...attemptedModels, ...(outcome.attemptedModels || [outcome.modelUsed])],
            result: outcome.result,
          };
        } catch (err) {
          lastError = err;
          totalAttempts += Number.isFinite(err?.attemptsMade) ? err.attemptsMade : 1;
          if (Array.isArray(err?.attemptedModels)) {
            attemptedModels.push(...err.attemptedModels);
          }
          lastUpstreamMessage = err?.geminiDetails?.upstreamMessage || err?.message || '';

          if (shouldFailoverFromGeminiError(err, hasMoreProviders, hasEmittedOutput())) {
            const nextProvider = eligibleProviders[pIdx + 1];
            console.warn(
              `[JARVIS Multi-Provider Free Switch] Provider "gemini" unavailable/exhausted (${err?.code || err?.geminiClassified?.code || 'ERROR'}). Switching automatically to free provider "${nextProvider}".`
            );
            if (typeof onProviderSwitch === 'function') {
              onProviderSwitch({
                fromProvider: 'gemini',
                toProvider: nextProvider,
                reason: err?.code || err?.geminiClassified?.code || 'QUOTA_EXHAUSTED',
              });
            }
            continue;
          }
          // Single-provider Gemini mode or non-switchable error -> rethrow original Gemini error intact!
          throw err;
        }
      }

      if (provider === 'groq' || provider === 'openrouter') {
        attemptedProviders.push(provider);
        const candidates =
          provider === 'groq'
            ? await getGroqCandidateModels()
            : await getOpenRouterCandidateModels({ requireVision: Boolean(imageAttachment) });

        if (candidates.length === 0) {
          if (provider === 'openrouter' && openRouterCatalogCache.rejectedNonZeroModels.length > 0) {
            lastUpstreamMessage =
              'OpenRouter free models rejected by ₹0 pricing guard (non-zero pricing detected).';
          } else {
            lastUpstreamMessage = `${PROVIDER_LABELS[provider]} has no ready verified free models right now.`;
          }
          continue;
        }

        const apiKey = provider === 'groq' ? getGroqApiKey().trim() : getOpenRouterApiKey().trim();
        const messages = buildOpenAiMessages({
          systemInstruction,
          history,
          prompt,
          imageAttachment: provider === 'openrouter' ? imageAttachment : null,
        });

        for (const candidateModel of candidates) {
          if (isAborted()) break;
          attemptedModels.push(`${provider}:${candidateModel}`);
          totalAttempts += 1;

          const pricingVerified =
            provider === 'groq'
              ? isApprovedFreeGroqModel(candidateModel)
              : Boolean(openRouterCatalogCache.verifiedModels.get(candidateModel)?.pricingVerified);

          try {
            const switchedProvider = provider !== primaryProvider;
            const switchedModel = switchedProvider || candidateModel !== primaryModel;
            const streamRes = await callOpenAiCompatibleStream({
              fetchImpl,
              provider,
              apiKey,
              modelId: candidateModel,
              pricingVerified,
              messages,
              temperature,
              maxTokens: maxOutputTokens,
              appReferer,
              isAborted,
              onBeforeFirstChunk: () => {
                if (typeof onBeforeProviderOutput === 'function') {
                  onBeforeProviderOutput({
                    provider,
                    providerLabel: PROVIDER_LABELS[provider],
                    model: candidateModel,
                    primaryProvider,
                    primaryModel,
                    fallbackUsed: switchedModel,
                    switchedFromProvider: switchedProvider ? primaryProvider : null,
                    switchedFrom: switchedModel ? primaryModel : null,
                  });
                }
              },
              onTextChunk,
            });

            recordProviderModelSuccess(provider, candidateModel);
            if (switchedProvider) totalProviderSwitches += 1;

            return {
              provider,
              providerLabel: PROVIDER_LABELS[provider],
              modelUsed: candidateModel,
              primaryProvider,
              primaryModel,
              fallbackUsed: switchedModel,
              switchedFromProvider: switchedProvider ? primaryProvider : null,
              switchedFrom: switchedModel ? primaryModel : null,
              attemptedProviders,
              attemptedModels,
              result: {
                text: streamRes.text,
                collectedSources: new Map(),
                modelUsed: candidateModel,
              },
            };
          } catch (providerErr) {
            lastError = providerErr;
            const classified =
              providerErr?.providerClassified ||
              classifyOpenAiProviderError(provider, 500, providerErr?.message || 'Provider error');
            lastUpstreamMessage = classified.upstreamMessage || classified.message;
            recordProviderModelError(provider, candidateModel, classified);

            if (hasEmittedOutput() || !classified.switchable) {
              throw providerErr;
            }
            // Auth error applies to the entire provider key — stop trying other models on this provider
            if (classified.code === 'PROVIDER_AUTH_ERROR' || classified.code === 'PROVIDER_BILLING_REQUIRED') {
              const allModelsForProv =
                provider === 'groq' ? groqParsed.allowed : openRouterParsed.allowed;
              for (const otherModel of allModelsForProv) {
                recordProviderModelError(provider, otherModel, classified);
              }
              break;
            }
          }
        }
      }
    }

    // If only Gemini was configured and failed, preserve exact Gemini error contract
    if (eligibleProviders.length === 1 && eligibleProviders[0] === 'gemini' && lastError) {
      throw lastError;
    }

    const waitSeconds = computeShortestCooldownSecondsAcrossProviders(eligibleProviders);
    throw createAllFreeProvidersUnavailableError({
      attemptedProviders,
      attemptedModels,
      retryAfterSeconds: waitSeconds,
      totalAttempts,
      lastUpstreamMessage,
    });
  }

  async function executeGenerate({
    geminiRunner = null,
    systemInstruction = '',
    history = [],
    prompt = '',
    imageAttachment = null,
    allowNonGeminiFallback = true,
    temperature = 0.3,
    maxOutputTokens = 2048,
    responseJson = false,
    isAborted = () => false,
  }) {
    const configuredProviders = getConfiguredProviders();
    const eligibleProviders = configuredProviders.filter((provider) => {
      if (provider === 'gemini') return typeof geminiRunner === 'function';
      if (!allowNonGeminiFallback) return false;
      if (provider === 'groq' && imageAttachment) return false;
      return true;
    });

    if (eligibleProviders.length === 0) {
      const err = new Error(
        'No free AI provider API key is configured on the server. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.'
      );
      err.status = 424;
      err.code = 'MISSING_API_KEY';
      throw err;
    }

    const { primaryProvider, primaryModel } = getPrimaryProviderAndModel();
    const attemptedProviders = [];
    const attemptedModels = [];
    let totalAttempts = 0;
    let lastError = null;
    let lastUpstreamMessage = '';

    for (let pIdx = 0; pIdx < eligibleProviders.length; pIdx++) {
      const provider = eligibleProviders[pIdx];
      if (isAborted()) break;
      const hasMoreProviders = pIdx < eligibleProviders.length - 1;

      if (provider === 'gemini') {
        attemptedProviders.push('gemini');
        try {
          const outcome = await geminiRunner();
          lastActiveProvider = 'gemini';
          lastActiveModel = outcome.modelUsed;
          const switchedProvider = provider !== primaryProvider;
          if (switchedProvider) totalProviderSwitches += 1;
          return {
            provider: 'gemini',
            providerLabel: PROVIDER_LABELS.gemini,
            response: outcome.response,
            text: (outcome.response?.text || '').trim(),
            modelUsed: outcome.modelUsed,
            primaryProvider,
            primaryModel,
            fallbackUsed: Boolean(outcome.fallbackUsed || switchedProvider),
            switchedFromProvider: switchedProvider ? primaryProvider : null,
            switchedFrom: outcome.switchedFrom || (switchedProvider ? primaryModel : null),
            attemptedProviders,
            attemptedModels: [...attemptedModels, ...(outcome.attemptedModels || [outcome.modelUsed])],
          };
        } catch (err) {
          lastError = err;
          totalAttempts += Number.isFinite(err?.attemptsMade) ? err.attemptsMade : 1;
          if (Array.isArray(err?.attemptedModels)) {
            attemptedModels.push(...err.attemptedModels);
          }
          lastUpstreamMessage = err?.geminiDetails?.upstreamMessage || err?.message || '';

          if (shouldFailoverFromGeminiError(err, hasMoreProviders, false)) {
            continue;
          }
          throw err;
        }
      }

      if (provider === 'groq' || provider === 'openrouter') {
        attemptedProviders.push(provider);
        const candidates =
          provider === 'groq'
            ? await getGroqCandidateModels()
            : await getOpenRouterCandidateModels({ requireVision: Boolean(imageAttachment) });

        if (candidates.length === 0) continue;

        const apiKey = provider === 'groq' ? getGroqApiKey().trim() : getOpenRouterApiKey().trim();
        const messages = buildOpenAiMessages({
          systemInstruction,
          history,
          prompt,
          imageAttachment: provider === 'openrouter' ? imageAttachment : null,
        });

        for (const candidateModel of candidates) {
          if (isAborted()) break;
          attemptedModels.push(`${provider}:${candidateModel}`);
          totalAttempts += 1;

          const pricingVerified =
            provider === 'groq'
              ? isApprovedFreeGroqModel(candidateModel)
              : Boolean(openRouterCatalogCache.verifiedModels.get(candidateModel)?.pricingVerified);

          try {
            const genRes = await callOpenAiCompatibleGenerate({
              fetchImpl,
              provider,
              apiKey,
              modelId: candidateModel,
              pricingVerified,
              messages,
              temperature,
              maxTokens: maxOutputTokens,
              responseJson,
              appReferer,
            });

            recordProviderModelSuccess(provider, candidateModel);
            const switchedProvider = provider !== primaryProvider;
            const switchedModel = switchedProvider || candidateModel !== primaryModel;
            if (switchedProvider) totalProviderSwitches += 1;

            return {
              provider,
              providerLabel: PROVIDER_LABELS[provider],
              response: { text: genRes.text },
              text: genRes.text,
              modelUsed: candidateModel,
              primaryProvider,
              primaryModel,
              fallbackUsed: switchedModel,
              switchedFromProvider: switchedProvider ? primaryProvider : null,
              switchedFrom: switchedModel ? primaryModel : null,
              attemptedProviders,
              attemptedModels,
            };
          } catch (providerErr) {
            lastError = providerErr;
            const classified =
              providerErr?.providerClassified ||
              classifyOpenAiProviderError(provider, 500, providerErr?.message || 'Provider error');
            lastUpstreamMessage = classified.upstreamMessage || classified.message;
            recordProviderModelError(provider, candidateModel, classified);

            if (!classified.switchable) {
              throw providerErr;
            }
            if (classified.code === 'PROVIDER_AUTH_ERROR' || classified.code === 'PROVIDER_BILLING_REQUIRED') {
              const allModelsForProv =
                provider === 'groq' ? groqParsed.allowed : openRouterParsed.allowed;
              for (const otherModel of allModelsForProv) {
                recordProviderModelError(provider, otherModel, classified);
              }
              break;
            }
          }
        }
      }
    }

    if (eligibleProviders.length === 1 && eligibleProviders[0] === 'gemini' && lastError) {
      throw lastError;
    }

    const waitSeconds = computeShortestCooldownSecondsAcrossProviders(eligibleProviders);
    throw createAllFreeProvidersUnavailableError({
      attemptedProviders,
      attemptedModels,
      retryAfterSeconds: waitSeconds,
      totalAttempts,
      lastUpstreamMessage,
    });
  }

  function getMultiProviderStatus() {
    const now = nowFn();
    const geminiPool = geminiFallbackManager?.getPoolStatus?.() || null;
    const configuredProviders = getConfiguredProviders();
    const { primaryProvider, primaryModel } = getPrimaryProviderAndModel();

    const buildExternalProviderSummary = (provider, modelList, rejectedList, configured, catalogInfo) => {
      const models = modelList.map((modelId, idx) => {
        const state = refreshModelState(getOrCreateModelState(provider, modelId), now);
        const rem = state.cooldownUntilMs > now ? Math.ceil((state.cooldownUntilMs - now) / 1000) : 0;
        const pricingVerified =
          provider === 'groq'
            ? true
            : Boolean(catalogInfo.verified && catalogInfo.verifiedModels?.get(modelId)?.pricingVerified);
        return {
          model: modelId,
          isPrimary: idx === 0,
          freeTierApproved: isApprovedFreeModelForProvider(provider, modelId),
          pricingVerified,
          status: rem > 0 ? state.status : 'available',
          cooldownRemainingSeconds: rem,
          lastErrorCode: state.lastErrorCode,
        };
      });

      const availableCount = configured
        ? models.filter((m) => m.status === 'available').length
        : 0;
      const shortestCooldown =
        configured && availableCount === 0 && models.length > 0
          ? Math.min(...models.map((m) => m.cooldownRemainingSeconds || 60))
          : 0;
      const status = !configured
        ? 'unconfigured'
        : availableCount > 0
          ? 'ready'
          : models.every((m) => m.status === 'auth_error')
            ? 'auth_error'
            : 'cooldown';

      return {
        id: provider,
        label: PROVIDER_LABELS[provider],
        configured,
        pricingPolicy:
          provider === 'openrouter' ? 'LIVE_ZERO_PRICE_VERIFIED' : 'FREE_TIER_ALLOWLIST',
        pricingVerified:
          provider === 'openrouter' ? Boolean(catalogInfo.verified) : true,
        status,
        availableCount,
        totalModels: models.length,
        cooldownRemainingSeconds: shortestCooldown,
        rejectedModels: [
          ...rejectedList,
          ...(provider === 'openrouter' ? catalogInfo.rejectedNonZeroModels || [] : []),
        ],
        models,
      };
    };

    const geminiConfigured = isGeminiConfigured();
    const geminiSummary = {
      id: 'gemini',
      label: PROVIDER_LABELS.gemini,
      configured: geminiConfigured,
      pricingPolicy: 'FREE_TIER_ALLOWLIST',
      pricingVerified: true,
      status: !geminiConfigured
        ? 'unconfigured'
        : geminiPool && !geminiPool.allExhausted
          ? 'ready'
          : 'cooldown',
      availableCount: geminiConfigured ? geminiPool?.availableCount ?? 0 : 0,
      totalModels: geminiPool?.models?.length ?? FREE_TIER_GEMINI_MODELS.length,
      cooldownRemainingSeconds: geminiConfigured ? geminiPool?.shortestCooldownSeconds ?? 0 : 0,
      rejectedModels: geminiPool?.rejectedModels || [],
      models: (geminiPool?.models || []).map((m) => ({
        ...m,
        pricingVerified: true,
      })),
    };

    const groqSummary = buildExternalProviderSummary(
      'groq',
      groqParsed.allowed,
      groqParsed.rejected,
      isGroqConfigured(),
      groqCatalogCache
    );

    const openRouterSummary = buildExternalProviderSummary(
      'openrouter',
      openRouterParsed.allowed,
      openRouterParsed.rejected,
      isOpenRouterConfigured(),
      openRouterCatalogCache
    );

    const providerMap = {
      gemini: geminiSummary,
      groq: groqSummary,
      openrouter: openRouterSummary,
    };

    const providers = providerOrder.map((id) => providerMap[id]);
    const readyProvidersCount = providers.filter((p) => p.configured && p.status === 'ready').length;
    const allProvidersExhausted =
      configuredProviders.length > 0 && readyProvidersCount === 0;
    const shortestCooldownSeconds = allProvidersExhausted
      ? computeShortestCooldownSecondsAcrossProviders(configuredProviders)
      : 0;

    return {
      zeroCostEnforced: true,
      paidFallbackBlocked: true,
      providerOrder,
      configuredProviders,
      readyProvidersCount,
      primaryProvider,
      primaryModel,
      activeProvider: configuredProviders.includes(lastActiveProvider)
        ? lastActiveProvider
        : primaryProvider,
      activeProviderLabel:
        PROVIDER_LABELS[
          configuredProviders.includes(lastActiveProvider) ? lastActiveProvider : primaryProvider
        ],
      activeModel: configuredProviders.includes(lastActiveProvider)
        ? lastActiveModel
        : primaryModel,
      totalProviderSwitches,
      totalFallbackSwitches:
        totalProviderSwitches + (geminiPool?.totalFallbackSwitches || 0),
      allProvidersExhausted,
      shortestCooldownSeconds,
      providers,
    };
  }

  return {
    providerOrder,
    isGeminiConfigured,
    isGroqConfigured,
    isOpenRouterConfigured,
    getConfiguredProviders,
    hasAnyConfiguredProvider,
    getPrimaryProviderAndModel,
    isAllProvidersCoolingDown,
    ensureGroqCatalogFresh,
    ensureOpenRouterCatalogFresh,
    getMultiProviderStatus,
    executeStream,
    executeGenerate,
    // Exposed for direct unit testing & verification
    recordProviderModelError,
    recordProviderModelSuccess,
    isProviderModelCoolingDown,
  };
}

/**
 * Validates an optional client-supplied model override against the strict free-only allowlist.
 * If a caller ever tries to request a paid or unknown model ID, reject it cleanly.
 */
export function validateRequestedFreeModel(rawModel, rawProvider = null) {
  if (rawModel === undefined || rawModel === null || String(rawModel).trim() === '') {
    return { valid: true };
  }
  const cleanedModel = normalizeModelId(rawModel);
  if (rawProvider) {
    const provider = normalizeProviderId(rawProvider);
    if (!provider || !isApprovedFreeModelForProvider(provider, cleanedModel)) {
      return {
        valid: false,
        error: `Rejected paid or unapproved model "${cleanedModel}" for provider "${rawProvider}". JARVIS only permits verified ₹0 free models.`,
      };
    }
    return { valid: true };
  }

  const allowedOnAny =
    isApprovedFreeTierModel(cleanedModel) ||
    isApprovedFreeGroqModel(cleanedModel) ||
    isApprovedFreeOpenRouterModel(cleanedModel);

  if (!allowedOnAny) {
    return {
      valid: false,
      error: `Rejected paid or unapproved model "${cleanedModel}". JARVIS strictly enforces a ₹0 free-only model allowlist.`,
    };
  }
  return { valid: true };
}
