package com.example.openjarvis

import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.TimeUnit

data class OpenJarvisEngineItem(
    val id: String,
    val name: String,
    val kind: String,
    val status: String,
    val latencyMs: Long?,
    val lastMessage: String,
    val isDefault: Boolean,
    val discoveredModels: List<String> = emptyList(),
    val supportedOnServerless: Boolean = false
)

data class OpenJarvisModelItem(
    val id: String,
    val name: String,
    val paramsB: Double,
    val fitStatus: String,
    val fitReason: String,
    val recommended: Boolean,
    val wattsEstimate: Int
)

data class OpenJarvisAgentItem(
    val id: String,
    val name: String,
    val sourceClass: String,
    val availability: String,
    val description: String
)

data class OpenJarvisModeItem(
    val id: String,
    val name: String,
    val defaultAgentId: String,
    val description: String
)

data class OpenJarvisSearchResult(
    val id: String,
    val kind: String,
    val title: String,
    val text: String,
    val score: Double,
    val bm25: Double,
    val vector: Double,
    val colbert: Double
)

data class OpenJarvisTraceItem(
    val id: String,
    val agentId: String,
    val assistantMode: String,
    val engineId: String,
    val modelUsed: String,
    val ok: Boolean,
    val latencyMs: Long,
    val promptPreview: String,
    val answerPreview: String
)

data class OpenJarvisWorkflowItem(
    val id: String,
    val name: String,
    val kind: String,
    val intervalMinutes: Int,
    val runCount: Int,
    val lastStatus: String,
    val lastSummary: String
)

data class OpenJarvisUiSnapshot(
    val runtimeMode: String = "unknown",
    val pythonConnected: Boolean = false,
    val existingAiPreserved: Boolean = true,
    val cpuCores: Int = 0,
    val totalRamGb: Double = 0.0,
    val defaultEngineId: String = "amai_cloud",
    val docsCount: Int = 0,
    val chunksCount: Int = 0,
    val totalTraces: Int = 0,
    val successRate: Int = 100,
    val avgLatencyMs: Int = 0,
    val routingStrategy: String = "adaptive_ucb1",
    val engines: List<OpenJarvisEngineItem> = emptyList(),
    val models: List<OpenJarvisModelItem> = emptyList(),
    val agents: List<OpenJarvisAgentItem> = emptyList(),
    val assistantModes: List<OpenJarvisModeItem> = emptyList(),
    val recentTraces: List<OpenJarvisTraceItem> = emptyList(),
    val workflows: List<OpenJarvisWorkflowItem> = emptyList()
)

data class OpenJarvisRunOutcome(
    val ok: Boolean,
    val requiresConfirmation: Boolean = false,
    val confirmationToken: String? = null,
    val experimentalOrOptional: Boolean = false,
    val assistantMode: String = "",
    val assistantName: String = "",
    val agentId: String = "",
    val engineId: String = "",
    val modelUsed: String = "",
    val answer: String = "",
    val error: String? = null,
    val latencyMs: Long = 0L,
    val steps: List<String> = emptyList(),
    val citations: List<String> = emptyList()
)

class OpenJarvisRepository(
    private val defaultBackendUrlProvider: () -> String = { normalizeBackendUrl(BuildConfig.BACKEND_URL) }
) {
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val appAccessToken: String
        get() = BuildConfig.APP_ACCESS_TOKEN
            .trim()
            .takeUnless { it.equals("UNSET", ignoreCase = true) || it.startsWith("your_") }
            .orEmpty()

    fun resolveEffectiveBaseUrl(customServiceUrl: String): String {
        val cleanedCustom = normalizeBackendUrl(customServiceUrl)
        if (cleanedCustom.isNotBlank() && validateRemoteUrl(cleanedCustom).first) {
            return cleanedCustom
        }
        return defaultBackendUrlProvider()
    }

    suspend fun fetchStatus(customServiceUrl: String = ""): Result<OpenJarvisUiSnapshot> =
        withContext(Dispatchers.IO) {
            runCatching {
                val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
                require(baseUrl.isNotBlank()) {
                    "AM AI BACKEND_URL is not configured."
                }
                val isStandalonePython = isStandalonePythonUrl(baseUrl, customServiceUrl)
                val path = if (isStandalonePython) "/health" else "/api/openjarvis/status"
                val raw = executeGet("$baseUrl$path")
                val json = JSONObject(raw)
                if (isStandalonePython) {
                    parsePythonHealthSnapshot(json)
                } else {
                    parseStatusSnapshot(json)
                }
            }
        }

    suspend fun runAgent(
        prompt: String,
        assistantMode: String = "auto",
        agentId: String = "auto",
        engineId: String = "auto",
        confirmToken: String? = null,
        customServiceUrl: String = ""
    ): Result<OpenJarvisRunOutcome> = withContext(Dispatchers.IO) {
        runCatching {
            val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
            require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
            val body = JSONObject().apply {
                put("prompt", prompt.trim())
                put("assistantMode", assistantMode)
                put("agentId", agentId)
                if (engineId != "auto") put("engineId", engineId)
                if (!confirmToken.isNullOrBlank()) put("confirmToken", confirmToken)
            }
            val (code, raw) = executePost("$baseUrl/api/openjarvis/agents/run", body)
            val json = JSONObject(raw.ifBlank { "{}" })
            parseRunOutcome(code, json)
        }
    }

    suspend fun runDeepResearch(
        query: String,
        engineId: String = "auto",
        customServiceUrl: String = ""
    ): Result<OpenJarvisRunOutcome> = withContext(Dispatchers.IO) {
        runCatching {
            val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
            require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
            val body = JSONObject().apply {
                put("query", query.trim())
                if (engineId != "auto") put("engineId", engineId)
            }
            val (code, raw) = executePost("$baseUrl/api/openjarvis/research/deep", body)
            val json = JSONObject(raw.ifBlank { "{}" })
            val report = json.optJSONObject("report")
            val citationsArr = json.optJSONArray("citations") ?: JSONArray()
            val citations = buildList {
                for (i in 0 until citationsArr.length()) {
                    val c = citationsArr.optJSONObject(i) ?: continue
                    val uri = c.optString("uri").trim()
                    val title = c.optString("title").trim()
                    if (title.isNotBlank()) {
                        add(if (uri.isNotBlank()) "$title ($uri)" else title)
                    }
                }
            }
            OpenJarvisRunOutcome(
                ok = code in 200..299 && json.optBoolean("ok", false),
                assistantMode = "deep_research_agent",
                assistantName = "Deep Research Agent",
                agentId = "orchestrator",
                engineId = json.optString("engineId", "amai_cloud"),
                modelUsed = json.optString("modelUsed", ""),
                answer = report?.optString("summary", "") ?: json.optString("error", ""),
                error = if (json.optBoolean("ok", false)) null else json.optString("error", "Research failed"),
                latencyMs = json.optLong("latencyMs", 0L),
                citations = citations
            )
        }
    }

    suspend fun searchHybridMemory(
        query: String,
        mode: String = "hybrid",
        customServiceUrl: String = ""
    ): Result<List<OpenJarvisSearchResult>> = withContext(Dispatchers.IO) {
        runCatching {
            val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
            require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
            val body = JSONObject().apply {
                put("query", query.trim())
                put("mode", mode)
                put("limit", 8)
            }
            val (code, raw) = executePost("$baseUrl/api/openjarvis/memory/search", body)
            require(code in 200..299) { "Hybrid search failed (HTTP $code)" }
            val json = JSONObject(raw)
            val arr = json.optJSONArray("results") ?: JSONArray()
            buildList {
                for (i in 0 until arr.length()) {
                    val item = arr.optJSONObject(i) ?: continue
                    val scores = item.optJSONObject("scores")
                    add(
                        OpenJarvisSearchResult(
                            id = item.optString("id"),
                            kind = item.optString("kind"),
                            title = item.optString("title"),
                            text = item.optString("text"),
                            score = item.optDouble("score", 0.0),
                            bm25 = scores?.optDouble("bm25", 0.0) ?: 0.0,
                            vector = scores?.optDouble("vector", 0.0) ?: 0.0,
                            colbert = scores?.optDouble("colbert", 0.0) ?: 0.0
                        )
                    )
                }
            }
        }
    }

    suspend fun indexDocument(
        title: String,
        text: String,
        customServiceUrl: String = ""
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
            require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
            val body = JSONObject().apply {
                put("title", title.trim())
                put("text", text.trim())
                put("sourceType", "android_note")
            }
            val (code, _) = executePost("$baseUrl/api/openjarvis/memory/documents", body)
            code in 200..299
        }
    }

    suspend fun probeEngine(engineId: String, customServiceUrl: String = ""): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
                require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
                val (_, raw) = executePost("$baseUrl/api/openjarvis/engines/$engineId/probe", JSONObject())
                val json = JSONObject(raw.ifBlank { "{}" })
                json.optString("message", "Probe completed.")
            }
        }

    suspend fun runWorkflowNow(workflowId: String, customServiceUrl: String = ""): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
                require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
                val (_, raw) = executePost("$baseUrl/api/openjarvis/automation/workflows/$workflowId/run", JSONObject())
                val json = JSONObject(raw.ifBlank { "{}" })
                json.optJSONObject("workflow")?.optString("lastSummary") ?: "Workflow executed."
            }
        }

    suspend fun runBenchmark(engineId: String = "amai_cloud", customServiceUrl: String = ""): Result<String> =
        withContext(Dispatchers.IO) {
            runCatching {
                val baseUrl = resolveEffectiveBaseUrl(customServiceUrl)
                require(baseUrl.isNotBlank()) { "AM AI BACKEND_URL is not configured." }
                val body = JSONObject().apply {
                    put("engineId", engineId)
                    put("agentId", "native_react")
                }
                val (_, raw) = executePost("$baseUrl/api/openjarvis/learning/benchmark", body)
                val json = JSONObject(raw.ifBlank { "{}" })
                val b = json.optJSONObject("benchmark")
                if (b != null) {
                    "Benchmark ${b.optString("engineId")}: ${b.optLong("latencyMs")}ms (${b.optDouble("tokensPerSecEstimate")} tok/s)"
                } else {
                    "Benchmark completed."
                }
            }
        }

    private fun executeGet(url: String): String {
        val reqBuilder = Request.Builder().url(url).get().addHeader("Accept", "application/json")
        if (appAccessToken.isNotBlank()) {
            reqBuilder.addHeader("Authorization", "Bearer $appAccessToken")
        }
        httpClient.newCall(reqBuilder.build()).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                throw IllegalStateException("HTTP ${resp.code}: ${body.take(180)}")
            }
            return body
        }
    }

    private fun executePost(url: String, payload: JSONObject): Pair<Int, String> {
        val reqBuilder = Request.Builder()
            .url(url)
            .post(payload.toString().toRequestBody(jsonMediaType))
            .addHeader("Accept", "application/json")
        if (appAccessToken.isNotBlank()) {
            reqBuilder.addHeader("Authorization", "Bearer $appAccessToken")
        }
        httpClient.newCall(reqBuilder.build()).execute().use { resp ->
            return resp.code to resp.body?.string().orEmpty()
        }
    }

    private fun isStandalonePythonUrl(baseUrl: String, customServiceUrl: String): Boolean {
        val cleaned = normalizeBackendUrl(customServiceUrl)
        return cleaned.isNotBlank() && baseUrl == cleaned && baseUrl.endsWith(":8100")
    }

    companion object {
        fun normalizeBackendUrl(raw: String?): String =
            raw.orEmpty()
                .trim()
                .takeUnless { it.equals("UNSET", ignoreCase = true) }
                ?.trimEnd('/')
                .orEmpty()

        fun validateRemoteUrl(raw: String): Pair<Boolean, String> {
            val cleaned = raw.trim()
            if (cleaned.isEmpty()) return true to ""
            return try {
                val uri = URI(cleaned)
                val scheme = uri.scheme?.lowercase().orEmpty()
                val host = uri.host?.lowercase().orEmpty()
                if (scheme != "http" && scheme != "https") {
                    return false to "Only http:// (local LAN/loopback) or https:// URLs are permitted."
                }
                if (host in setOf("169.254.169.254", "metadata.google.internal", "0.0.0.0") || host.startsWith("169.254.")) {
                    return false to "Blocked unsafe cloud metadata host."
                }
                val isLocal = host == "localhost" || host == "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.")
                if (scheme == "http" && !isLocal) {
                    return false to "Remote hosts must use https:// for security."
                }
                true to cleaned.trimEnd('/')
            } catch (_: Exception) {
                false to "Invalid URL format."
            }
        }

        fun parseRunOutcome(code: Int, json: JSONObject): OpenJarvisRunOutcome {
            val stepsArr = json.optJSONArray("steps") ?: JSONArray()
            val steps = buildList {
                for (i in 0 until stepsArr.length()) {
                    val s = stepsArr.optJSONObject(i) ?: continue
                    add("${s.optString("phase")}: ${s.optString("detail")}")
                }
            }
            return OpenJarvisRunOutcome(
                ok = code in 200..299 && json.optBoolean("ok", false),
                requiresConfirmation = json.optBoolean("requiresConfirmation", false),
                confirmationToken = json.optString("confirmationToken").takeIf { it.isNotBlank() },
                experimentalOrOptional = json.optBoolean("experimentalOrOptional", false),
                assistantMode = json.optString("assistantMode"),
                assistantName = json.optString("assistantName"),
                agentId = json.optString("agentId"),
                engineId = json.optString("engineId"),
                modelUsed = json.optString("modelUsed"),
                answer = json.optString("answer"),
                error = json.optString("error").takeIf { it.isNotBlank() },
                latencyMs = json.optLong("latencyMs", 0L),
                steps = steps
            )
        }

        fun parseStatusSnapshot(json: JSONObject): OpenJarvisUiSnapshot {
            val hw = json.optJSONObject("hardware")
            val py = json.optJSONObject("pythonService")
            val mem = json.optJSONObject("memoryStats")
            val learn = json.optJSONObject("learning")
            val learnSum = learn?.optJSONObject("summary")
            val auto = json.optJSONObject("automation")

            val enginesArr = json.optJSONArray("engines") ?: JSONArray()
            val engines = buildList {
                for (i in 0 until enginesArr.length()) {
                    val e = enginesArr.optJSONObject(i) ?: continue
                    val mods = e.optJSONArray("discoveredModels") ?: JSONArray()
                    add(
                        OpenJarvisEngineItem(
                            id = e.optString("id"),
                            name = e.optString("name"),
                            kind = e.optString("kind"),
                            status = e.optString("status"),
                            latencyMs = if (e.isNull("latencyMs")) null else e.optLong("latencyMs"),
                            lastMessage = e.optString("lastMessage"),
                            isDefault = e.optBoolean("isDefault", false),
                            discoveredModels = List(mods.length()) { idx -> mods.optString(idx) }.filter { it.isNotBlank() },
                            supportedOnServerless = e.optBoolean("supportedOnServerless", false)
                        )
                    )
                }
            }

            val modelsArr = json.optJSONArray("models") ?: JSONArray()
            val models = buildList {
                for (i in 0 until modelsArr.length()) {
                    val m = modelsArr.optJSONObject(i) ?: continue
                    add(
                        OpenJarvisModelItem(
                            id = m.optString("id"),
                            name = m.optString("name"),
                            paramsB = m.optDouble("paramsB", 0.0),
                            fitStatus = m.optString("fitStatus"),
                            fitReason = m.optString("fitReason"),
                            recommended = m.optBoolean("recommended", false),
                            wattsEstimate = m.optInt("wattsEstimate", 0)
                        )
                    )
                }
            }

            val agentsArr = json.optJSONArray("agents") ?: JSONArray()
            val agents = buildList {
                for (i in 0 until agentsArr.length()) {
                    val a = agentsArr.optJSONObject(i) ?: continue
                    add(
                        OpenJarvisAgentItem(
                            id = a.optString("id"),
                            name = a.optString("name"),
                            sourceClass = a.optString("sourceClass"),
                            availability = a.optString("availability"),
                            description = a.optString("description")
                        )
                    )
                }
            }

            val modesArr = json.optJSONArray("assistantModes") ?: JSONArray()
            val modes = buildList {
                for (i in 0 until modesArr.length()) {
                    val m = modesArr.optJSONObject(i) ?: continue
                    add(
                        OpenJarvisModeItem(
                            id = m.optString("id"),
                            name = m.optString("name"),
                            defaultAgentId = m.optString("defaultAgentId"),
                            description = m.optString("description")
                        )
                    )
                }
            }

            val tracesArr = learn?.optJSONArray("recentTraces") ?: JSONArray()
            val traces = buildList {
                for (i in 0 until tracesArr.length()) {
                    val t = tracesArr.optJSONObject(i) ?: continue
                    add(
                        OpenJarvisTraceItem(
                            id = t.optString("id"),
                            agentId = t.optString("agentId"),
                            assistantMode = t.optString("assistantMode"),
                            engineId = t.optString("engineId"),
                            modelUsed = t.optString("modelUsed"),
                            ok = t.optBoolean("ok", true),
                            latencyMs = t.optLong("latencyMs", 0L),
                            promptPreview = t.optString("promptPreview"),
                            answerPreview = t.optString("answerPreview")
                        )
                    )
                }
            }

            val wfArr = auto?.optJSONArray("workflows") ?: JSONArray()
            val wfs = buildList {
                for (i in 0 until wfArr.length()) {
                    val w = wfArr.optJSONObject(i) ?: continue
                    add(
                        OpenJarvisWorkflowItem(
                            id = w.optString("id"),
                            name = w.optString("name"),
                            kind = w.optString("kind"),
                            intervalMinutes = w.optInt("scheduleIntervalMinutes", 30),
                            runCount = w.optInt("runCount", 0),
                            lastStatus = w.optString("lastStatus"),
                            lastSummary = w.optString("lastSummary")
                        )
                    )
                }
            }

            return OpenJarvisUiSnapshot(
                runtimeMode = hw?.optString("runtimeMode") ?: "backend",
                pythonConnected = py?.optBoolean("connected", false) ?: false,
                existingAiPreserved = json.optBoolean("existingAiApiPreserved", true),
                cpuCores = hw?.optInt("cpuCores", 0) ?: 0,
                totalRamGb = hw?.optDouble("totalRamGb", 0.0) ?: 0.0,
                defaultEngineId = json.optString("defaultEngineId", "amai_cloud"),
                docsCount = mem?.optInt("documentsCount", 0) ?: 0,
                chunksCount = mem?.optInt("chunksCount", 0) ?: 0,
                totalTraces = learnSum?.optInt("totalTraces", 0) ?: 0,
                successRate = learnSum?.optInt("successRate", 100) ?: 100,
                avgLatencyMs = learnSum?.optInt("avgLatencyMs", 0) ?: 0,
                routingStrategy = learn?.optJSONObject("policy")?.optString("strategy") ?: "adaptive_ucb1",
                engines = engines,
                models = models,
                agents = agents,
                assistantModes = modes,
                recentTraces = traces,
                workflows = wfs
            )
        }

        private fun parsePythonHealthSnapshot(json: JSONObject): OpenJarvisUiSnapshot {
            val hw = json.optJSONObject("hardware")
            return OpenJarvisUiSnapshot(
                runtimeMode = "standalone-python",
                pythonConnected = true,
                existingAiPreserved = true,
                cpuCores = hw?.optInt("cpuCores", 0) ?: 0,
                totalRamGb = hw?.optDouble("totalRamGb", 0.0) ?: 0.0
            )
        }
    }
}
