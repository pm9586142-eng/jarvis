import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(webRootDir, 'dist');

// Load .env from web/ regardless of whether started from repo root or web/
dotenv.config({ path: path.resolve(webRootDir, '.env') });
dotenv.config();

export const app = express();

const isDevFlag = process.argv.includes('--dev');
const PORT = isDevFlag
  ? Number(process.env.DEV_API_PORT) || 3001
  : Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const DEFAULT_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';

// Configure CORS
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Allow up to 15MB JSON payloads for webcam / uploaded image analysis
app.use(express.json({ limit: '15mb' }));

// Return structured JSON on malformed JSON request bodies
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      code: 'BAD_JSON',
      error: 'Invalid JSON request payload.',
    });
  }
  return next(err);
});

function getGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'your_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
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

// Health check endpoint (used by Cloud Run, uptime monitors, and frontend status indicator)
app.get('/health', (_req, res) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const geminiConfigured = Boolean(
    apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey !== 'your_api_key_here'
  );
  res.status(200).json({
    status: 'ok',
    service: 'jarvis-cosmic-backend',
    geminiConfigured,
    model: DEFAULT_MODEL,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Streaming Gemini Chat Endpoint (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'MISSING_API_KEY',
      error:
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in your server environment variables or Cloud Run Secrets.',
    });
  }

  const { prompt, systemInstruction, history = [], enableWebSearch = false } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty prompt is required.',
    });
  }

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

  const contents = buildAlternatingContents(history, prompt);

  const runStream = async (useSearch) => {
    const config = {
      temperature: 0.7,
      maxOutputTokens: 2048,
    };

    if (typeof systemInstruction === 'string' && systemInstruction.trim()) {
      config.systemInstruction = systemInstruction.trim();
    }

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const streamResult = await ai.models.generateContentStream({
      model: DEFAULT_MODEL,
      contents,
      config,
    });

    const collectedSources = new Map();
    let emittedAnyChunk = false;

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

    return { collectedSources, emittedAnyChunk };
  };

  try {
    let result;
    try {
      result = await runStream(Boolean(enableWebSearch));
    } catch (firstErr) {
      const msg = String(firstErr?.message || '');
      const isSearchUnsupported =
        Boolean(enableWebSearch) &&
        /google_search|googleSearch|search.*grounding|Tool.*not supported/i.test(msg);
      if (isSearchUnsupported) {
        result = await runStream(false);
      } else {
        throw firstErr;
      }
    }

    if (result.collectedSources.size > 0) {
      sendEvent({ sources: Array.from(result.collectedSources.values()) });
    }

    sendEvent({ done: true });
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error('[JARVIS Gemini Stream Error]', err);
    const message = err?.message || 'Unexpected error communicating with Gemini API.';
    sendEvent({ error: message });
    if (!res.writableEnded) res.end();
  }
});

// Multimodal Vision Analysis Endpoint
app.post('/api/vision', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'MISSING_API_KEY',
      error:
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY to enable live Gemini Vision analysis.',
    });
  }

  const {
    imageBase64,
    mimeType = 'image/jpeg',
    prompt = 'Analyze this image in detail as JARVIS, including any visible objects, text (OCR), and anomalies.',
  } = req.body || {};

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

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
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
        maxOutputTokens: 1024,
      },
    });

    return res.status(200).json({
      analysis: response.text || 'No visual details could be extracted, Sir.',
      model: DEFAULT_MODEL,
    });
  } catch (err) {
    console.error('[JARVIS Vision Error]', err);
    return res.status(500).json({
      code: 'VISION_ERROR',
      error: err?.message || 'Failed to analyze image with Gemini Vision.',
    });
  }
});

// Structured 404 for unknown API endpoints
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    error: 'API route not found.',
  });
});

// Serve static Vite build in production (or whenever dist/ exists)
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    return res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).json({
      message:
        'JARVIS Backend API is running. Run `npm run build` to serve the production frontend, or use Vite dev server on port 5173.',
      health: '/health',
    });
  });
}

// Start HTTP server when executed directly (supports Vercel serverless import cleanly)
const isMainModule =
  typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;

if (isMainModule && !process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`JARVIS Cosmic Server listening on http://${HOST}:${PORT}`);
  });
}
