package com.example.media

import com.example.agents.JarvisLanguage

sealed class YouTubeVoiceCommand {
    data object OpenYouTube : YouTubeVoiceCommand()
    data class SearchYouTube(val query: String, val mode: YouTubeSearchMode = YouTubeSearchMode.VIDEO) : YouTubeVoiceCommand()
    data class PlayQuery(val query: String, val mode: YouTubeSearchMode = YouTubeSearchMode.VIDEO) : YouTubeVoiceCommand()
    data class SelectIndex(val index: Int) : YouTubeVoiceCommand()
    data object NextVideo : YouTubeVoiceCommand()
    data object PreviousVideo : YouTubeVoiceCommand()
    data object Pause : YouTubeVoiceCommand()
    data object Resume : YouTubeVoiceCommand()
    data object Stop : YouTubeVoiceCommand()
    data object VolumeUp : YouTubeVoiceCommand()
    data object VolumeDown : YouTubeVoiceCommand()
    data class SetVolume(val level: Int) : YouTubeVoiceCommand()
    data object Mute : YouTubeVoiceCommand()
    data object Unmute : YouTubeVoiceCommand()
    data class SeekForward(val seconds: Int = 10) : YouTubeVoiceCommand()
    data class SeekBackward(val seconds: Int = 10) : YouTubeVoiceCommand()
    data object PlayDifferent : YouTubeVoiceCommand()
    data class ToggleFullscreen(val enable: Boolean? = null) : YouTubeVoiceCommand()
}

/**
 * Bilingual English, Hindi (Devanagari), and Hinglish voice command parser for YouTube Media Control.
 * Designed to coexist cleanly with VoiceCommandParser without hijacking general chat queries.
 */
object YouTubeVoiceCommandParser {

    private val DEVANAGARI_REGEX = Regex("[\\u0900-\\u097F]")
    private val WAKE_PREFIX_REGEX = Regex(
        "^(?:(?:hey|ok|okay|hi|hello|yo|हे|ओके|हाय)\\s+)?(?:j\\.?a\\.?r\\.?v\\.?i\\.?s\\.?|jarvis|जार्विस)[,!?:\\s-]*",
        RegexOption.IGNORE_CASE
    )
    private val ORDINAL_MAP = mapOf(
        "1" to 0, "1st" to 0, "first" to 0, "pehla" to 0, "pahla" to 0, "पहला" to 0, "प्रथम" to 0,
        "2" to 1, "2nd" to 1, "second" to 1, "doosra" to 1, "dusra" to 1, "दूसरा" to 1,
        "3" to 2, "3rd" to 2, "third" to 2, "teesra" to 2, "tisra" to 2, "तीसरा" to 2,
        "4" to 3, "4th" to 3, "fourth" to 3, "chautha" to 3, "चौथा" to 3,
        "5" to 4, "5th" to 4, "fifth" to 4, "paanchva" to 4, "पांचवा" to 4, "पाँचवाँ" to 4
    )
    private val WORD_NUMBER_MAP = mapOf(
        "five" to 5, "ten" to 10, "fifteen" to 15, "twenty" to 20, "thirty" to 30,
        "forty" to 40, "fifty" to 50, "sixty" to 60, "hundred" to 100,
        "पांच" to 5, "पाँच" to 5, "दस" to 10, "पंद्रह" to 15, "बीस" to 20, "तीस" to 30,
        "पचास" to 50, "साठ" to 60, "सौ" to 100,
        "paanch" to 5, "das" to 10, "pandrah" to 15, "bees" to 20, "tees" to 30
    )

    fun isHindiInput(rawText: String, selectedLanguage: JarvisLanguage): Boolean {
        return DEVANAGARI_REGEX.containsMatchIn(rawText) || selectedLanguage == JarvisLanguage.HINDI
    }

    fun bilingualReply(
        english: String,
        hindi: String,
        rawText: String,
        selectedLanguage: JarvisLanguage
    ): String = if (isHindiInput(rawText, selectedLanguage)) hindi else english

    private fun parseDurationSeconds(text: String, defaultSec: Int = 10): Int {
        val digitMatch = Regex("(\\d+)\\s*(seconds?|secs?|sec|s|minutes?|mins?|min|सेकंड|सेकेंड|मिनट)?", RegexOption.IGNORE_CASE)
            .find(text)
        if (digitMatch != null) {
            val num = digitMatch.groupValues[1].toIntOrNull() ?: defaultSec
            val unit = digitMatch.groupValues[2].lowercase()
            val sec = if (unit.startsWith("min") || unit == "मिनट") num * 60 else num
            return sec.coerceIn(1, 3600)
        }
        val lower = text.lowercase()
        for ((word, value) in WORD_NUMBER_MAP) {
            if (lower.contains(word)) {
                val isMin = lower.contains("min") || lower.contains("मिनट")
                return (if (isMin) value * 60 else value).coerceIn(1, 3600)
            }
        }
        return defaultSec
    }

    private fun detectMode(query: String): YouTubeSearchMode {
        val lower = query.lowercase()
        return when {
            Regex("\\b(song|songs|music|audio|track|gaana|gana|gaane|lofi|playlist|singer|arijit)\\b|गाना|गाने|संगीत")
                .containsMatchIn(lower) -> YouTubeSearchMode.MUSIC
            Regex("\\b(tutorial|course|lecture|lesson|learn|study|explained|physics|math|coding|programming|science)\\b|पढ़ाई|क्लास|ट्यूटोरियल")
                .containsMatchIn(lower) -> YouTubeSearchMode.EDUCATION
            else -> YouTubeSearchMode.VIDEO
        }
    }

    fun parse(rawInput: String): YouTubeVoiceCommand? {
        val normalized = rawInput
            .trim()
            .replace(WAKE_PREFIX_REGEX, "")
            .replace(Regex("[।.!?]+$"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (normalized.isBlank()) return null
        val lower = normalized.lowercase()

        // 1. Open YouTube directly
        if (Regex("^(?:open|launch|start)\\s+youtube$|^youtube\\s+(?:kholo|khol\\s+do|open\\s+karo|chalao)$|^यूट्यूब\\s+(?:खोलो|खोल\\s+दो|चलाओ)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.OpenYouTube
        }

        // 2. Fullscreen
        if (Regex("\\b(?:turn\\s+on\\s+fullscreen|enter\\s+fullscreen|go\\s+fullscreen|fullscreen\\s+on|full\\s+screen\\s+mode|fullscreen\\s+karo|फुलस्क्रीन\\s*(?:करो|चालू\\s*करो|ऑन\\s*करो))\\b").containsMatchIn(lower)) {
            return YouTubeVoiceCommand.ToggleFullscreen(true)
        }
        if (Regex("\\b(?:exit\\s+fullscreen|leave\\s+fullscreen|close\\s+fullscreen|fullscreen\\s+off|फुलस्क्रीन\\s*(?:बंद\\s*करो|हटाओ))\\b").containsMatchIn(lower)) {
            return YouTubeVoiceCommand.ToggleFullscreen(false)
        }

        // 3. Playback controls (Pause / Resume / Stop / Next / Previous)
        if (Regex("^(?:pause(?:\\s+(?:the\\s+)?(?:video|song|music|playback|media|player))?|(?:video|song|music|gaana)\\s+(?:pause|rok)\\s*(?:karo|kar\\s+do|do)?|वीडियो\\s+रोक(?:ो|\\s+दो)|गाना\\s+रोक(?:ो|\\s+दो))$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.Pause
        }
        if (Regex("^(?:resume(?:\\s+(?:the\\s+)?(?:video|song|music|playback|media))?|play\\s+again|(?:video|song|music|gaana)\\s+(?:resume|phir\\s+se\\s+chalao|chalu\\s+karo)|वीडियो\\s+फिर\\s+से\\s+चलाओ|गाना\\s+फिर\\s+से\\s+चलाओ)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.Resume
        }
        if (Regex("^(?:stop\\s+(?:the\\s+)?(?:video|song|music|playback|media|player)|(?:video|song|music|gaana)\\s+(?:band|stop)\\s*(?:karo|kar\\s+do)?|वीडियो\\s+बंद\\s+(?:करो|कर\\s+दो)|गाना\\s+बंद\\s+(?:करो|कर\\s+दो))$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.Stop
        }
        if (Regex("^(?:(?:play\\s+(?:the\\s+)?)?next\\s+(?:video|song|track|music)|next\\s+(?:video|song)\\s+play\\s+karo|skip\\s+(?:this\\s+)?(?:video|song|track)|agla\\s+(?:video|gaana)\\s*(?:chalao|lagao)?|अगला\\s+(?:वीडियो|गाना)\\s*(?:चलाओ|लगाओ)?)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.NextVideo
        }
        if (Regex("^(?:(?:play\\s+(?:the\\s+)?)?(?:previous|prev|last)\\s+(?:video|song|track|music)|pichla\\s+(?:video|gaana)\\s*(?:chalao)?|पिछला\\s+(?:वीडियो|गाना)\\s*(?:चलाओ)?)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.PreviousVideo
        }

        // 4. Play a different song / video
        if (Regex("^(?:play\\s+(?:a\\s+)?(?:different|another)\\s+(?:song|track|music|video)|koi\\s+doosra\\s+(?:gaana|video)\\s+chalao|कोई\\s+दूसरा\\s+(?:गाना|वीडियो)\\s+चलाओ)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.PlayDifferent
        }

        // 5. Volume & Mute/Unmute
        if (Regex("^(?:mute(?:\\s+(?:the\\s+)?(?:video|song|music|audio|player))?|आवाज\\s+बंद\\s+करो|आवाज़\\s+बंद\\s+करो|awaz\\s+band\\s+karo)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.Mute
        }
        if (Regex("^(?:unmute(?:\\s+(?:the\\s+)?(?:video|song|music|audio|player))?|आवाज\\s+चालू\\s+करो|आवाज़\\s+चालू\\s+करो|awaz\\s+chalu\\s+karo)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.Unmute
        }
        if (Regex("^(?:volume\\s+(?:full|max|maximum)(?:\\s+kar\\s+do|\\s+karo)?|full\\s+volume|आवाज\\s+फुल\\s+करो)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.SetVolume(100)
        }
        val explicitVol = Regex("^(?:set\\s+)?volume\\s+(?:to\\s+)?(\\d{1,3})(?:\\s*%|\\s+percent)?$|^volume\\s+(\\d{1,3})\\s+kar(?:o|\\s+do)$")
            .find(lower)
        if (explicitVol != null) {
            val lvl = (explicitVol.groupValues[1].ifBlank { explicitVol.groupValues[2] }).toIntOrNull()
            if (lvl != null) return YouTubeVoiceCommand.SetVolume(lvl.coerceIn(0, 100))
        }
        if (Regex("^(?:(?:increase|raise|turn\\s+up)\\s+(?:the\\s+)?volume|volume\\s+up|louder|आवाज\\s+बढ़ाओ|आवाज़\\s+बढ़ाओ|awaz\\s+badhao|volume\\s+badhao)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.VolumeUp
        }
        if (Regex("^(?:(?:decrease|lower|turn\\s+down)\\s+(?:the\\s+)?volume|volume\\s+down|quieter|आवाज\\s+कम\\s+करो|आवाज़\\s+कम\\s+करो|awaz\\s+kam\\s+karo|volume\\s+kam\\s+karo)$")
                .matches(lower)
        ) {
            return YouTubeVoiceCommand.VolumeDown
        }

        // 6. Seek Forward / Backward
        if (Regex("(?:skip\\s+forward|fast\\s+forward|seek\\s+forward|forward\\s+by|aage\\s+(?:karo|badhao)|आगे\\s+(?:करो|बढ़ाओ))")
                .containsMatchIn(lower) &&
            Regex("(?:second|sec|min|सेकंड|सेकेंड|मिनट|forward|aage|आगे)").containsMatchIn(lower)
        ) {
            return YouTubeVoiceCommand.SeekForward(parseDurationSeconds(normalized, 10))
        }
        if (Regex("(?:go\\s+back|skip\\s+back|seek\\s+back|rewind|peeche\\s+karo|piche\\s+karo|पीछे\\s+करो)")
                .containsMatchIn(lower) &&
            Regex("(?:second|sec|min|सेकंड|सेकेंड|मिनट|rewind|back|peeche|piche|पीछे)").containsMatchIn(lower)
        ) {
            return YouTubeVoiceCommand.SeekBackward(parseDurationSeconds(normalized, 10))
        }

        // 7. Select specific result index ("Play the first video", "पहला वीडियो चलाओ", "Play video 2")
        val idxEn = Regex("^(?:play|open|select)\\s+(?:the\\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\\s+(?:video|song|result|one|track)$")
            .find(lower)
        if (idxEn != null) {
            ORDINAL_MAP[idxEn.groupValues[1]]?.let { return YouTubeVoiceCommand.SelectIndex(it) }
        }
        val idxNum = Regex("^(?:play|open|select)\\s+(?:video|song|result|track)\\s+(?:number\\s+)?([1-5])$")
            .find(lower)
        if (idxNum != null) {
            val n = idxNum.groupValues[1].toIntOrNull()
            if (n != null) return YouTubeVoiceCommand.SelectIndex(n - 1)
        }
        val idxHi = Regex("^(पहला|दूसरा|तीसरा|चौथा|पांचवा|पाँचवाँ|pehla|pahla|doosra|dusra|teesra)\\s+(?:वीडियो|गाना|video|song)\\s*(?:चलाओ|लगाओ|play\\s+karo|chalao)?$")
            .find(lower)
        if (idxHi != null) {
            ORDINAL_MAP[idxHi.groupValues[1]]?.let { return YouTubeVoiceCommand.SelectIndex(it) }
        }

        // 8. Search YouTube ("Search Arijit Singh songs", "JARVIS YouTube par songs search karo", "यूट्यूब पर ... खोजो")
        val searchYtPar = Regex("^youtube\\s+(?:par|pe|mein|me)\\s+(.+?)\\s+(?:search|khojo|dhundo)\\s*(?:karo|kar\\s+do)?$")
            .find(lower)
        if (searchYtPar != null) {
            val q = searchYtPar.groupValues[1].trim()
            if (q.isNotBlank()) return YouTubeVoiceCommand.SearchYouTube(q, detectMode(q))
        }
        val searchYtEn = Regex("^search\\s+(?:on\\s+)?youtube\\s+(?:for\\s+)?(.+)$|^search\\s+(.+?)\\s+on\\s+youtube$")
            .find(lower)
        if (searchYtEn != null) {
            val q = searchYtEn.groupValues[1].ifBlank { searchYtEn.groupValues[2] }.trim()
            if (q.isNotBlank()) return YouTubeVoiceCommand.SearchYouTube(q, detectMode(q))
        }
        val searchHi = Regex("^यूट्यूब\\s+(?:पर|पे|में)\\s+(.+?)\\s+(?:खोजो|सर्च\\s+करो|ढूंढो)$")
            .find(normalized)
        if (searchHi != null) {
            val q = searchHi.groupValues[1].trim()
            if (q.isNotBlank()) return YouTubeVoiceCommand.SearchYouTube(q, detectMode(q))
        }
        val searchSongs = Regex("^search\\s+(.+?\\b(?:songs?|music|videos?|trailer|tutorial|lectures?)\\b.*)$")
            .find(lower)
        if (searchSongs != null) {
            val q = searchSongs.groupValues[1].trim()
            if (q.isNotBlank()) return YouTubeVoiceCommand.SearchYouTube(q, detectMode(q))
        }

        // 9. Play Song / Video directly ("Play Kesariya", "Arijit Singh ka latest song chalao", "अरिजीत सिंह के गाने चलाओ")
        val playEn = Regex("^(?:play|watch)\\s+(.+?)(?:\\s+on\\s+youtube)?$").find(lower)
        if (playEn != null) {
            val q = playEn.groupValues[1].trim()
            if (q.isNotBlank() && q != "it" && q != "this" && q != "music") {
                return YouTubeVoiceCommand.PlayQuery(q, detectMode(q))
            }
        }
        val playHinglish = Regex("^(?:youtube\\s+(?:par|pe)\\s+)?(.+?)\\s+(?:chalao|lagao|baja\\s+do|bajao|play\\s+karo|play\\s+kar\\s+do)$")
            .find(lower)
        if (playHinglish != null) {
            val q = playHinglish.groupValues[1].trim()
            if (q.isNotBlank() && !q.contains("youtube")) {
                return YouTubeVoiceCommand.PlayQuery(q, detectMode(q))
            }
        }
        val playHi = Regex("^(?:यूट्यूब\\s+(?:पर|पे)\\s+)?(.+?)\\s+(?:चलाओ|चला\\s+दो|लगाओ|बजाओ)$")
            .find(normalized)
        if (playHi != null) {
            val q = playHi.groupValues[1].trim()
            if (q.isNotBlank() && q != "वीडियो" && q != "गाना" && q != "यूट्यूब") {
                return YouTubeVoiceCommand.PlayQuery(q, detectMode(q))
            }
        }

        return null
    }
}
