package com.example

import com.example.ai.AndroidCanonicalCommandEngine
import com.example.features.AutomationRepository
import com.example.voice.LocalVoiceCommand
import com.example.voice.VoiceCommandParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoiceCommandParserTest {

    @Test
    fun parse_recognizesAllLocalHandsFreeCommands() {
        assertEquals(LocalVoiceCommand.STOP, VoiceCommandParser.parse("Jarvis, stop listening!"))
        assertEquals(LocalVoiceCommand.OPEN_SECURITY, VoiceCommandParser.parse("Please open security center"))
        assertEquals(LocalVoiceCommand.TOGGLE_LOCKDOWN, VoiceCommandParser.parse("Engage lockdown"))
        assertEquals(LocalVoiceCommand.CHECK_BATTERY, VoiceCommandParser.parse("What's my battery level?"))
        assertEquals(LocalVoiceCommand.NEW_CHAT, VoiceCommandParser.parse("Start new chat"))
    }

    @Test
    fun parse_recognizesAmWakeWordPrefixes() {
        assertEquals(LocalVoiceCommand.OPEN_SECURITY, VoiceCommandParser.parse("hey am open security"))
        assertEquals(LocalVoiceCommand.NEW_CHAT, VoiceCommandParser.parse("am new chat"))
        assertEquals(LocalVoiceCommand.CHECK_BATTERY, VoiceCommandParser.parse("am ai what's my battery"))
    }

    @Test
    fun parse_returnsNullForGeneralQueries() {
        assertNull(VoiceCommandParser.parse("Explain quantum computing in simple terms"))
        assertNull(VoiceCommandParser.parse("   "))
    }

    @Test
    fun canonicalEngine_parsesEcosystemScreensTasksAndTimeWithoutHijackingChat() {
        val research = AndroidCanonicalCommandEngine.parse("Hey AM open research")
        assertEquals("OPEN_SCREEN", research?.intent)
        assertEquals("research", research?.screen)

        val automation = AndroidCanonicalCommandEngine.parse("open automation")
        assertEquals("OPEN_SCREEN", automation?.intent)
        assertEquals("automation", automation?.screen)

        val ultron = AndroidCanonicalCommandEngine.parse("open ultron")
        assertEquals("OPEN_SCREEN", ultron?.intent)
        assertEquals("ultron", ultron?.screen)

        val multiAi = AndroidCanonicalCommandEngine.parse("open multi ai")
        assertEquals("OPEN_SCREEN", multiAi?.intent)
        assertEquals("multi_ai", multiAi?.screen)

        val task = AndroidCanonicalCommandEngine.parse("add task Review PR")
        assertEquals("CREATE_TASK", task?.intent)
        assertEquals("Review PR", task?.title)

        val time = AndroidCanonicalCommandEngine.parse("what time is it")
        assertEquals("QUERY_TIME", time?.intent)

        assertNull(AndroidCanonicalCommandEngine.parse("Explain how Python decorators work"))
    }

    @Test
    fun automationRepository_resolvesExternalWebsitesAndSkipsInternalScreens() {
        assertEquals("Google" to "https://www.google.com", AutomationRepository.resolveWebsiteVoiceCommand("Open Google"))
        assertEquals("Google" to "https://www.google.com", AutomationRepository.resolveWebsiteVoiceCommand("गूगल खोलो"))
        assertEquals("GitHub" to "https://github.com", AutomationRepository.resolveWebsiteVoiceCommand("Hey AM open GitHub"))
        assertEquals("Flipkart" to "https://www.flipkart.com", AutomationRepository.resolveWebsiteVoiceCommand("Flipkart kholo"))

        assertNull(AutomationRepository.resolveWebsiteVoiceCommand("Open Research"))
        assertNull(AutomationRepository.resolveWebsiteVoiceCommand("Open Automation"))
        assertNull(AutomationRepository.resolveWebsiteVoiceCommand("Open Chat"))
    }
}
