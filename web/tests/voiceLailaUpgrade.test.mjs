import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  computeExpressiveProsody,
  createTtsService,
  escapeXmlForSsml,
  LAILA_VOICE_PROFILES,
  resolveNeuralVoiceChain,
  shapeSoftProsodyText,
} from '../server/ttsService.js';
import { createApp } from '../server/index.js';
import { getVoiceTestSample, VOICE_TEST_SAMPLES } from '../src/services/femaleVoiceCatalog.js';

function listenEphemeral(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('SSML XML escaping neutralizes injection characters while preserving Hindi and punctuation', () => {
  const dirty = `Hello <break time="999s"/> & "AM AI" 'test' > नमस्ते!`;
  const escaped = escapeXmlForSsml(dirty);
  assert.ok(!escaped.includes('<break'));
  assert.ok(escaped.includes('&lt;break'));
  assert.ok(escaped.includes('&amp;'));
  assert.ok(escaped.includes('&quot;AM AI&quot;'));
  assert.ok(escaped.includes('&apos;test&apos;'));
  assert.ok(escaped.includes('नमस्ते!'));

  const shaped = shapeSoftProsodyText('**नमस्ते सर** — See `build.gradle.kts` & verify!');
  assert.ok(!shaped.includes('**'));
  assert.ok(!shaped.includes('`'));
  assert.ok(shaped.includes('नमस्ते सर'));
});

test('Laila expressive prosody applies gentle unhurried pace and subtle emotional pitch curves', () => {
  const greeting = computeExpressiveProsody({
    segmentText: 'अच्छा, सुनो ना... नमस्ते!',
    rate: 0.9,
    pitch: 1.0,
    stylePreset: 'laila_soft',
    femaleVoiceEnabled: true,
  });
  assert.equal(greeting.profileId, 'laila_soft');
  assert.equal(greeting.isGreeting, true);
  assert.equal(greeting.rateStr, '-12%');
  assert.equal(greeting.pitchStr, '+1Hz');

  const question = computeExpressiveProsody({
    segmentText: 'How are you today?',
    rate: 0.9,
    pitch: 1.0,
    stylePreset: 'laila_soft',
    femaleVoiceEnabled: true,
  });
  assert.equal(question.isQuestion, true);
  assert.equal(question.pitchStr, '+2Hz');

  const statement = computeExpressiveProsody({
    segmentText: 'I am right here with you.',
    rate: 0.9,
    pitch: 1.0,
    stylePreset: 'laila_soft',
    femaleVoiceEnabled: true,
  });
  assert.equal(statement.pitchStr, '-1Hz');
  assert.ok(LAILA_VOICE_PROFILES.laila_soft.sentencePauseMs >= 240);
});

test('Neural voice resolution selects Swara for Hindi and NeerjaExpressive/Ava for English with failover', () => {
  const hiChain = resolveNeuralVoiceChain({ lang: 'hi-IN', femaleVoiceEnabled: true });
  assert.equal(hiChain[0], 'hi-IN-SwaraNeural');

  const enInChain = resolveNeuralVoiceChain({ lang: 'en-IN', femaleVoiceEnabled: true });
  assert.equal(enInChain[0], 'en-IN-NeerjaExpressiveNeural');
  assert.ok(enInChain.includes('en-IN-NeerjaNeural'));

  const enUsChain = resolveNeuralVoiceChain({ lang: 'en-US', femaleVoiceEnabled: true });
  assert.equal(enUsChain[0], 'en-US-AvaMultilingualNeural');

  const explicit = resolveNeuralVoiceChain({
    lang: 'en-IN',
    femaleVoiceEnabled: true,
    preferredVoiceName: 'en-IN-NeerjaNeural',
  });
  assert.equal(explicit[0], 'en-IN-NeerjaNeural');
});

test('createTtsService handles bilingual segmentation, caching, and voice failover cleanly', async () => {
  const calls = [];
  const fakeBufferA = Buffer.from([0xff, 0xf3, 0x64, 0xc4, 0x01, 0x02]);
  const service = createTtsService({
    maxCacheEntries: 10,
    synthesizeSegmentFn: async ({ text, voiceName, rateStr, pitchStr }) => {
      calls.push({ text, voiceName, rateStr, pitchStr });
      if (voiceName === 'en-IN-NeerjaExpressiveNeural') {
        throw new Error('Transient preview timeout');
      }
      return fakeBufferA;
    },
  });

  const bilingual = await service.synthesizeSpeech({
    text: 'Hello... welcome to AM AI! अच्छा, सुनो ना। यह बहुत आरामदायक आवाज़ है।',
    bcp47Lang: 'en-IN',
    femaleVoiceEnabled: true,
    autoDetectLanguage: true,
    rate: 0.9,
    pitch: 1.0,
  });

  assert.equal(bilingual.ok, true);
  assert.equal(bilingual.segments.length, 4);
  // English segments fail over cleanly from NeerjaExpressive -> NeerjaNeural
  assert.equal(bilingual.segments[0].voiceName, 'en-IN-NeerjaNeural');
  assert.equal(bilingual.segments[1].voiceName, 'en-IN-NeerjaNeural');
  // Hindi Devanagari segments select hi-IN-SwaraNeural automatically
  assert.equal(bilingual.segments[2].voiceName, 'hi-IN-SwaraNeural');
  assert.equal(bilingual.segments[3].voiceName, 'hi-IN-SwaraNeural');
  assert.ok(bilingual.segments[0].pauseAfterMs >= 240);
  assert.ok(bilingual.segments[1].pauseAfterMs >= 240);
  assert.equal(bilingual.segments[3].pauseAfterMs, 0);

  // Repeating same Hindi segment with identical prosody hits LRU cache with 0 synthesis calls
  const prevCalls = calls.length;
  const cachedRes = await service.synthesizeSpeech({
    text: 'अच्छा, सुनो ना।',
    bcp47Lang: 'hi-IN',
    femaleVoiceEnabled: true,
    rate: 0.9,
    pitch: 1.0,
  });
  assert.equal(cachedRes.ok, true);
  assert.equal(calls.length, prevCalls);
  assert.ok(service.getCacheSize() >= 4);
});

test('Express TTS routes enforce Bearer token auth, input bounds, and advertise capability on /api/health', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-tts-route-'));
  const fakeMp3 = Buffer.from([0xff, 0xf3, 0x64, 0xc4, 0x10, 0x20, 0x30]);

  const app = createApp({
    accessToken: 'secret-voice-token',
    memoryFile: path.join(tmpDir, 'mem.json'),
    workspaceFile: path.join(tmpDir, 'ws.json'),
    brainStateFile: path.join(tmpDir, 'brain.json'),
    openjarvisMemoryFile: path.join(tmpDir, 'oj-mem.json'),
    openjarvisLearningFile: path.join(tmpDir, 'oj-learn.json'),
    ttsSynthesizeFn: async () => fakeMp3,
  });

  const { server, baseUrl } = await listenEphemeral(app);
  try {
    // Health endpoint advertises neural-female-tts
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assert.ok(healthJson.capabilities.includes('neural-female-tts'));

    // Missing Bearer token blocked with 401
    const unauth = await fetch(`${baseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello' }),
    });
    assert.equal(unauth.status, 401);

    // Valid token + GET /api/tts/voices works
    const voicesRes = await fetch(`${baseUrl}/api/tts/voices`, {
      headers: { Authorization: 'Bearer secret-voice-token' },
    });
    assert.equal(voicesRes.status, 200);
    const voicesJson = await voicesRes.json();
    assert.equal(voicesJson.defaultStyle, 'laila_soft');
    assert.ok(voicesJson.voices.some((v) => v.id === 'hi-IN-SwaraNeural'));

    // Empty text returns 400
    const badReq = await fetch(`${baseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-voice-token',
      },
      body: JSON.stringify({ text: '   ' }),
    });
    assert.equal(badReq.status, 400);

    // responseFormat: 'mp3' returns raw audio/mpeg bytes
    const mp3Res = await fetch(`${baseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-voice-token',
      },
      body: JSON.stringify({
        text: getVoiceTestSample('HINDI'),
        bcp47Lang: 'hi-IN',
        responseFormat: 'mp3',
      }),
    });
    assert.equal(mp3Res.status, 200);
    assert.equal(mp3Res.headers.get('content-type'), 'audio/mpeg');
    const mp3Bytes = Buffer.from(await mp3Res.arrayBuffer());
    assert.ok(mp3Bytes.length > 0);
    assert.equal(mp3Bytes[0], 0xff);
    assert.ok(Object.keys(VOICE_TEST_SAMPLES).includes('HINDI'));
    assert.ok(Object.keys(VOICE_TEST_SAMPLES).includes('ENGLISH'));
    assert.ok(Object.keys(VOICE_TEST_SAMPLES).includes('HINGLISH'));
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
