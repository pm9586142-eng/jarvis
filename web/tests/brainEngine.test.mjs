import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBrainRequest,
  buildContextWindow,
  classifyGeminiError,
  detectFollowUp,
  detectIntent,
  detectLanguageMode,
  determineReasoningMode,
} from '../src/services/brainEngine.js';

test('detectLanguageMode accurately identifies English, Hindi, Hinglish, and Gujarati', () => {
  assert.equal(detectLanguageMode('Explain dependency injection cleanly'), 'ENGLISH');
  assert.equal(detectLanguageMode('कृपया मुझे क्वांटम कंप्यूटिंग समझाएं'), 'HINDI');
  assert.equal(detectLanguageMode('Bhai ye Kotlin coroutine kaise kaam karta hai?'), 'HINGLISH');
  assert.equal(detectLanguageMode('કૃપા કરીને આ કોડ સમજાવો'), 'GUJARATI');
  assert.equal(detectLanguageMode('Hello', 'HINGLISH'), 'HINGLISH');
});

test('detectIntent classifies coding, planning, summarization, research, diagnostics, and follow-ups', () => {
  const sampleHistory = [
    { role: 'user', text: 'Explain JWT authentication in Express' },
    { role: 'model', text: 'JWT stands for JSON Web Token and signs stateless claims.' },
  ];

  assert.equal(detectIntent('Write a TypeScript function to validate JWT tokens', []), 'CODING');
  assert.equal(detectIntent('Create a step by step roadmap to launch my Android app', []), 'PLANNING');
  assert.equal(detectIntent('Summarize the above discussion in 3 bullet points', sampleHistory), 'SUMMARIZATION');
  assert.equal(detectIntent('Compare Room vs SQLDelight pros and cons', []), 'RESEARCH');
  assert.equal(detectIntent('Check battery and system telemetry', []), 'SYSTEM_DIAGNOSTICS');
  assert.equal(detectIntent('Explain more about that', sampleHistory), 'FOLLOW_UP');
});

test('detectFollowUp recognizes contextual pronouns and excludes greetings', () => {
  const history = [
    { role: 'user', text: 'Create a Docker deployment plan' },
    { role: 'model', text: 'Step 1 is writing a multi-stage Dockerfile.' },
  ];

  assert.equal(detectFollowUp('Why?', history), true);
  assert.equal(detectFollowUp('aur batao iske baare mein', history), true);
  assert.equal(detectFollowUp('Hi Jarvis', history), false);
  assert.equal(detectFollowUp('Why?', []), false);
});

test('determineReasoningMode scales thinkingBudget for greetings vs deep reasoning', () => {
  assert.deepEqual(
    determineReasoningMode({ prompt: 'Hello Jarvis', intent: 'CONVERSATION', isFollowUp: false }),
    { mode: 'fast', thinkingBudget: 0 }
  );
  assert.deepEqual(
    determineReasoningMode({
      prompt: 'Design a scalable step by step multi-region architecture',
      intent: 'PLANNING',
      isFollowUp: false,
    }),
    { mode: 'deep', thinkingBudget: 1024 }
  );
  assert.deepEqual(
    determineReasoningMode({ prompt: 'Explain coroutines', intent: 'EXPLANATION', isFollowUp: false }),
    { mode: 'structured', thinkingBudget: 512 }
  );
});

test('buildContextWindow caps recent turns at 16 and generates earlier digest', () => {
  const history = Array.from({ length: 22 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'model',
    text: `Turn message #${i + 1} discussing Android architecture`,
  }));

  const ctx = buildContextWindow(history, 16);
  assert.equal(ctx.recentMessages.length, 16);
  assert.equal(ctx.earlierCount, 6);
  assert.match(ctx.earlierContextDigest, /Earlier turns \(6 archived messages/);
  assert.match(ctx.earlierContextDigest, /Turn message #6/);
});

test('analyzeBrainRequest emits complete directives and saved conversation summary', () => {
  const analysis = analyzeBrainRequest({
    prompt: 'Step by step samjhao ki step 2 kaise optimize karu',
    history: [
      { role: 'user', text: 'Help build a FastAPI backend' },
      { role: 'model', text: 'Step 2 configures async connection pooling.' },
    ],
    preferredLanguage: 'ENGLISH',
    conversationSummary: 'Building an async FastAPI backend with Postgres.',
  });

  assert.equal(analysis.detectedLanguage, 'HINGLISH');
  assert.equal(analysis.isFollowUp, true);
  assert.equal(analysis.reasoningMode, 'deep');
  assert.match(analysis.brainDirectiveBlock, /Language Mode: HINGLISH/);
  assert.match(analysis.brainDirectiveBlock, /Building an async FastAPI backend/);
});

test('classifyGeminiError returns actionable structured codes and messages', () => {
  assert.equal(classifyGeminiError(401, 'API key not valid').code, 'GEMINI_AUTH_ERROR');
  const modelErr = classifyGeminiError(404, 'models/gemini-2.5-flash is no longer available to new users.');
  assert.equal(modelErr.code, 'GEMINI_MODEL_NOT_FOUND');
  assert.match(modelErr.message, /gemini-3\.8-flash/i);
  assert.equal(
    classifyGeminiError(undefined, 'models/gemini-2.5-flash is no longer available to new users.').code,
    'GEMINI_MODEL_NOT_FOUND'
  );
  assert.equal(classifyGeminiError(429, 'Quota exceeded').code, 'GEMINI_RATE_LIMIT');
  assert.equal(classifyGeminiError(503, 'Model overloaded').code, 'GEMINI_UNAVAILABLE');
  assert.equal(classifyGeminiError(504, 'Request deadline timed out').code, 'GEMINI_TIMEOUT');
  assert.equal(classifyGeminiError(400, 'Invalid argument token count').code, 'GEMINI_BAD_REQUEST');
});
