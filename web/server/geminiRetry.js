import { classifyGeminiError, extractGeminiErrorDetails } from '../src/services/brainEngine.js';

export const DEFAULT_MAX_RETRIES = 2;
export const HARD_MAX_RETRIES = 3;
export const DEFAULT_BASE_DELAY_MS = 1000;
export const DEFAULT_MAX_RETRY_DELAY_MS = 8000;

export function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoffDelayMs({
  attempt = 0,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
  retryAfterSeconds = null,
  jitterRatio = 0.25,
  randomFn = Math.random,
} = {}) {
  const safeMaxDelay = Math.max(0, Number(maxRetryDelayMs) || DEFAULT_MAX_RETRY_DELAY_MS);
  const safeBase = Math.max(0, Number(baseDelayMs) || DEFAULT_BASE_DELAY_MS);

  // If upstream explicitly tells us to wait longer than our request budget, do NOT stall — fail fast with real error
  if (typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    const requestedMs = Math.ceil(retryAfterSeconds * 1000);
    if (requestedMs > safeMaxDelay) {
      return null;
    }
    const expMs = Math.min(safeMaxDelay, safeBase * Math.pow(2, attempt));
    return Math.min(safeMaxDelay, Math.max(expMs, requestedMs));
  }

  const expDelay = safeBase * Math.pow(2, attempt);
  const jitter = Math.floor(expDelay * jitterRatio * Math.max(0, Math.min(1, Number(randomFn()) || 0)));
  return Math.min(safeMaxDelay, Math.round(expDelay + jitter));
}

export async function executeWithGeminiBackoff(
  operation,
  {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
    sleep = defaultSleep,
    randomFn = Math.random,
    isAborted = () => false,
    hasEmittedOutput = () => false,
    onRetry = null,
  } = {}
) {
  const boundedMaxRetries = Math.max(0, Math.min(HARD_MAX_RETRIES, Math.floor(Number(maxRetries) || 0)));

  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (err) {
      const details = extractGeminiErrorDetails(err);
      const classified = classifyGeminiError(details.httpStatus, details.upstreamMessage, details);
      const attemptsMade = attempt + 1;

      const canRetry =
        classified.retryable &&
        attempt < boundedMaxRetries &&
        !isAborted() &&
        !hasEmittedOutput();

      const delayMs = canRetry
        ? computeBackoffDelayMs({
            attempt,
            baseDelayMs,
            maxRetryDelayMs,
            retryAfterSeconds: classified.retryAfterSeconds,
            randomFn,
          })
        : null;

      if (!canRetry || delayMs === null) {
        err.geminiDetails = details;
        err.geminiClassified = classified;
        err.attemptsMade = attemptsMade;
        throw err;
      }

      if (typeof onRetry === 'function') {
        onRetry({
          attempt: attempt + 1,
          maxRetries: boundedMaxRetries,
          delayMs,
          classified,
          details,
        });
      }

      await sleep(delayMs);

      if (isAborted()) {
        err.geminiDetails = details;
        err.geminiClassified = classified;
        err.attemptsMade = attemptsMade;
        throw err;
      }

      attempt += 1;
    }
  }
}

export function createQuotaCooldownTracker({ nowFn = Date.now } = {}) {
  let cooldownUntilMs = 0;
  let lastQuotaError = null;

  return {
    recordSuccess() {
      cooldownUntilMs = 0;
      lastQuotaError = null;
    },
    recordError(classified) {
      if (!classified) return;
      const now = nowFn();
      const cat = classified.quotaCategory;
      if (cat === 'RPD' || cat === 'BILLING' || cat === 'SPEND_CAP') {
        cooldownUntilMs = Math.max(cooldownUntilMs, now + 5 * 60 * 1000);
        lastQuotaError = {
          code: classified.code,
          quotaCategory: cat,
          httpStatus: classified.httpStatus,
          recordedAt: now,
        };
      } else if (cat === 'RPM' || cat === 'TPM' || cat === 'GENERIC_RATE_LIMIT') {
        const retryMs =
          typeof classified.retryAfterSeconds === 'number' && Number.isFinite(classified.retryAfterSeconds)
            ? Math.ceil(classified.retryAfterSeconds * 1000)
            : 0;
        const pauseMs = Math.min(3 * 60 * 1000, Math.max(30_000, retryMs));
        cooldownUntilMs = Math.max(cooldownUntilMs, now + pauseMs);
        lastQuotaError = {
          code: classified.code,
          quotaCategory: cat,
          httpStatus: classified.httpStatus,
          recordedAt: now,
        };
      }
    },
    isBackgroundPaused() {
      return nowFn() < cooldownUntilMs;
    },
    getRemainingCooldownSeconds() {
      const remaining = cooldownUntilMs - nowFn();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    },
    getLastQuotaError() {
      return lastQuotaError;
    },
  };
}
