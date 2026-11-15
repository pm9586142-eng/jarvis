import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { filterUniqueMemories } from '../src/services/memoryDedupe.js';
import { parseReminderFallback, sanitizeParsedReminder } from '../src/services/reminderParser.js';

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

// Return structured JSON on malformed JSON or oversized request bodies
app.use((err, _req, res, next) => {
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
    musicModels: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
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
  let emittedAnyChunk = false;

  const runStream = async (useSearch) => {
    const config = {
      temperature: 0.7,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
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
    let result;
    try {
      result = await runStream(Boolean(enableWebSearch));
    } catch (firstErr) {
      const msg = String(firstErr?.message || '');
      const isSearchUnsupported =
        Boolean(enableWebSearch) &&
        !emittedAnyChunk &&
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

// Automatic Long-Term Memory Extraction Endpoint
app.post('/api/memory/extract', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'MISSING_API_KEY',
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  const { userPrompt, aiReply = '', existingMemories = [] } = req.body || {};
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
    'Analyze the conversation turn below and extract ONLY durable, long-term personal facts worth remembering about the user (e.g., name, role, preferences, ongoing projects, daily routines, tech stack, standing instructions).',
    'Ignore greetings, one-off questions, generic code/trivia, and anything already present in EXISTING MEMORIES.',
    'Return strict JSON matching this schema: {"memories":[{"key":"short title","category":"PREFERENCE|PROJECT|INSTRUCTION|FACT","content":"concise durable fact","importance":1-5}]}',
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

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
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

// Natural-Language Smart Reminder Parser Endpoint
app.post('/api/reminders/parse', async (req, res) => {
  const { text, nowIso, timezoneOffsetMinutes } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty reminder text is required.',
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

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
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
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
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

// Lyria 3 AI Music Generation Endpoint (lyria-3-clip-preview / lyria-3-pro-preview)
app.post('/api/music/generate', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      code: 'MISSING_API_KEY',
      error:
        'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY to generate music with Lyria 3.',
    });
  }

  const { prompt, mode = 'clip', lyrics = '' } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      error: 'A non-empty music prompt is required.',
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
      return res.status(502).json({
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
