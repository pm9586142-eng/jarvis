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
}
