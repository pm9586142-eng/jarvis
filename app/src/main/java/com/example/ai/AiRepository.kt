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
        enableWebSearch: Boolean = (agent == JarvisAgent.VERONICA_RESEARCH)
    ): Flow<String> = callbackFlow {
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

        val systemInstructionText = buildSystemInstruction(agent, language, telemetry, memories)
        val request = if (usesBackendProxy) {
            buildBackendRequest(prompt, systemInstructionText, history, enableWebSearch || agent == JarvisAgent.VERONICA_RESEARCH)
        } else {
            buildDirectGeminiRequest(prompt, systemInstructionText, history)
        }

        val call: Call = client.newCall(request)
        val streamJob = launch(Dispatchers.IO) {
            val accumulatedText = StringBuilder()
            try {
                call.execute().use { response ->
                    if (!response.isSuccessful) {
                        val errorBody = response.body?.string().orEmpty()
                        Log.e(TAG, "AI API error ${response.code}: $errorBody")
                        val userError = try {
                            val errJson = JSONObject(errorBody)
                            errJson.optJSONObject("error")?.optString("message")
                                ?.takeIf { it.isNotBlank() }
                                ?: errJson.optString("error").takeIf { it.isNotBlank() }
                                ?: "HTTP ${response.code}"
                        } catch (_: Exception) {
                            "HTTP ${response.code}"
                        }
                        trySend("Sir, Gemini API error encountered: $userError")
                        close()
                        return@launch
                    }

                    val body = response.body
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
                                is SseLineEvent.Error -> {
                                    trySend("Sir, Gemini API error encountered: ${event.message}")
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
                if (!call.isCanceled()) {
                    Log.e(TAG, "Gemini network stream failed", e)
                    trySend("Sir, communication with the Gemini satellite link failed: ${e.localizedMessage}")
                }
                close()
            }
        }

        awaitClose {
            call.cancel()
            streamJob.cancel()
        }
    }

    private fun buildDirectGeminiRequest(
        prompt: String,
        systemInstructionText: String,
        history: List<ConversationEntity>
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

    fun buildSystemInstruction(
        agent: JarvisAgent,
        language: JarvisLanguage,
        telemetry: SystemTelemetry?,
        memories: List<MemoryEntity>
    ): String {
        val orderedMemories = memories
            .sortedWith(compareByDescending<MemoryEntity> { it.importance }.thenByDescending { it.createdAt })
            .take(MAX_MEMORY_CONTEXT_ITEMS)

        val memoryContext = if (orderedMemories.isNotEmpty()) {
            "Long-Term Memory Facts from Owner Vault:\n" +
                orderedMemories.joinToString("\n") { "- [${it.category}] ${it.key}: ${it.content}" }
        } else {
            "No memory records stored yet."
        }

        val telemetryContext = telemetry?.let {
            "Real Device Hardware Telemetry:\n- Battery: ${it.batteryLevel}% (${if (it.isCharging) "Charging" else "Discharging"})\n- RAM: ${it.ramUsedMb}MB / ${it.ramTotalMb}MB (${it.ramPercent}%)\n- Network: ${it.networkType}"
        } ?: "Telemetry: Standby"

        val langDirective = when (language) {
            JarvisLanguage.HINDI -> "Respond exclusively in refined, sophisticated Hindi (हिंदी). Maintain the elite JARVIS personal assistant persona, addressing the user as Sir."
            JarvisLanguage.GUJARATI -> "Respond exclusively in refined, polite Gujarati (ગુજરાતી). Maintain the elite JARVIS personal assistant persona, addressing the user as Sir."
            JarvisLanguage.ENGLISH -> "Respond in refined British English. Address the user respectfully as 'Sir'. Exhibit subtle intelligence, calm confidence, and sophisticated wit."
        }

        return """
            ${agent.systemPrompt}
            $langDirective
            $telemetryContext
            $memoryContext
        """.trimIndent()
    }

    suspend fun extractDurableMemories(
        userPrompt: String,
        aiReply: String,
        existingMemories: List<MemoryEntity>
    ): List<ExtractedMemoryCandidate> = withContext(Dispatchers.IO) {
        if (userPrompt.trim().length < 6) return@withContext emptyList()
        if (!usesBackendProxy && !hasRealApiKey) return@withContext emptyList()

        try {
            if (usesBackendProxy) {
                val existingArray = JSONArray().apply {
                    existingMemories.take(20).forEach { mem ->
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
                    val candidates = parseExtractedMemoriesJson(bodyStr)
                    return@withContext MemoryDeduplicator.filterUniqueCandidates(candidates, existingMemories)
                }
            } else {
                val existingSummary = existingMemories.take(20).joinToString("\n") {
                    "- [${it.category}] ${it.key}: ${it.content}"
                }.ifBlank { "(none)" }

                val extractionPrompt = """
                    Analyze the conversation turn below and extract ONLY durable, long-term personal facts worth remembering about the user (e.g., name, role, preferences, ongoing projects, daily routines, tech stack, standing instructions).
                    Ignore greetings, one-off questions, generic code/trivia, and anything already present in EXISTING MEMORIES.
                    Return strict JSON matching this schema: {"memories":[{"key":"short title","category":"PREFERENCE|PROJECT|INSTRUCTION|FACT","content":"concise durable fact","importance":3}]}
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
                    val candidates = parseExtractedMemoriesJson(rawModelText)
                    return@withContext MemoryDeduplicator.filterUniqueCandidates(candidates, existingMemories)
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

    companion object {
        const val DEFAULT_MODEL = "gemini-2.5-flash"
        const val CHAT_MAX_OUTPUT_TOKENS = 4096
        const val VISION_MAX_OUTPUT_TOKENS = 2048
        const val MAX_HISTORY_MESSAGES = 12
        const val MAX_MEMORY_CONTEXT_ITEMS = 8

        private val ERROR_PREFIXES = listOf(
            "Sir, Gemini API error",
            "Sir, communication with the Gemini",
            "Sir, an anomaly was encountered",
            "Sir, received an empty response stream",
            "Sir, Gemini returned an empty response",
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
