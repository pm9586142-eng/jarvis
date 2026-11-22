package com.example

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
}
