package com.example.ai

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

/**
 * Strictly bounded exponential backoff policy for temporary upstream Gemini 429 / 503 errors.
 * Never retries non-retryable quota errors (RPD, BILLING, SPEND_CAP) or 4xx errors,
 * and enforces a hard retry ceiling so infinite retry loops are impossible.
 */
object GeminiBackoffPolicy {
    const val DEFAULT_MAX_RETRIES = 1
    const val HARD_MAX_RETRIES = 3
    const val DEFAULT_BASE_DELAY_MS = 450L
    const val DEFAULT_MAX_RETRY_DELAY_MS = 2500L

    fun computeDelayMs(
        attempt: Int,
        retryAfterSeconds: Double? = null,
        baseDelayMs: Long = DEFAULT_BASE_DELAY_MS,
        maxRetryDelayMs: Long = DEFAULT_MAX_RETRY_DELAY_MS,
        jitterRatio: Double = 0.25,
        randomDouble: () -> Double = { Random.nextDouble() }
    ): Long? {
        val safeMax = max(0L, maxRetryDelayMs)
        val safeBase = max(0L, baseDelayMs)
        val safeAttempt = max(0, attempt)

        if (retryAfterSeconds != null && retryAfterSeconds > 0.0) {
            val requestedMs = ceil(retryAfterSeconds * 1000.0).toLong()
            if (requestedMs > safeMax) {
                // Upstream asked to wait longer than our request budget; return error immediately instead of stalling
                return null
            }
            val expMs = min(safeMax, (safeBase * 2.0.pow(safeAttempt)).toLong())
            return min(safeMax, max(expMs, requestedMs))
        }

        val expDelay = (safeBase * 2.0.pow(safeAttempt)).toLong()
        val clampedRand = randomDouble().coerceIn(0.0, 1.0)
        val jitter = (expDelay * jitterRatio * clampedRand).toLong()
        return min(safeMax, expDelay + jitter)
    }

    fun nextRetryDelayMs(
        classification: GeminiErrorClassification,
        attempt: Int,
        maxRetries: Int = DEFAULT_MAX_RETRIES,
        hasEmittedOutput: Boolean = false,
        isAborted: Boolean = false,
        baseDelayMs: Long = DEFAULT_BASE_DELAY_MS,
        maxRetryDelayMs: Long = DEFAULT_MAX_RETRY_DELAY_MS,
        randomDouble: () -> Double = { Random.nextDouble() }
    ): Long? {
        val boundedMax = maxRetries.coerceIn(0, HARD_MAX_RETRIES)
        if (!classification.retryable) return null
        if (attempt >= boundedMax) return null
        if (hasEmittedOutput || isAborted) return null

        return computeDelayMs(
            attempt = attempt,
            retryAfterSeconds = classification.retryAfterSeconds,
            baseDelayMs = baseDelayMs,
            maxRetryDelayMs = maxRetryDelayMs,
            randomDouble = randomDouble
        )
    }

    suspend fun <T> executeWithBackoff(
        maxRetries: Int = DEFAULT_MAX_RETRIES,
        baseDelayMs: Long = DEFAULT_BASE_DELAY_MS,
        maxRetryDelayMs: Long = DEFAULT_MAX_RETRY_DELAY_MS,
        sleep: suspend (Long) -> Unit = { kotlinx.coroutines.delay(it) },
        randomDouble: () -> Double = { Random.nextDouble() },
        isAborted: () -> Boolean = { false },
        hasEmittedOutput: () -> Boolean = { false },
        classifyFailure: (T) -> GeminiErrorClassification?,
        onRetry: (attempt: Int, maxRetries: Int, delayMs: Long, classification: GeminiErrorClassification) -> Unit = { _, _, _, _ -> },
        block: suspend (attempt: Int) -> T
    ): T {
        val boundedMax = maxRetries.coerceIn(0, HARD_MAX_RETRIES)
        var attempt = 0
        while (true) {
            val result = block(attempt)
            val failure = classifyFailure(result) ?: return result
            val delayMs = nextRetryDelayMs(
                classification = failure,
                attempt = attempt,
                maxRetries = boundedMax,
                hasEmittedOutput = hasEmittedOutput(),
                isAborted = isAborted(),
                baseDelayMs = baseDelayMs,
                maxRetryDelayMs = maxRetryDelayMs,
                randomDouble = randomDouble
            ) ?: return result

            onRetry(attempt + 1, boundedMax, delayMs, failure)
            sleep(delayMs)
            if (isAborted()) return result
            attempt += 1
        }
    }
}
