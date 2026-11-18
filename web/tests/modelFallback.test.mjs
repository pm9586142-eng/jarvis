import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/index.js';
import {
  DEFAULT_PRIMARY_MODEL,
  FREE_TIER_GEMINI_MODELS,
  isApprovedFreeTierModel,
  isDeprecatedOrUnsupportedModel,
  isPaidOnlyModel,
  resolveFreeTierFallbackChain,
} from '../server/geminiModelFallback.js';

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

function parseSseEvents(sseText) {
  return sseText
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('data:'))
    .map((block) => JSON.parse(block.slice(5).trim()));
}

function makeQuota429(kind = 'RPD', modelName = 'gemini-3.8-flash') {
  const configs = {
    RPD: {
      message: `Quota exceeded for metric: generate_requests_per_day on ${modelName}, limit: 1500.`,
      quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      quotaMetric: 'generativelanguage.googleapis.com/generate_requests_per_day',
      quotaValue: '1500',
    },
    RPM: {
      message: `Quota exceeded for metric: generate_content_free_tier_requests per minute on ${modelName}, limit: 15.`,
      quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
      quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
      quotaValue: '15',
    },
    FREE_ZERO: {
      message: `Quota exceeded for metric: generate_content_free_tier_requests on ${modelName}, limit: 0.`,
      quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
      quotaValue: '0',
    },
  };
  const cfg = configs[kind] || configs.RPD;
  const err = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: cfg.message,
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: cfg.quotaMetric,
                quotaId: cfg.quotaId,
                quotaValue: cfg.quotaValue,
              },
            ],
          },
        ],
      },
    })
  );
  err.status = 429;
  return err;
}

test('Free-tier model guardrails allow only active free models and strictly reject paid-only & deprecated models', () => {
  assert.equal(DEFAULT_PRIMARY_MODEL, 'gemini-3.8-flash');
  assert.deepEqual(FREE_TIER_GEMINI_MODELS, [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
  ]);

  // Approved Free-Tier models
  for (const model of FREE_TIER_GEMINI_MODELS) {
    assert.equal(isApprovedFreeTierModel(model), true, `Expected ${model} to be approved`);
    assert.equal(isPaidOnlyModel(model), false, `${model} must not be classified paid-only`);
    assert.equal(isDeprecatedOrUnsupportedModel(model), false, `${model} must not be deprecated`);
  }

  // Strictly blocked paid-only models
  const paidModels = [
    'gemini-4-carbon',
    'gemini-4-argon',
    'gemini-4.0-flash',
    'gemini-3.8-pro',
    'gemini-3.6-pro',
    'gemini-2.5-pro',
    'gemini-ultra-1.0',
    'imagen-3.0-generate-002',
    'veo-2.0-generate-001',
  ];
  for (const model of paidModels) {
    assert.equal(isPaidOnlyModel(model), true, `Expected ${model} to be flagged paid-only`);
    assert.equal(isApprovedFreeTierModel(model), false, `Paid model ${model} must NEVER be approved`);
  }

  // Strictly blocked deprecated / shut-down models
  const deprecatedModels = [
    'gemini-1.0-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-flash-lite-preview-09-2025',
  ];
  for (const model of deprecatedModels) {
    assert.equal(
      isDeprecatedOrUnsupportedModel(model),
      true,
      `Expected ${model} to be flagged deprecated`
    );
    assert.equal(isApprovedFreeTierModel(model), false, `Deprecated model ${model} must NEVER be approved`);
  }

  // Custom configured env fallback list filters out paid/deprecated entries cleanly
  const resolved = resolveFreeTierFallbackChain({
    primaryModel: 'gemini-3.8-flash',
    configuredFallbacks:
      'gemini-3.8-pro,gemini-1.5-flash,gemini-2.5-flash,gemini-3.6-flash,gemini-4-carbon,gemini-3.5-flash-lite',
  });
  assert.deepEqual(resolved.chain, [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ]);
  assert.ok(resolved.rejectedModels.includes('gemini-3.8-pro'));
  assert.ok(resolved.rejectedModels.includes('gemini-1.5-flash'));
  assert.ok(resolved.rejectedModels.includes('gemini-4-carbon'));
});

test('Scenario A & B: Primary 429 RESOURCE_EXHAUSTED automatically switches to gemini-3.6-flash and reports honest fallback metadata', async () => {
  const calledModels = [];
  const client = {
    models: {
      async generateContentStream(req) {
        calledModels.push(req.model);
        if (req.model === 'gemini-3.8-flash') {
          throw makeQuota429('RPD', 'gemini-3.8-flash');
        }
        return (async function* () {
          yield { text: `Served via Free Tier fallback ${req.model}.` };
        })();
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    sleep: async () => {},
    geminiClientFactory: () => client,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Status report, JARVIS' }),
    });
    assert.equal(res.status, 200);
    const events = parseSseEvents(await res.text());

    // Called primary once (RPD has 0 retries), then immediately switched to gemini-3.6-flash
    assert.deepEqual(calledModels, ['gemini-3.8-flash', 'gemini-3.6-flash']);

    const switchedMeta = events.filter((e) => e.meta).pop()?.meta;
    assert.equal(switchedMeta?.model, 'gemini-3.6-flash');
    assert.equal(switchedMeta?.primaryModel, 'gemini-3.8-flash');
    assert.equal(switchedMeta?.fallbackUsed, true);
    assert.equal(switchedMeta?.switchedFrom, 'gemini-3.8-flash');

    const combinedText = events.filter((e) => e.text).map((e) => e.text).join('');
    assert.equal(combinedText, 'Served via Free Tier fallback gemini-3.6-flash.');

    const doneEvent = events.find((e) => e.done);
    assert.equal(doneEvent?.model, 'gemini-3.6-flash');
    assert.equal(doneEvent?.fallbackUsed, true);

    // Health endpoint reflects primary on cooldown and gemini-3.6-flash as lastActiveModel
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    assert.equal(health.freeTierFallback.freeTierOnly, true);
    assert.equal(health.freeTierFallback.lastActiveModel, 'gemini-3.6-flash');
    assert.equal(health.freeTierFallback.totalFallbackSwitches, 1);
    const primaryStatus = health.freeTierFallback.models.find((m) => m.model === 'gemini-3.8-flash');
    assert.equal(primaryStatus.status, 'rpd_exhausted');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Scenario C & D: Cascading 429 + 404 skips unavailable model, switches to gemini-3.5-flash-lite, and cooldown prevents duplicate 429 calls', async () => {
  let fakeNow = 1_700_000_000_000;
  const calledModels = [];

  const client = {
    models: {
      async generateContentStream(req) {
        calledModels.push(req.model);
        if (req.model === 'gemini-3.8-flash') {
          throw makeQuota429('FREE_ZERO', 'gemini-3.8-flash');
        }
        if (req.model === 'gemini-3.6-flash') {
          const err = new Error('models/gemini-3.6-flash is not found for API version v1beta');
          err.status = 404;
          throw err;
        }
        return (async function* () {
          yield { text: `Cascade recovered on ${req.model}!` };
        })();
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    nowFn: () => fakeNow,
    sleep: async () => {},
    geminiClientFactory: () => client,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    // Request 1 cascades: 3.8-flash (429 limit:0) -> 3.6-flash (404) -> 3.5-flash-lite (200)
    const r1 = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'First request' }),
    });
    const ev1 = parseSseEvents(await r1.text());
    assert.deepEqual(calledModels, ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
    assert.equal(ev1.find((e) => e.done)?.model, 'gemini-3.5-flash-lite');

    // Request 2 immediately after: MUST skip cooling-down 3.8-flash and unavailable 3.6-flash!
    const r2 = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Second request during cooldown' }),
    });
    const ev2 = parseSseEvents(await r2.text());
    assert.deepEqual(calledModels, [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
    ]);
    assert.equal(ev2.find((e) => e.done)?.model, 'gemini-3.5-flash-lite');

    // Advance clock past 15 min RPD cooldown -> primary becomes eligible again
    fakeNow += 16 * 60 * 1000;
    const health = await (await fetch(`${baseUrl}/api/health`)).json();
    const pStatus = health.freeTierFallback.models.find((m) => m.model === 'gemini-3.8-flash');
    assert.equal(pStatus.status, 'available');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Scenario E: When ALL free-tier models exhaust quotas, stops cleanly without infinite retries, reports wait-for-reset honestly, and fails fast on follow-up', async () => {
  const calledModels = [];
  const recordedDelays = [];
  const client = {
    models: {
      async generateContentStream(req) {
        calledModels.push(req.model);
        throw makeQuota429('RPD', req.model);
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    maxRetries: 2,
    baseRetryDelayMs: 50,
    sleep: async (ms) => {
      recordedDelays.push(ms);
    },
    geminiClientFactory: () => client,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res1 = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Explain dark energy' }),
    });
    const ev1 = parseSseEvents(await res1.text());

    // Tried each of the 4 approved free models strictly ONCE (no infinite loop, no paid models)
    assert.deepEqual(calledModels, [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
    ]);
    assert.equal(recordedDelays.length, 0);

    // Must NOT falsely emit a fallbackUsed:true meta event when none succeeded
    assert.equal(ev1.some((e) => e.meta?.fallbackUsed === true), false);
    assert.equal(ev1.some((e) => e.done === true), false);

    const errEvent = ev1.find((e) => e.error);
    assert.ok(errEvent);
    assert.equal(errEvent.code, 'ALL_FREE_MODELS_EXHAUSTED');
    assert.equal(errEvent.allModelsExhausted, true);
    assert.deepEqual(errEvent.attemptedModels, [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
    ]);
    assert.match(errEvent.error, /Free Tier/i);
    assert.match(errEvent.error, /never switch to paid models|billing/i);
    assert.match(errEvent.error, /wait/i);

    // Follow-up request while ALL free models are cooling down MUST fail fast with ZERO new upstream API calls
    const res2 = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Another request while all free models are cooling down' }),
    });
    const ev2 = parseSseEvents(await res2.text());
    assert.equal(calledModels.length, 4, 'Zero upstream calls should fire while all models are on cooldown');
    assert.equal(ev2.find((e) => e.error)?.code, 'ALL_FREE_MODELS_EXHAUSTED');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Scenario F: Dynamic ai.models.list() discovery filters fallbacks to confirmed free models and rejects paid/deprecated ones', async () => {
  const calledModels = [];
  let listCalls = 0;

  const client = {
    models: {
      async list() {
        listCalls += 1;
        return [
          { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
          // Paid & deprecated models returned by API MUST be ignored
          { name: 'models/gemini-3.8-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-4-carbon', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
          // Only gemini-2.5-flash-lite is listed among secondary free models
          { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
        ];
      },
      async generateContent(req) {
        calledModels.push(req.model);
        if (req.model === 'gemini-3.8-flash') {
          throw makeQuota429('RPD', 'gemini-3.8-flash');
        }
        return { text: `Report generated by ${req.model}` };
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    sleep: async () => {},
    geminiClientFactory: () => client,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: 'executive_report',
        title: 'Q4 Plan',
        sourceText: 'Launch JARVIS with strict free tier protection.',
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();

    assert.equal(listCalls, 1, 'models.list() must be called once and cached');
    // Skipped unlisted 3.6-flash and 3.5-flash-lite, skipped paid 3.8-pro/4-carbon and deprecated 1.5-flash!
    assert.deepEqual(calledModels, ['gemini-3.8-flash', 'gemini-2.5-flash-lite']);
    assert.equal(json.model, 'gemini-2.5-flash-lite');
    assert.equal(json.primaryModel, 'gemini-3.8-flash');
    assert.equal(json.fallbackUsed, true);
    assert.match(json.content, /gemini-2\.5-flash-lite/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Scenario G: Auth (401), Billing Disabled (403), Spend Cap, and Bad Request (400) fail fast with ZERO model switches', async () => {
  const nonSwitchableCases = [
    {
      name: 'AUTH_401',
      status: 401,
      message: 'API key not valid. Please pass a valid API key.',
      expectedCode: 'GEMINI_AUTH_ERROR',
    },
    {
      name: 'BILLING_403',
      status: 403,
      message: 'Billing is disabled for this project. Enable billing to continue.',
      expectedCode: 'GEMINI_QUOTA_BILLING',
    },
    {
      name: 'SPEND_CAP_429',
      status: 429,
      message: 'Project monthly spend cap reached for Gemini API.',
      expectedCode: 'GEMINI_QUOTA_SPEND_CAP',
    },
    {
      name: 'BAD_REQUEST_400',
      status: 400,
      message: 'Invalid image payload format.',
      expectedCode: 'GEMINI_BAD_REQUEST',
    },
  ];

  for (const tc of nonSwitchableCases) {
    const calledModels = [];
    const client = {
      models: {
        async generateContent(req) {
          calledModels.push(req.model);
          const err = new Error(tc.message);
          err.status = tc.status;
          throw err;
        },
      },
    };
    const app = createApp({
      accessToken: '',
      rateLimitMax: 100,
      sleep: async () => {},
      geminiClientFactory: () => client,
    });
    const { server, baseUrl } = await startEphemeralServer(app);
    try {
      const res = await fetch(`${baseUrl}/api/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: Buffer.from('fake-img-bytes').toString('base64'),
          mimeType: 'image/png',
          mode: 'ocr',
        }),
      });
      const json = await res.json();
      assert.deepEqual(
        calledModels,
        ['gemini-3.8-flash'],
        `${tc.name} must NOT switch to fallback models`
      );
      assert.equal(json.code, tc.expectedCode);
      assert.equal(json.allModelsExhausted, false);
    } finally {
      await new Promise((r) => server.close(r));
    }
  }
});

test('Scenario H: Transient RPM 429 retries with exponential backoff on primary, then falls back cleanly to gemini-3.6-flash if primary stays saturated', async () => {
  const calls = [];
  const delays = [];
  const client = {
    models: {
      async generateContent(req) {
        calls.push(req.model);
        if (req.model === 'gemini-3.8-flash') {
          throw makeQuota429('RPM', 'gemini-3.8-flash');
        }
        return {
          text: '## Executive Summary\nLive search succeeded on fallback.\n## Verified Facts\n- Fallback verified.',
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: 'https://ai.google.dev/gemini-api/docs/models', title: 'Gemini Models' } },
                ],
              },
            },
          ],
        };
      },
    },
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    maxRetries: 2,
    baseRetryDelayMs: 40,
    maxRetryDelayMs: 5000,
    randomFn: () => 0,
    sleep: async (ms) => {
      delays.push(ms);
    },
    geminiClientFactory: () => client,
  });
  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Gemini free tier models', preferTavily: false }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();

    // Primary retried twice with bounded backoff (40ms, 80ms), then switched to gemini-3.6-flash
    assert.deepEqual(calls, [
      'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ]);
    assert.deepEqual(delays, [40, 80]);
    assert.equal(json.model, 'gemini-3.6-flash');
    assert.equal(json.fallbackUsed, true);
    assert.equal(json.sources.length, 1);
    assert.equal(json.verifiedFacts.length, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
