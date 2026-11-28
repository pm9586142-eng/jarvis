package com.example.data.preferences

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
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

enum class HudThemePreset(
    val id: String,
    val label: String,
    val shortLabel: String,
    val isLight: Boolean,
    val bgColor: Color,
    val surfaceColor: Color,
    val glassColor: Color,
    val borderColor: Color,
    val primaryColor: Color,
    val brightColor: Color,
    val glowColor: Color,
    val textPrimary: Color,
    val textMuted: Color
) {
    COSMIC_DEFAULT(
        id = "cosmic",
        label = "Cosmic Default",
        shortLabel = "COSMIC",
        isLight = false,
        bgColor = Color(0xFF02050B),
        surfaceColor = Color(0xFF071022),
        glassColor = Color(0xFF0B162C),
        borderColor = Color(0xFF1D3B66),
        primaryColor = Color(0xFF00E5FF),
        brightColor = Color(0xFF7DEEFF),
        glowColor = Color(0xFF2F8BFF),
        textPrimary = Color(0xFFE2E8F0),
        textMuted = Color(0xFF94A3B8)
    ),
    ARC_CYAN(
        id = "arc_cyan",
        label = "Arc Cyan",
        shortLabel = "ARC CYAN",
        isLight = false,
        bgColor = Color(0xFF010A14),
        surfaceColor = Color(0xFF06162A),
        glassColor = Color(0xFF091E36),
        borderColor = Color(0xFF155E75),
        primaryColor = Color(0xFF22D3EE),
        brightColor = Color(0xFFA5F3FC),
        glowColor = Color(0xFF0EA5E9),
        textPrimary = Color(0xFFECFEFF),
        textMuted = Color(0xFF94A3B8)
    ),
    STARK_GOLD(
        id = "stark_gold",
        label = "Stark Gold",
        shortLabel = "STARK GOLD",
        isLight = false,
        bgColor = Color(0xFF090602),
        surfaceColor = Color(0xFF161005),
        glassColor = Color(0xFF211708),
        borderColor = Color(0xFF78350F),
        primaryColor = Color(0xFFFFB020),
        brightColor = Color(0xFFFDE68A),
        glowColor = Color(0xFFF59E0B),
        textPrimary = Color(0xFFFEF3C7),
        textMuted = Color(0xFFD6B98C)
    ),
    LIGHT_HUD(
        id = "light_hud",
        label = "Light HUD",
        shortLabel = "LIGHT HUD",
        isLight = true,
        bgColor = Color(0xFFF3F7FD),
        surfaceColor = Color(0xFFFFFFFF),
        glassColor = Color(0xFFE8F0FC),
        borderColor = Color(0xFFBBD0F0),
        primaryColor = Color(0xFF0057B8),
        brightColor = Color(0xFF0284C7),
        glowColor = Color(0xFF1D4ED8),
        textPrimary = Color(0xFF0F172A),
        textMuted = Color(0xFF475569)
    );

    companion object {
        fun fromId(value: String?): HudThemePreset =
            entries.find { it.id.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: COSMIC_DEFAULT
    }
}

enum class DashboardLayoutMode(val key: String, val label: String) {
    COSMIC("COSMIC", "Cosmic Cockpit"),
    COMPACT("COMPACT", "Compact HUD"),
    FOCUS("FOCUS", "Focus Core"),
    CLASSIC("CLASSIC", "Classic Cards");

    companion object {
        fun fromKey(value: String?): DashboardLayoutMode =
            entries.find { it.key.equals(value, ignoreCase = true) } ?: COSMIC
    }
}

enum class CoreVisualMode(val key: String, val label: String) {
    HOLOGRAM_3D("hologram_3d", "3D HOLOGRAM"),
    ARC_REACTOR("arc_reactor", "ARC REACTOR");

    companion object {
        fun fromKey(value: String?): CoreVisualMode =
            entries.find { it.key.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: HOLOGRAM_3D
    }
}

data class JarvisUserPreferences(
    val language: JarvisLanguage = JarvisLanguage.ENGLISH,
    val defaultAgent: JarvisAgent = JarvisAgent.JARVIS_PRIME,
    val speechRate: Float = 0.90f,
    val speechPitch: Float = 1.00f,
    val voiceVolume: Float = 1.0f,
    val voiceMuted: Boolean = false,
    val voiceModeEnabled: Boolean = true,
    val femaleVoiceEnabled: Boolean = true,
    val neuralTtsEnabled: Boolean = true,
    val continuousConversationMode: Boolean = false,
    val autoSpeakReplies: Boolean = false,
    val autoSpeakDailySummary: Boolean = true,
    val webSearchEnabled: Boolean = true,
    val autoExtractMemories: Boolean = true,
    val accentTheme: JarvisAccentTheme = JarvisAccentTheme.CYAN,
    val hudThemePreset: HudThemePreset = HudThemePreset.COSMIC_DEFAULT,
    val dashboardLayoutMode: DashboardLayoutMode = DashboardLayoutMode.COSMIC,
    val coreVisualMode: CoreVisualMode = CoreVisualMode.HOLOGRAM_3D,
    val aiRoutingMode: AndroidAiRoutingMode = AndroidAiRoutingMode.HYBRID,
    val openJarvisServiceUrl: String = "",
    val customBackendUrl: String = "",
    val cachedRemoteConfigJson: String = "",
    val weatherCityName: String = JarvisPreferencesRepository.DEFAULT_WEATHER_CITY,
    val weatherLatitude: Double = JarvisPreferencesRepository.DEFAULT_WEATHER_LAT,
    val weatherLongitude: Double = JarvisPreferencesRepository.DEFAULT_WEATHER_LON
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
                speechRate = (prefs[KEY_SPEECH_RATE] ?: 0.90f).coerceIn(0.5f, 2.0f),
                speechPitch = (prefs[KEY_SPEECH_PITCH] ?: 1.00f).coerceIn(0.5f, 2.0f),
                voiceVolume = (prefs[KEY_VOICE_VOLUME] ?: 1.0f).coerceIn(0f, 1.0f),
                voiceMuted = prefs[KEY_VOICE_MUTED] ?: false,
                voiceModeEnabled = prefs[KEY_VOICE_MODE_ENABLED] ?: true,
                femaleVoiceEnabled = prefs[KEY_FEMALE_VOICE] ?: true,
                neuralTtsEnabled = prefs[KEY_NEURAL_TTS] ?: true,
                continuousConversationMode = prefs[KEY_CONTINUOUS_MODE] ?: false,
                autoSpeakReplies = prefs[KEY_AUTO_SPEAK] ?: false,
                autoSpeakDailySummary = prefs[KEY_AUTO_SPEAK_DAILY_SUMMARY] ?: true,
                webSearchEnabled = prefs[KEY_WEB_SEARCH] ?: true,
                autoExtractMemories = prefs[KEY_AUTO_EXTRACT_MEMORIES] ?: true,
                accentTheme = JarvisAccentTheme.fromKey(prefs[KEY_ACCENT_THEME]),
                hudThemePreset = HudThemePreset.fromId(prefs[KEY_HUD_THEME_PRESET]),
                dashboardLayoutMode = DashboardLayoutMode.fromKey(prefs[KEY_DASHBOARD_LAYOUT_MODE]),
                coreVisualMode = CoreVisualMode.fromKey(prefs[KEY_CORE_VISUAL_MODE]),
                aiRoutingMode = routingMode,
                openJarvisServiceUrl = prefs[KEY_OPENJARVIS_SERVICE_URL] ?: "",
                customBackendUrl = prefs[KEY_CUSTOM_BACKEND_URL] ?: "",
                cachedRemoteConfigJson = prefs[KEY_CACHED_REMOTE_CONFIG_JSON] ?: "",
                weatherCityName = prefs[KEY_WEATHER_CITY_NAME]?.takeIf { it.isNotBlank() } ?: DEFAULT_WEATHER_CITY,
                weatherLatitude = prefs[KEY_WEATHER_LAT] ?: DEFAULT_WEATHER_LAT,
                weatherLongitude = prefs[KEY_WEATHER_LON] ?: DEFAULT_WEATHER_LON
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

    suspend fun setFemaleVoiceEnabled(enabled: Boolean) {
        dataStore.edit { it[KEY_FEMALE_VOICE] = enabled }
    }

    suspend fun setNeuralTtsEnabled(enabled: Boolean) {
        dataStore.edit { it[KEY_NEURAL_TTS] = enabled }
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

    suspend fun setHudThemePreset(preset: HudThemePreset) {
        dataStore.edit { it[KEY_HUD_THEME_PRESET] = preset.id }
    }

    suspend fun setDashboardLayoutMode(mode: DashboardLayoutMode) {
        dataStore.edit { it[KEY_DASHBOARD_LAYOUT_MODE] = mode.key }
    }

    suspend fun setCoreVisualMode(mode: CoreVisualMode) {
        dataStore.edit { it[KEY_CORE_VISUAL_MODE] = mode.key }
    }

    suspend fun setAiRoutingMode(mode: AndroidAiRoutingMode) {
        dataStore.edit { it[KEY_AI_ROUTING_MODE] = mode.name }
    }

    suspend fun setOpenJarvisServiceUrl(url: String) {
        dataStore.edit { it[KEY_OPENJARVIS_SERVICE_URL] = url.trim() }
    }

    suspend fun setCustomBackendUrl(url: String) {
        dataStore.edit { it[KEY_CUSTOM_BACKEND_URL] = url.trim().trimEnd('/') }
    }

    suspend fun setCachedRemoteConfigJson(json: String) {
        dataStore.edit { it[KEY_CACHED_REMOTE_CONFIG_JSON] = json }
    }

    suspend fun setWeatherLocation(cityName: String, latitude: Double, longitude: Double) {
        dataStore.edit {
            it[KEY_WEATHER_CITY_NAME] = cityName.trim().ifBlank { DEFAULT_WEATHER_CITY }
            it[KEY_WEATHER_LAT] = latitude
            it[KEY_WEATHER_LON] = longitude
        }
    }

    companion object {
        const val DEFAULT_WEATHER_CITY = "Surat, India"
        const val DEFAULT_WEATHER_LAT = 21.1702
        const val DEFAULT_WEATHER_LON = 72.8311

        private val KEY_LANGUAGE = stringPreferencesKey("language")
        private val KEY_DEFAULT_AGENT = stringPreferencesKey("default_agent")
        private val KEY_SPEECH_RATE = floatPreferencesKey("speech_rate")
        private val KEY_SPEECH_PITCH = floatPreferencesKey("speech_pitch")
        private val KEY_VOICE_VOLUME = floatPreferencesKey("voice_volume")
        private val KEY_VOICE_MUTED = booleanPreferencesKey("voice_muted")
        private val KEY_VOICE_MODE_ENABLED = booleanPreferencesKey("voice_mode_enabled")
        private val KEY_FEMALE_VOICE = booleanPreferencesKey("female_voice_enabled")
        private val KEY_NEURAL_TTS = booleanPreferencesKey("neural_tts_enabled")
        private val KEY_CONTINUOUS_MODE = booleanPreferencesKey("continuous_conversation_mode")
        private val KEY_AUTO_SPEAK = booleanPreferencesKey("auto_speak_replies")
        private val KEY_AUTO_SPEAK_DAILY_SUMMARY = booleanPreferencesKey("auto_speak_daily_summary")
        private val KEY_WEB_SEARCH = booleanPreferencesKey("web_search_enabled")
        private val KEY_AUTO_EXTRACT_MEMORIES = booleanPreferencesKey("auto_extract_memories")
        private val KEY_ACCENT_THEME = stringPreferencesKey("accent_theme")
        private val KEY_HUD_THEME_PRESET = stringPreferencesKey("hud_theme_preset")
        private val KEY_DASHBOARD_LAYOUT_MODE = stringPreferencesKey("dashboard_layout_mode")
        private val KEY_CORE_VISUAL_MODE = stringPreferencesKey("core_visual_mode")
        private val KEY_AI_ROUTING_MODE = stringPreferencesKey("ai_routing_mode")
        private val KEY_OPENJARVIS_SERVICE_URL = stringPreferencesKey("openjarvis_service_url")
        private val KEY_CUSTOM_BACKEND_URL = stringPreferencesKey("custom_backend_url")
        private val KEY_CACHED_REMOTE_CONFIG_JSON = stringPreferencesKey("cached_remote_config_json")
        private val KEY_WEATHER_CITY_NAME = stringPreferencesKey("weather_city_name")
        private val KEY_WEATHER_LAT = doublePreferencesKey("weather_lat")
        private val KEY_WEATHER_LON = doublePreferencesKey("weather_lon")
    }
}
