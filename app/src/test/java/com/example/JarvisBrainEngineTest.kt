package com.example

import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.ai.AiRepository
import com.example.ai.BrainIntent
import com.example.ai.DetectedBrainLanguage
import com.example.ai.GeminiBackoffPolicy
import com.example.ai.GeminiQuotaCategory
import com.example.ai.JarvisBrainEngine
import com.example.ai.SseLineEvent
import com.example.data.db.ConversationEntity
import com.example.data.db.MemoryEntity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class JarvisBrainEngineTest {

    @Test
    fun detectLanguage_supportsEnglishHindiHinglishAndGujarati() {
        assertEquals(
            DetectedBrainLanguage.ENGLISH,
            JarvisBrainEngine.detectLanguage("Explain MVVM cleanly", JarvisLanguage.ENGLISH)
        )
        assertEquals(
            DetectedBrainLanguage.HINDI,
            JarvisBrainEngine.detectLanguage("कृपया डेटाबेस आर्किटेक्चर समझाएं", JarvisLanguage.ENGLISH)
        )
        assertEquals(
            DetectedBrainLanguage.HINGLISH,
            JarvisBrainEngine.detectLanguage("Bhai mujhe ye bug fix karna hai kaise karu?", JarvisLanguage.ENGLISH)
        )
        assertEquals(
            DetectedBrainLanguage.GUJARATI,
            JarvisBrainEngine.detectLanguage("કૃપા કરીને આ કોડ સમજાવો", JarvisLanguage.ENGLISH)
        )
    }

    @Test
    fun analyzePrompt_detectsIntentsFollowUpsAndThinkingBudgets() {
        val codeAnalysis = JarvisBrainEngine.analyzePrompt(
            prompt = "Refactor this Kotlin ViewModel function",
            selectedLanguage = JarvisLanguage.ENGLISH,
            hasHistory = false
        )
        assertEquals(BrainIntent.CODING, codeAnalysis.intent)
        assertEquals(1024, codeAnalysis.thinkingBudget)
        assertFalse(codeAnalysis.isFollowUp)

        val followUpAnalysis = JarvisBrainEngine.analyzePrompt(
            prompt = "Explain that step again",
            selectedLanguage = JarvisLanguage.ENGLISH,
            hasHistory = true
        )
        assertEquals(BrainIntent.FOLLOW_UP, followUpAnalysis.intent)
        assertTrue(followUpAnalysis.isFollowUp)

        val planAnalysis = JarvisBrainEngine.analyzePrompt(
            prompt = "Create a step by step architecture roadmap for launch",
            selectedLanguage = JarvisLanguage.ENGLISH,
            hasHistory = false
        )
        assertEquals(BrainIntent.PLANNING, planAnalysis.intent)
        assertEquals(1024, planAnalysis.thinkingBudget)

        val greetAnalysis = JarvisBrainEngine.analyzePrompt(
            prompt = "Good morning Jarvis",
            selectedLanguage = JarvisLanguage.ENGLISH,
            hasHistory = false
        )
        assertEquals(BrainIntent.CONVERSATION, greetAnalysis.intent)
        assertEquals(0, greetAnalysis.thinkingBudget)
    }

    @Test
    fun buildContextDigest_summarizesOlderTurnsCompactly() {
        val olderTurns = (1..10).map { idx ->
            ConversationEntity(
                sessionId = "s1",
                role = if (idx % 2 == 1) "user" else "jarvis",
                text = "Turn $idx message about Room migrations and Gemini streaming",
                agentName = "JARVIS"
            )
        }
        val digest = JarvisBrainEngine.buildContextDigest(olderTurns)
        assertTrue(digest.contains("Earlier Conversation Digest (10 older messages)"))
        assertTrue(digest.contains("Turn 10"))
    }

    @Test
    fun buildSystemInstruction_includesHinglishDirectiveAndWeightedMemories() {
        val repo = AiRepository()
        val analysis = JarvisBrainEngine.analyzePrompt(
            prompt = "Kotlin Room migration kaise kare?",
            selectedLanguage = JarvisLanguage.HINGLISH,
            hasHistory = true
        )
        val memories = listOf(
            MemoryEntity(key = "Stack", category = "PROJECT", content = "Android Kotlin Compose + Room", importance = 5),
            MemoryEntity(key = "Hobby", category = "FACT", content = "Likes chess", importance = 2)
        )
        val instruction = repo.buildSystemInstruction(
            agent = JarvisAgent.DUM_E_ENGINEER,
            language = JarvisLanguage.HINGLISH,
            telemetry = null,
            memories = memories,
            queryPrompt = "Kotlin Room migration kaise kare?",
            analysis = analysis,
            retrievedConversationSnippets = listOf("[Sprint Plan • May 14] Sir: Keep migrations explicit.")
        )
        assertTrue(instruction.contains("Hinglish"))
        assertTrue(instruction.contains("Android Kotlin Compose + Room"))
        assertTrue(instruction.contains("Keep migrations explicit"))
    }

    @Test
    fun parseSseDataLine_parsesBackendMetaTextErrorAndDoneEvents() {
        val metaEvent = AiRepository.parseSseDataLine(
            """data: {"meta":{"intent":"CODING","language":"HINGLISH"}}""",
            isBackendStream = true
        )
        assertTrue(metaEvent is SseLineEvent.Meta)
        assertEquals("CODING", (metaEvent as SseLineEvent.Meta).intent)

        val textEvent = AiRepository.parseSseDataLine(
            """data: {"text":"Hello Sir"}""",
            isBackendStream = true
        )
        assertEquals(SseLineEvent.Text("Hello Sir"), textEvent)

        val doneEvent = AiRepository.parseSseDataLine("""data: {"done":true}""", isBackendStream = true)
        assertEquals(SseLineEvent.Done, doneEvent)

        val errMsg = JarvisBrainEngine.classifyGeminiError("quota exceeded", 429)
        assertTrue(errMsg.contains("HTTP 429"))
        assertTrue(errMsg.contains("quota exceeded"))
        assertTrue(
            AiRepository.isErrorConversation(
                ConversationEntity(sessionId = "s1", role = "jarvis", text = errMsg, agentName = "JARVIS")
            )
        )

        val modelErrMsg = JarvisBrainEngine.classifyGeminiError(
            "models/gemini-2.5-flash is no longer available to new users.",
            404
        )
        assertTrue(modelErrMsg.contains("gemini-3.8-flash"))
        assertTrue(
            AiRepository.isErrorConversation(
                ConversationEntity(sessionId = "s1", role = "jarvis", text = modelErrMsg, agentName = "JARVIS")
            )
        )
    }

    @Test
    fun gemini38FlashCompatibility_resolvesModelUsesThinkingLevelAndSkipsThoughtParts() {
        assertEquals("gemini-3.8-flash", AiRepository.DEFAULT_MODEL)
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel(""))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("UNSET"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("gemini-2.5-flash"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("models/gemini-2.5-flash"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("models/gemini-3.8-flash"))
        assertEquals("gemini-3.6-flash", AiRepository.resolveActiveModel("gemini-3.6-flash"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("gemini-3.8-pro"))
        assertEquals("gemini-3.8-flash", AiRepository.resolveActiveModel("gpt-4o"))

        val lowThinking = AiRepository.buildThinkingConfigJson("gemini-3.8-flash", 0)
        assertEquals("LOW", lowThinking.optString("thinkingLevel"))
        assertFalse(lowThinking.has("thinkingBudget"))

        val highThinking = AiRepository.buildThinkingConfigJson("gemini-3.8-flash", 1024)
        assertEquals("HIGH", highThinking.optString("thinkingLevel"))
        assertFalse(highThinking.has("thinkingBudget"))

        val directSseWithThought = AiRepository.parseSseDataLine(
            """data: {"candidates":[{"content":{"parts":[{"text":"internal reasoning","thought":true},{"text":"Visible answer, Sir."}]}}]}""",
            isBackendStream = false
        )
        assertEquals(SseLineEvent.Text("Visible answer, Sir."), directSseWithThought)

        val thoughtOnlySse = AiRepository.parseSseDataLine(
            """data: {"candidates":[{"content":{"parts":[{"text":"still thinking","thought":true}]}}]}""",
            isBackendStream = false
        )
        assertEquals(SseLineEvent.Ignore, thoughtOnlySse)
    }

    @Test
    fun classifyGeminiErrorDetailed_distinguishesRpmTpmRpdBillingAndSpendCapWithVerbatimMessage() {
        val rpmBody = """
            {
              "error": {
                "code": 429,
                "status": "RESOURCE_EXHAUSTED",
                "message": "You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generate_content_free_tier_requests, limit: 15.",
                "details": [
                  {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [
                      {
                        "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                        "quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
                        "quotaValue": "15"
                      }
                    ]
                  },
                  {
                    "@type": "type.googleapis.com/google.rpc.RetryInfo",
                    "retryDelay": "2.5s"
                  }
                ]
              }
            }
        """.trimIndent()
        val rpm = JarvisBrainEngine.classifyGeminiErrorDetailed(rpmBody, httpCode = 429, errorBody = rpmBody)
        assertEquals("GEMINI_QUOTA_RPM", rpm.code)
        assertEquals(GeminiQuotaCategory.RPM, rpm.quotaCategory)
        assertTrue(rpm.retryable)
        assertEquals(2.5, rpm.retryAfterSeconds ?: 0.0, 0.01)
        assertTrue(rpm.displayMessage.contains("HTTP 429"))
        assertTrue(rpm.displayMessage.contains("limit: 15"))

        val tpmBody = """
            {
              "error": {
                "code": 429,
                "status": "RESOURCE_EXHAUSTED",
                "message": "Input token count per minute exceeded, limit: 250000.",
                "details": [
                  {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [
                      {
                        "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_input_token_count",
                        "quotaId": "GenerateContentInputTokensPerModelPerMinute-FreeTier",
                        "quotaValue": "250000"
                      }
                    ]
                  }
                ]
              }
            }
        """.trimIndent()
        val tpm = JarvisBrainEngine.classifyGeminiErrorDetailed(tpmBody, httpCode = 429, errorBody = tpmBody)
        assertEquals("GEMINI_QUOTA_TPM", tpm.code)
        assertEquals(GeminiQuotaCategory.TPM, tpm.quotaCategory)
        assertTrue(tpm.retryable)
        assertTrue(tpm.displayMessage.contains("250000"))

        val rpdBody = """
            {
              "error": {
                "code": 429,
                "status": "RESOURCE_EXHAUSTED",
                "message": "Quota exceeded for requests per day, limit: 1500.",
                "details": [
                  {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [
                      {
                        "quotaMetric": "generativelanguage.googleapis.com/generate_requests_per_day",
                        "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                        "quotaValue": "1500"
                      }
                    ]
                  }
                ]
              }
            }
        """.trimIndent()
        val rpd = JarvisBrainEngine.classifyGeminiErrorDetailed(rpdBody, httpCode = 429, errorBody = rpdBody)
        assertEquals("GEMINI_QUOTA_RPD", rpd.code)
        assertEquals(GeminiQuotaCategory.RPD, rpd.quotaCategory)
        assertFalse(rpd.retryable)
        assertTrue(rpd.displayMessage.contains("limit: 1500"))
        assertTrue(rpd.displayMessage.contains("Google AI Studio Usage & limits"))

        val billingZeroBody = """
            {
              "error": {
                "code": 429,
                "status": "RESOURCE_EXHAUSTED",
                "message": "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0.",
                "details": [
                  {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [
                      {
                        "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                        "quotaValue": "0"
                      }
                    ]
                  }
                ]
              }
            }
        """.trimIndent()
        val billing = JarvisBrainEngine.classifyGeminiErrorDetailed(billingZeroBody, httpCode = 429, errorBody = billingZeroBody)
        assertEquals("GEMINI_QUOTA_BILLING", billing.code)
        assertEquals(GeminiQuotaCategory.BILLING, billing.quotaCategory)
        assertFalse(billing.retryable)
        assertTrue(billing.displayMessage.contains("limit: 0"))
        assertTrue(billing.displayMessage.contains("billing tier"))

        val spendCapBody = """
            {
              "error": {
                "code": 429,
                "status": "RESOURCE_EXHAUSTED",
                "message": "Monthly spend cap exceeded for this project."
              }
            }
        """.trimIndent()
        val spendCap = JarvisBrainEngine.classifyGeminiErrorDetailed(spendCapBody, httpCode = 429, errorBody = spendCapBody)
        assertEquals("GEMINI_QUOTA_SPEND_CAP", spendCap.code)
        assertEquals(GeminiQuotaCategory.SPEND_CAP, spendCap.quotaCategory)
        assertFalse(spendCap.retryable)
        assertTrue(spendCap.displayMessage.contains("Monthly spend cap exceeded"))
        assertTrue(spendCap.displayMessage.contains("spend cap settings"))
    }

    @Test
    fun shouldAutoExtractMemories_skipsGenericQueriesAndMatchesPersonalStatements() {
        assertFalse(JarvisBrainEngine.shouldAutoExtractMemories("Hi Jarvis"))
        assertFalse(JarvisBrainEngine.shouldAutoExtractMemories("What is the boiling point of water?"))
        assertTrue(JarvisBrainEngine.shouldAutoExtractMemories("I prefer Kotlin and concise responses for my project"))
        assertTrue(JarvisBrainEngine.shouldAutoExtractMemories("Mera naam Kabir hai aur mujhe Hinglish pasand hai"))
    }

    @Test
    fun geminiBackoffPolicy_retriesTemporaryRpmWithBoundedDelaysAndNeverRetriesNonRetryableQuota() = runBlocking {
        val rpmErr = JarvisBrainEngine.classifyGeminiErrorDetailed(
            rawMessage = "Requests per minute limit reached",
            httpCode = 429
        )
        val delays = mutableListOf<Long>()
        var attempts = 0
        val recovered = GeminiBackoffPolicy.executeWithBackoff(
            maxRetries = 2,
            baseDelayMs = 100L,
            maxRetryDelayMs = 5000L,
            sleep = { ms -> delays.add(ms) },
            randomDouble = { 0.0 },
            classifyFailure = { result -> if (result == "OK") null else rpmErr }
        ) {
            attempts += 1
            if (attempts < 3) "FAIL" else "OK"
        }
        assertEquals("OK", recovered)
        assertEquals(3, attempts)
        assertEquals(listOf(100L, 200L), delays)

        // Hard cap prevents infinite retries even if caller requests an excessive maxRetries
        var persistentAttempts = 0
        val persistentDelays = mutableListOf<Long>()
        val exhausted = GeminiBackoffPolicy.executeWithBackoff(
            maxRetries = 99,
            baseDelayMs = 50L,
            maxRetryDelayMs = 5000L,
            sleep = { ms -> persistentDelays.add(ms) },
            randomDouble = { 0.0 },
            classifyFailure = { rpmErr }
        ) {
            persistentAttempts += 1
            "STILL_429"
        }
        assertEquals("STILL_429", exhausted)
        assertEquals(GeminiBackoffPolicy.HARD_MAX_RETRIES + 1, persistentAttempts)
        assertEquals(GeminiBackoffPolicy.HARD_MAX_RETRIES, persistentDelays.size)

        // Non-retryable RPD / BILLING / SPEND_CAP perform strictly 0 retries (1 attempt)
        val nonRetryableErrors = listOf(
            JarvisBrainEngine.classifyGeminiErrorDetailed("Requests per day quota exceeded", 429),
            JarvisBrainEngine.classifyGeminiErrorDetailed("Quota limit: 0, billing required", 429),
            JarvisBrainEngine.classifyGeminiErrorDetailed("Monthly spend cap exceeded", 429)
        )
        for (err in nonRetryableErrors) {
            var count = 0
            GeminiBackoffPolicy.executeWithBackoff(
                maxRetries = 2,
                sleep = { throw AssertionError("Should not sleep on non-retryable ${err.code}") },
                classifyFailure = { err }
            ) {
                count += 1
                "ERR"
            }
            assertEquals("Expected 0 retries for ${err.code}", 1, count)
        }

        // Long retryDelay (> maxRetryDelayMs) fails fast without stalling
        val longRetryErr = JarvisBrainEngine.classifyGeminiErrorDetailed(
            rawMessage = "Requests per minute exceeded. Please retry in 45s.",
            httpCode = 429
        )
        assertNull(
            GeminiBackoffPolicy.nextRetryDelayMs(
                classification = longRetryErr,
                attempt = 0,
                maxRetries = 2,
                maxRetryDelayMs = 8000L
            )
        )
    }
}
