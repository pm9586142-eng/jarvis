package com.example.sync

import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class SyncedProviderInfo(
    val id: String,
    val configured: Boolean,
    val enabled: Boolean,
    val maskedKey: String
)

data class ProviderConnectionProbe(
    val providerId: String,
    val ok: Boolean,
    val connectionState: String,
    val latencyMs: Long = 0L,
    val detail: String = ""
)

data class EcosystemConfigSnapshot(
    val version: Int = 1,
    val apiVersion: String = "2026-11",
    val updatedAt: String = "",
    val minClientVersionAndroid: String = "1.0",
    val minClientVersionWeb: String = "2.0.0",
    val activeProvider: String = "gemini",
    val fallbackProvider: String = "groq",
    val defaultModel: String = "gemini-3.8-flash",
    val fallbackModel: String = "gemini-3.8-flash",
    val defaultLanguage: String = "ENGLISH",
    val voicePreset: String = "laila_soft",
    val neuralTtsEnabled: Boolean = true,
    val femaleVoiceEnabled: Boolean = true,
    val voiceSpeed: Float = 0.90f,
    val voicePitch: Float = 0.98f,
    val featureFlags: Map<String, Boolean> = defaultFeatureFlags(),
    val providers: List<SyncedProviderInfo> = emptyList(),
    val youtubeConfigured: Boolean = false,
    val isCompatible: Boolean = true,
    val lastSyncedAtMs: Long = 0L,
    val fromCache: Boolean = false,
    val errorMessage: String? = null
) {
    companion object {
        fun defaultFeatureFlags(): Map<String, Boolean> = mapOf(
            "continuousVoice" to true,
            "webSearch" to true,
            "memoryExtraction" to true,
            "smartReminders" to true,
            "multiAiCenter" to true,
            "researchStudio" to true,
            "musicStudio" to true,
            "orbitalGame" to true,
            "ultronHologram" to true
        )
    }
}

class AndroidRemoteConfigSyncManager(
    private val backendUrlProvider: () -> String,
    private val accessTokenProvider: () -> String = { BuildConfig.APP_ACCESS_TOKEN.trim() },
    private val androidVersionName: String = "1.0"
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(8, TimeUnit.SECONDS)
        .build()

    suspend fun fetchRemoteConfig(): Result<Pair<EcosystemConfigSnapshot, String>> = withContext(Dispatchers.IO) {
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isBlank()) {
            return@withContext Result.failure(IllegalStateException("Backend URL is not configured."))
        }
        try {
            val req = Request.Builder()
                .url("$base/api/config")
                .addHeader("Accept", "application/json")
                .applyToken()
                .get()
                .build()
            http.newCall(req).execute().use { resp ->
                val raw = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    return@withContext Result.failure(
                        IllegalStateException("Config sync HTTP ${resp.code}: ${raw.take(180)}")
                    )
                }
                val parsed = parseConfigJson(raw, fromCache = false, syncedAt = System.currentTimeMillis())
                Result.success(parsed to raw)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pushRemoteConfigUpdate(patch: JSONObject): Result<Pair<EcosystemConfigSnapshot, String>> =
        withContext(Dispatchers.IO) {
            val base = backendUrlProvider().trim().trimEnd('/')
            if (base.isBlank()) {
                return@withContext Result.failure(IllegalStateException("Backend URL is not configured."))
            }
            try {
                val req = Request.Builder()
                    .url("$base/api/config")
                    .addHeader("Accept", "application/json")
                    .applyToken()
                    .post(patch.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        val msg = try {
                            JSONObject(raw).optString("error").ifBlank { "HTTP ${resp.code}" }
                        } catch (_: Exception) {
                            "HTTP ${resp.code}"
                        }
                        return@withContext Result.failure(IllegalStateException(msg))
                    }
                    val root = JSONObject(raw)
                    val cfgJson = root.optJSONObject("config")?.toString() ?: raw
                    val parsed = parseConfigJson(cfgJson, fromCache = false, syncedAt = System.currentTimeMillis())
                    Result.success(parsed to cfgJson)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun testProviderConnection(providerId: String): ProviderConnectionProbe = withContext(Dispatchers.IO) {
        val base = backendUrlProvider().trim().trimEnd('/')
        if (base.isBlank()) {
            return@withContext ProviderConnectionProbe(
                providerId = providerId,
                ok = false,
                connectionState = "BACKEND_UNSET",
                detail = "No backend URL configured."
            )
        }
        val started = System.currentTimeMillis()
        try {
            val payload = JSONObject().put("providerId", providerId)
            val req = Request.Builder()
                .url("$base/api/config/test")
                .addHeader("Accept", "application/json")
                .applyToken()
                .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()
            http.newCall(req).execute().use { resp ->
                val raw = resp.body?.string().orEmpty()
                val latency = System.currentTimeMillis() - started
                val obj = try { JSONObject(raw) } catch (_: Exception) { JSONObject() }
                val state = obj.optString("connectionState", if (resp.isSuccessful) "CONNECTED" else "HTTP_${resp.code}")
                val ok = obj.optBoolean("ok", false) || state.equals("CONNECTED", ignoreCase = true)
                val detail = obj.optString("error").ifBlank { obj.optString("detail", state) }
                ProviderConnectionProbe(
                    providerId = providerId,
                    ok = ok,
                    connectionState = state,
                    latencyMs = obj.optLong("latencyMs", latency),
                    detail = detail
                )
            }
        } catch (e: Exception) {
            ProviderConnectionProbe(
                providerId = providerId,
                ok = false,
                connectionState = "ERROR",
                latencyMs = System.currentTimeMillis() - started,
                detail = e.localizedMessage ?: "Probe failed"
            )
        }
    }

    fun parseConfigJson(
        rawJson: String,
        fromCache: Boolean,
        syncedAt: Long = 0L
    ): EcosystemConfigSnapshot {
        if (rawJson.isBlank()) return EcosystemConfigSnapshot(fromCache = true)
        val obj = JSONObject(rawJson)
        val minAndroid = obj.optString("minClientVersionAndroid", "1.0")
        val voiceObj = obj.optJSONObject("voice")
        val flagsObj = obj.optJSONObject("featureFlags")
        val providersObj = obj.optJSONObject("providers")

        val flags = EcosystemConfigSnapshot.defaultFeatureFlags().toMutableMap()
        if (flagsObj != null) {
            val keys = flagsObj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                flags[k] = flagsObj.optBoolean(k, flags[k] ?: true)
            }
        }

        val providersList = buildList {
            if (providersObj != null) {
                val keys = providersObj.keys()
                while (keys.hasNext()) {
                    val pId = keys.next()
                    val pObj = providersObj.optJSONObject(pId) ?: continue
                    add(
                        SyncedProviderInfo(
                            id = pId,
                            configured = pObj.optBoolean("configured", pObj.optString("maskedKey").isNotBlank()),
                            enabled = pObj.optBoolean("enabled", false),
                            maskedKey = pObj.optString("maskedKey", "")
                        )
                    )
                }
            }
        }

        return EcosystemConfigSnapshot(
            version = obj.optInt("version", 1),
            apiVersion = obj.optString("apiVersion", "2026-11"),
            updatedAt = obj.optString("updatedAt", ""),
            minClientVersionAndroid = minAndroid,
            minClientVersionWeb = obj.optString("minClientVersionWeb", "2.0.0"),
            activeProvider = obj.optString("activeProvider", "gemini"),
            fallbackProvider = obj.optString("fallbackProvider", "groq"),
            defaultModel = obj.optString("defaultModel", "gemini-3.8-flash"),
            fallbackModel = obj.optString("fallbackModel", "gemini-3.8-flash"),
            defaultLanguage = obj.optString("defaultLanguage", "ENGLISH"),
            voicePreset = voiceObj?.optString("defaultPreset", "laila_soft") ?: "laila_soft",
            neuralTtsEnabled = voiceObj?.optBoolean("neuralTtsEnabled", true) ?: true,
            femaleVoiceEnabled = voiceObj?.optBoolean("femaleVoiceEnabled", true) ?: true,
            voiceSpeed = (voiceObj?.optDouble("speed", 0.90) ?: 0.90).toFloat(),
            voicePitch = (voiceObj?.optDouble("pitch", 0.98) ?: 0.98).toFloat(),
            featureFlags = flags,
            providers = providersList,
            youtubeConfigured = obj.optJSONObject("capabilities")?.optBoolean("youtubeConfigured", false) ?: false,
            isCompatible = isVersionCompatible(androidVersionName, minAndroid),
            lastSyncedAtMs = syncedAt,
            fromCache = fromCache
        )
    }

    private fun Request.Builder.applyToken(): Request.Builder {
        val token = accessTokenProvider().trim()
        if (token.isNotBlank() && !token.equals("UNSET", ignoreCase = true)) {
            addHeader("Authorization", "Bearer $token")
        }
        return this
    }

    companion object {
        fun isVersionCompatible(current: String, minimum: String): Boolean {
            val curParts = current.split(".").mapNotNull { it.toIntOrNull() }
            val minParts = minimum.split(".").mapNotNull { it.toIntOrNull() }
            val len = maxOf(curParts.size, minParts.size)
            for (i in 0 until len) {
                val c = curParts.getOrElse(i) { 0 }
                val m = minParts.getOrElse(i) { 0 }
                if (c > m) return true
                if (c < m) return false
            }
            return true
        }
    }
}
