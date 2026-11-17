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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.ceil

sealed class SseLineEvent {
    data class Text(val chunk: String) : SseLineEvent()
    data class Meta(val intent: String?, val language: String?) : SseLineEvent()
    data class Error(val message: String, val isPreFormatted: Boolean = false) : SseLineEvent()
    data object Done : SseLineEvent()
    data object Ignore : SseLineEvent()
}

class AiRepository {
    private val TAG = "AiRepository"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    // Protective cooldown for optional background Gemini helpers (never blocks explicit user chat)
    @Volatile
    private var backgroundQuotaCooldownUntilMs: Long = 0L

    private val briefingMutex = Mutex()
    private var cachedBriefingKey: String = ""
    private var cachedBriefingResult: Pair<String, String>? = null
    private var cachedBriefingAtMs: Long = 0L

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
        return System.currentTimeMillis() < backgroundQuotaCooldownUntilMs
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
            BuildConfig.BACKEND_URL.trim().takeUnless { isUnsetSentinel(it) }.orEmpty().trimEnd('/')
        } catch (_: Exception) {
            ""
        }

    private val appAccessToken: String
        get() = try {
            BuildConfig.APP_ACCESS_TOKEN.trim().takeUnless { isUnsetSentinel(it) }.orEmpty()
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

    val hasRealApiKey: Boolean
        get() = usesBackendProxy || (apiKey.isNotBlank() && apiKey != "MY_GEMINI_API_KEY")

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
        analysisOverride: BrainAnalysis? = null
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
        val request = if (usesBackendProxy) {
            buildBackendRequest(
                prompt = prompt,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                enableWebSearch = enableWebSearch || agent == JarvisAgent.VERONICA_RESEARCH
            )
        } else {
            buildDirectGeminiRequest(
                prompt = prompt,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                thinkingBudget = analysis.thinkingBudget,
                includeThinkingConfig = true
            )
        }
        val fallbackRequest = if (!usesBackendProxy) {
            buildDirectGeminiRequest(
                prompt = prompt,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                thinkingBudget = 0,
                includeThinkingConfig = false
            )
        } else {
            null
        }
        return streamRequest(request, fallbackRequest)
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
        retrievedConversationSnippets: List<String> = emptyList()
    ): Flow<String> {
        val approxBytes = (fileBase64.length * 3) / 4
        if (approxBytes > MAX_ATTACHMENT_BYTES) {
            return callbackFlow {
                trySend("Sir, attachment \"$fileName\" exceeds the 4 MB processing limit.")
                close()
                awaitClose {}
            }
        }
        val effectivePrompt = prompt.ifBlank {
            "Please analyze the attached file ($fileName) and summarize its key details, Sir."
        }
        val validHistory = history.filter { it.text.isNotBlank() && !isErrorConversation(it) }
        val analysis = JarvisBrainEngine.analyzePrompt(
            prompt = effectivePrompt,
            selectedLanguage = language,
            hasHistory = validHistory.isNotEmpty()
        )
        val recentHistory = validHistory.takeLast(JarvisBrainEngine.MAX_RECENT_TURNS)

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
        val request = if (usesBackendProxy) {
            buildMultimodalBackendRequest(
                prompt = effectivePrompt,
                fileBase64 = fileBase64,
                mimeType = mimeType,
                fileName = fileName,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                enableWebSearch = enableWebSearch || agent == JarvisAgent.VERONICA_RESEARCH
            )
        } else {
            buildMultimodalDirectGeminiRequest(
                prompt = effectivePrompt,
                fileBase64 = fileBase64,
                mimeType = mimeType,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                includeThinkingConfig = true
            )
        }
        val fallbackRequest = if (!usesBackendProxy) {
            buildMultimodalDirectGeminiRequest(
                prompt = effectivePrompt,
                fileBase64 = fileBase64,
                mimeType = mimeType,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                includeThinkingConfig = false
            )
        } else {
            null
        }
        return streamRequest(request, fallbackRequest)
    }

    private fun streamRequest(request: Request, fallbackRequest: Request? = null): Flow<String> = callbackFlow {
        if (!usesBackendProxy && !hasRealApiKey) {
            trySend(
                """
                Sir, real-time Gemini Cloud AI requires configuring your GEMINI_API_KEY in the AI Studio Secrets panel or setting BACKEND_URL.

                To connect the live Gemini brain:
                1. Open the Secrets panel in Google AI Studio.
                2. Set GEMINI_API_KEY (or set BACKEND_URL to your deployed JARVIS Express server).
                3. The full multi-agent Gemini intelligence mesh will stream live responses immediately.

                Current Engine: Standby (Awaiting API Key Authorization).
                """.trimIndent()
            )
            close()
            awaitClose {}
            return@callbackFlow
        }

        val activeCallRef = AtomicReference<Call?>(null)
        val isCancelledByConsumer = AtomicBoolean(false)

        val streamJob = launch(Dispatchers.IO) {
            val accumulatedText = StringBuilder()
            var activeRequest = request
            var usedThinkingFallback = false
            var retryAttempt = 0
            // When proxying through JARVIS backend, the backend already applies bounded backoff (avoid retry storms)
            val maxRetries = if (usesBackendProxy) 0 else GeminiBackoffPolicy.DEFAULT_MAX_RETRIES

            try {
                while (true) {
                    val call = client.newCall(activeRequest)
                    activeCallRef.set(call)
                    if (isCancelledByConsumer.get()) break

                    val response = call.execute()
                    var shouldRetryNext = false

                    response.use { resp ->
                        if (!resp.isSuccessful) {
                            val errorBody = resp.body?.string().orEmpty()
                            val retryAfterHeader = resp.header("Retry-After")

                            // Only drop thinkingConfig on HTTP 400 when Gemini specifically rejected thinkingConfig
                            if (!usedThinkingFallback && fallbackRequest != null && isThinkingCompatibilityError(resp.code, errorBody)) {
                                usedThinkingFallback = true
                                activeRequest = fallbackRequest
                                shouldRetryNext = true
                                return@use
                            }

                            val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                rawMessage = errorBody,
                                httpCode = resp.code,
                                errorBody = errorBody,
                                retryAfterHeader = retryAfterHeader
                            )
                            Log.e(
                                TAG,
                                "Upstream AI error http=${resp.code} code=${classification.code} " +
                                    "category=${classification.quotaCategory} retryable=${classification.retryable} " +
                                    "retryAfter=${classification.retryAfterSeconds} body=$errorBody"
                            )
                            recordQuotaError(classification)

                            val backoffDelayMs = GeminiBackoffPolicy.nextRetryDelayMs(
                                classification = classification,
                                attempt = retryAttempt,
                                maxRetries = maxRetries,
                                hasEmittedOutput = accumulatedText.isNotEmpty(),
                                isAborted = isCancelledByConsumer.get() || call.isCanceled()
                            )

                            if (backoffDelayMs != null) {
                                retryAttempt += 1
                                Log.w(
                                    TAG,
                                    "Temporary ${classification.code} (HTTP ${resp.code}); exponential backoff retry $retryAttempt/$maxRetries in ${backoffDelayMs}ms"
                                )
                                delay(backoffDelayMs)
                                if (!isCancelledByConsumer.get()) {
                                    shouldRetryNext = true
                                }
                                return@use
                            }

                            val displayMessage = if (usesBackendProxy) {
                                extractBackendFormattedError(errorBody) ?: classification.displayMessage
                            } else {
                                classification.displayMessage
                            }
                            trySend(displayMessage)
                            close()
                            return@launch
                        }

                        val body = resp.body
                        if (body == null) {
                            trySend("Sir, received an empty response stream from the Gemini neural link.")
                            close()
                            return@launch
                        }

                        BufferedReader(InputStreamReader(body.byteStream())).use { reader ->
                            var line: String?
                            while (reader.readLine().also { line = it } != null) {
                                val currentLine = line ?: continue
                                when (val event = parseSseDataLine(currentLine, isBackendStream = usesBackendProxy)) {
                                    is SseLineEvent.Text -> {
                                        if (event.chunk.isNotEmpty()) {
                                            accumulatedText.append(event.chunk)
                                            trySend(accumulatedText.toString())
                                        }
                                    }
                                    is SseLineEvent.Meta -> Unit
                                    is SseLineEvent.Error -> {
                                        val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(event.message)
                                        recordQuotaError(classification)
                                        val finalErrorText = if (event.isPreFormatted) event.message else classification.displayMessage
                                        trySend(finalErrorText)
                                        close()
                                        return@launch
                                    }
                                    SseLineEvent.Done -> break
                                    SseLineEvent.Ignore -> Unit
                                }
                            }
                        }

                        recordQuotaSuccess()
                        if (accumulatedText.isBlank()) {
                            trySend("Sir, Gemini returned an empty response.")
                        }
                        close()
                        return@launch
                    }

                    if (!shouldRetryNext) break
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                if (!isCancelledByConsumer.get() && activeCallRef.get()?.isCanceled() != true) {
                    Log.e(TAG, "Gemini network stream failed", e)
                    trySend(JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Connection failed"))
                }
                close()
            }
        }

        awaitClose {
            isCancelledByConsumer.set(true)
            activeCallRef.get()?.cancel()
            streamJob.cancel()
        }
    }

    private fun buildDirectGeminiRequest(
        prompt: String,
        systemInstructionText: String,
        history: List<ConversationEntity>,
        thinkingBudget: Int = 0,
        includeThinkingConfig: Boolean = true
    ): Request {
        val activeModel = modelName
        val jsonPayload = JSONObject().apply {
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply { put("text", systemInstructionText) })
                })
            })
            put("contents", buildAlternatingContents(history, prompt))
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.7)
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
        includeThinkingConfig: Boolean = true
    ): Request {
        val activeModel = modelName
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
        enableWebSearch: Boolean
    ): Request {
        val backendHistory = buildBackendHistoryArray(history)
        val jsonPayload = JSONObject().apply {
            put("prompt", prompt)
            put("systemInstruction", systemInstructionText)
            put("history", backendHistory)
            put("enableWebSearch", enableWebSearch)
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
        enableWebSearch: Boolean
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
            "Relevant Long-Term Memory Facts from Owner Vault:\n" +
                orderedMemories.joinToString("\n") { "- [${it.category}] ${it.key}: ${it.content}" }
        } else {
            "No memory records stored yet."
        }

        val pastChatContext = if (retrievedConversationSnippets.isNotEmpty()) {
            "Relevant Past Conversation Excerpts:\n" +
                retrievedConversationSnippets.joinToString("\n") { "- $it" }
        } else {
            ""
        }

        val telemetryContext = telemetry?.let {
            "Real Device Hardware Telemetry:\n- Battery: ${it.batteryLevel}% (${if (it.isCharging) "Charging" else "Discharging"})\n- RAM: ${it.ramUsedMb}MB / ${it.ramTotalMb}MB (${it.ramPercent}%)\n- Network: ${it.networkType}"
        } ?: "Telemetry: Standby"

        val langDirective = when (language) {
            JarvisLanguage.HINDI -> "Respond exclusively in refined, sophisticated Hindi (हिंदी). Maintain the elite JARVIS personal assistant persona, addressing the user as Sir."
            JarvisLanguage.HINGLISH -> "Respond naturally in Hinglish (natural conversational Hindi-English mix in Latin script) matching the user's tone while staying crisp and helpful as JARVIS."
            JarvisLanguage.GUJARATI -> "Respond exclusively in refined, polite Gujarati (ગુજરાતી). Maintain the elite JARVIS personal assistant persona, addressing the user as Sir."
            JarvisLanguage.ENGLISH -> "Respond in refined British English. Address the user respectfully as 'Sir'. Exhibit subtle intelligence, calm confidence, and sophisticated wit."
        }

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
            langDirective,
            brainBlock,
            telemetryContext,
            memoryContext,
            pastChatContext
        ).filter { it.isNotBlank() }.joinToString("\n\n")
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
                client.newCall(req).execute().use { resp ->
                    val bodyStr = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        val classification = JarvisBrainEngine.classifyGeminiErrorDetailed(
                            rawMessage = bodyStr,
                            httpCode = resp.code,
                            errorBody = bodyStr,
                            retryAfterHeader = resp.header("Retry-After")
                        )
                        recordQuotaError(classification)
                        val msg = extractBackendFormattedError(bodyStr) ?: classification.displayMessage
                        return@withContext Result.failure(IllegalStateException(msg))
                    }
                    recordQuotaSuccess()
                    val summary = JSONObject(bodyStr).optString("summary").trim()
                    if (summary.isBlank()) {
                        return@withContext Result.failure(IllegalStateException("Empty summary returned."))
                    }
                    return@withContext Result.success(summary)
                }
            } else {
                val activeModel = modelName
                val transcript = valid.takeLast(24).joinToString("\n") { msg ->
                    val speaker = if (msg.role == "user") "Sir" else msg.agentName
                    "$speaker: ${msg.text.trim().take(700)}"
                }
                val prompt = """
                    Summarize the conversation below cleanly in ${language.displayName}.
                    Include:
                    1. Core Topics & Goals
                    2. Key Decisions or Code/Technical Facts
                    3. Open Action Items / Next Steps

                    CONVERSATION:
                    $transcript
                """.trimIndent()

                val jsonPayload = JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("role", "user")
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply { put("text", prompt) })
                            })
                        })
                    })
                    put("generationConfig", JSONObject().apply {
                        put("temperature", 0.3)
                        put("maxOutputTokens", 1024)
                        put("thinkingConfig", buildThinkingConfigJson(activeModel, 0))
                    })
                }
                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                data class SummaryCallOutcome(
                    val summary: String? = null,
                    val error: GeminiErrorClassification? = null
                )

                val outcome = GeminiBackoffPolicy.executeWithBackoff(
                    maxRetries = GeminiBackoffPolicy.DEFAULT_MAX_RETRIES,
                    classifyFailure = { it.error },
                    onRetry = { attempt, max, delayMs, cls ->
                        Log.w(TAG, "Summarize temporary ${cls.code}; retry $attempt/$max in ${delayMs}ms")
                    }
                ) {
                    client.newCall(req).execute().use { resp ->
                        val bodyStr = resp.body?.string().orEmpty()
                        if (!resp.isSuccessful) {
                            val cls = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                rawMessage = bodyStr,
                                httpCode = resp.code,
                                errorBody = bodyStr,
                                retryAfterHeader = resp.header("Retry-After")
                            )
                            SummaryCallOutcome(error = cls)
                        } else {
                            val root = JSONObject(bodyStr)
                            SummaryCallOutcome(summary = extractNonThoughtText(root).trim())
                        }
                    }
                }

                if (outcome.error != null) {
                    recordQuotaError(outcome.error)
                    return@withContext Result.failure(IllegalStateException(outcome.error.displayMessage))
                }
                recordQuotaSuccess()
                val summary = outcome.summary.orEmpty()
                if (summary.isBlank()) {
                    return@withContext Result.failure(IllegalStateException("Gemini returned an empty summary."))
                }
                return@withContext Result.success(summary)
            }
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

                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext emptyList()
                    val bodyStr = resp.body?.string().orEmpty()
                    return@withContext parseExtractedMemoriesJson(bodyStr)
                }
            } else {
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

                val activeModel = modelName
                val jsonPayload = JSONObject().apply {
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
                        put("thinkingConfig", buildThinkingConfigJson(activeModel, 0))
                    })
                }

                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                client.newCall(req).execute().use { resp ->
                    val bodyStr = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        val cls = JarvisBrainEngine.classifyGeminiErrorDetailed(
                            rawMessage = bodyStr,
                            httpCode = resp.code,
                            errorBody = bodyStr,
                            retryAfterHeader = resp.header("Retry-After")
                        )
                        recordQuotaError(cls)
                        return@withContext emptyList()
                    }
                    val root = JSONObject(bodyStr)
                    val rawModelText = extractNonThoughtText(root)
                    return@withContext parseExtractedMemoriesJson(rawModelText)
                }
            }
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

                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext ReminderParser.parseFallback(trimmed, nowMs)
                    val bodyStr = resp.body?.string().orEmpty()
                    return@withContext ReminderParser.parseGeminiJson(bodyStr, trimmed, nowMs)
                }
            } else {
                val offsetHours = TimeZone.getDefault().getOffset(nowMs) / 3_600_000.0
                val prompt = """
                    Parse the natural-language reminder request into strict JSON.
                    Current reference UTC timestamp: $nowIso (local UTC offset hours: $offsetHours).
                    Return ONLY JSON matching this schema:
                    {"title":"concise task title","description":"context or original request","dueTime":"human friendly label e.g. Tomorrow 5:00 PM","delayMinutes":null,"dueIso":null,"priority":"HIGH|MEDIUM|LOW","category":"REMINDER|TASK|SCHEDULE|NOTE"}
                    Prefer setting delayMinutes for relative phrases like "in 10 minutes", and dueIso with offset for dates/times like "tomorrow at 5 pm".

                    REQUEST: "${trimmed.take(500)}"
                """.trimIndent()

                val activeModel = modelName
                val jsonPayload = JSONObject().apply {
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
                        put("thinkingConfig", buildThinkingConfigJson(activeModel, 0))
                    })
                }

                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                client.newCall(req).execute().use { resp ->
                    val bodyStr = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        val cls = JarvisBrainEngine.classifyGeminiErrorDetailed(
                            rawMessage = bodyStr,
                            httpCode = resp.code,
                            errorBody = bodyStr,
                            retryAfterHeader = resp.header("Retry-After")
                        )
                        recordQuotaError(cls)
                        return@withContext ReminderParser.parseFallback(trimmed, nowMs)
                    }
                    val root = JSONObject(bodyStr)
                    val rawModelText = extractNonThoughtText(root)
                    return@withContext ReminderParser.parseGeminiJson(rawModelText, trimmed, nowMs)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Using local reminder parser fallback: ${e.message}")
            return@withContext ReminderParser.parseFallback(trimmed, nowMs)
        }
    }

    suspend fun fetchOpenMeteoWeatherSummary(lat: Double = 40.7128, lon: Double = -74.006): String =
        withContext(Dispatchers.IO) {
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
                    "${Math.round(temp)}°C, $condition • Wind ${Math.round(wind)} km/h"
                }
            } catch (_: Exception) {
                "Weather unavailable (offline)"
            }
        }

    suspend fun generateDailyBriefingLine(
        tasksSummary: String,
        weatherSummary: String,
        batterySummary: String,
        language: JarvisLanguage
    ): Pair<String, String> = withContext(Dispatchers.IO) {
        val fallback = when (language) {
            JarvisLanguage.HINGLISH -> "Sabhi systems ready hain, Sir. Aaj ke primary tasks par focus karte hain."
            JarvisLanguage.HINDI -> "सभी प्रणालियाँ तैयार हैं, सर। आज के मुख्य लक्ष्यों पर ध्यान केंद्रित करते हैं।"
            else -> "All systems calibrated and awaiting your directive, Sir. Stay sharp on your primary objectives today."
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
                    client.newCall(req).execute().use { resp ->
                        if (!resp.isSuccessful) {
                            fallback to "fallback"
                        } else {
                            val obj = JSONObject(resp.body?.string().orEmpty())
                            val line = obj.optString("line").trim()
                            val src = obj.optString("source", "fallback")
                            (line.ifBlank { fallback }) to src
                        }
                    }
                } else {
                    val prompt = """
                        Compose one crisp, motivating 1-2 sentence JARVIS executive briefing remark addressing the owner as "Sir".
                        Respond in ${language.displayName}.
                        Tasks: ${tasksSummary.take(500)}
                        Weather: ${weatherSummary.take(200)}
                        Power: ${batterySummary.take(120)}
                    """.trimIndent()
                    val activeModel = modelName
                    val jsonPayload = JSONObject().apply {
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
                            put("thinkingConfig", buildThinkingConfigJson(activeModel, 0))
                        })
                    }
                    val req = Request.Builder()
                        .url("https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent")
                        .addHeader("x-goog-api-key", apiKey)
                        .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                        .build()
                    client.newCall(req).execute().use { resp ->
                        val bodyStr = resp.body?.string().orEmpty()
                        if (!resp.isSuccessful) {
                            val cls = JarvisBrainEngine.classifyGeminiErrorDetailed(
                                rawMessage = bodyStr,
                                httpCode = resp.code,
                                errorBody = bodyStr,
                                retryAfterHeader = resp.header("Retry-After")
                            )
                            recordQuotaError(cls)
                            fallback to "fallback"
                        } else {
                            val root = JSONObject(bodyStr)
                            val text = extractNonThoughtText(root).trim()
                            if (text.isNotBlank()) text to "gemini" else fallback to "fallback"
                        }
                    }
                }
            } catch (_: Exception) {
                fallback to "fallback"
            }

            if (result.second == "gemini") {
                cachedBriefingKey = cacheKey
                cachedBriefingResult = result
                cachedBriefingAtMs = System.currentTimeMillis()
            }
            result
        }
    }

    companion object {
        const val DEFAULT_MODEL = "gemini-3.8-flash"
        const val CHAT_MAX_OUTPUT_TOKENS = 4096
        const val VISION_MAX_OUTPUT_TOKENS = 2048
        const val MAX_HISTORY_MESSAGES = 16
        const val MAX_MEMORY_CONTEXT_ITEMS = 8
        const val MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

        private val DEPRECATED_MODEL_REGEXES = listOf(
            Regex("^gemini-1\\.5(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.0(?:-|$)", RegexOption.IGNORE_CASE),
            Regex("^gemini-2\\.5-flash(?:[-a-z0-9.]*)?$", RegexOption.IGNORE_CASE)
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
            "Sir, Gemini",
            "Sir, communication with the Gemini",
            "Sir, the Gemini",
            "Sir, the network link to Gemini",
            "Sir, the request could not be processed",
            "Sir, an anomaly was encountered",
            "Sir, received an empty response stream",
            "Sir, real-time Gemini Cloud AI requires"
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
            return merged
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
                            language = metaObj.optString("language").takeIf { it.isNotBlank() }
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
                    val candidate = ExtractedMemoryCandidate(
                        key = obj.optString("key"),
                        category = obj.optString("category", "FACT"),
                        content = obj.optString("content"),
                        importance = obj.optInt("importance", 3)
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
