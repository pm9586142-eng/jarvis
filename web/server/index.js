import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { filterUniqueMemories } from '../src/services/memoryDedupe.js';
import { createMemoryStore, sanitizeUserNamespace } from './memoryStore.js';
import { createDataStore } from './dataStore.js';
import { parseDocumentPayload } from './documentParser.js';
import {
  extractGroundingSourcesFromResponse,
  fetchTavilyResults,
  mergeVerifiedSources,
  parseStructuredResearchMarkdown,
} from './searchService.js';
import { parseReminderFallback, sanitizeParsedReminder } from '../src/services/reminderParser.js';
import {
  analyzeBrainRequest,
  buildIntelligentErrorExplanation,
  classifyGeminiError,
  extractGeminiErrorDetails,
} from '../src/services/brainEngine.js';
import {
  createQuotaCooldownTracker,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  executeWithGeminiBackoff,
} from './geminiRetry.js';
import {
  createFreeModelFallbackManager,
  DEFAULT_PRIMARY_MODEL,
  FREE_TIER_GEMINI_MODELS,
  isApprovedFreeTierModel,
} from './geminiModelFallback.js';
import {
  createFreeMultiProviderRouter,
  FREE_TIER_GROQ_MODELS,
  FREE_TIER_OPENROUTER_MODELS,
  FREE_TIER_OPENROUTER_VISION_MODELS,
  isApprovedFreeModelForProvider,
  isPricingStrictlyZero,
  PROVIDER_LABELS,
  validateRequestedFreeModel,
} from './freeMultiProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(webRootDir, 'dist');

// Load .env from web/ regardless of whether started from repo root or web/
dotenv.config({ path: path.resolve(webRootDir, '.env') });
dotenv.config();

export const MAX_PROMPT_CHARS = 8000;

export function resolveServerPort(argv = process.argv, env = process.env) {
  const portArg = argv.find((arg) => arg.startsWith('--port='));
  if (portArg) {
    const parsed = Number(portArg.slice('--port='.length));
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
  }

  const explicitAppPort = Number(env.APP_PORT || env.PREVIEW_PORT);
  if (Number.isInteger(explicitAppPort) && explicitAppPort > 0 && explicitAppPort <= 65535) {
    return explicitAppPort;
  }

  if (argv.includes('--preview')) {
    const previewDefault = Number(env.DEFAULT_APP_PORT);
    return Number.isInteger(previewDefault) && previewDefault > 0 ? previewDefault : 3000;
  }

  if (argv.includes('--dev')) {
    const devApiPort = Number(env.DEV_API_PORT);
    return Number.isInteger(devApiPort) && devApiPort > 0 ? devApiPort : 3001;
  }

  const envPort = Number(env.PORT);
  return Number.isInteger(envPort) && envPort > 0 ? envPort : 8080;
}

const PORT = resolveServerPort();
const HOST = (process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';

export const DEFAULT_GEMINI_MODEL = DEFAULT_PRIMARY_MODEL;
export {
  FREE_TIER_GEMINI_MODELS,
  FREE_TIER_GROQ_MODELS,
  FREE_TIER_OPENROUTER_MODELS,
  FREE_TIER_OPENROUTER_VISION_MODELS,
  isApprovedFreeModelForProvider,
  isApprovedFreeTierModel,
  isPricingStrictlyZero,
  PROVIDER_LABELS,
};

const DEPRECATED_GEMINI_MODEL_PATTERNS = [
  /^gemini-1\.0(?:-|$)/i,
  /^gemini-1\.5(?:-|$)/i,
  /^gemini-2\.0(?:-|$)/i,
  /^gemini-2\.5-flash$/i,
  /^gemini-2\.5-flash-preview/i,
  /^gemini-2\.5-flash-lite-preview/i,
];

export function resolveActiveGeminiModel(rawModel = process.env.GEMINI_MODEL) {
  const cleaned = String(rawModel || '')
    .trim()
    .replace(/^models\//i, '')
    .trim();

  if (!cleaned || /^unset$|^none$/i.test(cleaned)) {
    return DEFAULT_GEMINI_MODEL;
  }

  if (DEPRECATED_GEMINI_MODEL_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    console.warn(
      `[JARVIS Model Guard] Deprecated GEMINI_MODEL "${cleaned}" detected; upgrading automatically to "${DEFAULT_GEMINI_MODEL}".`
    );
    return DEFAULT_GEMINI_MODEL;
  }

  if (!isApprovedFreeTierModel(cleaned)) {
    console.warn(
      `[JARVIS Zero-Cost Guard] Rejected paid or unapproved GEMINI_MODEL "${cleaned}"; enforcing verified Free Tier model "${DEFAULT_GEMINI_MODEL}".`
    );
    return DEFAULT_GEMINI_MODEL;
  }

  return cleaned;
}

export function isGemini3OrNewer(modelName = DEFAULT_GEMINI_MODEL) {
  const cleaned = String(modelName || '').trim().replace(/^models\//i, '');
  return /^gemini-(?:[3-9]|\d{2,})(?:\.|-|$)/i.test(cleaned);
}

export function buildThinkingConfig(modelName = DEFAULT_GEMINI_MODEL, reasoningMode = 'fast') {
  if (isGemini3OrNewer(modelName)) {
    if (reasoningMode === 'deep') return { thinkingLevel: 'HIGH' };
    if (reasoningMode === 'structured') return { thinkingLevel: 'MEDIUM' };
    return { thinkingLevel: 'LOW' };
  }
  if (reasoningMode === 'deep') return { thinkingBudget: 1024 };
  if (reasoningMode === 'structured') return { thinkingBudget: 512 };
  return { thinkingBudget: 0 };
}

function inspectAndClassifyGeminiError(err) {
  const details = err?.geminiDetails || extractGeminiErrorDetails(err);
  const classified =
    err?.geminiClassified || classifyGeminiError(details.httpStatus, details.upstreamMessage, details);
  const attempts = Number.isFinite(err?.attemptsMade) ? err.attemptsMade : 1;
  return { details, classified, attempts };
}

function buildGeminiErrorPayload(err) {
  const { details, classified, attempts } = inspectAndClassifyGeminiError(err);
  const explanation = buildIntelligentErrorExplanation(classified);
  const allProvidersExhausted = Boolean(err?.allProvidersExhausted);
  const allModelsExhausted =
    allProvidersExhausted ||
    Boolean(err?.allModelsExhausted) ||
    classified.code === 'ALL_FREE_MODELS_EXHAUSTED';
  const attemptedModels = Array.isArray(err?.attemptedModels) ? err.attemptedModels : [];
  const attemptedProviders = Array.isArray(err?.attemptedProviders) ? err.attemptedProviders : [];
  return {
    classified,
    details,
    httpStatus: httpStatusForGeminiError(classified),
    payload: {
      error: classified.message,
      code: classified.code,
      quotaCategory: classified.quotaCategory,
      upstreamStatus: details.httpStatus ?? classified.httpStatus ?? null,
      upstreamGrpcStatus: details.upstreamStatus || classified.upstreamStatus || null,
      upstreamMessage: details.upstreamMessage || classified.upstreamMessage || '',
      retryable: Boolean(classified.retryable),
      retryAfterSeconds: classified.retryAfterSeconds ?? null,
      quotaMetrics: classified.quotaMetrics || [],
      attempts,
      allModelsExhausted,
      allProvidersExhausted,
      attemptedModels,
      attemptedProviders,
      explanation: allProvidersExhausted
        ? 'All configured free AI providers (Google Gemini Free, Groq Free API, OpenRouter Free) are temporarily unavailable or have hit their free quotas. Paid models and billing remain strictly blocked (₹0 zero-cost policy).'
        : allModelsExhausted
          ? 'Every currently supported Free Tier Gemini model in the fallback pool has temporarily hit its free quota limit. Paid models and billing remain strictly disabled.'
          : explanation.cause,
      suggestedAction: allProvidersExhausted
        ? 'Please try again later once a free quota window resets (per-minute limits usually reset within ~60 seconds). Zero paid requests were attempted.'
        : allModelsExhausted
          ? 'Wait for the free quota window to reset (RPM limits reset in ~60 seconds; daily RPD limits reset at midnight Pacific Time) and retry.'
          : explanation.suggestedAction,
    },
  };
}

function logUpstreamGeminiError(contextLabel, err) {
  const { details, classified, attempts } = inspectAndClassifyGeminiError(err);
  console.error(
    `[JARVIS ${contextLabel}]`,
    JSON.stringify({
      code: classified.code,
      quotaCategory: classified.quotaCategory,
      httpStatus: details.httpStatus ?? null,
      grpcStatus: details.upstreamStatus ?? null,
      retryable: classified.retryable,
      retryAfterSeconds: classified.retryAfterSeconds ?? null,
      quotaMetrics: classified.quotaMetrics,
      quotaIds: classified.quotaIds,
      errorReason: details.errorReason ?? null,
      attempts,
      attemptedModels: Array.isArray(err?.attemptedModels) ? err.attemptedModels : [],
      allModelsExhausted: Boolean(err?.allModelsExhausted),
      upstreamMessage: details.upstreamMessage,
    })
  );
}

function httpStatusForGeminiError(classified) {
  if (!classified) return 500;
  switch (classified.code) {
    case 'GEMINI_AUTH_ERROR':
      return classified.httpStatus === 403 ? 403 : 401;
    case 'GEMINI_MODEL_NOT_FOUND':
      return 404;
    case 'GEMINI_QUOTA_BILLING':
      return classified.httpStatus === 402 || classified.httpStatus === 403 ? classified.httpStatus : 429;
    case 'ALL_FREE_MODELS_EXHAUSTED':
    case 'GEMINI_QUOTA_RPM':
    case 'GEMINI_QUOTA_TPM':
    case 'GEMINI_QUOTA_RPD':
    case 'GEMINI_QUOTA_SPEND_CAP':
    case 'GEMINI_RATE_LIMIT':
      return 429;
    case 'GEMINI_BAD_REQUEST':
      return 400;
    case 'GEMINI_UNAVAILABLE':
      return 503;
    case 'GEMINI_TIMEOUT':
      return 504;
    default:
      return 500;
  }
}

function timingSafeTokenEqual(provided, expected) {
  const a = Buffer.from(String(provided || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  if (a.length !== b.length || b.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isPromptTooLong(value) {
  return typeof value === 'string' && value.length > MAX_PROMPT_CHARS;
}

export function createApp(options = {}) {
  const expressApp = express();
  // Trust reverse proxy headers on Cloud Run / Vercel so rate-limit reads client IP cleanly
  expressApp.set('trust proxy', 1);

  const getActiveModel = () =>
    resolveActiveGeminiModel(options.model !== undefined ? options.model : process.env.GEMINI_MODEL);

  const getAccessToken = () => {
    const raw = options.accessToken !== undefined ? options.accessToken : process.env.APP_ACCESS_TOKEN;
    const trimmed = String(raw || '').trim();
    if (!trimmed || trimmed === 'UNSET') return '';
    return trimmed;
  };

  // Non-sensitive request logger (never logs bodies, prompts, tokens, or keys)
  expressApp.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      const elapsed = Date.now() - started;
      if (req.path.startsWith('/api/') || req.path === '/health') {
        console.info(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${elapsed}ms)`);
      }
    });
    next();
  });

  const memoryStore = createMemoryStore({
    filePath: options.memoryStorePath,
    baseDir: webRootDir,
    disableFallback: options.disableStoreFallback,
  });

  const dataStore = createDataStore({
    filePath: options.dataStorePath,
    baseDir: webRootDir,
  });

  const resolveRequestNamespace = (req) =>
    sanitizeUserNamespace(
      req.headers['x-jarvis-user-id'] ||
        req.query?.namespace ||
        req.body?.namespace ||
        'default'
    );

  const nowFn = typeof options.nowFn === 'function' ? options.nowFn : Date.now;
  const quotaTracker = createQuotaCooldownTracker({ nowFn });
  const retryOptions = {
    maxRetries: options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MAX_RETRIES,
    baseDelayMs: options.baseRetryDelayMs !== undefined ? options.baseRetryDelayMs : DEFAULT_BASE_DELAY_MS,
    maxRetryDelayMs:
      options.maxRetryDelayMs !== undefined ? options.maxRetryDelayMs : DEFAULT_MAX_RETRY_DELAY_MS,
    sleep: typeof options.sleep === 'function' ? options.sleep : undefined,
    randomFn: typeof options.randomFn === 'function' ? options.randomFn : undefined,
  };

  const fallbackManager = createFreeModelFallbackManager({
    getPrimaryModel: getActiveModel,
    configuredFallbacks:
      options.fallbackModels !== undefined
        ? options.fallbackModels
        : process.env.GEMINI_FREE_FALLBACK_MODELS || null,
    enableDynamicDiscovery: options.enableDynamicDiscovery !== false,
    nowFn,
    retryOptions,
  });

  const getGroqApiKey = () =>
    String(
      options.groqApiKey !== undefined ? options.groqApiKey : process.env.GROQ_API_KEY || ''
    ).trim();

  const getOpenRouterApiKey = () =>
    String(
      options.openrouterApiKey !== undefined
        ? options.openrouterApiKey
        : process.env.OPENROUTER_API_KEY || ''
    ).trim();

  function getGeminiClient() {
    if (typeof options.geminiClientFactory === 'function') {
      return options.geminiClientFactory();
    }
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'your_api_key_here') {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  }

  const multiProviderRouter = createFreeMultiProviderRouter({
    geminiFallbackManager: fallbackManager,
    getGeminiClient,
    getGroqApiKey,
    getOpenRouterApiKey,
    configuredProviderOrder:
      options.providerOrder !== undefined
        ? options.providerOrder
        : process.env.AI_PROVIDER_ORDER || null,
    configuredGroqModels:
      options.groqModels !== undefined
        ? options.groqModels
        : process.env.GROQ_FREE_MODELS || null,
    configuredOpenRouterModels:
      options.openrouterModels !== undefined
        ? options.openrouterModels
        : process.env.OPENROUTER_FREE_MODELS || null,
    fetchImpl: options.fetchImpl || fetch,
    nowFn,
    appReferer: process.env.OPENROUTER_APP_REFERER || 'https://jarvis-ai.local',
  });

  const isBackgroundQuotaPaused = () => {
    const configuredProviders = multiProviderRouter.getConfiguredProviders();
    if (configuredProviders.length > 1) {
      return multiProviderRouter.isAllProvidersCoolingDown();
    }
    return (
      fallbackManager.isAllModelsOnCooldown() ||
      (fallbackManager.getChainInfo().chain.length <= 1 && quotaTracker.isBackgroundPaused())
    );
  };

  // Deduplication & short TTL caches to prevent duplicate background Gemini requests
  const BRIEFING_CACHE_TTL_MS = Number(options.briefingCacheTtlMs) || 5 * 60 * 1000;
  const briefingCache = new Map();
  const briefingInFlight = new Map();
  const MEMORY_EXTRACT_CACHE_TTL_MS = 60 * 1000;
  const memoryExtractCache = new Map();
  const memoryExtractInFlight = new Map();

  // Configure CORS (supports GET, POST, PUT, DELETE & user namespace header)
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  expressApp.use(
    cors({
      origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Jarvis-User-Id'],
    })
  );

  // Allow up to 15MB JSON payloads for webcam / uploaded image & document analysis
  expressApp.use(express.json({ limit: '15mb' }));

  // Return structured JSON on malformed JSON or oversized request bodies
  expressApp.use((err, _req, res, next) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({
        code: 'PAYLOAD_TOO_LARGE',
        error: 'Request payload exceeds maximum allowed size.',
      });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        code: 'BAD_JSON',
        error: 'Invalid JSON request payload.',
      });
    }
    return next(err);
  });

  // Health check handler shared by /health and /api/health (exempt from Bearer auth & rate limit)
  const handleHealthCheck = (req, res) => {
    const geminiConfigured = multiProviderRouter.isGeminiConfigured();
    const groqConfigured = multiProviderRouter.isGroqConfigured();
    const openrouterConfigured = multiProviderRouter.isOpenRouterConfigured();
    const aiConfigured = multiProviderRouter.hasAnyConfiguredProvider();
    const tavilyKey = (process.env.TAVILY_API_KEY || '').trim();
    const tavilyConfigured = Boolean(
      tavilyKey && tavilyKey !== 'UNSET' && tavilyKey !== 'your_tavily_api_key_here'
    );
    res.setHeader('Cache-Control', 'no-store');
    const freeTierPool = fallbackManager.getPoolStatus();
    const multiProvider = multiProviderRouter.getMultiProviderStatus();
    res.status(200).json({
      status: 'ok',
      service: 'jarvis-cosmic-backend',
      endpoint: req.path,
      geminiConfigured,
      groqConfigured,
      openrouterConfigured,
      aiConfigured,
      zeroCostEnforced: true,
      tavilyConfigured,
      authRequired: Boolean(getAccessToken()),
      model: multiProvider.activeProvider === 'gemini' ? getActiveModel() : multiProvider.activeModel,
      activeProvider: multiProvider.activeProvider,
      activeProviderLabel: multiProvider.activeProviderLabel,
      activeModel: multiProvider.activeModel,
      freeTierFallback: freeTierPool,
      multiProvider,
      musicModels: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
      capabilities: [
        'streaming',
        'multimodal',
        'free-tier-model-fallback',
        'free-multi-provider-routing',
        'zero-cost-guard',
        'summarization',
        'intent-detection',
        'personality-presets',
        'hinglish',
        'memory-extraction',
        'memory-crud',
        'namespace-isolation',
        'cross-device-sync',
        'smart-retrieval',
        'web-grounding',
        'live-web-search',
        'docx-pdf-intelligence',
        'report-generation',
        'automation-history',
      ],
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };

  expressApp.get('/health', handleHealthCheck);
  expressApp.get('/api/health', handleHealthCheck);

  // Rate limit all /api/* routes (excluding /api/health): 30 requests / minute / IP
  const apiRateLimiter = rateLimit({
    windowMs: Number(options.rateLimitWindowMs) || 60 * 1000,
    max: Number(options.rateLimitMax) || 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
    handler: (_req, res) => {
      res.status(429).json({
        code: 'RATE_LIMITED',
        quotaCategory: 'APP_RATE_LIMIT',
        upstreamStatus: 429,
        retryable: true,
        retryAfterSeconds: 60,
        error: 'JARVIS server rate limit exceeded (maximum 30 requests per minute per IP). Wait briefly and retry.',
      });
    },
  });
  expressApp.use('/api', apiRateLimiter);

  // Optional APP_ACCESS_TOKEN Bearer check on /api/* when configured (exempts /api/health)
  expressApp.use('/api', (req, res, next) => {
    if (req.method === 'OPTIONS' || req.path === '/health') return next();
    const expectedToken = getAccessToken();
    if (!expectedToken) return next();

    const authHeader = String(req.headers.authorization || '');
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const providedToken = bearerMatch ? bearerMatch[1].trim() : '';

    if (!timingSafeTokenEqual(providedToken, expectedToken)) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        error: 'Valid Bearer APP_ACCESS_TOKEN is required.',
      });
    }
    return next();
  });

// Helper to execute non-streaming generation across all configured FREE providers (Gemini -> Groq -> OpenRouter)
async function generateViaFreeProviders({
  geminiRequestBuilder,
  prompt,
  systemInstruction = '',
  history = [],
  imageAttachment = null,
  allowNonGeminiFallback = true,
  temperature = 0.3,
  maxOutputTokens = 2048,
  responseJson = false,
  enableBackoff = true,
  isAborted = () => false,
  contextLabel = 'AI',
  reasoningMode = 'fast',
}) {
  const ai = getGeminiClient();
  return multiProviderRouter.executeGenerate({
    geminiRunner: ai
      ? () =>
          generateContentWithThinkingFallback(ai, geminiRequestBuilder, {
            enableBackoff,
            isAborted,
            contextLabel,
            reasoningMode,
          })
      : null,
    prompt,
    systemInstruction,
    history,
    imageAttachment,
    allowNonGeminiFallback,
    temperature,
    maxOutputTokens,
    responseJson,
    isAborted,
  });
}

async function generateContentWithThinkingFallback(
  ai,
  requestOrBuilder,
  {
    enableBackoff = true,
    isAborted = () => false,
    contextLabel = 'Gemini',
    reasoningMode = 'fast',
  } = {}
) {
  const buildForModel = (candidateModel) => {
    if (typeof requestOrBuilder === 'function') {
      return requestOrBuilder(candidateModel);
    }
    const baseConfig = requestOrBuilder?.config ? { ...requestOrBuilder.config } : {};
    if (baseConfig.thinkingConfig !== undefined) {
      baseConfig.thinkingConfig = buildThinkingConfig(candidateModel, reasoningMode);
    }
    return {
      ...requestOrBuilder,
      model: candidateModel,
      config: baseConfig,
    };
  };

  try {
    const outcome = await fallbackManager.executeWithFallback({
      ai,
      enableBackoff,
      isAborted,
      contextLabel,
      operation: async (candidateModel) => {
        let activeRequest = buildForModel(candidateModel);
        let droppedThinkingConfig = false;
        let droppedSearchTool = false;

        for (let compatStep = 0; compatStep < 3; compatStep++) {
          try {
            return await ai.models.generateContent(activeRequest);
          } catch (err) {
            const details = extractGeminiErrorDetails(err);
            const isCompatStatus = !details.httpStatus || details.httpStatus === 400;
            if (
              !droppedSearchTool &&
              isCompatStatus &&
              Array.isArray(activeRequest?.config?.tools) &&
              /google_search|googleSearch|search.*grounding|Tool.*not supported/i.test(
                details.upstreamMessage
              )
            ) {
              droppedSearchTool = true;
              const { tools: _droppedTools, ...fallbackConfig } = activeRequest.config;
              activeRequest = { ...activeRequest, config: fallbackConfig };
              continue;
            }
            if (
              !droppedThinkingConfig &&
              isCompatStatus &&
              activeRequest?.config?.thinkingConfig &&
              /thinking|budget|level|thinkingConfig|unsupported/i.test(details.upstreamMessage)
            ) {
              droppedThinkingConfig = true;
              const { thinkingConfig: _dropped, ...fallbackConfig } = activeRequest.config;
              activeRequest = { ...activeRequest, config: fallbackConfig };
              continue;
            }
            throw err;
          }
        }
        return await ai.models.generateContent(activeRequest);
      },
    });

    quotaTracker.recordSuccess();
    return {
      response: outcome.result,
      modelUsed: outcome.modelUsed,
      primaryModel: outcome.primaryModel,
      fallbackUsed: outcome.fallbackUsed,
      switchedFrom: outcome.switchedFrom,
      attemptedModels: outcome.attemptedModels,
    };
  } catch (err) {
    const { classified } = inspectAndClassifyGeminiError(err);
    quotaTracker.recordError(classified);
    throw err;
  }
}

/**
 * Ensures Gemini `contents` follow strict alternating `user` -> `model` order
 * starting with `user`, merging consecutive same-role entries safely.
 */
function buildAlternatingContents(history, finalPrompt) {
  const normalized = [];

  if (Array.isArray(history)) {
    for (const item of history.slice(-16)) {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
      const role = item.role === 'model' || item.role === 'jarvis' ? 'model' : 'user';
      const text = item.text.trim();

      if (normalized.length === 0) {
        if (role === 'user') {
          normalized.push({ role, parts: [{ text }] });
        }
        continue;
      }

      const prev = normalized[normalized.length - 1];
      if (prev.role === role) {
        prev.parts[0].text = `${prev.parts[0].text}\n\n${text}`;
      } else {
        normalized.push({ role, parts: [{ text }] });
      }
    }
  }

  const promptText = finalPrompt.trim();
  if (normalized.length > 0 && normalized[normalized.length - 1].role === 'user') {
    normalized[normalized.length - 1].parts[0].text = `${normalized[normalized.length - 1].parts[0].text}\n\n${promptText}`;
  } else {
    normalized.push({ role: 'user', parts: [{ text: promptText }] });
  }

  return normalized;
}

// Health routes (/health and /api/health) are registered above rate-limit & auth middleware.

// Streaming Multi-Provider Free Chat Endpoint (SSE: Gemini Free -> Groq Free -> OpenRouter Free)
expressApp.post('/api/chat/stream', async (req, res) => {
  const {
    prompt,
    systemInstruction,
    history = [],
    enableWebSearch = false,
    conversationSummary = '',
    preferredLanguage = 'ENGLISH',
    personality = 'executive_butler',
    customInstructions = '',
    responseStyle = 'balanced',
    reasoningPreference = 'auto',
    documentContext = '',
    model: requestedModel,
    provider: requestedProvider,
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty prompt is required.',
    });
  }
  if (isPromptTooLong(prompt)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const modelCheck = validateRequestedFreeModel(requestedModel, requestedProvider);
  if (!modelCheck.valid) {
    return res.status(400).json({
      code: 'PAID_OR_UNKNOWN_MODEL_REJECTED',
      error: modelCheck.error,
    });
  }

  if (!multiProviderRouter.hasAnyConfiguredProvider()) {
    // Use HTTP 424 (Failed Dependency) so reverse proxies intercepting 502/503/504 preserve JSON error payloads
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'No free AI provider API key is configured on the server. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in your server environment variables or Secrets.',
    });
  }

  const ai = getGeminiClient();
  const analysis = analyzeBrainRequest({
    prompt,
    history: Array.isArray(history) ? history : [],
    preferredLanguage,
    conversationSummary,
    personality,
    customInstructions,
    responseStyle,
    reasoningPreference,
    documentContext,
  });

  const clientSys = typeof systemInstruction === 'string' ? systemInstruction.trim() : '';
  const mergedSystemInstruction = clientSys.includes('[JARVIS COGNITIVE BRAIN DIRECTIVES]')
    ? clientSys
    : [clientSys, analysis.brainDirectiveBlock].filter(Boolean).join('\n\n');

  // Prepare SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  req.on('close', () => {
    clientClosed = true;
  });

  const sendEvent = (payload) => {
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  const { primaryProvider, primaryModel } = multiProviderRouter.getPrimaryProviderAndModel();
  const baseMeta = {
    intent: analysis.intent,
    detectedLanguage: analysis.detectedLanguage,
    isFollowUp: analysis.isFollowUp,
    reasoningMode: analysis.reasoningMode,
    recommendedAgent: analysis.recommendedAgent,
    contextTurns: analysis.contextWindow.recentMessages.length,
    earlierTurnsCount: analysis.contextWindow.earlierCount,
    provider: primaryProvider,
    providerLabel: PROVIDER_LABELS[primaryProvider] || primaryProvider,
    primaryProvider,
    model: primaryModel,
    primaryModel,
    fallbackUsed: false,
    switchedFromProvider: null,
    switchedFrom: null,
  };

  sendEvent({ meta: baseMeta });

  const contents = buildAlternatingContents(analysis.contextWindow.recentMessages, prompt);
  let emittedAnyChunk = false;

  const runStreamForModel = async (candidateModel, useSearch, includeThinkingConfig) => {
    const config = {
      temperature: analysis.intent === 'CODING' ? 0.45 : 0.7,
      maxOutputTokens: 4096,
    };

    if (includeThinkingConfig) {
      config.thinkingConfig = buildThinkingConfig(candidateModel, analysis.reasoningMode);
    }

    if (mergedSystemInstruction) {
      config.systemInstruction = mergedSystemInstruction;
    }

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const streamResult = await ai.models.generateContentStream({
      model: candidateModel,
      contents,
      config,
    });

    const isSwitchedModel = primaryProvider !== 'gemini' || candidateModel !== primaryModel;
    let announcedSwitch = false;
    const collectedSources = new Map();

    for await (const chunk of streamResult) {
      if (clientClosed) break;

      // Only report fallback model/provider switch AFTER the stream actually yields output
      if (isSwitchedModel && !announcedSwitch) {
        announcedSwitch = true;
        sendEvent({
          meta: {
            ...baseMeta,
            provider: 'gemini',
            providerLabel: PROVIDER_LABELS.gemini,
            model: candidateModel,
            primaryProvider,
            primaryModel,
            fallbackUsed: true,
            switchedFromProvider: primaryProvider !== 'gemini' ? primaryProvider : null,
            switchedFrom: primaryModel,
          },
        });
      }

      const text = chunk.text;
      if (text) {
        emittedAnyChunk = true;
        sendEvent({ text });
      }

      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(groundingChunks)) {
        for (const gc of groundingChunks) {
          if (gc?.web?.uri) {
            collectedSources.set(gc.web.uri, {
              title: gc.web.title || gc.web.uri,
              uri: gc.web.uri,
            });
          }
        }
      }
    }

    return { collectedSources, modelUsed: candidateModel };
  };

  try {
    const outcome = await multiProviderRouter.executeStream({
      geminiRunner: ai
        ? () =>
            fallbackManager.executeWithFallback({
              ai,
              enableBackoff: true,
              isAborted: () => clientClosed,
              hasEmittedOutput: () => emittedAnyChunk,
              contextLabel: 'Stream',
              operation: async (candidateModel) => {
                let activeSearch = Boolean(enableWebSearch);
                let includeThinkingConfig = true;

                for (let compatStep = 0; compatStep < 3; compatStep++) {
                  try {
                    return await runStreamForModel(
                      candidateModel,
                      activeSearch,
                      includeThinkingConfig
                    );
                  } catch (compatErr) {
                    const { httpStatus, upstreamMessage } = extractGeminiErrorDetails(compatErr);
                    const isCompatStatus = !httpStatus || httpStatus === 400;
                    if (
                      isCompatStatus &&
                      activeSearch &&
                      !emittedAnyChunk &&
                      /google_search|googleSearch|search.*grounding|Tool.*not supported/i.test(
                        upstreamMessage
                      )
                    ) {
                      activeSearch = false;
                      continue;
                    }
                    if (
                      isCompatStatus &&
                      includeThinkingConfig &&
                      !emittedAnyChunk &&
                      /thinking|budget|level|thinkingConfig|unsupported/i.test(upstreamMessage)
                    ) {
                      includeThinkingConfig = false;
                      continue;
                    }
                    throw compatErr;
                  }
                }
                return await runStreamForModel(candidateModel, activeSearch, includeThinkingConfig);
              },
            })
        : null,
      systemInstruction: mergedSystemInstruction,
      history: analysis.contextWindow.recentMessages,
      prompt,
      temperature: analysis.intent === 'CODING' ? 0.45 : 0.7,
      maxOutputTokens: 4096,
      isAborted: () => clientClosed,
      hasEmittedOutput: () => emittedAnyChunk,
      onBeforeProviderOutput: (metaUpdate) => {
        sendEvent({
          meta: {
            ...baseMeta,
            ...metaUpdate,
          },
        });
      },
      onTextChunk: (textChunk) => {
        emittedAnyChunk = true;
        sendEvent({ text: textChunk });
      },
    });

    quotaTracker.recordSuccess();

    if (outcome?.result?.collectedSources?.size > 0) {
      sendEvent({ sources: Array.from(outcome.result.collectedSources.values()) });
    }

    sendEvent({
      done: true,
      provider: outcome.provider,
      providerLabel: outcome.providerLabel,
      model: outcome.modelUsed,
      primaryProvider: outcome.primaryProvider,
      primaryModel: outcome.primaryModel,
      fallbackUsed: outcome.fallbackUsed,
      switchedFromProvider: outcome.switchedFromProvider,
    });
    if (!res.writableEnded) res.end();
  } catch (err) {
    logUpstreamGeminiError('AI Stream Error', err);
    const { classified, payload } = buildGeminiErrorPayload(err);
    quotaTracker.recordError(classified);
    sendEvent(payload);
    if (!res.writableEnded) res.end();
  }
});

// Multimodal Document & Image Q&A Streaming Endpoint (SSE)
expressApp.post('/api/chat/multimodal', async (req, res) => {
  const {
    prompt = '',
    systemInstruction,
    history = [],
    fileBase64,
    mimeType,
    fileName = 'attachment',
    enableWebSearch = false,
    conversationSummary = '',
    preferredLanguage = 'ENGLISH',
    personality = 'executive_butler',
    customInstructions = '',
    responseStyle = 'balanced',
    reasoningPreference = 'auto',
    model: requestedModel,
    provider: requestedProvider,
  } = req.body || {};

  if (isPromptTooLong(prompt)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const modelCheck = validateRequestedFreeModel(requestedModel, requestedProvider);
  if (!modelCheck.valid) {
    return res.status(400).json({
      code: 'PAID_OR_UNKNOWN_MODEL_REJECTED',
      error: modelCheck.error,
    });
  }

  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'An encoded fileBase64 attachment is required.',
    });
  }

  const safeMime = String(mimeType || '').trim().toLowerCase();
  const isDocxFile =
    safeMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    String(fileName || '').toLowerCase().endsWith('.docx');
  const isPdfFile = safeMime === 'application/pdf';
  const isImageFile = safeMime.startsWith('image/');
  const isTextFile = safeMime.startsWith('text/');
  const isAllowedMime = isImageFile || isPdfFile || isTextFile || isDocxFile;

  if (!isAllowedMime) {
    return res.status(400).json({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      error: `Unsupported attachment MIME type "${safeMime || 'unknown'}". Supported: images, PDF, DOCX, and text files.`,
    });
  }

  const ai = getGeminiClient();
  if (!multiProviderRouter.hasAnyConfiguredProvider()) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'No free AI provider API key is configured on the server. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.',
    });
  }
  if (isPdfFile && !ai) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error: 'GEMINI_API_KEY is required on the server for binary PDF analysis.',
    });
  }

  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
  const approxBytes = Math.floor((cleanBase64.length * 3) / 4);
  const maxBytes = process.env.VERCEL ? 4 * 1024 * 1024 : 12 * 1024 * 1024;
  if (approxBytes > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return res.status(413).json({
      code: 'ATTACHMENT_TOO_LARGE',
      error: `Attachment exceeds maximum size of ${maxMb} MB.`,
    });
  }

  let extractedText = '';
  if (isDocxFile || isTextFile) {
    try {
      const parsedDoc = parseDocumentPayload({
        fileName,
        mimeType: safeMime,
        fileBase64: cleanBase64,
      });
      extractedText = parsedDoc.text;
    } catch (docErr) {
      return res.status(400).json({
        code: 'INVALID_DOCUMENT',
        error: docErr instanceof Error ? docErr.message : 'Unable to parse attached document.',
      });
    }
  }

  const effectivePrompt =
    typeof prompt === 'string' && prompt.trim()
      ? prompt.trim()
      : `Please analyze this attached file (${String(fileName).slice(0, 80)}) and summarize its key contents.`;

  const analysis = analyzeBrainRequest({
    prompt: effectivePrompt,
    history: Array.isArray(history) ? history : [],
    preferredLanguage,
    conversationSummary,
    personality,
    customInstructions,
    responseStyle,
    reasoningPreference,
    documentContext: extractedText ? `[FILE: ${fileName}]\n${extractedText}` : '',
  });

  const clientSys = typeof systemInstruction === 'string' ? systemInstruction.trim() : '';
  const mergedSystemInstruction = clientSys.includes('[JARVIS COGNITIVE BRAIN DIRECTIVES]')
    ? clientSys
    : [clientSys, analysis.brainDirectiveBlock].filter(Boolean).join('\n\n');

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  req.on('close', () => {
    clientClosed = true;
  });

  const sendEvent = (payload) => {
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  const { primaryProvider, primaryModel } = multiProviderRouter.getPrimaryProviderAndModel();
  const baseMeta = {
    intent: analysis.intent,
    detectedLanguage: analysis.detectedLanguage,
    isFollowUp: analysis.isFollowUp,
    reasoningMode: analysis.reasoningMode,
    recommendedAgent: analysis.recommendedAgent,
    contextTurns: analysis.contextWindow.recentMessages.length,
    earlierTurnsCount: analysis.contextWindow.earlierCount,
    provider: primaryProvider,
    providerLabel: PROVIDER_LABELS[primaryProvider] || primaryProvider,
    primaryProvider,
    model: primaryModel,
    primaryModel,
    fallbackUsed: false,
    switchedFromProvider: null,
    switchedFrom: null,
  };

  sendEvent({ meta: baseMeta });

  const contents = buildAlternatingContents(analysis.contextWindow.recentMessages, effectivePrompt);
  const lastTurn = contents[contents.length - 1];
  if (lastTurn && Array.isArray(lastTurn.parts) && !isDocxFile) {
    lastTurn.parts.push({
      inlineData: {
        mimeType: safeMime,
        data: cleanBase64,
      },
    });
  }

  let emittedAnyChunk = false;
  const runStreamForModel = async (candidateModel, useSearch, includeThinkingConfig) => {
    const config = {
      temperature: 0.5,
      maxOutputTokens: 4096,
    };
    if (includeThinkingConfig) {
      config.thinkingConfig = buildThinkingConfig(candidateModel, analysis.reasoningMode);
    }
    if (mergedSystemInstruction) {
      config.systemInstruction = mergedSystemInstruction;
    }
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const streamResult = await ai.models.generateContentStream({
      model: candidateModel,
      contents,
      config,
    });

    const isSwitchedModel = primaryProvider !== 'gemini' || candidateModel !== primaryModel;
    let announcedSwitch = false;
    const collectedSources = new Map();
    for await (const chunk of streamResult) {
      if (clientClosed) break;

      if (isSwitchedModel && !announcedSwitch) {
        announcedSwitch = true;
        sendEvent({
          meta: {
            ...baseMeta,
            provider: 'gemini',
            providerLabel: PROVIDER_LABELS.gemini,
            model: candidateModel,
            primaryProvider,
            primaryModel,
            fallbackUsed: true,
            switchedFromProvider: primaryProvider !== 'gemini' ? primaryProvider : null,
            switchedFrom: primaryModel,
          },
        });
      }

      const text = chunk.text;
      if (text) {
        emittedAnyChunk = true;
        sendEvent({ text });
      }
      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(groundingChunks)) {
        for (const gc of groundingChunks) {
          if (gc?.web?.uri) {
            collectedSources.set(gc.web.uri, {
              title: gc.web.title || gc.web.uri,
              uri: gc.web.uri,
            });
          }
        }
      }
    }
    return { collectedSources, modelUsed: candidateModel };
  };

  try {
    const outcome = await multiProviderRouter.executeStream({
      geminiRunner: ai
        ? () =>
            fallbackManager.executeWithFallback({
              ai,
              enableBackoff: true,
              isAborted: () => clientClosed,
              hasEmittedOutput: () => emittedAnyChunk,
              contextLabel: 'Multimodal Stream',
              operation: async (candidateModel) => {
                let activeSearch = Boolean(enableWebSearch);
                let includeThinkingConfig = true;

                for (let compatStep = 0; compatStep < 3; compatStep++) {
                  try {
                    return await runStreamForModel(
                      candidateModel,
                      activeSearch,
                      includeThinkingConfig
                    );
                  } catch (compatErr) {
                    const { httpStatus, upstreamMessage } = extractGeminiErrorDetails(compatErr);
                    const isCompatStatus = !httpStatus || httpStatus === 400;
                    if (
                      isCompatStatus &&
                      activeSearch &&
                      !emittedAnyChunk &&
                      /google_search|googleSearch|search.*grounding|Tool.*not supported/i.test(
                        upstreamMessage
                      )
                    ) {
                      activeSearch = false;
                      continue;
                    }
                    if (
                      isCompatStatus &&
                      includeThinkingConfig &&
                      !emittedAnyChunk &&
                      /thinking|budget|level|thinkingConfig|unsupported/i.test(upstreamMessage)
                    ) {
                      includeThinkingConfig = false;
                      continue;
                    }
                    throw compatErr;
                  }
                }
                return await runStreamForModel(candidateModel, activeSearch, includeThinkingConfig);
              },
            })
        : null,
      systemInstruction: mergedSystemInstruction,
      history: analysis.contextWindow.recentMessages,
      prompt: effectivePrompt,
      imageAttachment: isImageFile ? { mimeType: safeMime, cleanBase64 } : null,
      allowNonGeminiFallback: !isPdfFile,
      temperature: 0.5,
      maxOutputTokens: 4096,
      isAborted: () => clientClosed,
      hasEmittedOutput: () => emittedAnyChunk,
      onBeforeProviderOutput: (metaUpdate) => {
        sendEvent({
          meta: {
            ...baseMeta,
            ...metaUpdate,
          },
        });
      },
      onTextChunk: (textChunk) => {
        emittedAnyChunk = true;
        sendEvent({ text: textChunk });
      },
    });

    quotaTracker.recordSuccess();

    if (outcome?.result?.collectedSources?.size > 0) {
      sendEvent({ sources: Array.from(outcome.result.collectedSources.values()) });
    }
    sendEvent({
      done: true,
      provider: outcome.provider,
      providerLabel: outcome.providerLabel,
      model: outcome.modelUsed,
      primaryProvider: outcome.primaryProvider,
      primaryModel: outcome.primaryModel,
      fallbackUsed: outcome.fallbackUsed,
      switchedFromProvider: outcome.switchedFromProvider,
    });
    if (!res.writableEnded) res.end();
  } catch (err) {
    logUpstreamGeminiError('Multimodal Stream Error', err);
    const { classified, payload } = buildGeminiErrorPayload(err);
    quotaTracker.recordError(classified);
    sendEvent(payload);
    if (!res.writableEnded) res.end();
  }
});

// Conversation Summarization Endpoint
expressApp.post('/api/chat/summarize', async (req, res) => {
  const { messages, history, language = 'ENGLISH', previousSummary = '' } = req.body || {};
  const sourceMessages = Array.isArray(messages) ? messages : history;

  if (!Array.isArray(sourceMessages) || sourceMessages.length === 0) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty messages array is required for summarization.',
    });
  }

  const validTurns = sourceMessages
    .filter((m) => m && !m.isError && typeof m.text === 'string' && m.text.trim())
    .slice(-40);

  if (validTurns.length === 0) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'Messages array contains no valid text turns to summarize.',
    });
  }

  if (!multiProviderRouter.hasAnyConfiguredProvider()) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'No free AI provider API key is configured on the server. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.',
    });
  }

  const transcript = validTurns
    .map((m) => {
      const speaker = m.role === 'model' || m.role === 'jarvis' ? 'JARVIS' : 'User';
      return `${speaker}: ${m.text.trim().slice(0, 1200)}`;
    })
    .join('\n')
    .slice(0, 24000);

  const prevBlock =
    typeof previousSummary === 'string' && previousSummary.trim()
      ? `PREVIOUS SUMMARY:\n${previousSummary.trim().slice(0, 1500)}\n\n`
      : '';

  const summarizePrompt = [
    'Summarize the following JARVIS conversation concisely while preserving exact decisions, technical stack/names, constraints, and unresolved follow-ups.',
    `Target summary language: ${String(language || 'ENGLISH').slice(0, 32)} (if Hinglish, write clear natural Hinglish; if Hindi, write clear Hindi; if Gujarati, write clear Gujarati; otherwise refined English).`,
    'Return strict JSON matching: {"summary":"3-5 sentence executive summary","keyPoints":["concise point"],"actionItems":["next step or open task"]}',
    '',
    prevBlock + 'CONVERSATION TRANSCRIPT:',
    transcript,
  ].join('\n');

  try {
    const { text: rawText, provider, providerLabel, modelUsed, primaryProvider, primaryModel, fallbackUsed } =
      await generateViaFreeProviders({
        geminiRequestBuilder: (candidateModel) => ({
          model: candidateModel,
          contents: [{ role: 'user', parts: [{ text: summarizePrompt }] }],
          config: {
            temperature: 0.25,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            thinkingConfig: buildThinkingConfig(candidateModel, 'fast'),
          },
        }),
        prompt: summarizePrompt,
        temperature: 0.25,
        maxOutputTokens: 1024,
        responseJson: true,
        enableBackoff: true,
        contextLabel: 'Summarize',
        reasoningMode: 'fast',
      });

    const cleanedJson = rawText
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanedJson);
      return res.status(200).json({
        summary: String(parsed?.summary || '').trim() || rawText,
        keyPoints: Array.isArray(parsed?.keyPoints)
          ? parsed.keyPoints.map((p) => String(p).trim()).filter(Boolean).slice(0, 6)
          : [],
        actionItems: Array.isArray(parsed?.actionItems)
          ? parsed.actionItems.map((a) => String(a).trim()).filter(Boolean).slice(0, 6)
          : [],
        language: String(language || 'ENGLISH'),
        provider,
        providerLabel,
        primaryProvider,
        model: modelUsed,
        primaryModel,
        fallbackUsed,
      });
    } catch {
      return res.status(200).json({
        summary: rawText,
        keyPoints: [],
        actionItems: [],
        language: String(language || 'ENGLISH'),
        provider,
        providerLabel,
        primaryProvider,
        model: modelUsed,
        primaryModel,
        fallbackUsed,
      });
    }
  } catch (err) {
    logUpstreamGeminiError('Summarize Error', err);
    const { httpStatus, payload } = buildGeminiErrorPayload(err);
    return res.status(httpStatus).json(payload);
  }
});

// Automatic Long-Term Memory Extraction Endpoint
expressApp.post('/api/memory/extract', async (req, res) => {
  const { userPrompt, aiReply = '', existingMemories = [] } = req.body || {};
  if (isPromptTooLong(userPrompt)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }
  if (!multiProviderRouter.hasAnyConfiguredProvider()) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error: 'No free AI provider API key is configured on the server.',
    });
  }
  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length < 6) {
    return res.status(200).json({ memories: [] });
  }

  // Respect upstream quota cooldown so optional background memory extraction never compounds 429s
  if (isBackgroundQuotaPaused()) {
    return res.status(200).json({
      memories: [],
      skippedReason: 'quota_cooldown',
    });
  }

  const dedupeKey = `${userPrompt.trim().slice(0, 240)}|${String(aiReply || '').trim().slice(0, 240)}`;
  const cachedExtract = memoryExtractCache.get(dedupeKey);
  if (cachedExtract && nowFn() - cachedExtract.ts < MEMORY_EXTRACT_CACHE_TTL_MS) {
    return res.status(200).json({ memories: cachedExtract.memories, cached: true });
  }

  const existingSummary = Array.isArray(existingMemories)
    ? existingMemories
        .slice(0, 20)
        .map((m) => `- [${m?.category || 'FACT'}] ${m?.key || ''}: ${m?.content || ''}`)
        .join('\n')
    : '';

  const extractionPrompt = [
    'Analyze the conversation turn below and extract ONLY durable, useful long-term details worth remembering about the user (preferences, communication/language style, ongoing projects, standing instructions, recurring topics, key decisions, personal profile facts).',
    'Ignore greetings, temporary chatter, generic trivia, and sensitive credentials (passwords, API keys, PINs, tokens).',
    'Return strict JSON matching this schema: {"memories":[{"key":"short title","category":"PREFERENCE|PROJECT|INSTRUCTION|TOPIC|DECISION|FACT","content":"concise durable fact","importance":1-5}]}',
    'Return {"memories":[]} if nothing durable was revealed. Maximum 3 items.',
    '',
    'EXISTING MEMORIES:',
    existingSummary || '(none)',
    '',
    'USER MESSAGE:',
    userPrompt.trim().slice(0, 2000),
    '',
    'ASSISTANT REPLY:',
    String(aiReply || '').trim().slice(0, 1500),
  ].join('\n');

  const runExtract = async () => {
    const { text: rawText } = await generateViaFreeProviders({
      geminiRequestBuilder: (candidateModel) => ({
        model: candidateModel,
        contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 768,
          responseMimeType: 'application/json',
          thinkingConfig: buildThinkingConfig(candidateModel, 'fast'),
        },
      }),
      prompt: extractionPrompt,
      temperature: 0.2,
      maxOutputTokens: 768,
      responseJson: true,
      enableBackoff: false,
      contextLabel: 'Memory Extract',
      reasoningMode: 'fast',
    });
    const cleanedJson = rawText
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      return [];
    }

    const candidates = Array.isArray(parsed) ? parsed : parsed?.memories;
    return filterUniqueMemories(candidates, Array.isArray(existingMemories) ? existingMemories : []);
  };

  try {
    let promise = memoryExtractInFlight.get(dedupeKey);
    if (!promise) {
      promise = runExtract().finally(() => {
        memoryExtractInFlight.delete(dedupeKey);
      });
      memoryExtractInFlight.set(dedupeKey, promise);
    }
    const unique = await promise;
    if (memoryExtractCache.size > 40) memoryExtractCache.clear();
    memoryExtractCache.set(dedupeKey, { memories: unique, ts: nowFn() });
    return res.status(200).json({ memories: unique });
  } catch (err) {
    logUpstreamGeminiError('Memory Extract Error', err);
    return res.status(200).json({ memories: [] });
  }
});

// Phase 2 Smart Memory CRUD, Namespace Isolation & Search Endpoints
expressApp.get('/api/memory', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
  const recent = req.query.recent === 'true';
  const memories = memoryStore.getAll({ category, recent, namespace });
  return res.status(200).json({ memories, namespace });
});

expressApp.get('/api/memory/search', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.round(rawLimit))) : 20;
  const memories = memoryStore.search({ query: q, category, limit, namespace });
  return res.status(200).json({ memories, namespace });
});

expressApp.post('/api/memory', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const { key, category = 'FACT', content, importance = 3, id, createdAt, updatedAt } = req.body || {};
  if (typeof key !== 'string' || !key.trim() || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'Both key and content are required to store a memory.',
    });
  }
  if (isPromptTooLong(key) || isPromptTooLong(content)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Memory text exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const outcome = memoryStore.saveOrMerge(
    { id, key, category, content, importance, createdAt, updatedAt },
    namespace
  );
  if (outcome.status === 'blocked_secret') {
    return res.status(400).json({
      code: 'SENSITIVE_SECRET_BLOCKED',
      error: outcome.reason,
      persisted: false,
    });
  }
  if (outcome.status === 'persistence_failed') {
    return res.status(500).json({
      code: 'PERSISTENCE_FAILED',
      error: outcome.reason || 'Unable to persist memory to durable storage.',
      persisted: false,
    });
  }
  if (outcome.status === 'invalid') {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: outcome.reason,
      persisted: false,
    });
  }

  return res.status(outcome.status === 'created' ? 201 : 200).json({
    status: outcome.status,
    persisted: Boolean(outcome.persisted),
    namespace,
    memory: outcome.memory,
    replacedMemory: outcome.replacedMemory || null,
  });
});

expressApp.put('/api/memory/:id', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const { id } = req.params;
  if (!id || !id.trim()) {
    return res.status(400).json({ code: 'INVALID_REQUEST', error: 'Memory id is required.' });
  }
  const { key, category, content, importance } = req.body || {};
  const outcome = memoryStore.updateById(
    id.trim(),
    { key, category, content, importance },
    namespace
  );
  if (!outcome.found) {
    return res.status(404).json({ code: 'NOT_FOUND', error: 'Memory record not found.' });
  }
  if (outcome.error) {
    const status = outcome.code === 'PERSISTENCE_FAILED' ? 500 : 400;
    return res
      .status(status)
      .json({ code: outcome.code || 'INVALID_REQUEST', error: outcome.error, persisted: false });
  }
  return res.status(200).json({ status: 'updated', persisted: true, namespace, memory: outcome.memory });
});

expressApp.delete('/api/memory/all', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const confirmed = req.query.confirm === 'true' || req.body?.confirm === true;
  if (!confirmed) {
    return res.status(400).json({
      code: 'CONFIRMATION_REQUIRED',
      error: 'Explicit confirmation (?confirm=true or {"confirm": true}) is required to clear all memories.',
    });
  }
  try {
    const clearedCount = memoryStore.clearAll(namespace);
    return res.status(200).json({ status: 'cleared', clearedCount, namespace, persisted: true });
  } catch (err) {
    return res.status(500).json({
      code: 'PERSISTENCE_FAILED',
      error: err instanceof Error ? err.message : 'Unable to clear memories.',
      persisted: false,
    });
  }
});

expressApp.delete('/api/memory/:id', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const { id } = req.params;
  const deleted = memoryStore.deleteById(id, namespace);
  if (!deleted) {
    return res.status(404).json({ code: 'NOT_FOUND', error: 'Memory record not found.' });
  }
  return res.status(200).json({ status: 'deleted', id, namespace, persisted: true });
});

// Phase 2 & 3 Persistent Workspace Endpoints: Tasks, Notes, Automations & Hybrid Cross-Device Sync
expressApp.get('/api/tasks', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  return res.status(200).json({ tasks: dataStore.getTasks(namespace), namespace });
});

expressApp.post('/api/tasks', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.upsertTask(req.body || {}, namespace);
  if (!outcome.ok) {
    return res.status(400).json({ code: 'INVALID_REQUEST', error: outcome.error });
  }
  return res.status(outcome.created ? 201 : 200).json({
    task: outcome.task,
    persisted: true,
    namespace,
  });
});

expressApp.put('/api/tasks/:id', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.upsertTask({ ...(req.body || {}), id: req.params.id }, namespace);
  if (!outcome.ok) {
    return res.status(400).json({ code: 'INVALID_REQUEST', error: outcome.error });
  }
  return res.status(200).json({ task: outcome.task, persisted: true, namespace });
});

expressApp.delete('/api/tasks/:id', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.deleteTask(req.params.id, namespace);
  if (!outcome.found) {
    return res.status(404).json({ code: 'NOT_FOUND', error: 'Task not found.' });
  }
  if (!outcome.ok) {
    return res.status(500).json({ code: 'PERSISTENCE_FAILED', error: outcome.error });
  }
  return res.status(200).json({ status: 'deleted', id: req.params.id, persisted: true, namespace });
});

expressApp.get('/api/notes', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  return res.status(200).json({ notes: dataStore.getNotes(namespace), namespace });
});

expressApp.post('/api/notes', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.upsertNote(req.body || {}, namespace);
  if (!outcome.ok) {
    return res.status(400).json({ code: 'INVALID_REQUEST', error: outcome.error });
  }
  return res.status(outcome.created ? 201 : 200).json({
    note: outcome.note,
    persisted: true,
    namespace,
  });
});

expressApp.put('/api/notes/:id', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.upsertNote({ ...(req.body || {}), id: req.params.id }, namespace);
  if (!outcome.ok) {
    return res.status(400).json({ code: 'INVALID_REQUEST', error: outcome.error });
  }
  return res.status(200).json({ note: outcome.note, persisted: true, namespace });
});

expressApp.delete('/api/notes/:id', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.deleteNote(req.params.id, namespace);
  if (!outcome.found) {
    return res.status(404).json({ code: 'NOT_FOUND', error: 'Note not found.' });
  }
  return res.status(200).json({ status: 'deleted', id: req.params.id, persisted: true, namespace });
});

expressApp.get('/api/automations', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  return res.status(200).json({ automations: dataStore.getAutomations(namespace), namespace });
});

expressApp.post('/api/automations', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const outcome = dataStore.recordAutomation(req.body || {}, namespace);
  if (!outcome.ok) {
    return res.status(500).json({ code: 'PERSISTENCE_FAILED', error: outcome.error });
  }
  return res.status(201).json({ entry: outcome.entry, persisted: true, namespace });
});

expressApp.get('/api/sync', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  return res.status(200).json({
    namespace,
    memories: memoryStore.getAll({ namespace }),
    tasks: dataStore.getTasks(namespace),
    notes: dataStore.getNotes(namespace),
    automations: dataStore.getAutomations(namespace),
    syncedAt: Date.now(),
  });
});

expressApp.post('/api/sync', (req, res) => {
  const namespace = resolveRequestNamespace(req);
  const { memories = [], tasks = [], notes = [], automations = [] } = req.body || {};
  const memResult = memoryStore.mergeBatch(memories, namespace);
  const dataResult = dataStore.mergeSyncSnapshot({ tasks, notes, automations }, namespace);
  if (!dataResult.persisted) {
    return res.status(500).json({
      code: 'PERSISTENCE_FAILED',
      error: dataResult.error || 'Failed to persist workspace sync.',
      persisted: false,
    });
  }
  return res.status(200).json({
    namespace,
    persisted: true,
    memories: memResult.memories,
    tasks: dataResult.tasks,
    notes: dataResult.notes,
    automations: dataResult.automations,
    stats: {
      memoriesAdded: memResult.added,
      memoriesUpdated: memResult.updated,
    },
    syncedAt: dataResult.syncedAt,
  });
});

// Natural-Language Smart Reminder Parser Endpoint
expressApp.post('/api/reminders/parse', async (req, res) => {
  const { text, nowIso, timezoneOffsetMinutes } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty reminder text is required.',
    });
  }
  if (isPromptTooLong(text)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const trimmed = text.trim();
  const nowMs = nowIso && Number.isFinite(Date.parse(nowIso)) ? Date.parse(nowIso) : Date.now();
  if (!multiProviderRouter.hasAnyConfiguredProvider() || isBackgroundQuotaPaused()) {
    return res.status(200).json({
      reminder: parseReminderFallback(trimmed, nowMs),
      source: 'local_parser',
    });
  }

  const prompt = [
    'Parse the natural-language reminder request into strict JSON.',
    `Current reference UTC timestamp: ${new Date(nowMs).toISOString()} (client timezone offset minutes from UTC: ${Number(timezoneOffsetMinutes) || 0}).`,
    'Return ONLY JSON matching this schema:',
    '{"title":"concise task title","description":"context or original request","dueTime":"human friendly label e.g. Tomorrow 5:00 PM","delayMinutes":number_or_null,"dueIso":"ISO-8601 timestamp or null","priority":"HIGH|MEDIUM|LOW","category":"REMINDER|TASK|SCHEDULE|NOTE"}',
    'Prefer setting delayMinutes accurately for relative expressions like "in 10 minutes" or "in 2 hours", and dueIso with the user timezone offset applied for explicit dates/times like "tomorrow at 5 pm".',
    '',
    `REQUEST: "${trimmed.slice(0, 500)}"`,
  ].join('\n');

  try {
    const { text: rawText, provider, providerLabel, modelUsed, fallbackUsed } =
      await generateViaFreeProviders({
        geminiRequestBuilder: (candidateModel) => ({
          model: candidateModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.1,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
            thinkingConfig: buildThinkingConfig(candidateModel, 'fast'),
          },
        }),
        prompt,
        temperature: 0.1,
        maxOutputTokens: 512,
        responseJson: true,
        enableBackoff: false,
        contextLabel: 'Reminder Parse',
        reasoningMode: 'fast',
      });

    const cleanedJson = rawText
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(cleanedJson);
    return res.status(200).json({
      reminder: sanitizeParsedReminder(parsed, trimmed, nowMs),
      source: provider === 'gemini' ? 'gemini' : provider,
      provider,
      providerLabel,
      model: modelUsed,
      fallbackUsed,
    });
  } catch (err) {
    logUpstreamGeminiError('Reminder Parse Fallback', err);
    return res.status(200).json({
      reminder: parseReminderFallback(trimmed, nowMs),
      source: 'local_parser',
    });
  }
});

// Daily Executive Briefing Line Endpoint
expressApp.post('/api/briefing', async (req, res) => {
  const {
    tasksSummary = 'No pending tasks logged.',
    weatherSummary = 'Weather telemetry standby.',
    batterySummary = 'Power nominal.',
    language = 'ENGLISH',
  } = req.body || {};

  const combinedInput = `${tasksSummary}\n${weatherSummary}\n${batterySummary}`;
  if (isPromptTooLong(combinedInput)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const fallbackLine =
    'All neural corridors are calibrated and awaiting your command, Sir. Stay focused on your highest-leverage objective today.';

  if (!multiProviderRouter.hasAnyConfiguredProvider() || isBackgroundQuotaPaused()) {
    return res.status(200).json({
      line: fallbackLine,
      source: 'fallback',
      ...(isBackgroundQuotaPaused() ? { skippedReason: 'quota_cooldown' } : {}),
    });
  }

  const cacheKey = `${String(language).slice(0, 32)}|${String(tasksSummary).slice(0, 200)}|${String(weatherSummary).slice(0, 120)}`;
  const cachedBriefing = briefingCache.get(cacheKey);
  if (cachedBriefing && nowFn() - cachedBriefing.ts < BRIEFING_CACHE_TTL_MS) {
    return res.status(200).json({
      line: cachedBriefing.line,
      source: cachedBriefing.source,
      provider: cachedBriefing.provider,
      providerLabel: cachedBriefing.providerLabel,
      model: cachedBriefing.model,
      fallbackUsed: cachedBriefing.fallbackUsed,
      cached: true,
    });
  }

  const prompt = [
    'Compose one crisp, motivating 1-2 sentence JARVIS executive briefing remark addressing the owner as "Sir".',
    `Respond in language: ${String(language).slice(0, 32)}.`,
    `Tasks: ${String(tasksSummary).slice(0, 500)}`,
    `Weather: ${String(weatherSummary).slice(0, 200)}`,
    `Power: ${String(batterySummary).slice(0, 120)}`,
  ].join('\n');

  const fetchBriefingFromFreeProviders = async () => {
    const { text, provider, providerLabel, modelUsed, fallbackUsed } =
      await generateViaFreeProviders({
        geminiRequestBuilder: (candidateModel) => ({
          model: candidateModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.65,
            maxOutputTokens: 256,
            thinkingConfig: buildThinkingConfig(candidateModel, 'fast'),
          },
        }),
        prompt,
        temperature: 0.65,
        maxOutputTokens: 256,
        enableBackoff: false,
        contextLabel: 'Briefing',
        reasoningMode: 'fast',
      });
    return {
      line: text || fallbackLine,
      source: text ? (provider === 'gemini' ? 'gemini' : provider) : 'fallback',
      provider,
      providerLabel,
      model: modelUsed,
      fallbackUsed,
    };
  };

  try {
    let promise = briefingInFlight.get(cacheKey);
    if (!promise) {
      promise = fetchBriefingFromFreeProviders().finally(() => {
        briefingInFlight.delete(cacheKey);
      });
      briefingInFlight.set(cacheKey, promise);
    }
    const result = await promise;
    if (briefingCache.size > 32) briefingCache.clear();
    briefingCache.set(cacheKey, { ...result, ts: nowFn() });
    return res.status(200).json(result);
  } catch (err) {
    logUpstreamGeminiError('Briefing Fallback', err);
    const { classified } = inspectAndClassifyGeminiError(err);
    return res.status(200).json({
      line: fallbackLine,
      source: 'fallback',
      ...(classified.quotaCategory !== 'NONE' ? { quotaCategory: classified.quotaCategory } : {}),
    });
  }
});

// Multimodal Vision Analysis Endpoint (Analysis, OCR, Diagram Explanation & Q&A)
expressApp.post('/api/vision', async (req, res) => {
  const {
    imageBase64,
    mimeType = 'image/jpeg',
    mode = 'analyze',
    question = '',
    prompt = 'Analyze this image in detail as JARVIS, including any visible objects, text (OCR), and anomalies.',
  } = req.body || {};

  const modeDirectives = {
    ocr: 'Extract all visible text verbatim from this image, preserving structure, headings, labels, and tables. Note any partially obscured or uncertain characters clearly.',
    diagram:
      'Explain this diagram, chart, UI screenshot, or technical schematic step-by-step: identify components, relationships/arrows, key metrics, and actionable takeaways.',
    qa: question && String(question).trim()
      ? `Answer the following specific question about this image accurately and distinguish clearly observed details from uncertain inferences: ${String(question).trim()}`
      : prompt,
    analyze: prompt,
  };
  const effectivePrompt = modeDirectives[String(mode || 'analyze').toLowerCase()] || prompt;

  if (isPromptTooLong(effectivePrompt)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  if (!multiProviderRouter.isGeminiConfigured() && !multiProviderRouter.isOpenRouterConfigured()) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'Live Vision analysis requires GEMINI_API_KEY or OPENROUTER_API_KEY configured on the server.',
    });
  }

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({
      code: 'INVALID_IMAGE',
      error: 'Base64 image data is required for vision analysis.',
    });
  }

  // Strip optional data URL prefix if present
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
  if (!cleanBase64) {
    return res.status(400).json({
      code: 'INVALID_IMAGE',
      error: 'Image payload is empty after decoding.',
    });
  }

  const maxImageBytes = process.env.VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024;
  const decodedBytes = Buffer.byteLength(cleanBase64, 'base64');
  if (decodedBytes > maxImageBytes || Buffer.byteLength(imageBase64, 'utf8') > maxImageBytes) {
    return res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      error: process.env.VERCEL
        ? 'Image exceeds the 4MB Vercel serverless upload limit. Please compress or resize the image.'
        : 'Image exceeds the 15MB upload limit.',
    });
  }

  const visionSystemInstruction =
    'You are JARVIS optical reconnaissance intelligence. Provide crisp, accurate visual analysis, OCR text extraction, diagram explanations, and object identification. Never fabricate text or objects not visible in the image. Address the owner as Sir.';

  try {
    const { text, provider, providerLabel, modelUsed, primaryProvider, primaryModel, fallbackUsed } =
      await generateViaFreeProviders({
        geminiRequestBuilder: (candidateModel) => ({
          model: candidateModel,
          contents: [
            {
              role: 'user',
              parts: [
                { text: effectivePrompt },
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction: visionSystemInstruction,
            temperature: 0.35,
            maxOutputTokens: 2048,
            thinkingConfig: buildThinkingConfig(candidateModel, 'fast'),
          },
        }),
        systemInstruction: visionSystemInstruction,
        prompt: effectivePrompt,
        imageAttachment: { mimeType, cleanBase64 },
        temperature: 0.35,
        maxOutputTokens: 2048,
        enableBackoff: true,
        contextLabel: 'Vision',
        reasoningMode: 'fast',
      });

    return res.status(200).json({
      analysis: text || 'No visual details could be extracted, Sir.',
      mode: String(mode || 'analyze').toLowerCase(),
      provider,
      providerLabel,
      primaryProvider,
      model: modelUsed,
      primaryModel,
      fallbackUsed,
    });
  } catch (err) {
    logUpstreamGeminiError('Vision Error', err);
    const { httpStatus, payload } = buildGeminiErrorPayload(err);
    return res.status(httpStatus).json(payload);
  }
});

// Phase 4: Real Live Web Search Endpoint (Gemini Google Search Grounding + Optional Tavily API)
expressApp.post('/api/search', async (req, res) => {
  const { query = '', language = 'ENGLISH', preferTavily = true } = req.body || {};
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty search query is required.',
    });
  }
  if (isPromptTooLong(trimmedQuery)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Query exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const ai = getGeminiClient();
  const hasAnyAi = multiProviderRouter.hasAnyConfiguredProvider();
  const tavilyApiKey = process.env.TAVILY_API_KEY || '';
  const tavilyResult = preferTavily
    ? await fetchTavilyResults(trimmedQuery, tavilyApiKey, options.fetchImpl || fetch)
    : { used: false, sources: [], answer: '', error: null };

  if (!ai && !(tavilyResult.used && tavilyResult.sources.length > 0)) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'Live web search requires GEMINI_API_KEY (for Gemini Google Search grounding) or TAVILY_API_KEY configured on the server.',
    });
  }

  if (!ai && !hasAnyAi && tavilyResult.used && tavilyResult.sources.length > 0) {
    return res.status(200).json({
      query: trimmedQuery,
      summary:
        tavilyResult.answer ||
        `Found ${tavilyResult.sources.length} live web sources via Tavily Search.`,
      verifiedFacts: tavilyResult.answer ? [tavilyResult.answer] : [],
      uncertainNotes: [
        'GEMINI_API_KEY is not configured on the server; returning raw Tavily live search results without AI synthesis.',
      ],
      sources: tavilyResult.sources,
      providersUsed: ['tavily'],
      tavilyWarning: tavilyResult.error,
      model: null,
    });
  }

  const activeModel = getActiveModel();
  const tavilyContextBlock =
    tavilyResult.sources.length > 0
      ? `\n\nSupplemental Tavily Live Web Snippets:\n${tavilyResult.sources
          .map((s, idx) => `${idx + 1}. ${s.title} (${s.uri})\n   ${s.snippet}`)
          .join('\n')}`
      : '';

  const researchPrompt = [
    `Perform live web research on: "${trimmedQuery}"`,
    `Language: ${String(language || 'ENGLISH').slice(0, 32)}.`,
    'Format your response cleanly with these exact markdown headings:',
    '## Executive Summary',
    '(Concise synthesis directly answering the query.)',
    '## Verified Facts',
    '- Bullet points of verifiable facts grounded in live search sources.',
    '## Uncertain / Caveats',
    '- Bullet points noting any conflicting reports, fast-changing figures, or gaps where sources were insufficient.',
    'Never invent URLs or facts.',
    tavilyContextBlock,
  ].join('\n');

  try {
    const {
      response,
      text,
      provider,
      providerLabel,
      modelUsed,
      primaryProvider,
      primaryModel,
      fallbackUsed,
    } = await generateViaFreeProviders({
      geminiRequestBuilder: (candidateModel) => ({
        model: candidateModel,
        contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
        config: {
          temperature: 0.25,
          maxOutputTokens: 2048,
          tools: [{ googleSearch: {} }],
          thinkingConfig: buildThinkingConfig(candidateModel, 'structured'),
        },
      }),
      prompt: researchPrompt,
      allowNonGeminiFallback: tavilyResult.used && tavilyResult.sources.length > 0,
      temperature: 0.25,
      maxOutputTokens: 2048,
      enableBackoff: true,
      contextLabel: 'Live Web Search',
      reasoningMode: 'structured',
    });

    const geminiSources = provider === 'gemini' ? extractGroundingSourcesFromResponse(response) : [];
    const mergedSources = mergeVerifiedSources(geminiSources, tavilyResult.sources);
    const structured = parseStructuredResearchMarkdown(text || response?.text || '');
    const providersUsed = [
      ...(provider === 'gemini'
        ? geminiSources.length > 0
          ? ['gemini_google_search']
          : ['gemini']
        : [provider]),
      ...(tavilyResult.used ? ['tavily'] : []),
    ];

    if (mergedSources.length === 0) {
      structured.uncertainNotes.push(
        'No external web grounding links were returned for this query; treat details as model-synthesized until verified against primary sources.'
      );
    }

    return res.status(200).json({
      query: trimmedQuery,
      summary: structured.summary || 'No search summary returned.',
      verifiedFacts: structured.verifiedFacts,
      uncertainNotes: structured.uncertainNotes,
      uncertainPoints: structured.uncertainNotes,
      sources: mergedSources,
      providersUsed,
      tavilyWarning: tavilyResult.error,
      provider,
      providerLabel,
      primaryProvider,
      model: modelUsed,
      primaryModel,
      fallbackUsed,
    });
  } catch (err) {
    logUpstreamGeminiError('Live Web Search Error', err);
    if (tavilyResult.used && tavilyResult.sources.length > 0) {
      const notes = ['AI synthesis failed; review the verified Tavily source links directly.'];
      return res.status(200).json({
        query: trimmedQuery,
        summary:
          tavilyResult.answer ||
          `AI synthesis encountered an error; showing ${tavilyResult.sources.length} verified Tavily results.`,
        verifiedFacts: tavilyResult.answer ? [tavilyResult.answer] : [],
        uncertainNotes: notes,
        uncertainPoints: notes,
        sources: tavilyResult.sources,
        providersUsed: ['tavily'],
        model: activeModel,
      });
    }
    const { httpStatus, payload } = buildGeminiErrorPayload(err);
    return res.status(httpStatus).json(payload);
  }
});

// Phase 4: Document Parsing & Intelligence Endpoint (PDF, DOCX, TXT, MD, CSV, JSON)
expressApp.post('/api/documents/parse', async (req, res) => {
  const {
    fileName = 'document',
    mimeType = '',
    fileBase64 = '',
    textContent = '',
    action = 'parse',
    question = '',
    language = 'ENGLISH',
  } = req.body || {};

  let parsedDoc;
  try {
    parsedDoc = parseDocumentPayload({ fileName, mimeType, fileBase64, textContent });
  } catch (err) {
    return res.status(400).json({
      code: 'DOCUMENT_PARSE_ERROR',
      error: err instanceof Error ? err.message : 'Unable to parse uploaded document.',
    });
  }

  const rawAction = String(action || 'parse').toLowerCase();
  const normalizedAction =
    rawAction === 'extract_only'
      ? 'parse'
      : rawAction === 'extract_facts'
        ? 'extract'
        : rawAction;

  if (normalizedAction === 'parse' && parsedDoc.kind !== 'pdf') {
    return res.status(200).json({
      fileName: parsedDoc.fileName,
      kind: parsedDoc.kind,
      mimeType: parsedDoc.mimeType,
      text: parsedDoc.text,
      extractedText: parsedDoc.text,
      charCount: parsedDoc.charCount,
      wordCount: parsedDoc.wordCount,
      excerpt: parsedDoc.text.slice(0, 600),
    });
  }

  const ai = getGeminiClient();
  const hasAnyAi = multiProviderRouter.hasAnyConfiguredProvider();
  if ((parsedDoc.kind === 'pdf' && !ai) || (parsedDoc.kind !== 'pdf' && !hasAnyAi)) {
    if (parsedDoc.kind !== 'pdf') {
      return res.status(200).json({
        fileName: parsedDoc.fileName,
        kind: parsedDoc.kind,
        mimeType: parsedDoc.mimeType,
        text: parsedDoc.text,
        extractedText: parsedDoc.text,
        charCount: parsedDoc.charCount,
        wordCount: parsedDoc.wordCount,
        excerpt: parsedDoc.text.slice(0, 600),
        analysis: null,
        answer: null,
        warning: 'Document parsed locally, but no free AI provider API key is configured for AI analysis.',
      });
    }
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error: 'GEMINI_API_KEY is required to read and analyze PDF documents.',
    });
  }

  const actionPrompts = {
    summarize: `Read this document (${parsedDoc.fileName}) and produce: (1) Executive Summary, (2) Key Facts & Figures, (3) Important Action Items / Decisions. Respond in ${language}.`,
    extract: `Extract all important structured information (entities, dates, deadlines, decisions, requirements, key numbers) from ${parsedDoc.fileName} in clean bullet lists. Respond in ${language}.`,
    qa: `Answer the following question strictly based on the attached document (${parsedDoc.fileName}). If the document does not contain the answer, say so explicitly.\n\nQuestion: ${String(question || '').trim() || 'Summarize the main purpose of this document.'}`,
    parse: `Extract the core textual content and provide a concise overview of ${parsedDoc.fileName}. Respond in ${language}.`,
  };
  const instructionText = actionPrompts[normalizedAction] || actionPrompts.summarize;
  const textDocumentPrompt = `${instructionText}\n\n[DOCUMENT: ${parsedDoc.fileName}]\n${parsedDoc.text.slice(0, 48000)}`;

  const parts =
    parsedDoc.kind === 'pdf'
      ? [
          { text: instructionText },
          { inlineData: { mimeType: 'application/pdf', data: parsedDoc.cleanBase64 } },
        ]
      : [{ text: textDocumentPrompt }];

  try {
    const {
      text: aiAnalysis,
      provider,
      providerLabel,
      modelUsed,
      primaryProvider,
      primaryModel,
      fallbackUsed,
    } = await generateViaFreeProviders({
      geminiRequestBuilder: (candidateModel) => ({
        model: candidateModel,
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0.25,
          maxOutputTokens: 3072,
          thinkingConfig: buildThinkingConfig(candidateModel, 'structured'),
        },
      }),
      prompt: textDocumentPrompt,
      allowNonGeminiFallback: parsedDoc.kind !== 'pdf',
      temperature: 0.25,
      maxOutputTokens: 3072,
      enableBackoff: true,
      contextLabel: 'Document Intelligence',
      reasoningMode: 'structured',
    });

    return res.status(200).json({
      fileName: parsedDoc.fileName,
      kind: parsedDoc.kind,
      mimeType: parsedDoc.mimeType,
      text: parsedDoc.text || '',
      extractedText: parsedDoc.text || '',
      charCount: parsedDoc.charCount,
      wordCount: parsedDoc.wordCount,
      excerpt: (parsedDoc.text || aiAnalysis).slice(0, 600),
      analysis: aiAnalysis,
      answer: aiAnalysis,
      provider,
      providerLabel,
      primaryProvider,
      model: modelUsed,
      primaryModel,
      fallbackUsed,
    });
  } catch (err) {
    logUpstreamGeminiError('Document Intelligence Error', err);
    const { httpStatus, payload } = buildGeminiErrorPayload(err);
    return res.status(httpStatus).json(payload);
  }
});

// Phase 4: Advanced Productivity Studio — Reports, Long Summaries, Structured Notes, Study Guides, Coding Explanations
expressApp.post('/api/reports/generate', async (req, res) => {
  const {
    type,
    reportType,
    title = '',
    sourceText = '',
    language = 'ENGLISH',
  } = req.body || {};

  const cleanSource = String(sourceText || '').trim();
  if (!cleanSource) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'Provide source text, topic, code, or document excerpts to generate a deliverable.',
    });
  }

  if (!multiProviderRouter.hasAnyConfiguredProvider()) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'A free AI provider API key (GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY) is required on the server to generate AI reports and study materials.',
    });
  }

  const templates = {
    report:
      'Generate a polished, publication-ready Executive Report in Markdown with Title, Executive Summary, Key Findings, Risk/Trade-Off Analysis, and Actionable Recommendations.',
    executive_report:
      'Generate a polished, publication-ready Executive Report in Markdown with Title, Executive Summary, Key Findings, Risk/Trade-Off Analysis, and Actionable Recommendations.',
    long_summary:
      'Generate a comprehensive multi-section summary of the provided long document in Markdown with TL;DR, Section-by-Section Highlights, Critical Data Points, and Open Questions.',
    structured_notes:
      'Convert the input into crisp, structured Cornell-style Notes in Markdown with Topic Headings, Key Concepts, Bullet Details, and Quick Recall Summary.',
    study_guide:
      'Generate complete Study Materials in Markdown: Core Concepts Explained Simply, Key Terminology Glossary, 5 Practice Quiz Questions with Answers, and Memory Flashcard Pairs.',
    coding_explanation:
      'Provide a thorough Senior-Engineer Coding Explanation in Markdown: High-Level Architecture, Line-by-Line / Block Walkthrough, Complexity & Edge Cases, and Concrete Improvement Suggestions.',
  };

  const requestedType = String(reportType || type || 'report').toLowerCase();
  const normalizedType = Object.prototype.hasOwnProperty.call(templates, requestedType)
    ? requestedType
    : 'report';
  const prompt = [
    templates[normalizedType],
    `Target Language: ${String(language || 'ENGLISH').slice(0, 32)}.`,
    title ? `Title / Focus: ${String(title).trim().slice(0, 140)}` : '',
    '',
    'SOURCE MATERIAL / TOPIC:',
    cleanSource.slice(0, 48000),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const {
      text: markdown,
      provider,
      providerLabel,
      modelUsed,
      primaryProvider,
      primaryModel,
      fallbackUsed,
    } = await generateViaFreeProviders({
      geminiRequestBuilder: (candidateModel) => ({
        model: candidateModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.35,
          maxOutputTokens: 4096,
          thinkingConfig: buildThinkingConfig(candidateModel, 'structured'),
        },
      }),
      prompt,
      temperature: 0.35,
      maxOutputTokens: 4096,
      enableBackoff: true,
      contextLabel: 'Report Generator',
      reasoningMode: 'structured',
    });

    const wordCount = markdown ? markdown.split(/\s+/).filter(Boolean).length : 0;
    return res.status(200).json({
      type: normalizedType,
      reportType: normalizedType === 'report' ? 'executive_report' : normalizedType,
      title: String(title || `JARVIS ${normalizedType.replace(/_/g, ' ')}`).trim(),
      markdown,
      content: markdown,
      wordCount,
      generatedAt: Date.now(),
      provider,
      providerLabel,
      primaryProvider,
      model: modelUsed,
      primaryModel,
      fallbackUsed,
    });
  } catch (err) {
    logUpstreamGeminiError('Report Generator Error', err);
    const { httpStatus, payload } = buildGeminiErrorPayload(err);
    return res.status(httpStatus).json(payload);
  }
});

// Phase 5: Smart Task Suggestions based on user's active tasks, memories & language
expressApp.post('/api/tasks/suggest', async (req, res) => {
  const { tasks = [], memories = [], language = 'ENGLISH' } = req.body || {};

  const buildHeuristicSuggestions = () => [
    {
      title: 'Review and prioritize high-impact pending tasks',
      description: 'Triage pending items by deadline and clear quick wins first.',
      dueTime: 'Today 18:00',
      priority: 'HIGH',
      category: 'TASK',
    },
    {
      title: 'Summarize today’s key notes & decisions',
      description: 'Capture takeaways in the Memory Vault or Notes dashboard.',
      dueTime: 'Tonight 21:00',
      priority: 'MEDIUM',
      category: 'NOTE',
    },
    {
      title: 'Plan tomorrow’s top 3 focus blocks',
      description: 'Reserve uninterrupted deep work time for your primary project.',
      dueTime: 'Tomorrow 09:00',
      priority: 'MEDIUM',
      category: 'SCHEDULE',
    },
  ];

  if (!multiProviderRouter.hasAnyConfiguredProvider() || isBackgroundQuotaPaused()) {
    return res.status(200).json({ suggestions: buildHeuristicSuggestions(), source: 'heuristic' });
  }

  const pendingList = (Array.isArray(tasks) ? tasks : [])
    .filter((t) => t && !t.isCompleted)
    .slice(0, 10)
    .map((t) => `- [${t.priority || 'MEDIUM'}] ${t.title} (${t.dueTime || 'Unscheduled'})`)
    .join('\n');
  const memList = (Array.isArray(memories) ? memories : [])
    .slice(0, 8)
    .map((m) => `- [${m.category || 'FACT'}] ${m.key}: ${m.content}`)
    .join('\n');

  const prompt = [
    'Suggest 3 smart, actionable, non-duplicate next tasks for the user based on their current pending queue and long-term memories.',
    `Target language: ${String(language || 'ENGLISH').slice(0, 32)}.`,
    'Return strict JSON: {"suggestions":[{"title":"short title","description":"clear rationale","dueTime":"e.g. Today 17:00","priority":"HIGH|MEDIUM|LOW","category":"TASK|REMINDER|SCHEDULE|NOTE"}]}',
    '',
    'PENDING TASKS:',
    pendingList || '(none)',
    '',
    'USER MEMORIES:',
    memList || '(none)',
  ].join('\n');

  try {
    const { text, provider, providerLabel, modelUsed, fallbackUsed } =
      await generateViaFreeProviders({
        geminiRequestBuilder: (candidateModel) => ({
          model: candidateModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            temperature: 0.4,
            maxOutputTokens: 768,
            responseMimeType: 'application/json',
            thinkingConfig: buildThinkingConfig(candidateModel, 'fast'),
          },
        }),
        prompt,
        temperature: 0.4,
        maxOutputTokens: 768,
        responseJson: true,
        enableBackoff: false,
        contextLabel: 'Task Suggestions',
        reasoningMode: 'fast',
      });
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions.slice(0, 5) : [];
    return res.status(200).json({
      suggestions: list.length > 0 ? list : buildHeuristicSuggestions(),
      source: list.length > 0 ? (provider === 'gemini' ? 'gemini' : provider) : 'heuristic',
      provider,
      providerLabel,
      model: modelUsed,
      fallbackUsed,
    });
  } catch {
    return res.status(200).json({ suggestions: buildHeuristicSuggestions(), source: 'heuristic' });
  }
});

// Lyria 3 AI Music Generation Endpoint (lyria-3-clip-preview / lyria-3-pro-preview)
expressApp.post('/api/music/generate', async (req, res) => {
  const { prompt, mode = 'clip', lyrics = '' } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty music prompt is required.',
    });
  }
  if (isPromptTooLong(prompt) || isPromptTooLong(lyrics)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY to generate music with Lyria 3.',
    });
  }

  const normalizedMode = mode === 'pro' ? 'pro' : 'clip';
  const model = normalizedMode === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
  const combinedInput =
    typeof lyrics === 'string' && lyrics.trim()
      ? `${prompt.trim()}\n\nLyrics / Structural Notes:\n${lyrics.trim()}`
      : prompt.trim();

  const extractAudioAndTextFromInteraction = async (interaction) => {
    let audioBase64 = '';
    let mimeType = 'audio/mpeg';
    const textBlocks = [];

    const outputs = Array.isArray(interaction?.outputs) ? interaction.outputs : [];
    for (const block of outputs) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'audio') {
        if (typeof block.mime_type === 'string' && block.mime_type) {
          mimeType = block.mime_type;
        }
        if (typeof block.data === 'string' && block.data) {
          audioBase64 = block.data;
        } else if (typeof block.uri === 'string' && block.uri.startsWith('http')) {
          const fileRes = await fetch(block.uri, {
            headers: { 'x-goog-api-key': (process.env.GEMINI_API_KEY || '').trim() },
          });
          if (fileRes.ok) {
            const arrBuf = await fileRes.arrayBuffer();
            audioBase64 = Buffer.from(arrBuf).toString('base64');
            const headerMime = fileRes.headers.get('content-type');
            if (headerMime && headerMime.startsWith('audio/')) {
              mimeType = headerMime.split(';')[0];
            }
          }
        }
      } else if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        textBlocks.push(block.text.trim());
      }
    }

    return {
      audioBase64,
      mimeType,
      lyricsText: textBlocks.join('\n\n'),
    };
  };

  try {
    const runMusicGeneration = async () => {
      let audioBase64 = '';
      let mimeType = 'audio/mpeg';
      let lyricsText = '';

      try {
        let interaction;
        try {
          interaction = await ai.interactions.create({
            model,
            input: combinedInput,
            response_modalities: ['audio', 'text'],
          });
        } catch (modalityErr) {
          const { httpStatus, upstreamMessage } = extractGeminiErrorDetails(modalityErr);
          if ((!httpStatus || httpStatus === 400) && /response_modalities|modality|Invalid/i.test(upstreamMessage)) {
            interaction = await ai.interactions.create({
              model,
              input: combinedInput,
            });
          } else {
            throw modalityErr;
          }
        }
        ({ audioBase64, mimeType, lyricsText } = await extractAudioAndTextFromInteraction(interaction));
      } catch (interactionErr) {
        const { classified } = inspectAndClassifyGeminiError(interactionErr);
        // Never duplicate quota/rate-limit/auth requests onto a second API call
        if (
          classified.quotaCategory !== 'NONE' ||
          classified.code === 'GEMINI_AUTH_ERROR' ||
          classified.code === 'GEMINI_RATE_LIMIT'
        ) {
          throw interactionErr;
        }
        // Fallback to generateContent only if Interactions endpoint is unavailable in the project/SDK route
        const response = await ai.models.generateContent({
          model,
          contents: combinedInput,
          config: {
            responseModalities: ['AUDIO', 'TEXT'],
          },
        });

        const parts = response?.candidates?.[0]?.content?.parts || [];
        const textParts = [];
        for (const part of parts) {
          if (part?.inlineData?.data && String(part.inlineData.mimeType || '').startsWith('audio/')) {
            audioBase64 = part.inlineData.data;
            mimeType = part.inlineData.mimeType || 'audio/mpeg';
          } else if (typeof part?.text === 'string' && part.text.trim()) {
            textParts.push(part.text.trim());
          }
        }
        lyricsText = textParts.join('\n\n');

        if (!audioBase64) {
          throw interactionErr;
        }
      }

      return { audioBase64, mimeType, lyricsText };
    };

    const { audioBase64, mimeType, lyricsText } = await executeWithGeminiBackoff(() => runMusicGeneration(), {
      ...retryOptions,
      onRetry: ({ attempt, maxRetries, delayMs, classified }) => {
        console.warn(
          `[JARVIS Lyria Backoff] Temporary ${classified.code} (HTTP ${classified.httpStatus}); retry ${attempt}/${maxRetries} in ${delayMs}ms`
        );
      },
    });

    quotaTracker.recordSuccess();

    if (!audioBase64) {
      return res.status(500).json({
        code: 'EMPTY_AUDIO',
        error: `Lyria (${model}) completed without returning playable audio data.`,
      });
    }

    return res.status(200).json({
      audioBase64,
      mimeType,
      lyrics: lyricsText,
      model,
      mode: normalizedMode,
      durationLabel: normalizedMode === 'pro' ? 'Full Track' : '30s Clip',
      prompt: prompt.trim(),
    });
  } catch (err) {
    logUpstreamGeminiError('Lyria Music Error', err);
    const { classified, httpStatus, payload } = buildGeminiErrorPayload(err);
    quotaTracker.recordError(classified);
    return res.status(httpStatus).json(payload);
  }
});

  // Avoid 404 console noise for browser default /favicon.ico requests
  expressApp.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });

  // Structured 404 for unknown API endpoints (including bare /api)
  expressApp.all('/api', (_req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      error: 'API route not found. Use /api/health for server diagnostics.',
    });
  });
  expressApp.use('/api/*', (_req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      error: 'API route not found.',
    });
  });

  // Serve static Vite build in production / preview whenever dist/index.html exists
  const distIndexFile = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndexFile)) {
    expressApp.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );

    expressApp.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }
      // Never serve HTML for missing hashed bundle/asset files
      if (
        req.path.startsWith('/assets/') ||
        /\.(?:js|mjs|css|map|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|json)$/i.test(req.path)
      ) {
        return res.status(404).type('text/plain').send('Asset not found');
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(distIndexFile);
    });
  } else {
    expressApp.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }
      return res.status(200).json({
        message:
          'JARVIS Backend API is running. Run `npm run build` to build the frontend bundle before serving SPA routes.',
        health: '/api/health',
      });
    });
  }

  // Final catch-all error handler so unhandled exceptions never crash the server or emit raw HTML
  expressApp.use((err, _req, res, _next) => {
    console.error('[JARVIS Express Error]', err?.message || err);
    if (res.headersSent) return;
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      error: 'An unexpected server error occurred. Please retry.',
    });
  });

  return expressApp;
}

export const app = createApp();

// Start HTTP server once when executed directly (supports Cloud Run, AI Studio Preview & Vercel serverless)
let isMainModule = false;
if (typeof process.argv[1] === 'string') {
  try {
    isMainModule = fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename);
  } catch {
    isMainModule = path.resolve(process.argv[1]) === __filename;
  }
}

let activeServer = null;
let isShuttingDown = false;

function startServerOnce() {
  if (activeServer) return activeServer;

  const server = app.listen(PORT, HOST, () => {
    const distReady = fs.existsSync(path.join(distDir, 'index.html'));
    console.log(
      `JARVIS Cosmic Server listening on http://${HOST}:${PORT} (PID ${process.pid}, SPA bundle: ${distReady ? 'ready' : 'api-only'})`
    );
  });

  // Match reverse proxy keep-alive & long-running SSE/Lyria stream timeouts
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 300_000;

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(`[JARVIS Server] Port ${PORT} is already in use. Exiting cleanly without retry loop.`);
    } else {
      console.error('[JARVIS Server Error]', err);
    }
    process.exit(1);
  });

  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[JARVIS Server] Received ${signal}. Closing HTTP server gracefully...`);
    const forceTimer = setTimeout(() => {
      console.warn('[JARVIS Server] Forced exit after graceful shutdown timeout.');
      process.exit(0);
    }, 5000);
    forceTimer.unref();

    server.close(() => {
      clearTimeout(forceTimer);
      console.log('[JARVIS Server] HTTP server closed cleanly.');
      process.exit(0);
    });
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('[JARVIS Unhandled Rejection]', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[JARVIS Uncaught Exception]', err);
  });

  activeServer = server;
  return server;
}

if (isMainModule && !process.env.VERCEL) {
  startServerOnce();
}
