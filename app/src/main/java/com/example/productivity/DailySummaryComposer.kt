package com.example.productivity

import com.example.data.db.TaskEntity
import com.example.security.SecurityReport
import java.util.Calendar

/**
 * Pure daily summary composer for JARVIS startup voice synthesis and dashboard executive cards.
 */
object DailySummaryComposer {

    private val UNAVAILABLE_WEATHER_MARKERS = listOf(
        "checking weather",
        "unavailable",
        "offline",
        "standby",
        "weather feed http",
        "blocked",
        "error"
    )

    private val NOMINAL_SECURITY_ALERT_MARKERS = listOf(
        "all systems",
        "all browser security",
        "normal security tolerances",
        "no active threats",
        "no critical"
    )

    private val MARKDOWN_CLEANUP_REGEX = Regex("[*_`~#>\\[\\]]+")
    private val WHITESPACE_REGEX = Regex("\\s+")
    private val LOCATION_TAG_REGEX = Regex("\\s*\\((?:local telemetry|surat|city grid)\\)\\s*", RegexOption.IGNORE_CASE)
    private val CELSIUS_REGEX = Regex("(-?\\d+(?:\\.\\d+)?)\\s*°\\s*C\\b", RegexOption.IGNORE_CASE)
    private val FAHRENHEIT_REGEX = Regex("(-?\\d+(?:\\.\\d+)?)\\s*°\\s*F\\b", RegexOption.IGNORE_CASE)
    private val KMH_REGEX = Regex("\\bkm/h\\b", RegexOption.IGNORE_CASE)
    private val MPH_REGEX = Regex("\\bmph\\b", RegexOption.IGNORE_CASE)
    private val SEPARATOR_REGEX = Regex("\\s*[•|]\\s*")
    private val DOUBLE_COMMA_REGEX = Regex("\\s*,\\s*,+")

    fun getTimeGreeting(hourOfDay: Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)): String =
        when (hourOfDay) {
            in 5..11 -> "Good morning."
            in 12..16 -> "Good afternoon."
            else -> "Good evening."
        }

    private fun cleanSpeechSegment(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        return raw
            .replace(MARKDOWN_CLEANUP_REGEX, "")
            .replace(WHITESPACE_REGEX, " ")
            .trim()
    }

    private fun ensureSentenceEnding(raw: String?): String {
        val cleaned = cleanSpeechSegment(raw)
        if (cleaned.isEmpty()) return ""
        return if (cleaned.endsWith(".") || cleaned.endsWith("!") || cleaned.endsWith("?")) {
            cleaned
        } else {
            "$cleaned."
        }
    }

    fun isWeatherSummaryAvailable(weatherSummary: String?): Boolean {
        val cleaned = cleanSpeechSegment(weatherSummary)
        if (cleaned.isEmpty()) return false
        val lower = cleaned.lowercase()
        return UNAVAILABLE_WEATHER_MARKERS.none { marker -> lower.contains(marker) }
    }

    fun formatWeatherForSpeech(weatherSummary: String?): String? {
        if (!isWeatherSummaryAvailable(weatherSummary)) return null
        var cleaned = cleanSpeechSegment(weatherSummary)
        cleaned = cleaned.replace(LOCATION_TAG_REGEX, " ").trim()
        cleaned = cleaned
            .replace(CELSIUS_REGEX, "$1 degrees Celsius")
            .replace(FAHRENHEIT_REGEX, "$1 degrees Fahrenheit")
            .replace(KMH_REGEX, "kilometers per hour")
            .replace(MPH_REGEX, "miles per hour")
            .replace(SEPARATOR_REGEX, ", ")
            .replace(DOUBLE_COMMA_REGEX, ", ")
            .replace(WHITESPACE_REGEX, " ")
            .trim()
            .trimEnd(',')
        if (cleaned.isEmpty()) return null
        return ensureSentenceEnding("Current weather is $cleaned")
    }

    fun getPrioritizedPendingTasks(tasks: List<TaskEntity>): List<TaskEntity> {
        fun rank(priority: String): Int = when (priority.uppercase()) {
            "HIGH" -> 0
            "MEDIUM" -> 1
            "LOW" -> 2
            else -> 1
        }
        return tasks
            .filter { !it.isCompleted && cleanSpeechSegment(it.title).isNotEmpty() }
            .sortedWith(compareBy<TaskEntity> { rank(it.priority) }.thenBy { it.createdAt })
    }

    fun buildTasksSpokenSummary(tasks: List<TaskEntity>): String {
        val pending = getPrioritizedPendingTasks(tasks)
        if (pending.isEmpty()) {
            return "You have no pending tasks right now. All scheduled objectives are complete."
        }

        val highCount = pending.count { it.priority.equals("HIGH", ignoreCase = true) }

        fun formatTask(task: TaskEntity, includeDue: Boolean): String {
            val title = cleanSpeechSegment(task.title)
            val due = cleanSpeechSegment(task.dueTime)
            return if (includeDue && due.isNotEmpty() && !due.equals("today", ignoreCase = true)) {
                "$title due $due"
            } else {
                title
            }
        }

        if (pending.size == 1) {
            val priorityNote = if (highCount == 1) ", marked high priority" else ""
            return ensureSentenceEnding(
                "You have 1 pending task$priorityNote: ${formatTask(pending.first(), includeDue = true)}"
            )
        }

        val topTasks = pending.take(3)
        val topLabels = topTasks.mapIndexed { idx, task -> formatTask(task, includeDue = idx == 0) }
        val joinedTitles = if (topLabels.size == 2) {
            "${topLabels[0]} and ${topLabels[1]}"
        } else {
            "${topLabels.dropLast(1).joinToString(", ")}, and ${topLabels.last()}"
        }

        val highNote = if (highCount > 0) ", including $highCount high priority" else ""
        val remainingNote = if (pending.size > topTasks.size) {
            ", plus ${pending.size - topTasks.size} more"
        } else {
            ""
        }

        return ensureSentenceEnding(
            "You have ${pending.size} pending tasks$highNote. Top priorities are $joinedTitles$remainingNote"
        )
    }

    fun buildSecurityHudSummary(report: SecurityReport?): String {
        if (report == null) return "Security telemetry standby"
        return when {
            report.defconLevel == 1 -> "DEFCON 1 • LOCKDOWN (${report.score}/100)"
            report.defconLevel <= 4 -> "DEFCON ${report.defconLevel} • ${report.score}/100 • Review Advised"
            else -> "DEFCON 5 • ${report.score}/100 • Optimal"
        }
    }

    fun buildSecuritySpokenSummary(report: SecurityReport?): String? {
        if (report == null) return null
        val activeAlerts = report.alerts
            .map { cleanSpeechSegment(it) }
            .filter { alert ->
                if (alert.isEmpty()) return@filter false
                val lower = alert.lowercase()
                NOMINAL_SECURITY_ALERT_MARKERS.none { marker -> lower.contains(marker) }
            }

        if (report.defconLevel == 1) {
            return "Security alert: Emergency Defense Lockdown is active at DEFCON 1. Immediate review is advised."
        }

        if (report.defconLevel <= 4 || activeAlerts.isNotEmpty()) {
            val alertDetail = if (activeAlerts.isNotEmpty()) {
                " ${ensureSentenceEnding(activeAlerts.first())}"
            } else {
                " Elevated security events require your review."
            }
            return "Security update: DEFCON ${report.defconLevel} with an integrity score of ${report.score} out of 100.$alertDetail"
        }

        return "Security status is optimal at DEFCON 5 with a score of ${report.score} out of 100 and no active threats."
    }

    fun composeSpokenDailySummary(
        greeting: String? = null,
        hourOfDay: Int = Calendar.getInstance().get(Calendar.HOUR_OF_DAY),
        tasks: List<TaskEntity> = emptyList(),
        weatherSummary: String? = null,
        securityReport: SecurityReport? = null,
        aiLine: String? = null,
        aiSource: String = "fallback",
        prefix: String? = null
    ): String {
        val segments = mutableListOf<String>()

        if (!prefix.isNullOrBlank()) {
            val cleanPrefix = ensureSentenceEnding(prefix)
            if (cleanPrefix.isNotEmpty()) segments.add(cleanPrefix)
        }

        val resolvedGreeting = ensureSentenceEnding(
            greeting?.takeIf { it.isNotBlank() } ?: getTimeGreeting(hourOfDay)
        )
        if (resolvedGreeting.isNotEmpty()) segments.add(resolvedGreeting)

        segments.add(buildTasksSpokenSummary(tasks))

        formatWeatherForSpeech(weatherSummary)?.let { segments.add(it) }
        buildSecuritySpokenSummary(securityReport)?.let { segments.add(it) }

        if (aiSource.equals("gemini", ignoreCase = true) && !aiLine.isNullOrBlank()) {
            val cleanAi = ensureSentenceEnding(aiLine).take(180)
            if (cleanAi.isNotEmpty() && segments.none { it.equals(cleanAi, ignoreCase = true) }) {
                segments.add(cleanAi)
            }
        }

        return segments.filter { it.isNotBlank() }.joinToString(" ")
    }
}
