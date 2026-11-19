package com.example

import com.example.ai.AiProviderId
import com.example.ai.AiRepository
import com.example.ai.FreeMultiProviderRouter
import com.example.ai.GeminiFreeModelFallbackManager
import com.example.ai.OpenAiSseEvent
import com.example.ai.OpenRouterCatalogVerification
import com.example.ai.SseLineEvent
import com.example.data.db.ConversationEntity
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class FreeMultiProviderRouterTest {

    @Test
    fun zeroCostAllowlist_acceptsApprovedFreeModelsAndRejectsPaidOrUnknownModels() {
        assertTrue(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GEMINI, "gemini-3.8-flash"))
        assertTrue(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GEMINI, "gemini-3.6-flash"))
        assertFalse(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GEMINI, "gemini-3.8-pro"))
        assertFalse(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GEMINI, "gemini-2.0-flash"))

        assertTrue(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GROQ, "openai/gpt-oss-120b"))
        assertTrue(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GROQ, "openai/gpt-oss-20b"))
        assertFalse(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GROQ, "whisper-large-v3"))
        assertFalse(FreeMultiProviderRouter.isApprovedFreeModelForProvider(AiProviderId.GROQ, "gpt-4o"))

        assertTrue(
            FreeMultiProviderRouter.isApprovedFreeModelForProvider(
                AiProviderId.OPENROUTER,
                "nvidia/nemotron-3-ultra-550b-a55b:free"
            )
        )
        assertTrue(
            FreeMultiProviderRouter.isApprovedFreeModelForProvider(
                AiProviderId.OPENROUTER,
                "openrouter/free"
            )
        )
        assertFalse(
            FreeMultiProviderRouter.isApprovedFreeModelForProvider(
                AiProviderId.OPENROUTER,
                "nvidia/nemotron-3-ultra-550b-a55b"
            )
        )
        assertFalse(
            FreeMultiProviderRouter.isApprovedFreeModelForProvider(
                AiProviderId.OPENROUTER,
                "anthropic/claude-3.7-sonnet"
            )
        )
    }

    @Test
    fun pricingGuard_strictlyRequiresZeroPricingAndFailsClosedOnMissingOrNonZeroFees() {
        assertTrue(
            FreeMultiProviderRouter.isPricingStrictlyZero(
                JSONObject("""{"prompt":"0","completion":"0","request":"0","image":"0"}""")
            )
        )
        assertFalse(FreeMultiProviderRouter.isPricingStrictlyZero(null))
        assertFalse(FreeMultiProviderRouter.isPricingStrictlyZero(JSONObject("""{}""")))
        assertFalse(FreeMultiProviderRouter.isPricingStrictlyZero(JSONObject("""{"prompt":"0.000001","completion":"0"}""")))
        assertFalse(FreeMultiProviderRouter.isPricingStrictlyZero(JSONObject("""{"prompt":"0","completion":"0.000002"}""")))
        assertFalse(FreeMultiProviderRouter.isPricingStrictlyZero(JSONObject("""{"prompt":"0","completion":"0","request":"0.01"}""")))
        assertFalse(FreeMultiProviderRouter.isPricingStrictlyZero(JSONObject("""{"prompt":"-1","completion":"0"}""")))

        val catalogJson = """
            {
              "data": [
                {"id":"nvidia/nemotron-3-ultra-550b-a55b:free","pricing":{"prompt":"0","completion":"0"}},
                {"id":"cohere/north-mini-code:free","pricing":{"prompt":"0.000001","completion":"0"}},
                {"id":"openai/gpt-4o","pricing":{"prompt":"0.000005","completion":"0.000015"}}
              ]
            }
        """.trimIndent()
        val parsed = FreeMultiProviderRouter.parseVerifiedOpenRouterCatalogJson(catalogJson)
        assertTrue(parsed.ok)
        assertEquals(setOf("nvidia/nemotron-3-ultra-550b-a55b:free"), parsed.verifiedModels)
        assertEquals(listOf("cohere/north-mini-code:free"), parsed.rejectedNonZeroModels)
    }

    @Test
    fun openRouterCandidates_failClosedUntilLiveZeroPriceCatalogVerified() {
        val fallbackManager = GeminiFreeModelFallbackManager()
        val router = FreeMultiProviderRouter(
            geminiFallbackManager = fallbackManager,
            isGeminiConfigured = { true },
            isGroqConfigured = { true },
            isOpenRouterConfigured = { true }
        )

        // Before live verification, zero OpenRouter models are permitted
        assertTrue(router.getVerifiedOpenRouterCandidates().isEmpty())

        // After failed catalog verification, still fail-closed (empty)
        router.updateOpenRouterCatalog(OpenRouterCatalogVerification(false, emptySet(), emptyList()))
        assertTrue(router.getVerifiedOpenRouterCandidates().isEmpty())

        // After verified $0 catalog, only verified allowlisted :free models are enabled
        router.updateOpenRouterCatalog(
            OpenRouterCatalogVerification(
                ok = true,
                verifiedModels = setOf("nvidia/nemotron-3-ultra-550b-a55b:free", "nvidia/nemotron-3.5-super-vl:free"),
                rejectedNonZeroModels = emptyList()
            )
        )
        assertEquals(listOf("nvidia/nemotron-3-ultra-550b-a55b:free"), router.getVerifiedOpenRouterCandidates(requireVision = false))
        assertEquals(listOf("nvidia/nemotron-3.5-super-vl:free"), router.getVerifiedOpenRouterCandidates(requireVision = true))
    }

    @Test
    fun multiTurnConversationContinuity_andOpenAiSseParsing_workCleanlyAcrossSwitches() {
        val history = listOf(
            ConversationEntity(sessionId = "s1", role = "user", text = "Remember my project is StarkOS.", agentName = "USER"),
            ConversationEntity(sessionId = "s1", role = "jarvis", text = "Noted, Sir. Your project is StarkOS.", agentName = "JARVIS")
        )
        val messages = FreeMultiProviderRouter.buildOpenAiMessagesJson(
            systemInstruction = "You are JARVIS.",
            history = history,
            prompt = "What is my project name?"
        )
        assertEquals(4, messages.length())
        assertEquals("system", messages.getJSONObject(0).getString("role"))
        assertEquals("user", messages.getJSONObject(1).getString("role"))
        assertEquals("assistant", messages.getJSONObject(2).getString("role"))
        assertEquals("user", messages.getJSONObject(3).getString("role"))
        assertEquals("What is my project name?", messages.getJSONObject(3).getString("content"))

        val chunkEvent = FreeMultiProviderRouter.parseOpenAiSseLine(
            """data: {"choices":[{"delta":{"content":"Your project is StarkOS, Sir."}}]}"""
        )
        assertEquals(OpenAiSseEvent.Text("Your project is StarkOS, Sir."), chunkEvent)
        assertEquals(OpenAiSseEvent.Done, FreeMultiProviderRouter.parseOpenAiSseLine("data: [DONE]"))

        val backendMeta = AiRepository.parseSseDataLine(
            """data: {"meta":{"provider":"groq","providerLabel":"Groq Free API","primaryProvider":"gemini","switchedFromProvider":"gemini","model":"openai/gpt-oss-120b","primaryModel":"gemini-3.8-flash","fallbackUsed":true}}""",
            isBackendStream = true
        )
        assertTrue(backendMeta is SseLineEvent.Meta)
        val meta = backendMeta as SseLineEvent.Meta
        assertEquals("groq", meta.provider)
        assertEquals("Groq Free API", meta.providerLabel)
        assertEquals("gemini", meta.switchedFromProvider)
        assertEquals("openai/gpt-oss-120b", meta.model)
        assertTrue(meta.fallbackUsed)
    }

    @Test
    fun cooldownTracking_skipsExhaustedProvidersAndBuildsFriendlyZeroCostExhaustionMessage() {
        var now = 10_000L
        val fallbackManager = GeminiFreeModelFallbackManager(nowMs = { now })
        val router = FreeMultiProviderRouter(
            geminiFallbackManager = fallbackManager,
            isGeminiConfigured = { false },
            isGroqConfigured = { true },
            isOpenRouterConfigured = { true },
            nowMs = { now }
        )

        val billingBlocked = FreeMultiProviderRouter.classifyOpenAiHttpError(
            provider = AiProviderId.GROQ,
            httpCode = 402,
            rawBody = """{"error":{"message":"Payment required"}}"""
        )
        assertTrue(billingBlocked.blockWholeProvider)
        router.recordProviderError(AiProviderId.GROQ, "openai/gpt-oss-120b", billingBlocked)

        // All Groq models are now cooling down immediately (0 wasted retries)
        assertTrue(router.getGroqCandidates().isEmpty())

        // After advancing past cooldown, Groq recovers cleanly
        now += 35 * 60 * 1000L
        assertFalse(router.getGroqCandidates().isEmpty())

        val msg = FreeMultiProviderRouter.buildAllProvidersUnavailableMessage(
            attemptedProviders = listOf(AiProviderId.GEMINI, AiProviderId.GROQ, AiProviderId.OPENROUTER),
            waitSeconds = 60
        )
        assertTrue(msg.contains("Google Gemini Free"))
        assertTrue(msg.contains("Groq Free API"))
        assertTrue(msg.contains("OpenRouter Free"))
        assertTrue(msg.contains("₹0"))
        assertTrue(msg.contains("try again"))
    }
}
