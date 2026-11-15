package com.example

import com.example.productivity.ReminderParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Calendar

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ReminderParserTest {

    private val baseNow = 1_780_000_000_000L

    @Test
    fun parseFallback_parsesRelativeMinutesAndPriority() {
        val parsed = ReminderParser.parseFallback(
            "Remind me to inspect server logs in 25 minutes urgent",
            baseNow
        )
        assertEquals(baseNow + 25 * 60_000L, parsed.triggerAtMillis)
        assertEquals("HIGH", parsed.priority)
        assertEquals("REMINDER", parsed.category)
        assertTrue(parsed.title.contains("inspect server logs", ignoreCase = true))
    }

    @Test
    fun parseFallback_parsesTomorrowClockTimeAndScheduleCategory() {
        val parsed = ReminderParser.parseFallback(
            "Schedule architecture meeting tomorrow at 5:30 pm",
            baseNow
        )
        val cal = Calendar.getInstance().apply { timeInMillis = parsed.triggerAtMillis }
        assertEquals(17, cal.get(Calendar.HOUR_OF_DAY))
        assertEquals(30, cal.get(Calendar.MINUTE))
        assertEquals("SCHEDULE", parsed.category)
    }

    @Test
    fun parseGeminiJson_sanitizesMarkdownFencesAndAppliesDelayMinutes() {
        val raw = """
            ```json
            {
              "title": "Verify Cloud Run deployment",
              "description": "Hit /health endpoint",
              "priority": "INVALID",
              "category": "TASK",
              "delayMinutes": 10
            }
            ```
        """.trimIndent()

        val parsed = ReminderParser.parseGeminiJson(raw, "Urgent verify Cloud Run", baseNow)
        assertEquals("Verify Cloud Run deployment", parsed.title)
        assertEquals("HIGH", parsed.priority)
        assertEquals("TASK", parsed.category)
        assertEquals(baseNow + 10 * 60_000L, parsed.triggerAtMillis)
    }

    @Test
    fun parseIsoTimestamp_parsesUtcZFormat() {
        val millis = ReminderParser.parseIsoTimestamp("2026-06-15T12:00:00Z")
        assertTrue(millis != null && millis > 0L)
    }
}
