package com.example.ai

import com.example.data.db.ConversationEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

enum class AiProviderId(val wireId: String, val displayLabel: String) {
    GEMINI("gemini", "Google Gemini Free"),
    GROQ("groq", "Groq Free API"),
    OPENROUTER("openrouter", "OpenRouter Free");

    companion object {
        fun fromWireId(raw: String?): AiProviderId? {
            return when (raw.orEmpty().trim().lowercase()) {
                "gemini", "google", "google-gemini" -> GEMINI
                "groq" -> GROQ
                "openrouter", "open-router" -> OPENROUTER
                else -> null
            }
        }
    }
}

data class OpenRouterCatalogVerification(
    val ok: Boolean,
    val verifiedModels: Set<String>,
    val rejectedNonZeroModels: List<String>
)

data class OpenAiProviderError(
    val provider: AiProviderId,
    val httpCode: Int,
    val code: String,
    val switchable: Boolean,
    val blockWholeProvider: Boolean,
    val retryAfterSeconds: Int,
    val message: String
)

sealed class OpenAiSseEvent {
    data class Text(val chunk: String) : OpenAiSseEvent()
    data class Error(val message: String, val httpCode: Int = 500) : OpenAiSseEvent()
    data object Done : OpenAiSseEvent()
    data object Ignore : OpenAiSseEvent()
}

data class ProviderHealthSnapshot(
    val id: AiProviderId,
    val label: String,
    val configured: Boolean,
    val pricingVerified: Boolean,
    val readyModels: Int,
    val totalModels: Int,
    val cooldownRemainingSeconds: Int,
    val statusLabel: String
)

data class MultiProviderPoolStatus(
    val zeroCostEnforced: Boolean = true,
    val activeProvider: AiProviderId = AiProviderId.GEMINI,
    val activeProviderLabel: String = AiProviderId.GEMINI.displayLabel,
    val activeModel: String = GeminiFreeModelFallbackManager.DEFAULT_PRIMARY_MODEL,
    val primaryProvider: AiProviderId = AiProviderId.GEMINI,
    val primaryModel: String = GeminiFreeModelFallbackManager.DEFAULT_PRIMARY_MODEL,
    val fallbackUsed: Boolean = false,
    val switchedFromProvider: AiProviderId? = null,
    val totalProviderSwitches: Int = 0,
    val allProvidersExhausted: Boolean = false,
    val shortestCooldownSeconds: Int = 0,
    val providers: List<ProviderHealthSnapshot> = emptyList()
)

/**
 * Strict ₹0 Zero-Cost Multi-Provider AI Router for Android.
 *
 * Coordinates automatic failover across:
 * 1. Google Gemini Free Tier (`gemini-3.8-flash` + approved Free Tier fallbacks)
 * 2. Groq Free API (strict curated open-weight allowlist)
 * 3. OpenRouter Free API (strict `:free` allowlist + mandatory live $0 pricing verification)
 *
 * Paid or unknown models are unconditionally blocked; billing is never enabled.
 */
class FreeMultiProviderRouter(
    private val geminiFallbackManager: GeminiFreeModelFallbackManager,
    private val isGeminiConfigured: () -> Boolean,
    private val isGroqConfigured: () -> Boolean,
    private val isOpenRouterConfigured: () -> Boolean,
    private val nowMs: () -> Long = { System.currentTimeMillis() },
    private val isBackendProxyEnabled: () -> Boolean = { false }
) {
    private data class ExternalModelState(
        var cooldownUntilMs: Long = 0L,
        var lastErrorCode: String? = null
    )

    private val lock = Any()
    private val externalStates = LinkedHashMap<String, ExternalModelState>()

    @Volatile
    private var backendHealthSynced: Boolean = false

    @Volatile
    private var backendReachable: Boolean = true

    @Volatile
    private var backendConfiguredProviders: Set<AiProviderId> = emptySet()

    @Volatile
    private var openRouterVerifiedModels: Set<String> = emptySet()

    @Volatile
    private var openRouterCatalogVerified: Boolean = false

    @Volatile
    private var openRouterCatalogFetchedAtMs: Long = 0L

    @Volatile
    private var groqActiveModels: Set<String>? = null

    @Volatile
    private var groqCatalogFetchedAtMs: Long = 0L

    @Volatile
    private var activeProvider: AiProviderId = AiProviderId.GEMINI

    @Volatile
    private var activeModel: String = geminiFallbackManager.getChainInfo().primaryModel

    @Volatile
    private var lastFallbackUsed: Boolean = false

    @Volatile
    private var lastSwitchedFromProvider: AiProviderId? = null

    @Volatile
    private var totalProviderSwitches: Int = 0

    private val _status = MutableStateFlow(computeSnapshot())
    val status: StateFlow<MultiProviderPoolStatus> = _status.asStateFlow()

    private fun stateKey(provider: AiProviderId, modelId: String): String = "${provider.wireId}:$modelId"

    private fun getOrCreateStateLocked(provider: AiProviderId, modelId: String): ExternalModelState {
        return externalStates.getOrPut(stateKey(provider, modelId)) { ExternalModelState() }
    }

    fun updateBackendHealth(
        reachable: Boolean,
        configuredProviders: Set<AiProviderId>,
        activeBackendProvider: AiProviderId? = null,
        activeBackendModel: String? = null
    ) {
        synchronized(lock) {
            backendHealthSynced = true
            backendReachable = reachable
            backendConfiguredProviders = configuredProviders
            if (activeBackendProvider != null) {
                activeProvider = activeBackendProvider
            } else if (configuredProviders.isNotEmpty() && !configuredProviders.contains(activeProvider)) {
                activeProvider = configuredProviders.first()
            }
            if (!activeBackendModel.isNullOrBlank()) {
                activeModel = activeBackendModel.trim()
            }
        }
        publishStatus()
    }

    private fun isEffectivelyConfigured(provider: AiProviderId): Boolean {
        val localConfigured = when (provider) {
            AiProviderId.GEMINI -> isGeminiConfigured()
            AiProviderId.GROQ -> isGroqConfigured()
            AiProviderId.OPENROUTER -> isOpenRouterConfigured()
        }
        if (localConfigured) return true
        if (!isBackendProxyEnabled()) return false
        return if (backendHealthSynced) {
            backendConfiguredProviders.contains(provider)
        } else {
            true
        }
    }

    fun isModelCoolingDown(provider: AiProviderId, modelId: String): Boolean {
        if (provider == AiProviderId.GEMINI) {
            return geminiFallbackManager.isModelCoolingDown(modelId)
        }
        return synchronized(lock) {
            val now = nowMs()
            val st = getOrCreateStateLocked(provider, modelId)
            if (st.cooldownUntilMs > 0L && now >= st.cooldownUntilMs) {
                st.cooldownUntilMs = 0L
                st.lastErrorCode = null
            }
            st.cooldownUntilMs > now
        }
    }

    fun getCooldownRemainingSeconds(provider: AiProviderId, modelId: String): Int {
        if (provider == AiProviderId.GEMINI) {
            return geminiFallbackManager.getRemainingCooldownSeconds(modelId)
        }
        return synchronized(lock) {
            val now = nowMs()
            val st = getOrCreateStateLocked(provider, modelId)
            val rem = st.cooldownUntilMs - now
            if (rem > 0L) ceil(rem / 1000.0).toInt() else 0
        }
    }

    fun isOpenRouterCatalogFresh(): Boolean {
        val fetchedAt = openRouterCatalogFetchedAtMs
        return fetchedAt > 0L && (nowMs() - fetchedAt) < CATALOG_CACHE_TTL_MS
    }

    fun isGroqCatalogFresh(): Boolean {
        val fetchedAt = groqCatalogFetchedAtMs
        return fetchedAt > 0L && (nowMs() - fetchedAt) < CATALOG_CACHE_TTL_MS
    }

    fun updateOpenRouterCatalog(verification: OpenRouterCatalogVerification) {
        synchronized(lock) {
            openRouterCatalogVerified = verification.ok
            openRouterVerifiedModels = if (verification.ok) verification.verifiedModels else emptySet()
            openRouterCatalogFetchedAtMs = nowMs()
        }
        publishStatus()
    }

    fun updateGroqCatalog(activeSet: Set<String>?) {
        synchronized(lock) {
            groqActiveModels = activeSet?.takeIf { it.isNotEmpty() }
            groqCatalogFetchedAtMs = nowMs()
        }
        publishStatus()
    }

    fun getGroqCandidates(): List<String> {
        if (!isGroqConfigured()) return emptyList()
        val active = groqActiveModels
        val base = if (!active.isNullOrEmpty()) {
            FREE_GROQ_MODELS.filter { active.contains(it) }
        } else {
            FREE_GROQ_MODELS
        }
        return base.filter { isApprovedFreeGroqModel(it) && !isModelCoolingDown(AiProviderId.GROQ, it) }
    }

    /**
     * Strict fail-closed OpenRouter candidate selection:
     * NEVER returns a model unless live $0 pricing was verified via /api/v1/models!
     */
    fun getVerifiedOpenRouterCandidates(requireVision: Boolean = false): List<String> {
        if (!isOpenRouterConfigured()) return emptyList()
        if (!openRouterCatalogVerified || openRouterVerifiedModels.isEmpty()) return emptyList()
        val base = if (requireVision) FREE_OPENROUTER_VISION_MODELS else FREE_OPENROUTER_MODELS
        return base.filter { modelId ->
            isApprovedFreeOpenRouterModel(modelId) &&
                openRouterVerifiedModels.contains(modelId) &&
                !isModelCoolingDown(AiProviderId.OPENROUTER, modelId)
        }
    }

    fun getConfiguredProviders(): List<AiProviderId> = buildList {
        if (isEffectivelyConfigured(AiProviderId.GEMINI)) add(AiProviderId.GEMINI)
        if (isEffectivelyConfigured(AiProviderId.GROQ)) add(AiProviderId.GROQ)
        if (isEffectivelyConfigured(AiProviderId.OPENROUTER)) add(AiProviderId.OPENROUTER)
    }

    fun isAllConfiguredProvidersCoolingDown(): Boolean {
        val configured = getConfiguredProviders()
        if (configured.isEmpty()) return false
        return configured.all { provider ->
            when (provider) {
                AiProviderId.GEMINI -> geminiFallbackManager.isAllModelsOnCooldown()
                AiProviderId.GROQ -> FREE_GROQ_MODELS.all { isModelCoolingDown(AiProviderId.GROQ, it) }
                AiProviderId.OPENROUTER -> FREE_OPENROUTER_MODELS.all { isModelCoolingDown(AiProviderId.OPENROUTER, it) }
            }
        }
    }

    fun recordProviderSuccess(
        provider: AiProviderId,
        modelId: String,
        primaryProviderOverride: AiProviderId? = null,
        fallbackUsedOverride: Boolean? = null
    ) {
        synchronized(lock) {
            if (isBackendProxyEnabled()) {
                backendConfiguredProviders = backendConfiguredProviders + provider
                backendReachable = true
            }
            if (provider != AiProviderId.GEMINI) {
                val st = getOrCreateStateLocked(provider, modelId)
                st.cooldownUntilMs = 0L
                st.lastErrorCode = null
            }
            val primaryProv = primaryProviderOverride ?: getConfiguredProviders().firstOrNull() ?: AiProviderId.GEMINI
            val switchedProvider = provider != primaryProv
            val usedFallback = fallbackUsedOverride ?: (switchedProvider || modelId != geminiFallbackManager.getChainInfo().primaryModel)
            if (switchedProvider && (activeProvider != provider || !lastFallbackUsed)) {
                totalProviderSwitches += 1
            }
            activeProvider = provider
            activeModel = modelId
            lastFallbackUsed = usedFallback
            lastSwitchedFromProvider = if (switchedProvider) primaryProv else null
        }
        publishStatus()
    }

    fun recordProviderError(provider: AiProviderId, modelId: String, error: OpenAiProviderError) {
        if (provider == AiProviderId.GEMINI) return
        synchronized(lock) {
            val now = nowMs()
            val modelsToCool = if (error.blockWholeProvider) {
                if (provider == AiProviderId.GROQ) FREE_GROQ_MODELS else FREE_OPENROUTER_MODELS + FREE_OPENROUTER_VISION_MODELS
            } else {
                listOf(modelId)
            }
            val cooldownMs = max(MIN_COOLDOWN_MS, min(MAX_COOLDOWN_MS, error.retryAfterSeconds * 1000L))
            for (target in modelsToCool) {
                val st = getOrCreateStateLocked(provider, target)
                st.cooldownUntilMs = max(st.cooldownUntilMs, now + cooldownMs)
                st.lastErrorCode = error.code
            }
        }
        publishStatus()
    }

    fun recordBackendMeta(
        providerWireId: String?,
        modelId: String?,
        primaryProviderWireId: String?,
        primaryModelOverride: String?,
        fallbackUsed: Boolean
    ) {
        val prov = AiProviderId.fromWireId(providerWireId) ?: AiProviderId.GEMINI
        val cleanModel = modelId?.trim().takeUnless { it.isNullOrBlank() } ?: return
        if (prov == AiProviderId.GEMINI) {
            geminiFallbackManager.recordModelSuccess(
                modelId = cleanModel,
                primaryOverride = primaryModelOverride,
                switchedFromBackend = fallbackUsed
            )
        }
        val primaryProv = AiProviderId.fromWireId(primaryProviderWireId) ?: AiProviderId.GEMINI
        recordProviderSuccess(
            provider = prov,
            modelId = cleanModel,
            primaryProviderOverride = primaryProv,
            fallbackUsedOverride = fallbackUsed || prov != primaryProv
        )
    }

    fun syncFromGeminiStatus() {
        val geminiPool = geminiFallbackManager.getPoolStatusSnapshot()
        synchronized(lock) {
            if (activeProvider == AiProviderId.GEMINI) {
                activeModel = geminiPool.lastActiveModel
                lastFallbackUsed = geminiPool.fallbackUsed
                lastSwitchedFromProvider = null
            }
        }
        publishStatus()
    }

    fun getShortestCooldownSeconds(providersToCheck: List<AiProviderId> = getConfiguredProviders()): Int {
        val waits = mutableListOf<Int>()
        for (provider in providersToCheck) {
            when (provider) {
                AiProviderId.GEMINI -> {
                    val snap = geminiFallbackManager.getPoolStatusSnapshot()
                    if (snap.shortestCooldownSeconds > 0) waits.add(snap.shortestCooldownSeconds)
                }
                AiProviderId.GROQ -> {
                    FREE_GROQ_MODELS.forEach { m ->
                        val sec = getCooldownRemainingSeconds(AiProviderId.GROQ, m)
                        if (sec > 0) waits.add(sec)
                    }
                }
                AiProviderId.OPENROUTER -> {
                    FREE_OPENROUTER_MODELS.forEach { m ->
                        val sec = getCooldownRemainingSeconds(AiProviderId.OPENROUTER, m)
                        if (sec > 0) waits.add(sec)
                    }
                }
            }
        }
        return waits.minOrNull()?.coerceAtLeast(15) ?: 60
    }

    fun resetAllCooldowns() {
        synchronized(lock) {
            externalStates.clear()
        }
        geminiFallbackManager.resetCooldowns()
        publishStatus()
    }

    fun publishStatus() {
        _status.value = computeSnapshot()
    }

    fun computeSnapshot(): MultiProviderPoolStatus = synchronized(lock) {
        val geminiPool = geminiFallbackManager.getPoolStatusSnapshot()
        val backendProxy = isBackendProxyEnabled()
        val geminiConf = isEffectivelyConfigured(AiProviderId.GEMINI)
        val groqConf = isEffectivelyConfigured(AiProviderId.GROQ)
        val openRouterConf = isEffectivelyConfigured(AiProviderId.OPENROUTER)

        val geminiSnap = ProviderHealthSnapshot(
            id = AiProviderId.GEMINI,
            label = AiProviderId.GEMINI.displayLabel,
            configured = geminiConf,
            pricingVerified = true,
            readyModels = if (geminiConf) geminiPool.availableCount else 0,
            totalModels = geminiPool.models.size,
            cooldownRemainingSeconds = if (geminiConf) geminiPool.shortestCooldownSeconds else 0,
            statusLabel = when {
                !geminiConf -> "NOT SET"
                backendProxy && !isGeminiConfigured() && !backendReachable -> "BACKEND OFFLINE"
                backendProxy && !isGeminiConfigured() && !backendHealthSynced -> "BACKEND PROXY"
                backendProxy && !isGeminiConfigured() -> "SERVER READY"
                !geminiPool.allExhausted -> "READY (${geminiPool.availableCount}/${geminiPool.models.size})"
                else -> "COOLDOWN ${geminiPool.shortestCooldownSeconds}S"
            }
        )

        val groqReady = if (groqConf) FREE_GROQ_MODELS.count { !isModelCoolingDown(AiProviderId.GROQ, it) } else 0
        val groqMinCd = if (groqConf && groqReady == 0) {
            FREE_GROQ_MODELS.minOfOrNull { getCooldownRemainingSeconds(AiProviderId.GROQ, it).coerceAtLeast(15) } ?: 45
        } else 0
        val groqSnap = ProviderHealthSnapshot(
            id = AiProviderId.GROQ,
            label = AiProviderId.GROQ.displayLabel,
            configured = groqConf,
            pricingVerified = true,
            readyModels = groqReady,
            totalModels = FREE_GROQ_MODELS.size,
            cooldownRemainingSeconds = groqMinCd,
            statusLabel = when {
                !groqConf -> "NOT SET"
                backendProxy && !isGroqConfigured() && !backendReachable -> "BACKEND OFFLINE"
                backendProxy && !isGroqConfigured() && !backendHealthSynced -> "BACKEND PROXY"
                backendProxy && !isGroqConfigured() -> "SERVER READY"
                groqReady > 0 -> "READY ($groqReady/${FREE_GROQ_MODELS.size})"
                else -> "COOLDOWN ${groqMinCd}S"
            }
        )

        val orReady = if (openRouterConf) FREE_OPENROUTER_MODELS.count { !isModelCoolingDown(AiProviderId.OPENROUTER, it) } else 0
        val orMinCd = if (openRouterConf && orReady == 0) {
            FREE_OPENROUTER_MODELS.minOfOrNull { getCooldownRemainingSeconds(AiProviderId.OPENROUTER, it).coerceAtLeast(15) } ?: 45
        } else 0
        val openRouterSnap = ProviderHealthSnapshot(
            id = AiProviderId.OPENROUTER,
            label = AiProviderId.OPENROUTER.displayLabel,
            configured = openRouterConf,
            pricingVerified = openRouterCatalogVerified || (backendProxy && openRouterConf),
            readyModels = orReady,
            totalModels = FREE_OPENROUTER_MODELS.size,
            cooldownRemainingSeconds = orMinCd,
            statusLabel = when {
                !openRouterConf -> "NOT SET"
                backendProxy && !isOpenRouterConfigured() && !backendReachable -> "BACKEND OFFLINE"
                backendProxy && !isOpenRouterConfigured() && !backendHealthSynced -> "BACKEND PROXY"
                backendProxy && !isOpenRouterConfigured() -> "SERVER \$0 READY"
                orReady > 0 && openRouterCatalogVerified -> "READY • \$0 VERIFIED"
                orReady > 0 -> "READY • \$0 CHECK ON USE"
                else -> "COOLDOWN ${orMinCd}S"
            }
        )

        val configured = getConfiguredProviders()
        val primaryProv = configured.firstOrNull() ?: AiProviderId.GEMINI
        val primaryMod = when (primaryProv) {
            AiProviderId.GEMINI -> geminiPool.primaryModel
            AiProviderId.GROQ -> FREE_GROQ_MODELS.first()
            AiProviderId.OPENROUTER -> FREE_OPENROUTER_MODELS.first()
        }
        val effectiveActiveProv = if (configured.isEmpty() || configured.contains(activeProvider)) activeProvider else primaryProv
        val effectiveActiveModel = if (configured.isEmpty() || configured.contains(activeProvider)) activeModel else primaryMod

        val providers = listOf(geminiSnap, groqSnap, openRouterSnap)
        val allExhausted = configured.isNotEmpty() && providers.filter { it.configured }.all { it.readyModels == 0 }
        val shortestWait = if (allExhausted) getShortestCooldownSeconds(configured) else 0

        MultiProviderPoolStatus(
            zeroCostEnforced = true,
            activeProvider = effectiveActiveProv,
            activeProviderLabel = effectiveActiveProv.displayLabel,
            activeModel = effectiveActiveModel,
            primaryProvider = primaryProv,
            primaryModel = primaryMod,
            fallbackUsed = lastFallbackUsed || (effectiveActiveProv == AiProviderId.GEMINI && geminiPool.fallbackUsed),
            switchedFromProvider = lastSwitchedFromProvider,
            totalProviderSwitches = totalProviderSwitches + geminiPool.totalFallbackSwitches,
            allProvidersExhausted = allExhausted,
            shortestCooldownSeconds = shortestWait,
            providers = providers
        )
    }

    companion object {
        const val GROQ_BASE_URL = "https://api.groq.com/openai/v1"
        const val OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
        const val OPENROUTER_REFERER = "https://jarvis-ai.local"

        private const val CATALOG_CACHE_TTL_MS = 15 * 60 * 1000L
        private const val MIN_COOLDOWN_MS = 35 * 1000L
        private const val MAX_COOLDOWN_MS = 30 * 60 * 1000L

        val FREE_GROQ_MODELS: List<String> = listOf(
            "openai/gpt-oss-120b",
            "llama-3.3-70b-versatile",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b",
            "llama-3.1-8b-instant"
        )

        val FREE_OPENROUTER_MODELS: List<String> = listOf(
            "nvidia/nemotron-3-ultra-550b-a55b:free",
            "google/gemma-4-31b-it:free",
            "nvidia/nemotron-3.5-lightning:free",
            "cohere/north-mini-code:free",
            "liquid/lfm-3-1.7b:free",
            "openrouter/free"
        )

        val FREE_OPENROUTER_VISION_MODELS: List<String> = listOf(
            "nvidia/nemotron-3.5-super-vl:free",
            "google/gemma-4-31b-it:free",
            "google/gemma-4-26b-a4b-it:free",
            "openrouter/free"
        )

        private val APPROVED_GROQ_SET: Set<String> = FREE_GROQ_MODELS.toSet()
        private val APPROVED_OPENROUTER_SET: Set<String> = (FREE_OPENROUTER_MODELS + FREE_OPENROUTER_VISION_MODELS).toSet()

        private val GROQ_BLOCKED_REGEX = Regex(
            "whisper|playai|tts|guard|compound|orpheus|embedding",
            RegexOption.IGNORE_CASE
        )

        private val PLACEHOLDER_PREFIX_REGEX = Regex("^(?:your_|my_|placeholder|replace_me)", RegexOption.IGNORE_CASE)

        fun isConfiguredKey(rawKey: String?): Boolean {
            val cleaned = rawKey.orEmpty().trim()
            if (cleaned.isBlank()) return false
            if (cleaned.equals("UNSET", ignoreCase = true) ||
                cleaned.equals("NONE", ignoreCase = true) ||
                cleaned == "\"\""
            ) return false
            if (PLACEHOLDER_PREFIX_REGEX.containsMatchIn(cleaned)) return false
            return true
        }

        fun isApprovedFreeGroqModel(modelId: String?): Boolean {
            val cleaned = modelId.orEmpty().trim()
            if (cleaned.isBlank()) return false
            if (GROQ_BLOCKED_REGEX.containsMatchIn(cleaned)) return false
            return APPROVED_GROQ_SET.contains(cleaned)
        }

        fun isApprovedFreeOpenRouterModel(modelId: String?): Boolean {
            val cleaned = modelId.orEmpty().trim()
            if (cleaned.isBlank()) return false
            if (cleaned != "openrouter/free" && !cleaned.endsWith(":free")) return false
            return APPROVED_OPENROUTER_SET.contains(cleaned)
        }

        fun isApprovedFreeModelForProvider(provider: AiProviderId, modelId: String?): Boolean {
            return when (provider) {
                AiProviderId.GEMINI -> GeminiFreeModelFallbackManager.isApprovedFreeTierModel(modelId)
                AiProviderId.GROQ -> isApprovedFreeGroqModel(modelId)
                AiProviderId.OPENROUTER -> isApprovedFreeOpenRouterModel(modelId)
            }
        }

        private fun parsePriceValue(raw: Any?): Double? {
            if (raw == null || raw === JSONObject.NULL) return null
            return when (raw) {
                is Number -> raw.toDouble().takeIf { it.isFinite() } ?: Double.NaN
                is String -> raw.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull() ?: Double.NaN
                else -> Double.NaN
            }
        }

        /**
         * Strictly verifies $0 pricing across prompt, completion, and any auxiliary fee fields.
         * Fails closed on missing, negative, dynamic (-1), positive, or non-numeric pricing.
         */
        fun isPricingStrictlyZero(pricing: JSONObject?): Boolean {
            if (pricing == null) return false
            val promptCost = parsePriceValue(pricing.opt("prompt"))
            val completionCost = parsePriceValue(pricing.opt("completion"))
            if (promptCost != 0.0 || completionCost != 0.0) return false

            val auxiliaryFields = listOf(
                "request",
                "image",
                "web_search",
                "internal_reasoning",
                "input_cache_read",
                "input_cache_write",
                "audio"
            )
            for (field in auxiliaryFields) {
                if (pricing.has(field) && !pricing.isNull(field)) {
                    val value = parsePriceValue(pricing.opt(field))
                    if (value != 0.0) return false
                }
            }
            return true
        }

        fun parseVerifiedOpenRouterCatalogJson(rawJson: String): OpenRouterCatalogVerification {
            return try {
                val root = JSONObject(rawJson)
                val data = root.optJSONArray("data")
                    ?: return OpenRouterCatalogVerification(false, emptySet(), emptyList())
                val verified = LinkedHashSet<String>()
                val rejected = mutableListOf<String>()
                for (i in 0 until data.length()) {
                    val item = data.optJSONObject(i) ?: continue
                    val id = item.optString("id").trim()
                    if (id.isBlank() || !isApprovedFreeOpenRouterModel(id)) continue
                    if (isPricingStrictlyZero(item.optJSONObject("pricing"))) {
                        verified.add(id)
                    } else {
                        rejected.add(id)
                    }
                }
                OpenRouterCatalogVerification(true, verified, rejected)
            } catch (_: Exception) {
                OpenRouterCatalogVerification(false, emptySet(), emptyList())
            }
        }

        fun parseActiveGroqCatalogJson(rawJson: String): Set<String> {
            return try {
                val root = JSONObject(rawJson)
                val data = root.optJSONArray("data") ?: return emptySet()
                val active = LinkedHashSet<String>()
                for (i in 0 until data.length()) {
                    val item = data.optJSONObject(i) ?: continue
                    if (!item.optBoolean("active", true)) continue
                    val id = item.optString("id").trim()
                    if (isApprovedFreeGroqModel(id)) {
                        active.add(id)
                    }
                }
                active
            } catch (_: Exception) {
                emptySet()
            }
        }

        fun buildOpenAiMessagesJson(
            systemInstruction: String,
            history: List<ConversationEntity>,
            prompt: String,
            imageBase64: String? = null,
            imageMimeType: String? = null
        ): JSONArray {
            val messages = JSONArray()
            val cleanSystem = systemInstruction.trim()
            if (cleanSystem.isNotEmpty()) {
                messages.put(JSONObject().apply {
                    put("role", "system")
                    put("content", cleanSystem)
                })
            }

            val turns = AiRepository.normalizeHistoryMessages(history)
            for ((role, text) in turns) {
                val openAiRole = if (role == "model") "assistant" else "user"
                messages.put(JSONObject().apply {
                    put("role", openAiRole)
                    put("content", text)
                })
            }

            val cleanPrompt = prompt.trim()
            if (!imageBase64.isNullOrBlank() && !imageMimeType.isNullOrBlank() && imageMimeType.startsWith("image/")) {
                val dataUrl = "data:$imageMimeType;base64,$imageBase64"
                messages.put(JSONObject().apply {
                    put("role", "user")
                    put("content", JSONArray().apply {
                        put(JSONObject().apply {
                            put("type", "text")
                            put("text", cleanPrompt.ifBlank { "Analyze this image accurately." })
                        })
                        put(JSONObject().apply {
                            put("type", "image_url")
                            put("image_url", JSONObject().apply { put("url", dataUrl) })
                        })
                    })
                })
            } else if (cleanPrompt.isNotEmpty()) {
                val lastObj = if (messages.length() > 0) messages.optJSONObject(messages.length() - 1) else null
                if (lastObj != null && lastObj.optString("role") == "user" && lastObj.opt("content") is String) {
                    lastObj.put("content", "${lastObj.optString("content")}\n\n$cleanPrompt")
                } else {
                    messages.put(JSONObject().apply {
                        put("role", "user")
                        put("content", cleanPrompt)
                    })
                }
            }
            return messages
        }

        fun parseOpenAiSseLine(rawLine: String): OpenAiSseEvent {
            val line = rawLine.trim()
            if (line.isEmpty() || line.startsWith(":") || !line.startsWith("data:")) {
                return OpenAiSseEvent.Ignore
            }
            val payload = line.removePrefix("data:").trim()
            if (payload.isEmpty()) return OpenAiSseEvent.Ignore
            if (payload == "[DONE]") return OpenAiSseEvent.Done
            return try {
                val root = JSONObject(payload)
                val errObj = root.optJSONObject("error")
                if (errObj != null) {
                    return OpenAiSseEvent.Error(
                        message = errObj.optString("message").ifBlank { payload },
                        httpCode = errObj.optInt("code", 500)
                    )
                }
                val chunk = root.optJSONArray("choices")
                    ?.optJSONObject(0)
                    ?.optJSONObject("delta")
                    ?.optString("content")
                    .orEmpty()
                if (chunk.isNotEmpty()) OpenAiSseEvent.Text(chunk) else OpenAiSseEvent.Ignore
            } catch (_: Exception) {
                OpenAiSseEvent.Ignore
            }
        }

        fun classifyOpenAiHttpError(
            provider: AiProviderId,
            httpCode: Int,
            rawBody: String,
            retryAfterHeader: String? = null
        ): OpenAiProviderError {
            val parsedMessage = try {
                val obj = JSONObject(rawBody)
                obj.optJSONObject("error")?.optString("message")
                    ?.takeIf { it.isNotBlank() }
                    ?: obj.optString("message").takeIf { it.isNotBlank() }
                    ?: rawBody.take(300)
            } catch (_: Exception) {
                rawBody.take(300)
            }.ifBlank { "HTTP $httpCode from ${provider.displayLabel}" }

            val lower = parsedMessage.lowercase()
            val retryAfterSec = retryAfterHeader?.trim()?.toDoubleOrNull()?.let { ceil(it).toInt() }

            return when {
                httpCode == 429 -> {
                    val isDaily = Regex("per day|daily|rpd|day limit").containsMatchIn(lower)
                    OpenAiProviderError(
                        provider = provider,
                        httpCode = 429,
                        code = if (isDaily) "PROVIDER_QUOTA_RPD" else "PROVIDER_RATE_LIMIT",
                        switchable = true,
                        blockWholeProvider = false,
                        retryAfterSeconds = retryAfterSec ?: if (isDaily) 900 else 45,
                        message = parsedMessage
                    )
                }
                httpCode == 402 || Regex("insufficient credits|payment required|add credits").containsMatchIn(lower) -> {
                    OpenAiProviderError(
                        provider = provider,
                        httpCode = 402,
                        code = "PROVIDER_BILLING_REQUIRED",
                        switchable = true,
                        blockWholeProvider = true,
                        retryAfterSeconds = 1800,
                        message = "${provider.displayLabel} requested paid credits; blocked by ₹0 zero-cost guard."
                    )
                }
                httpCode == 401 || httpCode == 403 -> {
                    OpenAiProviderError(
                        provider = provider,
                        httpCode = httpCode,
                        code = "PROVIDER_AUTH_ERROR",
                        switchable = true,
                        blockWholeProvider = true,
                        retryAfterSeconds = 600,
                        message = parsedMessage
                    )
                }
                httpCode == 404 || httpCode == 410 || Regex("model.*not found|decommissioned").containsMatchIn(lower) -> {
                    OpenAiProviderError(
                        provider = provider,
                        httpCode = httpCode,
                        code = "PROVIDER_MODEL_UNAVAILABLE",
                        switchable = true,
                        blockWholeProvider = false,
                        retryAfterSeconds = 1800,
                        message = parsedMessage
                    )
                }
                httpCode in listOf(500, 502, 503, 529) -> {
                    OpenAiProviderError(
                        provider = provider,
                        httpCode = httpCode,
                        code = "PROVIDER_UNAVAILABLE",
                        switchable = true,
                        blockWholeProvider = false,
                        retryAfterSeconds = retryAfterSec ?: 45,
                        message = parsedMessage
                    )
                }
                else -> OpenAiProviderError(
                    provider = provider,
                    httpCode = httpCode,
                    code = if (httpCode == 400) "PROVIDER_BAD_REQUEST" else "PROVIDER_ERROR",
                    switchable = httpCode != 400,
                    blockWholeProvider = false,
                    retryAfterSeconds = 45,
                    message = parsedMessage
                )
            }
        }

        fun buildAllProvidersUnavailableMessage(
            attemptedProviders: List<AiProviderId>,
            waitSeconds: Int
        ): String {
            val names = attemptedProviders.ifEmpty { AiProviderId.entries }
                .joinToString(", ") { it.displayLabel }
            val waitText = if (waitSeconds < 90) {
                "about ${max(15, waitSeconds)} seconds"
            } else {
                val mins = ceil(waitSeconds / 60.0).toInt()
                "about $mins minute${if (mins == 1) "" else "s"}"
            }
            return "[HTTP 429 • All Free Providers Unavailable] All configured free AI providers ($names) are temporarily unavailable or have reached their free tier limits. " +
                "JARVIS enforces a strict ₹0 zero-cost guard and will never switch to paid models or activate billing. " +
                "Please try again in $waitText."
        }
    }
}
