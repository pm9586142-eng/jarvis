package com.example

import com.example.ai.AiRepository
import com.example.ai.FallbackAttemptOutcome
import com.example.ai.FreeModelHealth
import com.example.ai.GeminiFreeModelFallbackManager
import com.example.ai.JarvisBrainEngine
import com.example.ai.SseLineEvent
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class GeminiFreeModelFallbackManagerTest {

    @Test
    fun allowlistGuardrails_blockPaidAndDeprecatedModelsAndPreservePrimary() {
        // Approved free-tier models
        for (model in GeminiFreeModelFallbackManager.FREE_TIER_MODELS) {
            assertTrue("Expected $model to be approved", GeminiFreeModelFallbackManager.isApprovedFreeTierModel(model))
            assertFalse(GeminiFreeModelFallbackManager.isPaidOnlyModel(model))
            assertFalse(GeminiFreeModelFallbackManager.isDeprecatedOrUnsupportedModel(model))
        }

        // Paid-only models must NEVER be approved for free fallback
        val paidModels = listOf(
            "gemini-4-pro",
            "gemini-4.0-flash",
            "gemini-3.8-pro",
            "gemini-2.5-pro",
            "gemini-ultra",
            "imagen-3.0-generate-002",
            "veo-2.0-generate-001"
        )
        for (paid in paidModels) {
            assertTrue("Expected $paid to be marked paid-only", GeminiFreeModelFallbackManager.isPaidOnlyModel(paid))
            assertFalse("Paid model $paid must never be approved", GeminiFreeModelFallbackManager.isApprovedFreeTierModel(paid))
        }

        // Deprecated/retired models must NEVER be approved
        val deprecatedModels = listOf(
            "gemini-1.0-pro",
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-2.5-flash-preview-05-20",
            "gemini-2.5-flash-lite-preview-09-2025"
        )
        for (dep in deprecatedModels) {
            assertTrue("Expected $dep to be marked deprecated", GeminiFreeModelFallbackManager.isDeprecatedOrUnsupportedModel(dep))
            assertFalse("Deprecated model $dep must never be approved", GeminiFreeModelFallbackManager.isApprovedFreeTierModel(dep))
        }

        val resolved = GeminiFreeModelFallbackManager.resolveFallbackChain(
            primaryModel = "gemini-3.8-flash",
            configuredFallbacks = listOf(
                "gemini-3.8-pro",
                "gemini-2.0-flash",
                "gemini-3.6-flash",
                "imagen-3.0",
                "gemini-2.5-flash-lite"
            )
        )
        assertEquals("gemini-3.8-flash", resolved.primaryModel)
        assertEquals(listOf("gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash-lite"), resolved.chain)
        assertTrue(resolved.rejectedModels.contains("gemini-3.8-pro"))
        assertTrue(resolved.rejectedModels.contains("gemini-2.0-flash"))
        assertTrue(resolved.rejectedModels.contains("imagen-3.0"))

        // AiRepository.resolveActiveModel permits stable gemini-2.5-flash-lite while still upgrading deprecated gemini-2.5-flash
        assertEquals("gemini-2.5-flash-lite", AiRepository.resolveActiveModel("gemini-2.5-flash-lite"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("gemini-2.5-flash"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("gemini-2.5-flash-lite-preview-09-2025"))
    }

    @Test
    fun primary429Rpd_switchesAutomaticallyToGemini36FlashAndUpdatesPoolStatus() = runBlocking {
        var fakeClock = 1_000_000L
        val manager = GeminiFreeModelFallbackManager(
            primaryModelProvider = { "gemini-3.8-flash" },
            enableDynamicDiscovery = false,
            nowMs = { fakeClock }
        )

        val calledModels = mutableListOf<String>()
        val switches = mutableListOf<Pair<String, String>>()

        val res = manager.executeWithFallback(
            enableBackoff = true,
            sleep = { },
            onModelSwitch = { from, to, _ -> switches.add(from to to) }
        ) { candidateModel, _, _ ->
            calledModels.add(candidateModel)
            if (candidateModel == "gemini-3.8-flash") {
                FallbackAttemptOutcome(
                    failure = JarvisBrainEngine.classifyGeminiErrorDetailed(
                        rawMessage = "Quota exceeded for requests per day, limit: 1500.",
                        httpCode = 429
                    )
                )
            } else {
                FallbackAttemptOutcome(value = "Answer from $candidateModel")
            }
        }

        assertNull(res.failure)
        assertEquals("Answer from gemini-3.6-flash", res.value)
        assertEquals("gemini-3.8-flash", res.primaryModel)
        assertEquals("gemini-3.6-flash", res.modelUsed)
        assertTrue(res.fallbackUsed)
        assertEquals("gemini-3.8-flash", res.switchedFrom)
        assertEquals(listOf("gemini-3.8-flash", "gemini-3.6-flash"), calledModels)
        assertEquals(listOf("gemini-3.8-flash" to "gemini-3.6-flash"), switches)

        val status = manager.poolStatus.value
        assertEquals("gemini-3.6-flash", status.lastActiveModel)
        assertTrue(status.fallbackUsed)
        assertEquals(1, status.totalFallbackSwitches)
        assertEquals(FreeModelHealth.RPD_EXHAUSTED, status.models.first { it.model == "gemini-3.8-flash" }.status)
        assertEquals(FreeModelHealth.AVAILABLE, status.models.first { it.model == "gemini-3.6-flash" }.status)

        // Subsequent call during cooldown skips cooling-down primary (0 duplicate wasted 429 calls)
        val calledOnSecond = mutableListOf<String>()
        val secondRes = manager.executeWithFallback(enableBackoff = false) { candidateModel, _, _ ->
            calledOnSecond.add(candidateModel)
            FallbackAttemptOutcome(value = "Second from $candidateModel")
        }
        assertNull(secondRes.failure)
        assertEquals(listOf("gemini-3.6-flash"), calledOnSecond)

        // Advance clock past RPD cooldown -> primary becomes eligible again
        fakeClock += 20 * 60 * 1000L
        val calledAfterReset = mutableListOf<String>()
        val thirdRes = manager.executeWithFallback(enableBackoff = false) { candidateModel, _, _ ->
            calledAfterReset.add(candidateModel)
            FallbackAttemptOutcome(value = "Primary restored")
        }
        assertNull(thirdRes.failure)
        assertEquals("gemini-3.8-flash", thirdRes.modelUsed)
        assertFalse(thirdRes.fallbackUsed)
        assertEquals(listOf("gemini-3.8-flash"), calledAfterReset)
    }

    @Test
    fun cascading429And404_reachesThirdFreeModelAndRespectsDynamicDiscoveryFilter() = runBlocking {
        val manager = GeminiFreeModelFallbackManager(
            primaryModelProvider = { "gemini-3.8-flash" },
            enableDynamicDiscovery = true
        )

        val discoveryPayload = """
            {
              "models": [
                { "name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"] },
                { "name": "models/gemini-3.8-pro", "supportedGenerationMethods": ["generateContent"] },
                { "name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["generateContent"] },
                { "name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"] },
                { "name": "models/gemini-2.5-flash-lite", "supportedGenerationMethods": ["embedContent"] }
              ]
            }
        """.trimIndent()

        val called = mutableListOf<String>()
        val res = manager.executeWithFallback(
            enableBackoff = false,
            fetchModelsJson = { discoveryPayload }
        ) { candidateModel, _, _ ->
            called.add(candidateModel)
            if (candidateModel == "gemini-3.8-flash") {
                FallbackAttemptOutcome(
                    failure = JarvisBrainEngine.classifyGeminiErrorDetailed(
                        rawMessage = "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0.",
                        httpCode = 429
                    )
                )
            } else {
                FallbackAttemptOutcome(value = "Served by $candidateModel")
            }
        }

        // gemini-3.6-flash wasn't in discoveryPayload, gemini-3.8-pro was paid, gemini-2.0-flash was deprecated,
        // and gemini-2.5-flash-lite didn't support generateContent -> skips cleanly to gemini-3.5-flash-lite!
        assertNull(res.failure)
        assertEquals("gemini-3.5-flash-lite", res.modelUsed)
        assertTrue(res.fallbackUsed)
        assertEquals(listOf("gemini-3.8-flash", "gemini-3.5-flash-lite"), called)
        assertTrue(manager.poolStatus.value.dynamicDiscoveryUsed)
    }

    @Test
    fun allFourFreeModelsExhausted_returnsHonestWaitMessageAndFailsFastWithZeroDuplicateCalls() = runBlocking {
        val fakeClock = 5_000_000L
        val manager = GeminiFreeModelFallbackManager(
            primaryModelProvider = { "gemini-3.8-flash" },
            enableDynamicDiscovery = false,
            nowMs = { fakeClock }
        )

        val calledFirst = mutableListOf<String>()
        val firstRes = manager.executeWithFallback(
            enableBackoff = true,
            maxPrimaryRetries = 1,
            baseDelayMs = 10L,
            sleep = { }
        ) { candidateModel, _, _ ->
            calledFirst.add(candidateModel)
            FallbackAttemptOutcome<String>(
                failure = JarvisBrainEngine.classifyGeminiErrorDetailed(
                    rawMessage = "Quota exceeded for requests per day on $candidateModel, limit: 1500.",
                    httpCode = 429
                )
            )
        }

        assertNotNull(firstRes.failure)
        assertTrue(firstRes.allModelsExhausted)
        assertFalse(firstRes.fallbackUsed)
        assertEquals("ALL_FREE_MODELS_EXHAUSTED", firstRes.failure!!.code)
        assertEquals(429, firstRes.failure!!.httpStatus)
        assertEquals(GeminiFreeModelFallbackManager.FREE_TIER_MODELS, firstRes.attemptedModels)
        assertEquals(4, calledFirst.size)
        assertTrue(firstRes.failure!!.displayMessage.contains("Free Tier"))
        assertTrue(firstRes.failure!!.displayMessage.contains("never switch to paid models"))
        assertTrue(firstRes.failure!!.displayMessage.contains("wait"))

        // Immediate follow-up request fails fast with 0 API calls (no wasted 429 retries!)
        var secondCalls = 0
        val secondRes = manager.executeWithFallback(enableBackoff = false) { _, _, _ ->
            secondCalls += 1
            FallbackAttemptOutcome(value = "should not execute")
        }
        assertEquals(0, secondCalls)
        assertTrue(secondRes.allModelsExhausted)
        assertEquals("ALL_FREE_MODELS_EXHAUSTED", secondRes.failure?.code)
        assertTrue(manager.poolStatus.value.allExhausted)
    }

    @Test
    fun nonSwitchableErrors_neverTriggerModelFallback() = runBlocking {
        val nonSwitchableCases = listOf(
            JarvisBrainEngine.classifyGeminiErrorDetailed("API key not valid.", httpCode = 401),
            JarvisBrainEngine.classifyGeminiErrorDetailed("Cloud billing is disabled for this project.", httpCode = 403),
            JarvisBrainEngine.classifyGeminiErrorDetailed("Monthly spend cap exceeded.", httpCode = 429),
            JarvisBrainEngine.classifyGeminiErrorDetailed("Invalid argument in payload.", httpCode = 400)
        )

        for (err in nonSwitchableCases) {
            val manager = GeminiFreeModelFallbackManager(
                primaryModelProvider = { "gemini-3.8-flash" },
                enableDynamicDiscovery = false
            )
            val attempted = mutableListOf<String>()
            val res = manager.executeWithFallback(enableBackoff = false) { candidateModel, _, _ ->
                attempted.add(candidateModel)
                FallbackAttemptOutcome<String>(failure = err)
            }
            assertEquals("Expected strictly 1 model tried for ${err.code}", listOf("gemini-3.8-flash"), attempted)
            assertFalse(res.allModelsExhausted)
            assertEquals(err.code, res.failure?.code)
        }
    }

    @Test
    fun parseSseDataLine_parsesBackendModelFallbackMetaEvent() {
        val event = AiRepository.parseSseDataLine(
            """data: {"meta":{"intent":"CODING","language":"ENGLISH","model":"gemini-3.6-flash","primaryModel":"gemini-3.8-flash","fallbackUsed":true}}""",
            isBackendStream = true
        )
        assertTrue(event is SseLineEvent.Meta)
        val meta = event as SseLineEvent.Meta
        assertEquals("CODING", meta.intent)
        assertEquals("ENGLISH", meta.language)
        assertEquals("gemini-3.6-flash", meta.model)
        assertEquals("gemini-3.8-flash", meta.primaryModel)
        assertTrue(meta.fallbackUsed)
    }
}
