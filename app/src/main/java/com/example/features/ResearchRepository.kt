package com.example.features

import com.example.BuildConfig
import com.example.agents.JarvisLanguage
import com.example.ai.AiRepository
import com.example.system.SystemTelemetry
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class ResearchSourceCitation(
    val title: String,
    val uri: String,
    val snippet: String = ""
)

data class ResearchStudioResult(
    val query: String,
    val mode: String,
    val summary: String,
    val verifiedFacts: List<String> = emptyList(),
    val uncertainNotes: List<String> = emptyList(),
    val sources: List<ResearchSourceCitation> = emptyList(),
    val providerLabel: String = "AM AI",
    val modelUsed: String = ""
)

class ResearchRepository(
    private val backendUrlProvider: () -> String,
    private val accessTokenProvider: () -> String = { BuildConfig.APP_ACCESS_TOKEN.trim() },
    private val aiRepository: AiRepository
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun performWebResearch(
        query: String,
        language: JarvisLanguage,
        telemetry: SystemTelemetry? = null
    ): Result<ResearchStudioResult> = withContext(Dispatchers.IO) {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Enter a research topic or question."))
        }

        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isNotBlank()) {
            try {
                val payload = JSONObject().apply {
                    put("query", cleanQuery)
                    put("language", language.name)
                    put("preferTavily", true)
                }
                val req = Request.Builder()
                    .url("$base/api/search")
                    .addHeader("Accept", "application/json")
                    .applyAuth()
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    if (resp.isSuccessful && raw.isNotBlank()) {
                        return@withContext Result.success(parseSearchResult(cleanQuery, raw))
                    }
                }
            } catch (_: Exception) {
                // Fall back cleanly to direct multi-provider research synthesis
            }
        }

        val prompt = """
            Conduct structured research on: "$cleanQuery"

            Respond clearly using these headings:
            ## Executive Summary
            (Concise answer directly addressing the topic.)

            ## Verified Facts
            - Key verified principles, architecture facts, or technical takeaways.

            ## Caveats & Open Questions
            - What may depend on real-time updates or require live verification.
        """.trimIndent()

        aiRepository.generateSimpleText(
            prompt = prompt,
            systemInstruction = "You are AM AI VERONICA Research Studio. Provide factual, structured synthesis without inventing URLs. Respond in ${language.displayName}.",
            maxTokens = 1600
        ).map { answer ->
            ResearchStudioResult(
                query = cleanQuery,
                mode = "Direct AI Research",
                summary = answer,
                providerLabel = aiRepository.multiProviderStatus.value.activeProviderLabel,
                modelUsed = aiRepository.multiProviderStatus.value.activeModel
            )
        }
    }

    suspend fun generateStructuredReport(
        reportType: String,
        title: String,
        sourceText: String,
        language: JarvisLanguage,
        telemetry: SystemTelemetry? = null
    ): Result<ResearchStudioResult> = withContext(Dispatchers.IO) {
        val cleanSource = sourceText.trim()
        if (cleanSource.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Provide source text, notes, or a topic to generate a report."))
        }

        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isNotBlank()) {
            try {
                val payload = JSONObject().apply {
                    put("type", reportType)
                    put("reportType", reportType)
                    put("title", title.ifBlank { "$reportType Brief" })
                    put("sourceText", cleanSource)
                    put("language", language.name)
                }
                val req = Request.Builder()
                    .url("$base/api/reports/generate")
                    .addHeader("Accept", "application/json")
                    .applyAuth()
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    if (resp.isSuccessful && raw.isNotBlank()) {
                        val obj = JSONObject(raw)
                        val body = obj.optString("markdown")
                            .ifBlank { obj.optString("report") }
                            .ifBlank { obj.optString("summary", raw) }
                        return@withContext Result.success(
                            ResearchStudioResult(
                                query = title.ifBlank { reportType },
                                mode = "Report Studio • $reportType",
                                summary = body,
                                providerLabel = obj.optString("providerLabel", "AM Backend"),
                                modelUsed = obj.optString("model", "")
                            )
                        )
                    }
                }
            } catch (_: Exception) {
                // Fall back to direct free AI synthesis
            }
        }

        val prompt = """
            Generate a crisp $reportType report titled "${title.ifBlank { "$reportType Report" }}".

            Source Material:
            ${cleanSource.take(8000)}

            Use clear Markdown sections, bullet takeaways, and actionable recommendations.
        """.trimIndent()

        aiRepository.generateSimpleText(
            prompt = prompt,
            systemInstruction = "You are AM AI Report Architect. Produce concise, publication-quality Markdown reports in ${language.displayName}.",
            maxTokens = 1800
        ).map { body ->
            ResearchStudioResult(
                query = title.ifBlank { reportType },
                mode = "Report Studio • $reportType",
                summary = body,
                providerLabel = aiRepository.multiProviderStatus.value.activeProviderLabel,
                modelUsed = aiRepository.multiProviderStatus.value.activeModel
            )
        }
    }

    private fun parseSearchResult(query: String, raw: String): ResearchStudioResult {
        val obj = JSONObject(raw)
        val factsArr = obj.optJSONArray("verifiedFacts") ?: JSONArray()
        val notesArr = obj.optJSONArray("uncertainNotes") ?: JSONArray()
        val sourcesArr = obj.optJSONArray("sources") ?: JSONArray()

        val facts = List(factsArr.length()) { i -> factsArr.optString(i) }.filter { it.isNotBlank() }
        val notes = List(notesArr.length()) { i -> notesArr.optString(i) }.filter { it.isNotBlank() }
        val sources = buildList {
            for (i in 0 until sourcesArr.length()) {
                val s = sourcesArr.optJSONObject(i) ?: continue
                val uri = s.optString("uri").trim()
                val title = s.optString("title", uri).trim()
                if (uri.isNotBlank()) {
                    add(ResearchSourceCitation(title = title, uri = uri, snippet = s.optString("snippet", "")))
                }
            }
        }
        return ResearchStudioResult(
            query = obj.optString("query", query),
            mode = "Grounded Web Research",
            summary = obj.optString("summary", ""),
            verifiedFacts = facts,
            uncertainNotes = notes,
            sources = sources,
            providerLabel = obj.optString("providerLabel", "AM Research"),
            modelUsed = obj.optString("model", "")
        )
    }

    private fun Request.Builder.applyAuth(): Request.Builder {
        val token = accessTokenProvider().trim()
        if (token.isNotBlank() && !token.equals("UNSET", ignoreCase = true)) {
            addHeader("Authorization", "Bearer $token")
        }
        return this
    }
}
