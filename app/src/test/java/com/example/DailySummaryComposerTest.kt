package com.example

import android.app.Application
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.example.data.db.TaskEntity
import com.example.data.preferences.JarvisUserPreferences
import com.example.productivity.DailySummaryComposer
import com.example.security.SecurityReport
import com.example.ui.JarvisViewModel
import com.example.ui.screens.MainDashboardScreen
import com.example.ui.theme.JarvisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class DailySummaryComposerTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `default user preferences enable autoSpeakDailySummary on launch`() {
        val prefs = JarvisUserPreferences()
        assertTrue(prefs.autoSpeakDailySummary)
    }

    @Test
    fun `weather availability check omits offline, standby, and HTTP error strings`() {
        assertTrue(DailySummaryComposer.isWeatherSummaryAvailable("19°C, Clear sky • Wind 11 km/h"))
        assertFalse(DailySummaryComposer.isWeatherSummaryAvailable("Checking weather..."))
        assertFalse(DailySummaryComposer.isWeatherSummaryAvailable("Weather unavailable (offline)"))
        assertFalse(DailySummaryComposer.isWeatherSummaryAvailable("Weather feed HTTP 500"))
        assertFalse(DailySummaryComposer.isWeatherSummaryAvailable("Weather standby"))
        assertNull(DailySummaryComposer.formatWeatherForSpeech("Weather unavailable (offline)"))
    }

    @Test
    fun `composeSpokenDailySummary combines tasks, live weather, and security posture cleanly`() {
        val tasks = listOf(
            TaskEntity(id = 1, title = "Low priority cleanup", dueTime = "Today", priority = "LOW", isCompleted = false, createdAt = 1L),
            TaskEntity(id = 2, title = "Review **Mark 85** Telemetry", dueTime = "14:00 Today", priority = "HIGH", isCompleted = false, createdAt = 2L),
            TaskEntity(id = 3, title = "Done Objective", dueTime = "09:00", priority = "HIGH", isCompleted = true, createdAt = 0L)
        )
        val security = SecurityReport(
            score = 98,
            defconLevel = 5,
            threatStatus = "DEFCON 5: OPTIMAL",
            checks = emptyList(),
            alerts = listOf("All systems functioning inside normal security tolerances."),
            lastScanTime = 1_000L
        )

        val spoken = DailySummaryComposer.composeSpokenDailySummary(
            hourOfDay = 9,
            tasks = tasks,
            weatherSummary = "21°C, Clear sky • Wind 12 km/h",
            securityReport = security,
            aiLine = "All primary telemetry arrays are nominal, Sir.",
            aiSource = "gemini"
        )

        assertTrue(spoken.startsWith("Good morning, Sir."))
        assertTrue(spoken.contains("2 pending tasks, including 1 high priority"))
        assertTrue(spoken.contains("Review Mark 85 Telemetry due 14:00 Today"))
        assertTrue(spoken.contains("Current weather is 21 degrees Celsius, Clear sky, Wind 12 kilometers per hour."))
        assertTrue(spoken.contains("Security status is optimal at DEFCON 5 with a score of 98 out of 100"))
        assertTrue(spoken.contains("All primary telemetry arrays are nominal, Sir."))
        assertFalse(spoken.contains("**"))
        assertFalse(spoken.contains("•"))
    }

    @Test
    fun `composeSpokenDailySummary falls back gracefully to security alert when weather is offline`() {
        val lockdownReport = SecurityReport(
            score = 65,
            defconLevel = 1,
            threatStatus = "DEFCON 1: LOCKDOWN",
            checks = emptyList(),
            alerts = listOf("ALERT: Emergency lockdown protocol is actively engaged."),
            lastScanTime = 1_000L
        )

        val spoken = DailySummaryComposer.composeSpokenDailySummary(
            hourOfDay = 20,
            tasks = emptyList(),
            weatherSummary = "Weather unavailable (offline)",
            securityReport = lockdownReport,
            aiLine = "Fallback boilerplate omitted",
            aiSource = "fallback"
        )

        assertTrue(spoken.startsWith("Good evening, Sir."))
        assertTrue(spoken.contains("no pending tasks", ignoreCase = true))
        assertFalse(spoken.contains("weather", ignoreCase = true))
        assertFalse(spoken.contains("offline", ignoreCase = true))
        assertTrue(spoken.contains("Emergency Defense Lockdown is active at DEFCON 1"))
        assertFalse(spoken.contains("Fallback boilerplate"))
    }

    @Test
    fun `MainDashboardScreen renders StartupDailySummaryCard and allows dismissing it`() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val vm = JarvisViewModel(app)

        composeTestRule.mainClock.autoAdvance = false
        composeTestRule.setContent {
            JarvisTheme {
                MainDashboardScreen(viewModel = vm)
            }
        }
        composeTestRule.mainClock.advanceTimeBy(200)

        composeTestRule.onNodeWithTag("startup_daily_summary_card").assertExists()
        composeTestRule.onNodeWithTag("startup_summary_status_badge").assertExists()
        composeTestRule.onNodeWithTag("startup_summary_tasks_chip").assertExists()
        composeTestRule.onNodeWithTag("startup_summary_weather_chip").assertExists()
        composeTestRule.onNodeWithTag("startup_summary_security_chip").assertExists()

        composeTestRule.onNodeWithTag("startup_summary_dismiss_btn").performClick()
        composeTestRule.mainClock.advanceTimeBy(100)
        assertEquals(true, vm.startupSummaryDismissed.value)
    }
}
