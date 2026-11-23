package com.example.voice

enum class LocalVoiceCommand {
    OPEN_SECURITY,
    TOGGLE_LOCKDOWN,
    CHECK_BATTERY,
    STOP,
    NEW_CHAT
}

sealed interface OpenJarvisVoiceDirective {
    data object OpenScreen : OpenJarvisVoiceDirective
    data object CheckEngines : OpenJarvisVoiceDirective
    data class DeepResearch(val query: String) : OpenJarvisVoiceDirective
    data class HybridSearch(val query: String) : OpenJarvisVoiceDirective
}

object VoiceCommandParser {

    private fun normalize(transcript: String): String =
        transcript
            .lowercase()
            .replace(Regex("[^a-z0-9\\s']"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .removePrefix("hey am ai ")
            .removePrefix("hey am ")
            .removePrefix("am ai ")
            .removePrefix("am ")
            .removePrefix("hey jarvis ")
            .removePrefix("jarvis ")
            .trim()

    fun parse(transcript: String): LocalVoiceCommand? {
        val normalized = normalize(transcript)

        if (normalized.isEmpty()) return null

        return when {
            normalized == "stop" ||
                normalized == "stop listening" ||
                normalized == "stop speaking" ||
                normalized == "exit hands free" ||
                normalized == "exit hands free mode" ||
                normalized == "cancel" -> LocalVoiceCommand.STOP

            normalized.contains("open security") ||
                normalized == "security" ||
                normalized == "security center" ||
                normalized.contains("show security") -> LocalVoiceCommand.OPEN_SECURITY

            normalized.contains("toggle lockdown") ||
                normalized == "lockdown" ||
                normalized.contains("emergency lockdown") ||
                normalized.contains("engage lockdown") ||
                normalized.contains("disengage lockdown") -> LocalVoiceCommand.TOGGLE_LOCKDOWN

            normalized.contains("what's my battery") ||
                normalized.contains("whats my battery") ||
                normalized.contains("what is my battery") ||
                normalized.contains("battery level") ||
                normalized.contains("battery status") ||
                normalized == "battery" -> LocalVoiceCommand.CHECK_BATTERY

            normalized == "new chat" ||
                normalized.contains("start new chat") ||
                normalized.contains("open new chat") ||
                normalized.contains("new session") -> LocalVoiceCommand.NEW_CHAT

            else -> null
        }
    }

    fun parseOpenJarvisDirective(transcript: String): OpenJarvisVoiceDirective? {
        val raw = transcript.trim()
        if (raw.isEmpty()) return null
        val normalized = normalize(raw)

        if (
            normalized == "open openjarvis" ||
            normalized == "openjarvis" ||
            normalized == "open open jarvis" ||
            normalized.contains("openjarvis kholo") ||
            normalized.contains("open jarvis kholo") ||
            raw.contains("ओपनजर्विस खोलो")
        ) {
            return OpenJarvisVoiceDirective.OpenScreen
        }

        if (
            normalized.contains("check openjarvis engines") ||
            normalized.contains("check local engines") ||
            normalized.contains("openjarvis engine status") ||
            normalized.contains("engine status check karo") ||
            raw.contains("इंजन चेक करो")
        ) {
            return OpenJarvisVoiceDirective.CheckEngines
        }

        val researchPrefixes = listOf(
            "deep research on ",
            "deep research about ",
            "run deep research on ",
            "openjarvis research ",
            "research karo "
        )
        for (prefix in researchPrefixes) {
            if (normalized.startsWith(prefix)) {
                val query = normalized.removePrefix(prefix).trim()
                if (query.length >= 2) {
                    return OpenJarvisVoiceDirective.DeepResearch(query)
                }
            }
        }
        if (raw.contains("डीप रिसर्च") && raw.length > 10) {
            val cleaned = raw.replace("डीप रिसर्च", "").trim()
            if (cleaned.length >= 2) {
                return OpenJarvisVoiceDirective.DeepResearch(cleaned)
            }
        }

        val hybridPrefixes = listOf(
            "search hybrid memory for ",
            "hybrid search ",
            "openjarvis search ",
            "hybrid memory search "
        )
        for (prefix in hybridPrefixes) {
            if (normalized.startsWith(prefix)) {
                val query = normalized.removePrefix(prefix).trim()
                if (query.length >= 2) {
                    return OpenJarvisVoiceDirective.HybridSearch(query)
                }
            }
        }

        return null
    }
}
