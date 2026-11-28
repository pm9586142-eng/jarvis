package com.example.voice

import com.example.agents.JarvisLanguage
import java.util.Locale

object SpeechFormatter {
    private val FENCED_CODE_REGEX = Regex("```[\\s\\S]*?```")
    private val INLINE_CODE_REGEX = Regex("`([^`]+)`")
    private val MARKDOWN_LINK_REGEX = Regex("\\[([^\\]]+)]\\(([^)]+)\\)")
    private val RAW_URL_REGEX = Regex("https?://\\S+")
    private val HTML_LINE_BREAK_REGEX = Regex("(?i)<\\s*br\\s*/?>|</(?:p|div|li|h[1-6]|tr)>")
    private val HTML_TAG_REGEX = Regex("<[^>]+>")
    private val EMOJI_PICTOGRAPH_REGEX = Regex("[\\x{1F000}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{2300}-\\x{23FF}\\uFE0E\\uFE0F\\u200D]")
    private val HEADING_PREFIX_REGEX = Regex("(?m)^#{1,6}\\s+")
    private val BLOCKQUOTE_PREFIX_REGEX = Regex("(?m)^>\\s?")
    private val BULLET_PREFIX_REGEX = Regex("(?m)^\\s*[-*+]\\s+")
    private val BOLD_ITALIC_REGEX = Regex("(\\*\\*\\*|___|\\*\\*|__|~~|\\*)")
    private val TABLE_BAR_REGEX = Regex("[|]+")
    private val EXTRA_PUNCT_REGEX = Regex("[\\{\\}\\[\\]<>/\\\\~^_=]+")
    private val WHITESPACE_REGEX = Regex("\\s+")
    private val DEVANAGARI_REGEX = Regex("[\\u0900-\\u097F]")
    private val GUJARATI_REGEX = Regex("[\\u0A80-\\u0AFF]")

    private val LOCALE_HI_IN: Locale = Locale.forLanguageTag("hi-IN")
    private val LOCALE_EN_IN: Locale = Locale.forLanguageTag("en-IN")
    private val LOCALE_GU_IN: Locale = Locale.forLanguageTag("gu-IN")

    /**
     * Strips code blocks, HTML tags, emojis, Markdown syntax, URLs, and noisy punctuation so TTS reads natural prose.
     */
    fun formatTextForSpeech(rawText: String): String {
        if (rawText.isBlank()) return ""
        var cleaned = rawText
            .replace(FENCED_CODE_REGEX, ". Code snippet omitted. ")
            .replace(INLINE_CODE_REGEX, "$1")
            .replace(MARKDOWN_LINK_REGEX, "$1")
            .replace(RAW_URL_REGEX, "link")
            .replace(HTML_LINE_BREAK_REGEX, ". ")
            .replace(HTML_TAG_REGEX, " ")
            .replace("&nbsp;", " ")
            .replace("&amp;", " and ")
            .replace(Regex("&(?:lt|gt|quot|#39);"), " ")
            .replace(EMOJI_PICTOGRAPH_REGEX, " ")
            .replace(HEADING_PREFIX_REGEX, "")
            .replace(BLOCKQUOTE_PREFIX_REGEX, "")
            .replace(BULLET_PREFIX_REGEX, "")
            .replace(BOLD_ITALIC_REGEX, "")
            .replace(TABLE_BAR_REGEX, ", ")
            .replace(Regex("\\bAM\\s+AI\\b", RegexOption.IGNORE_CASE), "A M A I")
            .replace(EXTRA_PUNCT_REGEX, " ")
            .replace(Regex("\\.{2,}"), ".")
            .replace(WHITESPACE_REGEX, " ")
            .trim()

        // Collapse duplicate commas or periods created during cleanup
        cleaned = cleaned.replace(Regex(",\\s*,"), ",")
            .replace(Regex("\\.\\s*\\."), ".")
            .trim()
        return cleaned
    }

    /**
     * Splits cleaned speech text into natural sentence-aligned chunks so long responses can be paused/resumed cleanly.
     */
    fun splitSpeechIntoChunks(text: String, maxLength: Int = 340): List<String> {
        val cleaned = text.trim()
        if (cleaned.isEmpty()) return emptyList()
        if (cleaned.length <= maxLength) return listOf(cleaned)

        val chunks = mutableListOf<String>()
        var start = 0
        val safeMax = maxLength.coerceAtLeast(80)
        while (start < cleaned.length) {
            val end = (start + safeMax).coerceAtMost(cleaned.length)
            if (end == cleaned.length) {
                val tail = cleaned.substring(start).trim()
                if (tail.isNotEmpty()) chunks.add(tail)
                break
            }
            var splitAt = -1
            for (delim in charArrayOf('।', '.', '!', '?', '\n', ';', ',', ' ')) {
                val idx = cleaned.lastIndexOf(delim, end - 1)
                if (idx >= start + safeMax / 3) {
                    splitAt = idx + 1
                    break
                }
            }
            if (splitAt <= start) splitAt = end
            val piece = cleaned.substring(start, splitAt).trim()
            if (piece.isNotEmpty()) chunks.add(piece)
            start = splitAt
        }
        return chunks
    }

    fun resolveTtsLocale(text: String, preferredLanguage: JarvisLanguage): Locale {
        if (DEVANAGARI_REGEX.containsMatchIn(text)) return LOCALE_HI_IN
        if (GUJARATI_REGEX.containsMatchIn(text)) return LOCALE_GU_IN
        return when (preferredLanguage) {
            JarvisLanguage.HINDI -> LOCALE_HI_IN
            JarvisLanguage.HINGLISH -> LOCALE_EN_IN
            JarvisLanguage.GUJARATI -> LOCALE_GU_IN
            JarvisLanguage.ENGLISH -> Locale.UK
        }
    }

    data class SpeechSegment(
        val text: String,
        val locale: Locale,
        val pauseAfterMs: Long = 0L
    )

    private val HINGLISH_HINT_REGEX = Regex(
        "\\b(namaste|kaise|kaisa|kaisi|ho|hain|hai|aap|aapka|aapki|tum|main|mein|mera|meri|kya|kyun|nahi|haan|theek|accha|achha|batao|bataiye|shukriya|madad|bilkul|suno)\\b",
        RegexOption.IGNORE_CASE
    )

    fun detectSegmentLocale(segmentText: String, preferredLanguage: JarvisLanguage): Locale {
        val clean = segmentText.trim()
        if (clean.isEmpty()) return resolveTtsLocale(segmentText, preferredLanguage)
        if (DEVANAGARI_REGEX.containsMatchIn(clean)) return LOCALE_HI_IN
        if (GUJARATI_REGEX.containsMatchIn(clean)) return LOCALE_GU_IN
        if (HINGLISH_HINT_REGEX.containsMatchIn(clean)) return LOCALE_EN_IN
        return LOCALE_EN_IN
    }

    /**
     * Splits text into sentence-aligned bilingual segments with gentle inter-sentence pause timings
     * so Hindi, English, and Hinglish parts sound warm, natural, and unhurried.
     */
    fun splitSpeechIntoBilingualSegments(
        rawText: String,
        preferredLanguage: JarvisLanguage,
        maxLength: Int = 220
    ): List<SpeechSegment> {
        val formatted = formatTextForSpeech(rawText)
        if (formatted.isBlank()) return emptyList()

        val rawSentences = formatted
            .split(Regex("(?<=[.!?।])\\s+"))
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        val expanded = mutableListOf<Pair<String, Locale>>()
        for (sentence in if (rawSentences.isEmpty()) listOf(formatted) else rawSentences) {
            val locale = detectSegmentLocale(sentence, preferredLanguage)
            val subChunks = splitSpeechIntoChunks(sentence, maxLength)
            for (chunk in subChunks) {
                expanded.add(chunk to locale)
            }
        }

        return expanded.mapIndexed { idx, (chunkText, locale) ->
            val pauseMs = when {
                idx >= expanded.lastIndex -> 0L
                chunkText.endsWith("?") || chunkText.endsWith("!") || chunkText.endsWith("।") -> 310L
                expanded[idx + 1].second != locale -> 280L
                else -> 240L
            }
            SpeechSegment(text = chunkText, locale = locale, pauseAfterMs = pauseMs)
        }
    }

    fun getVoiceTestSample(language: JarvisLanguage): String = when (language) {
        JarvisLanguage.HINDI ->
            "अच्छा, सुनो ना... नमस्ते। मैं आपकी ए एम ए आई असिस्टेंट हूँ। जब भी आप बात करेंगे, मैं बहुत आराम से और प्यार से आपकी मदद करने के लिए तैयार हूँ।"
        JarvisLanguage.ENGLISH ->
            "Hello... welcome to AM AI. Take a quiet moment, I am right here with you, ready to help gently and clearly whenever you need me."
        JarvisLanguage.HINGLISH ->
            "Hello Sir... Aap kaise hain? Main AM AI hoon, aur ab meri voice bilkul soft, warm aur natural hai. Bataiye, aaj hum kis cheez par kaam karein?"
        JarvisLanguage.GUJARATI ->
            "નમસ્તે... એ એમ એ આઈ માં આપનું સ્વાગત છે. હું શાંતિથી અને સરળતાથી આપની મદદ કરવા માટે હંમેશા તૈયાર છું."
    }
}
