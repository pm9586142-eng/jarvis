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
import { createMemoryStore } from './memoryStore.js';
import { parseReminderFallback, sanitizeParsedReminder } from '../src/services/reminderParser.js';
import { analyzeBrainRequest, classifyGeminiError } from '../src/services/brainEngine.js';

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

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const DEPRECATED_GEMINI_MODEL_PATTERNS = [
  /^gemini-1\.5(?:-|$)/i,
  /^gemini-2\.0(?:-|$)/i,
  /^gemini-2\.5-flash(?:[-a-z0-9.]*)?$/i,
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

function extractGeminiErrorInfo(err) {
  let statusCode = Number(err?.status || err?.statusCode || err?.code);
  if (!Number.isFinite(statusCode)) statusCode = undefined;
  let message = String(err?.message || '').trim();

  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      const inner = parsed?.error || parsed;
      if (typeof inner?.message === 'string' && inner.message.trim()) {
        message = inner.message.trim();
      }
      if (!statusCode && Number.isFinite(Number(inner?.code))) {
        statusCode = Number(inner.code);
      }
    } catch {
      // Preserve raw message when not JSON
    }
  }

  return { statusCode, message };
}

function httpStatusForGeminiErrorCode(code) {
  switch (code) {
    case 'GEMINI_AUTH_ERROR':
      return 401;
    case 'GEMINI_MODEL_NOT_FOUND':
      return 404;
    case 'GEMINI_RATE_LIMIT':
      return 429;
    case 'GEMINI_BAD_REQUEST':
      return 400;
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
  });

  // Configure CORS (supports GET, POST, PUT, DELETE for memory management)
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  expressApp.use(
    cors({
      origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
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
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const geminiConfigured =
      typeof options.geminiClientFactory === 'function' ||
      Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey !== 'your_api_key_here');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ok',
      service: 'jarvis-cosmic-backend',
      endpoint: req.path,
      geminiConfigured,
      authRequired: Boolean(getAccessToken()),
      model: getActiveModel(),
      musicModels: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
      capabilities: [
        'streaming',
        'multimodal',
        'summarization',
        'intent-detection',
        'hinglish',
        'memory-extraction',
        'memory-crud',
        'smart-retrieval',
        'web-grounding',
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
        error: 'Rate limit exceeded: maximum 30 requests per minute per IP.',
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

async function generateContentWithThinkingFallback(ai, request) {
  try {
    return await ai.models.generateContent(request);
  } catch (err) {
    const { message } = extractGeminiErrorInfo(err);
    if (request?.config?.thinkingConfig && /thinking|budget|level|thinkingConfig|unsupported/i.test(message)) {
      const { thinkingConfig: _dropped, ...fallbackConfig } = request.config;
      return ai.models.generateContent({
        ...request,
        config: fallbackConfig,
      });
    }
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

// Streaming Gemini Chat Endpoint (SSE)
expressApp.post('/api/chat/stream', async (req, res) => {
  const {
    prompt,
    systemInstruction,
    history = [],
    enableWebSearch = false,
    conversationSummary = '',
    preferredLanguage = 'ENGLISH',
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

  const ai = getGeminiClient();
  if (!ai) {
    // Use HTTP 424 (Failed Dependency) so reverse proxies intercepting 502/503/504 preserve JSON error payloads
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error:
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in your server environment variables or Secrets.',
    });
  }

  const analysis = analyzeBrainRequest({
    prompt,
    history: Array.isArray(history) ? history : [],
    preferredLanguage,
    conversationSummary,
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

  const activeModel = getActiveModel();

  sendEvent({
    meta: {
      intent: analysis.intent,
      detectedLanguage: analysis.detectedLanguage,
      isFollowUp: analysis.isFollowUp,
      reasoningMode: analysis.reasoningMode,
      recommendedAgent: analysis.recommendedAgent,
      contextTurns: analysis.contextWindow.recentMessages.length,
      earlierTurnsCount: analysis.contextWindow.earlierCount,
      model: activeModel,
    },
  });

  const contents = buildAlternatingContents(analysis.contextWindow.recentMessages, prompt);
  let emittedAnyChunk = false;

  const runStream = async (useSearch, includeThinkingConfig) => {
    const config = {
      temperature: analysis.intent === 'CODING' ? 0.45 : 0.7,
      maxOutputTokens: 4096,
    };

    if (includeThinkingConfig) {
      config.thinkingConfig = buildThinkingConfig(activeModel, analysis.reasoningMode);
    }

    if (mergedSystemInstruction) {
      config.systemInstruction = mergedSystemInstruction;
    }

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const streamResult = await ai.models.generateContentStream({
      model: activeModel,
      contents,
      config,
    });

    const collectedSources = new Map();

    for await (const chunk of streamResult) {
      if (clientClosed) break;

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

    return { collectedSources };
  };

  try {
    let activeSearch = Boolean(enableWebSearch);
    let includeThinkingConfig = true;
    let result;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await runStream(activeSearch, includeThinkingConfig);
        break;
      } catch (attemptErr) {
        const { message: msg } = extractGeminiErrorInfo(attemptErr);
        if (
          activeSearch &&
          !emittedAnyChunk &&
          /google_search|googleSearch|search.*grounding|Tool.*not supported/i.test(msg)
        ) {
          activeSearch = false;
          continue;
        }
        if (
          includeThinkingConfig &&
          !emittedAnyChunk &&
          /thinking|budget|level|thinkingConfig|unsupported/i.test(msg)
        ) {
          includeThinkingConfig = false;
          continue;
        }
        throw attemptErr;
      }
    }

    if (result?.collectedSources?.size > 0) {
      sendEvent({ sources: Array.from(result.collectedSources.values()) });
    }

    sendEvent({ done: true });
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error('[JARVIS Gemini Stream Error]', err);
    const { statusCode, message } = extractGeminiErrorInfo(err);
    const classified = classifyGeminiError(statusCode, message);
    sendEvent({ error: classified.message, code: classified.code });
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
  } = req.body || {};

  if (isPromptTooLong(prompt)) {
    return res.status(400).json({
      code: 'PROMPT_TOO_LONG',
      error: `Prompt exceeds maximum allowed length of ${MAX_PROMPT_CHARS} characters.`,
    });
  }

  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'An encoded fileBase64 attachment is required.',
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  const safeMime = String(mimeType || '').trim().toLowerCase();
  const isAllowedMime =
    safeMime.startsWith('image/') ||
    safeMime === 'application/pdf' ||
    safeMime.startsWith('text/');

  if (!isAllowedMime) {
    return res.status(400).json({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      error: `Unsupported attachment MIME type "${safeMime || 'unknown'}". Supported: images, PDF, and text files.`,
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

  const effectivePrompt =
    typeof prompt === 'string' && prompt.trim()
      ? prompt.trim()
      : `Please analyze this attached file (${String(fileName).slice(0, 80)}) and summarize its key contents.`;

  const analysis = analyzeBrainRequest({
    prompt: effectivePrompt,
    history: Array.isArray(history) ? history : [],
    preferredLanguage,
    conversationSummary,
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

  const activeModel = getActiveModel();

  sendEvent({
    meta: {
      intent: analysis.intent,
      detectedLanguage: analysis.detectedLanguage,
      isFollowUp: analysis.isFollowUp,
      reasoningMode: analysis.reasoningMode,
      recommendedAgent: analysis.recommendedAgent,
      contextTurns: analysis.contextWindow.recentMessages.length,
      earlierTurnsCount: analysis.contextWindow.earlierCount,
      model: activeModel,
    },
  });

  const contents = buildAlternatingContents(analysis.contextWindow.recentMessages, effectivePrompt);
  const lastTurn = contents[contents.length - 1];
  if (lastTurn && Array.isArray(lastTurn.parts)) {
    lastTurn.parts.push({
      inlineData: {
        mimeType: safeMime,
        data: cleanBase64,
      },
    });
  }

  let emittedAnyChunk = false;
  const runStream = async (useSearch, includeThinkingConfig) => {
    const config = {
      temperature: 0.5,
      maxOutputTokens: 4096,
    };
    if (includeThinkingConfig) {
      config.thinkingConfig = buildThinkingConfig(activeModel, analysis.reasoningMode);
    }
    if (mergedSystemInstruction) {
      config.systemInstruction = mergedSystemInstruction;
    }
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const streamResult = await ai.models.generateContentStream({
      model: activeModel,
      contents,
      config,
    });

    const collectedSources = new Map();
    for await (const chunk of streamResult) {
      if (clientClosed) break;
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
    return { collectedSources };
  };

  try {
    let activeSearch = Boolean(enableWebSearch);
    let includeThinkingConfig = true;
    let result;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await runStream(activeSearch, includeThinkingConfig);
        break;
      } catch (attemptErr) {
        const { message: msg } = extractGeminiErrorInfo(attemptErr);
        if (
          activeSearch &&
          !emittedAnyChunk &&
          /google_search|googleSearch|search.*grounding|Tool.*not supported/i.test(msg)
        ) {
          activeSearch = false;
          continue;
        }
        if (
          includeThinkingConfig &&
          !emittedAnyChunk &&
          /thinking|budget|level|thinkingConfig|unsupported/i.test(msg)
        ) {
          includeThinkingConfig = false;
          continue;
        }
        throw attemptErr;
      }
    }

    if (result?.collectedSources?.size > 0) {
      sendEvent({ sources: Array.from(result.collectedSources.values()) });
    }
    sendEvent({ done: true });
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error('[JARVIS Multimodal Stream Error]', err);
    const { statusCode, message } = extractGeminiErrorInfo(err);
    const classified = classifyGeminiError(statusCode, message);
    sendEvent({ error: classified.message, code: classified.code });
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

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error: 'GEMINI_API_KEY is not configured on the server.',
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

  const activeModel = getActiveModel();

  try {
    const response = await generateContentWithThinkingFallback(ai, {
      model: activeModel,
      contents: [{ role: 'user', parts: [{ text: summarizePrompt }] }],
      config: {
        temperature: 0.25,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: buildThinkingConfig(activeModel, 'fast'),
      },
    });

    const rawText = (response.text || '').trim();
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
        model: activeModel,
      });
    } catch {
      return res.status(200).json({
        summary: rawText,
        keyPoints: [],
        actionItems: [],
        language: String(language || 'ENGLISH'),
        model: activeModel,
      });
    }
  } catch (err) {
    console.error('[JARVIS Summarize Error]', err);
    const { statusCode, message } = extractGeminiErrorInfo(err);
    const classified = classifyGeminiError(statusCode, message);
    return res.status(httpStatusForGeminiErrorCode(classified.code)).json({
      code: classified.code,
      error: classified.message,
    });
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
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(424).json({
      code: 'MISSING_API_KEY',
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }
  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length < 6) {
    return res.status(200).json({ memories: [] });
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

  const activeModel = getActiveModel();

  try {
    const response = await generateContentWithThinkingFallback(ai, {
      model: activeModel,
      contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 768,
        responseMimeType: 'application/json',
        thinkingConfig: buildThinkingConfig(activeModel, 'fast'),
      },
    });

    const rawText = (response.text || '').trim();
    const cleanedJson = rawText
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      return res.status(200).json({ memories: [] });
    }

    const candidates = Array.isArray(parsed) ? parsed : parsed?.memories;
    const unique = filterUniqueMemories(candidates, Array.isArray(existingMemories) ? existingMemories : []);
    return res.status(200).json({ memories: unique });
  } catch (err) {
    console.error('[JARVIS Memory Extract Error]', err);
    return res.status(200).json({ memories: [] });
  }
});

// Phase 3 Smart Memory CRUD & Search Endpoints
expressApp.get('/api/memory', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
  const recent = req.query.recent === 'true';
  const memories = memoryStore.getAll({ category, recent });
  return res.status(200).json({ memories });
});

expressApp.get('/api/memory/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.round(rawLimit))) : 20;
  const memories = memoryStore.search({ query: q, category, limit });
  return res.status(200).json({ memories });
});

expressApp.post('/api/memory', (req, res) => {
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

  const outcome = memoryStore.saveOrMerge({ id, key, category, content, importance, createdAt, updatedAt });
  if (outcome.status === 'blocked_secret') {
    return res.status(400).json({
      code: 'SENSITIVE_SECRET_BLOCKED',
      error: outcome.reason,
    });
  }
  if (outcome.status === 'invalid') {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: outcome.reason,
    });
  }

  return res.status(outcome.status === 'created' ? 201 : 200).json({
    status: outcome.status,
    memory: outcome.memory,
    replacedMemory: outcome.replacedMemory || null,
  });
});

expressApp.put('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  if (!id || !id.trim()) {
    return res.status(400).json({ code: 'INVALID_REQUEST', error: 'Memory id is required.' });
  }
  const { key, category, content, importance } = req.body || {};
  const outcome = memoryStore.updateById(id.trim(), { key, category, content, importance });
  if (!outcome.found) {
    return res.status(404).json({ code: 'NOT_FOUND', error: 'Memory record not found.' });
  }
  if (outcome.error) {
    return res.status(400).json({ code: outcome.code || 'INVALID_REQUEST', error: outcome.error });
  }
  return res.status(200).json({ status: 'updated', memory: outcome.memory });
});

expressApp.delete('/api/memory/all', (req, res) => {
  const confirmed = req.query.confirm === 'true' || req.body?.confirm === true;
  if (!confirmed) {
    return res.status(400).json({
      code: 'CONFIRMATION_REQUIRED',
      error: 'Explicit confirmation (?confirm=true or {"confirm": true}) is required to clear all memories.',
    });
  }
  const clearedCount = memoryStore.clearAll();
  return res.status(200).json({ status: 'cleared', clearedCount });
});

expressApp.delete('/api/memory/:id', (req, res) => {
  const { id } = req.params;
  const deleted = memoryStore.deleteById(id);
  if (!deleted) {
    return res.status(404).json({ code: 'NOT_FOUND', error: 'Memory record not found.' });
  }
  return res.status(200).json({ status: 'deleted', id });
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
  const ai = getGeminiClient();
  if (!ai) {
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

  const activeModel = getActiveModel();

  try {
    const response = await generateContentWithThinkingFallback(ai, {
      model: activeModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
        thinkingConfig: buildThinkingConfig(activeModel, 'fast'),
      },
    });

    const rawText = (response.text || '').trim();
    const cleanedJson = rawText
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(cleanedJson);
    return res.status(200).json({
      reminder: sanitizeParsedReminder(parsed, trimmed, nowMs),
      source: 'gemini',
    });
  } catch (err) {
    console.warn('[JARVIS Reminder Parse Fallback]', err?.message || err);
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

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(200).json({
      line: fallbackLine,
      source: 'fallback',
    });
  }

  const prompt = [
    'Compose one crisp, motivating 1-2 sentence JARVIS executive briefing remark addressing the owner as "Sir".',
    `Respond in language: ${String(language).slice(0, 32)}.`,
    `Tasks: ${String(tasksSummary).slice(0, 500)}`,
    `Weather: ${String(weatherSummary).slice(0, 200)}`,
    `Power: ${String(batterySummary).slice(0, 120)}`,
  ].join('\n');

  const activeModel = getActiveModel();

  try {
    const response = await generateContentWithThinkingFallback(ai, {
      model: activeModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.65,
        maxOutputTokens: 256,
        thinkingConfig: buildThinkingConfig(activeModel, 'fast'),
      },
    });
    const text = (response.text || '').trim();
    return res.status(200).json({
      line: text || fallbackLine,
      source: text ? 'gemini' : 'fallback',
    });
  } catch (err) {
    console.warn('[JARVIS Briefing Fallback]', err?.message || err);
    return res.status(200).json({
      line: fallbackLine,
      source: 'fallback',
    });
  }
});

// Multimodal Vision Analysis Endpoint
expressApp.post('/api/vision', async (req, res) => {
  const {
    imageBase64,
    mimeType = 'image/jpeg',
    prompt = 'Analyze this image in detail as JARVIS, including any visible objects, text (OCR), and anomalies.',
  } = req.body || {};

  if (isPromptTooLong(prompt)) {
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
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY to enable live Gemini Vision analysis.',
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

  const activeModel = getActiveModel();

  try {
    const response = await generateContentWithThinkingFallback(ai, {
      model: activeModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
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
        systemInstruction:
          'You are JARVIS optical reconnaissance intelligence. Provide crisp, accurate visual analysis, OCR text extraction, and object identification. Address the owner as Sir.',
        temperature: 0.4,
        maxOutputTokens: 2048,
        thinkingConfig: buildThinkingConfig(activeModel, 'fast'),
      },
    });

    return res.status(200).json({
      analysis: response.text || 'No visual details could be extracted, Sir.',
      model: activeModel,
    });
  } catch (err) {
    console.error('[JARVIS Vision Error]', err);
    const { statusCode, message } = extractGeminiErrorInfo(err);
    const classified = classifyGeminiError(statusCode, message);
    return res.status(httpStatusForGeminiErrorCode(classified.code)).json({
      code: classified.code,
      error: classified.message,
    });
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
        const msg = String(modalityErr?.message || '');
        if (/response_modalities|modality|Invalid/i.test(msg)) {
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
      // Fallback to generateContent if Interactions endpoint is unavailable in the project/SDK route
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
    console.error('[JARVIS Lyria Music Error]', err);
    return res.status(500).json({
      code: 'MUSIC_GENERATION_ERROR',
      error: err?.message || `Failed to generate music with ${model}.`,
    });
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
