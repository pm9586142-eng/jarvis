import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {
  createApp,
  DEFAULT_GEMINI_MODEL,
  FREE_TIER_GEMINI_MODELS,
  FREE_TIER_GROQ_MODELS,
  FREE_TIER_OPENROUTER_MODELS,
  resolveActiveGeminiModel,
} from '../server/index.js';

function startTestServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

function makeTempFile(name) {
  return path.join(
    os.tmpdir(),
    `am-ai-regression-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${name}`
  );
}

test('Baseline AI API Lock: primary model, free-tier model chains, and env resolution remain unchanged', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.deepEqual([...FREE_TIER_GEMINI_MODELS], [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
  ]);
  assert.ok(FREE_TIER_GROQ_MODELS.includes('openai/gpt-oss-120b'));
  assert.ok(FREE_TIER_OPENROUTER_MODELS.every((m) => m.endsWith(':free') || m === 'openrouter/free'));
  assert.equal(resolveActiveGeminiModel(undefined), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('gemini-3.6-flash'), 'gemini-3.6-flash');
  assert.equal(resolveActiveGeminiModel('gemini-4-neon-paid'), 'gemini-3.8-flash');
});

test('Baseline AI API Lock: /api/health, /api/chat, /api/chat/stream, and /api/brain/status keep exact contracts', async () => {
  const memPath = makeTempFile('memories.json');
  const wsPath = makeTempFile('workspace.json');
  const app = createApp({
    accessToken: '',
    groqApiKey: '',
    openrouterApiKey: '',
    memoryStorePath: memPath,
    dataStorePath: wsPath,
    geminiClientFactory: () => ({
      models: {
        async generateContent(req) {
          return {
            text: `BASELINE_OK:${req.model}`,
            candidates: [],
          };
        },
        async generateContentStream(req) {
          async function* gen() {
            yield { text: `STREAM_CHUNK:${req.model}` };
          }
          return gen();
        },
      },
    }),
  });

  const { server, baseUrl } = await startTestServer(app);
  try {
    // 1. /api/health contract
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'jarvis-cosmic-backend');
    assert.equal(health.zeroCostEnforced, true);
    assert.equal(health.model, 'gemini-3.8-flash');
    assert.equal(health.activeProvider, 'gemini');
    assert.equal(health.geminiConfigured, true);

    // 2. Non-streaming /api/chat contract
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Ping baseline check', mode: 'chat' }),
    });
    assert.equal(chatRes.status, 200);
    const chatJson = await chatRes.json();
    assert.equal(chatJson.ok, true);
    assert.equal(chatJson.provider, 'gemini');
    assert.ok('model' in chatJson);
    assert.match(chatJson.reply, /^BASELINE_OK:gemini-3\.8-flash/);

    // 3. Streaming /api/chat/stream SSE contract
    const streamRes = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Stream ping baseline' }),
    });
    assert.equal(streamRes.status, 200);
    assert.match(streamRes.headers.get('content-type') || '', /text\/event-stream/i);
    const sseBody = await streamRes.text();
    assert.match(sseBody, /STREAM_CHUNK:gemini-3\.8-flash/);
    assert.match(sseBody, /"model":"gemini-3\.8-flash"/);
    assert.match(sseBody, /"done":true/);

    // 4. Paid model rejection still enforced
    const paidRes = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', model: 'gemini-4-neon', provider: 'gemini' }),
    });
    assert.equal(paidRes.status, 400);
    const paidJson = await paidRes.json();
    assert.equal(paidJson.code, 'PAID_OR_UNKNOWN_MODEL_REJECTED');

    // 5. /api/brain/status unchanged
    const brainRes = await fetch(`${baseUrl}/api/brain/status`);
    assert.equal(brainRes.status, 200);
    const brainJson = await brainRes.json();
    assert.equal(brainJson.strictZeroCostEnforced, true);
    assert.equal(brainJson.agents.length, 14);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(memPath, { force: true });
    fs.rmSync(wsPath, { force: true });
  }
});

test('Baseline AI API Lock: existing fallback from Gemini 429 to Groq works identically when configured', async () => {
  const originalFetch = globalThis.fetch;
  let groqCalls = 0;

  const mockFetch = async (url, init) => {
    if (String(url).includes('127.0.0.1')) {
      return originalFetch(url, init);
    }
    if (String(url).includes('api.groq.com/openai/v1/chat/completions')) {
      groqCalls += 1;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'GROQ_BASELINE_FALLBACK_OK' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected external fetch URL: ${url}`);
  };

  const app = createApp({
    accessToken: '',
    groqApiKey: 'gsk_baseline_test_key_12345',
    openrouterApiKey: '',
    fallbackModels: [],
    enableDynamicDiscovery: false,
    maxRetries: 0,
    fetchImpl: mockFetch,
    memoryStorePath: makeTempFile('fallback-mem.json'),
    dataStorePath: makeTempFile('fallback-ws.json'),
    geminiClientFactory: () => ({
      models: {
        async generateContent() {
          const err = new Error('Quota exceeded for metric: generate_requests_per_day, limit: 1500.');
          err.status = 429;
          throw err;
        },
      },
    }),
  });

  const { server, baseUrl } = await startTestServer(app);
  try {
    const res = await originalFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Fallback baseline test' }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.provider, 'groq');
    assert.equal(json.reply, 'GROQ_BASELINE_FALLBACK_OK');
    assert.equal(groqCalls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
