import {
  classifyGeminiError,
  extractGeminiErrorDetails,
} from '../src/services/brainEngine.js';
import {
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  executeWithGeminiBackoff,
} from './geminiRetry.js';

/**
 * Primary default Gemini model preserved across JARVIS.
 */
export const DEFAULT_PRIMARY_MODEL = 'gemini-3.8-flash';

/**
 * Curated, ordered allowlist of currently supported Gemini models with Free Tier eligibility.
 * Strictly excludes paid-only (Pro / Ultra / Gemini 4 / Imagen / Veo) and deprecated/retired models
 * (Gemini 1.0, 1.5, 2.0, deprecated 2.5-flash for new users, and shut-down 2.5-flash-lite-preview-09-2025).
 */
export const FREE_TIER_GEMINI_MODELS = Object.freeze([
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
]);

export const APPROVED_FREE_TIER_MODEL_SET = new Set(FREE_TIER_GEMINI_MODELS);

const DEPRECATED_OR_UNSUPPORTED_PATTERNS = [
  /^gemini-1(?:\.0|\.5)?(?:-|$)/i,
  /^gemini-2\.0(?:-|$)/i,
  /^gemini-2\.5-flash$/i,
  /^gemini-2\.5-flash-preview/i,
  /^gemini-2\.5-flash-lite-preview/i,
  /-exp(?:-|$)/i,
  /-09-2025$/i,
  /^chat-bison|^text-bison|^embedding-|^text-embedding-/i,
];

const PAID_ONLY_OR_NON_TEXT_PATTERNS = [
  /^gemini-4(?:\.|-|$)/i,
  /(?:^|-)pro(?:$|-)/i,
  /(?:^|-)ultra(?:$|-)/i,
  /^imagen(?:-|$)/i,
  /^veo(?:-|$)/i,
  /^lyria(?:-|$)/i,
  /robotics|computer-use|deep-research|tts(?:-|$)|native-audio|live/i,
];

export const HARD_MAX_FALLBACK_CANDIDATES = 4;
const MODEL_LIST_CACHE_TTL_MS = 15 * 60 * 1000;
const MODEL_LIST_TIMEOUT_MS = 3500;
const UNAVAILABLE_MODEL_COOLDOWN_MS = 30 * 60 * 1000;
const RPD_COOLDOWN_MS = 15 * 60 * 1000;
const MIN_RPM_COOLDOWN_MS = 35 * 1000;
const MAX_RPM_COOLDOWN_MS = 3 * 60 * 1000;

export function normalizeModelId(rawModel) {
  return String(rawModel || '')
    .trim()
    .replace(/^models\//i, '')
    .trim();
}

export function isDeprecatedOrUnsupportedModel(rawModel) {
  const cleaned = normalizeModelId(rawModel);
  if (!cleaned) return true;
  return DEPRECATED_OR_UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function isPaidOnlyModel(rawModel) {
  const cleaned = normalizeModelId(rawModel);
  if (!cleaned) return false;
  return PAID_ONLY_OR_NON_TEXT_PATTERNS.some((pattern) => pattern.test(cleaned));
}

/**
 * Returns true ONLY for verified, active, non-deprecated, Free-Tier-eligible Gemini text/multimodal models.
 */
export function isApprovedFreeTierModel(rawModel) {
  const cleaned = normalizeModelId(rawModel);
  if (!cleaned) return false;
  if (isDeprecatedOrUnsupportedModel(cleaned)) return false;
  if (isPaidOnlyModel(cleaned)) return false;
  return APPROVED_FREE_TIER_MODEL_SET.has(cleaned);
}

/**
 * Parses an optional comma-separated env list of fallback models and strictly filters out
 * any paid-only, deprecated, or unapproved model IDs.
 */
export function parseConfiguredFallbackModels(rawEnvValue) {
  if (Array.isArray(rawEnvValue)) {
    return rawEnvValue.map(normalizeModelId).filter(Boolean);
  }
  if (typeof rawEnvValue !== 'string' || !rawEnvValue.trim()) {
    return null;
  }
  return rawEnvValue
    .split(',')
    .map(normalizeModelId)
    .filter(Boolean);
}

/**
 * Resolves the ordered candidate chain:
 * - Always keeps the configured primary model first (never silently drops primary).
 * - Appends only approved, non-deprecated, free-tier-eligible fallback models.
 * - Deduplicates and caps chain length to prevent runaway failover loops.
 */
export function resolveFreeTierFallbackChain({
  primaryModel = DEFAULT_PRIMARY_MODEL,
  configuredFallbacks = null,
} = {}) {
  const primary = normalizeModelId(primaryModel) || DEFAULT_PRIMARY_MODEL;
  const rejected = [];

  // Explicit empty array disables automatic switching (used by isolated single-model unit tests)
  if (Array.isArray(configuredFallbacks) && configuredFallbacks.length === 0) {
    return {
      primaryModel: primary,
      chain: [primary],
      fallbackModels: [],
      rejectedModels: [],
    };
  }

  const rawFallbacks =
    configuredFallbacks !== null && configuredFallbacks !== undefined
      ? parseConfiguredFallbackModels(configuredFallbacks) || []
      : [...FREE_TIER_GEMINI_MODELS];

  const chain = [primary];
  const seen = new Set([primary]);

  for (const candidate of rawFallbacks) {
    if (!candidate || seen.has(candidate)) continue;
    if (!isApprovedFreeTierModel(candidate)) {
      rejected.push(candidate);
      continue;
    }
    seen.add(candidate);
    chain.push(candidate);
    if (chain.length >= HARD_MAX_FALLBACK_CANDIDATES) break;
  }

  return {
    primaryModel: primary,
    chain,
    fallbackModels: chain.slice(1),
    rejectedModels: rejected,
  };
}

/**
 * Determines whether a classified Gemini error warrants switching to the next approved
 * Free-Tier model before returning an error to the user.
 */
export function shouldSwitchToNextFreeModel(
  classified,
  { hasEmittedOutput = false, isAborted = false } = {}
) {
  if (!classified || hasEmittedOutput || isAborted) return false;

  // Never switch on invalid API key, client payload errors, account-wide spend caps, or 403 billing disabled
  if (classified.code === 'GEMINI_AUTH_ERROR') return false;
  if (classified.code === 'GEMINI_BAD_REQUEST') return false;
  if (classified.code === 'GEMINI_QUOTA_SPEND_CAP') return false;

  // HTTP 429 RESOURCE_EXHAUSTED (RPM, TPM, RPD, generic rate limit, or per-model Free Tier limit: 0)
  if (
    classified.code === 'GEMINI_QUOTA_RPM' ||
    classified.code === 'GEMINI_QUOTA_TPM' ||
    classified.code === 'GEMINI_QUOTA_RPD' ||
    classified.code === 'GEMINI_RATE_LIMIT'
  ) {
    return true;
  }

  // Per-model Free Tier quota limit: 0 comes back as HTTP 429 RESOURCE_EXHAUSTED (classified as BILLING),
  // whereas project-wide billing disabled comes back as HTTP 403 / 402.
  // Allow switching ONLY on HTTP 429 free-tier per-model zero-limit so another Free-Tier model can serve.
  if (classified.code === 'GEMINI_QUOTA_BILLING') {
    const msg = String(classified.upstreamMessage || '');
    const isHttp429FreeTierModelZero =
      classified.httpStatus === 429 &&
      !/billing.*disabled|enable billing|spend cap/i.test(msg);
    return isHttp429FreeTierModelZero;
  }

  // Model unavailable/not found in this account/region -> try next supported free-tier model
  if (classified.code === 'GEMINI_MODEL_NOT_FOUND') {
    return true;
  }

  // Transient model overload (503) or upstream request timeout (504) before output -> try next healthy free-tier model
  if (classified.code === 'GEMINI_UNAVAILABLE' || classified.code === 'GEMINI_TIMEOUT') {
    return true;
  }

  return false;
}

function formatWaitGuidance(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'a few moments';
  }
  if (seconds < 90) {
    return `about ${Math.max(15, Math.ceil(seconds))} seconds`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function createAllFreeModelsExhaustedError({
  primaryModel,
  attemptedModels = [],
  poolModels = [],
  retryAfterSeconds = 60,
  totalAttempts = 0,
  lastClassified = null,
  lastDetails = null,
}) {
  const listedModels = (attemptedModels.length > 0 ? attemptedModels : poolModels).join(', ');
  const waitText = formatWaitGuidance(retryAfterSeconds);
  const message =
    `All currently supported Free Tier Gemini models (${listedModels || primaryModel}) have temporarily exhausted their free quotas. ` +
    `JARVIS stays strictly on Free Tier models and will never switch to paid models or activate billing. ` +
    `Please wait ${waitText} for the free quota window to reset (per-minute limits reset within ~60s; daily free limits reset at midnight Pacific Time) and try again.`;

  const err = new Error(message);
  err.status = 429;
  err.code = 'ALL_FREE_MODELS_EXHAUSTED';
  err.allModelsExhausted = true;
  err.attemptedModels = [...attemptedModels];
  err.primaryModel = primaryModel;
  err.attemptsMade = Math.max(1, totalAttempts);
  err.geminiDetails = {
    httpStatus: 429,
    upstreamStatus: 'RESOURCE_EXHAUSTED',
    upstreamMessage: lastDetails?.upstreamMessage || message,
    retryAfterSeconds,
    quotaMetrics: lastDetails?.quotaMetrics || [],
    quotaIds: lastDetails?.quotaIds || [],
    quotaValues: lastDetails?.quotaValues || [],
    errorReason: 'ALL_FREE_MODELS_EXHAUSTED',
  };
  err.geminiClassified = {
    code: 'ALL_FREE_MODELS_EXHAUSTED',
    quotaCategory: lastClassified?.quotaCategory && lastClassified.quotaCategory !== 'NONE'
      ? lastClassified.quotaCategory
      : 'RPD',
    httpStatus: 429,
    upstreamStatus: 'RESOURCE_EXHAUSTED',
    upstreamMessage: lastDetails?.upstreamMessage || message,
    retryable: true,
    retryAfterSeconds: Math.max(15, Math.ceil(retryAfterSeconds || 60)),
    quotaMetrics: lastClassified?.quotaMetrics || [],
    quotaIds: lastClassified?.quotaIds || [],
    message,
  };
  return err;
}

/**
 * Extracts supported generateContent model IDs from `@google/genai` `ai.models.list()`.
 * Supports both AsyncIterable pagers (official SDK) and plain arrays/objects (mocks).
 */
async function fetchSupportedFreeModelsFromApi(ai) {
  if (!ai?.models || typeof ai.models.list !== 'function') {
    return null;
  }

  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('models.list timeout')), MODEL_LIST_TIMEOUT_MS);
  });

  try {
    const rawList = await Promise.race([Promise.resolve(ai.models.list()), timeoutPromise]);
    const discovered = [];

    const inspectEntry = (entry) => {
      if (!entry || typeof entry !== 'object') return;
      const id = normalizeModelId(entry.name || entry.id || entry.model || '');
      if (!id || !isApprovedFreeTierModel(id)) return;
      const methods = entry.supportedActions || entry.supportedGenerationMethods;
      if (Array.isArray(methods) && methods.length > 0) {
        const supportsGenerate = methods.some((m) => /generateContent/i.test(String(m)));
        if (!supportsGenerate) return;
      }
      discovered.push(id);
    };

    if (Array.isArray(rawList)) {
      rawList.forEach(inspectEntry);
    } else if (Array.isArray(rawList?.models)) {
      rawList.models.forEach(inspectEntry);
    } else if (rawList && typeof rawList[Symbol.asyncIterator] === 'function') {
      let count = 0;
      for await (const item of rawList) {
        inspectEntry(item);
        count += 1;
        if (count >= 250) break;
      }
    }

    return discovered.length > 0 ? new Set(discovered) : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createFreeModelFallbackManager({
  getPrimaryModel = () => DEFAULT_PRIMARY_MODEL,
  configuredFallbacks = null,
  enableDynamicDiscovery = true,
  nowFn = Date.now,
  retryOptions = {},
} = {}) {
  const modelStates = new Map();
  let discoveredFreeSet = null;
  let discoveredAtMs = 0;
  let discoveryInFlight = null;
  let lastActiveModel = normalizeModelId(getPrimaryModel()) || DEFAULT_PRIMARY_MODEL;
  let totalFallbackSwitches = 0;

  function getChainInfo() {
    const primary = normalizeModelId(getPrimaryModel()) || DEFAULT_PRIMARY_MODEL;
    return resolveFreeTierFallbackChain({
      primaryModel: primary,
      configuredFallbacks,
    });
  }

  function getOrCreateState(modelId) {
    if (!modelStates.has(modelId)) {
      modelStates.set(modelId, {
        model: modelId,
        status: 'available',
        cooldownUntilMs: 0,
        lastErrorCode: null,
        lastQuotaCategory: null,
        lastErrorMessage: null,
        lastUpdatedAt: 0,
        consecutiveFailures: 0,
      });
    }
    return modelStates.get(modelId);
  }

  function refreshStateIfExpired(state, now) {
    if (state.cooldownUntilMs > 0 && now >= state.cooldownUntilMs) {
      state.status = 'available';
      state.cooldownUntilMs = 0;
      state.consecutiveFailures = 0;
    }
    return state;
  }

  function isModelCoolingDown(modelId) {
    const now = nowFn();
    const state = refreshStateIfExpired(getOrCreateState(modelId), now);
    return state.cooldownUntilMs > now;
  }

  function getRemainingCooldownSeconds(modelId) {
    const now = nowFn();
    const state = refreshStateIfExpired(getOrCreateState(modelId), now);
    const remainingMs = state.cooldownUntilMs - now;
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  function recordModelSuccess(modelId) {
    const now = nowFn();
    const state = getOrCreateState(modelId);
    state.status = 'available';
    state.cooldownUntilMs = 0;
    state.lastErrorCode = null;
    state.lastQuotaCategory = null;
    state.lastErrorMessage = null;
    state.consecutiveFailures = 0;
    state.lastUpdatedAt = now;
    lastActiveModel = modelId;
  }

  function recordModelError(modelId, classified) {
    if (!classified) return;
    const now = nowFn();
    const state = getOrCreateState(modelId);
    state.consecutiveFailures += 1;
    state.lastErrorCode = classified.code || null;
    state.lastQuotaCategory = classified.quotaCategory || null;
    state.lastErrorMessage = String(classified.upstreamMessage || classified.message || '').slice(0, 280);
    state.lastUpdatedAt = now;

    if (classified.code === 'GEMINI_MODEL_NOT_FOUND') {
      state.status = 'unavailable';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + UNAVAILABLE_MODEL_COOLDOWN_MS);
      return;
    }

    const cat = classified.quotaCategory;
    if (cat === 'RPD' || cat === 'BILLING') {
      const retryMs =
        typeof classified.retryAfterSeconds === 'number' && Number.isFinite(classified.retryAfterSeconds)
          ? Math.ceil(classified.retryAfterSeconds * 1000)
          : 0;
      const cooldownMs = Math.max(RPD_COOLDOWN_MS, Math.min(60 * 60 * 1000, retryMs));
      state.status = 'rpd_exhausted';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + cooldownMs);
      return;
    }

    if (
      cat === 'RPM' ||
      cat === 'TPM' ||
      cat === 'GENERIC_RATE_LIMIT' ||
      classified.code === 'GEMINI_RATE_LIMIT' ||
      classified.code === 'GEMINI_UNAVAILABLE' ||
      classified.code === 'GEMINI_TIMEOUT'
    ) {
      const retryMs =
        typeof classified.retryAfterSeconds === 'number' && Number.isFinite(classified.retryAfterSeconds)
          ? Math.ceil(classified.retryAfterSeconds * 1000)
          : 0;
      const cooldownMs = Math.min(MAX_RPM_COOLDOWN_MS, Math.max(MIN_RPM_COOLDOWN_MS, retryMs));
      state.status = 'cooldown';
      state.cooldownUntilMs = Math.max(state.cooldownUntilMs, now + cooldownMs);
    }
  }

  async function maybeDiscoverSupportedModels(ai) {
    if (!enableDynamicDiscovery || !ai?.models || typeof ai.models.list !== 'function') {
      return discoveredFreeSet;
    }
    const now = nowFn();
    if (discoveredFreeSet && now - discoveredAtMs < MODEL_LIST_CACHE_TTL_MS) {
      return discoveredFreeSet;
    }
    if (!discoveryInFlight) {
      discoveryInFlight = fetchSupportedFreeModelsFromApi(ai)
        .then((found) => {
          if (found && found.size > 0) {
            discoveredFreeSet = found;
            discoveredAtMs = nowFn();
          }
          return discoveredFreeSet;
        })
        .finally(() => {
          discoveryInFlight = null;
        });
    }
    return discoveryInFlight;
  }

  function buildCandidateList(supportedSet = null) {
    const { primaryModel, chain } = getChainInfo();
    if (!supportedSet || supportedSet.size === 0) {
      return { primaryModel, candidates: chain };
    }
    // Keep primaryModel first, filter fallback models to those confirmed supported by models.list()
    const filtered = [
      primaryModel,
      ...chain.slice(1).filter((m) => supportedSet.has(m)),
    ];
    return { primaryModel, candidates: filtered };
  }

  function getPoolStatus() {
    const now = nowFn();
    const { primaryModel, chain, rejectedModels } = getChainInfo();
    const models = chain.map((modelId) => {
      const state = refreshStateIfExpired(getOrCreateState(modelId), now);
      const remainingSec = state.cooldownUntilMs > now ? Math.ceil((state.cooldownUntilMs - now) / 1000) : 0;
      return {
        model: modelId,
        isPrimary: modelId === primaryModel,
        freeTierApproved: isApprovedFreeTierModel(modelId),
        status: remainingSec > 0 ? state.status : 'available',
        cooldownRemainingSeconds: remainingSec,
        lastErrorCode: state.lastErrorCode,
      };
    });

    const availableCount = models.filter((m) => m.status === 'available').length;
    const shortestCooldownSeconds =
      availableCount === 0
        ? Math.min(...models.map((m) => m.cooldownRemainingSeconds || 60))
        : 0;

    return {
      enabled: chain.length > 1,
      freeTierOnly: true,
      primaryModel,
      lastActiveModel,
      fallbackModels: chain.slice(1),
      rejectedModels,
      availableCount,
      allExhausted: availableCount === 0,
      shortestCooldownSeconds,
      totalFallbackSwitches,
      dynamicDiscoveryUsed: Boolean(discoveredFreeSet && discoveredFreeSet.size > 0),
      models,
    };
  }

  function isAllModelsOnCooldown() {
    const { chain } = getChainInfo();
    return chain.every((modelId) => isModelCoolingDown(modelId));
  }

  async function executeWithFallback({
    ai,
    operation,
    enableBackoff = true,
    isAborted = () => false,
    hasEmittedOutput = () => false,
    contextLabel = 'Gemini',
    onModelSwitch = null,
  }) {
    const supportedSet = await maybeDiscoverSupportedModels(ai);
    const { primaryModel, candidates } = buildCandidateList(supportedSet);

    const healthyCandidates = candidates.filter((m) => !isModelCoolingDown(m));

    // If every free-tier model is already known to be on cooldown, fail fast with zero wasted API calls
    if (healthyCandidates.length === 0) {
      const now = nowFn();
      const states = candidates.map((m) => refreshStateIfExpired(getOrCreateState(m), now));
      const allUnavailableNotFound =
        states.length > 0 && states.every((s) => s.status === 'unavailable' && s.lastErrorCode === 'GEMINI_MODEL_NOT_FOUND');

      if (allUnavailableNotFound) {
        const primaryState = states[0];
        const msg =
          primaryState?.lastErrorMessage ||
          `Configured Gemini model "${primaryModel}" and approved Free Tier fallbacks are currently unavailable (HTTP 404).`;
        const notFoundErr = new Error(msg);
        notFoundErr.status = 404;
        notFoundErr.code = 'GEMINI_MODEL_NOT_FOUND';
        notFoundErr.attemptsMade = 1;
        notFoundErr.attemptedModels = [...candidates];
        notFoundErr.geminiDetails = {
          httpStatus: 404,
          upstreamStatus: 'NOT_FOUND',
          upstreamMessage: msg,
          retryAfterSeconds: null,
          quotaMetrics: [],
          quotaIds: [],
          quotaValues: [],
          errorReason: 'MODEL_NOT_FOUND',
        };
        notFoundErr.geminiClassified = classifyGeminiError(404, msg, notFoundErr.geminiDetails);
        throw notFoundErr;
      }

      const waitSeconds = Math.min(
        ...candidates.map((m) => getRemainingCooldownSeconds(m) || 60)
      );
      throw createAllFreeModelsExhaustedError({
        primaryModel,
        attemptedModels: [],
        poolModels: candidates,
        retryAfterSeconds: waitSeconds,
        totalAttempts: 0,
      });
    }

    const triedModels = new Set();
    const attemptedModels = [];
    let totalAttempts = 0;
    let lastError = null;
    let lastClassified = null;
    let lastDetails = null;
    let sawQuotaExhaustion = false;
    let allErrorsWereNotFound = true;
    let stoppedOnNonSwitchableError = false;

    for (let idx = 0; idx < healthyCandidates.length && idx < HARD_MAX_FALLBACK_CANDIDATES; idx++) {
      const candidateModel = healthyCandidates[idx];
      if (triedModels.has(candidateModel)) continue;
      if (isAborted()) break;

      triedModels.add(candidateModel);
      attemptedModels.push(candidateModel);

      const isPrimaryAttempt = candidateModel === primaryModel;
      const modelRetryOptions = {
        ...retryOptions,
        // Keep primary backoff retries full, cap secondary fallback retries to 1 so failover stays fast & bounded
        maxRetries: enableBackoff
          ? isPrimaryAttempt
            ? retryOptions.maxRetries ?? DEFAULT_MAX_RETRIES
            : Math.min(1, retryOptions.maxRetries ?? DEFAULT_MAX_RETRIES)
          : 0,
        baseDelayMs: retryOptions.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
        maxRetryDelayMs: retryOptions.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS,
        isAborted,
        hasEmittedOutput,
        onRetry: ({ attempt, maxRetries, delayMs, classified }) => {
          console.warn(
            `[JARVIS ${contextLabel} Backoff] Model "${candidateModel}" hit ${classified.code} (HTTP ${classified.httpStatus}); retry ${attempt}/${maxRetries} in ${delayMs}ms`
          );
        },
      };

      try {
        const result = enableBackoff
          ? await executeWithGeminiBackoff(
              (attemptIdx) => operation(candidateModel, { attemptIdx, isFallback: !isPrimaryAttempt }),
              modelRetryOptions
            )
          : await operation(candidateModel, { attemptIdx: 0, isFallback: !isPrimaryAttempt });

        recordModelSuccess(candidateModel);
        const fallbackUsed = candidateModel !== primaryModel;
        if (fallbackUsed) {
          totalFallbackSwitches += 1;
        }
        return {
          result,
          modelUsed: candidateModel,
          primaryModel,
          fallbackUsed,
          switchedFrom: fallbackUsed ? primaryModel : null,
          attemptedModels,
          totalAttempts: totalAttempts + 1,
        };
      } catch (err) {
        const details = err?.geminiDetails || extractGeminiErrorDetails(err);
        const classified =
          err?.geminiClassified ||
          classifyGeminiError(details.httpStatus, details.upstreamMessage, details);
        const modelAttempts = Number.isFinite(err?.attemptsMade) ? err.attemptsMade : 1;
        totalAttempts += modelAttempts;

        err.geminiDetails = details;
        err.geminiClassified = classified;
        err.attemptsMade = totalAttempts;
        err.attemptedModels = [...attemptedModels];

        lastError = err;
        lastClassified = classified;
        lastDetails = details;

        if (classified.code !== 'GEMINI_MODEL_NOT_FOUND') {
          allErrorsWereNotFound = false;
        }
        if (
          classified.httpStatus === 429 ||
          classified.quotaCategory !== 'NONE' ||
          classified.code === 'GEMINI_RATE_LIMIT'
        ) {
          sawQuotaExhaustion = true;
        }

        const canSwitch = shouldSwitchToNextFreeModel(classified, {
          hasEmittedOutput: hasEmittedOutput(),
          isAborted: isAborted(),
        });

        if (canSwitch) {
          recordModelError(candidateModel, classified);
        } else {
          stoppedOnNonSwitchableError = true;
          break;
        }

        const hasNextHealthyModel = healthyCandidates
          .slice(idx + 1)
          .some((nextModel) => !triedModels.has(nextModel) && !isModelCoolingDown(nextModel));

        if (!hasNextHealthyModel) {
          break;
        }

        const nextModel = healthyCandidates
          .slice(idx + 1)
          .find((m) => !triedModels.has(m) && !isModelCoolingDown(m));

        console.warn(
          `[JARVIS Free Model Fallback] "${candidateModel}" failed with ${classified.code} (HTTP ${classified.httpStatus ?? 'N/A'}). Switching to approved Free Tier model "${nextModel}".`
        );

        if (typeof onModelSwitch === 'function') {
          onModelSwitch({
            fromModel: candidateModel,
            toModel: nextModel,
            reasonCode: classified.code,
            httpStatus: classified.httpStatus,
          });
        }
      }
    }

    // If multi-model fallback pool is enabled (>1 candidate) and all free models failed due to switchable quota exhaustion,
    // surface a clear, honest ALL_FREE_MODELS_EXHAUSTED message asking the user to wait for quota reset.
    if (
      candidates.length > 1 &&
      !stoppedOnNonSwitchableError &&
      sawQuotaExhaustion &&
      !allErrorsWereNotFound
    ) {
      const waitSeconds = Math.min(
        ...candidates.map((m) => getRemainingCooldownSeconds(m) || 60)
      );
      throw createAllFreeModelsExhaustedError({
        primaryModel,
        attemptedModels,
        poolModels: candidates,
        retryAfterSeconds: waitSeconds,
        totalAttempts,
        lastClassified,
        lastDetails,
      });
    }

    if (lastError) {
      throw lastError;
    }

    throw createAllFreeModelsExhaustedError({
      primaryModel,
      attemptedModels,
      poolModels: candidates,
      retryAfterSeconds: 60,
      totalAttempts,
    });
  }

  return {
    getChainInfo,
    getPoolStatus,
    isAllModelsOnCooldown,
    isModelCoolingDown,
    getRemainingCooldownSeconds,
    recordModelSuccess,
    recordModelError,
    executeWithFallback,
  };
}
