import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyElevenLabsError,
  computeElevenLabsVoiceSettings,
  createTtsService,
  detectElevenLabsLanguageCode,
  ELEVENLABS_DEFAULT_MODEL_ID,
  ELEVENLABS_VOICE_ID,
  ELEVENLABS_VOICE_NAME,
  isValidMpegAudioBuffer,
} from '../server/ttsService.js';
import { createApp } from '../server/index.js';
import { formatTextForSpeech } from '../src/services/speechFormatter.js';
import {
  buildAudioCacheKey,
  createClientAudioCache,
  createVoiceCircuitBreaker,
  fetchElevenLabsSentenceAudio,
  isValidMpegAudioBytes,
  resolveTruthfulVoiceStatus,
  VOICE_STATUS_LABELS,
} from '../src/services/voiceFailoverPolicy.js';

function listenEphemeral(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function makeFakeValidMp3(size = 256, marker = 0x11) {
  const buf = Buffer.alloc(size, marker);
  buf[0] = 0x49; // 'I'
  buf[1] = 0x44; // 'D'
  buf[2] = 0x33; // '3'
  return buf;
}

test('Scenario 1-2: ElevenLabs Monika Sogam voice ID, model eleven_flash_v2_5, and secret isolation', async () => {
  assert.equal(ELEVENLABS_VOICE_ID, 'ohvvU75FpBEB8fdaLOMh');
  assert.equal(ELEVENLABS_VOICE_NAME, 'Monika Sogam – Lively E-com Support');
  assert.equal(ELEVENLABS_DEFAULT_MODEL_ID, 'eleven_flash_v2_5');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-elevenlabs-'));
  const observedCalls = [];
  const fakeMp3 = makeFakeValidMp3(320, 0x22);

  const app = createApp({
    memoryFile: path.join(tmpDir, 'mem.json'),
    workspaceFile: path.join(tmpDir, 'ws.json'),
    brainStateFile: path.join(tmpDir, 'brain.json'),
    openjarvisMemoryFile: path.join(tmpDir, 'oj-mem.json'),
    openjarvisLearningFile: path.join(tmpDir, 'oj-learn.json'),
    elevenLabsApiKey: 'sk_test_super_secret_key_do_not_leak',
    elevenLabsSynthesizeFn: async (reqParams) => {
      observedCalls.push(reqParams);
      return fakeMp3;
    },
  });

  const { server, baseUrl } = await listenEphemeral(app);
  try {
    // Verify API key NEVER leaks in /api/health, /api/config, or /api/tts/voices
    for (const route of ['/api/health', '/api/config', '/api/tts/voices', '/api/tts/voices?probe=true']) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200);
      const rawText = await res.text();
      assert.ok(!rawText.includes('sk_test_super_secret_key_do_not_leak'), `API key leaked in ${route}`);
      const json = JSON.parse(rawText);
      if (route === '/api/health') {
        assert.equal(json.elevenLabsConfigured, true);
        assert.equal(json.ttsVoiceId, 'ohvvU75FpBEB8fdaLOMh');
        assert.equal(json.ttsModelId, 'eleven_flash_v2_5');
      }
      if (route.includes('probe=true')) {
        assert.equal(json.verification?.ok, true);
        assert.equal(json.verification?.verified, true);
        assert.equal(json.verification?.voiceId, 'ohvvU75FpBEB8fdaLOMh');
      }
    }

    // Real synthesis check via POST /api/tts/synthesize
    const synthRes = await fetch(`${baseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello! Main Monika hoon, AM AI voice system ready hai.',
        responseFormat: 'mp3',
      }),
    });
    assert.equal(synthRes.status, 200);
    assert.equal(synthRes.headers.get('content-type'), 'audio/mpeg');
    assert.equal(synthRes.headers.get('x-tts-engine'), 'elevenlabs');
    assert.equal(synthRes.headers.get('x-tts-voice-id'), 'ohvvU75FpBEB8fdaLOMh');
    assert.equal(synthRes.headers.get('x-tts-model'), 'eleven_flash_v2_5');
    const outBytes = new Uint8Array(await synthRes.arrayBuffer());
    assert.equal(isValidMpegAudioBytes(outBytes), true);
    assert.ok(observedCalls.some((c) => c.voiceId === 'ohvvU75FpBEB8fdaLOMh' && c.modelId === 'eleven_flash_v2_5'));
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Scenario 3-6: English, Devanagari Hindi, Hinglish auto-detection and Markdown/Emoji/HTML cleanup', () => {
  assert.equal(detectElevenLabsLanguageCode('Good morning! All systems are online.', 'en-IN', true), 'en');
  assert.equal(detectElevenLabsLanguageCode('नमस्ते सर, आज मौसम बहुत अच्छा है।', 'en-IN', true), 'hi');
  // Mixed Hinglish omits language_code so eleven_flash_v2_5 auto-switches smoothly
  assert.equal(detectElevenLabsLanguageCode('Namaste Sir, aaj ka plan bilkul ready hai!', 'en-IN', true), undefined);
  assert.equal(
    detectElevenLabsLanguageCode('आपकी Python API का latency अभी 42ms पर चल रहा है।', 'hi-IN', true),
    undefined
  );

  const dirty = '<h2>🚀 Status **Update**</h2><br>Check [docs](https://example.com) — AM AI is <b>99%</b> ready! ✨🎙️ `runTask()`';
  const cleaned = formatTextForSpeech(dirty);
  assert.doesNotMatch(cleaned, /<[^>]+>|\*\*|`|https?:\/\/|🚀|✨|🎙/);
  assert.ok(cleaned.includes('A M A I'));
  assert.ok(cleaned.includes('99%'));
  assert.ok(cleaned.includes('runTask'));

  const vs = computeElevenLabsVoiceSettings({ rate: 0.96, stylePreset: 'laila_soft', text: 'Namaste!' });
  assert.ok(vs.speed >= 0.7 && vs.speed <= 1.2);
  assert.equal(vs.use_speaker_boost, true);
});

test('Scenario 7-13: Failover on missing key, 401, 402, 429, 500, timeout, offline & corrupted audio without voice substitution', async () => {
  // Missing API key -> honest 503 fallbackRequired without silently swapping another ElevenLabs voice
  const noKeyService = createTtsService({ elevenLabsApiKey: '' });
  const noKeyResult = await noKeyService.synthesizeSpeech({ text: 'Hello world', responseFormat: 'mp3' });
  assert.equal(noKeyResult.ok, false);
  assert.equal(noKeyResult.fallbackRequired, true);
  assert.equal(noKeyResult.code, 'ELEVENLABS_NOT_CONFIGURED');

  // HTTP 401/402/429/500 & empty/corrupt audio error classification
  assert.equal(classifyElevenLabsError({ status: 401 }).code, 'ELEVENLABS_AUTH_ERROR');
  assert.equal(classifyElevenLabsError({ status: 402 }).code, 'ELEVENLABS_QUOTA_EXCEEDED');
  assert.equal(classifyElevenLabsError({ status: 429 }).code, 'ELEVENLABS_RATE_LIMIT');
  assert.equal(classifyElevenLabsError({ name: 'AbortError' }).code, 'ELEVENLABS_TIMEOUT');
  assert.equal(isValidMpegAudioBuffer(Buffer.from('{"error":"bad"}')), false);
  assert.equal(isValidMpegAudioBuffer(Buffer.alloc(10)), false);

  // Client fetch helper rejects corrupted JSON disguised as response and caches valid audio
  const badRes = await fetchElevenLabsSentenceAudio({
    text: 'Testing corrupt audio guard',
    endpointUrl: 'http://localhost/api/tts/synthesize',
    headers: { 'Content-Type': 'application/json' },
    fetchImpl: async () => new Response('{"error":"quota"}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  });
  assert.equal(badRes.ok, false);
  assert.equal(badRes.code, 'ELEVENLABS_NON_AUDIO_RESPONSE');

  const truncatedBytes = new Uint8Array([0x01, 0x02, 0x03]);
  const corruptRes = await fetchElevenLabsSentenceAudio({
    text: 'Testing truncated audio guard',
    endpointUrl: 'http://localhost/api/tts/synthesize',
    headers: { 'Content-Type': 'application/json' },
    fetchImpl: async () => new Response(truncatedBytes, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }),
  });
  assert.equal(corruptRes.ok, false);
  assert.equal(corruptRes.code, 'ELEVENLABS_CORRUPT_AUDIO');

  // Timeout aborts cleanly
  const timeoutRes = await fetchElevenLabsSentenceAudio({
    text: 'Slow network request',
    endpointUrl: 'http://localhost/api/tts/synthesize',
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: 30,
    fetchImpl: (_url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('Aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }),
  });
  assert.equal(timeoutRes.ok, false);
  assert.equal(timeoutRes.code, 'ELEVENLABS_TIMEOUT');

  // Client LRU cache hits cleanly on repeat text without re-calling network
  const cache = createClientAudioCache(4);
  let netCalls = 0;
  const fakeValid = new Uint8Array(makeFakeValidMp3(256, 0x44));
  const goodFetch = async () => {
    netCalls += 1;
    return new Response(fakeValid, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  };
  const first = await fetchElevenLabsSentenceAudio({
    text: 'Cache me please.',
    endpointUrl: 'http://localhost/api/tts/synthesize',
    headers: { 'Content-Type': 'application/json' },
    fetchImpl: goodFetch,
    cache,
  });
  const second = await fetchElevenLabsSentenceAudio({
    text: 'Cache me please.',
    endpointUrl: 'http://localhost/api/tts/synthesize',
    headers: { 'Content-Type': 'application/json' },
    fetchImpl: goodFetch,
    cache,
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.cached, true);
  assert.equal(netCalls, 1);
  assert.ok(buildAudioCacheKey({ text: 'Cache me please.' }).includes('ohvvU75FpBEB8fdaLOMh'));
});

test('Scenario 14-18: Circuit breaker cooldown, half-open recovery, and truthful UI voice status labels', () => {
  let fakeNow = 1_000_000;
  const breaker = createVoiceCircuitBreaker({ cooldownMs: 45_000, nowFn: () => fakeNow });

  assert.equal(breaker.shouldAttemptPrimary(), true);
  assert.equal(
    resolveTruthfulVoiceStatus({ hasAnyVoice: true, neuralTtsEnabled: true, usingBuiltInFallback: false, circuitOpen: breaker.isOpen() }),
    VOICE_STATUS_LABELS.ELEVENLABS_ACTIVE
  );

  // Trip on upstream 429
  breaker.trip('ELEVENLABS_RATE_LIMIT', 45_000);
  assert.equal(breaker.isOpen(), true);
  assert.equal(breaker.shouldAttemptPrimary(), false);
  assert.equal(
    resolveTruthfulVoiceStatus({ hasAnyVoice: true, neuralTtsEnabled: true, usingBuiltInFallback: true, circuitOpen: breaker.isOpen() }),
    VOICE_STATUS_LABELS.BUILTIN_FALLBACK
  );
  assert.equal(
    resolveTruthfulVoiceStatus({ hasAnyVoice: true, neuralTtsEnabled: true, usingBuiltInFallback: false, circuitOpen: breaker.isOpen() }),
    VOICE_STATUS_LABELS.ELEVENLABS_RECONNECTING
  );

  // Advance past cooldown -> allows probing on next speech turn
  fakeNow += 46_000;
  assert.equal(breaker.isOpen(), false);
  assert.equal(breaker.shouldAttemptPrimary(), true);

  // Successful probe closes circuit cleanly
  breaker.recordSuccess();
  assert.equal(breaker.getLastFailureCode(), null);
  assert.equal(
    resolveTruthfulVoiceStatus({ hasAnyVoice: true, neuralTtsEnabled: true, usingBuiltInFallback: false, circuitOpen: breaker.isOpen() }),
    VOICE_STATUS_LABELS.ELEVENLABS_ACTIVE
  );

  // No voice available at all
  assert.equal(
    resolveTruthfulVoiceStatus({ hasAnyVoice: false }),
    VOICE_STATUS_LABELS.VOICE_UNAVAILABLE
  );
});

test('Scenario 19: Streaming responseFormat=stream handles valid audio and instant fallback JSON cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-elevenlabs-stream-'));
  const fakeMp3 = makeFakeValidMp3(256, 0x55);

  const appWorking = createApp({
    memoryFile: path.join(tmpDir, 'mem1.json'),
    workspaceFile: path.join(tmpDir, 'ws1.json'),
    brainStateFile: path.join(tmpDir, 'brain1.json'),
    openjarvisMemoryFile: path.join(tmpDir, 'oj-mem1.json'),
    openjarvisLearningFile: path.join(tmpDir, 'oj-learn1.json'),
    elevenLabsApiKey: 'sk_test_stream_key',
    elevenLabsSynthesizeFn: async () => fakeMp3,
  });

  const { server, baseUrl } = await listenEphemeral(appWorking);
  try {
    const res = await fetch(`${baseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Streaming hello from Monika.', responseFormat: 'stream' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(isValidMpegAudioBytes(bytes), true);
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
