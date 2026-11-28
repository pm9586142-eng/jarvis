package com.example

import android.app.Application
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.example.data.db.ConversationEntity
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.components.resolveChatInlineMedia
import com.example.ui.screens.AiChatScreen
import com.example.ui.screens.YouTubeMediaScreen
import com.example.ui.theme.JarvisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ChatWorkspaceRedesignTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `AiChatScreen renders full-screen workspace, sidebar sections, and full bottom composer`() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val vm = JarvisViewModel(app)

        composeTestRule.mainClock.autoAdvance = false
        composeTestRule.setContent {
            JarvisTheme {
                AiChatScreen(viewModel = vm)
            }
        }
        composeTestRule.mainClock.advanceTimeBy(300)

        composeTestRule.onNodeWithTag("ai_chat_workspace").assertExists()
        composeTestRule.onNodeWithTag("open_sessions_drawer_btn").assertExists()
        composeTestRule.onNodeWithTag("header_save_session_btn").assertExists()
        composeTestRule.onNodeWithTag("chat_header_voice_mode_btn").assertExists()
        composeTestRule.onNodeWithTag("new_chat_button").assertExists()

        // Bottom composer action buttons
        composeTestRule.onNodeWithTag("chat_attach_button").assertExists()
        composeTestRule.onNodeWithTag("chat_image_button").assertExists()
        composeTestRule.onNodeWithTag("chat_file_button").assertExists()
        composeTestRule.onNodeWithTag("chat_mic_button").assertExists()
        composeTestRule.onNodeWithTag("chat_voice_conversation_btn").assertExists()
        composeTestRule.onNodeWithTag("chat_input_field").assertExists()
        composeTestRule.onNodeWithTag("chat_send_button").assertExists()

        // Open sidebar drawer and verify ChatGPT-style sections
        composeTestRule.onNodeWithTag("open_sessions_drawer_btn").performClick()
        composeTestRule.mainClock.advanceTimeBy(400)
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("drawer_new_chat_button").assertExists()
        composeTestRule.onNodeWithTag("session_search_input").assertExists()
        composeTestRule.onNodeWithTag("sidebar_settings_btn").assertExists()
        composeTestRule.onNodeWithTag("chat_sidebar_scroll")
            .performScrollToNode(androidx.compose.ui.test.hasText("JARVIS Agent"))
        composeTestRule.onNodeWithText("JARVIS Agent").assertExists()
        composeTestRule.onNodeWithTag("chat_sidebar_scroll")
            .performScrollToNode(androidx.compose.ui.test.hasText("VERONICA Agent"))
        composeTestRule.onNodeWithText("VERONICA Agent").assertExists()
        composeTestRule.onNodeWithTag("chat_sidebar_scroll")
            .performScrollToNode(androidx.compose.ui.test.hasText("DUM-E Agent"))
        composeTestRule.onNodeWithText("DUM-E Agent").assertExists()

        // Navigate cleanly to Voice Mode via voice conversation composer button
        composeTestRule.onNodeWithTag("chat_voice_conversation_btn").performClick()
        composeTestRule.mainClock.advanceTimeBy(150)
        assertEquals(ScreenDestination.VOICE_HUD, vm.currentScreen.value)
    }

    @Test
    fun `resolveChatInlineMedia detects both persisted mediaVideoId and YouTube URLs in text`() {
        val persisted = ConversationEntity(
            sessionId = "s1",
            role = "jarvis",
            text = "Playing requested track.",
            mediaVideoId = "dQw4w9WgXcQ",
            mediaTitle = "Test Song",
            mediaChannel = "AM Audio"
        )
        val fromPersisted = resolveChatInlineMedia(persisted)
        assertNotNull(fromPersisted)
        assertEquals("dQw4w9WgXcQ", fromPersisted?.videoId)
        assertEquals("Test Song", fromPersisted?.title)

        val linked = ConversationEntity(
            sessionId = "s1",
            role = "jarvis",
            text = "Watch here: https://youtu.be/M7lc1UVf-VE"
        )
        val fromLink = resolveChatInlineMedia(linked)
        assertNotNull(fromLink)
        assertEquals("M7lc1UVf-VE", fromLink?.videoId)
    }

    @Test
    fun `YouTubeMediaScreen AM Player hero no longer renders circular avatar image`() {
        val app = ApplicationProvider.getApplicationContext<Application>()
        val vm = JarvisViewModel(app)

        composeTestRule.mainClock.autoAdvance = false
        composeTestRule.setContent {
            JarvisTheme {
                YouTubeMediaScreen(viewModel = vm)
            }
        }
        composeTestRule.mainClock.advanceTimeBy(300)

        composeTestRule.onNodeWithTag("youtube_media_screen").assertExists()
        composeTestRule.onNodeWithContentDescription("AM Player Avatar").assertDoesNotExist()
    }
}
