package com.example

import android.app.Application
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.screens.MainDashboardScreen
import com.example.ui.theme.JarvisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class CommandCenterDashboardTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `viewModel launches into Command Center dashboard by default`() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val vm = JarvisViewModel(app)
        assertEquals(ScreenDestination.DASHBOARD, vm.currentScreen.value)
        assertTrue(vm.cpuCoreCount >= 1)
    }

    @Test
    fun `MainDashboardScreen renders core Command Center controls and navigates cleanly`() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val vm = JarvisViewModel(app)

        composeTestRule.mainClock.autoAdvance = false
        composeTestRule.setContent {
            JarvisTheme {
                MainDashboardScreen(viewModel = vm)
            }
        }
        composeTestRule.mainClock.advanceTimeBy(200)

        composeTestRule.onNodeWithText("JARVIS").assertExists()
        composeTestRule.onAllNodesWithText("AI CORE").onFirst().assertExists()
        composeTestRule.onNodeWithTag("hero_command_core_card").assertExists()
        composeTestRule.onNodeWithTag("ai_core_overview_panel").assertExists()
        composeTestRule.onNodeWithTag("talk_to_jarvis_button").assertExists()

        composeTestRule.onNodeWithTag("talk_to_jarvis_button").performClick()
        composeTestRule.mainClock.advanceTimeBy(100)
        assertEquals(ScreenDestination.VOICE_HUD, vm.currentScreen.value)
    }
}
