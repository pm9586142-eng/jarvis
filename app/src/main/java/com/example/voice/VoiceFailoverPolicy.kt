package com.example.voice

object ElevenLabsSpec {
    const val VOICE_ID = "ohvvU75FpBEB8fdaLOMh"
    const val VOICE_NAME = "Monika Sogam – Lively E-com Support"
    const val MODEL_ID = "eleven_flash_v2_5"
}

object VoiceStatusLabels {
    const val ELEVENLABS_ACTIVE = "ElevenLabs – Monika Sogam"
    const val BUILTIN_FALLBACK = "AM AI Built-in Voice – Active"
    const val ELEVENLABS_RECONNECTING = "ElevenLabs – Reconnecting"
    const val VOICE_UNAVAILABLE = "Voice unavailable"
}

class VoiceCircuitBreaker(
    private val defaultCooldownMs: Long = 45_000L,
    private val nowProvider: () -> Long = { System.currentTimeMillis() }
) {
    @Volatile
    private var openUntilMs: Long = 0L

    @Volatile
    private var lastFailureCode: String? = null

    @Volatile
    private var totalTripsCount: Int = 0

    fun isOpen(): Boolean = openUntilMs > nowProvider()

    fun shouldAttemptPrimary(): Boolean = openUntilMs <= nowProvider()

    fun remainingCooldownMs(): Long {
        val now = nowProvider()
        return if (openUntilMs > now) (openUntilMs - now).coerceAtLeast(0L) else 0L
    }

    fun lastFailureCode(): String? = lastFailureCode

    fun totalTrips(): Int = totalTripsCount

    fun trip(reasonCode: String = "TTS_ERROR", customCooldownMs: Long? = null) {
        val waitMs = (customCooldownMs ?: defaultCooldownMs).coerceAtLeast(1_000L)
        openUntilMs = nowProvider() + waitMs
        lastFailureCode = reasonCode.ifBlank { "TTS_ERROR" }
        totalTripsCount += 1
    }

    fun recordSuccess() {
        openUntilMs = 0L
        lastFailureCode = null
    }

    fun reset() {
        openUntilMs = 0L
        lastFailureCode = null
        totalTripsCount = 0
    }
}

fun resolveTruthfulVoiceStatus(
    hasAnyVoice: Boolean,
    neuralTtsEnabled: Boolean,
    usingBuiltInFallback: Boolean,
    circuitOpen: Boolean,
    isProbingReconnect: Boolean
): String {
    if (!hasAnyVoice) return VoiceStatusLabels.VOICE_UNAVAILABLE
    if (!neuralTtsEnabled || usingBuiltInFallback) return VoiceStatusLabels.BUILTIN_FALLBACK
    if (circuitOpen || isProbingReconnect) return VoiceStatusLabels.ELEVENLABS_RECONNECTING
    return VoiceStatusLabels.ELEVENLABS_ACTIVE
}

fun isValidMpegAudio(bytes: ByteArray?): Boolean {
    if (bytes == null || bytes.size < 128) return false
    val hasId3 =
        bytes[0] == 'I'.code.toByte() &&
            bytes[1] == 'D'.code.toByte() &&
            bytes[2] == '3'.code.toByte()
    val hasFrameSync =
        (bytes[0].toInt() and 0xFF) == 0xFF &&
            (bytes[1].toInt() and 0xE0) == 0xE0
    return hasId3 || hasFrameSync
}

fun classifyTtsHttpFailureCooldownMs(httpCode: Int, errorBody: String = ""): Long {
    val lower = errorBody.lowercase()
    return when {
        httpCode == 401 || httpCode == 403 || httpCode == 402 -> 120_000L
        lower.contains("quota") || lower.contains("credit") -> 120_000L
        httpCode == 404 || httpCode == 422 -> 60_000L
        httpCode == 429 -> 30_000L
        else -> 30_000L
    }
}
