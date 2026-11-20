package com.example

import com.example.agents.JarvisLanguage
import com.example.media.YouTubeRepository
import com.example.media.YouTubeSearchMode
import com.example.media.YouTubeVoiceCommand
import com.example.media.YouTubeVoiceCommandParser
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class YouTubeMediaIntegrationTest {

    @Test
    fun `parses English, Hindi Devanagari, and Hinglish YouTube voice commands accurately`() {
        assertEquals(YouTubeVoiceCommand.OpenYouTube, YouTubeVoiceCommandParser.parse("Hey JARVIS, open YouTube."))
        assertEquals(YouTubeVoiceCommand.OpenYouTube, YouTubeVoiceCommandParser.parse("जार्विस, यूट्यूब खोलो।"))

        val searchEn = YouTubeVoiceCommandParser.parse("Search Arijit Singh songs.") as YouTubeVoiceCommand.SearchYouTube
        assertEquals("arijit singh songs", searchEn.query)
        assertEquals(YouTubeSearchMode.MUSIC, searchEn.mode)

        val searchHinglish = YouTubeVoiceCommandParser.parse("JARVIS YouTube par songs search karo.") as YouTubeVoiceCommand.SearchYouTube
        assertEquals("songs", searchHinglish.query)

        val playHi = YouTubeVoiceCommandParser.parse("अरिजीत सिंह के गाने चलाओ।") as YouTubeVoiceCommand.PlayQuery
        assertTrue(playHi.query.contains("अरिजीत सिंह"))
        assertEquals(YouTubeSearchMode.MUSIC, playHi.mode)

        val playHinglish = YouTubeVoiceCommandParser.parse("Arijit Singh ka latest song chalao.") as YouTubeVoiceCommand.PlayQuery
        assertEquals(YouTubeSearchMode.MUSIC, playHinglish.mode)

        assertEquals(YouTubeVoiceCommand.SelectIndex(0), YouTubeVoiceCommandParser.parse("Play the first video."))
        assertEquals(YouTubeVoiceCommand.SelectIndex(0), YouTubeVoiceCommandParser.parse("पहला वीडियो चलाओ।"))

        assertEquals(YouTubeVoiceCommand.NextVideo, YouTubeVoiceCommandParser.parse("Play the next video."))
        assertEquals(YouTubeVoiceCommand.NextVideo, YouTubeVoiceCommandParser.parse("अगला वीडियो चलाओ।"))
        assertEquals(YouTubeVoiceCommand.NextVideo, YouTubeVoiceCommandParser.parse("Next video play karo."))

        assertEquals(YouTubeVoiceCommand.Pause, YouTubeVoiceCommandParser.parse("Pause the video."))
        assertEquals(YouTubeVoiceCommand.Pause, YouTubeVoiceCommandParser.parse("वीडियो रोक दो।"))
        assertEquals(YouTubeVoiceCommand.Pause, YouTubeVoiceCommandParser.parse("Video pause karo."))

        assertEquals(YouTubeVoiceCommand.Resume, YouTubeVoiceCommandParser.parse("Resume playback."))
        assertEquals(YouTubeVoiceCommand.Resume, YouTubeVoiceCommandParser.parse("वीडियो फिर से चलाओ।"))

        assertEquals(YouTubeVoiceCommand.Stop, YouTubeVoiceCommandParser.parse("Stop the video."))
        assertEquals(YouTubeVoiceCommand.Stop, YouTubeVoiceCommandParser.parse("वीडियो बंद कर दो।"))

        assertEquals(YouTubeVoiceCommand.VolumeUp, YouTubeVoiceCommandParser.parse("Increase volume."))
        assertEquals(YouTubeVoiceCommand.VolumeUp, YouTubeVoiceCommandParser.parse("आवाज बढ़ाओ।"))
        assertEquals(YouTubeVoiceCommand.VolumeDown, YouTubeVoiceCommandParser.parse("Decrease volume."))
        assertEquals(YouTubeVoiceCommand.VolumeDown, YouTubeVoiceCommandParser.parse("आवाज कम करो।"))
        assertEquals(YouTubeVoiceCommand.SetVolume(100), YouTubeVoiceCommandParser.parse("Volume full kar do."))

        assertEquals(YouTubeVoiceCommand.Mute, YouTubeVoiceCommandParser.parse("Mute the video."))
        assertEquals(YouTubeVoiceCommand.Mute, YouTubeVoiceCommandParser.parse("आवाज बंद करो।"))
        assertEquals(YouTubeVoiceCommand.Unmute, YouTubeVoiceCommandParser.parse("Unmute the video."))
        assertEquals(YouTubeVoiceCommand.Unmute, YouTubeVoiceCommandParser.parse("आवाज चालू करो।"))

        assertEquals(YouTubeVoiceCommand.SeekForward(10), YouTubeVoiceCommandParser.parse("Skip forward 10 seconds."))
        assertEquals(YouTubeVoiceCommand.SeekForward(10), YouTubeVoiceCommandParser.parse("दस सेकंड आगे करो।"))
        assertEquals(YouTubeVoiceCommand.SeekBackward(10), YouTubeVoiceCommandParser.parse("Go back 10 seconds."))
        assertEquals(YouTubeVoiceCommand.SeekBackward(10), YouTubeVoiceCommandParser.parse("दस सेकंड पीछे करो।"))

        assertEquals(YouTubeVoiceCommand.PlayDifferent, YouTubeVoiceCommandParser.parse("Play a different song."))
        assertEquals(YouTubeVoiceCommand.PlayDifferent, YouTubeVoiceCommandParser.parse("कोई दूसरा गाना चलाओ।"))

        assertEquals(YouTubeVoiceCommand.ToggleFullscreen(true), YouTubeVoiceCommandParser.parse("Turn on fullscreen."))
        assertEquals(YouTubeVoiceCommand.ToggleFullscreen(false), YouTubeVoiceCommandParser.parse("Exit fullscreen"))

        // Conversational prompts must not be hijacked
        assertNull(YouTubeVoiceCommandParser.parse("Explain quantum physics in simple terms"))
        assertNull(YouTubeVoiceCommandParser.parse("Looking forward to working with you"))
    }

    @Test
    fun `bilingualReply selects Hindi for Devanagari input or Hindi language mode`() {
        val hiReply = YouTubeVoiceCommandParser.bilingualReply(
            english = "Video paused.",
            hindi = "वीडियो रोक दिया है।",
            rawText = "वीडियो रोक दो।",
            selectedLanguage = JarvisLanguage.ENGLISH
        )
        assertEquals("वीडियो रोक दिया है।", hiReply)

        val enReply = YouTubeVoiceCommandParser.bilingualReply(
            english = "Video paused.",
            hindi = "वीडियो रोक दिया है।",
            rawText = "Pause the video.",
            selectedLanguage = JarvisLanguage.ENGLISH
        )
        assertEquals("Video paused.", enReply)
    }

    @Test
    fun `YouTubeRepository extracts video IDs, parses backend JSON with stats and pagination, and handles unset backend`() = runTest {
        assertEquals("BddP6PYo2gs", YouTubeRepository.extractVideoIdFromInput("https://www.youtube.com/watch?v=BddP6PYo2gs"))
        assertEquals("BddP6PYo2gs", YouTubeRepository.extractVideoIdFromInput("https://youtu.be/BddP6PYo2gs?si=abc"))
        assertEquals("BddP6PYo2gs", YouTubeRepository.extractVideoIdFromInput("BddP6PYo2gs"))
        assertNull(YouTubeRepository.extractVideoIdFromInput("Arijit Singh songs"))

        assertEquals("2.5M", YouTubeRepository.formatCompactCount(2_500_000L))
        assertEquals("14K", YouTubeRepository.formatCompactCount(14_000L))
        assertEquals("4:28", YouTubeRepository.formatDuration(268))

        val sampleJson = """
            {
              "ok": true,
              "configured": true,
              "query": "Kesariya",
              "nextPageToken": "CAoQAA",
              "prevPageToken": null,
              "totalResults": 500,
              "fallbackUrl": "https://www.youtube.com/results?search_query=Kesariya",
              "items": [
                {
                  "videoId": "BddP6PYo2gs",
                  "title": "Kesariya - Brahmastra",
                  "channelTitle": "Sony Music India",
                  "thumbnailUrl": "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg",
                  "durationText": "4:28",
                  "durationSeconds": 268,
                  "viewCount": 520000000,
                  "likeCount": 4200000,
                  "embeddable": true
                }
              ]
            }
        """.trimIndent()

        val parsed = YouTubeRepository.parseSearchResponseJson(sampleJson, "Kesariya", YouTubeSearchMode.MUSIC)
        assertTrue(parsed.ok)
        assertEquals(1, parsed.items.size)
        assertEquals("BddP6PYo2gs", parsed.items[0].videoId)
        assertEquals(520_000_000L, parsed.items[0].viewCount)
        assertEquals("CAoQAA", parsed.nextPageToken)
        assertNull(parsed.prevPageToken)

        // When BACKEND_URL is unset, returns clean graceful fallback instead of crashing
        val unsetRepo = YouTubeRepository(backendUrlProvider = { "" })
        val fallback = unsetRepo.search("Arijit Singh", YouTubeSearchMode.MUSIC)
        assertFalse(fallback.ok)
        assertFalse(fallback.configured)
        assertEquals("BACKEND_URL_UNSET", fallback.code)
        assertTrue(fallback.fallbackUrl.startsWith("https://www.youtube.com/results?search_query="))
    }
}
