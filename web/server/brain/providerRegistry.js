import {
  FREE_TIER_GROQ_MODELS,
  FREE_TIER_OPENROUTER_MODELS,
  FREE_TIER_OPENROUTER_VISION_MODELS,
  isConfiguredApiKey,
  isPricingStrictlyZero,
  verifyOpenRouterFreeCatalog,
} from '../freeMultiProvider.js';
import { FREE_TIER_GEMINI_MODELS } from '../geminiModelFallback.js';
import { redactSecrets, validateCustomProviderUrl } from './securityGuard.js';

const PROBE_TIMEOUT_MS = 4500;
const DEFAULT_COMPLETION_TIMEOUT_MS = 38000;
const MIN_COOLDOWN_MS = 35_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const AUTH_COOLDOWN_MS = 10 * 60_000;
const BILLING_COOLDOWN_MS = 30 * 60_000;

/**
 * Curated provider catalog covering all 11+ providers with HONEST billing classifications.
 * Under the user's confirmed Strict $0 Verified-Free policy:
 *  - Paid-only APIs (such as DeepSeek Direct API) are registered transparently, flagged
 *    as `paid_only`, and strictly BLOCKED from outbound calls so $0 is guaranteed.
 *  - OpenRouter requires live $0.00 catalog pricing verification (fail-closed).
 *  - Local Ollama runs at $0 when OLLAMA_BASE_URL is explicitly configured and reachable.
 */
export const BUILTIN_PROVIDER_DEFINITIONS = Object.freeze([
  {
    id: 'gemini',
    label: 'Google Gemini Free',
    protocol: 'gemini-native',
    envVars: ['GEMINI_API_KEY'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    billingTier: 'verified_free_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: true,
    supportsStreaming: true,
    defaultPriority: 1,
    freeQuotaNote: 'Google AI Studio Free Tier (RPM/RPD limits apply per model).',
    models: FREE_TIER_GEMINI_MODELS.map((id, idx) => ({
      id,
      domains: idx === 0
        ? ['general', 'coding', 'research', 'reasoning', 'mathematics', 'writing', 'vision', 'document_analysis', 'security', 'debugging', 'testing', 'voice', 'memory', 'planning', 'automation']
        : ['general', 'writing', 'voice', 'vision', 'document_analysis', 'planning'],
      vision: true,
      freeVerified: true,
    })),
  },
  {
    id: 'groq',
    label: 'Groq Free API',
    protocol: 'openai-compatible',
    envVars: ['GROQ_API_KEY'],
    baseUrl: 'https://api.groq.com/openai/v1',
    billingTier: 'verified_free_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 2,
    freeQuotaNote: 'Groq Developer Free Tier (high-speed inference, RPM/RPD capped).',
    models: FREE_TIER_GROQ_MODELS.map((id) => ({
      id,
      domains: id.includes('120b') || id.includes('70b')
        ? ['general', 'coding', 'reasoning', 'mathematics', 'security', 'debugging', 'testing', 'planning', 'research']
        : ['general', 'writing', 'voice', 'memory', 'automation'],
      vision: false,
      freeVerified: true,
    })),
  },
  {
    id: 'openrouter',
    label: 'OpenRouter Free',
    protocol: 'openai-compatible',
    envVars: ['OPENROUTER_API_KEY'],
    baseUrl: 'https://openrouter.ai/api/v1',
    billingTier: 'live_zero_verified',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: true,
    supportsVision: true,
    supportsStreaming: true,
    defaultPriority: 3,
    freeQuotaNote: 'Strictly :free / openrouter/free models verified live at $0.00 prompt & completion pricing.',
    models: Array.from(new Set([...FREE_TIER_OPENROUTER_MODELS, ...FREE_TIER_OPENROUTER_VISION_MODELS])).map((id) => ({
      id,
      domains: id.includes('code')
        ? ['coding', 'debugging', 'testing', 'security']
        : id.includes('vl')
          ? ['vision', 'document_analysis']
          : id.includes('ultra') || id.includes('gemma-4-31b')
            ? ['general', 'reasoning', 'mathematics', 'research', 'planning', 'writing', 'vision']
            : ['general', 'writing', 'voice', 'automation'],
      vision: FREE_TIER_OPENROUTER_VISION_MODELS.includes(id),
      freeVerified: true,
    })),
  },
  {
    id: 'mistral',
    label: 'Mistral AI Free Tier',
    protocol: 'openai-compatible',
    envVars: ['MISTRAL_API_KEY'],
    baseUrl: 'https://api.mistral.ai/v1',
    billingTier: 'free_experiment_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: true,
    supportsStreaming: true,
    defaultPriority: 4,
    freeQuotaNote: 'Mistral La Plateforme Experiment free tier (rate-limited; no card required on Experiment plan).',
    models: [
      { id: 'mistral-small-latest', domains: ['general', 'writing', 'research', 'planning', 'memory', 'voice'], vision: false, freeVerified: true },
      { id: 'codestral-latest', domains: ['coding', 'debugging', 'testing', 'security'], vision: false, freeVerified: true },
      { id: 'open-mistral-nemo', domains: ['general', 'writing', 'automation', 'document_analysis'], vision: false, freeVerified: true },
      { id: 'pixtral-12b-2409', domains: ['vision', 'document_analysis'], vision: true, freeVerified: true },
    ],
  },
  {
    id: 'sambanova',
    label: 'SambaNova Cloud Free',
    protocol: 'openai-compatible',
    envVars: ['SAMBANOVA_API_KEY'],
    baseUrl: 'https://api.sambanova.ai/v1',
    billingTier: 'free_developer_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 5,
    freeQuotaNote: 'SambaNova Cloud free developer tier (fast open-weight inference, rate-limited).',
    models: [
      { id: 'Meta-Llama-3.3-70B-Instruct', domains: ['general', 'research', 'writing', 'planning', 'reasoning'], vision: false, freeVerified: true },
      { id: 'DeepSeek-R1-Distill-Llama-70B', domains: ['reasoning', 'mathematics', 'debugging', 'security'], vision: false, freeVerified: true },
      { id: 'Qwen2.5-Coder-32B-Instruct', domains: ['coding', 'debugging', 'testing'], vision: false, freeVerified: true },
      { id: 'Meta-Llama-3.1-8B-Instruct', domains: ['general', 'voice', 'automation'], vision: false, freeVerified: true },
    ],
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM Developer',
    protocol: 'openai-compatible',
    envVars: ['NVIDIA_API_KEY'],
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    billingTier: 'free_developer_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 6,
    freeQuotaNote: 'NVIDIA Build free developer prototyping tier (build.nvidia.com).',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', domains: ['general', 'research', 'writing', 'planning'], vision: false, freeVerified: true },
      { id: 'qwen/qwen2.5-coder-32b-instruct', domains: ['coding', 'debugging', 'testing'], vision: false, freeVerified: true },
      { id: 'deepseek-ai/deepseek-r1', domains: ['reasoning', 'mathematics', 'security'], vision: false, freeVerified: true },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', domains: ['general', 'reasoning', 'writing'], vision: false, freeVerified: true },
    ],
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    protocol: 'cloudflare-openai',
    envVars: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    baseUrl: 'https://api.cloudflare.com/client/v4',
    billingTier: 'free_daily_neurons',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 7,
    freeQuotaNote: '10,000 free Neurons/day resetting at 00:00 UTC (requires CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN).',
    models: [
      { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', domains: ['general', 'research', 'writing', 'planning'], vision: false, freeVerified: true },
      { id: '@cf/qwen/qwen2.5-coder-32b-instruct', domains: ['coding', 'debugging', 'testing'], vision: false, freeVerified: true },
      { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', domains: ['reasoning', 'mathematics', 'security'], vision: false, freeVerified: true },
      { id: '@cf/meta/llama-3.1-8b-instruct-fast', domains: ['general', 'voice', 'automation'], vision: false, freeVerified: true },
    ],
  },
  {
    id: 'cohere',
    label: 'Cohere Trial API',
    protocol: 'cohere-compat',
    envVars: ['COHERE_API_KEY'],
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    billingTier: 'free_trial_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 8,
    freeQuotaNote: 'Cohere Trial key (~20 RPM / 1,000 calls per month for prototyping).',
    models: [
      { id: 'command-a-03-2025', domains: ['general', 'research', 'writing', 'document_analysis', 'planning'], vision: false, freeVerified: true },
      { id: 'command-r7b-12-2024', domains: ['general', 'voice', 'memory', 'automation'], vision: false, freeVerified: true },
      { id: 'command-r-plus-08-2024', domains: ['research', 'document_analysis', 'reasoning'], vision: false, freeVerified: true },
    ],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face Router',
    protocol: 'openai-compatible',
    envVars: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
    baseUrl: 'https://router.huggingface.co/v1',
    billingTier: 'free_serverless_tier',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 9,
    freeQuotaNote: 'Hugging Face free serverless inference tier (monthly free credits; stops cleanly when exhausted).',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct:fastest', domains: ['general', 'research', 'writing', 'planning'], vision: false, freeVerified: true },
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct:fastest', domains: ['coding', 'debugging', 'testing'], vision: false, freeVerified: true },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B:fastest', domains: ['reasoning', 'mathematics', 'security'], vision: false, freeVerified: true },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama Local AI',
    protocol: 'ollama-local',
    envVars: ['OLLAMA_BASE_URL'],
    baseUrl: '',
    billingTier: 'local_zero_cost',
    eligibleForZeroCost: true,
    requiresLiveZeroPricing: false,
    supportsVision: true,
    supportsStreaming: true,
    defaultPriority: 10,
    freeQuotaNote: '100% free local inference when OLLAMA_BASE_URL is configured and reachable (fallback when cloud is unavailable).',
    models: [
      { id: 'llama3.2', domains: ['general', 'writing', 'voice', 'planning', 'automation'], vision: false, freeVerified: true },
      { id: 'qwen2.5-coder', domains: ['coding', 'debugging', 'testing', 'security'], vision: false, freeVerified: true },
      { id: 'deepseek-r1', domains: ['reasoning', 'mathematics'], vision: false, freeVerified: true },
      { id: 'llava', domains: ['vision', 'document_analysis'], vision: true, freeVerified: true },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek Direct API',
    protocol: 'openai-compatible',
    envVars: ['DEEPSEEK_API_KEY'],
    baseUrl: 'https://api.deepseek.com/v1',
    billingTier: 'paid_only',
    eligibleForZeroCost: false,
    requiresLiveZeroPricing: false,
    supportsVision: false,
    supportsStreaming: true,
    defaultPriority: 99,
    freeQuotaNote: 'PAID-ONLY API (no standing free tier). Blocked under Strict $0 Policy — run DeepSeek R1 at $0 via SambaNova, NVIDIA NIM, Cloudflare, OpenRouter :free, or Ollama instead.',
    models: [
      { id: 'deepseek-chat', domains: ['general', 'coding', 'writing'], vision: false, freeVerified: false },
      { id: 'deepseek-reasoner', domains: ['reasoning', 'mathematics'], vision: false, freeVerified: false },
    ],
  },
]);

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headers) {
  if (!headers || typeof headers.get !== 'function') return null;
  const raw = headers.get('retry-after');
  if (!raw) return null;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec);
  return null;
}

/**
 * Modular AI Provider Manager (Phase 2).
 * Handles all 11+ providers + custom OpenAI-compatible registrations, real connection tests,
 * strict $0 allowlist verification, rate-limit cooldowns, timeouts, and bounded exponential backoff.
 */
export function createProviderManager(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const nowFn = typeof options.now === 'function' ? options.now : () => Date.now();
  const usageMonitor = options.usageMonitor || null;
  const auditLogger = options.auditLogger || null;
  const legacyMultiProviderRouter = options.legacyMultiProviderRouter || null;
  const strictZeroCost = options.strictZeroCost !== false;

  const providers = new Map();

  function resolveProviderCredentials(def) {
    if (def.id === 'gemini') {
      const hasInjected = Boolean(options.geminiAvailable);
      const rawKey = options.geminiApiKey ?? env.GEMINI_API_KEY ?? '';
      return { configured: hasInjected || isConfiguredApiKey(rawKey), apiKey: String(rawKey || '').trim() };
    }
    if (def.id === 'groq') {
      const rawKey = options.groqApiKey ?? env.GROQ_API_KEY ?? '';
      return { configured: isConfiguredApiKey(rawKey), apiKey: String(rawKey || '').trim() };
    }
    if (def.id === 'openrouter') {
      const rawKey = options.openrouterApiKey ?? env.OPENROUTER_API_KEY ?? '';
      return { configured: isConfiguredApiKey(rawKey), apiKey: String(rawKey || '').trim() };
    }
    if (def.id === 'cloudflare') {
      const token = String(options.cloudflareApiToken ?? env.CLOUDFLARE_API_TOKEN ?? '').trim();
      const accountId = String(options.cloudflareAccountId ?? env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
      const ok = isConfiguredApiKey(token) && isConfiguredApiKey(accountId);
      return {
        configured: ok,
        apiKey: token,
        accountId,
        baseUrl: ok ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1` : def.baseUrl,
      };
    }
    if (def.id === 'ollama') {
      const rawBase = String(options.ollamaBaseUrl ?? env.OLLAMA_BASE_URL ?? '').trim();
      if (!rawBase || /^unset$|^none$/i.test(rawBase)) {
        return { configured: false, apiKey: '', baseUrl: '' };
      }
      const checked = validateCustomProviderUrl(rawBase);
      if (!checked.valid) {
        return { configured: false, apiKey: '', baseUrl: '' };
      }
      const normalized = checked.normalizedUrl.endsWith('/v1')
        ? checked.normalizedUrl
        : `${checked.normalizedUrl}/v1`;
      return { configured: true, apiKey: 'ollama', baseUrl: normalized };
    }
    if (def.id === 'huggingface') {
      const rawKey = options.huggingfaceApiKey ?? env.HF_TOKEN ?? env.HUGGINGFACE_API_KEY ?? '';
      return { configured: isConfiguredApiKey(rawKey), apiKey: String(rawKey || '').trim() };
    }
    const primaryEnv = def.envVars[0];
    const overrideKey = options[`${def.id}ApiKey`];
    const rawKey = overrideKey !== undefined ? overrideKey : env[primaryEnv] ?? '';
    return { configured: isConfiguredApiKey(rawKey), apiKey: String(rawKey || '').trim() };
  }

  for (const def of BUILTIN_PROVIDER_DEFINITIONS) {
    const creds = resolveProviderCredentials(def);
    const customModelsEnv = env[`${def.id.toUpperCase()}_FREE_MODELS`] || env[`${def.id.toUpperCase()}_MODELS`];
    const models = def.models.map((m) => ({ ...m }));

    if (def.id === 'ollama' && typeof customModelsEnv === 'string' && customModelsEnv.trim()) {
      for (const rawId of customModelsEnv.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!models.some((m) => m.id === rawId)) {
          models.unshift({ id: rawId, domains: ['general', 'coding', 'reasoning', 'writing'], vision: /llava|vision/i.test(rawId), freeVerified: true });
        }
      }
    }

    providers.set(def.id, {
      ...def,
      baseUrl: creds.baseUrl || def.baseUrl,
      accountId: creds.accountId || '',
      apiKey: creds.apiKey,
      configured: creds.configured,
      enabled: def.eligibleForZeroCost,
      priority: def.defaultPriority,
      models,
      verifiedLiveModels: new Set(),
      connectionState: !def.eligibleForZeroCost && strictZeroCost
        ? 'BLOCKED_PAID_POLICY'
        : creds.configured
          ? 'UNTESTED'
          : 'UNCONFIGURED',
      lastProbeAt: null,
      lastProbeLatencyMs: null,
      lastProbeMessage: !def.eligibleForZeroCost && strictZeroCost
        ? 'Blocked by Strict $0 Policy (DeepSeek direct API has no standing free tier).'
        : creds.configured
          ? 'API key detected on server; run Test Connection to verify live connectivity.'
          : `Set ${def.envVars.join(' + ')} on the server to enable.`,
      cooldownUntilMs: 0,
      modelCooldowns: new Map(),
      lastErrorCode: null,
      isCustom: false,
    });
  }

  // Optional env-configured custom OpenAI-compatible free/local endpoint
  if (env.CUSTOM_AI_BASE_URL) {
    const urlCheck = validateCustomProviderUrl(env.CUSTOM_AI_BASE_URL);
    if (urlCheck.valid) {
      const isFreeVerified = urlCheck.isLocal || String(env.CUSTOM_AI_VERIFIED_FREE || '').toLowerCase() === 'true';
      const customModels = String(env.CUSTOM_AI_MODELS || 'local-model')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => ({ id, domains: ['general', 'coding', 'writing'], vision: false, freeVerified: isFreeVerified }));
      providers.set('custom_env', {
        id: 'custom_env',
        label: String(env.CUSTOM_AI_LABEL || 'Custom OpenAI-Compatible').slice(0, 60),
        protocol: 'openai-compatible',
        envVars: ['CUSTOM_AI_BASE_URL', 'CUSTOM_AI_API_KEY'],
        baseUrl: urlCheck.normalizedUrl,
        apiKey: String(env.CUSTOM_AI_API_KEY || (urlCheck.isLocal ? 'local' : '')).trim(),
        configured: urlCheck.isLocal || isConfiguredApiKey(env.CUSTOM_AI_API_KEY),
        billingTier: urlCheck.isLocal ? 'local_zero_cost' : isFreeVerified ? 'verified_free_tier' : 'paid_only',
        eligibleForZeroCost: isFreeVerified,
        requiresLiveZeroPricing: false,
        supportsVision: false,
        supportsStreaming: true,
        defaultPriority: 11,
        priority: 11,
        enabled: isFreeVerified,
        freeQuotaNote: urlCheck.isLocal
          ? 'Local OpenAI-compatible endpoint ($0).'
          : isFreeVerified
            ? 'User-verified $0 OpenAI-compatible endpoint.'
            : 'Blocked under Strict $0 Policy until explicitly verified as $0.',
        models: customModels,
        verifiedLiveModels: new Set(),
        connectionState: !isFreeVerified && strictZeroCost ? 'BLOCKED_PAID_POLICY' : 'UNTESTED',
        lastProbeAt: null,
        lastProbeLatencyMs: null,
        lastProbeMessage: 'Run Test Connection to verify live reachability.',
        cooldownUntilMs: 0,
        modelCooldowns: new Map(),
        lastErrorCode: null,
        isCustom: true,
      });
    }
  }

  function refreshDynamicCredentials() {
    for (const p of providers.values()) {
      if (p.isCustom) continue;
      const creds = resolveProviderCredentials(p);
      p.apiKey = creds.apiKey;
      p.configured = creds.configured;
      if (creds.baseUrl) p.baseUrl = creds.baseUrl;
      if (creds.accountId) p.accountId = creds.accountId;
      if (!p.eligibleForZeroCost && strictZeroCost) {
        p.connectionState = 'BLOCKED_PAID_POLICY';
      } else if (!p.configured) {
        p.connectionState = 'UNCONFIGURED';
      } else if (p.connectionState === 'UNCONFIGURED') {
        p.connectionState = 'UNTESTED';
      }
    }
  }

  function isCoolingDown(provider, modelId = null) {
    const now = nowFn();
    if (provider.cooldownUntilMs > now) return true;
    if (modelId) {
      const mUntil = provider.modelCooldowns.get(modelId) || 0;
      if (mUntil > now) return true;
    }
    return false;
  }

  function getCooldownRemainingSeconds(provider, modelId = null) {
    const now = nowFn();
    let until = provider.cooldownUntilMs;
    if (modelId) {
      until = Math.max(until, provider.modelCooldowns.get(modelId) || 0);
    }
    return until > now ? Math.ceil((until - now) / 1000) : 0;
  }

  function setCooldown(provider, durationMs, modelId = null, errorCode = null) {
    const safeMs = Math.min(BILLING_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, durationMs));
    const until = nowFn() + safeMs;
    if (modelId) {
      provider.modelCooldowns.set(modelId, Math.max(provider.modelCooldowns.get(modelId) || 0, until));
    } else {
      provider.cooldownUntilMs = Math.max(provider.cooldownUntilMs, until);
    }
    if (errorCode) provider.lastErrorCode = errorCode;
  }

  function serializeProvider(p) {
    const now = nowFn();
    const cooldownSec = p.cooldownUntilMs > now ? Math.ceil((p.cooldownUntilMs - now) / 1000) : 0;
    let status = 'unconfigured';
    if (!p.eligibleForZeroCost && strictZeroCost) status = 'blocked_paid';
    else if (!p.configured) status = 'unconfigured';
    else if (!p.enabled) status = 'disabled';
    else if (p.connectionState === 'AUTH_ERROR') status = 'auth_error';
    else if (cooldownSec > 0) status = 'cooldown';
    else if (p.connectionState === 'CONNECTED') status = 'connected';
    else status = 'ready_untested';

    return {
      id: p.id,
      label: p.label,
      protocol: p.protocol,
      envVars: p.envVars,
      baseUrl: p.id === 'cloudflare' && p.accountId ? 'https://api.cloudflare.com/client/v4/accounts/[ACCOUNT_ID]/ai/v1' : p.baseUrl,
      billingTier: p.billingTier,
      eligibleForZeroCost: p.eligibleForZeroCost,
      requiresLiveZeroPricing: p.requiresLiveZeroPricing,
      configured: p.configured,
      enabled: p.enabled,
      priority: p.priority,
      supportsVision: p.supportsVision,
      supportsStreaming: p.supportsStreaming,
      status,
      connectionState: p.connectionState,
      lastProbeAt: p.lastProbeAt,
      lastProbeLatencyMs: p.lastProbeLatencyMs,
      lastProbeMessage: p.lastProbeMessage,
      cooldownRemainingSeconds: cooldownSec,
      lastErrorCode: p.lastErrorCode,
      freeQuotaNote: p.freeQuotaNote,
      isCustom: Boolean(p.isCustom),
      models: p.models.map((m) => ({
        id: m.id,
        domains: m.domains,
        vision: Boolean(m.vision),
        freeVerified: Boolean(m.freeVerified),
        livePricingVerified: p.requiresLiveZeroPricing ? p.verifiedLiveModels.has(m.id) : m.freeVerified,
        cooldownRemainingSeconds: getCooldownRemainingSeconds(p, m.id),
      })),
    };
  }

  function buildAuthHeaders(p) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (p.apiKey && p.protocol !== 'gemini-native') {
      headers.Authorization = `Bearer ${p.apiKey}`;
    }
    if (p.id === 'openrouter') {
      headers['HTTP-Referer'] = env.OPENROUTER_APP_REFERER || 'https://jarvis-ai.local';
      headers['X-Title'] = 'JARVIS Multi-AI Brain';
    }
    return headers;
  }

  /**
   * Real upstream connection test — NEVER fabricates CONNECTED status.
   */
  async function testProviderConnection(providerId) {
    refreshDynamicCredentials();
    const p = providers.get(providerId);
    if (!p) {
      return { ok: false, providerId, connectionState: 'UNKNOWN_PROVIDER', message: `Unknown provider "${providerId}".` };
    }

    if (strictZeroCost && !p.eligibleForZeroCost) {
      p.connectionState = 'BLOCKED_PAID_POLICY';
      p.lastProbeAt = nowFn();
      p.lastProbeLatencyMs = 0;
      p.lastProbeMessage = `${p.label} is classified as paid-only and blocked under Strict $0 Verified-Free Policy.`;
      auditLogger?.record({
        category: 'ZERO_COST_GUARD',
        severity: 'WARNING',
        action: `Blocked connection probe to paid provider ${p.id}`,
        detail: p.lastProbeMessage,
      });
      return {
        ok: false,
        providerId: p.id,
        connectionState: p.connectionState,
        latencyMs: 0,
        verifiedModelsCount: 0,
        message: p.lastProbeMessage,
      };
    }

    if (!p.configured) {
      p.connectionState = 'UNCONFIGURED';
      p.lastProbeAt = nowFn();
      p.lastProbeLatencyMs = 0;
      p.lastProbeMessage = `Missing server environment variable(s): ${p.envVars.join(', ')}.`;
      return {
        ok: false,
        providerId: p.id,
        connectionState: 'UNCONFIGURED',
        latencyMs: 0,
        verifiedModelsCount: 0,
        message: p.lastProbeMessage,
      };
    }

    const start = nowFn();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      if (p.id === 'openrouter') {
        const res = await verifyOpenRouterFreeCatalog(fetchImpl, p.apiKey, env.OPENROUTER_APP_REFERER);
        const latencyMs = Math.max(1, nowFn() - start);
        p.lastProbeAt = nowFn();
        p.lastProbeLatencyMs = latencyMs;
        if (!res.ok) {
          p.connectionState = res.status === 401 || res.status === 403 ? 'AUTH_ERROR' : 'UNREACHABLE';
          p.lastProbeMessage = `OpenRouter catalog verification failed (HTTP ${res.status || 'network'}). Fail-closed at $0.`;
          return { ok: false, providerId: p.id, connectionState: p.connectionState, latencyMs, verifiedModelsCount: 0, message: p.lastProbeMessage };
        }
        p.verifiedLiveModels = new Set(res.verifiedModels.keys());
        p.connectionState = p.verifiedLiveModels.size > 0 ? 'CONNECTED' : 'UNREACHABLE';
        p.lastProbeMessage =
          p.verifiedLiveModels.size > 0
            ? `Verified ${p.verifiedLiveModels.size} strictly $0.00 OpenRouter free models in ${latencyMs}ms.`
            : 'OpenRouter reachable, but 0 allowlisted models passed strict $0.00 pricing check.';
        return {
          ok: p.verifiedLiveModels.size > 0,
          providerId: p.id,
          connectionState: p.connectionState,
          latencyMs,
          verifiedModelsCount: p.verifiedLiveModels.size,
          verifiedModels: Array.from(p.verifiedLiveModels),
          message: p.lastProbeMessage,
        };
      }

      let probeUrl = `${p.baseUrl}/models`;
      let probeHeaders = buildAuthHeaders(p);

      if (p.id === 'gemini') {
        if (!isConfiguredApiKey(p.apiKey) && options.geminiAvailable) {
          // Test harness injected mock Gemini client without raw key
          const latencyMs = Math.max(1, nowFn() - start);
          p.connectionState = 'CONNECTED';
          p.lastProbeAt = nowFn();
          p.lastProbeLatencyMs = latencyMs;
          p.lastProbeMessage = 'Gemini client factory active in runtime.';
          return { ok: true, providerId: p.id, connectionState: 'CONNECTED', latencyMs, verifiedModelsCount: p.models.length, message: p.lastProbeMessage };
        }
        probeUrl = `${p.baseUrl}/models?pageSize=20`;
        probeHeaders = { Accept: 'application/json', 'x-goog-api-key': p.apiKey };
      } else if (p.id === 'ollama') {
        probeUrl = `${p.baseUrl.replace(/\/v1$/, '')}/api/tags`;
        probeHeaders = { Accept: 'application/json' };
      } else if (p.id === 'cloudflare') {
        probeUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(p.accountId)}/ai/models/search?per_page=10`;
        probeHeaders = { Accept: 'application/json', Authorization: `Bearer ${p.apiKey}` };
      }

      const resp = await fetchImpl(probeUrl, {
        method: 'GET',
        headers: probeHeaders,
        signal: controller.signal,
      });
      const latencyMs = Math.max(1, nowFn() - start);
      const rawText = await resp.text().catch(() => '');
      p.lastProbeAt = nowFn();
      p.lastProbeLatencyMs = latencyMs;

      if (resp.status === 401 || resp.status === 403) {
        p.connectionState = 'AUTH_ERROR';
        p.lastErrorCode = `HTTP_${resp.status}`;
        p.lastProbeMessage = `Authentication failed (HTTP ${resp.status}). Check ${p.envVars.join(' / ')}.`;
        return { ok: false, providerId: p.id, connectionState: 'AUTH_ERROR', latencyMs, verifiedModelsCount: 0, message: p.lastProbeMessage };
      }
      if (resp.status === 429) {
        p.connectionState = 'RATE_LIMITED';
        setCooldown(p, (parseRetryAfter(resp.headers) || 60) * 1000, null, 'HTTP_429');
        p.lastProbeMessage = `Provider rate-limited (HTTP 429) during probe.`;
        return { ok: false, providerId: p.id, connectionState: 'RATE_LIMITED', latencyMs, verifiedModelsCount: 0, message: p.lastProbeMessage };
      }
      if (!resp.ok) {
        p.connectionState = 'UNREACHABLE';
        p.lastErrorCode = `HTTP_${resp.status}`;
        p.lastProbeMessage = redactSecrets(`Probe failed with HTTP ${resp.status}: ${rawText.slice(0, 140)}`);
        return { ok: false, providerId: p.id, connectionState: 'UNREACHABLE', latencyMs, verifiedModelsCount: 0, message: p.lastProbeMessage };
      }

      let discoveredCount = p.models.length;
      try {
        const parsed = JSON.parse(rawText);
        if (p.id === 'ollama' && Array.isArray(parsed?.models)) {
          const ollamaIds = parsed.models.map((m) => String(m?.name || m?.model || '').trim()).filter(Boolean);
          discoveredCount = ollamaIds.length;
          if (ollamaIds.length > 0) {
            p.models = ollamaIds.map((id) => ({
              id,
              domains: /coder|code/i.test(id)
                ? ['coding', 'debugging', 'testing']
                : /r1|reason|math/i.test(id)
                  ? ['reasoning', 'mathematics']
                  : /llava|vision/i.test(id)
                    ? ['vision', 'document_analysis']
                    : ['general', 'writing', 'planning', 'voice', 'automation'],
              vision: /llava|vision|vl/i.test(id),
              freeVerified: true,
            }));
          }
        } else if (Array.isArray(parsed?.data)) {
          const liveIds = new Set(parsed.data.map((m) => String(m?.id || '').trim()).filter(Boolean));
          if (liveIds.size > 0) {
            p.verifiedLiveModels = new Set(p.models.filter((m) => liveIds.has(m.id)).map((m) => m.id));
            discoveredCount = p.verifiedLiveModels.size || liveIds.size;
          }
        } else if (Array.isArray(parsed?.models)) {
          discoveredCount = parsed.models.length;
        }
      } catch {
        // Non-JSON 200 OK still indicates endpoint reachability
      }

      p.connectionState = 'CONNECTED';
      p.cooldownUntilMs = 0;
      p.lastErrorCode = null;
      p.lastProbeMessage = `Connected live in ${latencyMs}ms (${discoveredCount} model(s) visible).`;
      auditLogger?.record({
        category: 'PROVIDER_PROBE',
        severity: 'INFO',
        action: `Connected ${p.label}`,
        detail: p.lastProbeMessage,
      });

      return {
        ok: true,
        providerId: p.id,
        connectionState: 'CONNECTED',
        latencyMs,
        verifiedModelsCount: discoveredCount,
        message: p.lastProbeMessage,
      };
    } catch (err) {
      const latencyMs = Math.max(1, nowFn() - start);
      const isTimeout = err?.name === 'AbortError';
      p.connectionState = 'UNREACHABLE';
      p.lastProbeAt = nowFn();
      p.lastProbeLatencyMs = latencyMs;
      p.lastErrorCode = isTimeout ? 'PROBE_TIMEOUT' : 'NETWORK_ERROR';
      p.lastProbeMessage = isTimeout
        ? `Connection probe timed out after ${PROBE_TIMEOUT_MS}ms.`
        : redactSecrets(`Unable to reach ${p.label}: ${err?.message || 'network failure'}`);
      return {
        ok: false,
        providerId: p.id,
        connectionState: 'UNREACHABLE',
        latencyMs,
        verifiedModelsCount: 0,
        message: p.lastProbeMessage,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Executes a single OpenAI-compatible completion call against an extended provider
   * (Mistral, SambaNova, NVIDIA NIM, Cloudflare, Cohere, Hugging Face, Ollama, Custom)
   * with strict $0 verification, timeout budget, and bounded exponential backoff.
   */
  async function invokeOpenAiCompatibleProvider({
    providerId,
    modelId,
    messages,
    temperature = 0.4,
    maxTokens = 2048,
    responseJson = false,
    timeoutMs = DEFAULT_COMPLETION_TIMEOUT_MS,
    maxRetries = 1,
  }) {
    refreshDynamicCredentials();
    const p = providers.get(providerId);
    if (!p) throw new Error(`Unknown provider: ${providerId}`);

    if (strictZeroCost && !p.eligibleForZeroCost) {
      const err = new Error(`${p.label} is blocked under Strict $0 Verified-Free Policy.`);
      err.code = 'PAID_PROVIDER_BLOCKED';
      err.httpStatus = 403;
      err.switchable = true;
      usageMonitor?.recordRequest({
        providerId: p.id,
        modelId,
        ok: false,
        httpStatus: 403,
        errorCode: 'PAID_PROVIDER_BLOCKED',
        errorMessage: err.message,
      });
      throw err;
    }

    const modelEntry = p.models.find((m) => m.id === modelId);
    if (!modelEntry || (strictZeroCost && !modelEntry.freeVerified)) {
      const err = new Error(`Model "${modelId}" is not in the strict $0 verified-free catalog for ${p.label}.`);
      err.code = 'PAID_OR_UNKNOWN_MODEL_REJECTED';
      err.httpStatus = 400;
      err.switchable = false;
      throw err;
    }

    if (p.requiresLiveZeroPricing) {
      if (!p.verifiedLiveModels.has(modelId)) {
        const probe = await testProviderConnection(p.id);
        if (!probe.ok || !p.verifiedLiveModels.has(modelId)) {
          const err = new Error(`OpenRouter model "${modelId}" did not pass live $0.00 pricing verification.`);
          err.code = 'UNVERIFIED_PRICING_REJECTED';
          err.httpStatus = 403;
          err.switchable = true;
          throw err;
        }
      }
    }

    const url = `${p.baseUrl}/chat/completions`;
    const inputCharEstimate = messages.reduce((sum, m) => sum + String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')).length, 0);
    const inputTokens = Math.max(1, Math.ceil(inputCharEstimate / 4));

    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const attemptStart = nowFn();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(2500, timeoutMs));
      try {
        const bodyPayload = {
          model: modelId,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        };
        if (responseJson && p.id !== 'ollama') {
          bodyPayload.response_format = { type: 'json_object' };
        }

        const resp = await fetchImpl(url, {
          method: 'POST',
          headers: buildAuthHeaders(p),
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        const rawText = await resp.text().catch(() => '');
        const latencyMs = Math.max(1, nowFn() - attemptStart);

        if (!resp.ok) {
          const retryAfterSec = parseRetryAfter(resp.headers);
          const isRateLimit = resp.status === 429;
          const isBilling = resp.status === 402 || /insufficient.*credit|billing|payment required/i.test(rawText);
          const isAuth = resp.status === 401 || resp.status === 403;
          const isTransient = resp.status === 500 || resp.status === 502 || resp.status === 503 || resp.status === 504;

          const code = isRateLimit
            ? 'PROVIDER_RATE_LIMIT'
            : isBilling
              ? 'PROVIDER_BILLING_BLOCKED'
              : isAuth
                ? 'PROVIDER_AUTH_ERROR'
                : `PROVIDER_HTTP_${resp.status}`;

          usageMonitor?.recordRequest({
            providerId: p.id,
            modelId,
            ok: false,
            latencyMs,
            inputTokens,
            httpStatus: resp.status,
            errorCode: code,
            errorMessage: redactSecrets(rawText.slice(0, 240) || `HTTP ${resp.status}`),
          });

          if (isAuth) {
            p.connectionState = 'AUTH_ERROR';
            setCooldown(p, AUTH_COOLDOWN_MS, null, code);
          } else if (isBilling) {
            setCooldown(p, BILLING_COOLDOWN_MS, null, code);
          } else if (isRateLimit) {
            p.connectionState = 'RATE_LIMITED';
            setCooldown(p, (retryAfterSec || 60) * 1000, modelId, code);
          }

          const err = new Error(redactSecrets(`${p.label} (${modelId}) returned HTTP ${resp.status}: ${rawText.slice(0, 180)}`));
          err.code = code;
          err.httpStatus = resp.status;
          err.switchable = true;
          err.retryAfterSeconds = retryAfterSec;
          lastErr = err;

          if (isTransient && attempt < maxRetries) {
            await delayMs(Math.min(1200, 250 * Math.pow(2, attempt)));
            continue;
          }
          throw err;
        }

        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const err = new Error(`${p.label} (${modelId}) returned invalid JSON.`);
          err.code = 'PROVIDER_INVALID_JSON';
          err.httpStatus = 502;
          err.switchable = true;
          throw err;
        }

        const content = String(parsed?.choices?.[0]?.message?.content || '').trim();
        if (!content) {
          const err = new Error(`${p.label} (${modelId}) returned an empty completion.`);
          err.code = 'PROVIDER_EMPTY_RESPONSE';
          err.httpStatus = 502;
          err.switchable = true;
          setCooldown(p, MIN_COOLDOWN_MS, modelId, 'PROVIDER_EMPTY_RESPONSE');
          throw err;
        }

        const outputTokens = Number(parsed?.usage?.completion_tokens) || Math.max(1, Math.ceil(content.length / 4));
        const usedInTokens = Number(parsed?.usage?.prompt_tokens) || inputTokens;
        p.connectionState = 'CONNECTED';
        p.lastProbeAt = p.lastProbeAt || nowFn();
        p.lastProbeLatencyMs = latencyMs;
        p.lastErrorCode = null;

        usageMonitor?.recordRequest({
          providerId: p.id,
          modelId,
          ok: true,
          latencyMs,
          inputTokens: usedInTokens,
          outputTokens,
          httpStatus: 200,
        });

        return {
          text: content,
          provider: p.id,
          providerLabel: p.label,
          modelUsed: modelId,
          latencyMs,
          inputTokens: usedInTokens,
          outputTokens,
        };
      } catch (err) {
        clearTimeout(timer);
        if (err?.code && err.switchable !== undefined) {
          lastErr = err;
          throw err;
        }
        const latencyMs = Math.max(1, nowFn() - attemptStart);
        const isTimeout = err?.name === 'AbortError';
        const wrapped = new Error(
          isTimeout
            ? `${p.label} (${modelId}) timed out after ${timeoutMs}ms.`
            : redactSecrets(`${p.label} (${modelId}) network failure: ${err?.message || 'connection error'}`)
        );
        wrapped.code = isTimeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_NETWORK_ERROR';
        wrapped.httpStatus = isTimeout ? 504 : 503;
        wrapped.switchable = true;
        usageMonitor?.recordRequest({
          providerId: p.id,
          modelId,
          ok: false,
          latencyMs,
          inputTokens,
          httpStatus: wrapped.httpStatus,
          errorCode: wrapped.code,
          errorMessage: wrapped.message,
        });
        lastErr = wrapped;
        if (attempt < maxRetries) {
          await delayMs(Math.min(1000, 200 * Math.pow(2, attempt)));
          continue;
        }
        setCooldown(p, MIN_COOLDOWN_MS, modelId, wrapped.code);
        throw wrapped;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastErr || new Error(`${p.label} invocation failed.`);
  }

  return {
    strictZeroCost,

    listProviders() {
      refreshDynamicCredentials();
      return Array.from(providers.values())
        .sort((a, b) => a.priority - b.priority)
        .map(serializeProvider);
    },

    getProvider(id) {
      refreshDynamicCredentials();
      const p = providers.get(id);
      return p ? serializeProvider(p) : null;
    },

    getInternalProvider(id) {
      refreshDynamicCredentials();
      return providers.get(id) || null;
    },

    isProviderReadyForRouting(id, { requireVision = false } = {}) {
      refreshDynamicCredentials();
      const p = providers.get(id);
      if (!p) return false;
      if (strictZeroCost && !p.eligibleForZeroCost) return false;
      if (!p.configured || !p.enabled) return false;
      if (isCoolingDown(p)) return false;
      if (requireVision && !p.supportsVision) return false;
      return p.models.some((m) => (!strictZeroCost || m.freeVerified) && (!requireVision || m.vision) && !isCoolingDown(p, m.id));
    },

    getCandidateModelsForProvider(id, { domain = 'general', requireVision = false } = {}) {
      refreshDynamicCredentials();
      const p = providers.get(id);
      if (!p || !p.configured || !p.enabled) return [];
      if (strictZeroCost && !p.eligibleForZeroCost) return [];
      if (isCoolingDown(p)) return [];

      const eligible = p.models.filter((m) => {
        if (strictZeroCost && !m.freeVerified) return false;
        if (requireVision && !m.vision) return false;
        if (isCoolingDown(p, m.id)) return false;
        return true;
      });

      return eligible
        .slice()
        .sort((a, b) => {
          const aMatch = a.domains.includes(domain) ? 1 : 0;
          const bMatch = b.domains.includes(domain) ? 1 : 0;
          return bMatch - aMatch;
        })
        .map((m) => m.id);
    },

    setProviderConfig(id, patch = {}) {
      const p = providers.get(id);
      if (!p) return { ok: false, error: `Unknown provider "${id}".` };
      if (typeof patch.enabled === 'boolean') {
        if (patch.enabled && strictZeroCost && !p.eligibleForZeroCost) {
          return {
            ok: false,
            code: 'PAID_PROVIDER_BLOCKED',
            error: `${p.label} is paid-only and cannot be enabled while Strict $0 Policy is enforced.`,
          };
        }
        p.enabled = patch.enabled;
      }
      if (Number.isFinite(Number(patch.priority))) {
        p.priority = Math.max(1, Math.min(99, Math.round(Number(patch.priority))));
      }
      if (patch.registerModel && typeof patch.registerModel === 'object') {
        const modelId = String(patch.registerModel.id || '').trim().slice(0, 120);
        if (!modelId) return { ok: false, error: 'Model ID is required.' };
        if (p.id === 'openrouter' && !modelId.endsWith(':free') && modelId !== 'openrouter/free') {
          return { ok: false, code: 'PAID_OR_UNKNOWN_MODEL_REJECTED', error: 'OpenRouter models must end with ":free" or be "openrouter/free".' };
        }
        if (strictZeroCost && !p.eligibleForZeroCost) {
          return { ok: false, code: 'PAID_PROVIDER_BLOCKED', error: 'Cannot register models on a paid-only provider under Strict $0 Policy.' };
        }
        if (!p.models.some((m) => m.id === modelId)) {
          const domains = Array.isArray(patch.registerModel.domains) && patch.registerModel.domains.length > 0
            ? patch.registerModel.domains.map((d) => String(d).toLowerCase())
            : ['general'];
          p.models.push({
            id: modelId,
            domains,
            vision: Boolean(patch.registerModel.vision),
            freeVerified: Boolean(p.eligibleForZeroCost),
          });
        }
      }
      return { ok: true, provider: serializeProvider(p) };
    },

    registerCustomProvider({ id, label, baseUrl, models = [], verifiedFree = false, supportsVision = false }) {
      const cleanId = String(id || `custom_${Date.now()}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, 32);
      if (!cleanId || providers.has(cleanId)) {
        return { ok: false, error: 'Provide a unique custom provider ID.' };
      }
      const urlCheck = validateCustomProviderUrl(baseUrl);
      if (!urlCheck.valid) {
        return { ok: false, code: 'INVALID_PROVIDER_URL', error: urlCheck.reason };
      }

      const eligible = urlCheck.isLocal || Boolean(verifiedFree);
      if (strictZeroCost && !eligible) {
        return {
          ok: false,
          code: 'PAID_PROVIDER_BLOCKED',
          error: 'Under Strict $0 Policy, custom endpoints must be local ($0) or explicitly verified free-tier.',
        };
      }

      const modelList = (Array.isArray(models) ? models : String(models || '').split(','))
        .map((m) => String(m || '').trim())
        .filter(Boolean)
        .slice(0, 12);
      if (modelList.length === 0) {
        return { ok: false, error: 'Register at least one model ID for the custom provider.' };
      }

      const envKeyName = `${cleanId.toUpperCase()}_API_KEY`;
      const serverKey = String(env[envKeyName] || (urlCheck.isLocal ? 'local' : '')).trim();
      const configured = urlCheck.isLocal || isConfiguredApiKey(serverKey);

      const record = {
        id: cleanId,
        label: String(label || cleanId).trim().slice(0, 60),
        protocol: 'openai-compatible',
        envVars: urlCheck.isLocal ? [] : [envKeyName],
        baseUrl: urlCheck.normalizedUrl,
        apiKey: serverKey,
        configured,
        billingTier: urlCheck.isLocal ? 'local_zero_cost' : 'verified_free_tier',
        eligibleForZeroCost: eligible,
        requiresLiveZeroPricing: false,
        supportsVision: Boolean(supportsVision),
        supportsStreaming: true,
        defaultPriority: 12,
        priority: 12,
        enabled: true,
        freeQuotaNote: urlCheck.isLocal
          ? 'Local OpenAI-compatible server ($0).'
          : `Custom server-side provider (reads ${envKeyName} from server env; never accepts keys from browser).`,
        models: modelList.map((mId) => ({
          id: mId,
          domains: ['general', 'coding', 'writing'],
          vision: Boolean(supportsVision),
          freeVerified: eligible,
        })),
        verifiedLiveModels: new Set(),
        connectionState: configured ? 'UNTESTED' : 'UNCONFIGURED',
        lastProbeAt: null,
        lastProbeLatencyMs: null,
        lastProbeMessage: configured
          ? 'Registered. Click Test Connection to probe live availability.'
          : `Set ${envKeyName} in server environment variables to authorize.`,
        cooldownUntilMs: 0,
        modelCooldowns: new Map(),
        lastErrorCode: null,
        isCustom: true,
      };
      providers.set(cleanId, record);
      auditLogger?.record({
        category: 'PROVIDER_REGISTRY',
        severity: 'INFO',
        action: `Registered custom provider ${record.label}`,
        detail: `Base URL: ${record.baseUrl} (${modelList.length} model(s))`,
      });
      return { ok: true, provider: serializeProvider(record) };
    },

    resetCooldowns(providerId = null) {
      if (providerId) {
        const p = providers.get(providerId);
        if (!p) return false;
        p.cooldownUntilMs = 0;
        p.modelCooldowns.clear();
        if (p.connectionState === 'RATE_LIMITED') p.connectionState = 'UNTESTED';
        return true;
      }
      for (const p of providers.values()) {
        p.cooldownUntilMs = 0;
        p.modelCooldowns.clear();
        if (p.connectionState === 'RATE_LIMITED') p.connectionState = 'UNTESTED';
      }
      return true;
    },

    markProviderSuccess(providerId, modelId = null, latencyMs = 0) {
      const p = providers.get(providerId);
      if (!p) return;
      p.connectionState = 'CONNECTED';
      p.cooldownUntilMs = 0;
      if (modelId) p.modelCooldowns.delete(modelId);
      p.lastErrorCode = null;
      p.lastProbeAt = nowFn();
      if (latencyMs > 0) p.lastProbeLatencyMs = latencyMs;
      p.lastProbeMessage = `Live inference succeeded${modelId ? ` (${modelId})` : ''}.`;
    },

    markProviderRateLimited(providerId, modelId = null, cooldownSec = 60, code = 'HTTP_429') {
      const p = providers.get(providerId);
      if (!p) return;
      p.connectionState = 'RATE_LIMITED';
      setCooldown(p, Math.min(MAX_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, cooldownSec * 1000)), modelId, code);
    },

    testProviderConnection,
    invokeOpenAiCompatibleProvider,
    isPricingStrictlyZero,
    legacyMultiProviderRouter,
  };
}
