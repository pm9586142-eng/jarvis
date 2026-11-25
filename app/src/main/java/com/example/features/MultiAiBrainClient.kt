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

data class BrainProviderCard(
    val id: String,
    val name: String,
    val tier: String,
    val configured: Boolean,
    val enabled: Boolean,
    val defaultModel: String,
    val status: String,
    val latencyMs: Long?
)

data class BrainAgentNode(
    val id: String,
    val name: String,
    val role: String,
    val specialty: String,
    val enabled: Boolean,
    val preferredProvider: String
)

data class BrainTraceRecord(
    val id: String,
    val action: String,
    val detail: String,
    val status: String
)

data class MultiAiBrainSnapshot(
    val loadedFromBackend: Boolean = false,
    val strictZeroCostEnforced: Boolean = true,
    val routingPolicy: String = "free_first",
    val activeProvider: String = "gemini",
    val collaborationMode: String = "parallel_review",
    val healthScore: Int = 100,
    val totalRequests: Int = 0,
    val providers: List<BrainProviderCard> = defaultLocalProviders(),
    val agents: List<BrainAgentNode> = defaultLocalAgents(),
    val auditLogs: List<BrainTraceRecord> = emptyList(),
    val errorNote: String? = null
) {
    companion object {
        fun defaultLocalProviders(): List<BrainProviderCard> = listOf(
            BrainProviderCard("gemini", "Google Gemini Free", "free", false, true, "gemini-2.5-flash", "STANDBY", null),
            BrainProviderCard("groq", "Groq Free API", "free", false, true, "llama-3.3-70b-versatile", "STANDBY", null),
            BrainProviderCard("openrouter", "OpenRouter ($0 Free)", "free", false, true, "openrouter/auto", "STANDBY", null)
        )

        fun defaultLocalAgents(): List<BrainAgentNode> = listOf(
            BrainAgentNode("chief", "AM Chief Coordinator", "Orchestrator", "Multi-step planning & fusion", true, "gemini"),
            BrainAgentNode("coder", "DUM-E Architect", "Engineering", "Kotlin, TypeScript & Backend", true, "groq"),
            BrainAgentNode("researcher", "VERONICA Intel", "Research", "Web synthesis & verification", true, "gemini"),
            BrainAgentNode("planner", "FRIDAY Strategist", "Productivity", "Tasks, calendar & workflows", true, "gemini"),
            BrainAgentNode("sentinel", "HOMER Security", "Defense", "Audit logs & policy checks", true, "openrouter")
        )
    }
}

data class BrainCoordinateOutcome(
    val ok: Boolean,
    val text: String,
    val providerLabel: String = "AM AI Direct",
    val modelUsed: String = "",
    val agentsUsed: List<String> = emptyList(),
    val verificationNote: String = ""
)

class MultiAiBrainClient(
    private val backendUrlProvider: () -> String,
    private val accessTokenProvider: () -> String = { BuildConfig.APP_ACCESS_TOKEN.trim() },
    private val aiRepository: AiRepository
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun fetchStatusSnapshot(): MultiAiBrainSnapshot = withContext(Dispatchers.IO) {
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isNotBlank()) {
            try {
                val req = Request.Builder()
                    .url("$base/api/brain/status")
                    .addHeader("Accept", "application/json")
                    .applyAuth()
                    .get()
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    if (resp.isSuccessful && raw.isNotBlank()) {
                        return@withContext parseBrainStatus(raw)
                    }
                }
            } catch (_: Exception) {
                // Fall through cleanly to local telemetry snapshot
            }
        }
        buildLocalFallbackSnapshot(
            note = if (base.isBlank()) "Running on local Android Multi-Provider Mesh." else "Backend unreachable; showing live Android provider status."
        )
    }

    suspend fun testProvider(providerId: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isNotBlank()) {
            try {
                val req = Request.Builder()
                    .url("$base/api/brain/providers/$providerId/test")
                    .addHeader("Accept", "application/json")
                    .applyAuth()
                    .post("{}".toRequestBody(jsonMediaType))
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    val obj = try { JSONObject(raw) } catch (_: Exception) { JSONObject() }
                    val ok = obj.optBoolean("ok", false) || obj.optString("connectionState").equals("CONNECTED", true)
                    val msg = obj.optString("connectionState").ifBlank { if (ok) "CONNECTED" else "HTTP_${resp.code}" }
                    val detail = obj.optString("error").ifBlank { obj.optString("message", msg) }
                    return@withContext ok to detail
                }
            } catch (_: Exception) {
            }
        }
        val configured = when (providerId.lowercase()) {
            "gemini" -> aiRepository.hasGeminiKey
            "groq" -> aiRepository.hasGroqKey
            "openrouter" -> aiRepository.hasOpenRouterKey
            else -> false
        }
        if (configured) {
            true to "Direct Android key configured on device."
        } else {
            false to "No backend connection or device key configured for $providerId."
        }
    }

    suspend fun resetCooldowns(): Boolean = withContext(Dispatchers.IO) {
        aiRepository.multiProviderRouter.resetAllCooldowns()
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isNotBlank()) {
            runCatching {
                val req = Request.Builder()
                    .url("$base/api/brain/providers/reset-cooldowns")
                    .applyAuth()
                    .post("{}".toRequestBody(jsonMediaType))
                    .build()
                http.newCall(req).execute().use { it.isSuccessful }
            }.getOrDefault(true)
        } else {
            true
        }
    }

    suspend fun updateCollaborationMode(mode: String): Boolean = withContext(Dispatchers.IO) {
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isBlank()) return@withContext true
        runCatching {
            val payload = JSONObject().put("collaborationMode", mode)
            val req = Request.Builder()
                .url("$base/api/brain/router")
                .applyAuth()
                .patch(payload.toString().toRequestBody(jsonMediaType))
                .build()
            http.newCall(req).execute().use { it.isSuccessful }
        }.getOrDefault(false)
    }

    suspend fun coordinateTask(
        prompt: String,
        collaborationMode: String = "parallel_review",
        preferredProvider: String? = null,
        language: JarvisLanguage = JarvisLanguage.ENGLISH,
        telemetry: SystemTelemetry? = null
    ): BrainCoordinateOutcome = withContext(Dispatchers.IO) {
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isNotBlank()) {
            try {
                val payload = JSONObject().apply {
                    put("prompt", prompt.trim())
                    put("collaborationMode", collaborationMode)
                    if (!preferredProvider.isNullOrBlank() && preferredProvider != "auto") {
                        put("provider", preferredProvider)
                    }
                    put("temporaryChat", true)
                    put("memoryEnabled", false)
                }
                val req = Request.Builder()
                    .url("$base/api/brain/coordinate")
                    .addHeader("Accept", "application/json")
                    .applyAuth()
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    if (resp.isSuccessful && raw.isNotBlank()) {
                        val obj = JSONObject(raw)
                        val agentsArr = obj.optJSONArray("agentsUsed") ?: JSONArray()
                        val used = List(agentsArr.length()) { i -> agentsArr.optString(i) }.filter { it.isNotBlank() }
                        return@withContext BrainCoordinateOutcome(
                            ok = true,
                            text = obj.optString("text", ""),
                            providerLabel = obj.optString("providerLabel", "AM Brain"),
                            modelUsed = obj.optString("modelUsed", ""),
                            agentsUsed = used,
                            verificationNote = obj.optJSONObject("verification")?.optString("summary", "").orEmpty()
                        )
                    }
                }
            } catch (_: Exception) {
                // Fall back seamlessly to direct multi-provider synthesis
            }
        }

        val synthesisPrompt = """
            Coordinate across specialist roles ($collaborationMode) to solve cleanly:
            $prompt

            Provide a unified, structured answer with clear reasoning and verified next steps.
        """.trimIndent()
        val result = aiRepository.generateSimpleText(
            prompt = synthesisPrompt,
            systemInstruction = "You are AM AI Chief Coordinator orchestrating specialist engineering, research, security, and planning agents. Respond cleanly in ${language.displayName}.",
            maxTokens = 1600
        )
        result.fold(
            onSuccess = { answer ->
                BrainCoordinateOutcome(
                    ok = true,
                    text = answer,
                    providerLabel = aiRepository.multiProviderStatus.value.activeProviderLabel,
                    modelUsed = aiRepository.multiProviderStatus.value.activeModel,
                    agentsUsed = listOf("AM Chief", "DUM-E", "VERONICA"),
                    verificationNote = "Synthesized via Android Multi-Provider Failover"
                )
            },
            onFailure = { err ->
                BrainCoordinateOutcome(
                    ok = false,
                    text = err.localizedMessage ?: "Unable to coordinate request."
                )
            }
        )
    }

    private fun buildLocalFallbackSnapshot(note: String?): MultiAiBrainSnapshot {
        val status = aiRepository.multiProviderStatus.value
        val cards = status.providers.map { snap ->
            BrainProviderCard(
                id = snap.id.wireId,
                name = snap.label,
                tier = "free",
                configured = snap.configured,
                enabled = snap.configured,
                defaultModel = if (snap.id == status.activeProvider) status.activeModel else "",
                status = snap.statusLabel,
                latencyMs = null
            )
        }
        return MultiAiBrainSnapshot(
            loadedFromBackend = false,
            strictZeroCostEnforced = true,
            routingPolicy = "free_first",
            activeProvider = status.activeProvider.wireId,
            collaborationMode = "parallel_review",
            healthScore = if (aiRepository.hasRealApiKey) 96 else 65,
            totalRequests = status.totalProviderSwitches,
            providers = if (cards.isNotEmpty()) cards else MultiAiBrainSnapshot.defaultLocalProviders(),
            agents = MultiAiBrainSnapshot.defaultLocalAgents(),
            errorNote = note
        )
    }

    private fun parseBrainStatus(raw: String): MultiAiBrainSnapshot {
        val obj = JSONObject(raw)
        val provArr = obj.optJSONArray("providers") ?: JSONArray()
        val providers = buildList {
            for (i in 0 until provArr.length()) {
                val p = provArr.optJSONObject(i) ?: continue
                add(
                    BrainProviderCard(
                        id = p.optString("id"),
                        name = p.optString("name", p.optString("id")),
                        tier = p.optString("tier", "free"),
                        configured = p.optBoolean("configured", false),
                        enabled = p.optBoolean("enabled", true),
                        defaultModel = p.optString("defaultModel", ""),
                        status = p.optString("status", if (p.optBoolean("configured")) "READY" else "UNCONFIGURED"),
                        latencyMs = if (p.has("latencyMs") && !p.isNull("latencyMs")) p.optLong("latencyMs") else null
                    )
                )
            }
        }
        val agArr = obj.optJSONArray("agents") ?: JSONArray()
        val agents = buildList {
            for (i in 0 until agArr.length()) {
                val a = agArr.optJSONObject(i) ?: continue
                add(
                    BrainAgentNode(
                        id = a.optString("id"),
                        name = a.optString("name"),
                        role = a.optString("role", "Specialist"),
                        specialty = a.optString("specialty", a.optString("description", "")),
                        enabled = a.optBoolean("enabled", true),
                        preferredProvider = a.optString("preferredProvider", "auto")
                    )
                )
            }
        }
        val logsArr = obj.optJSONArray("auditLogs") ?: JSONArray()
        val logs = buildList {
            for (i in 0 until logsArr.length()) {
                val l = logsArr.optJSONObject(i) ?: continue
                add(
                    BrainTraceRecord(
                        id = l.optString("id", "log_$i"),
                        action = l.optString("action", l.optString("category", "EVENT")),
                        detail = l.optString("detail", ""),
                        status = l.optString("severity", "INFO")
                    )
                )
            }
        }
        val routerObj = obj.optJSONObject("router")
        val coordObj = obj.optJSONObject("coordinator")
        val usageObj = obj.optJSONObject("usage")
        val healthObj = obj.optJSONObject("systemHealth")

        return MultiAiBrainSnapshot(
            loadedFromBackend = true,
            strictZeroCostEnforced = obj.optBoolean("strictZeroCostEnforced", true),
            routingPolicy = routerObj?.optString("strategy", "free_first") ?: "free_first",
            activeProvider = routerObj?.optString("primaryProvider", "gemini") ?: "gemini",
            collaborationMode = coordObj?.optString("collaborationMode", "parallel_review") ?: "parallel_review",
            healthScore = healthObj?.optInt("score", 100) ?: 100,
            totalRequests = usageObj?.optInt("totalRequests", 0) ?: 0,
            providers = if (providers.isNotEmpty()) providers else MultiAiBrainSnapshot.defaultLocalProviders(),
            agents = if (agents.isNotEmpty()) agents else MultiAiBrainSnapshot.defaultLocalAgents(),
            auditLogs = logs
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
