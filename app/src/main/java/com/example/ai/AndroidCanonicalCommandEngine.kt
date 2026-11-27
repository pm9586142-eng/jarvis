package com.example.ai

import java.util.Locale

data class CanonicalCommandOutcome(
    val intent: String,
    val engine: String = "Offline Command Engine",
    val title: String? = null,
    val content: String? = null,
    val protocol: String? = null,
    val screen: String? = null,
    val section: String? = null,
    val tab: String? = null,
    val rawText: String
)

object AndroidCanonicalCommandEngine {
    private val AM_PREFIX_REGEX = Regex(
        "^(?:(?:hey|ok|okay|hi|hello)\\s+)?(?:am\\s+ai|a\\.?\\s*m\\.?\\s*ai|am|jarvis|ए\\s*एम\\s*ए\\s*आई|जार्विस)[,:\\s-]+",
        RegexOption.IGNORE_CASE
    )

    fun parse(rawText: String): CanonicalCommandOutcome? {
        val original = rawText.trim()
        if (original.isEmpty()) return null
        val cleaned = original.replace(AM_PREFIX_REGEX, "").trim()
        val lower = cleaned.lowercase(Locale.getDefault())

        // 1. Time / Date queries
        if (Regex("^(?:what\\s+time\\s+is\\s+it|current\\s+time|tell\\s+me\\s+the\\s+time|samay\\s+kya\\s+hua|kitne\\s+baje|टाइम\\s+क्या\\s+हुआ|समय\\s+बताओ)", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "QUERY_TIME", rawText = original)
        }

        if (Regex("^(?:what(?:'s| is)\\s+today(?:'s)?\\s+date|current\\s+date|aaj\\s+kya\\s+tarikh|आज\\s+क्या\\s+तारीख)", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "QUERY_DATE", rawText = original)
        }

        // 2. Signature Protocols
        if (Regex("^(?:good\\s+morning|suprabhat|सुप्रभात|run\\s+good\\s+morning\\s+protocol)$", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "RUN_PROTOCOL", protocol = "GOOD_MORNING", rawText = original)
        }
        if (Regex("^(?:focus\\s+mode|start\\s+focus|enable\\s+focus\\s+mode|फोकस\\s+मोड)$", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "RUN_PROTOCOL", protocol = "FOCUS", rawText = original)
        }
        if (Regex("^(?:diagnostics|run\\s+diagnostics|system\\s+check|system\\s+status|offline\\s+status|डायग्नोस्टिक्स)$", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "RUN_PROTOCOL", protocol = "DIAGNOSTICS", rawText = original)
        }
        if (Regex("^(?:standby|standby\\s+mode|sleep\\s+mode|go\\s+to\\s+standby|स्टैंडबाय)$", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "RUN_PROTOCOL", protocol = "STANDBY", rawText = original)
        }

        // 3. Task creation / listing
        val addTaskRegex = Regex("^(?:add\\s+task|create\\s+task|new\\s+task|remind\\s+me\\s+to|task\\s+jodo|naya\\s+task|टास्क\\s+जोड़ो|रिमाइंडर\\s+लगाओ)\\s*[:,-]?\\s*(.+)$", RegexOption.IGNORE_CASE)
        val taskMatch = addTaskRegex.find(cleaned)
        if (taskMatch != null && taskMatch.groupValues.size > 1) {
            val title = taskMatch.groupValues[1].trim()
            if (title.isNotEmpty()) {
                return CanonicalCommandOutcome(intent = "CREATE_TASK", title = title, rawText = original)
            }
        }

        if (Regex("^(?:list\\s+tasks|show\\s+(?:my\\s+)?tasks|pending\\s+tasks|mere\\s+tasks|टास्क\\s+दिखाओ)$", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "LIST_TASKS", rawText = original)
        }

        // 4. Note creation / listing
        val addNoteRegex = Regex("^(?:save\\s+note|create\\s+note|add\\s+note|take\\s+a?\\s*note|note\\s+banao|naya\\s+note|नोट\\s+बनाओ|नोट\\s+सेव\\s+करो)\\s*[:,-]?\\s*(.+)$", RegexOption.IGNORE_CASE)
        val noteMatch = addNoteRegex.find(cleaned)
        if (noteMatch != null && noteMatch.groupValues.size > 1) {
            val body = noteMatch.groupValues[1].trim()
            val firstSentence = body.split(Regex("[.!?>\\n]")).firstOrNull()?.trim() ?: body
            return CanonicalCommandOutcome(
                intent = "CREATE_NOTE",
                title = firstSentence.take(48),
                content = body,
                rawText = original
            )
        }

        if (Regex("^(?:list\\s+notes|show\\s+(?:my\\s+)?notes|mere\\s+notes|नोट्स\\s+दिखाओ)$", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)) {
            return CanonicalCommandOutcome(intent = "LIST_NOTES", rawText = original)
        }

        // 5. Memory save
        val memRegex = Regex("^(?:remember\\s+that|remember|yaad\\s+rakho|save\\s+memory|मेमोरी\\s+सेव\\s+करो|याद\\s+रखो)\\s*[:,-]?\\s*(.+)$", RegexOption.IGNORE_CASE)
        val memMatch = memRegex.find(cleaned)
        if (memMatch != null && memMatch.groupValues.size > 1) {
            return CanonicalCommandOutcome(intent = "SAVE_MEMORY", content = memMatch.groupValues[1].trim(), rawText = original)
        }

        // 6. Full Ecosystem Screen Navigation
        val navRegex = Regex("^(?:open|go\\s+to|show|switch\\s+to|launch|kholo|खोलो)\\s+([a-z0-9\\s_-]+)$", RegexOption.IGNORE_CASE)
        val navMatch = navRegex.find(cleaned)
        if (navMatch != null && navMatch.groupValues.size > 1) {
            val target = navMatch.groupValues[1].trim().lowercase(Locale.getDefault())
            val map = mapOf(
                listOf("home", "dashboard", "command center") to Triple("dashboard", null, null),
                listOf("chat", "ai chat", "neural chat") to Triple("chat", null, null),
                listOf("voice", "voice assistant", "voice hud", "voice matrix") to Triple("voice", null, null),
                listOf("youtube", "media", "media control", "media player", "media hud") to Triple("youtube_media", "youtube", null),
                listOf("browser", "web", "websites") to Triple("youtube_media", "browser", null),
                listOf("memory", "memory vault", "vault") to Triple("memory_vault", null, null),
                listOf("tasks", "reminders", "planner", "productivity") to Triple("productivity", null, "tasks"),
                listOf("notes", "notes vault") to Triple("productivity", null, "notes"),
                listOf("settings", "preferences", "models", "local models") to Triple("settings", null, null),
                listOf("research", "research studio") to Triple("research", null, null),
                listOf("automation", "automation hub") to Triple("automation", null, null),
                listOf("security", "security audit", "stark security") to Triple("security", null, null),
                listOf("multi ai", "multi ai brain", "brain center", "control center") to Triple("multi_ai", null, null),
                listOf("multi agent", "agents") to Triple("multi_agent", null, null),
                listOf("telemetry", "system telemetry") to Triple("telemetry", null, null),
                listOf("plugins", "plugin") to Triple("plugins", null, null),
                listOf("insights") to Triple("insights", null, null),
                listOf("smart home") to Triple("smart_home", null, null),
                listOf("vision", "vision scanner") to Triple("vision", null, null),
                listOf("music studio") to Triple("music", null, null),
                listOf("orbital", "orbital game") to Triple("orbital", null, null),
                listOf("ultron", "ultron assistant", "ultron hologram") to Triple("ultron", null, null),
                listOf("openjarvis", "open jarvis", "openjarvis core") to Triple("open_jarvis", null, null),
                listOf("diagnostics", "ecosystem diagnostics") to Triple("diagnostics", null, null)
            )
            for ((keys, dest) in map) {
                if (keys.contains(target)) {
                    return CanonicalCommandOutcome(
                        intent = "OPEN_SCREEN",
                        screen = dest.first,
                        section = dest.second,
                        tab = dest.third,
                        rawText = original
                    )
                }
            }
        }

        return null
    }
}
