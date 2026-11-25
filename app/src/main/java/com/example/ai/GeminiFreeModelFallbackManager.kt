package com.example.ai

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

enum class FreeModelHealth {
    AVAILABLE,
    COOLDOWN,
    RPD_EXHAUSTED,
    UNAVAILABLE
}

data class ResolvedFallbackChain(
    val primaryModel: String,
    val chain: List<String>,
    val fallbackModels: List<String>,
    val rejectedModels: List<String>
)

data class FreeModelEntryStatus(
    val model: String,
    val isPrimary: Boolean,
    val freeTierApproved: Boolean,
    val status: FreeModelHealth,
    val cooldownRemainingSeconds: Int,
    val lastErrorCode: String?
)

data class FreeModelPoolStatus(
    val enabled: Boolean,
    val freeTierOnly: Boolean = true,
    val primaryModel: String,
    val lastActiveModel: String,
    val fallbackUsed: Boolean,
    val switchedFrom: String?,
    val availableCount: Int,
    val allExhausted: Boolean,
    val shortestCooldownSeconds: Int,
    val totalFallbackSwitches: Int,
    val dynamicDiscoveryUsed: Boolean,
    val models: List<FreeModelEntryStatus>
)

data class FallbackAttemptOutcome<T>(
    val value: T? = null,
    val failure: GeminiErrorClassification? = null,
    val attemptsMade: Int = 1
)

data class FallbackExecutionResult<T>(
    val value: T? = null,
    val failure: GeminiErrorClassification? = null,
    val modelUsed: String,
    val primaryModel: String,
    val fallbackUsed: Boolean,
    val switchedFrom: String?,
    val attemptedModels: List<String>,
    val totalAttempts: Int,
    val allModelsExhausted: Boolean
)

/**
 * Smart Free-Tier-Only Gemini Model Fallback Manager for Android.
 *
 * Guarantees:
 * 1. Preserves the configured primary Gemini model (`gemini-3.8-flash` by default).
 * 2. On HTTP 429 RESOURCE_EXHAUSTED, 404 model unavailable, or 503 overload, automatically checks
 *    and switches to the next healthy, approved Free-Tier Gemini model.
 * 3. Strictly blocks paid-only models (Pro, Ultra, Gemini 4, Imagen, Veo, etc.) and deprecated/retired
 *    models (1.0, 1.5, 2.0, 2.5-flash, preview-09-2025). Never enables billing.
 * 4. Prevents infinite retry loops and duplicate wasted 429 calls via bounded exponential backoff
 *    and per-model cooldown tracking.
 * 5. Reports fallback switches honestly only after the switched model succeeds, and returns a clear
 *    wait-for-reset message if every approved Free Tier model has exhausted its quota.
 */
class GeminiFreeModelFallbackManager(
    private val primaryModelProvider: () -> String = { DEFAULT_PRIMARY_MODEL },
    private val configuredFallbacks: List<String>? = null,
    private val enableDynamicDiscovery: Boolean = true,
    private val nowMs: () -> Long = { System.currentTimeMillis() }
) {
    private data class MutableModelState(
        val model: String,
        var status: FreeModelHealth = FreeModelHealth.AVAILABLE,
        var cooldownUntilMs: Long = 0L,
        var lastErrorCode: String? = null,
        var lastErrorMessage: String? = null,
        var consecutiveFailures: Int = 0
    )

    private val lock = Any()
    private val discoveryMutex = Mutex()
    private val modelStates = LinkedHashMap<String, MutableModelState>()

    @Volatile
    private var discoveredFreeSet: Set<String>? = null

    @Volatile
    private var discoveredAtMs: Long = 0L

    @Volatile
    private var lastActiveModel: String = normalizeModelId(primaryModelProvider()).ifBlank { DEFAULT_PRIMARY_MODEL }

    @Volatile
    private var lastFallbackUsed: Boolean = false

    @Volatile
    private var lastSwitchedFrom: String? = null

    @Volatile
    private var totalFallbackSwitches: Int = 0

    private val _poolStatus = MutableStateFlow(computePoolStatusSnapshot())
    val poolStatus: StateFlow<FreeModelPoolStatus> = _poolStatus.asStateFlow()

    fun getChainInfo(): ResolvedFallbackChain {
        val primary = normalizeModelId(primaryModelProvider()).ifBlank { DEFAULT_PRIMARY_MODEL }
        return resolveFallbackChain(primary, configuredFallbacks)
    }

    private fun getOrCreateStateLocked(modelId: String): MutableModelState {
        return modelStates.getOrPut(modelId) { MutableModelState(model = modelId) }
    }

    private fun refreshIfExpiredLocked(state: MutableModelState, now: Long): MutableModelState {
        if (state.cooldownUntilMs > 0L && now >= state.cooldownUntilMs) {
            state.status = FreeModelHealth.AVAILABLE
            state.cooldownUntilMs = 0L
            state.consecutiveFailures = 0
        }
        return state
    }

    fun isModelCoolingDown(modelId: String): Boolean = synchronized(lock) {
        val now = nowMs()
        val state = refreshIfExpiredLocked(getOrCreateStateLocked(modelId), now)
        state.cooldownUntilMs > now
    }

    fun getRemainingCooldownSeconds(modelId: String): Int = synchronized(lock) {
        val now = nowMs()
        val state = refreshIfExpiredLocked(getOrCreateStateLocked(modelId), now)
        val remainingMs = state.cooldownUntilMs - now
        if (remainingMs > 0L) ceil(remainingMs / 1000.0).toInt() else 0
    }

    fun isAllModelsOnCooldown(): Boolean {
        val chain = getChainInfo().chain
        return chain.all { isModelCoolingDown(it) }
    }

    fun recordModelSuccess(modelId: String, primaryOverride: String? = null, switchedFromBackend: Boolean? = null) {
        val cleaned = normalizeModelId(modelId).ifBlank { DEFAULT_PRIMARY_MODEL }
        val primary = normalizeModelId(primaryOverride ?: primaryModelProvider()).ifBlank { DEFAULT_PRIMARY_MODEL }
        synchronized(lock) {
            val state = getOrCreateStateLocked(cleaned)
            state.status = FreeModelHealth.AVAILABLE
            state.cooldownUntilMs = 0L
            state.lastErrorCode = null
            state.lastErrorMessage = null
            state.consecutiveFailures = 0

            val fallbackUsed = switchedFromBackend ?: (cleaned != primary)
            val changedToFallback = fallbackUsed && (lastActiveModel != cleaned || !lastFallbackUsed)
            lastActiveModel = cleaned
            lastFallbackUsed = fallbackUsed
            lastSwitchedFrom = if (fallbackUsed) primary else null
            if (changedToFallback) {
                totalFallbackSwitches += 1
            }
        }
        publishStatus()
    }

    fun recordModelError(modelId: String, classification: GeminiErrorClassification) {
        val cleaned = normalizeModelId(modelId).ifBlank { DEFAULT_PRIMARY_MODEL }
        synchronized(lock) {
            val now = nowMs()
            val state = getOrCreateStateLocked(cleaned)
            state.consecutiveFailures += 1
            state.lastErrorCode = classification.code
            state.lastErrorMessage = classification.upstreamMessage.ifBlank { classification.displayMessage }.take(280)

            if (classification.code == "GEMINI_MODEL_NOT_FOUND") {
                state.status = FreeModelHealth.UNAVAILABLE
                state.cooldownUntilMs = max(state.cooldownUntilMs, now + UNAVAILABLE_MODEL_COOLDOWN_MS)
            } else if (
                classification.quotaCategory == GeminiQuotaCategory.RPD ||
                classification.quotaCategory == GeminiQuotaCategory.BILLING
            ) {
                val retryMs = classification.retryAfterSeconds?.let { ceil(it * 1000.0).toLong() } ?: 0L
                val cooldownMs = max(RPD_COOLDOWN_MS, min(60 * 60 * 1000L, retryMs))
                state.status = FreeModelHealth.RPD_EXHAUSTED
                state.cooldownUntilMs = max(state.cooldownUntilMs, now + cooldownMs)
            } else if (
                classification.quotaCategory == GeminiQuotaCategory.RPM ||
                classification.quotaCategory == GeminiQuotaCategory.TPM ||
                classification.quotaCategory == GeminiQuotaCategory.GENERIC_RATE_LIMIT ||
                classification.code == "GEMINI_RATE_LIMIT" ||
                classification.code == "GEMINI_UNAVAILABLE" ||
                classification.code == "GEMINI_TIMEOUT"
            ) {
                val retryMs = classification.retryAfterSeconds?.let { ceil(it * 1000.0).toLong() } ?: 0L
                val cooldownMs = retryMs.coerceIn(MIN_RPM_COOLDOWN_MS, MAX_RPM_COOLDOWN_MS)
                state.status = FreeModelHealth.COOLDOWN
                state.cooldownUntilMs = max(state.cooldownUntilMs, now + cooldownMs)
            }
        }
        publishStatus()
    }

    suspend fun discoverSupportedModelsIfNeeded(fetchModelsJson: (suspend () -> String?)?): Set<String>? {
        if (!enableDynamicDiscovery || fetchModelsJson == null) {
            return discoveredFreeSet
        }
        val current = discoveredFreeSet
        if (current != null && (nowMs() - discoveredAtMs) < MODEL_LIST_CACHE_TTL_MS) {
            return current
        }
        return discoveryMutex.withLock {
            val rechecked = discoveredFreeSet
            if (rechecked != null && (nowMs() - discoveredAtMs) < MODEL_LIST_CACHE_TTL_MS) {
                return@withLock rechecked
            }
            val parsed = try {
                val raw = fetchModelsJson()
                if (!raw.isNullOrBlank()) parseSupportedFreeModelsJson(raw) else emptySet()
            } catch (_: Exception) {
                emptySet()
            }
            if (parsed.isNotEmpty()) {
                discoveredFreeSet = parsed
                discoveredAtMs = nowMs()
                publishStatus()
            }
            discoveredFreeSet
        }
    }

    fun getPoolStatusSnapshot(): FreeModelPoolStatus = computePoolStatusSnapshot()

    fun resetCooldowns() {
        synchronized(lock) {
            modelStates.clear()
        }
        publishStatus()
    }

    private fun publishStatus() {
        _poolStatus.value = computePoolStatusSnapshot()
    }

    private fun computePoolStatusSnapshot(): FreeModelPoolStatus = synchronized(lock) {
        val now = nowMs()
        val chainInfo = getChainInfo()
        val entries = chainInfo.chain.map { modelId ->
            val state = refreshIfExpiredLocked(getOrCreateStateLocked(modelId), now)
            val remainingSec = if (state.cooldownUntilMs > now) {
                ceil((state.cooldownUntilMs - now) / 1000.0).toInt()
            } else {
                0
            }
            FreeModelEntryStatus(
                model = modelId,
                isPrimary = modelId == chainInfo.primaryModel,
                freeTierApproved = isApprovedFreeTierModel(modelId),
                status = if (remainingSec > 0) state.status else FreeModelHealth.AVAILABLE,
                cooldownRemainingSeconds = remainingSec,
                lastErrorCode = state.lastErrorCode
            )
        }
        val availableCount = entries.count { it.status == FreeModelHealth.AVAILABLE }
        val shortestCooldown = if (availableCount == 0 && entries.isNotEmpty()) {
            entries.minOf { it.cooldownRemainingSeconds.coerceAtLeast(15) }
        } else {
            0
        }
        FreeModelPoolStatus(
            enabled = chainInfo.chain.size > 1,
            freeTierOnly = true,
            primaryModel = chainInfo.primaryModel,
            lastActiveModel = lastActiveModel,
            fallbackUsed = lastFallbackUsed,
            switchedFrom = lastSwitchedFrom,
            availableCount = availableCount,
            allExhausted = availableCount == 0,
            shortestCooldownSeconds = shortestCooldown,
            totalFallbackSwitches = totalFallbackSwitches,
            dynamicDiscoveryUsed = !discoveredFreeSet.isNullOrEmpty(),
            models = entries
        )
    }

    private fun buildCandidates(supportedSet: Set<String>?): Pair<String, List<String>> {
        val chainInfo = getChainInfo()
        if (supportedSet.isNullOrEmpty()) {
            return chainInfo.primaryModel to chainInfo.chain
        }
        val filtered = buildList {
            add(chainInfo.primaryModel)
            chainInfo.chain.drop(1).filterTo(this) { supportedSet.contains(it) }
        }
        return chainInfo.primaryModel to filtered
    }

    suspend fun <T> executeWithFallback(
        enableBackoff: Boolean = true,
        maxPrimaryRetries: Int = GeminiBackoffPolicy.DEFAULT_MAX_RETRIES,
        baseDelayMs: Long = GeminiBackoffPolicy.DEFAULT_BASE_DELAY_MS,
        maxRetryDelayMs: Long = GeminiBackoffPolicy.DEFAULT_MAX_RETRY_DELAY_MS,
        sleep: suspend (Long) -> Unit = { delay(it) },
        randomDouble: () -> Double = { Random.nextDouble() },
        isAborted: () -> Boolean = { false },
        hasEmittedOutput: () -> Boolean = { false },
        fetchModelsJson: (suspend () -> String?)? = null,
        onRetry: (model: String, attempt: Int, maxRetries: Int, delayMs: Long, classification: GeminiErrorClassification) -> Unit = { _, _, _, _, _ -> },
        onModelSwitch: (fromModel: String, toModel: String, classification: GeminiErrorClassification) -> Unit = { _, _, _ -> },
        operation: suspend (candidateModel: String, attemptIdx: Int, isFallback: Boolean) -> FallbackAttemptOutcome<T>
    ): FallbackExecutionResult<T> {
        val supportedSet = discoverSupportedModelsIfNeeded(fetchModelsJson)
        val (primaryModel, candidates) = buildCandidates(supportedSet)
        val healthyCandidates = candidates.filter { !isModelCoolingDown(it) }

        // Fail fast with 0 API calls if every candidate is currently cooling down
        if (healthyCandidates.isEmpty()) {
            val allUnavailableNotFound = synchronized(lock) {
                val now = nowMs()
                candidates.isNotEmpty() && candidates.all { modelId ->
                    val st = refreshIfExpiredLocked(getOrCreateStateLocked(modelId), now)
                    st.status == FreeModelHealth.UNAVAILABLE && st.lastErrorCode == "GEMINI_MODEL_NOT_FOUND"
                }
            }
            if (allUnavailableNotFound) {
                val firstMsg = synchronized(lock) {
                    modelStates[primaryModel]?.lastErrorMessage
                }.orEmpty().ifBlank {
                    "Configured Gemini model \"$primaryModel\" and approved Free Tier fallbacks are currently unavailable (HTTP 404)."
                }
                return FallbackExecutionResult(
                    failure = JarvisBrainEngine.classifyGeminiErrorDetailed(rawMessage = firstMsg, httpCode = 404),
                    modelUsed = primaryModel,
                    primaryModel = primaryModel,
                    fallbackUsed = false,
                    switchedFrom = null,
                    attemptedModels = candidates,
                    totalAttempts = 0,
                    allModelsExhausted = false
                )
            }

            val waitSec = candidates.minOfOrNull { getRemainingCooldownSeconds(it).coerceAtLeast(15) } ?: 60
            return FallbackExecutionResult(
                failure = buildAllFreeModelsExhaustedClassification(
                    primaryModel = primaryModel,
                    attemptedModels = emptyList(),
                    poolModels = candidates,
                    retryAfterSeconds = waitSec
                ),
                modelUsed = primaryModel,
                primaryModel = primaryModel,
                fallbackUsed = false,
                switchedFrom = null,
                attemptedModels = emptyList(),
                totalAttempts = 0,
                allModelsExhausted = true
            )
        }

        val triedModels = LinkedHashSet<String>()
        val attemptedModels = mutableListOf<String>()
        var totalAttempts = 0
        var lastFailure: GeminiErrorClassification? = null
        var sawQuotaExhaustion = false
        var allErrorsWereNotFound = true
        var stoppedOnNonSwitchableError = false

        val boundedCandidates = healthyCandidates.take(HARD_MAX_CANDIDATES)
        for (idx in boundedCandidates.indices) {
            val candidateModel = boundedCandidates[idx]
            if (!triedModels.add(candidateModel)) continue
            if (isAborted()) break

            attemptedModels.add(candidateModel)
            val isPrimary = candidateModel == primaryModel
            val modelMaxRetries = when {
                !enableBackoff -> 0
                isPrimary -> maxPrimaryRetries.coerceIn(0, GeminiBackoffPolicy.HARD_MAX_RETRIES)
                else -> min(1, maxPrimaryRetries.coerceIn(0, GeminiBackoffPolicy.HARD_MAX_RETRIES))
            }

            var perModelAttempts = 0
            val outcome = if (modelMaxRetries > 0) {
                GeminiBackoffPolicy.executeWithBackoff(
                    maxRetries = modelMaxRetries,
                    baseDelayMs = baseDelayMs,
                    maxRetryDelayMs = maxRetryDelayMs,
                    sleep = sleep,
                    randomDouble = randomDouble,
                    isAborted = isAborted,
                    hasEmittedOutput = hasEmittedOutput,
                    classifyFailure = { it.failure },
                    onRetry = { attempt, max, delayMs, cls ->
                        onRetry(candidateModel, attempt, max, delayMs, cls)
                    }
                ) { attemptIdx ->
                    perModelAttempts += 1
                    operation(candidateModel, attemptIdx, !isPrimary)
                }
            } else {
                perModelAttempts = 1
                operation(candidateModel, 0, !isPrimary)
            }

            totalAttempts += max(perModelAttempts, outcome.attemptsMade)

            if (outcome.failure == null) {
                recordModelSuccess(candidateModel, primaryOverride = primaryModel)
                val fallbackUsed = candidateModel != primaryModel
                return FallbackExecutionResult(
                    value = outcome.value,
                    failure = null,
                    modelUsed = candidateModel,
                    primaryModel = primaryModel,
                    fallbackUsed = fallbackUsed,
                    switchedFrom = if (fallbackUsed) primaryModel else null,
                    attemptedModels = attemptedModels.toList(),
                    totalAttempts = totalAttempts,
                    allModelsExhausted = false
                )
            }

            val failure = outcome.failure
            lastFailure = failure

            if (failure.code != "GEMINI_MODEL_NOT_FOUND") {
                allErrorsWereNotFound = false
            }
            if (
                failure.httpStatus == 429 ||
                failure.quotaCategory != GeminiQuotaCategory.NONE ||
                failure.code == "GEMINI_RATE_LIMIT"
            ) {
                sawQuotaExhaustion = true
            }

            val canSwitch = shouldSwitchToNextFreeModel(
                classification = failure,
                hasEmittedOutput = hasEmittedOutput(),
                isAborted = isAborted()
            )
            if (canSwitch) {
                recordModelError(candidateModel, failure)
            } else {
                stoppedOnNonSwitchableError = true
                break
            }

            val nextModel = boundedCandidates.drop(idx + 1).firstOrNull {
                !triedModels.contains(it) && !isModelCoolingDown(it)
            } ?: break

            onModelSwitch(candidateModel, nextModel, failure)
        }

        if (
            candidates.size > 1 &&
            !stoppedOnNonSwitchableError &&
            sawQuotaExhaustion &&
            !allErrorsWereNotFound
        ) {
            val waitSec = candidates.minOfOrNull { getRemainingCooldownSeconds(it).coerceAtLeast(15) } ?: 60
            return FallbackExecutionResult(
                failure = buildAllFreeModelsExhaustedClassification(
                    primaryModel = primaryModel,
                    attemptedModels = attemptedModels,
                    poolModels = candidates,
                    retryAfterSeconds = waitSec,
                    lastFailure = lastFailure
                ),
                modelUsed = attemptedModels.lastOrNull() ?: primaryModel,
                primaryModel = primaryModel,
                fallbackUsed = false,
                switchedFrom = null,
                attemptedModels = attemptedModels.toList(),
                totalAttempts = totalAttempts,
                allModelsExhausted = true
            )
        }

        return FallbackExecutionResult(
            failure = lastFailure ?: buildAllFreeModelsExhaustedClassification(
                primaryModel = primaryModel,
                attemptedModels = attemptedModels,
                poolModels = candidates,
                retryAfterSeconds = 60
            ),
            modelUsed = attemptedModels.lastOrNull() ?: primaryModel,
            primaryModel = primaryModel,
            fallbackUsed = false,
            switchedFrom = null,
            attemptedModels = attemptedModels.toList(),
            totalAttempts = totalAttempts,
            allModelsExhausted = false
        )
    }

    companion object {
        const val DEFAULT_PRIMARY_MODEL = "gemini-3.8-flash"
        const val HARD_MAX_CANDIDATES = 4

        val FREE_TIER_MODELS: List<String> = listOf(
            "gemini-3.8-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash-lite"
        )

        private val APPROVED_FREE_TIER_MODEL_SET: Set<String> = FREE_TIER_MODELS.toSet()

        private const val MODEL_LIST_CACHE_TTL_MS = 15 * 60 * 1000L
        private const val UNAVAILABLE_MODEL_COOLDOWN_MS = 30 * 60 * 1000L
        private const val RPD_COOLDOWN_MS = 15 * 60 * 1000L
        private const val MIN_RPM_COOLDOWN_MS = 35 * 1000L
        private const val MAX_RPM_COOLDOWN_MS = 3 * 60 * 1000L

        private val DEPRECATED_OR_UNSUPPORTED_PATTERNS = listOf(
            Regex("^gemini-1(?:\\.0|\\.5)?(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.0(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash$", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash-preview", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash-lite-preview", RegexOption.IGNORE_CASE),
            Regex("-exp(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("-09-2025$", RegexOption.IGNORE_CASE),
            Regex("^chat-bison|^text-bison|^embedding-|^text-embedding-", RegexOption.IGNORE_CASE)
        )

        private val PAID_ONLY_OR_NON_TEXT_PATTERNS = listOf(
            Regex("^gemini-4(?:\\.|-|$)", RegexOption.IGNORE_CASE),
            Regex("(?:^|-)pro(?:$|-)", RegexOption.IGNORE_CASE),
            Regex("(?:^|-)ultra(?:$|-)", RegexOption.IGNORE_CASE),
            Regex("^imagen(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^veo(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^lyria(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("robotics|computer-use|deep-research|tts(?:-|$)|native-audio|live", RegexOption.IGNORE_CASE)
        )

        private val BILLING_DISABLED_TEXT_REGEX = Regex(
            "billing.*disabled|enable billing|spend cap",
            RegexOption.IGNORE_CASE
        )

        fun normalizeModelId(rawModel: String?): String {
            return rawModel.orEmpty()
                .trim()
                .removePrefix("models/")
                .removePrefix("MODELS/")
                .trim()
        }

        fun isDeprecatedOrUnsupportedModel(rawModel: String?): Boolean {
            val cleaned = normalizeModelId(rawModel)
            if (cleaned.isBlank()) return true
            return DEPRECATED_OR_UNSUPPORTED_PATTERNS.any { it.containsMatchIn(cleaned) }
        }

        fun isPaidOnlyModel(rawModel: String?): Boolean {
            val cleaned = normalizeModelId(rawModel)
            if (cleaned.isBlank()) return false
            return PAID_ONLY_OR_NON_TEXT_PATTERNS.any { it.containsMatchIn(cleaned) }
        }

        fun isApprovedFreeTierModel(rawModel: String?): Boolean {
            val cleaned = normalizeModelId(rawModel)
            if (cleaned.isBlank()) return false
            if (isDeprecatedOrUnsupportedModel(cleaned)) return false
            if (isPaidOnlyModel(cleaned)) return false
            return APPROVED_FREE_TIER_MODEL_SET.contains(cleaned)
        }

        fun resolveFallbackChain(
            primaryModel: String = DEFAULT_PRIMARY_MODEL,
            configuredFallbacks: List<String>? = null
        ): ResolvedFallbackChain {
            val primary = normalizeModelId(primaryModel).ifBlank { DEFAULT_PRIMARY_MODEL }
            if (configuredFallbacks != null && configuredFallbacks.isEmpty()) {
                return ResolvedFallbackChain(
                    primaryModel = primary,
                    chain = listOf(primary),
                    fallbackModels = emptyList(),
                    rejectedModels = emptyList()
                )
            }

            val rawPool = configuredFallbacks ?: FREE_TIER_MODELS
            val chain = mutableListOf(primary)
            val seen = LinkedHashSet<String>().apply { add(primary) }
            val rejected = mutableListOf<String>()

            for (raw in rawPool) {
                val candidate = normalizeModelId(raw)
                if (candidate.isBlank() || seen.contains(candidate)) continue
                if (!isApprovedFreeTierModel(candidate)) {
                    rejected.add(candidate)
                    continue
                }
                seen.add(candidate)
                chain.add(candidate)
                if (chain.size >= HARD_MAX_CANDIDATES) break
            }

            return ResolvedFallbackChain(
                primaryModel = primary,
                chain = chain.toList(),
                fallbackModels = chain.drop(1),
                rejectedModels = rejected.toList()
            )
        }

        fun shouldSwitchToNextFreeModel(
            classification: GeminiErrorClassification,
            hasEmittedOutput: Boolean = false,
            isAborted: Boolean = false
        ): Boolean {
            if (hasEmittedOutput || isAborted) return false
            if (classification.code == "GEMINI_AUTH_ERROR") return false
            if (classification.code == "GEMINI_BAD_REQUEST") return false
            if (classification.code == "GEMINI_QUOTA_SPEND_CAP") return false

            if (
                classification.code == "GEMINI_QUOTA_RPM" ||
                classification.code == "GEMINI_QUOTA_TPM" ||
                classification.code == "GEMINI_QUOTA_RPD" ||
                classification.code == "GEMINI_RATE_LIMIT" ||
                classification.code == "GEMINI_MODEL_NOT_FOUND" ||
                classification.code == "GEMINI_UNAVAILABLE" ||
                classification.code == "GEMINI_TIMEOUT"
            ) {
                return true
            }

            if (classification.code == "GEMINI_QUOTA_BILLING") {
                return classification.httpStatus == 429 &&
                    !BILLING_DISABLED_TEXT_REGEX.containsMatchIn(classification.upstreamMessage)
            }

            return false
        }

        fun parseSupportedFreeModelsJson(jsonBody: String): Set<String> {
            return try {
                val root = JSONObject(jsonBody)
                val models = root.optJSONArray("models") ?: return emptySet()
                val discovered = LinkedHashSet<String>()
                for (i in 0 until models.length()) {
                    val entry = models.optJSONObject(i) ?: continue
                    val id = normalizeModelId(entry.optString("name").ifBlank { entry.optString("id") })
                    if (!isApprovedFreeTierModel(id)) continue
                    val methods = entry.optJSONArray("supportedGenerationMethods")
                        ?: entry.optJSONArray("supportedActions")
                    if (methods != null && methods.length() > 0) {
                        var supportsGenerate = false
                        for (j in 0 until methods.length()) {
                            if (methods.optString(j).contains("generateContent", ignoreCase = true)) {
                                supportsGenerate = true
                                break
                            }
                        }
                        if (!supportsGenerate) continue
                    }
                    discovered.add(id)
                }
                discovered
            } catch (_: Exception) {
                emptySet()
            }
        }

        private fun formatWaitGuidance(seconds: Int): String {
            if (seconds <= 0) return "a few moments"
            if (seconds < 90) return "about ${max(15, seconds)} seconds"
            val minutes = ceil(seconds / 60.0).toInt()
            return "about $minutes minute${if (minutes == 1) "" else "s"}"
        }

        fun buildAllFreeModelsExhaustedClassification(
            primaryModel: String,
            attemptedModels: List<String>,
            poolModels: List<String>,
            retryAfterSeconds: Int = 60,
            lastFailure: GeminiErrorClassification? = null
        ): GeminiErrorClassification {
            val listed = (if (attemptedModels.isNotEmpty()) attemptedModels else poolModels)
                .ifEmpty { listOf(primaryModel) }
                .joinToString(", ")
            val waitText = formatWaitGuidance(retryAfterSeconds)
            val body =
                "All currently supported Free Tier Gemini models ($listed) have temporarily exhausted their free quotas. " +
                    "JARVIS stays strictly on Free Tier models and will never switch to paid models or activate billing. " +
                    "Please wait $waitText for the free quota window to reset (per-minute limits reset within ~60s; daily free limits reset at midnight Pacific Time) and try again."
            return GeminiErrorClassification(
                code = "ALL_FREE_MODELS_EXHAUSTED",
                quotaCategory = lastFailure?.quotaCategory?.takeIf { it != GeminiQuotaCategory.NONE }
                    ?: GeminiQuotaCategory.RPD,
                httpStatus = 429,
                grpcStatus = "RESOURCE_EXHAUSTED",
                upstreamMessage = lastFailure?.upstreamMessage?.takeIf { it.isNotBlank() } ?: body,
                retryable = true,
                retryAfterSeconds = max(15, retryAfterSeconds).toDouble(),
                quotaMetrics = lastFailure?.quotaMetrics ?: emptyList(),
                displayMessage = "[HTTP 429 • All Free Models Exhausted] $body"
            )
        }
    }
}
