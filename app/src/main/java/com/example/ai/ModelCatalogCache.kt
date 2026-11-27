package com.example.ai

import android.content.Context
import org.json.JSONArray

/**
 * Persistent 24-hour disk cache for discovered free-tier AI model catalogs and backend circuit-breaker state.
 * Prevents slow /v1beta/models, /groq/models, and /openrouter/models discovery calls on the hot chat path.
 */
class ModelCatalogCache(
    context: Context,
    private val nowMs: () -> Long = { System.currentTimeMillis() }
) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getCachedGeminiSupportedModels(): Set<String>? {
        val fetchedAt = prefs.getLong(KEY_GEMINI_MODELS_AT, 0L)
        if (fetchedAt <= 0L || (nowMs() - fetchedAt) >= CACHE_TTL_MS) return null
        val raw = prefs.getString(KEY_GEMINI_MODELS_JSON, null).orEmpty()
        return decodeStringSet(raw).takeIf { it.isNotEmpty() }
    }

    fun saveGeminiSupportedModels(models: Set<String>, validatedDefaultModel: String? = null) {
        if (models.isEmpty()) return
        prefs.edit().apply {
            putString(KEY_GEMINI_MODELS_JSON, encodeStringSet(models))
            putLong(KEY_GEMINI_MODELS_AT, nowMs())
            if (!validatedDefaultModel.isNullOrBlank()) {
                putString(KEY_VALIDATED_GEMINI_MODEL, validatedDefaultModel.trim())
            }
        }.apply()
    }

    fun getValidatedDefaultGeminiModel(): String? {
        val fetchedAt = prefs.getLong(KEY_GEMINI_MODELS_AT, 0L)
        if (fetchedAt <= 0L || (nowMs() - fetchedAt) >= CACHE_TTL_MS) return null
        return prefs.getString(KEY_VALIDATED_GEMINI_MODEL, null)?.takeIf { it.isNotBlank() }
    }

    fun getCachedGroqModels(): Set<String>? {
        val fetchedAt = prefs.getLong(KEY_GROQ_MODELS_AT, 0L)
        if (fetchedAt <= 0L || (nowMs() - fetchedAt) >= CACHE_TTL_MS) return null
        val raw = prefs.getString(KEY_GROQ_MODELS_JSON, null).orEmpty()
        return decodeStringSet(raw).takeIf { it.isNotEmpty() }
    }

    fun saveGroqModels(models: Set<String>) {
        if (models.isEmpty()) return
        prefs.edit()
            .putString(KEY_GROQ_MODELS_JSON, encodeStringSet(models))
            .putLong(KEY_GROQ_MODELS_AT, nowMs())
            .apply()
    }

    fun getCachedOpenRouterModels(): Set<String>? {
        val fetchedAt = prefs.getLong(KEY_OR_MODELS_AT, 0L)
        if (fetchedAt <= 0L || (nowMs() - fetchedAt) >= CACHE_TTL_MS) return null
        val raw = prefs.getString(KEY_OR_MODELS_JSON, null).orEmpty()
        return decodeStringSet(raw).takeIf { it.isNotEmpty() }
    }

    fun saveOpenRouterModels(models: Set<String>) {
        if (models.isEmpty()) return
        prefs.edit()
            .putString(KEY_OR_MODELS_JSON, encodeStringSet(models))
            .putLong(KEY_OR_MODELS_AT, nowMs())
            .apply()
    }

    fun getBackendCircuitOpenUntilMs(): Long {
        return prefs.getLong(KEY_BACKEND_CIRCUIT_UNTIL, 0L)
    }

    fun setBackendCircuitOpenUntilMs(untilMs: Long) {
        prefs.edit().putLong(KEY_BACKEND_CIRCUIT_UNTIL, untilMs).apply()
    }

    fun invalidateAllCatalogs() {
        prefs.edit()
            .remove(KEY_GEMINI_MODELS_AT)
            .remove(KEY_GROQ_MODELS_AT)
            .remove(KEY_OR_MODELS_AT)
            .apply()
    }

    private fun encodeStringSet(values: Set<String>): String {
        val arr = JSONArray()
        values.forEach { arr.put(it) }
        return arr.toString()
    }

    private fun decodeStringSet(raw: String): Set<String> {
        if (raw.isBlank()) return emptySet()
        return try {
            val arr = JSONArray(raw)
            buildSet {
                for (i in 0 until arr.length()) {
                    val value = arr.optString(i).trim()
                    if (value.isNotEmpty()) add(value)
                }
            }
        } catch (_: Exception) {
            emptySet()
        }
    }

    companion object {
        private const val PREFS_NAME = "am_ai_model_catalog_cache"
        const val CACHE_TTL_MS = 24L * 60L * 60L * 1000L

        private const val KEY_GEMINI_MODELS_JSON = "gemini_models_json"
        private const val KEY_GEMINI_MODELS_AT = "gemini_models_at"
        private const val KEY_VALIDATED_GEMINI_MODEL = "validated_gemini_model"
        private const val KEY_GROQ_MODELS_JSON = "groq_models_json"
        private const val KEY_GROQ_MODELS_AT = "groq_models_at"
        private const val KEY_OR_MODELS_JSON = "openrouter_models_json"
        private const val KEY_OR_MODELS_AT = "openrouter_models_at"
        private const val KEY_BACKEND_CIRCUIT_UNTIL = "backend_circuit_until"
    }
}
