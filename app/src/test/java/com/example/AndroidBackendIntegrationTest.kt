package com.example

import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.ai.AiRepository
import com.example.ai.FreeMultiProviderRouter
import com.example.data.db.ConversationEntity
import com.example.system.SystemTelemetry
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class AndroidBackendIntegrationTest {

    @Test
    fun buildConfig_pointsToProductionVercelAndExposesZeroApiKeys() {
        assertEquals("https://jarvis-gray-three-59.vercel.app", BuildConfig.BACKEND_URL)
        assertFalse(
            "GEMINI_API_KEY must NOT be bundled in Android APK",
            FreeMultiProviderRouter.isConfiguredKey(BuildConfig.GEMINI_API_KEY)
        )
        assertFalse(
            "GROQ_API_KEY must NOT be bundled in Android APK",
            FreeMultiProviderRouter.isConfiguredKey(BuildConfig.GROQ_API_KEY)
        )
        assertFalse(
            "OPENROUTER_API_KEY must NOT be bundled in Android APK",
            FreeMultiProviderRouter.isConfiguredKey(BuildConfig.OPENROUTER_API_KEY)
        )
    }

    @Test
    fun liveVercelBackend_healthChatSummarizeAndBriefingSucceed(): Unit = runBlocking {
        val repo = AiRepository()
        assertTrue(repo.usesBackendProxy)
        assertEquals("https://jarvis-gray-three-59.vercel.app", repo.backendUrl)

        val healthy = repo.syncBackendHealth()
        assertTrue("Production backend /api/health must respond 200 OK", healthy)

        val telemetry = SystemTelemetry(
            batteryLevel = 88,
            isCharging = true,
            batteryHealth = "OPTIMAL",
            ramUsedMb = 2048,
            ramTotalMb = 6144,
            ramPercent = 33,
            storageUsedGb = 40.0,
            storageTotalGb = 64.0,
            storagePercent = 62,
            networkType = "WIFI",
            isConnected = true,
            uptimeMinutes = 42L
        )

        val chunks = repo.generateStreamingResponse(
            prompt = "Reply concisely with only: AM BACKEND ONLINE",
            agent = JarvisAgent.JARVIS_PRIME,
            language = JarvisLanguage.ENGLISH,
            telemetry = telemetry,
            memories = emptyList(),
            history = emptyList(),
            enableWebSearch = false
        ).toList()

        val finalReply = chunks.lastOrNull().orEmpty().trim()
        assertTrue("Expected non-empty AI chat response from Vercel backend", finalReply.isNotEmpty())
        assertFalse(
            "Chat response returned error payload instead of AI output: $finalReply",
            AiRepository.isErrorConversation(ConversationEntity(sessionId = "s", role = "jarvis", text = finalReply))
        )
        assertTrue(
            "Expected active free provider metadata to be recorded",
            repo.multiProviderStatus.value.activeProviderLabel.isNotBlank()
        )

        val history = listOf(
            ConversationEntity(sessionId = "s", role = "user", text = "Remind me about our free-tier architecture."),
            ConversationEntity(sessionId = "s", role = "jarvis", text = "We route across Gemini Free, Groq Free, and OpenRouter zero-cost models.")
        )
        val summaryResult = repo.summarizeConversation(history, JarvisLanguage.ENGLISH)
        assertTrue(
            "Expected summarizeConversation to succeed against Vercel backend: ${summaryResult.exceptionOrNull()?.message}",
            summaryResult.isSuccess
        )
        assertTrue(summaryResult.getOrNull().orEmpty().isNotBlank())

        val (briefingLine, briefingSource) = repo.generateDailyBriefingLine(
            tasksSummary = "1 pending: Verify AM production APK",
            weatherSummary = "Clear, 22C",
            batterySummary = "Battery 88% (Charging)",
            language = JarvisLanguage.ENGLISH
        )
        assertTrue(briefingLine.isNotBlank())
        assertTrue("Expected live AI briefing source, got $briefingSource", briefingSource != "fallback")
    }
}
