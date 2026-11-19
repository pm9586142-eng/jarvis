import { buildOpenAiMessages } from '../freeMultiProvider.js';
import { redactSecrets, sanitizeModelOutput } from './securityGuard.js';
import { estimateTokens } from './usageMonitor.js';

export const ROUTING_MODES = Object.freeze(['auto', 'manual', 'task_based']);

export const TASK_DOMAINS = Object.freeze([
  'general',
  'coding',
  'research',
  'reasoning',
  'mathematics',
  'writing',
  'vision',
  'document_analysis',
  'security',
  'debugging',
  'testing',
  'voice',
  'memory',
  'planning',
  'automation',
]);

/**
 * Default free-provider failover priority order:
 * Cloud Tier 1 (Gemini -> Groq -> OpenRouter $0) ->
 * Cloud Tier 2 (Mistral -> SambaNova -> NVIDIA NIM -> Cloudflare -> Cohere -> Hugging Face) ->
 * Local Fallback (Ollama when configured & reachable).
 */
export const DEFAULT_BRAIN_FALLBACK_ORDER = Object.freeze([
  'gemini',
  'groq',
  'openrouter',
  'mistral',
  'sambanova',
  'nvidia',
  'cloudflare',
  'cohere',
  'huggingface',
  'ollama',
]);

/**
 * Classifies a prompt into its primary task domain for intelligent model routing.
 */
export function classifyTaskDomain(prompt, { hasImage = false, hasDocument = false, isVoice = false } = {}) {
  if (hasImage) return 'vision';
  if (hasDocument) return 'document_analysis';

  const text = String(prompt || '').toLowerCase();
  if (!text.trim()) return isVoice ? 'voice' : 'general';

  if (/\b(debug|stack\s*trace|exception|bug|fix\s+(?:this|the)\s+error|crash|nullpointer|undefined\s+is\s+not|typeerror|segfault)\b/i.test(text)) {
    return 'debugging';
  }
  if (/\b(unit\s*test|integration\s*test|test\s+case|jest|vitest|pytest|robolectric|junit|assert|coverage|mock\s+test|tdd)\b/i.test(text)) {
    return 'testing';
  }
  if (/\b(security|owasp|xss|sql\s*injection|csrf|ssrf|vulnerability|encrypt|jwt|auth\s*audit|pentest|secret\s*leak|prompt\s*injection)\b/i.test(text)) {
    return 'security';
  }
  if (/\b(code|typescript|javascript|python|kotlin|react|express|sql|api\s*endpoint|function|algorithm|refactor|regex|dockerfile|html|css)\b/i.test(text)) {
    return 'coding';
  }
  if (/\b(math|equation|calculus|integral|derivative|matrix|probability|theorem|proof|solve\s+for\s+x|algebra|statistics|formula)\b/i.test(text)) {
    return 'mathematics';
  }
  if (/\b(research|latest|compare|benchmark|market\s*analysis|citations|sources|survey|state\s+of\s+the\s+art|investigate)\b/i.test(text)) {
    return 'research';
  }
  if (/\b(roadmap|milestone|project\s*plan|architecture\s*plan|sprint|schedule|prioritize|timeline|strategy|break\s+down)\b/i.test(text)) {
    return 'planning';
  }
  if (/\b(automate|automation|workflow|cron|reminder|shortcut|trigger|open\s+website|macro|batch\s+action)\b/i.test(text)) {
    return 'automation';
  }
  if (/\b(remember|memory|recall|forget|what\s+did\s+we\s+discuss|saved\s+preferences)\b/i.test(text)) {
    return 'memory';
  }
  if (/\b(write|essay|blog|email|letter|copywriting|rewrite|summarize|translate|story|script|caption)\b/i.test(text)) {
    return 'writing';
  }
  if (/\b(reason|analyze|trade-?off|pros\s+and\s+cons|why\s+does|first\s+principles|evaluate|deduce|logic)\b/i.test(text)) {
    return 'reasoning';
  }
  return isVoice ? 'voice' : 'general';
}

/**
 * Intelligent AI Router (Phase 3).
 * Coordinates Automatic, Manual, and Task-Based model routing across ALL 11+ verified-free
 * providers while enforcing Strict $0 Policy, rate-limit cooldown awareness, timeout budgets,
 * and zero infinite retry loops.
 */
export function createIntelligentRouter({
  providerManager,
  legacyGeminiExecute,
  usageMonitor = null,
  auditLogger = null,
  initialFallbackOrder = DEFAULT_BRAIN_FALLBACK_ORDER,
} = {}) {
  const policy = {
    mode: 'auto', // 'auto' | 'manual' | 'task_based'
    strictZeroCost: true,
    preferFreeTier: true,
    manualProvider: null,
    manualModel: null,
    fallbackOrder: [...initialFallbackOrder],
    domainPreferences: {
      coding: ['gemini', 'groq', 'openrouter', 'mistral', 'sambanova', 'nvidia', 'cloudflare', 'huggingface', 'ollama'],
      debugging: ['gemini', 'groq', 'openrouter', 'sambanova', 'mistral', 'nvidia', 'cloudflare', 'ollama'],
      testing: ['gemini', 'groq', 'openrouter', 'mistral', 'sambanova', 'cloudflare', 'ollama'],
      reasoning: ['gemini', 'openrouter', 'sambanova', 'nvidia', 'groq', 'cloudflare', 'huggingface', 'ollama'],
      mathematics: ['gemini', 'sambanova', 'nvidia', 'openrouter', 'groq', 'cloudflare', 'ollama'],
      research: ['gemini', 'cohere', 'groq', 'openrouter', 'mistral', 'sambanova', 'ollama'],
      vision: ['gemini', 'openrouter', 'mistral', 'ollama'],
      document_analysis: ['gemini', 'cohere', 'openrouter', 'groq', 'mistral', 'ollama'],
      security: ['gemini', 'openrouter', 'groq', 'sambanova', 'nvidia', 'mistral', 'ollama'],
      writing: ['gemini', 'groq', 'mistral', 'cohere', 'openrouter', 'ollama'],
      voice: ['groq', 'gemini', 'cloudflare', 'sambanova', 'openrouter', 'ollama'],
      planning: ['gemini', 'groq', 'openrouter', 'mistral', 'cohere', 'ollama'],
      automation: ['groq', 'gemini', 'openrouter', 'mistral', 'ollama'],
      memory: ['groq', 'gemini', 'cohere', 'openrouter', 'ollama'],
      general: [...DEFAULT_BRAIN_FALLBACK_ORDER],
    },
    maxProvidersPerRequest: 5,
    maxModelsPerProvider: 2,
    requestTimeoutMs: process.env.VERCEL ? 18000 : 38000,
  };

  function resolveOrderedProviders({
    domain = 'general',
    requireVision = false,
    preferredProvider = null,
    excludeProviders = [],
  } = {}) {
    const excluded = new Set(excludeProviders);
    let baseOrder = [...policy.fallbackOrder];

    if (policy.mode === 'task_based' && policy.domainPreferences[domain]) {
      baseOrder = [...policy.domainPreferences[domain], ...policy.fallbackOrder];
    } else if (policy.mode === 'manual' && policy.manualProvider) {
      baseOrder = [policy.manualProvider, ...policy.fallbackOrder];
    }

    if (preferredProvider) {
      baseOrder = [preferredProvider, ...baseOrder];
    }

    // Include any registered custom free providers at the end before Ollama
    const allProviderRecords = providerManager.listProviders();
    for (const rec of allProviderRecords) {
      if (rec.isCustom && rec.eligibleForZeroCost && !baseOrder.includes(rec.id)) {
        const ollamaIdx = baseOrder.indexOf('ollama');
        if (ollamaIdx >= 0) baseOrder.splice(ollamaIdx, 0, rec.id);
        else baseOrder.push(rec.id);
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const pid of baseOrder) {
      if (!pid || seen.has(pid) || excluded.has(pid)) continue;
      seen.add(pid);
      if (providerManager.isProviderReadyForRouting(pid, { requireVision })) {
        deduped.push(pid);
      }
    }

    return deduped;
  }

  /**
   * Executes a completion request through the Intelligent AI Router with automatic
   * zero-cost fallback across all healthy configured providers.
   */
  async function executeCompletion({
    prompt,
    systemInstruction = '',
    history = [],
    domain = 'general',
    requireVision = false,
    imageBase64 = null,
    imageMimeType = null,
    preferredProvider = null,
    preferredModel = null,
    temperature = 0.45,
    maxTokens = 2048,
    responseJson = false,
    timeoutMs = null,
    deadlineAtMs = null,
    excludeProviders = [],
  }) {
    // Validate explicit manual override against strict $0 rules
    const requestedModel = preferredModel || (policy.mode === 'manual' ? policy.manualModel : null);
    const requestedProvider = preferredProvider || (policy.mode === 'manual' ? policy.manualProvider : null);

    if (requestedProvider) {
      const targetProv = providerManager.getInternalProvider(requestedProvider);
      if (targetProv && !targetProv.eligibleForZeroCost) {
        const err = new Error(
          `${targetProv.label} is paid-only and strictly blocked under your $0 Verified-Free Policy.`
        );
        err.code = 'PAID_PROVIDER_BLOCKED';
        err.httpStatus = 403;
        usageMonitor?.recordError({
          category: 'paid_blocked',
          providerId: requestedProvider,
          code: 'PAID_PROVIDER_BLOCKED',
          httpStatus: 403,
          message: err.message,
        });
        auditLogger?.record({
          category: 'ZERO_COST_GUARD',
          severity: 'WARNING',
          action: 'Blocked paid provider request',
          detail: err.message,
        });
        throw err;
      }
    }

    if (requestedModel) {
      const allProviders = providerManager.listProviders();
      const matchingProvider = requestedProvider
        ? allProviders.find((p) => p.id === requestedProvider)
        : allProviders.find((p) => p.models.some((m) => m.id === requestedModel));
      const matchingModel = matchingProvider?.models.find((m) => m.id === requestedModel);
      if (!matchingModel || !matchingModel.freeVerified) {
        const err = new Error(
          `Requested model "${requestedModel}" is not in JARVIS's strictly $0 verified-free model catalog and was rejected.`
        );
        err.code = 'PAID_OR_UNKNOWN_MODEL_REJECTED';
        err.httpStatus = 400;
        usageMonitor?.recordError({
          category: 'paid_blocked',
          providerId: requestedProvider || null,
          modelId: requestedModel,
          code: 'PAID_OR_UNKNOWN_MODEL_REJECTED',
          httpStatus: 400,
          message: err.message,
        });
        throw err;
      }
    }

    const candidateProviders = resolveOrderedProviders({
      domain,
      requireVision,
      preferredProvider: requestedProvider,
      excludeProviders,
    }).slice(0, policy.maxProvidersPerRequest);

    if (candidateProviders.length === 0) {
      const err = new Error(
        'No verified-free AI provider is currently configured and available. Configure at least one free key (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY, SAMBANOVA_API_KEY, NVIDIA_API_KEY, CLOUDFLARE, COHERE, HF_TOKEN, or local OLLAMA_BASE_URL) or wait for rate-limit cooldowns to reset.'
      );
      err.code = 'ALL_FREE_PROVIDERS_UNAVAILABLE';
      err.httpStatus = 503;
      err.attemptedProviders = [];
      throw err;
    }

    const openAiMessages = buildOpenAiMessages({
      systemInstruction,
      history,
      prompt,
      imageBase64,
      imageMimeType,
    });

    const attemptedProviders = [];
    const attemptedModels = [];
    let firstFailedProvider = null;
    let firstFailedModel = null;
    let lastErr = null;

    for (const providerId of candidateProviders) {
      if (deadlineAtMs && Date.now() >= deadlineAtMs - 1200) {
        break;
      }

      const remainingTimeout = deadlineAtMs
        ? Math.max(2500, Math.min(timeoutMs || policy.requestTimeoutMs, deadlineAtMs - Date.now() - 800))
        : timeoutMs || policy.requestTimeoutMs;

      attemptedProviders.push(providerId);

      // Route Google Gemini through the battle-tested Gemini free-tier fallback adapter
      if (providerId === 'gemini' && typeof legacyGeminiExecute === 'function') {
        const start = Date.now();
        try {
          const gemRes = await legacyGeminiExecute({
            prompt,
            systemInstruction,
            history,
            imageBase64,
            imageMimeType,
            temperature,
            maxTokens,
            responseJson,
            preferredModel: requestedProvider === 'gemini' ? requestedModel : null,
          });
          const latencyMs = Math.max(1, Date.now() - start);
          const cleanText = sanitizeModelOutput(gemRes.text || '');
          if (!cleanText) {
            throw Object.assign(new Error('Gemini returned empty completion'), {
              code: 'PROVIDER_EMPTY_RESPONSE',
              httpStatus: 502,
              switchable: true,
            });
          }

          providerManager.markProviderSuccess('gemini', gemRes.modelUsed, latencyMs);
          usageMonitor?.recordRequest({
            providerId: 'gemini',
            modelId: gemRes.modelUsed,
            ok: true,
            latencyMs,
            inputTokens: estimateTokens(systemInstruction + prompt),
            outputTokens: estimateTokens(cleanText),
            httpStatus: 200,
          });

          if (firstFailedProvider && firstFailedProvider !== 'gemini') {
            usageMonitor?.recordFallback({
              fromProvider: firstFailedProvider,
              fromModel: firstFailedModel || '',
              toProvider: 'gemini',
              toModel: gemRes.modelUsed,
              reason: lastErr?.code || 'Provider failover',
            });
          }

          return {
            text: cleanText,
            provider: 'gemini',
            providerLabel: 'Google Gemini Free',
            modelUsed: gemRes.modelUsed,
            latencyMs,
            domain,
            routingMode: policy.mode,
            fallbackUsed: Boolean(gemRes.fallbackUsed || firstFailedProvider),
            switchedFromProvider: firstFailedProvider,
            attemptedProviders,
            attemptedModels: [...attemptedModels, gemRes.modelUsed],
          };
        } catch (gemErr) {
          const latencyMs = Math.max(1, Date.now() - start);
          const code = gemErr?.classified?.code || gemErr?.code || 'GEMINI_ERROR';
          const status = gemErr?.classified?.httpStatus || gemErr?.httpStatus || 500;
          usageMonitor?.recordRequest({
            providerId: 'gemini',
            modelId: gemErr?.modelUsed || 'gemini-3.8-flash',
            ok: false,
            latencyMs,
            inputTokens: estimateTokens(prompt),
            httpStatus: status,
            errorCode: code,
            errorMessage: redactSecrets(gemErr?.message || 'Gemini request failed'),
          });
          if (status === 429 || /QUOTA|RATE_LIMIT/i.test(code)) {
            providerManager.markProviderRateLimited(
              'gemini',
              null,
              gemErr?.classified?.retryAfterSeconds || 60,
              code
            );
          }
          if (!firstFailedProvider) {
            firstFailedProvider = 'gemini';
            firstFailedModel = gemErr?.modelUsed || 'gemini-3.8-flash';
          }
          lastErr = gemErr;
          continue;
        }
      }

      // Route Groq, OpenRouter ($0 verified), Mistral, SambaNova, NVIDIA NIM, Cloudflare, Cohere, Hugging Face, Ollama, Custom
      let models = providerManager.getCandidateModelsForProvider(providerId, { domain, requireVision });
      if (requestedModel && models.includes(requestedModel)) {
        models = [requestedModel, ...models.filter((m) => m !== requestedModel)];
      }
      models = models.slice(0, policy.maxModelsPerProvider);

      for (const modelId of models) {
        if (deadlineAtMs && Date.now() >= deadlineAtMs - 1000) break;
        attemptedModels.push(modelId);

        try {
          const res = await providerManager.invokeOpenAiCompatibleProvider({
            providerId,
            modelId,
            messages: openAiMessages,
            temperature,
            maxTokens,
            responseJson,
            timeoutMs: remainingTimeout,
            maxRetries: 1,
          });
          const cleanText = sanitizeModelOutput(res.text);
          if (firstFailedProvider && firstFailedProvider !== providerId) {
            usageMonitor?.recordFallback({
              fromProvider: firstFailedProvider,
              fromModel: firstFailedModel || '',
              toProvider: providerId,
              toModel: modelId,
              reason: lastErr?.code || 'Provider failover',
            });
          }

          return {
            text: cleanText,
            provider: providerId,
            providerLabel: res.providerLabel,
            modelUsed: modelId,
            latencyMs: res.latencyMs,
            domain,
            routingMode: policy.mode,
            fallbackUsed: Boolean(firstFailedProvider),
            switchedFromProvider: firstFailedProvider,
            attemptedProviders,
            attemptedModels,
          };
        } catch (provErr) {
          if (!firstFailedProvider) {
            firstFailedProvider = providerId;
            firstFailedModel = modelId;
          }
          lastErr = provErr;
          // If whole provider failed auth or billing/policy, break straight to next provider
          if (
            provErr?.code === 'PROVIDER_AUTH_ERROR' ||
            provErr?.code === 'PROVIDER_BILLING_BLOCKED' ||
            provErr?.code === 'PAID_PROVIDER_BLOCKED' ||
            provErr?.code === 'UNVERIFIED_PRICING_REJECTED'
          ) {
            break;
          }
        }
      }
    }

    const exhaustedErr = new Error(
      `All available $0 verified-free providers (${attemptedProviders.join(', ')}) failed or hit rate limits. No paid fallback was attempted. Please try again shortly.`
    );
    exhaustedErr.code = 'ALL_FREE_PROVIDERS_EXHAUSTED';
    exhaustedErr.httpStatus = 429;
    exhaustedErr.attemptedProviders = attemptedProviders;
    exhaustedErr.attemptedModels = attemptedModels;
    exhaustedErr.causeError = lastErr;
    throw exhaustedErr;
  }

  return {
    getPolicy() {
      return {
        ...policy,
        fallbackOrder: [...policy.fallbackOrder],
        domainPreferences: { ...policy.domainPreferences },
      };
    },

    updatePolicy(patch = {}) {
      if (patch.mode && ROUTING_MODES.includes(String(patch.mode))) {
        policy.mode = String(patch.mode);
      }
      if (Array.isArray(patch.fallbackOrder) && patch.fallbackOrder.length > 0) {
        const validIds = new Set(providerManager.listProviders().filter((p) => p.eligibleForZeroCost).map((p) => p.id));
        const cleaned = [];
        for (const id of patch.fallbackOrder) {
          const s = String(id).trim().toLowerCase();
          if (validIds.has(s) && !cleaned.includes(s)) cleaned.push(s);
        }
        for (const id of validIds) {
          if (!cleaned.includes(id)) cleaned.push(id);
        }
        if (cleaned.length > 0) policy.fallbackOrder = cleaned;
      }
      if (patch.manualProvider !== undefined) {
        if (!patch.manualProvider) {
          policy.manualProvider = null;
        } else {
          const p = providerManager.getProvider(String(patch.manualProvider));
          if (!p) return { ok: false, error: `Unknown provider "${patch.manualProvider}".` };
          if (!p.eligibleForZeroCost) {
            return {
              ok: false,
              code: 'PAID_PROVIDER_BLOCKED',
              error: `${p.label} is paid-only and blocked under Strict $0 Policy.`,
            };
          }
          policy.manualProvider = p.id;
        }
      }
      if (patch.manualModel !== undefined) {
        if (!patch.manualModel) {
          policy.manualModel = null;
        } else {
          const mId = String(patch.manualModel).trim();
          const owner = providerManager.listProviders().find((p) => p.models.some((m) => m.id === mId && m.freeVerified));
          if (!owner) {
            return {
              ok: false,
              code: 'PAID_OR_UNKNOWN_MODEL_REJECTED',
              error: `Model "${mId}" is not an approved $0 verified-free model.`,
            };
          }
          policy.manualModel = mId;
          if (!policy.manualProvider) policy.manualProvider = owner.id;
        }
      }
      if (Number.isFinite(Number(patch.requestTimeoutMs))) {
        policy.requestTimeoutMs = Math.max(5000, Math.min(55000, Math.round(Number(patch.requestTimeoutMs))));
      }
      if (Number.isFinite(Number(patch.maxProvidersPerRequest))) {
        policy.maxProvidersPerRequest = Math.max(1, Math.min(11, Math.round(Number(patch.maxProvidersPerRequest))));
      }
      return { ok: true, policy: this.getPolicy() };
    },

    classifyTaskDomain,
    resolveOrderedProviders,
    executeCompletion,
  };
}
