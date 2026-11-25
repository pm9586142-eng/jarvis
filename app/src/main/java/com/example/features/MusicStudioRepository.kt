package com.example.features

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.util.Base64
import com.example.BuildConfig
import com.example.agents.JarvisLanguage
import com.example.ai.AiRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

data class GeneratedMusicTrack(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val prompt: String,
    val mode: String,
    val audioBase64: String = "",
    val mimeType: String = "audio/mpeg",
    val lyricsAndChords: String = "",
    val sourceLabel: String = "Free Lyric & Arrangement AI",
    val createdAt: Long = System.currentTimeMillis()
)

class MusicStudioRepository(
    private val context: Context,
    private val backendUrlProvider: () -> String,
    private val accessTokenProvider: () -> String = { BuildConfig.APP_ACCESS_TOKEN.trim() },
    private val aiRepository: AiRepository
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private var mediaPlayer: MediaPlayer? = null

    suspend fun generateTrackOrComposition(
        prompt: String,
        mode: String,
        lyrics: String,
        language: JarvisLanguage
    ): Result<GeneratedMusicTrack> = withContext(Dispatchers.IO) {
        val cleanPrompt = prompt.trim()
        if (cleanPrompt.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Enter a music prompt, genre, tempo, or mood."))
        }

        val base = backendUrlProvider().trim().trimEnd('/')
        var backendBlockedReason: String? = null
        if (base.isNotBlank()) {
            try {
                val payload = JSONObject().apply {
                    put("prompt", cleanPrompt)
                    put("mode", mode)
                    if (lyrics.isNotBlank()) put("lyrics", lyrics.trim())
                }
                val req = Request.Builder()
                    .url("$base/api/music/generate")
                    .addHeader("Accept", "application/json")
                    .applyAuth()
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .build()
                http.newCall(req).execute().use { resp ->
                    val raw = resp.body?.string().orEmpty()
                    val obj = try { JSONObject(raw) } catch (_: Exception) { JSONObject() }
                    if (resp.isSuccessful) {
                        val audioB64 = obj.optString("audioBase64", "")
                        val mime = obj.optString("mimeType", "audio/mpeg")
                        val lyricText = obj.optString("lyricsText", lyrics)
                        return@withContext Result.success(
                            GeneratedMusicTrack(
                                title = cleanPrompt.take(44),
                                prompt = cleanPrompt,
                                mode = mode,
                                audioBase64 = audioB64,
                                mimeType = mime,
                                lyricsAndChords = lyricText,
                                sourceLabel = "Backend Lyria Studio"
                            )
                        )
                    } else if (obj.optString("code") == "PAID_MODEL_BLOCKED") {
                        backendBlockedReason = obj.optString("error")
                    }
                }
            } catch (_: Exception) {
                // Fall back to free AI songwriting + chord blueprint
            }
        }

        // Strict ₹0 Free Fallback: Compose complete song lyrics, chord progression, BPM, and instrumentation blueprint
        val compositionPrompt = """
            Compose a complete studio blueprint for: "$cleanPrompt" (Mode: $mode)
            ${if (lyrics.isNotBlank()) "Incorporate or refine these user lyrics:\n$lyrics" else ""}

            Include:
            - Suggested BPM, Key & Mood
            - Chord Progression (Verse / Chorus / Bridge)
            - Instrumentation & Synth Layers
            - Full Lyrics / Vocal Hook
        """.trimIndent()

        aiRepository.generateSimpleText(
            prompt = compositionPrompt,
            systemInstruction = "You are AM AI Music Studio Architect. Craft vivid, rhythmic musical compositions, chords, and lyrics. Respond in ${language.displayName}.",
            maxTokens = 1400
        ).map { arrangement ->
            val headerNote = if (!backendBlockedReason.isNullOrBlank()) {
                "Strict Free Mode Note: Raw binary Lyria-3 audio synthesis requires paid billing on backend, so AM AI generated a full free composition & arrangement blueprint instead.\n\n"
            } else {
                ""
            }
            GeneratedMusicTrack(
                title = cleanPrompt.take(44),
                prompt = cleanPrompt,
                mode = mode,
                audioBase64 = "",
                lyricsAndChords = headerNote + arrangement,
                sourceLabel = "AM Free Studio Blueprint"
            )
        }
    }

    fun playBase64Audio(audioBase64: String, onCompletion: () -> Unit = {}): Result<Unit> {
        if (audioBase64.isBlank()) {
            return Result.failure(IllegalStateException("No audio stream attached to this track."))
        }
        return runCatching {
            stopAudio()
            val bytes = Base64.decode(audioBase64, Base64.DEFAULT)
            val tempFile = File.createTempFile("amai_music_", ".mp3", context.cacheDir)
            tempFile.writeBytes(bytes)
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setDataSource(tempFile.absolutePath)
                setOnCompletionListener {
                    tempFile.delete()
                    onCompletion()
                }
                prepare()
                start()
            }
        }
    }

    fun stopAudio() {
        runCatching {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        }
        mediaPlayer = null
    }

    private fun Request.Builder.applyAuth(): Request.Builder {
        val token = accessTokenProvider().trim()
        if (token.isNotBlank() && !token.equals("UNSET", ignoreCase = true)) {
            addHeader("Authorization", "Bearer $token")
        }
        return this
    }
}
