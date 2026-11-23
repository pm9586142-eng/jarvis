package com.example

import com.example.openjarvis.OpenJarvisRepository
import com.example.voice.OpenJarvisVoiceDirective
import com.example.voice.VoiceCommandParser
import org.json.JSONArray
import org.json.JSONObject
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
class OpenJarvisIntegrationTest {

    @Test
    fun validateRemoteUrl_blocksCloudMetadataAndRemotePlainHttp() {
        val metadata = OpenJarvisRepository.validateRemoteUrl("http://169.254.169.254/latest/meta-data")
        assertFalse(metadata.first)

        val remoteHttp = OpenJarvisRepository.validateRemoteUrl("http://example.com:8100")
        assertFalse(remoteHttp.first)

        val localLan = OpenJarvisRepository.validateRemoteUrl("http://192.168.1.40:8100/")
        assertTrue(localLan.first)
        assertEquals("http://192.168.1.40:8100", localLan.second)

        val httpsTunnel = OpenJarvisRepository.validateRemoteUrl("https://pc-tunnel.example.com/")
        assertTrue(httpsTunnel.first)
        assertEquals("https://pc-tunnel.example.com", httpsTunnel.second)
    }

    @Test
    fun parseStatusSnapshot_decodesBackendPayloadAccurately() {
        val payload = JSONObject().apply {
            put("existingAiApiPreserved", true)
            put("defaultEngineId", "amai_cloud")
            put("hardware", JSONObject().apply {
                put("runtimeMode", "serverless")
                put("cpuCores", 8)
                put("totalRamGb", 16.0)
            })
            put("pythonService", JSONObject().apply {
                put("connected", false)
            })
            put("memoryStats", JSONObject().apply {
                put("documentsCount", 4)
                put("chunksCount", 12)
            })
            put("learning", JSONObject().apply {
                put("summary", JSONObject().apply {
                    put("totalTraces", 9)
                    put("successRate", 89)
                    put("avgLatencyMs", 240)
                })
                put("policy", JSONObject().apply {
                    put("strategy", "adaptive_ucb1")
                })
            })
            put("engines", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "amai_cloud")
                    put("name", "AM AI Existing Cloud Providers")
                    put("kind", "cloud_adapter")
                    put("status", "connected")
                    put("latencyMs", 110)
                    put("lastMessage", "Ready")
                    put("isDefault", true)
                    put("supportedOnServerless", true)
                })
            })
            put("assistantModes", JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "deep_research_agent")
                    put("name", "Deep Research Agent")
                    put("defaultAgentId", "orchestrator")
                    put("description", "Cross-source research synthesis")
                })
            })
        }

        val snap = OpenJarvisRepository.parseStatusSnapshot(payload)
        assertTrue(snap.existingAiPreserved)
        assertEquals("serverless", snap.runtimeMode)
        assertEquals(4, snap.docsCount)
        assertEquals(9, snap.totalTraces)
        assertEquals(89, snap.successRate)
        assertEquals("amai_cloud", snap.engines.single().id)
        assertEquals("deep_research_agent", snap.assistantModes.single().id)
    }

    @Test
    fun parseRunOutcome_capturesConfirmationAndAnswers() {
        val confirmJson = JSONObject().apply {
            put("ok", false)
            put("requiresConfirmation", true)
            put("confirmationToken", "tok-123")
            put("assistantMode", "scheduled_operative")
            put("error", "Confirmation required before file write")
        }
        val confirmOutcome = OpenJarvisRepository.parseRunOutcome(409, confirmJson)
        assertFalse(confirmOutcome.ok)
        assertTrue(confirmOutcome.requiresConfirmation)
        assertEquals("tok-123", confirmOutcome.confirmationToken)

        val okJson = JSONObject().apply {
            put("ok", true)
            put("assistantMode", "personal_assistant")
            put("assistantName", "Personal Assistant")
            put("agentId", "simple")
            put("engineId", "amai_cloud")
            put("answer", "All systems nominal.")
            put("latencyMs", 85L)
        }
        val okOutcome = OpenJarvisRepository.parseRunOutcome(200, okJson)
        assertTrue(okOutcome.ok)
        assertEquals("All systems nominal.", okOutcome.answer)
        assertEquals("amai_cloud", okOutcome.engineId)
    }

    @Test
    fun voiceCommandParser_recognizesEnglishHindiAndHinglishOpenJarvisDirectives() {
        assertEquals(OpenJarvisVoiceDirective.OpenScreen, VoiceCommandParser.parseOpenJarvisDirective("Hey AM open openjarvis"))
        assertEquals(OpenJarvisVoiceDirective.OpenScreen, VoiceCommandParser.parseOpenJarvisDirective("ओपनजर्विस खोलो"))
        assertEquals(OpenJarvisVoiceDirective.CheckEngines, VoiceCommandParser.parseOpenJarvisDirective("check openjarvis engines"))
        assertEquals(OpenJarvisVoiceDirective.CheckEngines, VoiceCommandParser.parseOpenJarvisDirective("इंजन चेक करो"))
        assertEquals(
            OpenJarvisVoiceDirective.DeepResearch("edge inference watts"),
            VoiceCommandParser.parseOpenJarvisDirective("deep research on edge inference watts")
        )
        assertEquals(
            OpenJarvisVoiceDirective.DeepResearch("क्वांटम"),
            VoiceCommandParser.parseOpenJarvisDirective("डीप रिसर्च क्वांटम")
        )
        assertEquals(
            OpenJarvisVoiceDirective.HybridSearch("ollama routing"),
            VoiceCommandParser.parseOpenJarvisDirective("search hybrid memory for ollama routing")
        )
        assertNull(VoiceCommandParser.parseOpenJarvisDirective("tell me a joke"))
    }

    @Test
    fun viewModel_processesOpenJarvisVoiceDirectiveWithoutChangingBackendUrl() {
        val app = androidx.test.core.app.ApplicationProvider.getApplicationContext<android.app.Application>()
        val vm = com.example.ui.JarvisViewModel(app)
        assertEquals("https://jarvis-gray-three-59.vercel.app", BuildConfig.BACKEND_URL)
        assertEquals("gemini-3.8-flash", BuildConfig.GEMINI_MODEL)

        vm.processVoiceInput("Hey AM open openjarvis")
        assertEquals(com.example.ui.ScreenDestination.OPEN_JARVIS, vm.currentScreen.value)
    }
}
