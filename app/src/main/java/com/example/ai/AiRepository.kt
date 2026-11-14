package com.example.ai

import android.util.Log
import com.example.BuildConfig
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.data.db.MemoryEntity
import com.example.system.SystemTelemetry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

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
            BuildConfig.GEMINI_API_KEY
        } catch (_: Exception) {
            ""
        }

    val hasRealApiKey: Boolean
        get() = apiKey.isNotBlank() && apiKey != "MY_GEMINI_API_KEY"

    fun generateStreamingResponse(
        prompt: String,
        agent: JarvisAgent,
        language: JarvisLanguage,
        telemetry: SystemTelemetry?,
        memories: List<MemoryEntity> = emptyList()
    ): Flow<String> = flow {
        if (!hasRealApiKey) {
            // Transparently inform the user without fake simulated intelligence
            emit(
                """
                Sir, real-time Gemini Cloud AI requires configuring your GEMINI_API_KEY in the AI Studio Secrets panel.

                To connect the live Gemini brain:
                1. Open the Secrets panel in Google AI Studio.
                2. Set GEMINI_API_KEY to your Google Gemini API credential.
                3. The full multi-agent Gemini intelligence mesh will stream live responses immediately.

                Current Engine: Standby (Awaiting API Key Authorization).
                """.trimIndent()
            )
            return@flow
        }

        // Build comprehensive context-aware system prompt
        val systemInstructionText = buildSystemInstruction(agent, language, telemetry, memories)

        // Build Gemini Request Payload
        val jsonPayload = JSONObject().apply {
            put("systemInstruction", JSONObject().apply {
                put("parts", JSONArray().apply {
                    put(JSONObject().apply { put("text", systemInstructionText) })
                })
            })
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                    })
                })
            })
            put("generationConfig", JSONObject().apply {
                put("temperature", 0.7)
                put("maxOutputTokens", 2048)
            })
        }

        val requestUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=$apiKey"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = jsonPayload.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(requestUrl)
            .post(requestBody)
            .build()

        val accumulatedText = StringBuilder()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                val errorBody = response.body?.string().orEmpty()
                Log.e(TAG, "Gemini API error ${response.code}: $errorBody")
                val userError = try {
                    val errJson = JSONObject(errorBody)
                    errJson.optJSONObject("error")?.optString("message") ?: "HTTP ${response.code}"
                } catch (_: Exception) {
                    "HTTP ${response.code}"
                }
                emit("Sir, Gemini API error encountered: $userError")
                return@flow
            }

            val inputStream = response.body?.byteStream()
            if (inputStream == null) {
                emit("Sir, received an empty response stream from the Gemini neural link.")
                return@flow
            }

            val reader = BufferedReader(InputStreamReader(inputStream))
            var line: String?

            while (reader.readLine().also { line = it } != null) {
                val currentLine = line ?: continue
                if (currentLine.startsWith("data: ")) {
                    val dataJson = currentLine.removePrefix("data: ").trim()
                    if (dataJson == "[DONE]") break
                    try {
                        val parsed = JSONObject(dataJson)
                        val candidates = parsed.optJSONArray("candidates")
                        if (candidates != null && candidates.length() > 0) {
                            val firstCandidate = candidates.getJSONObject(0)
                            val content = firstCandidate.optJSONObject("content")
                            val parts = content?.optJSONArray("parts")
                            if (parts != null && parts.length() > 0) {
                                val textChunk = parts.getJSONObject(0).optString("text")
                                if (textChunk.isNotBlank()) {
                                    accumulatedText.append(textChunk)
                                    emit(accumulatedText.toString())
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to parse SSE data chunk", e)
                    }
                }
            }

            if (accumulatedText.isBlank()) {
                emit("Sir, Gemini returned an empty response.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gemini network stream failed", e)
            emit("Sir, communication with the Gemini satellite link failed: ${e.localizedMessage}")
        }
    }.flowOn(Dispatchers.IO)

    private fun buildSystemInstruction(
        agent: JarvisAgent,
        language: JarvisLanguage,
        telemetry: SystemTelemetry?,
        memories: List<MemoryEntity>
    ): String {
        val memoryContext = if (memories.isNotEmpty()) {
            "Long-Term Memory Facts from Owner Vault:\n" +
            memories.take(5).joinToString("\n") { "- [${it.category}] ${it.key}: ${it.content}" }
        } else "No memory records stored yet."

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
}
