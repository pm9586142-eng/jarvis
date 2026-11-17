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
  extractGeminiErrorDetails,
  parseRetryDelaySeconds,
  shouldAutoExtractMemories,
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

test('classifyGeminiError returns actionable structured codes and preserves verbatim upstream messages', () => {
  assert.equal(classifyGeminiError(401, 'API key not valid').code, 'GEMINI_AUTH_ERROR');
  const modelErr = classifyGeminiError(404, 'models/gemini-2.5-flash is no longer available to new users.');
  assert.equal(modelErr.code, 'GEMINI_MODEL_NOT_FOUND');
  assert.match(modelErr.message, /models\/gemini-2\.5-flash is no longer available to new users\./);
  assert.match(modelErr.message, /gemini-3\.8-flash/i);
  assert.equal(
    classifyGeminiError(undefined, 'models/gemini-2.5-flash is no longer available to new users.').code,
    'GEMINI_MODEL_NOT_FOUND'
  );
  const genericRate = classifyGeminiError(429, 'Quota exceeded');
  assert.equal(genericRate.code, 'GEMINI_RATE_LIMIT');
  assert.equal(genericRate.quotaCategory, 'GENERIC_RATE_LIMIT');
  assert.equal(genericRate.retryable, true);
  assert.match(genericRate.message, /Quota exceeded/);
  assert.doesNotMatch(genericRate.message, /Gemini API rate limit or quota reached/i);

  assert.equal(classifyGeminiError(503, 'Model overloaded').code, 'GEMINI_UNAVAILABLE');
  assert.equal(classifyGeminiError(504, 'Request deadline timed out').code, 'GEMINI_TIMEOUT');
  assert.equal(classifyGeminiError(400, 'Invalid argument token count').code, 'GEMINI_BAD_REQUEST');
});

test('extractGeminiErrorDetails and classifyGeminiError distinguish RPM, TPM, RPD, Billing, and Spend Cap errors', () => {
  // 1. RPM (retryable) — note boilerplate "check your plan and billing details" MUST NOT misclassify as BILLING
  const rpmSdkError = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message:
          'You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15. Please retry in 3.5s.',
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
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '3.5s',
          },
        ],
      },
    })
  );
  rpmSdkError.status = 429;
  const rpmExtracted = extractGeminiErrorDetails(rpmSdkError);
  assert.equal(rpmExtracted.httpStatus, 429);
  assert.equal(rpmExtracted.upstreamStatus, 'RESOURCE_EXHAUSTED');
  assert.equal(rpmExtracted.retryAfterSeconds, 3.5);
  assert.equal(rpmExtracted.quotaViolations.length, 1);

  const rpmCls = classifyGeminiError(rpmExtracted.httpStatus, rpmExtracted.upstreamMessage, rpmExtracted);
  assert.equal(rpmCls.code, 'GEMINI_QUOTA_RPM');
  assert.equal(rpmCls.quotaCategory, 'RPM');
  assert.equal(rpmCls.retryable, true);
  assert.equal(rpmCls.retryAfterSeconds, 3.5);
  assert.match(rpmCls.message, /HTTP 429/);
  assert.match(rpmCls.message, /RPM/);
  assert.match(rpmCls.message, /limit: 15/);

  // 2. TPM (retryable)
  const tpmErr = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Quota exceeded for metric: input_token_count per minute, limit: 250000',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_input_token_count',
                quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier',
                quotaValue: '250000',
              },
            ],
          },
        ],
      },
    })
  );
  const tpmExtracted = extractGeminiErrorDetails(tpmErr);
  const tpmCls = classifyGeminiError(tpmExtracted.httpStatus, tpmExtracted.upstreamMessage, tpmExtracted);
  assert.equal(tpmCls.code, 'GEMINI_QUOTA_TPM');
  assert.equal(tpmCls.quotaCategory, 'TPM');
  assert.equal(tpmCls.retryable, true);
  assert.match(tpmCls.message, /250000/);

  // 3. RPD (non-retryable)
  const rpdErr = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Quota exceeded for requests per day, limit: 1500. Please check your plan and billing details.',
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
    })
  );
  const rpdExtracted = extractGeminiErrorDetails(rpdErr);
  const rpdCls = classifyGeminiError(rpdExtracted.httpStatus, rpdExtracted.upstreamMessage, rpdExtracted);
  assert.equal(rpdCls.code, 'GEMINI_QUOTA_RPD');
  assert.equal(rpdCls.quotaCategory, 'RPD');
  assert.equal(rpdCls.retryable, false);
  assert.match(rpdCls.message, /limit: 1500/);
  assert.match(rpdCls.message, /Google AI Studio Usage & limits/i);

  // 4. Billing / limit: 0 (non-retryable)
  const billingZeroErr = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0. Free tier is not available in your region.',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
                quotaValue: '0',
              },
            ],
          },
        ],
      },
    })
  );
  const billingExtracted = extractGeminiErrorDetails(billingZeroErr);
  const billingCls = classifyGeminiError(billingExtracted.httpStatus, billingExtracted.upstreamMessage, billingExtracted);
  assert.equal(billingCls.code, 'GEMINI_QUOTA_BILLING');
  assert.equal(billingCls.quotaCategory, 'BILLING');
  assert.equal(billingCls.retryable, false);
  assert.match(billingCls.message, /limit: 0/);
  assert.match(billingCls.message, /billing tier/i);

  // 4b. Explicit BILLING_DISABLED reason on 403
  const billingDisabledErr = new Error(
    JSON.stringify({
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'This API method requires billing to be enabled.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'BILLING_DISABLED' }],
      },
    })
  );
  const bdExtracted = extractGeminiErrorDetails(billingDisabledErr);
  const bdCls = classifyGeminiError(bdExtracted.httpStatus, bdExtracted.upstreamMessage, bdExtracted);
  assert.equal(bdCls.code, 'GEMINI_QUOTA_BILLING');
  assert.equal(bdCls.quotaCategory, 'BILLING');
  assert.equal(bdCls.retryable, false);

  // 5. Spend Cap (non-retryable)
  const spendCapErr = new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Project monthly spend cap exceeded for Gemini Developer API.',
      },
    })
  );
  const spendExtracted = extractGeminiErrorDetails(spendCapErr);
  const spendCls = classifyGeminiError(spendExtracted.httpStatus, spendExtracted.upstreamMessage, spendExtracted);
  assert.equal(spendCls.code, 'GEMINI_QUOTA_SPEND_CAP');
  assert.equal(spendCls.quotaCategory, 'SPEND_CAP');
  assert.equal(spendCls.retryable, false);
  assert.match(spendCls.message, /monthly spend cap exceeded/i);
  assert.match(spendCls.message, /spend cap settings/i);
});

test('parseRetryDelaySeconds parses seconds, milliseconds, and inline Google retry notices', () => {
  assert.equal(parseRetryDelaySeconds('42s'), 42);
  assert.equal(parseRetryDelaySeconds('500ms'), 0.5);
  assert.equal(parseRetryDelaySeconds('Please retry in 12.5s.'), 12.5);
  assert.equal(parseRetryDelaySeconds(''), null);
});

test('shouldAutoExtractMemories skips greetings/generic Q&A and enables durable user facts', () => {
  assert.equal(shouldAutoExtractMemories('Hello Jarvis'), false);
  assert.equal(shouldAutoExtractMemories('What is the capital of France?'), false);
  assert.equal(shouldAutoExtractMemories('Explain how HTTP 429 exponential backoff works'), false);
  assert.equal(shouldAutoExtractMemories('I prefer concise TypeScript answers for my project'), true);
  assert.equal(shouldAutoExtractMemories('Mera naam Aarav hai aur mujhe Hinglish pasand hai'), true);
});
