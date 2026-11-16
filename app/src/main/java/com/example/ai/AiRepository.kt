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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
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

sealed class SseLineEvent {
    data class Text(val chunk: String) : SseLineEvent()
    data class Meta(val intent: String?, val language: String?) : SseLineEvent()
    data class Error(val message: String) : SseLineEvent()
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

    // Gemini API Key injected securely via Secrets Gradle Plugin from AI Studio Secrets
    private val apiKey: String
        get() = try {
            BuildConfig.GEMINI_API_KEY.trim().takeUnless { isUnsetSentinel(it) }.orEmpty()
        } catch (_: Exception) {
            ""
        }

    val modelName: String
        get() = try {
            BuildConfig.GEMINI_MODEL.trim().takeUnless { isUnsetSentinel(it) }?.ifBlank { DEFAULT_MODEL } ?: DEFAULT_MODEL
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
                thinkingBudget = analysis.thinkingBudget
            )
        }
        val fallbackRequest = if (!usesBackendProxy && analysis.thinkingBudget > 0) {
            buildDirectGeminiRequest(
                prompt = prompt,
                systemInstructionText = systemInstructionText,
                history = recentHistory,
                thinkingBudget = 0
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
                history = recentHistory
            )
        }
        return streamRequest(request, null)
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

        var activeCall: Call = client.newCall(request)
        val streamJob = launch(Dispatchers.IO) {
            val accumulatedText = StringBuilder()
            try {
                var response = activeCall.execute()
                if (!response.isSuccessful && response.code == 400 && fallbackRequest != null) {
                    response.close()
                    activeCall = client.newCall(fallbackRequest)
                    response = activeCall.execute()
                }
                response.use { resp ->
                    if (!resp.isSuccessful) {
                        val errorBody = resp.body?.string().orEmpty()
                        Log.e(TAG, "AI API error ${resp.code}: $errorBody")
                        val rawMsg = try {
                            val errJson = JSONObject(errorBody)
                            errJson.optJSONObject("error")?.optString("message")
                                ?.takeIf { it.isNotBlank() }
                                ?: errJson.optString("error").takeIf { it.isNotBlank() }
                                ?: "HTTP ${resp.code}"
                        } catch (_: Exception) {
                            "HTTP ${resp.code}"
                        }
                        trySend(JarvisBrainEngine.classifyGeminiError(rawMsg, resp.code))
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
                                    trySend(JarvisBrainEngine.classifyGeminiError(event.message))
                                    close()
                                    return@launch
                                }
                                SseLineEvent.Done -> break
                                SseLineEvent.Ignore -> Unit
                            }
                        }
                    }

                    if (accumulatedText.isBlank()) {
                        trySend("Sir, Gemini returned an empty response.")
                    }
                    close()
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                if (!activeCall.isCanceled()) {
                    Log.e(TAG, "Gemini network stream failed", e)
                    trySend(JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Connection failed"))
                }
                close()
            }
        }

        awaitClose {
            activeCall.cancel()
            streamJob.cancel()
        }
    }

    private fun buildDirectGeminiRequest(
        prompt: String,
        systemInstructionText: String,
        history: List<ConversationEntity>,
        thinkingBudget: Int = 0
    ): Request {
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
                put("thinkingConfig", JSONObject().apply {
                    put("thinkingBudget", thinkingBudget.coerceIn(0, 2048))
                })
            })
        }

        val requestUrl = "https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse"
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
        history: List<ConversationEntity>
    ): Request {
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
                put("thinkingConfig", JSONObject().apply {
                    put("thinkingBudget", 0)
                })
            })
        }

        val requestUrl = "https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse"
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
                    put("history", buildBackendHistoryArray(valid.takeLast(24)))
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
                        return@withContext Result.failure(
                            IllegalStateException(JarvisBrainEngine.classifyGeminiError("HTTP ${resp.code}", resp.code))
                        )
                    }
                    val summary = JSONObject(bodyStr).optString("summary").trim()
                    if (summary.isBlank()) {
                        return@withContext Result.failure(IllegalStateException("Empty summary returned."))
                    }
                    return@withContext Result.success(summary)
                }
            } else {
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
                        put("maxOutputTokens", 512)
                        put("thinkingConfig", JSONObject().apply { put("thinkingBudget", 0) })
                    })
                }
                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                client.newCall(req).execute().use { resp ->
                    val bodyStr = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        return@withContext Result.failure(
                            IllegalStateException(JarvisBrainEngine.classifyGeminiError("HTTP ${resp.code}", resp.code))
                        )
                    }
                    val root = JSONObject(bodyStr)
                    val summary = root.optJSONArray("candidates")
                        ?.optJSONObject(0)
                        ?.optJSONObject("content")
                        ?.optJSONArray("parts")
                        ?.optJSONObject(0)
                        ?.optString("text")
                        .orEmpty()
                        .trim()
                    if (summary.isBlank()) {
                        return@withContext Result.failure(IllegalStateException("Gemini returned an empty summary."))
                    }
                    return@withContext Result.success(summary)
                }
            }
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
        if (userPrompt.trim().length < 6) return@withContext emptyList()
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
                        put("maxOutputTokens", 512)
                        put("responseMimeType", "application/json")
                        put("thinkingConfig", JSONObject().apply { put("thinkingBudget", 0) })
                    })
                }

                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext emptyList()
                    val bodyStr = resp.body?.string().orEmpty()
                    val root = JSONObject(bodyStr)
                    val rawModelText = root.optJSONArray("candidates")
                        ?.optJSONObject(0)
                        ?.optJSONObject("content")
                        ?.optJSONArray("parts")
                        ?.optJSONObject(0)
                        ?.optString("text")
                        .orEmpty()
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
        if (trimmed.isEmpty() || (!usesBackendProxy && !hasRealApiKey)) {
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
                        put("maxOutputTokens", 300)
                        put("responseMimeType", "application/json")
                        put("thinkingConfig", JSONObject().apply { put("thinkingBudget", 0) })
                    })
                }

                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()

                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext ReminderParser.parseFallback(trimmed, nowMs)
                    val bodyStr = resp.body?.string().orEmpty()
                    val root = JSONObject(bodyStr)
                    val rawModelText = root.optJSONArray("candidates")
                        ?.optJSONObject(0)
                        ?.optJSONObject("content")
                        ?.optJSONArray("parts")
                        ?.optJSONObject(0)
                        ?.optString("text")
                        .orEmpty()
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
        if (!usesBackendProxy && !hasRealApiKey) {
            return@withContext fallback to "fallback"
        }

        try {
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
                    if (!resp.isSuccessful) return@withContext fallback to "fallback"
                    val obj = JSONObject(resp.body?.string().orEmpty())
                    val line = obj.optString("line").trim()
                    val src = obj.optString("source", "fallback")
                    return@withContext (line.ifBlank { fallback }) to src
                }
            } else {
                val prompt = """
                    Compose one crisp, motivating 1-2 sentence JARVIS executive briefing remark addressing the owner as "Sir".
                    Respond in ${language.displayName}.
                    Tasks: ${tasksSummary.take(500)}
                    Weather: ${weatherSummary.take(200)}
                    Power: ${batterySummary.take(120)}
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
                        put("temperature", 0.65)
                        put("maxOutputTokens", 140)
                        put("thinkingConfig", JSONObject().apply { put("thinkingBudget", 0) })
                    })
                }
                val req = Request.Builder()
                    .url("https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent")
                    .addHeader("x-goog-api-key", apiKey)
                    .post(jsonPayload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@withContext fallback to "fallback"
                    val root = JSONObject(resp.body?.string().orEmpty())
                    val text = root.optJSONArray("candidates")
                        ?.optJSONObject(0)
                        ?.optJSONObject("content")
                        ?.optJSONArray("parts")
                        ?.optJSONObject(0)
                        ?.optString("text")
                        .orEmpty()
                        .trim()
                    return@withContext if (text.isNotBlank()) text to "gemini" else fallback to "fallback"
                }
            }
        } catch (_: Exception) {
            return@withContext fallback to "fallback"
        }
    }

    companion object {
        const val DEFAULT_MODEL = "gemini-2.5-flash"
        const val CHAT_MAX_OUTPUT_TOKENS = 4096
        const val VISION_MAX_OUTPUT_TOKENS = 2048
        const val MAX_HISTORY_MESSAGES = 16
        const val MAX_MEMORY_CONTEXT_ITEMS = 8
        const val MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

        private val ERROR_PREFIXES = listOf(
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
                    if (err.isNotBlank()) return SseLineEvent.Error(err)
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
                        return SseLineEvent.Error(errObj.optString("message", "Unknown Gemini error"))
                    }
                    val candidates = parsed.optJSONArray("candidates") ?: return SseLineEvent.Ignore
                    if (candidates.length() == 0) return SseLineEvent.Ignore
                    val content = candidates.optJSONObject(0)?.optJSONObject("content") ?: return SseLineEvent.Ignore
                    val parts = content.optJSONArray("parts") ?: return SseLineEvent.Ignore
                    val sb = StringBuilder()
                    for (i in 0 until parts.length()) {
                        val part = parts.optJSONObject(i) ?: continue
                        val textChunk = part.optString("text")
                        if (textChunk.isNotEmpty()) sb.append(textChunk)
                    }
                    val combined = sb.toString()
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
