import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { createApp, MAX_PROMPT_CHARS, resolveServerPort } from '../server/index.js';

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
