package com.example

import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.ai.AiRepository
import com.example.ai.BrainIntent
import com.example.ai.DetectedBrainLanguage
import com.example.ai.JarvisBrainEngine
import com.example.ai.SseLineEvent
import com.example.data.db.ConversationEntity
import com.example.data.db.MemoryEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
        assertTrue(errMsg.contains("rate-limited"))
    }
}
