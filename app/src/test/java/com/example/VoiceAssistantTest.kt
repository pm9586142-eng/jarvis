package com.example

import com.example.agents.JarvisLanguage
import com.example.voice.SpeechFormatter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class VoiceAssistantTest {

    @Test
    fun formatTextForSpeech_stripsMarkdownCodeLinksAndUrls() {
        val raw = """
            ## Build Report
            Hello **Sir**, see [Architecture Docs](https://example.com/arch) and inspect `JarvisViewModel`:

            ```kotlin
            val token = computeHash()
            ```

            | Module | Status |
            | --- | --- |
            | Voice | Active |

            - Check https://status.example.org right away.
        """.trimIndent()

        val spoken = SpeechFormatter.formatTextForSpeech(raw)
        assertFalse(spoken.contains("```"))
        assertFalse(spoken.contains("**"))
        assertFalse(spoken.contains("https://"))
        assertTrue(spoken.contains("Code snippet omitted"))
        assertTrue(spoken.contains("Architecture Docs"))
        assertTrue(spoken.contains("JarvisViewModel"))
        assertTrue(spoken.contains("link"))
    }

    @Test
    fun splitSpeechIntoChunks_splitsLongRepliesAtNaturalBoundaries() {
        val longReply = listOf(
            "Orbital diagnostics complete across every subsystem.",
            "Long-term memory vault indexed forty-eight verified user facts without duplication.",
            "Pause and resume checkpoints preserve reading progress cleanly without UI blocking.",
            "Standing by for your next command, Sir."
        ).joinToString(" ")

        val chunks = SpeechFormatter.splitSpeechIntoChunks(longReply, maxLength = 120)
        assertTrue(chunks.size >= 2)
        assertTrue(chunks.all { it.length <= 120 })
        assertEquals(longReply, chunks.joinToString(" "))
    }

    @Test
    fun resolveTtsLocale_detectsHindiHinglishGujaratiAndEnglish() {
        assertEquals(Locale("hi", "IN"), SpeechFormatter.resolveTtsLocale("नमस्ते सर, क्या हाल हैं?", JarvisLanguage.ENGLISH))
        assertEquals(Locale("gu", "IN"), SpeechFormatter.resolveTtsLocale("નમસ્તે સર", JarvisLanguage.ENGLISH))
        assertEquals(Locale("en", "IN"), SpeechFormatter.resolveTtsLocale("System ready hai, Sir.", JarvisLanguage.HINGLISH))
        assertEquals(Locale.UK, SpeechFormatter.resolveTtsLocale("All systems nominal, Sir.", JarvisLanguage.ENGLISH))
    }

    @Test
    fun jarvisLanguage_includesHinglishPreset() {
        val hinglish = JarvisLanguage.HINGLISH
        assertEquals("en-IN", hinglish.localeTag)
        assertTrue(hinglish.displayName.contains("Hinglish"))
    }

    @Test
    fun splitSpeechIntoBilingualSegments_assignsLocalesAndInterSentencePauses() {
        val mixed = "Hello Sir! How are you? नमस्ते सर, आज मैं आपकी क्या सहायता कर सकती हूँ।"
        val segments = SpeechFormatter.splitSpeechIntoBilingualSegments(mixed, JarvisLanguage.ENGLISH)
        assertTrue(segments.size >= 3)
        assertEquals("en", segments[0].locale.language)
        assertTrue(segments[0].pauseAfterMs >= 240L)
        val hindiSeg = segments.firstOrNull { it.locale == Locale("hi", "IN") }
        assertTrue(hindiSeg != null && hindiSeg.text.contains("नमस्ते सर"))
        assertEquals(0L, segments.last().pauseAfterMs)
    }

    @Test
    fun getVoiceTestSample_providesNaturalHindiEnglishAndHinglishSamples() {
        val hi = SpeechFormatter.getVoiceTestSample(JarvisLanguage.HINDI)
        val en = SpeechFormatter.getVoiceTestSample(JarvisLanguage.ENGLISH)
        val hinglish = SpeechFormatter.getVoiceTestSample(JarvisLanguage.HINGLISH)
        assertTrue(hi.contains("सुनो ना"))
        assertTrue(en.contains("AM AI"))
        assertTrue(hinglish.contains("soft"))
    }

    @Test
    fun formatTextForSpeech_stripsHtmlTagsEntitiesAndEmojis() {
        val raw = "<h2>🚀 Update</h2><br><b>AM AI</b> &amp; Monika are online ✨🎙️ at 100%!"
        val spoken = SpeechFormatter.formatTextForSpeech(raw)
        assertFalse(spoken.contains("<h2>"))
        assertFalse(spoken.contains("<b>"))
        assertFalse(spoken.contains("&amp;"))
        assertFalse(spoken.contains("🚀"))
        assertFalse(spoken.contains("✨"))
        assertTrue(spoken.contains("A M A I and Monika are online at 100%!"))
    }

    @Test
    fun elevenLabsSpec_and_truthfulStatusLabels_matchExactRequirements() {
        assertEquals("ohvvU75FpBEB8fdaLOMh", com.example.voice.ElevenLabsSpec.VOICE_ID)
        assertEquals("eleven_flash_v2_5", com.example.voice.ElevenLabsSpec.MODEL_ID)
        assertEquals("ElevenLabs – Monika Sogam", com.example.voice.VoiceStatusLabels.ELEVENLABS_ACTIVE)
        assertEquals("AM AI Built-in Voice – Active", com.example.voice.VoiceStatusLabels.BUILTIN_FALLBACK)
        assertEquals("ElevenLabs – Reconnecting", com.example.voice.VoiceStatusLabels.ELEVENLABS_RECONNECTING)
        assertEquals("Voice unavailable", com.example.voice.VoiceStatusLabels.VOICE_UNAVAILABLE)
    }

    @Test
    fun voiceCircuitBreaker_handlesTripCooldownAndRecoveryWithoutFalseRestores() {
        var fakeNow = 100_000L
        val breaker = com.example.voice.VoiceCircuitBreaker(
            defaultCooldownMs = 45_000L,
            nowProvider = { fakeNow }
        )

        assertTrue(breaker.shouldAttemptPrimary())
        assertFalse(breaker.isOpen())

        // Simulate 429 rate limit or timeout trip
        breaker.trip("HTTP_429", 30_000L)
        assertTrue(breaker.isOpen())
        assertFalse(breaker.shouldAttemptPrimary())
        assertEquals(
            com.example.voice.VoiceStatusLabels.BUILTIN_FALLBACK,
            com.example.voice.resolveTruthfulVoiceStatus(
                hasAnyVoice = true,
                neuralTtsEnabled = true,
                usingBuiltInFallback = true,
                circuitOpen = breaker.isOpen(),
                isProbingReconnect = false
            )
        )

        // Cooldown expires -> half-open probe allowed
        fakeNow += 31_000L
        assertFalse(breaker.isOpen())
        assertTrue(breaker.shouldAttemptPrimary())

        // Probe succeeds -> circuit closed cleanly
        breaker.recordSuccess()
        assertEquals(null, breaker.lastFailureCode())
        assertEquals(
            com.example.voice.VoiceStatusLabels.ELEVENLABS_ACTIVE,
            com.example.voice.resolveTruthfulVoiceStatus(
                hasAnyVoice = true,
                neuralTtsEnabled = true,
                usingBuiltInFallback = false,
                circuitOpen = breaker.isOpen(),
                isProbingReconnect = false
            )
        )
    }

    @Test
    fun isValidMpegAudio_rejectsCorruptJsonEmptyBytesAndAcceptsValidMp3Headers() {
        assertFalse(com.example.voice.isValidMpegAudio(null))
        assertFalse(com.example.voice.isValidMpegAudio(ByteArray(0)))
        assertFalse(com.example.voice.isValidMpegAudio("{\"error\":\"quota\"}".toByteArray()))

        val validId3 = ByteArray(256) { 0x11 }.apply {
            this[0] = 'I'.code.toByte()
            this[1] = 'D'.code.toByte()
            this[2] = '3'.code.toByte()
        }
        assertTrue(com.example.voice.isValidMpegAudio(validId3))

        val validFrameSync = ByteArray(256) { 0x22 }.apply {
            this[0] = 0xFF.toByte()
            this[1] = 0xFB.toByte()
        }
        assertTrue(com.example.voice.isValidMpegAudio(validFrameSync))

        assertEquals(120_000L, com.example.voice.classifyTtsHttpFailureCooldownMs(401, "Unauthorized"))
        assertEquals(120_000L, com.example.voice.classifyTtsHttpFailureCooldownMs(402, "Quota exceeded"))
        assertEquals(30_000L, com.example.voice.classifyTtsHttpFailureCooldownMs(429, "Rate limit"))
    }
}
