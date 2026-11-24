package com.example.voice

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import com.example.BuildConfig
import com.example.agents.JarvisLanguage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

class JarvisVoiceManager(private val context: Context) : TextToSpeech.OnInitListener {
    private val TAG = "JarvisVoiceManager"

    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val utteranceCounter = AtomicLong(0L)
    private val sessionCounter = AtomicLong(0L)
    private val pendingUtteranceIds = ConcurrentHashMap.newKeySet<String>()
    private val doneCallbacks = ConcurrentHashMap<String, () -> Unit>()
    private val utteranceChunkIndexMap = ConcurrentHashMap<String, Int>()

    // OkHttp + MediaPlayer for free neural Laila-style expressive female TTS via AM AI backend
    private val neuralTtsClient = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(9, TimeUnit.SECONDS)
        .writeTimeout(4, TimeUnit.SECONDS)
        .build()
    private var activeNeuralCall: Call? = null
    private var mediaPlayer: MediaPlayer? = null
    private var activeNeuralAudioFile: File? = null
    private var neuralPlayActive = false

    // Chunked bilingual speech cursor for Pause / Resume and natural inter-sentence pauses
    private var activeSegments: List<SpeechFormatter.SpeechSegment> = emptyList()
    private var activeChunkIdx: Int = 0
    private var activeOnDone: (() -> Unit)? = null
    private var pendingPauseRunnable: Runnable? = null

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _isSpeechPaused = MutableStateFlow(false)
    val isSpeechPaused: StateFlow<Boolean> = _isSpeechPaused.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _currentTranscript = MutableStateFlow("")
    val currentTranscript: StateFlow<String> = _currentTranscript.asStateFlow()

    private val _audioRmsLevel = MutableStateFlow(0f)
    val audioRmsLevel: StateFlow<Float> = _audioRmsLevel.asStateFlow()

    private val _isTtsReady = MutableStateFlow(false)
    val isTtsReady: StateFlow<Boolean> = _isTtsReady.asStateFlow()

    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted.asStateFlow()

    private val _activeVoiceLabel = MutableStateFlow("Laila Soft Female")
    val activeVoiceLabel: StateFlow<String> = _activeVoiceLabel.asStateFlow()

    var speechRate: Float = 0.90f
        set(value) {
            field = value.coerceIn(0.5f, 2.0f)
            tts?.setSpeechRate(field)
        }

    var speechPitch: Float = 1.00f
        set(value) {
            field = value.coerceIn(0.5f, 2.0f)
            tts?.setPitch(calibratedLocalPitch(field))
        }

    var voiceVolume: Float = 1.0f
        set(value) {
            field = value.coerceIn(0f, 1f)
            val vol = if (_isMuted.value) 0f else field
            try {
                mediaPlayer?.setVolume(vol, vol)
            } catch (_: Exception) {
            }
        }

    var femaleVoiceEnabled: Boolean = true
    var neuralTtsEnabled: Boolean = true

    var currentLanguage: JarvisLanguage = JarvisLanguage.ENGLISH
        set(value) {
            field = value
            updateTtsLocale(value)
        }

    init {
        try {
            tts = TextToSpeech(context.applicationContext, this)
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing TTS", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            _isTtsReady.value = true
            updateTtsLocale(currentLanguage)
            tts?.setSpeechRate(speechRate)
            tts?.setPitch(calibratedLocalPitch(speechPitch))

            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    _isSpeaking.value = true
                    _isSpeechPaused.value = false
                    utteranceId?.let { id ->
                        utteranceChunkIndexMap[id]?.let { idx ->
                            activeChunkIdx = idx
                        }
                    }
                }

                override fun onDone(utteranceId: String?) {
                    if (utteranceId == null) return
                    val wasTracked = pendingUtteranceIds.remove(utteranceId)
                    val finishedIdx = utteranceChunkIndexMap.remove(utteranceId)
                    val callback = doneCallbacks.remove(utteranceId)

                    if (!wasTracked || _isSpeechPaused.value) return

                    if (finishedIdx != null) {
                        val segment = activeSegments.getOrNull(finishedIdx)
                        val nextIdx = finishedIdx + 1
                        activeChunkIdx = nextIdx.coerceAtMost(activeSegments.size)

                        if (nextIdx < activeSegments.size) {
                            val pauseMs = (segment?.pauseAfterMs ?: 0L).coerceAtLeast(0L)
                            val engine = tts
                            val done = activeOnDone ?: {}
                            if (engine != null) {
                                scheduleNextLocalSegment(engine, nextIdx, pauseMs, done)
                                return
                            }
                        }
                    }

                    if (pendingUtteranceIds.isEmpty() && !_isSpeechPaused.value) {
                        _isSpeaking.value = false
                        activeSegments = emptyList()
                        activeChunkIdx = 0
                        activeOnDone = null
                    }
                    if (callback != null && !_isSpeechPaused.value) {
                        activeOnDone = null
                        mainHandler.post { callback() }
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    handleUtteranceError(utteranceId)
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    handleUtteranceError(utteranceId)
                }
            })
        } else {
            _isTtsReady.value = false
            Log.e(TAG, "TTS Initialization failed with status: $status")
        }
    }

    private fun calibratedLocalPitch(basePitch: Float): Float {
        if (!femaleVoiceEnabled) return basePitch.coerceIn(0.5f, 2.0f)
        // Subtle natural warmth without ever sounding shrill or synthetic
        return (basePitch * 1.03f).coerceIn(0.85f, 1.25f)
    }

    private fun handleUtteranceError(utteranceId: String?) {
        val callback = utteranceId?.let { doneCallbacks.remove(it) }
        if (utteranceId != null) {
            pendingUtteranceIds.remove(utteranceId)
            utteranceChunkIndexMap.remove(utteranceId)
        }
        if (pendingUtteranceIds.isEmpty()) {
            _isSpeaking.value = false
            _isSpeechPaused.value = false
            activeSegments = emptyList()
            activeChunkIdx = 0
            activeOnDone = null
            if (callback != null) {
                mainHandler.post { callback() }
            }
        }
    }

    fun setMuted(muted: Boolean) {
        _isMuted.value = muted
        if (muted) {
            stopSpeaking()
        }
    }

    private fun updateTtsLocale(language: JarvisLanguage) {
        val targetLocale = when (language) {
            JarvisLanguage.ENGLISH -> Locale("en", "IN")
            JarvisLanguage.HINDI -> Locale("hi", "IN")
            JarvisLanguage.HINGLISH -> Locale("en", "IN")
            JarvisLanguage.GUJARATI -> Locale("gu", "IN")
        }
        applyLocale(targetLocale)
    }

    private fun applyLocale(targetLocale: Locale) {
        val engine = tts ?: return
        val selectedVoice = if (femaleVoiceEnabled) {
            selectBestFemaleVoice(engine, targetLocale)
        } else {
            null
        }
        if (selectedVoice != null) {
            engine.voice = selectedVoice
            _activeVoiceLabel.value = "${selectedVoice.name} (${targetLocale.toLanguageTag()})"
            return
        }

        val result = engine.setLanguage(targetLocale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            val fallback = if (targetLocale.language == "en") Locale.UK else Locale.US
            engine.setLanguage(fallback)
        }
    }

    private fun selectBestFemaleVoice(engine: TextToSpeech, targetLocale: Locale): Voice? {
        val availableVoices = try {
            engine.voices ?: return null
        } catch (_: Exception) {
            return null
        }
        if (availableVoices.isEmpty()) return null

        val targetLang = targetLocale.language.lowercase(Locale.ROOT)
        val targetCountry = targetLocale.country.lowercase(Locale.ROOT)

        var bestVoice: Voice? = null
        var bestScore = Int.MIN_VALUE

        for (voice in availableVoices) {
            val vLang = voice.locale?.language?.lowercase(Locale.ROOT).orEmpty()
            val vCountry = voice.locale?.country?.lowercase(Locale.ROOT).orEmpty()
            val name = voice.name.lowercase(Locale.ROOT)

            var score = 0
            if (vLang == targetLang && vCountry == targetCountry) score += 120
            else if (vLang == targetLang) score += 90
            else if (targetLang == "en" && vLang == "en") score += 75
            else score -= 120

            // Strong female voice preference across Android Google TTS / Samsung / OEM engines
            val looksFemale = name.contains("female") ||
                name.contains("swara") ||
                name.contains("neerja") ||
                name.contains("-hia") ||
                name.contains("-hid") ||
                name.contains("-hie") ||
                name.contains("-ena") ||
                name.contains("-enc") ||
                name.contains("-ene") ||
                name.contains("-iob") ||
                name.contains("-iog") ||
                name.contains("-sfg") ||
                name.contains("-tpf")
            val looksMale = name.contains("male") ||
                name.contains("prabhat") ||
                name.contains("madhur") ||
                name.contains("-hib") ||
                name.contains("-hic") ||
                name.contains("-enb") ||
                name.contains("-end")

            if (looksFemale) score += 75
            if (looksMale) score -= 70

            when {
                voice.quality >= Voice.QUALITY_VERY_HIGH -> score += 30
                voice.quality >= Voice.QUALITY_HIGH -> score += 20
                voice.quality <= Voice.QUALITY_LOW -> score -= 35
            }

            if (voice.isNetworkConnectionRequired) {
                score -= 10 // Prefer zero-latency installed female voice for local engine
            }

            if (score > bestScore) {
                bestScore = score
                bestVoice = voice
            }
        }

        return if (bestScore > 0) bestVoice else null
    }

    data class VoiceErrorInfo(
        val message: String,
        val isPermissionDenied: Boolean = false,
        val isRecoverableSilence: Boolean = false
    )

    fun speak(text: String, onDone: () -> Unit = {}): Boolean {
        if (_isMuted.value) {
            mainHandler.post { onDone() }
            return false
        }
        val spokenText = SpeechFormatter.formatTextForSpeech(text)
        if (spokenText.isBlank()) return false

        stopSpeakingInternal(clearCursor = true)
        val currentSessionId = sessionCounter.incrementAndGet()

        val segments = SpeechFormatter.splitSpeechIntoBilingualSegments(
            rawText = text,
            preferredLanguage = currentLanguage,
            maxLength = MAX_TTS_CHUNK_CHARS
        )
        if (segments.isEmpty()) return false

        activeSegments = segments
        activeChunkIdx = 0
        activeOnDone = onDone

        val backendBaseUrl = resolveConfiguredBackendUrl()
        if (neuralTtsEnabled && femaleVoiceEnabled && backendBaseUrl.isNotBlank()) {
            _isSpeaking.value = true
            _isSpeechPaused.value = false
            synthesizeAndPlayNeuralBackend(
                sessionId = currentSessionId,
                backendBaseUrl = backendBaseUrl,
                text = spokenText,
                bcp47Lang = targetLocaleTag(SpeechFormatter.resolveTtsLocale(spokenText, currentLanguage)),
                onDone = onDone
            )
            return true
        }

        return speakLocalSegmentsFromIndex(0, onDone)
    }

    private fun resolveConfiguredBackendUrl(): String {
        val raw = BuildConfig.BACKEND_URL.trim()
        if (raw.isBlank() ||
            raw.equals("unset", ignoreCase = true) ||
            raw.equals("none", ignoreCase = true) ||
            raw.equals("null", ignoreCase = true)
        ) {
            return ""
        }
        return raw.trimEnd('/')
    }

    private fun targetLocaleTag(locale: Locale): String {
        val tag = locale.toLanguageTag()
        return if (tag == "und" || tag.isBlank()) "en-IN" else tag
    }

    private fun synthesizeAndPlayNeuralBackend(
        sessionId: Long,
        backendBaseUrl: String,
        text: String,
        bcp47Lang: String,
        onDone: () -> Unit
    ) {
        val payload = JSONObject().apply {
            put("text", text.take(2350))
            put("bcp47Lang", bcp47Lang)
            put("femaleVoiceEnabled", true)
            put("autoDetectLanguage", true)
            put("rate", speechRate.toDouble())
            put("pitch", speechPitch.toDouble())
            put("stylePreset", "laila_soft")
            put("responseFormat", "mp3")
        }

        val requestBuilder = Request.Builder()
            .url("$backendBaseUrl/api/tts/synthesize")
            .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
        val accessToken = BuildConfig.APP_ACCESS_TOKEN.trim().takeUnless {
            it.isBlank() ||
                it.equals("unset", ignoreCase = true) ||
                it.equals("none", ignoreCase = true) ||
                it.equals("null", ignoreCase = true)
        }
        if (!accessToken.isNullOrBlank()) {
            requestBuilder.addHeader("Authorization", "Bearer $accessToken")
        }
        val request = requestBuilder.build()

        val call = neuralTtsClient.newCall(request)
        activeNeuralCall = call
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (activeNeuralCall == call) activeNeuralCall = null
                if (call.isCanceled() || sessionId != sessionCounter.get() || _isMuted.value) return
                Log.w(TAG, "Neural TTS unreachable, using local female TTS fallback: ${e.message}")
                mainHandler.post {
                    if (sessionId == sessionCounter.get() && !_isMuted.value) {
                        speakLocalSegmentsFromIndex(0, onDone)
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                if (activeNeuralCall == call) activeNeuralCall = null
                if (sessionId != sessionCounter.get() || _isMuted.value) {
                    response.close()
                    return
                }

                val voicesHeader = response.header("X-Tts-Voices").orEmpty()
                val bytes = response.use { resp ->
                    val contentType = resp.header("Content-Type").orEmpty()
                    if (!resp.isSuccessful || !contentType.contains("audio", ignoreCase = true)) {
                        null
                    } else {
                        resp.body?.bytes()
                    }
                }
                if (bytes == null || bytes.isEmpty()) {
                    mainHandler.post {
                        if (sessionId == sessionCounter.get() && !_isMuted.value) {
                            speakLocalSegmentsFromIndex(0, onDone)
                        }
                    }
                    return
                }

                try {
                    val tempFile = File(context.cacheDir, "am_ai_neural_${sessionId}.mp3")
                    tempFile.writeBytes(bytes)
                    mainHandler.post {
                        if (sessionId != sessionCounter.get() || _isMuted.value) {
                            tempFile.delete()
                            return@post
                        }
                        if (voicesHeader.isNotBlank()) {
                            _activeVoiceLabel.value = "$voicesHeader (Laila Neural)"
                        }
                        playNeuralAudioFile(sessionId, tempFile, onDone)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed writing neural TTS cache file", e)
                    mainHandler.post {
                        if (sessionId == sessionCounter.get() && !_isMuted.value) {
                            speakLocalSegmentsFromIndex(0, onDone)
                        }
                    }
                }
            }
        })
    }

    private fun playNeuralAudioFile(sessionId: Long, audioFile: File, onDone: () -> Unit) {
        cleanupMediaPlayer()
        activeNeuralAudioFile = audioFile
        try {
            val vol = if (_isMuted.value) 0f else voiceVolume
            val player = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                AudioAttributes.USAGE_ASSISTANT
                            } else {
                                AudioAttributes.USAGE_MEDIA
                            }
                        )
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                setDataSource(audioFile.absolutePath)
                setVolume(vol, vol)
                setOnPreparedListener { mp ->
                    if (sessionId != sessionCounter.get() || _isMuted.value) {
                        cleanupMediaPlayer()
                        return@setOnPreparedListener
                    }
                    neuralPlayActive = true
                    _isSpeaking.value = true
                    _isSpeechPaused.value = false
                    mp.start()
                }
                setOnCompletionListener {
                    neuralPlayActive = false
                    cleanupMediaPlayer()
                    if (sessionId == sessionCounter.get()) {
                        _isSpeaking.value = false
                        _isSpeechPaused.value = false
                        activeSegments = emptyList()
                        activeChunkIdx = 0
                        activeOnDone = null
                        onDone()
                    }
                }
                setOnErrorListener { _, _, _ ->
                    neuralPlayActive = false
                    cleanupMediaPlayer()
                    if (sessionId == sessionCounter.get() && !_isMuted.value) {
                        speakLocalSegmentsFromIndex(0, onDone)
                    }
                    true
                }
                prepareAsync()
            }
            mediaPlayer = player
        } catch (e: Exception) {
            Log.w(TAG, "MediaPlayer neural TTS error, falling back to local TTS", e)
            cleanupMediaPlayer()
            speakLocalSegmentsFromIndex(0, onDone)
        }
    }

    private fun speakLocalSegmentsFromIndex(startIdx: Int, onDone: () -> Unit): Boolean {
        val engine = tts
        if (!_isTtsReady.value || engine == null || startIdx >= activeSegments.size) {
            _isSpeaking.value = false
            _isSpeechPaused.value = false
            return false
        }

        val segment = activeSegments[startIdx]
        activeChunkIdx = startIdx
        applyLocale(segment.locale)
        engine.setSpeechRate(speechRate)
        engine.setPitch(calibratedLocalPitch(speechPitch))

        val sessionPrefix = "jarvis_${System.currentTimeMillis()}_${utteranceCounter.incrementAndGet()}"
        val utteranceId = "${sessionPrefix}_$startIdx"
        val isLast = startIdx == activeSegments.lastIndex
        val effectiveVolume = if (_isMuted.value) 0f else voiceVolume

        pendingUtteranceIds.add(utteranceId)
        utteranceChunkIndexMap[utteranceId] = startIdx
        if (isLast) {
            doneCallbacks[utteranceId] = onDone
        }

        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, effectiveVolume)
        }

        val result = engine.speak(segment.text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
        if (result == TextToSpeech.SUCCESS) {
            _isSpeechPaused.value = false
            _isSpeaking.value = true
            return true
        }

        pendingUtteranceIds.remove(utteranceId)
        utteranceChunkIndexMap.remove(utteranceId)
        doneCallbacks.remove(utteranceId)
        _isSpeaking.value = false
        return false
    }

    private fun scheduleNextLocalSegment(
        engine: TextToSpeech,
        nextIdx: Int,
        pauseMs: Long,
        onDone: () -> Unit
    ) {
        cancelPendingPauseRunnable()
        val runnable = Runnable {
            pendingPauseRunnable = null
            if (!_isSpeechPaused.value && !_isMuted.value && nextIdx < activeSegments.size) {
                speakLocalSegmentsFromIndex(nextIdx, onDone)
            }
        }
        pendingPauseRunnable = runnable
        if (pauseMs > 0L) {
            mainHandler.postDelayed(runnable, pauseMs)
        } else {
            mainHandler.post(runnable)
        }
    }

    fun pauseSpeaking() {
        if (!_isSpeaking.value && activeSegments.isEmpty() && !neuralPlayActive) return
        _isSpeechPaused.value = true
        cancelPendingPauseRunnable()

        val mp = mediaPlayer
        if (neuralPlayActive && mp != null) {
            try {
                if (mp.isPlaying) mp.pause()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to pause MediaPlayer TTS", e)
            }
            _isSpeaking.value = false
            return
        }

        pendingUtteranceIds.clear()
        doneCallbacks.clear()
        utteranceChunkIndexMap.clear()
        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to pause TTS", e)
        }
        _isSpeaking.value = false
    }

    fun resumeSpeaking(): Boolean {
        if (!_isSpeechPaused.value || _isMuted.value) return false

        val mp = mediaPlayer
        if (neuralPlayActive && mp != null) {
            return try {
                _isSpeechPaused.value = false
                _isSpeaking.value = true
                mp.start()
                true
            } catch (e: Exception) {
                Log.e(TAG, "Failed to resume MediaPlayer TTS", e)
                false
            }
        }

        if (activeSegments.isEmpty()) return false
        val callback = activeOnDone ?: {}
        val resumeIndex = activeChunkIdx.coerceIn(0, activeSegments.lastIndex)
        return speakLocalSegmentsFromIndex(resumeIndex, callback)
    }

    fun stopSpeaking() {
        stopSpeakingInternal(clearCursor = true)
    }

    private fun stopSpeakingInternal(clearCursor: Boolean) {
        sessionCounter.incrementAndGet()
        cancelPendingPauseRunnable()
        try {
            activeNeuralCall?.cancel()
        } catch (_: Exception) {
        }
        activeNeuralCall = null
        neuralPlayActive = false
        cleanupMediaPlayer()

        pendingUtteranceIds.clear()
        doneCallbacks.clear()
        utteranceChunkIndexMap.clear()
        if (clearCursor) {
            activeSegments = emptyList()
            activeChunkIdx = 0
            activeOnDone = null
            _isSpeechPaused.value = false
        }
        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop TTS", e)
        }
        _isSpeaking.value = false
    }

    private fun cancelPendingPauseRunnable() {
        pendingPauseRunnable?.let { mainHandler.removeCallbacks(it) }
        pendingPauseRunnable = null
    }

    private fun cleanupMediaPlayer() {
        try {
            mediaPlayer?.stop()
        } catch (_: Exception) {
        }
        try {
            mediaPlayer?.release()
        } catch (_: Exception) {
        }
        mediaPlayer = null
        try {
            activeNeuralAudioFile?.delete()
        } catch (_: Exception) {
        }
        activeNeuralAudioFile = null
    }

    fun startListening(onResult: (String) -> Unit, onError: (VoiceErrorInfo) -> Unit) {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError(
                VoiceErrorInfo(
                    message = "Speech recognition service isn't available on this device. You can still type commands in Neural Chat."
                )
            )
            return
        }

        runOnMain {
            stopSpeaking()
            destroySpeechRecognizerInternal()

            try {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context.applicationContext).apply {
                    setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {
                            _isListening.value = true
                            _currentTranscript.value = ""
                        }

                        override fun onBeginningOfSpeech() {
                            _audioRmsLevel.value = 0.5f
                        }

                        override fun onRmsChanged(rmsdB: Float) {
                            val normalized = ((rmsdB + 2f) / 12f).coerceIn(0.1f, 1.0f)
                            _audioRmsLevel.value = normalized
                        }

                        override fun onBufferReceived(buffer: ByteArray?) {}

                        override fun onEndOfSpeech() {
                            _isListening.value = false
                            _audioRmsLevel.value = 0.1f
                        }

                        override fun onError(error: Int) {
                            _isListening.value = false
                            _audioRmsLevel.value = 0f
                            val errorInfo = when (error) {
                                SpeechRecognizer.ERROR_AUDIO -> VoiceErrorInfo(
                                    "I couldn't access the microphone audio stream. Please check that no other app is using it."
                                )
                                SpeechRecognizer.ERROR_CLIENT -> VoiceErrorInfo(
                                    "Voice listener was interrupted. Tap the mic to start again."
                                )
                                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> VoiceErrorInfo(
                                    "Microphone permission is required for voice control. Grant mic access in App Settings.",
                                    isPermissionDenied = true
                                )
                                SpeechRecognizer.ERROR_NETWORK,
                                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> VoiceErrorInfo(
                                    "Voice recognition needs an active network connection right now."
                                )
                                SpeechRecognizer.ERROR_NO_MATCH -> VoiceErrorInfo(
                                    "I didn't catch that, Sir. Please try speaking a little closer to the mic.",
                                    isRecoverableSilence = true
                                )
                                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> VoiceErrorInfo(
                                    "Speech recognizer is currently busy. Please try again in a moment."
                                )
                                SpeechRecognizer.ERROR_SERVER -> VoiceErrorInfo(
                                    "The speech recognition server is temporarily unavailable."
                                )
                                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> VoiceErrorInfo(
                                    "No speech was heard before timeout. Ready whenever you are, Sir.",
                                    isRecoverableSilence = true
                                )
                                else -> VoiceErrorInfo(
                                    "Voice recognition encountered an issue (code $error). Please try again."
                                )
                            }
                            _currentTranscript.value = ""
                            destroySpeechRecognizerInternal()
                            onError(errorInfo)
                        }

                        override fun onResults(results: Bundle?) {
                            _isListening.value = false
                            _audioRmsLevel.value = 0f
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull().orEmpty().trim()
                            destroySpeechRecognizerInternal()
                            if (text.isNotBlank()) {
                                _currentTranscript.value = text
                                onResult(text)
                            } else {
                                onError(
                                    VoiceErrorInfo(
                                        "No clear speech detected. Tap the mic to try again.",
                                        isRecoverableSilence = true
                                    )
                                )
                            }
                        }

                        override fun onPartialResults(partialResults: Bundle?) {
                            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val text = matches?.firstOrNull().orEmpty()
                            if (text.isNotBlank()) {
                                _currentTranscript.value = text
                            }
                        }

                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                }

                val sttLang = when (currentLanguage) {
                    JarvisLanguage.ENGLISH -> "en-US"
                    JarvisLanguage.HINDI -> "hi-IN"
                    JarvisLanguage.HINGLISH -> "en-IN"
                    JarvisLanguage.GUJARATI -> "gu-IN"
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, sttLang)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, sttLang)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                }
                speechRecognizer?.startListening(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start speech recognition", e)
                _isListening.value = false
                destroySpeechRecognizerInternal()
                onError(
                    VoiceErrorInfo(
                        message = "Failed to initiate voice input: ${e.localizedMessage ?: "Unknown error"}"
                    )
                )
            }
        }
    }

    fun stopListening() {
        runOnMain {
            destroySpeechRecognizerInternal()
        }
    }

    private fun destroySpeechRecognizerInternal() {
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to destroy speech recognizer", e)
        }
        speechRecognizer = null
        _isListening.value = false
        _audioRmsLevel.value = 0f
    }

    private fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            mainHandler.post(block)
        }
    }

    fun release() {
        stopSpeaking()
        stopListening()
        tts?.shutdown()
        tts = null
    }

    companion object {
        const val MAX_TTS_CHUNK_CHARS = 340

        fun splitTextIntoChunks(text: String, maxLength: Int = MAX_TTS_CHUNK_CHARS): List<String> =
            SpeechFormatter.splitSpeechIntoChunks(text, maxLength)
    }
}
