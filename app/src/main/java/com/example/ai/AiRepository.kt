package com.example.ai

import android.util.Log
import com.example.BuildConfig
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.data.db.ConversationEntity
import com.example.data.db.ExtractedMemoryCandidate
import com.example.data.db.MemoryDeduplicator
import com.example.data.db.MemoryEntity
import com.example.productivity.ParsedReminder
import com.example.productivity.ReminderParser
import com.example.system.SystemTelemetry
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.InterruptedIOException
import java.net.SocketTimeoutException
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.ceil

sealed class SseLineEvent {
    data class Text(val chunk: String) : SseLineEvent()
    data class Meta(
        val intent: String?,
        val language: String?,
        val model: String? = null,
        val primaryModel: String? = null,
        val fallbackUsed: Boolean = false,
        val provider: String? = null,
        val providerLabel: String? = null,
        val primaryProvider: String? = null,
        val switchedFromProvider: String? = null
    ) : SseLineEvent()
    data class Error(val message: String, val isPreFormatted: Boolean = false) : SseLineEvent()
    data object Done : SseLineEvent()
    data object Ignore : SseLineEvent()
}

data class LastAiResponseMetadata(
    val provider: String,
    val model: String,
    val ttftMs: Long,
    val totalMs: Long
)

data class WeatherCityResult(
    val name: String,
    val region: String,
    val country: String,
    val latitude: Double,
    val longitude: Double
) {
    val displayLabel: String
        get() = listOf(name, region, country)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(", ")
}

class AiRepository(
    configuredFallbackModels: List<String>? = null,
    private val backendUrlOverride: String? = null,
    private val runtimeBackendUrlProvider: (() -> String)? = null,
    private val backendFirstTokenTimeoutMs: Long = BACKEND_FIRST_TOKEN_TIMEOUT_MS
) {
    private val TAG = "AiRepository"

    private val client = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS)
        .build()

    private val backendFastClient = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(8, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS)
        .build()

    private val backendHealthClient = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(4, TimeUnit.SECONDS)
        .writeTimeout(3, TimeUnit.SECONDS)
        .build()

    private val discoveryClient = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .writeTimeout(3, TimeUnit.SECONDS)
        .build()

    val fallbackManager = GeminiFreeModelFallbackManager(
        primaryModelProvider = { modelName },
        configuredFallbacks = configuredFallbackModels
    )

    val multiProviderRouter = FreeMultiProviderRouter(
        geminiFallbackManager = fallbackManager,
        isGeminiConfigured = { hasGeminiKey },
        isGroqConfigured = { hasGroqKey },
        isOpenRouterConfigured = { hasOpenRouterKey },
        isBackendProxyEnabled = { usesBackendProxy }
    )

    val telemetryTracker = RequestTelemetryTracker()

    @Volatile
    private var modelCatalogCache: ModelCatalogCache? = null

    private val _activeStreamStatus = MutableStateFlow<String?>(null)
    val activeStreamStatus: StateFlow<String?> = _activeStreamStatus.asStateFlow()

    private val _lastResponseMetadata = MutableStateFlow<LastAiResponseMetadata?>(null)
    val lastResponseMetadata: StateFlow<LastAiResponseMetadata?> = _lastResponseMetadata.asStateFlow()

    @Volatile
    private var backendCircuitOpenUntilMs: Long = 0L

    private val _backendCircuitRemainingSec = MutableStateFlow(0)
    val backendCircuitRemainingSec: StateFlow<Int> = _backendCircuitRemainingSec.asStateFlow()

    val freeModelPoolStatus: StateFlow<FreeModelPoolStatus>
        get() = fallbackManager.poolStatus

    val multiProviderStatus: StateFlow<MultiProviderPoolStatus>
        get() = multiProviderRouter.status

    // Protective cooldown for optional background Gemini helpers (never blocks explicit user chat)
    @Volatile
    private var backgroundQuotaCooldownUntilMs: Long = 0L

    private val briefingMutex = Mutex()
    private var cachedBriefingKey: String = ""
    private var cachedBriefingResult: Pair<String, String>? = null
    private var cachedBriefingAtMs: Long = 0L

    fun attachModelCatalogCache(cache: ModelCatalogCache) {
        modelCatalogCache = cache
        cache.getCachedGeminiSupportedModels()?.let { models ->
            fallbackManager.restoreCachedDiscovery(models)
        }
        multiProviderRouter.restoreCachedCatalogs(
            groqModels = cache.getCachedGroqModels(),
            openRouterModels = cache.getCachedOpenRouterModels()
        )
        backendCircuitOpenUntilMs = cache.getBackendCircuitOpenUntilMs()
        _backendCircuitRemainingSec.value = getBackendCircuitRemainingSeconds()
    }

    fun isBackendCircuitOpen(): Boolean {
        val remMs = backendCircuitOpenUntilMs - System.currentTimeMillis()
        val open = remMs > 0L
        _backendCircuitRemainingSec.value = if (open) ceil(remMs / 1000.0).toInt() else 0
        return open
    }

    fun getBackendCircuitRemainingSeconds(): Int {
        val remMs = backendCircuitOpenUntilMs - System.currentTimeMillis()
        return if (remMs > 0L) ceil(remMs / 1000.0).toInt() else 0
    }

    fun openBackendCircuit(durationMs: Long = BACKEND_CIRCUIT_DURATION_MS) {
        val until = System.currentTimeMillis() + durationMs
        backendCircuitOpenUntilMs = until
        modelCatalogCache?.setBackendCircuitOpenUntilMs(until)
        _backendCircuitRemainingSec.value = ceil(durationMs / 1000.0).toInt()
    }

    fun resetBackendCircuit() {
        backendCircuitOpenUntilMs = 0L
        modelCatalogCache?.setBackendCircuitOpenUntilMs(0L)
        _backendCircuitRemainingSec.value = 0
    }

    suspend fun warmModelCatalogsInBackground(forceRefresh: Boolean = false) = withContext(Dispatchers.IO) {
        if (hasGeminiKey && (forceRefresh || !fallbackManager.isDiscoveryFresh())) {
            val raw = fetchDirectSupportedModelsJson()
            if (!raw.isNullOrBlank()) {
                val parsed = GeminiFreeModelFallbackManager.parseSupportedFreeModelsJson(raw)
                if (parsed.isNotEmpty()) {
                    fallbackManager.restoreCachedDiscovery(parsed)
                    val validatedDefault = if (parsed.contains(modelName)) modelName else parsed.first()
                    modelCatalogCache?.saveGeminiSupportedModels(parsed, validatedDefault)
                }
            }
        }
        if (hasGroqKey && (forceRefresh || !multiProviderRouter.isGroqCatalogFresh())) {
            ensureGroqCatalogFresh()
        }
        if (hasOpenRouterKey && (forceRefresh || !multiProviderRouter.isOpenRouterCatalogFresh())) {
            ensureOpenRouterCatalogFresh()
        }
    }

    private fun recordQuotaSuccess() {
        backgroundQuotaCooldownUntilMs = 0L
    }

    private fun recordQuotaError(classification: GeminiErrorClassification) {
        val now = System.currentTimeMillis()
        when (classification.quotaCategory) {
            GeminiQuotaCategory.RPD,
            GeminiQuotaCategory.BILLING,
            GeminiQuotaCategory.SPEND_CAP -> {
                backgroundQuotaCooldownUntilMs = maxOf(backgroundQuotaCooldownUntilMs, now + 5 * 60 * 1000L)
            }
            GeminiQuotaCategory.RPM,
            GeminiQuotaCategory.TPM,
            GeminiQuotaCategory.GENERIC_RATE_LIMIT -> {
                val retryMs = classification.retryAfterSeconds?.let { ceil(it * 1000.0).toLong() } ?: 0L
                val pauseMs = retryMs.coerceIn(30_000L, 180_000L)
                backgroundQuotaCooldownUntilMs = maxOf(backgroundQuotaCooldownUntilMs, now + pauseMs)
            }
            GeminiQuotaCategory.NONE -> Unit
        }
    }

    private fun isBackgroundQuotaCooldownActive(): Boolean {
        return System.currentTimeMillis() < backgroundQuotaCooldownUntilMs ||
            (!usesBackendProxy && multiProviderRouter.isAllConfiguredProvidersCoolingDown())
    }

    private fun fetchDirectSupportedModelsJson(): String? {
        if (usesBackendProxy || !hasGeminiKey) return null
        return try {
            val req = Request.Builder()
                .url("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100")
                .addHeader("x-goog-api-key", apiKey)
                .get()
                .build()
            discoveryClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) resp.body?.string() else null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun isThinkingCompatibilityError(httpCode: Int, errorBody: String): Boolean {
        return httpCode == 400 &&
            Regex("thinking|budget|level|thinkingConfig|unsupported", RegexOption.IGNORE_CASE)
                .containsMatchIn(errorBody)
    }

    private fun extractBackendFormattedError(bodyStr: String): String? {
        return try {
            val obj = JSONObject(bodyStr)
            obj.optString("error").takeIf { it.isNotBlank() && !it.trimStart().startsWith("{") }
        } catch (_: Exception) {
            null
        }
    }

    // Gemini API Key injected securely via Secrets Gradle Plugin from AI Studio Secrets
    private val apiKey: String
        get() = try {
            BuildConfig.GEMINI_API_KEY.trim().takeUnless { isUnsetSentinel(it) }.orEmpty()
        } catch (_: Exception) {
            ""
        }

    val modelName: String
        get() = try {
            resolveActiveModel(BuildConfig.GEMINI_MODEL)
        } catch (_: Exception) {
            DEFAULT_MODEL
        }

    val backendUrl: String
        get() = try {
            val runtime = runtimeBackendUrlProvider?.invoke().orEmpty().trim()
            val raw = when {
                !backendUrlOverride.isNullOrBlank() -> backendUrlOverride
                runtime.isNotBlank() && !isUnsetSentinel(runtime) -> runtime
                else -> BuildConfig.BACKEND_URL
            }
            raw.trim().takeUnless { isUnsetSentinel(it) }.orEmpty().trimEnd('/')
        } catch (_: Exception) {
            ""
        }

    private val appAccessToken: String
        get() = try {
            BuildConfig.APP_ACCESS_TOKEN.trim().takeUnless { isUnsetSentinel(it) }.orEmpty()
        } catch (_: Exception) {
            ""
        }

    private val groqApiKey: String
        get() = try {
            BuildConfig.GROQ_API_KEY.trim().takeIf { FreeMultiProviderRouter.isConfiguredKey(it) }.orEmpty()
        } catch (_: Exception) {
            ""
        }

    private val openRouterApiKey: String
        get() = try {
            BuildConfig.OPENROUTER_API_KEY.trim().takeIf { FreeMultiProviderRouter.isConfiguredKey(it) }.orEmpty()
        } catch (_: Exception) {
            ""
        }

    private fun isUnsetSentinel(value: String): Boolean {
        return value.isBlank() ||
            value.equals("UNSET", ignoreCase = true) ||
            value.equals("NONE", ignoreCase = true) ||
            value == "\"\""
    }

    val usesBackendProxy: Boolean
        get() = backendUrl.isNotBlank()

    val hasGeminiKey: Boolean
        get() = FreeMultiProviderRouter.isConfiguredKey(apiKey)

    val hasGroqKey: Boolean
        get() = groqApiKey.isNotBlank()

    val hasOpenRouterKey: Boolean
        get() = openRouterApiKey.isNotBlank()

    val hasDirectApiKey: Boolean
        get() = hasGeminiKey || hasGroqKey || hasOpenRouterKey

    val hasRealApiKey: Boolean
        get() = usesBackendProxy || hasDirectApiKey

    suspend fun syncBackendHealth(): Boolean = withContext(Dispatchers.IO) {
        if (!usesBackendProxy) return@withContext false
        try {
            val req = Request.Builder()
                .url("${backendUrl}/api/health")
                .addHeader("Accept", "application/json")
                .get()
                .build()
            backendHealthClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    multiProviderRouter.updateBackendHealth(
                        reachable = false,
                        configuredProviders = emptySet()
                    )
                    return@withContext false
                }
                val raw = resp.body?.string().orEmpty()
                val obj = JSONObject(raw)
                val providers = buildSet {
                    if (obj.optBoolean("geminiConfigured", false)) add(AiProviderId.GEMINI)
                    if (obj.optBoolean("groqConfigured", false)) add(AiProviderId.GROQ)
                    if (obj.optBoolean("openrouterConfigured", false)) add(AiProviderId.OPENROUTER)
                }
                val activeProv = AiProviderId.fromWireId(obj.optString("activeProvider"))
                val activeMod = obj.optString("activeModel")
                    .ifBlank { obj.optString("model") }
                    .trim()
                    .takeIf { it.isNotBlank() }
                val reachable = obj.optString("status") == "ok" || resp.isSuccessful
                if (reachable) {
                    resetBackendCircuit()
                }
                multiProviderRouter.updateBackendHealth(
                    reachable = reachable,
                    configuredProviders = providers,
                    activeBackendProvider = activeProv,
                    activeBackendModel = activeMod
                )
                reachable
            }
        } catch (e: Exception) {
            Log.w(TAG, "Backend health sync failed: ${e.message}")
            multiProviderRouter.updateBackendHealth(
                reachable = false,
                configuredProviders = emptySet()
            )
            false
        }
    }

    fun generateStreamingResponse(
        prompt: String,
        agent: JarvisAgent,
        language: JarvisLanguage,
        telemetry: SystemTelemetry?,
        memories: List<MemoryEntity> = emptyList(),
        history: List<ConversationEntity> = emptyList(),
        enableWebSearch: Boolean = (agent == JarvisAgent.VERONICA_RESEARCH),
        customSystemPromptOverride: String? = null,
        retrievedConversationSnippets: List<String> = emptyList(),
        analysisOverride: BrainAnalysis? = null,
        preferBetterModel: Boolean = false,
        localRoutingMs: Long = 0L
    ): Flow<String> {
        val validHistory = history.filter { it.text.isNotBlank() && !isErrorConversation(it) }
        val analysis = analysisOverride ?: JarvisBrainEngine.analyzePrompt(
            prompt = prompt,
            selectedLanguage = language,
            hasHistory = validHistory.isNotEmpty()
        )
        val earlierDigest = if (validHistory.size > JarvisBrainEngine.MAX_RECENT_TURNS) {
            JarvisBrainEngine.buildContextDigest(validHistory.dropLast(JarvisBrainEngine.MAX_RECENT_TURNS))
        } else {
            ""
        }
        val recentHistory = validHistory.takeLast(JarvisBrainEngine.MAX_RECENT_TURNS)
        val calibratedTemp = JarvisBrainEngine.computeTemperature(analysis.intent, prompt)
        val preferFastTier = !preferBetterModel && !JarvisBrainEngine.isHeavyReasoningIntent(analysis.intent)
        val preferredGeminiModel = JarvisBrainEngine.resolvePreferredGeminiModel(
            analysis = analysis,
            configuredModel = modelName,
            preferBetterModel = preferBetterModel,
            supportedModels = fallbackManager.getCachedDiscovery()
        )

        val systemInstructionText = buildSystemInstruction(
            agent = agent,
            language = language,
            telemetry = telemetry,
            memories = memories,
            customSystemPromptOverride = customSystemPromptOverride,
            queryPrompt = prompt,
            analysis = analysis,
            earlierDigest = earlierDigest,
            retrievedConversationSnippets = retrievedConversationSnippets
        )
        val promptCharCount = systemInstructionText.length + prompt.length +
            recentHistory.sumOf { it.text.length }

        val directFlowProvider: () -> Flow<String> = {
            streamDirectMultiProviderWithFallback(
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                prompt = prompt,
                allowNonGeminiFallback = true,
                temperature = calibratedTemp,
                preferredGeminiModel = preferredGeminiModel,
                preferFastGroq = preferFastTier,
                localRoutingMs = localRoutingMs,
                promptCharCount = promptCharCount
            ) { candidateModel, includeThinking ->
                buildDirectGeminiRequest(
                    prompt = prompt,
                    systemInstructionText = systemInstructionText,
                    history = recentHistory,
                    thinkingBudget = if (includeThinking) analysis.thinkingBudget else 0,
                    includeThinkingConfig = includeThinking,
                    targetModel = candidateModel,
                    temperature = calibratedTemp
                )
            }
        }

        if (usesBackendProxy) {
            if (isBackendCircuitOpen() && hasDirectApiKey) {
                Log.w(TAG, "Backend circuit breaker active (${getBackendCircuitRemainingSeconds()}s left); routing straight to direct fast tier.")
                return directFlowProvider()
            }
            val request = buildBackendRequest(
                prompt = prompt,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                enableWebSearch = enableWebSearch || agent == JarvisAgent.VERONICA_RESEARCH,
                preferredLanguage = language.name
            )
            val fallbackSpec = BackendStreamFallbackSpec(
                prompt = prompt,
                history = recentHistory,
                languageInstruction = buildBackendLanguageDirective(agent, language),
                candidateProviders = listOf("groq", null)
            )
            return streamBackendRequest(
                request = request,
                fallbackSpec = fallbackSpec,
                directFallbackFlow = if (hasDirectApiKey) directFlowProvider else null,
                promptPreview = prompt,
                promptChars = promptCharCount,
                localRoutingMs = localRoutingMs
            )
        }
        return directFlowProvider()
    }

    fun generateMultimodalStreamingResponse(
        prompt: String,
        fileBase64: String,
        mimeType: String,
        fileName: String,
        agent: JarvisAgent,
        language: JarvisLanguage,
        telemetry: SystemTelemetry?,
        memories: List<MemoryEntity> = emptyList(),
        history: List<ConversationEntity> = emptyList(),
        enableWebSearch: Boolean = (agent == JarvisAgent.VERONICA_RESEARCH),
        customSystemPromptOverride: String? = null,
        retrievedConversationSnippets: List<String> = emptyList(),
        preferBetterModel: Boolean = false,
        localRoutingMs: Long = 0L
    ): Flow<String> {
        val approxBytes = (fileBase64.length * 3) / 4
        if (approxBytes > MAX_ATTACHMENT_BYTES) {
            return callbackFlow {
                trySend("Attachment \"$fileName\" exceeds the 4 MB processing limit.")
                close()
                awaitClose {}
            }
        }
        val effectivePrompt = prompt.ifBlank {
            "Please analyze the attached file ($fileName) and summarize its key details."
        }
        val validHistory = history.filter { it.text.isNotBlank() && !isErrorConversation(it) }
        val analysis = JarvisBrainEngine.analyzePrompt(
            prompt = effectivePrompt,
            selectedLanguage = language,
            hasHistory = validHistory.isNotEmpty()
        )
        val recentHistory = validHistory.takeLast(JarvisBrainEngine.MAX_RECENT_TURNS)
        val preferredGeminiModel = JarvisBrainEngine.resolvePreferredGeminiModel(
            analysis = analysis,
            configuredModel = modelName,
            preferBetterModel = preferBetterModel,
            supportedModels = fallbackManager.getCachedDiscovery()
        )

        val systemInstructionText = buildSystemInstruction(
            agent = agent,
            language = language,
            telemetry = telemetry,
            memories = memories,
            customSystemPromptOverride = customSystemPromptOverride,
            queryPrompt = effectivePrompt,
            analysis = analysis,
            retrievedConversationSnippets = retrievedConversationSnippets
        )
        val promptCharCount = systemInstructionText.length + effectivePrompt.length +
            recentHistory.sumOf { it.text.length }
        val isImageAttachment = mimeType.startsWith("image/", ignoreCase = true)
        val directFlowProvider: () -> Flow<String> = {
            streamDirectMultiProviderWithFallback(
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                prompt = effectivePrompt,
                imageBase64 = if (isImageAttachment) fileBase64 else null,
                imageMimeType = if (isImageAttachment) mimeType else null,
                allowNonGeminiFallback = isImageAttachment,
                temperature = 0.35,
                preferredGeminiModel = preferredGeminiModel,
                preferFastGroq = false,
                localRoutingMs = localRoutingMs,
                promptCharCount = promptCharCount
            ) { candidateModel, includeThinking ->
                buildMultimodalDirectGeminiRequest(
                    prompt = effectivePrompt,
                    fileBase64 = fileBase64,
                    mimeType = mimeType,
                    systemInstructionText = systemInstructionText,
                    history = recentHistory,
                    includeThinkingConfig = includeThinking,
                    targetModel = candidateModel
                )
            }
        }
        if (usesBackendProxy && !(isBackendCircuitOpen() && hasDirectApiKey)) {
            val request = buildMultimodalBackendRequest(
                prompt = effectivePrompt,
                fileBase64 = fileBase64,
                mimeType = mimeType,
                fileName = fileName,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                enableWebSearch = enableWebSearch || agent == JarvisAgent.VERONICA_RESEARCH,
                preferredLanguage = language.name
            )
            val fallbackSpec = BackendStreamFallbackSpec(
                prompt = effectivePrompt,
                history = recentHistory,
                languageInstruction = buildBackendLanguageDirective(agent, language),
                imageBase64 = if (isImageAttachment) fileBase64 else null,
                imageMimeType = if (isImageAttachment) mimeType else null,
                candidateProviders = if (isImageAttachment) listOf("openrouter", null) else emptyList()
            )
            return streamBackendRequest(
                request = request,
                fallbackSpec = fallbackSpec,
                directFallbackFlow = if (hasDirectApiKey) directFlowProvider else null,
                promptPreview = effectivePrompt,
                promptChars = promptCharCount,
                localRoutingMs = localRoutingMs
            )
        }
        return directFlowProvider()
    }

    private data class BackendStreamFallbackSpec(
        val prompt: String,
        val history: List<ConversationEntity>,
        val languageInstruction: String,
        val imageBase64: String? = null,
        val imageMimeType: String? = null,
        val candidateProviders: List<String?> = listOf("groq", "openrouter", null)
    )

    private fun buildBackendLanguageDirective(agent: JarvisAgent, language: JarvisLanguage): String {
        val langPart = when (language) {
            JarvisLanguage.HINDI -> "Respond in natural, conversational Hindi (हिंदी). Keep a warm, clear peer tone as AM AI."
            JarvisLanguage.HINGLISH -> "Respond naturally in Hinglish (Hindi-English mix in Latin script). Keep technical terms in English and avoid formal honorifics like 'Sir'."
            JarvisLanguage.GUJARATI -> "Respond in natural, warm Gujarati (ગુજરાતી). Keep a friendly peer tone as AM AI."
            JarvisLanguage.ENGLISH -> "Respond in clear, natural English as AM AI—warm, sharp, and human-like, without formal titles like 'Sir'."
        }
        return "You are AM AI (${agent.designation}). $langPart"
    }

    private fun buildCoordinateStreamRequest(
        spec: BackendStreamFallbackSpec,
        providerWireId: String?
    ): Request {
        val payload = JSONObject().apply {
            put("prompt", spec.prompt)
            put("history", buildBackendHistoryArray(spec.history))
            if (spec.languageInstruction.isNotBlank()) {
                put("languageInstruction", spec.languageInstruction.take(580))
            }
            if (!providerWireId.isNullOrBlank()) {
                put("provider", providerWireId)
            }
            if (!spec.imageBase64.isNullOrBlank() && !spec.imageMimeType.isNullOrBlank()) {
                put("imageBase64", spec.imageBase64)
                put("imageMimeType", spec.imageMimeType)
            }
            put("memoryEnabled", false)
            put("temporaryChat", true)
        }
        return Request.Builder()
            .url("${backendUrl}/api/brain/coordinate/stream")
            .apply {
                if (appAccessToken.isNotBlank()) {
                    addHeader("Authorization", "Bearer $appAccessToken")
                }
            }
            .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()
    }

    private fun executeBackendSseRequest(
        httpClient: OkHttpClient,
        request: Request,
        activeCallRef: AtomicReference<Call?>,
        isCancelledByConsumer: AtomicBoolean,
        accumulatedText: StringBuilder,
        defaultProviderWireId: String?,
        forceFallbackMeta: Boolean,
        onConnectMs: (Long) -> Unit = {},
        onMetaObserved: (providerLabel: String, modelId: String) -> Unit = { _, _ -> },
        onFirstToken: () -> Unit = {},
        emitText: (String) -> Unit
    ): Triple<Boolean, String?, Int?> {
        val call = httpClient.newCall(request)
        activeCallRef.set(call)
        if (isCancelledByConsumer.get()) return Triple(false, null, null)

        val connectStart = System.currentTimeMillis()
        var firstChunkSignaled = false
        call.execute().use { resp ->
            onConnectMs(System.currentTimeMillis() - connectStart)
            if (!resp.isSuccessful) {
                val errorBody = resp.body?.string().orEmpty()
                val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(
                    rawMessage = errorBody,
                    httpCode = resp.code,
                    errorBody = errorBody,
                    retryAfterHeader = resp.header("Retry-After")
                )
                Log.w(TAG, "Backend AI HTTP ${resp.code} code=${classification.code} body=${errorBody.take(300)}")
                recordQuotaError(classification)
                val displayMessage = extractBackendFormattedError(errorBody) ?: classification.displayMessage
                return Triple(resp.code == 400, displayMessage, resp.code)
            }

            val body = resp.body ?: return Triple(false, "Received an empty response stream from the AM AI backend.", resp.code)
            BufferedReader(InputStreamReader(body.byteStream())).use { reader ->
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    if (isCancelledByConsumer.get()) return Triple(false, null, null)
                    val currentLine = line ?: continue
                    when (val event = parseSseDataLine(currentLine, isBackendStream = true)) {
                        is SseLineEvent.Text -> {
                            if (event.chunk.isNotEmpty()) {
                                if (!firstChunkSignaled) {
                                    firstChunkSignaled = true
                                    onFirstToken()
                                }
                                accumulatedText.append(event.chunk)
                                emitText(accumulatedText.toString())
                            }
                        }
                        is SseLineEvent.Meta -> {
                            if (!event.model.isNullOrBlank()) {
                                val resolvedProvLabel = event.providerLabel
                                    ?: AiProviderId.fromWireId(event.provider ?: defaultProviderWireId)?.displayLabel
                                    ?: "AM AI"
                                onMetaObserved(resolvedProvLabel, event.model)
                                multiProviderRouter.recordBackendMeta(
                                    providerWireId = event.provider ?: defaultProviderWireId,
                                    modelId = event.model,
                                    primaryProviderWireId = event.primaryProvider ?: if (forceFallbackMeta) "gemini" else event.provider,
                                    primaryModelOverride = event.primaryModel,
                                    fallbackUsed = forceFallbackMeta || event.fallbackUsed
                                )
                            }
                        }
                        is SseLineEvent.Error -> {
                            val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(event.message)
                            recordQuotaError(classification)
                            val finalErrorText = if (event.isPreFormatted) event.message else classification.displayMessage
                            return Triple(false, finalErrorText, classification.httpStatus)
                        }
                        SseLineEvent.Done -> break
                        SseLineEvent.Ignore -> Unit
                    }
                }
            }

            return if (accumulatedText.isNotBlank()) {
                recordQuotaSuccess()
                Triple(true, null, 200)
            } else {
                Triple(false, "The backend stream completed without generating text.", 502)
            }
        }
    }

    private fun streamBackendRequest(
        request: Request,
        fallbackSpec: BackendStreamFallbackSpec? = null,
        directFallbackFlow: (() -> Flow<String>)? = null,
        promptPreview: String = "",
        promptChars: Int = 0,
        localRoutingMs: Long = 0L
    ): Flow<String> = callbackFlow {
        val activeCallRef = AtomicReference<Call?>(null)
        val isCancelledByConsumer = AtomicBoolean(false)
        val timedOutWaitingFirstToken = AtomicBoolean(false)
        val firstTokenReceived = AtomicBoolean(false)

        val streamJob = launch(Dispatchers.IO) {
            val requestStartMs = System.currentTimeMillis()
            val accumulatedText = StringBuilder()
            var lastFailureMessage: String? = null
            var lastErrorCode: String? = null
            var abortFailover = false
            val backendConnectMs = AtomicLong(0L)
            val ttftMs = AtomicLong(0L)
            var activeProv = multiProviderStatus.value.activeProviderLabel
            var activeMod = multiProviderStatus.value.activeModel
            var routePath = "backend_sse"
            var retriesCount = 0
            var telemetryRecorded = false

            fun publishTelemetry(success: Boolean, err: String? = null) {
                if (telemetryRecorded) return
                telemetryRecorded = true
                val totalMs = (System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L)
                val finalTtft = if (ttftMs.get() > 0L) ttftMs.get() else if (success) totalMs else 0L
                if (success) {
                    _lastResponseMetadata.value = LastAiResponseMetadata(
                        provider = activeProv,
                        model = activeMod,
                        ttftMs = finalTtft,
                        totalMs = totalMs
                    )
                }
                telemetryTracker.record(
                    AiRequestTelemetry(
                        promptPreview = promptPreview.trim().take(48),
                        promptChars = promptChars,
                        estimatedPromptTokens = RequestTelemetryTracker.estimateTokens(promptChars),
                        localRoutingMs = localRoutingMs,
                        backendConnectMs = backendConnectMs.get(),
                        ttftMs = finalTtft,
                        totalMs = totalMs,
                        provider = activeProv,
                        model = activeMod,
                        retries = retriesCount,
                        routePath = routePath,
                        success = success,
                        errorCode = err
                    )
                )
            }

            _activeStreamStatus.value = "Connecting AM AI Cloud..."
            val firstTokenWatchdog = launch {
                delay(backendFirstTokenTimeoutMs)
                if (!firstTokenReceived.get() && !isCancelledByConsumer.get()) {
                    timedOutWaitingFirstToken.set(true)
                    activeCallRef.get()?.cancel()
                }
            }

            try {
                try {
                    val (primaryDone, primaryErr, primaryHttp) = executeBackendSseRequest(
                        httpClient = backendFastClient,
                        request = request,
                        activeCallRef = activeCallRef,
                        isCancelledByConsumer = isCancelledByConsumer,
                        accumulatedText = accumulatedText,
                        defaultProviderWireId = null,
                        forceFallbackMeta = false,
                        onConnectMs = { ms -> backendConnectMs.compareAndSet(0L, ms) },
                        onMetaObserved = { prov, mod ->
                            activeProv = prov
                            activeMod = mod
                            _activeStreamStatus.value = "Using $prov • $mod"
                        },
                        onFirstToken = {
                            if (firstTokenReceived.compareAndSet(false, true)) {
                                ttftMs.set((System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L))
                                firstTokenWatchdog.cancel()
                            }
                        },
                        emitText = { trySend(it) }
                    )
                    if (accumulatedText.isNotBlank()) {
                        resetBackendCircuit()
                        publishTelemetry(success = true)
                        close()
                        return@launch
                    }
                    if (isCancelledByConsumer.get() && !timedOutWaitingFirstToken.get()) {
                        close()
                        return@launch
                    }
                    if (primaryDone) abortFailover = true
                    if (primaryHttp != null && (primaryHttp in 500..599 || primaryHttp == 401 || primaryHttp == 403)) {
                        openBackendCircuit()
                        lastErrorCode = "HTTP_$primaryHttp"
                    }
                    if (!primaryErr.isNullOrBlank()) lastFailureMessage = primaryErr
                } catch (ce: CancellationException) {
                    throw ce
                } catch (e: Exception) {
                    if (isCancelledByConsumer.get()) {
                        close()
                        return@launch
                    }
                    openBackendCircuit()
                    val timedOut = timedOutWaitingFirstToken.getAndSet(false)
                    lastErrorCode = if (timedOut) "FIRST_TOKEN_TIMEOUT" else "BACKEND_CONNECT_ERROR"
                    Log.w(TAG, if (timedOut) "Backend first-token watchdog (${backendFirstTokenTimeoutMs}ms) triggered; failing over." else "Primary backend stream failed (${e.message}); failing over.")
                    lastFailureMessage = JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Primary stream timeout")
                } finally {
                    firstTokenWatchdog.cancel()
                }

                // If direct keys exist locally and primary backend failed/timed out, skip slow sequential coordinator loops
                if (!abortFailover && !isCancelledByConsumer.get() && accumulatedText.isEmpty() && directFallbackFlow != null) {
                    routePath = "backend_failover_direct"
                    retriesCount += 1
                    _activeStreamStatus.value = "Switching to Direct Free Tier..."
                    Log.w(TAG, "Backend unavailable/timed out; rescuing request via Direct Multi-Provider API.")
                    var directEmitted = false
                    try {
                        directFallbackFlow().collect { directChunk ->
                            if (!isCancelledByConsumer.get() && directChunk.isNotBlank()) {
                                if (firstTokenReceived.compareAndSet(false, true)) {
                                    ttftMs.set((System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L))
                                }
                                directEmitted = true
                                trySend(directChunk)
                            }
                        }
                        if (directEmitted) {
                            telemetryRecorded = true // directFlowProvider records detailed telemetry
                            close()
                            return@launch
                        }
                    } catch (ce: CancellationException) {
                        throw ce
                    } catch (e: Exception) {
                        Log.w(TAG, "Direct failover rescue failed: ${e.message}")
                    }
                }

                // Coordinator failover (when no direct keys exist on device)
                if (!abortFailover && !isCancelledByConsumer.get() && accumulatedText.isEmpty() && fallbackSpec != null && directFallbackFlow == null) {
                    routePath = "backend_coordinator_failover"
                    for (providerWireId in fallbackSpec.candidateProviders) {
                        if (isCancelledByConsumer.get() || accumulatedText.isNotEmpty()) break
                        retriesCount += 1
                        _activeStreamStatus.value = "Switching to ${providerWireId?.uppercase() ?: "AUTO"}..."
                        try {
                            val coordReq = buildCoordinateStreamRequest(fallbackSpec, providerWireId)
                            val (coordDone, coordErr, _) = executeBackendSseRequest(
                                httpClient = backendFastClient,
                                request = coordReq,
                                activeCallRef = activeCallRef,
                                isCancelledByConsumer = isCancelledByConsumer,
                                accumulatedText = accumulatedText,
                                defaultProviderWireId = providerWireId,
                                forceFallbackMeta = true,
                                onMetaObserved = { prov, mod ->
                                    activeProv = prov
                                    activeMod = mod
                                    _activeStreamStatus.value = "Using $prov • $mod"
                                },
                                onFirstToken = {
                                    if (firstTokenReceived.compareAndSet(false, true)) {
                                        ttftMs.set((System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L))
                                    }
                                },
                                emitText = { trySend(it) }
                            )
                            if (accumulatedText.isNotBlank()) {
                                publishTelemetry(success = true)
                                close()
                                return@launch
                            }
                            if (coordDone) break
                            if (!coordErr.isNullOrBlank()) lastFailureMessage = coordErr
                        } catch (ce: CancellationException) {
                            throw ce
                        } catch (e: Exception) {
                            if (isCancelledByConsumer.get()) {
                                close()
                                return@launch
                            }
                            Log.w(TAG, "Coordinator failover ($providerWireId) failed: ${e.message}")
                            lastFailureMessage = JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Connection failed")
                        }
                    }
                }

                if (!isCancelledByConsumer.get() && accumulatedText.isEmpty()) {
                    publishTelemetry(success = false, err = lastErrorCode ?: "ALL_PROVIDERS_FAILED")
                    trySend(lastFailureMessage ?: "All free AI providers are temporarily unavailable. Please check your connection or API configuration and try again.")
                }
                close()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                if (!isCancelledByConsumer.get() && activeCallRef.get()?.isCanceled() != true) {
                    Log.e(TAG, "Backend stream failed", e)
                    publishTelemetry(success = false, err = "STREAM_EXCEPTION")
                    trySend(JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Connection failed"))
                }
                close()
            } finally {
                firstTokenWatchdog.cancel()
                _activeStreamStatus.value = null
            }
        }

        awaitClose {
            isCancelledByConsumer.set(true)
            activeCallRef.get()?.cancel()
            streamJob.cancel()
        }
    }

    private fun ensureGroqCatalogFresh() {
        if (!hasGroqKey || multiProviderRouter.isGroqCatalogFresh()) return
        try {
            val req = Request.Builder()
                .url("${FreeMultiProviderRouter.GROQ_BASE_URL}/models")
                .addHeader("Authorization", "Bearer $groqApiKey")
                .addHeader("Accept", "application/json")
                .get()
                .build()
            discoveryClient.newCall(req).execute().use { resp ->
                if (resp.code == 401 || resp.code == 403) {
                    multiProviderRouter.recordProviderError(
                        AiProviderId.GROQ,
                        FreeMultiProviderRouter.FREE_GROQ_MODELS.first(),
                        FreeMultiProviderRouter.classifyOpenAiHttpError(
                            AiProviderId.GROQ,
                            resp.code,
                            resp.body?.string().orEmpty()
                        )
                    )
                } else if (resp.isSuccessful) {
                    val active = FreeMultiProviderRouter.parseActiveGroqCatalogJson(resp.body?.string().orEmpty())
                    multiProviderRouter.updateGroqCatalog(active)
                    if (!active.isNullOrEmpty()) {
                        modelCatalogCache?.saveGroqModels(active)
                    }
                }
            }
        } catch (_: Exception) {
            // Keep curated allowlist if discovery times out
        }
    }

    /**
     * Queries OpenRouter /api/v1/models and verifies strictly $0 pricing.
     * Fail-closed: if unreachable or non-zero pricing, verified set remains empty and OpenRouter makes zero paid calls.
     */
    private fun ensureOpenRouterCatalogFresh() {
        if (!hasOpenRouterKey || multiProviderRouter.isOpenRouterCatalogFresh()) return
        try {
            val req = Request.Builder()
                .url("${FreeMultiProviderRouter.OPENROUTER_BASE_URL}/models")
                .addHeader("Authorization", "Bearer $openRouterApiKey")
                .addHeader("Accept", "application/json")
                .addHeader("HTTP-Referer", FreeMultiProviderRouter.OPENROUTER_REFERER)
                .addHeader("X-Title", "JARVIS AI")
                .get()
                .build()
            discoveryClient.newCall(req).execute().use { resp ->
                val raw = resp.body?.string().orEmpty()
                if (resp.isSuccessful) {
                    val verified = FreeMultiProviderRouter.parseVerifiedOpenRouterCatalogJson(raw)
                    multiProviderRouter.updateOpenRouterCatalog(verified)
                    if (verified.ok && verified.verifiedModels.isNotEmpty()) {
                        modelCatalogCache?.saveOpenRouterModels(verified.verifiedModels)
                    }
                } else {
                    multiProviderRouter.updateOpenRouterCatalog(
                        OpenRouterCatalogVerification(false, emptySet(), emptyList())
                    )
                }
            }
        } catch (_: Exception) {
            multiProviderRouter.updateOpenRouterCatalog(
                OpenRouterCatalogVerification(false, emptySet(), emptyList())
            )
        }
    }

    private fun buildOpenAiCompletionRequest(
        provider: AiProviderId,
        modelId: String,
        messages: JSONArray,
        stream: Boolean,
        temperature: Double,
        maxTokens: Int,
        responseJson: Boolean = false
    ): Request {
        require(FreeMultiProviderRouter.isApprovedFreeModelForProvider(provider, modelId)) {
            "Zero-cost security guard blocked unapproved model \"$modelId\" for ${provider.displayLabel}"
        }
        val url = when (provider) {
            AiProviderId.GROQ -> "${FreeMultiProviderRouter.GROQ_BASE_URL}/chat/completions"
            AiProviderId.OPENROUTER -> "${FreeMultiProviderRouter.OPENROUTER_BASE_URL}/chat/completions"
            AiProviderId.GEMINI -> throw IllegalArgumentException("Gemini uses native endpoint")
        }
        val key = if (provider == AiProviderId.GROQ) groqApiKey else openRouterApiKey
        val payload = JSONObject().apply {
            put("model", modelId)
            put("messages", messages)
            put("temperature", temperature)
            put("max_tokens", maxTokens)
            put("stream", stream)
            if (responseJson && !stream) {
                put("response_format", JSONObject().apply { put("type", "json_object") })
            }
        }
        return Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $key")
            .apply {
                if (provider == AiProviderId.OPENROUTER) {
                    addHeader("HTTP-Referer", FreeMultiProviderRouter.OPENROUTER_REFERER)
                    addHeader("X-Title", "JARVIS AI")
                }
            }
            .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()
    }

    private fun tryStreamExternalFreeProvider(
        provider: AiProviderId,
        messages: JSONArray,
        requireVision: Boolean,
        temperature: Double,
        preferFastGroq: Boolean = false,
        activeCallRef: AtomicReference<Call?>,
        isCancelledByConsumer: AtomicBoolean,
        accumulatedText: StringBuilder,
        onCandidateAttempt: (providerLabel: String, modelId: String) -> Unit = { _, _ -> },
        onFirstToken: () -> Unit = {},
        onCandidateFailed: () -> Unit = {},
        emitText: (String) -> Unit
    ): String? {
        if (provider == AiProviderId.GROQ) {
            if (requireVision) return null
            // Never block Groq chat path with /models; background warmer populates groqActiveModels.
        } else if (provider == AiProviderId.OPENROUTER) {
            // Fail-closed $0 verification if 24h cached OpenRouter verification is missing/stale
            ensureOpenRouterCatalogFresh()
        } else {
            return null
        }

        val candidates = if (provider == AiProviderId.GROQ) {
            multiProviderRouter.getGroqCandidates(preferFast = preferFastGroq)
        } else {
            multiProviderRouter.getVerifiedOpenRouterCandidates(requireVision = requireVision, excludeTinyModels = true)
        }

        for (candidateModel in candidates) {
            if (isCancelledByConsumer.get()) return null
            onCandidateAttempt(provider.displayLabel, candidateModel)
            _activeStreamStatus.value = "Using ${provider.displayLabel} • $candidateModel"
            val req = buildOpenAiCompletionRequest(
                provider = provider,
                modelId = candidateModel,
                messages = messages,
                stream = true,
                temperature = temperature,
                maxTokens = CHAT_MAX_OUTPUT_TOKENS
            )
            val call = client.newCall(req)
            activeCallRef.set(call)
            var firstChunkSignaled = false
            try {
                call.execute().use { resp ->
                    if (!resp.isSuccessful) {
                        val errBody = resp.body?.string().orEmpty()
                        val err = FreeMultiProviderRouter.classifyOpenAiHttpError(
                            provider = provider,
                            httpCode = resp.code,
                            rawBody = errBody,
                            retryAfterHeader = resp.header("Retry-After")
                        )
                        Log.w(TAG, "[Multi-Provider Free] ${provider.displayLabel} ($candidateModel) failed HTTP ${resp.code}: ${err.code}")
                        multiProviderRouter.recordProviderError(provider, candidateModel, err)
                        onCandidateFailed()
                        // 0 retries on 401/403 (blockWholeProvider) or 404/402/410; move immediately
                        if (err.blockWholeProvider) return null
                        return@use
                    }

                    val body = resp.body ?: return@use
                    BufferedReader(InputStreamReader(body.byteStream())).use { reader ->
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            if (isCancelledByConsumer.get()) break
                            when (val event = FreeMultiProviderRouter.parseOpenAiSseLine(line.orEmpty())) {
                                is OpenAiSseEvent.Text -> {
                                    if (!firstChunkSignaled && event.chunk.isNotEmpty()) {
                                        firstChunkSignaled = true
                                        onFirstToken()
                                    }
                                    accumulatedText.append(event.chunk)
                                    emitText(accumulatedText.toString())
                                }
                                is OpenAiSseEvent.Error -> {
                                    val err = FreeMultiProviderRouter.classifyOpenAiHttpError(
                                        provider, event.httpCode, event.message
                                    )
                                    multiProviderRouter.recordProviderError(provider, candidateModel, err)
                                    if (accumulatedText.isNotEmpty()) return candidateModel
                                    onCandidateFailed()
                                    return@use
                                }
                                OpenAiSseEvent.Done -> break
                                OpenAiSseEvent.Ignore -> Unit
                            }
                        }
                    }

                    if (accumulatedText.isNotEmpty()) {
                        multiProviderRouter.recordProviderSuccess(provider, candidateModel)
                        return candidateModel
                    }
                }
            } catch (e: Exception) {
                if (isCancelledByConsumer.get()) return null
                Log.w(TAG, "[Multi-Provider Free] ${provider.displayLabel} ($candidateModel) network error: ${e.message}")
                if (accumulatedText.isNotEmpty()) return candidateModel
                onCandidateFailed()
            }
        }
        return null
    }

    private fun tryGenerateExternalFreeProvider(
        provider: AiProviderId,
        prompt: String,
        temperature: Double,
        maxTokens: Int,
        responseJson: Boolean
    ): String? {
        if (provider == AiProviderId.GROQ) {
            // Curated allowlist is already enforced; don't block on /models
        } else if (provider == AiProviderId.OPENROUTER) {
            ensureOpenRouterCatalogFresh()
        } else {
            return null
        }

        val candidates = if (provider == AiProviderId.GROQ) {
            multiProviderRouter.getGroqCandidates(preferFast = true)
        } else {
            multiProviderRouter.getVerifiedOpenRouterCandidates(requireVision = false, excludeTinyModels = true)
        }

        val messages = JSONArray().apply {
            put(JSONObject().apply {
                put("role", "user")
                put("content", prompt)
            })
        }

        for (candidateModel in candidates) {
            var useJson = responseJson
            repeat(2) {
                val req = buildOpenAiCompletionRequest(
                    provider = provider,
                    modelId = candidateModel,
                    messages = messages,
                    stream = false,
                    temperature = temperature,
                    maxTokens = maxTokens,
                    responseJson = useJson
                )
                try {
                    client.newCall(req).execute().use { resp ->
                        val raw = resp.body?.string().orEmpty()
                        if (!resp.isSuccessful) {
                            if (useJson && resp.code == 400 && raw.contains("response_format", ignoreCase = true)) {
                                useJson = false
                                return@repeat
                            }
                            val err = FreeMultiProviderRouter.classifyOpenAiHttpError(
                                provider, resp.code, raw, resp.header("Retry-After")
                            )
                            multiProviderRouter.recordProviderError(provider, candidateModel, err)
                            if (err.blockWholeProvider) return null
                            return@use
                        }
                        val text = JSONObject(raw)
                            .optJSONArray("choices")
                            ?.optJSONObject(0)
                            ?.optJSONObject("message")
                            ?.optString("content")
                            .orEmpty()
                            .trim()
                        if (text.isNotEmpty()) {
                            multiProviderRouter.recordProviderSuccess(provider, candidateModel)
                            return text
                        }
                    }
                } catch (_: Exception) {
                    return@repeat
                }
            }
        }
        return null
    }

    private fun streamDirectMultiProviderWithFallback(
        systemInstructionText: String,
        history: List<ConversationEntity>,
        prompt: String,
        imageBase64: String? = null,
        imageMimeType: String? = null,
        allowNonGeminiFallback: Boolean = true,
        temperature: Double = 0.35,
        preferredGeminiModel: String = modelName,
        preferFastGroq: Boolean = false,
        localRoutingMs: Long = 0L,
        promptCharCount: Int = systemInstructionText.length + prompt.length,
        requestBuilder: (candidateModel: String, includeThinkingConfig: Boolean) -> Request
    ): Flow<String> = callbackFlow {
        if (!hasRealApiKey) {
            trySend(
                """
                Real-time Free Multi-Provider AI requires configuring at least one free API key (GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY) in the AI Studio Secrets panel or setting BACKEND_URL.

                To connect the live zero-cost AI mesh:
                1. Open the Secrets panel in Google AI Studio.
                2. Set GEMINI_API_KEY, GROQ_API_KEY, and/or OPENROUTER_API_KEY (or set BACKEND_URL to your deployed AM AI Express server).
                3. AM AI enforces a strict ₹0 free-only allowlist and switches providers automatically on HTTP 429 limits.

                Current Engine: Standby (Awaiting Free Provider Authorization).
                """.trimIndent()
            )
            close()
            awaitClose {}
            return@callbackFlow
        }

        val activeCallRef = AtomicReference<Call?>(null)
        val isCancelledByConsumer = AtomicBoolean(false)

        val streamJob = launch(Dispatchers.IO) {
            val requestStartMs = System.currentTimeMillis()
            val accumulatedText = StringBuilder()
            val attemptedProviders = mutableListOf<AiProviderId>()
            val requireVision = !imageBase64.isNullOrBlank() && !imageMimeType.isNullOrBlank()
            var geminiFailure: GeminiErrorClassification? = null
            var activeProviderLabel = AiProviderId.GEMINI.displayLabel
            var activeModelId = preferredGeminiModel
            var ttftMs = 0L
            var retriesMade = 0
            var telemetryRecorded = false

            fun recordDirectTelemetry(success: Boolean, errorCode: String? = null) {
                if (telemetryRecorded) return
                telemetryRecorded = true
                val totalMs = (System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L)
                val effectiveTtft = if (ttftMs > 0L) ttftMs else if (success) totalMs else 0L
                if (success) {
                    _lastResponseMetadata.value = LastAiResponseMetadata(
                        provider = activeProviderLabel,
                        model = activeModelId,
                        ttftMs = effectiveTtft,
                        totalMs = totalMs
                    )
                }
                telemetryTracker.record(
                    AiRequestTelemetry(
                        promptPreview = prompt.trim().take(48),
                        promptChars = promptCharCount,
                        estimatedPromptTokens = RequestTelemetryTracker.estimateTokens(promptCharCount),
                        localRoutingMs = localRoutingMs,
                        backendConnectMs = 0L,
                        ttftMs = effectiveTtft,
                        totalMs = totalMs,
                        provider = activeProviderLabel,
                        model = activeModelId,
                        retries = retriesMade,
                        routePath = "direct_multi_provider",
                        success = success,
                        errorCode = errorCode
                    )
                )
            }

            try {
                // 1. Primary: Google Gemini Free Tier (no /v1beta/models call on hot chat path)
                if (hasGeminiKey) {
                    attemptedProviders.add(AiProviderId.GEMINI)
                    val execResult = fallbackManager.executeWithFallback(
                        enableBackoff = true,
                        maxPrimaryRetries = 1,
                        primaryOverride = preferredGeminiModel,
                        isAborted = { isCancelledByConsumer.get() || activeCallRef.get()?.isCanceled() == true },
                        hasEmittedOutput = { accumulatedText.isNotEmpty() },
                        fetchModelsJson = null,
                        onRetry = { candidateModel, attempt, maxRetries, delayMs, cls ->
                            retriesMade += 1
                            _activeStreamStatus.value = "Retrying Gemini • $candidateModel"
                            Log.w(
                                TAG,
                                "Model \"$candidateModel\" hit ${cls.code} (HTTP ${cls.httpStatus}); exponential backoff retry $attempt/$maxRetries in ${delayMs}ms"
                            )
                        },
                        onModelSwitch = { fromModel, toModel, cls ->
                            retriesMade += 1
                            activeModelId = toModel
                            _activeStreamStatus.value = "Using Gemini • $toModel"
                            Log.w(
                                TAG,
                                "[Free Model Fallback] \"$fromModel\" failed with ${cls.code} (HTTP ${cls.httpStatus}). Switching to approved Free Tier model \"$toModel\"."
                            )
                        }
                    ) { candidateModel, _, _ ->
                        activeProviderLabel = AiProviderId.GEMINI.displayLabel
                        activeModelId = candidateModel
                        _activeStreamStatus.value = "Using Gemini • $candidateModel"
                        var includeThinking = true
                        var thinkingRetried = false

                        while (true) {
                            if (isCancelledByConsumer.get()) {
                                return@executeWithFallback FallbackAttemptOutcome(value = Unit)
                            }
                            val call = client.newCall(requestBuilder(candidateModel, includeThinking))
                            activeCallRef.set(call)

                            val outcome = try {
                                call.execute().use { resp ->
                                    if (!resp.isSuccessful) {
                                        val errorBody = resp.body?.string().orEmpty()
                                        val retryAfterHeader = resp.header("Retry-After")

                                        if (!thinkingRetried && isThinkingCompatibilityError(resp.code, errorBody)) {
                                            thinkingRetried = true
                                            includeThinking = false
                                            return@use null
                                        }

                                        val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                            rawMessage = errorBody,
                                            httpCode = resp.code,
                                            errorBody = errorBody,
                                            retryAfterHeader = retryAfterHeader
                                        )
                                        Log.e(
                                            TAG,
                                            "Upstream AI error model=$candidateModel http=${resp.code} code=${classification.code} " +
                                                "category=${classification.quotaCategory} retryable=${classification.retryable} " +
                                                "retryAfter=${classification.retryAfterSeconds} body=$errorBody"
                                        )
                                        return@use FallbackAttemptOutcome<Unit>(failure = classification)
                                    }

                                    val body = resp.body
                                        ?: return@use FallbackAttemptOutcome<Unit>(
                                            failure = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                                rawMessage = "Empty response stream from Gemini.",
                                                httpCode = 502
                                            )
                                        )

                                    BufferedReader(InputStreamReader(body.byteStream())).use { reader ->
                                        var line: String?
                                        while (reader.readLine().also { line = it } != null) {
                                            val currentLine = line ?: continue
                                            when (val event = parseSseDataLine(currentLine, isBackendStream = false)) {
                                                is SseLineEvent.Text -> {
                                                    if (event.chunk.isNotEmpty()) {
                                                        if (ttftMs == 0L) {
                                                            ttftMs = (System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L)
                                                        }
                                                        accumulatedText.append(event.chunk)
                                                        trySend(accumulatedText.toString())
                                                    }
                                                }
                                                is SseLineEvent.Meta -> Unit
                                                is SseLineEvent.Error -> {
                                                    val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(event.message)
                                                    return@use FallbackAttemptOutcome<Unit>(failure = classification)
                                                }
                                                SseLineEvent.Done -> break
                                                SseLineEvent.Ignore -> Unit
                                            }
                                        }
                                    }
                                    FallbackAttemptOutcome(value = Unit)
                                }
                            } catch (ce: CancellationException) {
                                throw ce
                            } catch (io: Exception) {
                                if (isCancelledByConsumer.get() || call.isCanceled()) {
                                    return@executeWithFallback FallbackAttemptOutcome(value = Unit)
                                }
                                val isTimeout = io is SocketTimeoutException || io is InterruptedIOException
                                Log.w(TAG, "[Multi-Provider Free] Gemini ($candidateModel) ${if (isTimeout) "timeout" else "network error"}: ${io.message}")
                                FallbackAttemptOutcome(
                                    failure = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                        rawMessage = io.localizedMessage ?: if (isTimeout) "Gemini request timed out" else "Gemini connection failed",
                                        httpCode = if (isTimeout) 504 else 503
                                    )
                                )
                            }

                            if (outcome != null) {
                                return@executeWithFallback outcome
                            }
                        }
                        @Suppress("UNREACHABLE_CODE")
                        FallbackAttemptOutcome(value = Unit)
                    }

                    if (execResult.failure == null && accumulatedText.isNotBlank()) {
                        activeProviderLabel = AiProviderId.GEMINI.displayLabel
                        activeModelId = execResult.modelUsed
                        multiProviderRouter.recordProviderSuccess(
                            provider = AiProviderId.GEMINI,
                            modelId = execResult.modelUsed,
                            fallbackUsedOverride = execResult.fallbackUsed
                        )
                        recordQuotaSuccess()
                        recordDirectTelemetry(success = true)
                        close()
                        return@launch
                    } else if (execResult.failure == null && accumulatedText.isBlank()) {
                        val hasAlternateFreeProvider = allowNonGeminiFallback &&
                            ((hasGroqKey && !requireVision) || hasOpenRouterKey)
                        if (!hasAlternateFreeProvider) {
                            multiProviderRouter.recordProviderSuccess(
                                provider = AiProviderId.GEMINI,
                                modelId = execResult.modelUsed,
                                fallbackUsedOverride = execResult.fallbackUsed
                            )
                            recordQuotaSuccess()
                            recordDirectTelemetry(success = false, errorCode = "EMPTY_RESPONSE")
                            trySend("Gemini returned an empty response.")
                            close()
                            return@launch
                        }
                        Log.w(TAG, "[Multi-Provider Free Switch] Gemini returned an empty stream; failing over to next free provider.")
                    }

                    geminiFailure = execResult.failure
                    multiProviderRouter.syncFromGeminiStatus()
                }

                // 2 & 3. Automatic Zero-Cost Failover: Groq Free API -> OpenRouter Free ($0 verified)
                val canSwitchProvider = allowNonGeminiFallback &&
                    accumulatedText.isEmpty() &&
                    !isCancelledByConsumer.get() &&
                    (geminiFailure == null || geminiFailure.code != "GEMINI_BAD_REQUEST")

                if (canSwitchProvider) {
                    val openAiMessages = FreeMultiProviderRouter.buildOpenAiMessagesJson(
                        systemInstruction = systemInstructionText,
                        history = history,
                        prompt = prompt,
                        imageBase64 = imageBase64,
                        imageMimeType = imageMimeType
                    )

                    if (hasGroqKey && !requireVision) {
                        attemptedProviders.add(AiProviderId.GROQ)
                        Log.w(TAG, "[Multi-Provider Free Switch] Trying Groq Free API while preserving conversation context.")
                        val groqModel = tryStreamExternalFreeProvider(
                            provider = AiProviderId.GROQ,
                            messages = openAiMessages,
                            requireVision = false,
                            temperature = temperature,
                            preferFastGroq = preferFastGroq,
                            activeCallRef = activeCallRef,
                            isCancelledByConsumer = isCancelledByConsumer,
                            accumulatedText = accumulatedText,
                            onCandidateAttempt = { prov, mod ->
                                activeProviderLabel = prov
                                activeModelId = mod
                            },
                            onFirstToken = {
                                if (ttftMs == 0L) ttftMs = (System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L)
                            },
                            onCandidateFailed = { retriesMade += 1 },
                            emitText = { trySend(it) }
                        )
                        if (groqModel != null) {
                            activeProviderLabel = AiProviderId.GROQ.displayLabel
                            activeModelId = groqModel
                            recordQuotaSuccess()
                            recordDirectTelemetry(success = true)
                            close()
                            return@launch
                        }
                    }

                    if (hasOpenRouterKey && !isCancelledByConsumer.get() && accumulatedText.isEmpty()) {
                        attemptedProviders.add(AiProviderId.OPENROUTER)
                        Log.w(TAG, "[Multi-Provider Free Switch] Verifying OpenRouter $0 pricing and switching to OpenRouter Free.")
                        val orModel = tryStreamExternalFreeProvider(
                            provider = AiProviderId.OPENROUTER,
                            messages = openAiMessages,
                            requireVision = requireVision,
                            temperature = temperature,
                            preferFastGroq = false,
                            activeCallRef = activeCallRef,
                            isCancelledByConsumer = isCancelledByConsumer,
                            accumulatedText = accumulatedText,
                            onCandidateAttempt = { prov, mod ->
                                activeProviderLabel = prov
                                activeModelId = mod
                            },
                            onFirstToken = {
                                if (ttftMs == 0L) ttftMs = (System.currentTimeMillis() - requestStartMs).coerceAtLeast(1L)
                            },
                            onCandidateFailed = { retriesMade += 1 },
                            emitText = { trySend(it) }
                        )
                        if (orModel != null) {
                            activeProviderLabel = AiProviderId.OPENROUTER.displayLabel
                            activeModelId = orModel
                            recordQuotaSuccess()
                            recordDirectTelemetry(success = true)
                            close()
                            return@launch
                        }
                    }
                }

                // Every eligible free provider failed or exhausted
                if (geminiFailure != null) {
                    recordQuotaError(geminiFailure)
                }
                if (accumulatedText.isEmpty()) {
                    recordDirectTelemetry(success = false, errorCode = geminiFailure?.code ?: "PROVIDERS_EXHAUSTED")
                    if (attemptedProviders.size == 1 && attemptedProviders.first() == AiProviderId.GEMINI && geminiFailure != null) {
                        trySend(geminiFailure.displayMessage)
                    } else {
                        val waitSec = multiProviderRouter.getShortestCooldownSeconds(attemptedProviders)
                        trySend(FreeMultiProviderRouter.buildAllProvidersUnavailableMessage(attemptedProviders, waitSec))
                    }
                }
                close()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                if (!isCancelledByConsumer.get() && activeCallRef.get()?.isCanceled() != true) {
                    Log.e(TAG, "Multi-provider network stream failed", e)
                    recordDirectTelemetry(success = false, errorCode = "DIRECT_STREAM_EXCEPTION")
                    trySend(JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Connection failed"))
                }
                close()
            } finally {
                _activeStreamStatus.value = null
            }
        }

        awaitClose {
            isCancelledByConsumer.set(true)
            activeCallRef.get()?.cancel()
            streamJob.cancel()
        }
    }

    private suspend fun executeDirectGenerateContent(
        enableBackoff: Boolean,
        maxPrimaryRetries: Int,
        fallbackPrompt: String = "",
        fallbackTemperature: Double = 0.3,
        fallbackMaxTokens: Int = 1024,
        fallbackJson: Boolean = false,
        payloadBuilder: (candidateModel: String) -> JSONObject
    ): FallbackExecutionResult<String> {
        var geminiOutcome: FallbackExecutionResult<String>? = null
        if (hasGeminiKey) {
            val res = fallbackManager.executeWithFallback(
                enableBackoff = enableBackoff,
                maxPrimaryRetries = maxPrimaryRetries,
                fetchModelsJson = null,
                onRetry = { candidateModel, attempt, max, delayMs, cls ->
                    Log.w(TAG, "Direct generateContent ($candidateModel) temporary ${cls.code}; retry $attempt/$max in ${delayMs}ms")
                },
                onModelSwitch = { fromModel, toModel, cls ->
                    Log.w(
                        TAG,
                        "[Free Model Fallback] Direct generateContent switched \"$fromModel\" -> \"$toModel\" after ${cls.code} (HTTP ${cls.httpStatus})."
                    )
                }
            ) { candidateModel, _, _ ->
                val payload = payloadBuilder(candidateModel)
                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                try {
                    client.newCall(req).execute().use { resp ->
                        val bodyStr = resp.body?.string().orEmpty()
                        if (!resp.isSuccessful) {
                            val cls = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                rawMessage = bodyStr,
                                httpCode = resp.code,
                                errorBody = bodyStr,
                                retryAfterHeader = resp.header("Retry-After")
                            )
                            FallbackAttemptOutcome(failure = cls)
                        } else {
                            val root = JSONObject(bodyStr)
                            FallbackAttemptOutcome(value = extractNonThoughtText(root).trim())
                        }
                    }
                } catch (ce: CancellationException) {
                    throw ce
                } catch (io: Exception) {
                    val isTimeout = io is SocketTimeoutException || io is InterruptedIOException
                    FallbackAttemptOutcome(
                        failure = JarvisBrainEngine.classifyGeminiErrorDetailed(
                            rawMessage = io.localizedMessage ?: if (isTimeout) "Gemini request timed out" else "Gemini connection failed",
                            httpCode = if (isTimeout) 504 else 503
                        )
                    )
                }
            }
            if (res.failure == null) {
                multiProviderRouter.recordProviderSuccess(
                    provider = AiProviderId.GEMINI,
                    modelId = res.modelUsed,
                    fallbackUsedOverride = res.fallbackUsed
                )
                return res
            }
            geminiOutcome = res
            multiProviderRouter.syncFromGeminiStatus()
        }

        if (fallbackPrompt.isNotBlank()) {
            if (hasGroqKey) {
                val groqText = tryGenerateExternalFreeProvider(
                    provider = AiProviderId.GROQ,
                    prompt = fallbackPrompt,
                    temperature = fallbackTemperature,
                    maxTokens = fallbackMaxTokens,
                    responseJson = fallbackJson
                )
                if (!groqText.isNullOrBlank()) {
                    return FallbackExecutionResult(
                        value = groqText,
                        failure = null,
                        modelUsed = multiProviderStatus.value.activeModel,
                        primaryModel = modelName,
                        fallbackUsed = true,
                        switchedFrom = modelName,
                        attemptedModels = listOf(modelName, multiProviderStatus.value.activeModel),
                        totalAttempts = 1,
                        allModelsExhausted = false
                    )
                }
            }
            if (hasOpenRouterKey) {
                val orText = tryGenerateExternalFreeProvider(
                    provider = AiProviderId.OPENROUTER,
                    prompt = fallbackPrompt,
                    temperature = fallbackTemperature,
                    maxTokens = fallbackMaxTokens,
                    responseJson = fallbackJson
                )
                if (!orText.isNullOrBlank()) {
                    return FallbackExecutionResult(
                        value = orText,
                        failure = null,
                        modelUsed = multiProviderStatus.value.activeModel,
                        primaryModel = modelName,
                        fallbackUsed = true,
                        switchedFrom = modelName,
                        attemptedModels = listOf(modelName, multiProviderStatus.value.activeModel),
                        totalAttempts = 1,
                        allModelsExhausted = false
                    )
                }
            }
        }

        return geminiOutcome ?: FallbackExecutionResult(
            failure = GeminiFreeModelFallbackManager.buildAllFreeModelsExhaustedClassification(
                primaryModel = modelName,
                attemptedModels = emptyList(),
                poolModels = listOf(modelName),
                retryAfterSeconds = multiProviderRouter.getShortestCooldownSeconds()
            ),
            modelUsed = modelName,
            primaryModel = modelName,
            fallbackUsed = false,
            switchedFrom = null,
            attemptedModels = emptyList(),
            totalAttempts = 0,
            allModelsExhausted = true
        )
    }

    private fun buildDirectGeminiRequest(
        prompt: String,
        systemInstructionText: String,
        history: List<ConversationEntity>,
        thinkingBudget: Int = 0,
        includeThinkingConfig: Boolean = true,
        targetModel: String = modelName,
        temperature: Double = 0.35
    ): Request {
        val activeModel = targetModel.ifBlank { modelName }
        val jsonPayload = JSONObject().apply {
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply { put("text", systemInstructionText) })
                })
            })
            put("contents", buildAlternatingContents(history, prompt))
            put("generationConfig", JSONObject().apply {
                put("temperature", temperature)
                put("maxOutputTokens", CHAT_MAX_OUTPUT_TOKENS)
                if (includeThinkingConfig) {
                    put("thinkingConfig", buildThinkingConfigJson(activeModel, thinkingBudget))
                }
            })
        }

        val requestUrl = "https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?alt=sse"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = jsonPayload.toString().toRequestBody(mediaType)

        return Request.Builder()
            .url(requestUrl)
            .addHeader("x-goog-api-key", apiKey)
            .post(requestBody)
            .build()
    }

    private fun buildMultimodalDirectGeminiRequest(
        prompt: String,
        fileBase64: String,
        mimeType: String,
        systemInstructionText: String,
        history: List<ConversationEntity>,
        includeThinkingConfig: Boolean = true,
        targetModel: String = modelName
    ): Request {
        val activeModel = targetModel.ifBlank { modelName }
        val contents = buildAlternatingContents(history, prompt)
        val lastIdx = contents.length() - 1
        if (lastIdx >= 0) {
            val lastTurn = contents.optJSONObject(lastIdx)
            val parts = lastTurn?.optJSONArray("parts")
            parts?.put(JSONObject().apply {
                put("inlineData", JSONObject().apply {
                    put("mimeType", mimeType)
                    put("data", fileBase64)
                })
            })
        }

        val jsonPayload = JSONObject().apply {
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply { put("text", systemInstructionText) })
                })
            })
            put("contents", contents)
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.5)
                put("maxOutputTokens", CHAT_MAX_OUTPUT_TOKENS)
                if (includeThinkingConfig) {
                    put("thinkingConfig", buildThinkingConfigJson(activeModel, 0))
                }
            })
        }

        val requestUrl = "https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?alt=sse"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = jsonPayload.toString().toRequestBody(mediaType)

        return Request.Builder()
            .url(requestUrl)
            .addHeader("x-goog-api-key", apiKey)
            .post(requestBody)
            .build()
    }

    private fun buildBackendRequest(
        prompt: String,
        systemInstructionText: String,
        history: List<ConversationEntity>,
        enableWebSearch: Boolean,
        preferredLanguage: String = "ENGLISH"
    ): Request {
        val backendHistory = buildBackendHistoryArray(history)
        val jsonPayload = JSONObject().apply {
            put("prompt", prompt)
            put("systemInstruction", systemInstructionText)
            put("history", backendHistory)
            put("enableWebSearch", enableWebSearch)
            put("preferredLanguage", preferredLanguage)
        }

        val requestUrl = "${backendUrl}/api/chat/stream"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = jsonPayload.toString().toRequestBody(mediaType)

        return Request.Builder()
            .url(requestUrl)
            .apply {
                if (appAccessToken.isNotBlank()) {
                    addHeader("Authorization", "Bearer $appAccessToken")
                }
            }
            .post(requestBody)
            .build()
    }

    private fun buildMultimodalBackendRequest(
        prompt: String,
        fileBase64: String,
        mimeType: String,
        fileName: String,
        systemInstructionText: String,
        history: List<ConversationEntity>,
        enableWebSearch: Boolean,
        preferredLanguage: String = "ENGLISH"
    ): Request {
        val backendHistory = buildBackendHistoryArray(history)
        val jsonPayload = JSONObject().apply {
            put("prompt", prompt)
            put("systemInstruction", systemInstructionText)
            put("history", backendHistory)
            put("fileBase64", fileBase64)
            put("mimeType", mimeType)
            put("fileName", fileName)
            put("enableWebSearch", enableWebSearch)
            put("preferredLanguage", preferredLanguage)
        }

        val requestUrl = "${backendUrl}/api/chat/multimodal"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = jsonPayload.toString().toRequestBody(mediaType)

        return Request.Builder()
            .url(requestUrl)
            .apply {
                if (appAccessToken.isNotBlank()) {
                    addHeader("Authorization", "Bearer $appAccessToken")
                }
            }
            .post(requestBody)
            .build()
    }

    fun buildSystemInstruction(
        agent: JarvisAgent,
        language: JarvisLanguage,
        telemetry: SystemTelemetry?,
        memories: List<MemoryEntity>,
        customSystemPromptOverride: String? = null,
        queryPrompt: String = "",
        analysis: BrainAnalysis? = null,
        earlierDigest: String = "",
        retrievedConversationSnippets: List<String> = emptyList()
    ): String {
        val orderedMemories = if (queryPrompt.isNotBlank()) {
            MemoryDeduplicator.retrieveRelevantMemories(queryPrompt, memories, MAX_MEMORY_CONTEXT_ITEMS)
        } else {
            memories
                .sortedWith(compareByDescending<MemoryEntity> { it.importance }.thenByDescending { it.updatedAt })
                .take(MAX_MEMORY_CONTEXT_ITEMS)
        }

        val memoryContext = if (orderedMemories.isNotEmpty()) {
            "Relevant Owner Memory:\n" +
                orderedMemories.joinToString("\n") { "- [${it.category}] ${it.key}: ${it.content}" }
        } else {
            ""
        }

        val pastChatContext = if (retrievedConversationSnippets.isNotEmpty()) {
            "Past Excerpts:\n" +
                retrievedConversationSnippets.joinToString("\n") { "- $it" }
        } else {
            ""
        }

        val telemetryContext = telemetry?.let {
            "Telemetry: Battery ${it.batteryLevel}% (${if (it.isCharging) "Charging" else "Discharging"}), RAM ${it.ramUsedMb}/${it.ramTotalMb}MB (${it.ramPercent}%), Net ${it.networkType}"
        }.orEmpty()

        val accuracyCore = """
            AM AI Accuracy & Language Rules:
            1. Auto-detect and reply in the user's exact language (English, Hindi, Gujarati, or Hinglish). Preferred default: ${language.displayName}.
            2. Be concise, accurate, and direct. Never use stiff honorifics like "Sir".
            3. If you do not know a fact or cannot verify it, say "I don't know" (or the natural equivalent in the user's language) instead of guessing.
            4. For current events, live prices, scores, or web facts, use /api/search context when provided and explicitly state "I checked web search for this:" before citing it.
            5. Never claim an action or hardware change happened unless confirmed. Smart Home scenes and devices are simulated in this app — clearly state they are simulated.
        """.trimIndent()

        val brainBlock = analysis?.let {
            JarvisBrainEngine.buildBrainDirectiveBlock(
                analysis = it,
                selectedLanguage = language,
                earlierDigest = earlierDigest
            )
        }.orEmpty()

        val personaPrompt = customSystemPromptOverride?.takeIf { it.isNotBlank() } ?: agent.systemPrompt

        return listOf(
            personaPrompt,
            accuracyCore,
            brainBlock,
            telemetryContext,
            memoryContext,
            pastChatContext
        ).filter { it.isNotBlank() }.joinToString("\n\n")
    }

    suspend fun generateSimpleText(
        prompt: String,
        systemInstruction: String = "You are AM AI, a helpful intelligent assistant.",
        temperature: Double = 0.5,
        maxTokens: Int = 1500
    ): Result<String> = withContext(Dispatchers.IO) {
        if (!usesBackendProxy && !hasDirectApiKey) {
            return@withContext Result.failure(
                IllegalStateException("No AI backend or direct free provider key is configured.")
            )
        }
        if (usesBackendProxy) {
            val coord = requestBackendCoordinateText(
                prompt = prompt,
                languageInstruction = systemInstruction
            )
            if (!coord.isNullOrBlank()) {
                return@withContext Result.success(coord)
            }
        }
        if (!hasDirectApiKey) {
            return@withContext Result.failure(
                IllegalStateException("Backend request failed and no direct API key fallback is configured.")
            )
        }
        val outcome = executeDirectGenerateContent(
            enableBackoff = true,
            maxPrimaryRetries = 1,
            fallbackPrompt = "$systemInstruction\n\n$prompt",
            fallbackTemperature = temperature,
            fallbackMaxTokens = maxTokens
        ) { candidateModel ->
            JSONObject().apply {
                put("systemInstruction", JSONObject().apply {
                    put("parts", JSONArray().apply { put(JSONObject().apply { put("text", systemInstruction) }) })
                })
                put("contents", JSONArray().apply {
                    put(JSONObject().apply {
                        put("role", "user")
                        put("parts", JSONArray().apply { put(JSONObject().apply { put("text", prompt) }) })
                    })
                })
                put("generationConfig", JSONObject().apply {
                    put("temperature", temperature)
                    put("maxOutputTokens", maxTokens)
                    put("thinkingConfig", buildThinkingConfigJson(candidateModel, 0))
                })
            }
        }
        if (outcome.failure != null) {
            Result.failure(IllegalStateException(outcome.failure.displayMessage))
        } else {
            val text = outcome.value.orEmpty().trim()
            if (text.isBlank()) Result.failure(IllegalStateException("AI returned an empty response."))
            else Result.success(text)
        }
    }

    suspend fun summarizeConversation(
        history: List<ConversationEntity>,
        language: JarvisLanguage
    ): Result<String> = withContext(Dispatchers.IO) {
        val valid = history.filter { it.text.isNotBlank() && !isErrorConversation(it) }
        if (valid.size < 2) {
            return@withContext Result.failure(IllegalStateException("Need at least two messages to summarize."))
        }
        if (!usesBackendProxy && !hasRealApiKey) {
            return@withContext Result.failure(
                IllegalStateException("Gemini API is not configured. Set GEMINI_API_KEY or BACKEND_URL in AI Studio Secrets.")
            )
        }

        val transcript = valid.takeLast(24).joinToString("\n") { msg ->
            val speaker = if (msg.role == "user") "User" else msg.agentName
            "$speaker: ${msg.text.trim().take(700)}"
        }
        val summaryPrompt = """
            Summarize the conversation below cleanly in ${language.displayName}.
            Include:
            1. Core Topics & Goals
            2. Key Decisions or Code/Technical Facts
            3. Open Action Items / Next Steps

            CONVERSATION:
            $transcript
        """.trimIndent()

        try {
            if (usesBackendProxy) {
                val payload = JSONObject().apply {
                    put("messages", buildBackendHistoryArray(valid.takeLast(24)))
                    put("language", language.displayName)
                }
                val req = Request.Builder()
                    .url("${backendUrl}/api/chat/summarize")
                    .apply {
                        if (appAccessToken.isNotBlank()) addHeader("Authorization", "Bearer $appAccessToken")
                    }
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                try {
                    backendFastClient.newCall(req).execute().use { resp ->
                        val bodyStr = resp.body?.string().orEmpty()
                        if (resp.isSuccessful) {
                            recordQuotaSuccess()
                            val summary = JSONObject(bodyStr).optString("summary").trim()
                            if (summary.isNotBlank()) {
                                return@withContext Result.success(summary)
                            }
                        } else if (resp.code == 400) {
                            val msg = extractBackendFormattedError(bodyStr) ?: "Invalid summarize request."
                            return@withContext Result.failure(IllegalStateException(msg))
                        }
                    }
                } catch (ce: CancellationException) {
                    throw ce
                } catch (_: Exception) {
                    // Fail over to /api/brain/coordinate then direct keys
                }

                val coordSummary = requestBackendCoordinateText(
                    prompt = summaryPrompt,
                    languageInstruction = "Respond cleanly in ${language.displayName}."
                )
                if (!coordSummary.isNullOrBlank()) {
                    recordQuotaSuccess()
                    return@withContext Result.success(coordSummary)
                }
                if (!hasDirectApiKey) {
                    return@withContext Result.failure(IllegalStateException("Unable to summarize conversation via backend or direct providers."))
                }
            }

            val outcome = executeDirectGenerateContent(
                enableBackoff = true,
                maxPrimaryRetries = GeminiBackoffPolicy.DEFAULT_MAX_RETRIES,
                fallbackPrompt = summaryPrompt,
                fallbackTemperature = 0.3,
                fallbackMaxTokens = 1024
            ) { candidateModel ->
                JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("role", "user")
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply { put("text", summaryPrompt) })
                            })
                        })
                    })
                    put("generationConfig", JSONObject().apply {
                        put("temperature", 0.3)
                        put("maxOutputTokens", 1024)
                        put("thinkingConfig", buildThinkingConfigJson(candidateModel, 0))
                    })
                }
            }

            if (outcome.failure != null) {
                recordQuotaError(outcome.failure)
                return@withContext Result.failure(IllegalStateException(outcome.failure.displayMessage))
            }
            recordQuotaSuccess()
            val summary = outcome.value.orEmpty()
            if (summary.isBlank()) {
                return@withContext Result.failure(IllegalStateException("AI returned an empty summary."))
            }
            return@withContext Result.success(summary)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            return@withContext Result.failure(
                IllegalStateException(JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Summary failed"))
            )
        }
    }

    suspend fun extractDurableMemories(
        userPrompt: String,
        aiReply: String,
        existingMemories: List<MemoryEntity>
    ): List<ExtractedMemoryCandidate> = withContext(Dispatchers.IO) {
        if (!JarvisBrainEngine.shouldAutoExtractMemories(userPrompt)) return@withContext emptyList()
        if (isBackgroundQuotaCooldownActive()) return@withContext emptyList()
        if (MemoryDeduplicator.containsSensitiveSecret(userPrompt)) return@withContext emptyList()
        if (!usesBackendProxy && !hasRealApiKey) return@withContext emptyList()

        try {
            if (usesBackendProxy) {
                val existingArray = JSONArray().apply {
                    existingMemories.take(25).forEach { mem ->
                        put(JSONObject().apply {
                            put("key", mem.key)
                            put("category", mem.category)
                            put("content", mem.content)
                        })
                    }
                }
                val payload = JSONObject().apply {
                    put("userPrompt", userPrompt.trim().take(2000))
                    put("aiReply", aiReply.trim().take(1500))
                    put("existingMemories", existingArray)
                }
                val req = Request.Builder()
                    .url("${backendUrl}/api/memory/extract")
                    .apply {
                        if (appAccessToken.isNotBlank()) {
                            addHeader("Authorization", "Bearer $appAccessToken")
                        }
                    }
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                try {
                    backendFastClient.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val bodyStr = resp.body?.string().orEmpty()
                            return@withContext parseExtractedMemoriesJson(bodyStr)
                        }
                    }
                } catch (_: Exception) {
                    // Fail over to direct keys if configured
                }
                if (!hasDirectApiKey) return@withContext emptyList()
            }

            val existingSummary = existingMemories.take(25).joinToString("\n") {
                "- [${it.category}] ${it.key}: ${it.content}"
            }.ifBlank { "(none)" }

            val extractionPrompt = """
                Analyze the conversation turn below and extract ONLY durable, long-term personal facts worth remembering about the user (preferences, language/response style, projects & ongoing tasks, standing instructions, frequently discussed topics, important decisions).
                Never extract secrets, passwords, PINs, or API keys.
                If an item updates or overrides an existing memory key, emit the updated content using the same key.
                Ignore greetings and one-off trivia already matching EXISTING MEMORIES.
                Return strict JSON matching this schema: {"memories":[{"key":"short title","category":"PREFERENCE|PROJECT|INSTRUCTION|TOPIC|DECISION|FACT","content":"concise durable fact","importance":3}]}
                Return {"memories":[]} if nothing durable was revealed. Maximum 3 items.

                EXISTING MEMORIES:
                $existingSummary

                USER MESSAGE:
                ${userPrompt.trim().take(2000)}

                ASSISTANT REPLY:
                ${aiReply.trim().take(1500)}
            """.trimIndent()

            val outcome = executeDirectGenerateContent(
                enableBackoff = false,
                maxPrimaryRetries = 0,
                fallbackPrompt = extractionPrompt,
                fallbackTemperature = 0.2,
                fallbackMaxTokens = 768,
                fallbackJson = true
            ) { candidateModel ->
                JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("role", "user")
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply { put("text", extractionPrompt) })
                            })
                        })
                    })
                    put("generationConfig", JSONObject().apply {
                        put("temperature", 0.2)
                        put("maxOutputTokens", 768)
                        put("responseMimeType", "application/json")
                        put("thinkingConfig", buildThinkingConfigJson(candidateModel, 0))
                    })
                }
            }
            if (outcome.failure != null) {
                recordQuotaError(outcome.failure)
                return@withContext emptyList()
            }
            return@withContext parseExtractedMemoriesJson(outcome.value.orEmpty())
        } catch (e: Exception) {
            Log.w(TAG, "Memory extraction skipped: ${e.message}")
            return@withContext emptyList()
        }
    }

    suspend fun parseNaturalReminder(naturalText: String): ParsedReminder = withContext(Dispatchers.IO) {
        val trimmed = naturalText.trim()
        val nowMs = System.currentTimeMillis()
        if (trimmed.isEmpty() || isBackgroundQuotaCooldownActive() || (!usesBackendProxy && !hasRealApiKey)) {
            return@withContext ReminderParser.parseFallback(trimmed, nowMs)
        }

        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date(nowMs))

        try {
            if (usesBackendProxy) {
                val offsetMin = -TimeZone.getDefault().getOffset(nowMs) / 60_000
                val payload = JSONObject().apply {
                    put("text", trimmed)
                    put("nowIso", nowIso)
                    put("timezoneOffsetMinutes", offsetMin)
                }
                val req = Request.Builder()
                    .url("${backendUrl}/api/reminders/parse")
                    .apply {
                        if (appAccessToken.isNotBlank()) {
                            addHeader("Authorization", "Bearer $appAccessToken")
                        }
                    }
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                try {
                    backendFastClient.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val bodyStr = resp.body?.string().orEmpty()
                            return@withContext ReminderParser.parseGeminiJson(bodyStr, trimmed, nowMs)
                        }
                    }
                } catch (_: Exception) {
                    // Fail over to direct AI or local parser
                }
                if (!hasDirectApiKey) return@withContext ReminderParser.parseFallback(trimmed, nowMs)
            }

            val offsetHours = TimeZone.getDefault().getOffset(nowMs) / 3_600_000.0
            val prompt = """
                Parse the natural-language reminder request into strict JSON.
                Current reference UTC timestamp: $nowIso (local UTC offset hours: $offsetHours).
                Return ONLY JSON matching this schema:
                {"title":"concise task title","description":"context or original request","dueTime":"human friendly label e.g. Tomorrow 5:00 PM","delayMinutes":null,"dueIso":null,"priority":"HIGH|MEDIUM|LOW","category":"REMINDER|TASK|SCHEDULE|NOTE"}
                Prefer setting delayMinutes for relative phrases like "in 10 minutes", and dueIso with offset for dates/times like "tomorrow at 5 pm".

                REQUEST: "${trimmed.take(500)}"
            """.trimIndent()

            val outcome = executeDirectGenerateContent(
                enableBackoff = false,
                maxPrimaryRetries = 0,
                fallbackPrompt = prompt,
                fallbackTemperature = 0.1,
                fallbackMaxTokens = 512,
                fallbackJson = true
            ) { candidateModel ->
                JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("role", "user")
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply { put("text", prompt) })
                            })
                        })
                    })
                    put("generationConfig", JSONObject().apply {
                        put("temperature", 0.1)
                        put("maxOutputTokens", 512)
                        put("responseMimeType", "application/json")
                        put("thinkingConfig", buildThinkingConfigJson(candidateModel, 0))
                    })
                }
            }
            if (outcome.failure != null) {
                recordQuotaError(outcome.failure)
                return@withContext ReminderParser.parseFallback(trimmed, nowMs)
            }
            return@withContext ReminderParser.parseGeminiJson(outcome.value.orEmpty(), trimmed, nowMs)
        } catch (e: Exception) {
            Log.w(TAG, "Using local reminder parser fallback: ${e.message}")
            return@withContext ReminderParser.parseFallback(trimmed, nowMs)
        }
    }

    suspend fun fetchOpenMeteoWeatherSummary(
        lat: Double = DEFAULT_WEATHER_LAT,
        lon: Double = DEFAULT_WEATHER_LON,
        cityLabel: String = ""
    ): String = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current_weather=true")
                .get()
                .build()
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@withContext "Weather feed HTTP ${resp.code}"
                val root = JSONObject(resp.body?.string().orEmpty())
                val cw = root.optJSONObject("current_weather") ?: return@withContext "Weather standby"
                val temp = cw.optDouble("temperature", Double.NaN)
                if (temp.isNaN()) return@withContext "Weather standby"
                val wind = cw.optDouble("windspeed", 0.0)
                val code = cw.optInt("weathercode", 0)
                val condition = when (code) {
                    0 -> "Clear sky"
                    1, 2 -> "Partly cloudy"
                    3 -> "Overcast"
                    45, 48 -> "Fog"
                    51, 53, 55, 61, 63, 65 -> "Rain"
                    71, 73, 75 -> "Snow"
                    80, 81, 82 -> "Showers"
                    95 -> "Thunderstorm"
                    else -> "Nominal conditions"
                }
                val prefix = cityLabel.trim().takeIf { it.isNotBlank() }?.let { "$it: " }.orEmpty()
                "$prefix${Math.round(temp)}°C, $condition • Wind ${Math.round(wind)} km/h"
            }
        } catch (_: Exception) {
            "Weather unavailable (offline)"
        }
    }

    suspend fun searchOpenMeteoCities(query: String): Result<List<WeatherCityResult>> = withContext(Dispatchers.IO) {
        val cleaned = query.trim()
        if (cleaned.length < 2) return@withContext Result.success(emptyList())
        try {
            val encoded = URLEncoder.encode(cleaned, "UTF-8")
            val req = Request.Builder()
                .url("https://geocoding-api.open-meteo.com/v1/search?name=$encoded&count=8&language=en&format=json")
                .get()
                .build()
            discoveryClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    return@withContext Result.failure(IllegalStateException("City search HTTP ${resp.code}"))
                }
                val root = JSONObject(resp.body?.string().orEmpty())
                val results = root.optJSONArray("results") ?: JSONArray()
                val list = buildList {
                    for (i in 0 until results.length()) {
                        val obj = results.optJSONObject(i) ?: continue
                        val name = obj.optString("name").trim()
                        val lat = obj.optDouble("latitude", Double.NaN)
                        val lon = obj.optDouble("longitude", Double.NaN)
                        if (name.isBlank() || lat.isNaN() || lon.isNaN()) continue
                        add(
                            WeatherCityResult(
                                name = name,
                                region = obj.optString("admin1").trim(),
                                country = obj.optString("country").trim(),
                                latitude = lat,
                                longitude = lon
                            )
                        )
                    }
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun generateDailyBriefingLine(
        tasksSummary: String,
        weatherSummary: String,
        batterySummary: String,
        language: JarvisLanguage
    ): Pair<String, String> = withContext(Dispatchers.IO) {
        val fallback = when (language) {
            JarvisLanguage.HINGLISH -> "Sabhi systems ready hain! Aaj ke primary tasks par focus karte hain."
            JarvisLanguage.HINDI -> "सभी प्रणालियाँ तैयार हैं। आइए आज के मुख्य लक्ष्यों पर ध्यान केंद्रित करें।"
            else -> "All AM AI systems calibrated and ready. Let's tackle your top priorities today."
        }
        if (isBackgroundQuotaCooldownActive() || (!usesBackendProxy && !hasRealApiKey)) {
            return@withContext fallback to "fallback"
        }

        val cacheKey = "${language.name}|${tasksSummary.take(180)}|${weatherSummary.take(120)}"
        briefingMutex.withLock {
            val now = System.currentTimeMillis()
            val cached = cachedBriefingResult
            if (cached != null && cachedBriefingKey == cacheKey && (now - cachedBriefingAtMs) < 5 * 60 * 1000L) {
                return@withLock cached
            }
            if (isBackgroundQuotaCooldownActive()) {
                return@withLock fallback to "fallback"
            }

            val result = try {
                var backendResolved: Pair<String, String>? = null
                if (usesBackendProxy) {
                    val payload = JSONObject().apply {
                        put("tasksSummary", tasksSummary.take(500))
                        put("weatherSummary", weatherSummary.take(200))
                        put("batterySummary", batterySummary.take(120))
                        put("language", language.name)
                    }
                    val req = Request.Builder()
                        .url("${backendUrl}/api/briefing")
                        .apply {
                            if (appAccessToken.isNotBlank()) addHeader("Authorization", "Bearer $appAccessToken")
                        }
                        .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                        .build()
                    backendResolved = try {
                        backendFastClient.newCall(req).execute().use { resp ->
                            if (!resp.isSuccessful) {
                                null
                            } else {
                                val obj = JSONObject(resp.body?.string().orEmpty())
                                val line = obj.optString("line").trim()
                                val src = obj.optString("source", "fallback")
                                if (line.isNotBlank() && src != "fallback") line to src else null
                            }
                        }
                    } catch (_: Exception) {
                        null
                    }
                    if (backendResolved == null) {
                        val coordPrompt = "Compose one crisp 1-2 sentence AM AI executive briefing remark in a warm peer tone in ${language.displayName}. Tasks: ${tasksSummary.take(400)}. Weather: ${weatherSummary.take(180)}. Power: ${batterySummary.take(100)}."
                        val coordLine = requestBackendCoordinateText(
                            prompt = coordPrompt,
                            languageInstruction = "Respond concisely in ${language.displayName}."
                        )
                        if (!coordLine.isNullOrBlank()) {
                            backendResolved = coordLine to "groq"
                        }
                    }
                }

                backendResolved ?: if (hasDirectApiKey) {
                    val prompt = """
                        Compose one crisp, motivating 1-2 sentence AM AI daily briefing remark in a warm, natural peer tone.
                        Respond in ${language.displayName}.
                        Tasks: ${tasksSummary.take(500)}
                        Weather: ${weatherSummary.take(200)}
                        Power: ${batterySummary.take(120)}
                    """.trimIndent()
                    val outcome = executeDirectGenerateContent(
                        enableBackoff = false,
                        maxPrimaryRetries = 0,
                        fallbackPrompt = prompt,
                        fallbackTemperature = 0.65,
                        fallbackMaxTokens = 256
                    ) { candidateModel ->
                        JSONObject().apply {
                            put("contents", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("role", "user")
                                    put("parts", JSONArray().apply {
                                        put(JSONObject().apply { put("text", prompt) })
                                    })
                                })
                            })
                            put("generationConfig", JSONObject().apply {
                                put("temperature", 0.65)
                                put("maxOutputTokens", 256)
                                put("thinkingConfig", buildThinkingConfigJson(candidateModel, 0))
                            })
                        }
                    }
                    if (outcome.failure != null) {
                        recordQuotaError(outcome.failure)
                        fallback to "fallback"
                    } else {
                        val text = outcome.value.orEmpty().trim()
                        if (text.isNotBlank()) text to "gemini" else fallback to "fallback"
                    }
                } else {
                    fallback to "fallback"
                }
            } catch (_: Exception) {
                fallback to "fallback"
            }

            if (result.second != "fallback") {
                cachedBriefingKey = cacheKey
                cachedBriefingResult = result
                cachedBriefingAtMs = System.currentTimeMillis()
            }
            result
        }
    }

    private fun requestBackendCoordinateText(
        prompt: String,
        languageInstruction: String
    ): String? {
        for (providerId in listOf("groq", "openrouter", null)) {
            try {
                val payload = JSONObject().apply {
                    put("prompt", prompt)
                    put("languageInstruction", languageInstruction.take(580))
                    if (providerId != null) put("provider", providerId)
                    put("memoryEnabled", false)
                    put("temporaryChat", true)
                }
                val req = Request.Builder()
                    .url("${backendUrl}/api/brain/coordinate")
                    .apply {
                        if (appAccessToken.isNotBlank()) addHeader("Authorization", "Bearer $appAccessToken")
                    }
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                backendFastClient.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use
                    val obj = JSONObject(resp.body?.string().orEmpty())
                    val text = obj.optString("text").trim()
                    if (text.isNotBlank()) return text
                }
            } catch (_: Exception) {
                // Try next free provider
            }
        }
        return null
    }

    companion object {
        const val DEFAULT_MODEL = "gemini-3.8-flash"
        const val CHAT_MAX_OUTPUT_TOKENS = 4096
        const val VISION_MAX_OUTPUT_TOKENS = 2048
        const val MAX_HISTORY_MESSAGES = 10
        const val MAX_HISTORY_CHARS = 9600
        const val MAX_MEMORY_CONTEXT_ITEMS = 4
        const val MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
        const val BACKEND_FIRST_TOKEN_TIMEOUT_MS = 6_000L
        const val BACKEND_CIRCUIT_DURATION_MS = 3 * 60 * 1000L
        const val DEFAULT_WEATHER_LAT = 21.1702
        const val DEFAULT_WEATHER_LON = 72.8311
        const val DEFAULT_WEATHER_CITY = "Surat, India"

        private val DEPRECATED_MODEL_REGEXES = listOf(
            Regex("^gemini-1(?:\\.0|\\.5)?(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.0(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash$", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash-preview", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash-lite-preview", RegexOption.IGNORE_CASE),
            Regex("-09-2025$", RegexOption.IGNORE_CASE)
        )

        private val GEMINI_3_OR_NEWER_REGEX = Regex("^gemini-(?:[3-9]|\\d{2,})(?:\\.|-|$)", RegexOption.IGNORE_CASE)

        fun resolveActiveModel(rawModel: String?): String {
            val cleaned = rawModel.orEmpty()
                .trim()
                .removePrefix("models/")
                .removePrefix("MODELS/")
                .trim()
            if (cleaned.isBlank() ||
                cleaned.equals("UNSET", ignoreCase = true) ||
                cleaned.equals("NONE", ignoreCase = true) ||
                cleaned == "\"\""
            ) {
                return DEFAULT_MODEL
            }
            if (DEPRECATED_MODEL_REGEXES.any { it.containsMatchIn(cleaned) }) {
                return DEFAULT_MODEL
            }
            // Strict ₹0 zero-cost guard: reject paid or unknown models (e.g. Pro, Ultra, GPT-4o)
            if (!GeminiFreeModelFallbackManager.isApprovedFreeTierModel(cleaned)) {
                return DEFAULT_MODEL
            }
            return cleaned
        }

        fun isGemini3OrNewer(model: String): Boolean {
            val cleaned = model.trim().removePrefix("models/").removePrefix("MODELS/")
            return GEMINI_3_OR_NEWER_REGEX.containsMatchIn(cleaned)
        }

        fun buildThinkingConfigJson(model: String, thinkingBudget: Int): JSONObject {
            return JSONObject().apply {
                if (isGemini3OrNewer(model)) {
                    val level = when {
                        thinkingBudget >= 1024 -> "HIGH"
                        thinkingBudget > 0 -> "MEDIUM"
                        else -> "LOW"
                    }
                    put("thinkingLevel", level)
                } else {
                    put("thinkingBudget", thinkingBudget.coerceIn(0, 2048))
                }
            }
        }

        fun extractNonThoughtText(root: JSONObject): String {
            val parts = root.optJSONArray("candidates")
                ?.optJSONObject(0)
                ?.optJSONObject("content")
                ?.optJSONArray("parts")
                ?: return ""
            val sb = StringBuilder()
            for (i in 0 until parts.length()) {
                val part = parts.optJSONObject(i) ?: continue
                if (part.optBoolean("thought", false)) continue
                val textChunk = part.optString("text")
                if (textChunk.isNotEmpty()) sb.append(textChunk)
            }
            return sb.toString()
        }

        private val ERROR_PREFIXES = listOf(
            "[HTTP ",
            "Gemini returned an empty response",
            "Real-time Free Multi-Provider AI requires",
            "Received an empty response stream",
            "The backend stream completed",
            "Attachment \"",
            "Sir, Gemini",
            "Sir, communication with the Gemini",
            "Sir, the Gemini",
            "Sir, the network link to Gemini",
            "Sir, the request could not be processed",
            "Sir, an anomaly was encountered",
            "Sir, received an empty response",
            "Sir, real-time Gemini Cloud AI requires",
            "Sir, all free backend AI providers",
            "Sir, the backend stream completed"
        )

        fun isErrorConversation(msg: ConversationEntity): Boolean {
            return msg.isError || ERROR_PREFIXES.any { msg.text.startsWith(it) }
        }

        fun normalizeHistoryMessages(history: List<ConversationEntity>): List<Pair<String, String>> {
            val valid = history
                .filter { it.text.isNotBlank() && !isErrorConversation(it) }
                .takeLast(MAX_HISTORY_MESSAGES)

            val merged = mutableListOf<Pair<String, String>>()
            for (item in valid) {
                val role = if (item.role == "jarvis" || item.role == "model") "model" else "user"
                val text = item.text.trim()
                if (merged.isEmpty()) {
                    if (role == "user") {
                        merged.add(role to text)
                    }
                    continue
                }
                val last = merged.last()
                if (last.first == role) {
                    merged[merged.lastIndex] = role to "${last.second}\n\n$text"
                } else {
                    merged.add(role to text)
                }
            }
            var totalChars = 0
            val budgetedReversed = mutableListOf<Pair<String, String>>()
            for (turn in merged.asReversed()) {
                val len = turn.second.length
                if (budgetedReversed.isNotEmpty() && totalChars + len > MAX_HISTORY_CHARS) {
                    break
                }
                budgetedReversed.add(turn.first to turn.second.take(MAX_HISTORY_CHARS))
                totalChars += len
            }
            val result = budgetedReversed.asReversed().toMutableList()
            while (result.isNotEmpty() && result.first().first != "user") {
                result.removeAt(0)
            }
            return result
        }

        fun buildAlternatingContents(history: List<ConversationEntity>, finalPrompt: String): JSONArray {
            val turns = normalizeHistoryMessages(history).toMutableList()
            val promptText = finalPrompt.trim()
            if (promptText.isNotEmpty()) {
                if (turns.isNotEmpty() && turns.last().first == "user") {
                    turns[turns.lastIndex] = "user" to "${turns.last().second}\n\n$promptText"
                } else {
                    turns.add("user" to promptText)
                }
            }

            return JSONArray().apply {
                for ((role, text) in turns) {
                    put(JSONObject().apply {
                        put("role", role)
                        put("parts", JSONArray().apply {
                            put(JSONObject().apply { put("text", text) })
                        })
                    })
                }
            }
        }

        fun buildBackendHistoryArray(history: List<ConversationEntity>): JSONArray {
            val turns = normalizeHistoryMessages(history)
            return JSONArray().apply {
                for ((role, text) in turns) {
                    put(JSONObject().apply {
                        put("role", role)
                        put("text", text)
                    })
                }
            }
        }

        fun parseSseDataLine(rawLine: String, isBackendStream: Boolean = false): SseLineEvent {
            val trimmed = rawLine.trim()
            if (!trimmed.startsWith("data:")) return SseLineEvent.Ignore
            val payload = trimmed.removePrefix("data:").trim()
            if (payload.isEmpty()) return SseLineEvent.Ignore
            if (payload == "[DONE]") return SseLineEvent.Done

            return try {
                val parsed = JSONObject(payload)
                if (isBackendStream) {
                    val err = parsed.optString("error")
                    if (err.isNotBlank()) return SseLineEvent.Error(err, isPreFormatted = true)
                    if (parsed.optBoolean("done", false)) return SseLineEvent.Done
                    val metaObj = parsed.optJSONObject("meta")
                    if (metaObj != null) {
                        return SseLineEvent.Meta(
                            intent = metaObj.optString("intent").takeIf { it.isNotBlank() },
                            language = metaObj.optString("language").takeIf { it.isNotBlank() },
                            model = metaObj.optString("model").takeIf { it.isNotBlank() },
                            primaryModel = metaObj.optString("primaryModel").takeIf { it.isNotBlank() },
                            fallbackUsed = metaObj.optBoolean("fallbackUsed", false),
                            provider = metaObj.optString("provider").takeIf { it.isNotBlank() },
                            providerLabel = metaObj.optString("providerLabel").takeIf { it.isNotBlank() },
                            primaryProvider = metaObj.optString("primaryProvider").takeIf { it.isNotBlank() },
                            switchedFromProvider = metaObj.optString("switchedFromProvider").takeIf { it.isNotBlank() }
                        )
                    }
                    val textChunk = parsed.optString("text")
                    if (textChunk.isNotEmpty()) SseLineEvent.Text(textChunk) else SseLineEvent.Ignore
                } else {
                    val errObj = parsed.optJSONObject("error")
                    if (errObj != null) {
                        return SseLineEvent.Error(payload, isPreFormatted = false)
                    }
                    val combined = extractNonThoughtText(parsed)
                    if (combined.isNotEmpty()) SseLineEvent.Text(combined) else SseLineEvent.Ignore
                }
            } catch (_: Exception) {
                SseLineEvent.Ignore
            }
        }

        fun parseExtractedMemoriesJson(rawJson: String): List<ExtractedMemoryCandidate> {
            val cleaned = rawJson.trim()
                .removePrefix("```json")
                .removePrefix("```JSON")
                .removePrefix("```")
                .removeSuffix("```")
                .trim()
            if (cleaned.isEmpty()) return emptyList()

            return try {
                val arr = if (cleaned.startsWith("[")) {
                    JSONArray(cleaned)
                } else {
                    JSONObject(cleaned).optJSONArray("memories") ?: JSONArray()
                }
                val list = mutableListOf<ExtractedMemoryCandidate>()
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val rawKey = obj.opt("key")
                    val rawContent = obj.opt("content")
                    if (rawKey !is String || rawContent !is String) continue
                    val importanceVal = obj.optDouble("importance", 3.0)
                    val safeImportance = if (importanceVal.isFinite()) importanceVal.toInt().coerceIn(1, 5) else 3
                    val candidate = ExtractedMemoryCandidate(
                        key = rawKey,
                        category = (obj.opt("category") as? String) ?: "FACT",
                        content = rawContent,
                        importance = safeImportance
                    )
                    MemoryDeduplicator.sanitizeCandidate(candidate)?.let { list.add(it) }
                }
                list
            } catch (_: Exception) {
                emptyList()
            }
        }
    }
}
