package com.example.data.preferences

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.ai.AndroidAiRoutingMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.jarvisDataStore: DataStore<Preferences> by preferencesDataStore(name = "jarvis_settings")

enum class JarvisAccentTheme(
    val key: String,
    val label: String,
    val primary: Color,
    val bright: Color,
    val glow: Color
) {
    CYAN("CYAN", "Arc Cyan", Color(0xFF38BDF8), Color(0xFF7DD3FC), Color(0xFF0284C7)),
    VIOLET("VIOLET", "Synaptic Violet", Color(0xFFA78BFA), Color(0xFFC4B5FD), Color(0xFF7C3AED)),
    EMERALD("EMERALD", "Sentinel Emerald", Color(0xFF10B981), Color(0xFF6EE7B7), Color(0xFF059669)),
    GOLD("GOLD", "Mark Gold", Color(0xFFFBBF24), Color(0xFFFDE68A), Color(0xFFD97706)),
    CRIMSON("CRIMSON", "Defense Crimson", Color(0xFFF43F5E), Color(0xFFFDA4AF), Color(0xFFE11D48));

    companion object {
        fun fromKey(value: String?): JarvisAccentTheme =
            entries.find { it.key.equals(value, ignoreCase = true) } ?: CYAN
    }
}

data class JarvisUserPreferences(
    val language: JarvisLanguage = JarvisLanguage.ENGLISH,
    val defaultAgent: JarvisAgent = JarvisAgent.JARVIS_PRIME,
    val speechRate: Float = 1.0f,
    val speechPitch: Float = 1.0f,
    val voiceVolume: Float = 1.0f,
    val voiceMuted: Boolean = false,
    val voiceModeEnabled: Boolean = true,
    val continuousConversationMode: Boolean = false,
    val autoSpeakReplies: Boolean = false,
    val autoSpeakDailySummary: Boolean = true,
    val webSearchEnabled: Boolean = true,
    val autoExtractMemories: Boolean = true,
    val accentTheme: JarvisAccentTheme = JarvisAccentTheme.CYAN,
    val aiRoutingMode: AndroidAiRoutingMode = AndroidAiRoutingMode.HYBRID
)

class JarvisPreferencesRepository(context: Context) {
    private val dataStore = context.applicationContext.jarvisDataStore

    val preferencesFlow: Flow<JarvisUserPreferences> = dataStore.data
        .catch { ex ->
            if (ex is IOException) emit(emptyPreferences()) else throw ex
        }
        .map { prefs ->
            val lang = prefs[KEY_LANGUAGE]?.let { raw ->
                JarvisLanguage.entries.find { it.name == raw }
            } ?: JarvisLanguage.ENGLISH

            val agent = prefs[KEY_DEFAULT_AGENT]?.let { raw ->
                JarvisAgent.entries.find { it.name == raw }
            } ?: JarvisAgent.JARVIS_PRIME

            val routingMode = prefs[KEY_AI_ROUTING_MODE]?.let { raw ->
                AndroidAiRoutingMode.entries.find { it.name == raw }
            } ?: AndroidAiRoutingMode.HYBRID

            JarvisUserPreferences(
                language = lang,
                defaultAgent = agent,
                speechRate = (prefs[KEY_SPEECH_RATE] ?: 1.0f).coerceIn(0.5f, 2.0f),
                speechPitch = (prefs[KEY_SPEECH_PITCH] ?: 1.0f).coerceIn(0.5f, 2.0f),
                voiceVolume = (prefs[KEY_VOICE_VOLUME] ?: 1.0f).coerceIn(0f, 1.0f),
                voiceMuted = prefs[KEY_VOICE_MUTED] ?: false,
                voiceModeEnabled = prefs[KEY_VOICE_MODE_ENABLED] ?: true,
                continuousConversationMode = prefs[KEY_CONTINUOUS_MODE] ?: false,
                autoSpeakReplies = prefs[KEY_AUTO_SPEAK] ?: false,
                autoSpeakDailySummary = prefs[KEY_AUTO_SPEAK_DAILY_SUMMARY] ?: true,
                webSearchEnabled = prefs[KEY_WEB_SEARCH] ?: true,
                autoExtractMemories = prefs[KEY_AUTO_EXTRACT_MEMORIES] ?: true,
                accentTheme = JarvisAccentTheme.fromKey(prefs[KEY_ACCENT_THEME]),
                aiRoutingMode = routingMode
            )
        }

    suspend fun setLanguage(language: JarvisLanguage) {
        dataStore.edit { it[KEY_LANGUAGE] = language.name }
    }

    suspend fun setDefaultAgent(agent: JarvisAgent) {
        dataStore.edit { it[KEY_DEFAULT_AGENT] = agent.name }
    }

    suspend fun setSpeechRate(rate: Float) {
        dataStore.edit { it[KEY_SPEECH_RATE] = rate.coerceIn(0.5f, 2.0f) }
    }

    suspend fun setSpeechPitch(pitch: Float) {
        dataStore.edit { it[KEY_SPEECH_PITCH] = pitch.coerceIn(0.5f, 2.0f) }
    }

    suspend fun setVoiceVolume(volume: Float) {
        dataStore.edit { it[KEY_VOICE_VOLUME] = volume.coerceIn(0f, 1.0f) }
    }

    suspend fun setVoiceMuted(muted: Boolean) {
        dataStore.edit { it[KEY_VOICE_MUTED] = muted }
    }

    suspend fun setVoiceModeEnabled(enabled: Boolean) {
        dataStore.edit { it[KEY_VOICE_MODE_ENABLED] = enabled }
    }

    suspend fun setContinuousConversationMode(enabled: Boolean) {
        dataStore.edit { it[KEY_CONTINUOUS_MODE] = enabled }
    }

    suspend fun setAutoSpeakReplies(enabled: Boolean) {
        dataStore.edit { it[KEY_AUTO_SPEAK] = enabled }
    }

    suspend fun setAutoSpeakDailySummary(enabled: Boolean) {
        dataStore.edit { it[KEY_AUTO_SPEAK_DAILY_SUMMARY] = enabled }
    }

    suspend fun setWebSearchEnabled(enabled: Boolean) {
        dataStore.edit { it[KEY_WEB_SEARCH] = enabled }
    }

    suspend fun setAutoExtractMemories(enabled: Boolean) {
        dataStore.edit { it[KEY_AUTO_EXTRACT_MEMORIES] = enabled }
    }

    suspend fun setAccentTheme(theme: JarvisAccentTheme) {
        dataStore.edit { it[KEY_ACCENT_THEME] = theme.key }
    }

    suspend fun setAiRoutingMode(mode: AndroidAiRoutingMode) {
        dataStore.edit { it[KEY_AI_ROUTING_MODE] = mode.name }
    }

    companion object {
        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_DEFAULT_AGENT = stringPreferencesKey("default_agent")
        private val KEY_SPEECH_RATE = floatPreferencesKey("speech_rate")
        private val KEY_SPEECH_PITCH = floatPreferencesKey("speech_pitch")
        private val KEY_VOICE_VOLUME = floatPreferencesKey("voice_volume")
        private val KEY_VOICE_MUTED = booleanPreferencesKey("voice_muted")
        private val KEY_VOICE_MODE_ENABLED = booleanPreferencesKey("voice_mode_enabled")
        private val KEY_CONTINUOUS_MODE = booleanPreferencesKey("continuous_conversation_mode")
        private val KEY_AUTO_SPEAK = booleanPreferencesKey("auto_speak_replies")
        private val KEY_AUTO_SPEAK_DAILY_SUMMARY = booleanPreferencesKey("auto_speak_daily_summary")
        private val KEY_WEB_SEARCH = booleanPreferencesKey("web_search_enabled")
        private val KEY_AUTO_EXTRACT_MEMORIES = booleanPreferencesKey("auto_extract_memories")
        private val KEY_ACCENT_THEME = stringPreferencesKey("accent_theme")
        private val KEY_AI_ROUTING_MODE = stringPreferencesKey("ai_routing_mode")
    }
}
