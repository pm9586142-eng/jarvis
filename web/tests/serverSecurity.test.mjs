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

test('POST /api/chat/stream retries temporary 429 RPM errors with exponential backoff and succeeds without infinite retries', async () => {
  let attempts = 0;
  const recordedDelays = [];
  const flakyRpmClient = {
    models: {
      async generateContentStream() {
        attempts += 1;
        if (attempts <= 2) {
          const err = new Error(
            JSON.stringify({
              error: {
                code: 429,
                status: 'RESOURCE_EXHAUSTED',
                message: 'Quota exceeded for metric: generate_content_free_tier_requests per minute, limit: 15.',
                details: [
                  {
                    '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                    violations: [
                      {
                        quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                        quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
                        quotaValue: '15',
                      },
                    ],
                  },
                ],
              },
            })
          );
          err.status = 429;
          throw err;
        }
        return (async function* () {
          yield { text: 'Recovered cleanly after exponential backoff, Sir.' };
        })();
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    maxRetries: 2,
    baseRetryDelayMs: 100,
    maxRetryDelayMs: 5000,
    randomFn: () => 0,
    sleep: async (ms) => {
      recordedDelays.push(ms);
    },
    geminiClientFactory: () => flakyRpmClient,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello JARVIS' }),
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.equal(attempts, 3);
    assert.deepEqual(recordedDelays, [100, 200]);
    assert.match(body, /Recovered cleanly after exponential backoff, Sir\./);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('POST /api/chat/stream caps retries on persistent 429 RPM and surfaces verbatim Google error message & metadata', async () => {
  let attempts = 0;
  const delays = [];
  const alwaysRpmClient = {
    models: {
      async generateContentStream() {
        attempts += 1;
        const err = new Error(
          JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'Quota exceeded for metric: requests per minute, limit: 15. Please check your plan and billing details.',
              details: [
                {
                  '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                  violations: [
                    {
                      quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                      quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
                      quotaValue: '15',
                    },
                  ],
                },
              ],
            },
          })
        );
        err.status = 429;
        throw err;
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    maxRetries: 2,
    baseRetryDelayMs: 50,
    maxRetryDelayMs: 5000,
    randomFn: () => 0,
    sleep: async (ms) => {
      delays.push(ms);
    },
    geminiClientFactory: () => alwaysRpmClient,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Explain quantum tunneling' }),
    });
    const sseText = await res.text();
    const events = sseText
      .split('\n\n')
      .map((block) => block.trim())
      .filter((block) => block.startsWith('data:'))
      .map((block) => JSON.parse(block.slice(5).trim()));

    const errEvent = events.find((e) => e.error);
    assert.ok(errEvent, 'Expected structured SSE error event');
    assert.equal(attempts, 3, 'Must stop after initial attempt + 2 retries (no infinite retries)');
    assert.deepEqual(delays, [50, 100]);
    assert.equal(errEvent.code, 'GEMINI_QUOTA_RPM');
    assert.equal(errEvent.quotaCategory, 'RPM');
    assert.equal(errEvent.upstreamStatus, 429);
    assert.equal(errEvent.attempts, 3);
    assert.match(errEvent.error, /requests per minute, limit: 15/);
    assert.doesNotMatch(errEvent.error, /Gemini API rate limit or quota reached/i);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Non-retryable RPD, Billing (limit: 0), Spend Cap, and long RetryInfo errors perform 0 retries and expose exact upstream error', async () => {
  const cases = [
    {
      name: 'RPD',
      expectedCode: 'GEMINI_QUOTA_RPD',
      expectedCategory: 'RPD',
      payload: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded for metric: generate_requests_per_day, limit: 1500.',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [
                {
                  quotaMetric: 'generativelanguage.googleapis.com/generate_requests_per_day',
                  quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                  quotaValue: '1500',
                },
              ],
            },
          ],
        },
      },
      snippet: /limit: 1500/,
    },
    {
      name: 'BILLING_ZERO_LIMIT',
      expectedCode: 'GEMINI_QUOTA_BILLING',
      expectedCategory: 'BILLING',
      payload: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0.',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [
                {
                  quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                  quotaValue: '0',
                },
              ],
            },
          ],
        },
      },
      snippet: /limit: 0/,
    },
    {
      name: 'SPEND_CAP',
      expectedCode: 'GEMINI_QUOTA_SPEND_CAP',
      expectedCategory: 'SPEND_CAP',
      payload: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Project monthly spend cap reached for Gemini API.',
        },
      },
      snippet: /monthly spend cap reached/,
    },
    {
      name: 'LONG_RETRY_DELAY_FAST_FAIL',
      expectedCode: 'GEMINI_QUOTA_RPM',
      expectedCategory: 'RPM',
      payload: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Requests per minute limit exceeded. Please retry in 45s.',
          details: [
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45s' },
          ],
        },
      },
      snippet: /Please retry in 45s/,
    },
  ];

  for (const tc of cases) {
    let attempts = 0;
    let slept = 0;
    const client = {
      models: {
        async generateContentStream() {
          attempts += 1;
          const err = new Error(JSON.stringify(tc.payload));
          err.status = tc.payload.error.code;
          throw err;
        },
      },
    };
    const app = createApp({
      accessToken: '',
      rateLimitMax: 100,
      maxRetries: 2,
      baseRetryDelayMs: 50,
      maxRetryDelayMs: 5000,
      sleep: async () => {
        slept += 1;
      },
      geminiClientFactory: () => client,
    });
    const { server, baseUrl } = await startEphemeralServer(app);
    try {
      const res = await fetch(`${baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Check ${tc.name}` }),
      });
      const sseText = await res.text();
      const events = sseText
        .split('\n\n')
        .map((block) => block.trim())
        .filter((block) => block.startsWith('data:'))
        .map((block) => JSON.parse(block.slice(5).trim()));
      const errEvent = events.find((e) => e.error);
      assert.equal(attempts, 1, `${tc.name} must perform strictly 0 retries`);
      assert.equal(slept, 0, `${tc.name} must not sleep`);
      assert.equal(errEvent.code, tc.expectedCode, `Wrong code for ${tc.name}`);
      assert.equal(errEvent.quotaCategory, tc.expectedCategory, `Wrong category for ${tc.name}`);
      assert.match(errEvent.error, tc.snippet, `Verbatim message missing for ${tc.name}`);
    } finally {
      await new Promise((r) => server.close(r));
    }
  }
});

test('Single-flight caching deduplicates concurrent /api/briefing calls and quota cooldown suppresses optional background calls', async () => {
  let briefingCalls = 0;
  let memoryExtractCalls = 0;
  let failBriefingWithQuota = false;

  const client = {
    models: {
      async generateContent(req) {
        const promptText = JSON.stringify(req.contents || '');
        if (promptText.includes('executive briefing')) {
          briefingCalls += 1;
          if (failBriefingWithQuota) {
            const err = new Error(
              JSON.stringify({
                error: {
                  code: 429,
                  status: 'RESOURCE_EXHAUSTED',
                  message: 'Quota exceeded for requests per day, limit: 1500.',
                },
              })
            );
            err.status = 429;
            throw err;
          }
          await new Promise((r) => setTimeout(r, 25));
          return { text: 'Systems nominal, Sir. Focus on today’s priority tasks.' };
        }
        memoryExtractCalls += 1;
        return { text: '[]' };
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    geminiClientFactory: () => client,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const payload = JSON.stringify({
      tasksSummary: '2 pending tasks',
      weatherSummary: '22C Clear',
      batterySummary: 'Battery 90%',
      language: 'ENGLISH',
    });

    // Two concurrent identical requests + one cached follow-up should trigger only 1 Gemini call
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/briefing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }),
      fetch(`${baseUrl}/api/briefing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }),
    ]);
    const b1 = await r1.json();
    const b2 = await r2.json();
    assert.equal(b1.source, 'gemini');
    assert.equal(b2.source, 'gemini');
    assert.equal(briefingCalls, 1, 'Concurrent identical briefing calls must share single-flight promise');

    const r3 = await fetch(`${baseUrl}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    const b3 = await r3.json();
    assert.equal(b3.source, 'gemini');
    assert.equal(briefingCalls, 1, 'Subsequent identical briefing call within TTL must use cache');

    // Trigger an RPD quota error on a new cache key, then verify background /api/memory/extract is suppressed by cooldown
    failBriefingWithQuota = true;
    const r4 = await fetch(`${baseUrl}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasksSummary: '3 new tasks', weatherSummary: 'Rain', language: 'ENGLISH' }),
    });
    const b4 = await r4.json();
    assert.equal(b4.source, 'fallback');
    assert.equal(b4.quotaCategory, 'RPD');
    assert.equal(briefingCalls, 2);

    const memRes = await fetch(`${baseUrl}/api/memory/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: 'I prefer concise TypeScript examples for my backend project',
        aiReply: 'Noted, Sir.',
        existingMemories: [],
      }),
    });
    const memJson = await memRes.json();
    assert.equal(memRes.status, 200);
    assert.equal(memJson.skippedReason, 'quota_cooldown');
    assert.equal(memoryExtractCalls, 0, 'Background memory extraction must not hit Gemini while quota cooldown is active');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
