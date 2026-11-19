import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  createApp,
  FREE_TIER_GROQ_MODELS,
  FREE_TIER_OPENROUTER_MODELS,
  FREE_TIER_OPENROUTER_VISION_MODELS,
  isApprovedFreeModelForProvider,
  isPricingStrictlyZero,
  PROVIDER_LABELS,
} from '../server/index.js';
import {
  assertZeroCostModelAllowed,
  buildOpenAiMessages,
  validateRequestedFreeModel,
} from '../server/freeMultiProvider.js';

function startEphemeralServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function makeQuota429Error(message = 'RESOURCE_EXHAUSTED: Free tier quota exceeded') {
  const err = new Error(message);
  err.status = 429;
  err.details = [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45s' }];
  return err;
}

function makeJsonResponse(status, body, extraHeaders = {}) {
  const headers = new Headers({ 'content-type': 'application/json', ...extraHeaders });
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    text: async () => raw,
    json: async () => JSON.parse(raw),
  };
}

function makeSseStreamResponse(chunks, extraHeaders = {}) {
  const encoder = new TextEncoder();
  const lines = [
    ...chunks.map(
      (chunk) => `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`
    ),
    'data: [DONE]\n\n',
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream', ...extraHeaders }),
    body: stream,
    text: async () => lines.join(''),
  };
}

function parseSseFrames(rawSse) {
  const frames = [];
  for (const frame of rawSse.split('\n\n')) {
    const trimmed = frame.trim();
    if (!trimmed) continue;
    let dataLine = '';
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('data:')) dataLine += line.slice(5).trim();
    }
    if (!dataLine) continue;
    try {
      frames.push(JSON.parse(dataLine));
    } catch {
      frames.push({ raw: dataLine });
    }
  }
  return frames;
}

const VERIFIED_OPENROUTER_CATALOG = {
  data: [
    ...FREE_TIER_OPENROUTER_MODELS.map((id) => ({
      id,
      context_length: 131072,
      pricing: { prompt: '0', completion: '0', request: '0', image: '0' },
    })),
    ...FREE_TIER_OPENROUTER_VISION_MODELS.map((id) => ({
      id,
      context_length: 131072,
      pricing: { prompt: '0', completion: '0', request: '0', image: '0' },
    })),
    // Paid model in catalog must be ignored even if requested
    {
      id: 'openai/gpt-4o',
      context_length: 128000,
      pricing: { prompt: '0.000005', completion: '0.000015' },
    },
  ],
};

const ACTIVE_GROQ_CATALOG = {
  data: [
    ...FREE_TIER_GROQ_MODELS.map((id) => ({ id, active: true })),
    { id: 'whisper-large-v3', active: true },
  ],
};

test('Zero-cost pricing guard strictly requires $0 prompt, completion, and auxiliary fees', () => {
  assert.equal(isPricingStrictlyZero({ prompt: '0', completion: '0' }), true);
  assert.equal(
    isPricingStrictlyZero({
      prompt: 0,
      completion: 0,
      request: '0',
      image: '0',
      web_search: '0',
      internal_reasoning: '0',
    }),
    true
  );

  // Reject any non-zero, dynamic (-1), missing, or non-numeric pricing
  assert.equal(isPricingStrictlyZero(null), false);
  assert.equal(isPricingStrictlyZero({}), false);
  assert.equal(isPricingStrictlyZero({ prompt: '0' }), false);
  assert.equal(isPricingStrictlyZero({ prompt: '0.000001', completion: '0' }), false);
  assert.equal(isPricingStrictlyZero({ prompt: '0', completion: '0.000002' }), false);
  assert.equal(isPricingStrictlyZero({ prompt: '0', completion: '0', request: '0.01' }), false);
  assert.equal(isPricingStrictlyZero({ prompt: '0', completion: '0', image: '0.002' }), false);
  assert.equal(isPricingStrictlyZero({ prompt: '-1', completion: '0' }), false);
  assert.equal(isPricingStrictlyZero({ prompt: 'free', completion: '0' }), false);
});

test('Strict server-side allowlist accepts approved free models and blocks paid or unknown models', () => {
  assert.equal(isApprovedFreeModelForProvider('gemini', 'gemini-3.8-flash'), true);
  assert.equal(isApprovedFreeModelForProvider('gemini', 'gemini-3.6-flash'), true);
  assert.equal(isApprovedFreeModelForProvider('gemini', 'gemini-3.8-pro'), false);
  assert.equal(isApprovedFreeModelForProvider('gemini', 'gemini-2.0-flash'), false);

  assert.equal(isApprovedFreeModelForProvider('groq', 'openai/gpt-oss-120b'), true);
  assert.equal(isApprovedFreeModelForProvider('groq', 'openai/gpt-oss-20b'), true);
  assert.equal(isApprovedFreeModelForProvider('groq', 'whisper-large-v3'), false);
  assert.equal(isApprovedFreeModelForProvider('groq', 'gpt-4o'), false);

  assert.equal(
    isApprovedFreeModelForProvider('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free'),
    true
  );
  assert.equal(isApprovedFreeModelForProvider('openrouter', 'openrouter/free'), true);
  assert.equal(
    isApprovedFreeModelForProvider('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b'),
    false
  );
  assert.equal(isApprovedFreeModelForProvider('openrouter', 'anthropic/claude-3.7-sonnet'), false);

  // Pre-flight guard blocks unverified OpenRouter pricing even for allowlisted :free IDs
  assert.throws(
    () =>
      assertZeroCostModelAllowed('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free', {
        pricingVerified: false,
      }),
    (err) => err.code === 'UNVERIFIED_PRICING_REJECTED'
  );

  // Paid client override validation
  assert.equal(validateRequestedFreeModel('gpt-4o').valid, false);
  assert.equal(validateRequestedFreeModel('gemini-3.8-pro').valid, false);
  assert.equal(validateRequestedFreeModel('openai/gpt-oss-120b', 'openrouter').valid, false);
  assert.equal(validateRequestedFreeModel('openai/gpt-oss-120b', 'groq').valid, true);
});

test('HTTP /api/chat/stream rejects paid or unknown client model overrides with 400 PAID_OR_UNKNOWN_MODEL_REJECTED', async () => {
  let providerCalled = false;
  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    groqApiKey: 'gsk_test_valid_key',
    fetchImpl: async () => {
      providerCalled = true;
      return makeJsonResponse(200, ACTIVE_GROQ_CATALOG);
    },
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    for (const badModel of ['gpt-4o', 'claude-3.7-sonnet', 'gemini-3.8-pro', 'meta-llama/llama-3-70b']) {
      const resp = await fetch(`${baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello', model: badModel }),
      });
      assert.equal(resp.status, 400);
      const body = await resp.json();
      assert.equal(body.code, 'PAID_OR_UNKNOWN_MODEL_REJECTED');
    }
    assert.equal(providerCalled, false, 'No outbound API call may run when a paid model is requested');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('OpenRouter fail-closed guard refuses completion calls when live pricing is non-zero or catalog fails', async () => {
  const completionCalls = [];
  const fakeFetch = async (url) => {
    if (url.includes('openrouter.ai/api/v1/models')) {
      return makeJsonResponse(200, {
        data: FREE_TIER_OPENROUTER_MODELS.map((id) => ({
          id,
          // Sneaky non-zero pricing even on a :free ID must be blocked!
          pricing: { prompt: '0.000001', completion: '0' },
        })),
      });
    }
    if (url.includes('/chat/completions')) {
      completionCalls.push(url);
      return makeSseStreamResponse(['Should never happen']);
    }
    return makeJsonResponse(500, { error: 'unexpected' });
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    openrouterApiKey: 'sk-or-v1-test-key',
    fetchImpl: fakeFetch,
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const resp = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Test fail-closed pricing' }),
    });
    const rawSse = await resp.text();
    const frames = parseSseFrames(rawSse);
    const errFrame = frames.find((f) => typeof f.error === 'string');
    assert.ok(errFrame, 'Must emit error frame when zero-price verification blocks all models');
    assert.equal(errFrame.code, 'ALL_FREE_MODELS_EXHAUSTED');
    assert.equal(errFrame.allProvidersExhausted, true);
    assert.equal(
      completionCalls.length,
      0,
      'Must NEVER invoke OpenRouter /chat/completions when pricing is non-zero'
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Gemini HTTP 429 automatically switches to Groq Free API while preserving conversation context', async () => {
  const geminiModelsTried = [];
  const groqBodies = [];

  const fakeGeminiClient = {
    models: {
      async generateContentStream(req) {
        geminiModelsTried.push(req.model);
        throw makeQuota429Error(`429 RESOURCE_EXHAUSTED on ${req.model}`);
      },
    },
  };

  const fakeFetch = async (url, init) => {
    if (url === 'https://api.groq.com/openai/v1/models') {
      return makeJsonResponse(200, ACTIVE_GROQ_CATALOG);
    }
    if (url === 'https://api.groq.com/openai/v1/chat/completions') {
      const parsed = JSON.parse(init.body);
      groqBodies.push(parsed);
      return makeSseStreamResponse(['Switched to ', 'Groq Free seamlessly, Sir.']);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    geminiClientFactory: () => fakeGeminiClient,
    groqApiKey: 'gsk_free_test_token',
    openrouterApiKey: 'sk-or-v1-free-test',
    fetchImpl: fakeFetch,
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const resp = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'What was my project codename?',
        history: [
          { role: 'user', text: 'Remember my project codename is Project Stark.' },
          { role: 'model', text: 'Understood, Sir. Your project codename is Project Stark.' },
        ],
        systemInstruction: 'You are JARVIS, concise and polite.',
      }),
    });

    assert.equal(resp.status, 200);
    const frames = parseSseFrames(await resp.text());
    const metaFrames = frames.filter((f) => f.meta);
    const finalMeta = metaFrames[metaFrames.length - 1]?.meta;
    const chunkText = frames
      .filter((f) => typeof f.text === 'string')
      .map((f) => f.text)
      .join('');
    const doneEvent = frames.find((f) => f.done === true);

    assert.ok(geminiModelsTried.length >= 1, 'Gemini Free models should have been attempted first');
    assert.equal(groqBodies.length, 1, 'Groq Free API should be invoked once after Gemini 429');
    assert.equal(groqBodies[0].model, 'openai/gpt-oss-120b');

    // Verify full multi-turn conversation continuity was forwarded intact
    const sentMessages = groqBodies[0].messages;
    assert.equal(sentMessages[0].role, 'system');
    assert.ok(sentMessages[0].content.includes('You are JARVIS'));
    assert.ok(sentMessages.some((m) => m.role === 'user' && m.content.includes('Project Stark')));
    assert.ok(sentMessages.some((m) => m.role === 'assistant' && m.content.includes('Project Stark')));
    assert.equal(sentMessages[sentMessages.length - 1].role, 'user');
    assert.equal(sentMessages[sentMessages.length - 1].content, 'What was my project codename?');

    assert.equal(chunkText, 'Switched to Groq Free seamlessly, Sir.');
    assert.equal(finalMeta.provider, 'groq');
    assert.equal(finalMeta.providerLabel, PROVIDER_LABELS.groq);
    assert.equal(finalMeta.model, 'openai/gpt-oss-120b');
    assert.equal(finalMeta.fallbackUsed, true);
    assert.equal(finalMeta.switchedFromProvider, 'gemini');
    assert.ok(doneEvent, 'Must finish with SSE done event');

    // Check /api/health reports active provider & model accurately
    const healthResp = await fetch(`${baseUrl}/api/health`);
    const health = await healthResp.json();
    assert.equal(health.zeroCostEnforced, true);
    assert.equal(health.activeProvider, 'groq');
    assert.equal(health.activeModel, 'openai/gpt-oss-120b');
    assert.equal(health.multiProvider.totalProviderSwitches, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Gemini 429 + Groq 429 switches to OpenRouter Free ($0 verified) and skips exhausted providers on next turn', async () => {
  let geminiCalls = 0;
  let groqCompletionCalls = 0;
  const openRouterBodies = [];

  const fakeGeminiClient = {
    models: {
      async generateContentStream() {
        geminiCalls += 1;
        throw makeQuota429Error('429 RESOURCE_EXHAUSTED Gemini');
      },
    },
  };

  const fakeFetch = async (url, init) => {
    if (url === 'https://api.groq.com/openai/v1/models') {
      return makeJsonResponse(200, ACTIVE_GROQ_CATALOG);
    }
    if (url === 'https://api.groq.com/openai/v1/chat/completions') {
      groqCompletionCalls += 1;
      return makeJsonResponse(
        429,
        { error: { message: 'Rate limit reached for requests per day (RPD)' } },
        { 'retry-after': '120' }
      );
    }
    if (url === 'https://openrouter.ai/api/v1/models') {
      return makeJsonResponse(200, VERIFIED_OPENROUTER_CATALOG);
    }
    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      openRouterBodies.push(JSON.parse(init.body));
      return makeSseStreamResponse(['OpenRouter Free $0 ', 'responding clearly.']);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    geminiClientFactory: () => fakeGeminiClient,
    groqApiKey: 'gsk_free_test_key',
    openrouterApiKey: 'sk-or-v1-free-test-key',
    fetchImpl: fakeFetch,
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    // Turn 1: Gemini 429 -> Groq 429 -> OpenRouter Free succeeds
    const turn1 = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Explain quantum tunneling briefly.',
        history: [{ role: 'user', text: 'Hello JARVIS' }],
      }),
    });
    const turn1Frames = parseSseFrames(await turn1.text());
    const turn1Meta = turn1Frames.filter((f) => f.meta).pop()?.meta;
    const turn1Text = turn1Frames
      .filter((f) => typeof f.text === 'string')
      .map((f) => f.text)
      .join('');

    assert.equal(turn1Text, 'OpenRouter Free $0 responding clearly.');
    assert.equal(turn1Meta.provider, 'openrouter');
    assert.equal(turn1Meta.providerLabel, PROVIDER_LABELS.openrouter);
    assert.equal(turn1Meta.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
    assert.equal(turn1Meta.switchedFromProvider, 'gemini');
    assert.equal(openRouterBodies.length, 1);

    const geminiCallsAfterTurn1 = geminiCalls;
    const groqCallsAfterTurn1 = groqCompletionCalls;

    // Turn 2: Exhausted Gemini & Groq MUST NOT be retried while on cooldown!
    const turn2 = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Give me one real-world application of it.',
        history: [
          { role: 'user', text: 'Explain quantum tunneling briefly.' },
          { role: 'model', text: 'OpenRouter Free $0 responding clearly.' },
        ],
      }),
    });
    const turn2Frames = parseSseFrames(await turn2.text());
    const turn2Meta = turn2Frames.filter((f) => f.meta).pop()?.meta;

    assert.equal(
      geminiCalls,
      geminiCallsAfterTurn1,
      'Exhausted Gemini provider must not receive duplicate retries while on cooldown'
    );
    assert.equal(
      groqCompletionCalls,
      groqCallsAfterTurn1,
      'Exhausted Groq provider must not receive duplicate retries while on cooldown'
    );
    assert.equal(openRouterBodies.length, 2, 'Turn 2 should route straight to healthy OpenRouter Free');
    assert.equal(turn2Meta.provider, 'openrouter');
    assert.ok(
      openRouterBodies[1].messages.some(
        (m) => m.role === 'assistant' && m.content.includes('OpenRouter Free $0')
      ),
      'Turn 2 must preserve prior conversation history seamlessly'
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('All three free providers exhausted emits friendly retry-later message and zero paid fallbacks', async () => {
  const attemptedExternalModels = [];

  const fakeGeminiClient = {
    models: {
      async generateContentStream() {
        throw makeQuota429Error('429 RESOURCE_EXHAUSTED Gemini');
      },
    },
  };

  const fakeFetch = async (url, init) => {
    if (url === 'https://api.groq.com/openai/v1/models') {
      return makeJsonResponse(200, ACTIVE_GROQ_CATALOG);
    }
    if (url === 'https://openrouter.ai/api/v1/models') {
      return makeJsonResponse(200, VERIFIED_OPENROUTER_CATALOG);
    }
    if (url === 'https://api.groq.com/openai/v1/chat/completions') {
      attemptedExternalModels.push(`groq:${JSON.parse(init.body).model}`);
      return makeJsonResponse(429, { error: { message: 'Groq rate limit exceeded' } }, { 'retry-after': '60' });
    }
    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      attemptedExternalModels.push(`openrouter:${JSON.parse(init.body).model}`);
      return makeJsonResponse(402, { error: { message: 'Insufficient credits' } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    geminiClientFactory: () => fakeGeminiClient,
    groqApiKey: 'gsk_free_test_key',
    openrouterApiKey: 'sk-or-v1-free-test-key',
    fetchImpl: fakeFetch,
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const resp = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello?' }),
    });
    const frames = parseSseFrames(await resp.text());
    const errFrame = frames.find((f) => typeof f.error === 'string');
    assert.ok(errFrame, 'Expected SSE error frame');
    assert.equal(errFrame.code, 'ALL_FREE_MODELS_EXHAUSTED');
    assert.equal(errFrame.allProvidersExhausted, true);
    assert.deepEqual(errFrame.attemptedProviders, ['gemini', 'groq', 'openrouter']);
    assert.match(errFrame.error, /₹0|zero-cost/i);
    assert.match(errFrame.error, /try again/i);

    // Every single attempted model must belong to the strict free-only allowlist
    for (const tag of attemptedExternalModels) {
      const [prov, ...rest] = tag.split(':');
      const modelId = rest.join(':');
      assert.equal(
        isApprovedFreeModelForProvider(prov, modelId),
        true,
        `Attempted model ${tag} must be in the strict free allowlist`
      );
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Backend runs seamlessly with ONLY GROQ_API_KEY configured across health, summarize, briefing, and reports', async () => {
  const fakeFetch = async (url, init) => {
    if (url === 'https://api.groq.com/openai/v1/models') {
      return makeJsonResponse(200, ACTIVE_GROQ_CATALOG);
    }
    if (url === 'https://api.groq.com/openai/v1/chat/completions') {
      const body = JSON.parse(init.body);
      if (body.stream) {
        return makeSseStreamResponse(['Groq-only ', 'online!']);
      }
      if (body.response_format?.type === 'json_object') {
        return makeJsonResponse(200, {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Discussed zero-cost multi-provider architecture.',
                  topics: ['JARVIS', 'Groq'],
                }),
              },
            },
          ],
        });
      }
      return makeJsonResponse(200, {
        choices: [{ message: { content: '## Report\nGenerated on Groq Free API.' } }],
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    geminiClientFactory: () => null,
    groqApiKey: 'gsk_only_groq_key',
    fetchImpl: fakeFetch,
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const healthResp = await fetch(`${baseUrl}/api/health`);
    const health = await healthResp.json();
    assert.equal(health.geminiConfigured, false);
    assert.equal(health.groqConfigured, true);
    assert.equal(health.aiConfigured, true);
    assert.equal(health.activeProvider, 'groq');

    const sumResp = await fetch(`${baseUrl}/api/chat/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', text: 'Let us configure Groq free tier' },
          { role: 'model', text: 'Configured strictly on ₹0 allowlist.' },
        ],
      }),
    });
    assert.equal(sumResp.status, 200);
    const sumBody = await sumResp.json();
    assert.equal(sumBody.provider, 'groq');
    assert.ok(sumBody.summary.includes('zero-cost'));

    const reportResp = await fetch(`${baseUrl}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Zero-Cost AI Architecture',
        sourceText: 'Compare Gemini Free, Groq Free API, and OpenRouter $0 models.',
        reportType: 'report',
      }),
    });
    assert.equal(reportResp.status, 200);
    const reportBody = await reportResp.json();
    assert.equal(reportBody.provider, 'groq');
    assert.ok(reportBody.content.includes('Groq Free API'));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Vision endpoint falls back to verified $0 OpenRouter vision model when Gemini hits 429', async () => {
  const openRouterVisionBodies = [];
  const fakeGeminiClient = {
    models: {
      async generateContent() {
        throw makeQuota429Error('429 RESOURCE_EXHAUSTED Gemini Vision');
      },
    },
  };

  const fakeFetch = async (url, init) => {
    if (url === 'https://openrouter.ai/api/v1/models') {
      return makeJsonResponse(200, VERIFIED_OPENROUTER_CATALOG);
    }
    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      const parsed = JSON.parse(init.body);
      openRouterVisionBodies.push(parsed);
      return makeJsonResponse(200, {
        choices: [{ message: { content: 'Detected circuit schematic via OpenRouter $0 Vision.' } }],
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const app = createApp({
    accessToken: '',
    rateLimitMax: 100,
    geminiClientFactory: () => fakeGeminiClient,
    groqApiKey: 'gsk_should_be_skipped_for_images',
    openrouterApiKey: 'sk-or-v1-vision-test',
    fetchImpl: fakeFetch,
  });

  const { server, baseUrl } = await startEphemeralServer(app);
  try {
    const resp = await fetch(`${baseUrl}/api/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        mimeType: 'image/png',
        prompt: 'Describe this schematic.',
      }),
    });
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.provider, 'openrouter');
    assert.equal(body.model, 'nvidia/nemotron-3.5-super-vl:free');
    assert.ok(body.analysis.includes('OpenRouter $0 Vision'));
    assert.equal(openRouterVisionBodies.length, 1);
    const userContent = openRouterVisionBodies[0].messages.find((m) => m.role === 'user')?.content;
    assert.ok(Array.isArray(userContent), 'Vision payload should use multimodal content array');
    assert.ok(userContent.some((part) => part.type === 'image_url'));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('buildOpenAiMessages merges consecutive same-role messages and preserves order cleanly', () => {
  const msgs = buildOpenAiMessages({
    systemInstruction: 'System rules',
    history: [
      { role: 'user', text: 'First question' },
      { role: 'user', text: 'Extra detail' },
      { role: 'model', text: 'First answer' },
    ],
    prompt: 'Follow-up',
  });
  assert.equal(msgs.length, 4);
  assert.equal(msgs[0].role, 'system');
  assert.equal(msgs[1].role, 'user');
  assert.match(msgs[1].content, /First question[\s\S]*Extra detail/);
  assert.equal(msgs[2].role, 'assistant');
  assert.equal(msgs[3].role, 'user');
  assert.equal(msgs[3].content, 'Follow-up');
});
