import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import {
  buildThinkingConfig,
  createApp,
  DEFAULT_GEMINI_MODEL,
  MAX_PROMPT_CHARS,
  resolveActiveGeminiModel,
  resolveServerPort,
} from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

function startEphemeralServer(appInstance) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
    server.on('error', reject);
  });
}

test('resolveServerPort respects --port, APP_PORT, --preview, --dev, and Cloud Run PORT defaults', () => {
  assert.equal(resolveServerPort(['node', 'server/index.js', '--port=4123'], { PORT: '8080' }), 4123);
  assert.equal(resolveServerPort(['node', 'server/index.js'], { APP_PORT: '3050', PORT: '8080' }), 3050);
  assert.equal(resolveServerPort(['node', 'server/index.js', '--preview'], { PORT: '8080' }), 3000);
  assert.equal(resolveServerPort(['node', 'server/index.js', '--dev'], { PORT: '8080' }), 3001);
  assert.equal(resolveServerPort(['node', 'server/index.js'], { PORT: '8080' }), 8080);
  assert.equal(resolveServerPort(['node', 'server/index.js'], {}), 8080);
});

test('GET /health, /api/health, /favicon.ico, and unknown /api/* return expected status codes', async () => {
  const app = createApp({ accessToken: '', rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    for (const endpoint of ['/health', '/api/health']) {
      const healthRes = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(healthRes.status, 200, `Expected 200 on ${endpoint}`);
      const healthJson = await healthRes.json();
      assert.equal(healthJson.status, 'ok');
      assert.equal(healthJson.service, 'jarvis-cosmic-backend');
      assert.equal(healthJson.authRequired, false);
      assert.equal(healthJson.endpoint, endpoint);
      assert.equal(healthJson.model, DEFAULT_GEMINI_MODEL);
      assert.equal(healthJson.model, 'gemini-3.8-flash');
    }

    const favRes = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(favRes.status, 204);

    const bareApiRes = await fetch(`${baseUrl}/api`);
    assert.equal(bareApiRes.status, 404);
    const bareApiJson = await bareApiRes.json();
    assert.equal(bareApiJson.code, 'NOT_FOUND');

    const unknownApiRes = await fetch(`${baseUrl}/api/nonexistent`);
    assert.equal(unknownApiRes.status, 404);
    const unknownJson = await unknownApiRes.json();
    assert.equal(unknownJson.code, 'NOT_FOUND');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('SPA routes serve index.html and missing /assets/*.js return 404 when dist exists', async (t) => {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    t.skip('web/dist has not been built yet');
    return;
  }
  const app = createApp({ accessToken: '', rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    for (const route of ['/', '/dashboard', '/chat', '/voice', '/memory', '/insights', '/settings', '/unknown-deep-route']) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, `Expected 200 for ${route}`);
      const html = await res.text();
      assert.match(html, /<!doctype html>/i);
      assert.match(html, /id="root"/i);
    }

    const missingAssetRes = await fetch(`${baseUrl}/assets/missing-bundle-12345.js`);
    assert.equal(missingAssetRes.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Missing GEMINI_API_KEY returns structured JSON with non-502/503 status to avoid reverse-proxy HTML hijack', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const app = createApp({ accessToken: '', rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello JARVIS' }),
    });
    assert.equal(res.status, 424);
    assert.notEqual(res.status, 502);
    assert.notEqual(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'MISSING_API_KEY');
    assert.match(body.error, /GEMINI_API_KEY/i);
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    await new Promise((r) => server.close(r));
  }
});

test('Rejects prompts longer than 8000 characters with 400 PROMPT_TOO_LONG', async () => {
  const app = createApp({ accessToken: '', rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const tooLong = 'x'.repeat(MAX_PROMPT_CHARS + 1);
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: tooLong }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'PROMPT_TOO_LONG');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('APP_ACCESS_TOKEN middleware exempts /health and /api/health, rejects bad token, and allows valid Bearer token', async () => {
  const secret = 'jarvis-test-secret-token';
  const app = createApp({ accessToken: secret, rateLimitMax: 100 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    for (const endpoint of ['/health', '/api/health']) {
      const healthRes = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(healthRes.status, 200);
      const healthJson = await healthRes.json();
      assert.equal(healthJson.authRequired, true);
    }

    const noAuthRes = await fetch(`${baseUrl}/api/reminders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Remind me to stretch in 10 minutes' }),
    });
    assert.equal(noAuthRes.status, 401);

    const badAuthRes = await fetch(`${baseUrl}/api/reminders/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-token',
      },
      body: JSON.stringify({ text: 'Remind me to stretch in 10 minutes' }),
    });
    assert.equal(badAuthRes.status, 401);

    const goodAuthRes = await fetch(`${baseUrl}/api/reminders/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ text: 'Remind me to stretch in 10 minutes' }),
    });
    assert.equal(goodAuthRes.status, 200);
    const parsed = await goodAuthRes.json();
    assert.ok(parsed.reminder?.title);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Rate limiter enforces request cap per IP with HTTP 429 RATE_LIMITED while allowing /api/health', async () => {
  const app = createApp({ accessToken: '', rateLimitMax: 3, rateLimitWindowMs: 60_000 });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    for (let i = 0; i < 3; i++) {
      const okRes = await fetch(`${baseUrl}/api/reminders/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Remind me test ${i} in 5 mins` }),
      });
      assert.equal(okRes.status, 200);
    }

    const blockedRes = await fetch(`${baseUrl}/api/reminders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Remind me overflow in 5 mins' }),
    });
    assert.equal(blockedRes.status, 429);
    const blockedBody = await blockedRes.json();
    assert.equal(blockedBody.code, 'RATE_LIMITED');

    // Health check stays available even when rate limit is saturated
    const healthAfterLimit = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthAfterLimit.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('resolveActiveGeminiModel defaults to gemini-3.8-flash and auto-upgrades deprecated model IDs', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel(undefined), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel(''), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('UNSET'), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('gemini-2.5-flash'), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('models/gemini-2.5-flash'), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('gemini-2.0-flash'), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('models/gemini-3.8-flash'), 'gemini-3.8-flash');
  assert.equal(resolveActiveGeminiModel('gemini-3.8-pro'), 'gemini-3.8-pro');
});

test('buildThinkingConfig uses Gemini 3.x thinkingLevel instead of legacy thinkingBudget', () => {
  assert.deepEqual(buildThinkingConfig('gemini-3.8-flash', 'fast'), { thinkingLevel: 'LOW' });
  assert.deepEqual(buildThinkingConfig('gemini-3.8-flash', 'structured'), { thinkingLevel: 'MEDIUM' });
  assert.deepEqual(buildThinkingConfig('gemini-3.8-flash', 'deep'), { thinkingLevel: 'HIGH' });
  assert.equal('thinkingBudget' in buildThinkingConfig('gemini-3.8-flash', 'deep'), false);
});

test('POST /api/chat/stream streams gemini-3.8-flash responses with multi-turn history and thinkingLevel config', async () => {
  const capturedRequests = [];
  const fakeClient = {
    models: {
      async generateContentStream(req) {
        capturedRequests.push(req);
        return (async function* () {
          yield { text: 'Good evening, Sir. ' };
          yield { text: 'Gemini 3.8 Flash is online.' };
        })();
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    model: 'gemini-2.5-flash', // Should automatically upgrade to gemini-3.8-flash
    geminiClientFactory: () => fakeClient,
  });
  const { server, baseUrl } = await startEphemeralServer(app);

  try {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Design a step by step architecture roadmap for our backend',
        history: [
          { role: 'user', text: 'We are building JARVIS.' },
          { role: 'jarvis', text: 'Understood, Sir.' },
        ],
        preferredLanguage: 'ENGLISH',
      }),
    });

    assert.equal(res.status, 200);
    const sseBody = await res.text();
    const events = sseBody
      .split('\n\n')
      .map((block) => block.trim())
      .filter((block) => block.startsWith('data:'))
      .map((block) => JSON.parse(block.slice(5).trim()));

    assert.equal(capturedRequests.length, 1);
    assert.equal(capturedRequests[0].model, 'gemini-3.8-flash');
    assert.deepEqual(capturedRequests[0].config.thinkingConfig, { thinkingLevel: 'HIGH' });
    assert.equal(capturedRequests[0].contents.length, 3);
    assert.equal(capturedRequests[0].contents[0].role, 'user');
    assert.equal(capturedRequests[0].contents[1].role, 'model');
    assert.equal(capturedRequests[0].contents[2].role, 'user');

    const metaEvent = events.find((e) => e.meta);
    assert.equal(metaEvent?.meta?.model, 'gemini-3.8-flash');
    const combinedText = events.filter((e) => typeof e.text === 'string').map((e) => e.text).join('');
    assert.equal(combinedText, 'Good evening, Sir. Gemini 3.8 Flash is online.');
    assert.ok(events.some((e) => e.done === true));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('POST /api/chat/stream retries without thinkingConfig if model rejects thinking parameter, and surfaces 404 model errors clearly', async () => {
  let streamCalls = 0;
  const retryClient = {
    models: {
      async generateContentStream(req) {
        streamCalls++;
        if (streamCalls === 1 && req.config?.thinkingConfig) {
          const err = new Error('thinkingConfig is unsupported for this route');
          err.status = 400;
          throw err;
        }
        return (async function* () {
          yield { text: 'Recovered without thinkingConfig.' };
        })();
      },
    },
  };

  const retryApp = createApp({ accessToken: '', rateLimitMax: 100, geminiClientFactory: () => retryClient });
  const retrySrv = await startEphemeralServer(retryApp);
  try {
    const res = await fetch(`${retrySrv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello JARVIS' }),
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.equal(streamCalls, 2);
    assert.match(body, /Recovered without thinkingConfig/);
  } finally {
    await new Promise((r) => retrySrv.server.close(r));
  }

  const notFoundClient = {
    models: {
      async generateContentStream() {
        const err = new Error('{"error":{"code":404,"message":"models/gemini-2.5-flash is no longer available to new users."}}');
        err.status = 404;
        throw err;
      },
      async generateContent() {
        const err = new Error('models/gemini-2.5-flash is no longer available to new users.');
        err.status = 404;
        throw err;
      },
    },
  };

  const notFoundApp = createApp({ accessToken: '', rateLimitMax: 100, geminiClientFactory: () => notFoundClient });
  const notFoundSrv = await startEphemeralServer(notFoundApp);
  try {
    const sseRes = await fetch(`${notFoundSrv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Test 404 handling' }),
    });
    const sseText = await sseRes.text();
    assert.match(sseText, /GEMINI_MODEL_NOT_FOUND/);
    assert.match(sseText, /gemini-3\.8-flash/);

    // Verify /api/chat/summarize also accepts legacy Android `history` field and surfaces 404 cleanly
    const sumRes = await fetch(`${notFoundSrv.baseUrl}/api/chat/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [
          { role: 'user', text: 'First turn' },
          { role: 'model', text: 'Second turn' },
        ],
      }),
    });
    assert.equal(sumRes.status, 404);
    const sumJson = await sumRes.json();
    assert.equal(sumJson.code, 'GEMINI_MODEL_NOT_FOUND');
  } finally {
    await new Promise((r) => notFoundSrv.server.close(r));
  }
});
