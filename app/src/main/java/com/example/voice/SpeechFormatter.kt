package com.example.voice

import com.example.agents.JarvisLanguage
import java.util.Locale

object SpeechFormatter {
    private val FENCED_CODE_REGEX = Regex("```[\\s\\S]*?```")
    private val INLINE_CODE_REGEX = Regex("`([^`]+)`")
    private val MARKDOWN_LINK_REGEX = Regex("\\[([^\\]]+)]\\(([^)]+)\\)")
    private val RAW_URL_REGEX = Regex("https?://\\S+")
    private val HEADING_PREFIX_REGEX = Regex("(?m)^#{1,6}\\s+")
    private val BLOCKQUOTE_PREFIX_REGEX = Regex("(?m)^>\\s?")
    private val BULLET_PREFIX_REGEX = Regex("(?m)^\\s*[-*+]\\s+")
    private val BOLD_ITALIC_REGEX = Regex("(\\*\\*\\*|___|\\*\\*|__|~~|\\*)")
    private val TABLE_BAR_REGEX = Regex("[|]+")
    private val EXTRA_PUNCT_REGEX = Regex("[\\{\\}\\[\\]<>/\\\\~^_=]+")
    private val WHITESPACE_REGEX = Regex("\\s+")
    private val DEVANAGARI_REGEX = Regex("[\\u0900-\\u097F]")
    private val GUJARATI_REGEX = Regex("[\\u0A80-\\u0AFF]")

    /**
     * Strips code blocks, Markdown syntax, URLs, and noisy punctuation so TTS reads natural prose.
     */
    fun formatTextForSpeech(rawText: String): String {
        if (rawText.isBlank()) return ""
        var cleaned = rawText
            .replace(FENCED_CODE_REGEX, ". Code snippet omitted. ")
            .replace(INLINE_CODE_REGEX, "$1")
            .replace(MARKDOWN_LINK_REGEX, "$1")
            .replace(RAW_URL_REGEX, "link")
            .replace(HEADING_PREFIX_REGEX, "")
            .replace(BLOCKQUOTE_PREFIX_REGEX, "")
            .replace(BULLET_PREFIX_REGEX, "")
            .replace(BOLD_ITALIC_REGEX, "")
            .replace(TABLE_BAR_REGEX, ", ")
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
        if (DEVANAGARI_REGEX.containsMatchIn(text)) return Locale("hi", "IN")
        if (GUJARATI_REGEX.containsMatchIn(text)) return Locale("gu", "IN")
        return when (preferredLanguage) {
            JarvisLanguage.HINDI -> Locale("hi", "IN")
            JarvisLanguage.HINGLISH -> Locale("en", "IN")
            JarvisLanguage.GUJARATI -> Locale("gu", "IN")
            JarvisLanguage.ENGLISH -> Locale.UK
        }
    }
}
