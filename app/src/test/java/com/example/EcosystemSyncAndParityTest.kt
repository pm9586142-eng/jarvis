package com.example

import com.example.agents.JarvisLanguage
import com.example.features.AutomationRepository
import com.example.productivity.DailySummaryComposer
import com.example.sync.AndroidRemoteConfigSyncManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class EcosystemSyncAndParityTest {

    @Test
    fun `remote config parser parses version, providers, and compatibility accurately`() {
        val manager = AndroidRemoteConfigSyncManager(
            backendUrlProvider = { "https://jarvis-gray-three-59.vercel.app" },
            androidVersionName = "1.0"
        )
        val payload = """
            {
              "version": 7,
              "apiVersion": "2026-11",
              "minClientVersionAndroid": "1.0",
              "activeProvider": "groq",
              "fallbackProvider": "openrouter",
              "defaultModel": "llama-3.3-70b-versatile",
              "defaultLanguage": "HINGLISH",
              "voice": {
                "defaultPreset": "laila_soft",
                "neuralTtsEnabled": true,
                "femaleVoiceEnabled": true,
                "speed": 0.95,
                "pitch": 1.02
              },
              "providers": {
                "gemini": { "configured": true, "enabled": true, "maskedKey": "AIza...1234" },
                "groq": { "configured": true, "enabled": true, "maskedKey": "gsk_...9876" }
              }
            }
        """.trimIndent()

        val parsed = manager.parseConfigJson(payload, fromCache = false, syncedAt = 123456L)
        assertEquals(7, parsed.version)
        assertEquals("2026-11", parsed.apiVersion)
        assertEquals("groq", parsed.activeProvider)
        assertEquals("openrouter", parsed.fallbackProvider)
        assertEquals("llama-3.3-70b-versatile", parsed.defaultModel)
        assertEquals("HINGLISH", parsed.defaultLanguage)
        assertTrue(parsed.isCompatible)
        assertFalse(parsed.fromCache)
        assertEquals(2, parsed.providers.size)

        val incompatibleJson = payload.replace("\"minClientVersionAndroid\": \"1.0\"", "\"minClientVersionAndroid\": \"2.5\"")
        val incompatibleParsed = manager.parseConfigJson(incompatibleJson, fromCache = false)
        assertFalse(incompatibleParsed.isCompatible)
    }

    @Test
    fun `semantic compatibility comparator handles major and minor boundaries`() {
        assertTrue(AndroidRemoteConfigSyncManager.isVersionCompatible("1.0", "1.0"))
        assertTrue(AndroidRemoteConfigSyncManager.isVersionCompatible("1.2.0", "1.1.9"))
        assertTrue(AndroidRemoteConfigSyncManager.isVersionCompatible("2.0", "1.99"))
        assertFalse(AndroidRemoteConfigSyncManager.isVersionCompatible("1.0", "1.1"))
        assertFalse(AndroidRemoteConfigSyncManager.isVersionCompatible("1.9", "2.0"))
    }

    @Test
    fun `automation url validator permits https and blocks unsafe schemes or private hosts`() {
        val valid = AutomationRepository.validateWebsiteUrl("https://example.com")
        assertTrue(valid.isSuccess)
        assertEquals("https://example.com", valid.getOrNull())

        assertTrue(AutomationRepository.validateWebsiteUrl("javascript:alert(1)").isFailure)
        assertTrue(AutomationRepository.validateWebsiteUrl("http://example.com").isFailure)
        assertTrue(AutomationRepository.validateWebsiteUrl("https://127.0.0.1").isFailure)
        assertTrue(AutomationRepository.validateWebsiteUrl("https://169.254.169.254/latest").isFailure)
        assertTrue(AutomationRepository.validateWebsiteUrl("https://localhost:3000").isFailure)
    }

    @Test
    fun `greetings and daily summary use AM AI peer branding without Sir`() {
        listOf(6, 13, 21).forEach { hr ->
            val greeting = DailySummaryComposer.getTimeGreeting(hr)
            assertFalse(greeting.contains("Sir", ignoreCase = true))
        }
        JarvisLanguage.entries.forEach { lang ->
            assertFalse(lang.greeting.contains("Sir", ignoreCase = true))
            assertTrue(lang.greeting.isNotBlank())
        }
    }
}
