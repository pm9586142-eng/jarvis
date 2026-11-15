package com.example.productivity

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class ParsedReminder(
    val title: String,
    val description: String,
    val dueTime: String,
    val triggerAtMillis: Long,
    val priority: String = "MEDIUM",
    val category: String = "REMINDER"
)

object ReminderParser {
    private const val MINUTE_MS = 60_000L
    private const val DAY_MS = 86_400_000L

    fun formatDueLabel(triggerAtMillis: Long, nowMillis: Long = System.currentTimeMillis()): String {
        val targetCal = Calendar.getInstance().apply { timeInMillis = triggerAtMillis }
        val nowCal = Calendar.getInstance().apply { timeInMillis = nowMillis }

        val timeFmt = SimpleDateFormat("hh:mm a", Locale.getDefault())
        val timeLabel = timeFmt.format(Date(triggerAtMillis))

        val targetDay = Calendar.getInstance().apply {
            set(targetCal.get(Calendar.YEAR), targetCal.get(Calendar.MONTH), targetCal.get(Calendar.DAY_OF_MONTH), 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val todayDay = Calendar.getInstance().apply {
            set(nowCal.get(Calendar.YEAR), nowCal.get(Calendar.MONTH), nowCal.get(Calendar.DAY_OF_MONTH), 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

        val diffDays = ((targetDay - todayDay) / DAY_MS).toInt()
        return when (diffDays) {
            0 -> "Today $timeLabel"
            1 -> "Tomorrow $timeLabel"
            else -> {
                val dateFmt = SimpleDateFormat("MMM d", Locale.getDefault())
                "${dateFmt.format(Date(triggerAtMillis))} $timeLabel"
            }
        }
    }

    private fun parseClockTime(lower: String): Pair<Int, Int>? {
        val regex = Regex("""\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b""", RegexOption.IGNORE_CASE)
        val match = regex.find(lower) ?: return null
        var hour = match.groupValues[1].toIntOrNull() ?: return null
        val minute = match.groupValues[2].toIntOrNull() ?: 0
        val meridiem = match.groupValues[3].lowercase(Locale.ROOT)

        if (minute !in 0..59 || hour !in 0..23) return null
        if (meridiem.isNotEmpty()) {
            if (hour !in 1..12) return null
            if (meridiem == "pm" && hour < 12) hour += 12
            if (meridiem == "am" && hour == 12) hour = 0
        } else if (!match.value.contains("at", ignoreCase = true) && !match.value.contains(":")) {
            return null
        }
        return hour to minute
    }

    fun cleanTitle(raw: String): String {
        var s = raw.trim()
        s = s.replace(Regex("""^(?:please\s+)?(?:jarvis\s+)?remind\s+me\s+(?:to\s+)?""", RegexOption.IGNORE_CASE), "")
        s = s.replace(Regex("""^(?:set\s+(?:a\s+)?reminder\s+(?:to|for)\s+)""", RegexOption.IGNORE_CASE), "")
        s = s.replace(Regex("""^(?:schedule|add\s+task|todo)\s*[:\-]?\s*""", RegexOption.IGNORE_CASE), "")
        s = s.replace(Regex("""\bin\s+\d+\s+(?:minutes?|mins?|hours?|hrs?)\b""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("""\b(?:today|tomorrow|tonight)\b""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("""\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("""\bat\s+\d{1,2}(?::\d{2})?\b""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("""\s+"""), " ").trim(' ', ',', '.', '-', ':')
        if (s.isEmpty()) return "Scheduled Reminder"
        return s.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
    }

    fun parseFallback(input: String, nowMillis: Long = System.currentTimeMillis()): ParsedReminder {
        val raw = input.trim()
        if (raw.isEmpty()) {
            val trigger = nowMillis + 60 * MINUTE_MS
            return ParsedReminder(
                title = "Scheduled Reminder",
                description = "Created from JARVIS reminder parser",
                dueTime = formatDueLabel(trigger, nowMillis),
                triggerAtMillis = trigger,
                priority = "MEDIUM",
                category = "REMINDER"
            )
        }

        val lower = raw.lowercase(Locale.ROOT)
        val relMatch = Regex("""\bin\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b""").find(lower)

        val triggerAtMillis = if (relMatch != null) {
            val qty = (relMatch.groupValues[1].toLongOrNull() ?: 1L).coerceAtLeast(1L)
            val unit = relMatch.groupValues[2]
            val mult = if (unit.startsWith("h")) 60L * MINUTE_MS else MINUTE_MS
            nowMillis + qty * mult
        } else {
            val hasTomorrow = lower.contains("tomorrow")
            val hasTonight = lower.contains("tonight")
            val clock = parseClockTime(lower)
            if (clock != null || hasTomorrow || hasTonight) {
                val cal = Calendar.getInstance().apply { timeInMillis = nowMillis }
                if (hasTomorrow) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }
                when {
                    clock != null -> {
                        cal.set(Calendar.HOUR_OF_DAY, clock.first)
                        cal.set(Calendar.MINUTE, clock.second)
                    }
                    hasTonight -> {
                        cal.set(Calendar.HOUR_OF_DAY, 20)
                        cal.set(Calendar.MINUTE, 0)
                    }
                    else -> {
                        cal.set(Calendar.HOUR_OF_DAY, 9)
                        cal.set(Calendar.MINUTE, 0)
                    }
                }
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                if (!hasTomorrow && cal.timeInMillis <= nowMillis) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }
                cal.timeInMillis
            } else {
                nowMillis + 60 * MINUTE_MS
            }
        }

        val priority = when {
            Regex("""\b(urgent|asap|critical|important|immediately|high priority)\b""").containsMatchIn(lower) -> "HIGH"
            Regex("""\b(low priority|whenever|sometime|eventually)\b""").containsMatchIn(lower) -> "LOW"
            else -> "MEDIUM"
        }

        val category = when {
            Regex("""\b(meeting|call|briefing|schedule|appointment|zoom)\b""").containsMatchIn(lower) -> "SCHEDULE"
            else -> "REMINDER"
        }

        return ParsedReminder(
            title = cleanTitle(raw),
            description = raw,
            dueTime = formatDueLabel(triggerAtMillis, nowMillis),
            triggerAtMillis = triggerAtMillis,
            priority = priority,
            category = category
        )
    }

    fun parseGeminiJson(
        rawJson: String,
        fallbackInput: String,
        nowMillis: Long = System.currentTimeMillis()
    ): ParsedReminder {
        val fallback = parseFallback(fallbackInput, nowMillis)
        val cleaned = rawJson.trim()
            .removePrefix("```json")
            .removePrefix("```JSON")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()
        if (cleaned.isEmpty()) return fallback

        return try {
            val root = JSONObject(cleaned)
            val obj = root.optJSONObject("reminder") ?: root
            val title = obj.optString("title").trim().takeIf { it.isNotEmpty() }?.take(120) ?: fallback.title
            val description = obj.optString("description").trim().takeIf { it.isNotEmpty() }?.take(280)
                ?: fallback.description

            val priRaw = obj.optString("priority").trim().uppercase(Locale.ROOT)
            val priority = if (priRaw in setOf("HIGH", "MEDIUM", "LOW")) priRaw else fallback.priority

            val catRaw = obj.optString("category").trim().uppercase(Locale.ROOT)
            val category = if (catRaw in setOf("REMINDER", "TASK", "SCHEDULE", "NOTE")) catRaw else fallback.category

            var triggerAtMillis = fallback.triggerAtMillis
            val delayMin = obj.optDouble("delayMinutes", Double.NaN)
            val dueIso = obj.optString("dueIso").trim()
            val explicitTrigger = obj.optLong("triggerAtMillis", -1L)

            when {
                !delayMin.isNaN() && delayMin > 0.0 -> {
                    triggerAtMillis = nowMillis + (delayMin * MINUTE_MS).toLong()
                }
                dueIso.isNotEmpty() && !dueIso.equals("null", ignoreCase = true) -> {
                    parseIsoTimestamp(dueIso)?.let { parsedMs ->
                        if (parsedMs > nowMillis - 5 * MINUTE_MS) {
                            triggerAtMillis = parsedMs
                        }
                    }
                }
                explicitTrigger > 0L -> {
                    triggerAtMillis = explicitTrigger
                }
            }

            val dueTime = obj.optString("dueTime").trim().takeIf { it.isNotEmpty() && !it.equals("null", ignoreCase = true) }
                ?: formatDueLabel(triggerAtMillis, nowMillis)

            ParsedReminder(
                title = title,
                description = description,
                dueTime = dueTime.take(64),
                triggerAtMillis = triggerAtMillis,
                priority = priority,
                category = category
            )
        } catch (_: Exception) {
            fallback
        }
    }

    internal fun parseIsoTimestamp(iso: String): Long? {
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            "yyyy-MM-dd'T'HH:mm:ssX",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss"
        )
        for (pattern in patterns) {
            try {
                val fmt = SimpleDateFormat(pattern, Locale.US).apply {
                    if (pattern.endsWith("'Z'")) {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                }
                val date = fmt.parse(iso)
                if (date != null) return date.time
            } catch (_: Exception) {
                // Try next pattern
            }
        }
        return null
    }
}
