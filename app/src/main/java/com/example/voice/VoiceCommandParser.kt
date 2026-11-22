package com.example.voice

enum class LocalVoiceCommand {
    OPEN_SECURITY,
    TOGGLE_LOCKDOWN,
    CHECK_BATTERY,
    STOP,
    NEW_CHAT
}

object VoiceCommandParser {

    fun parse(transcript: String): LocalVoiceCommand? {
        val normalized = transcript
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
}
