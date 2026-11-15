package com.example.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.example.agents.JarvisLanguage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

class JarvisVoiceManager(private val context: Context) : TextToSpeech.OnInitListener {
    private val TAG = "JarvisVoiceManager"

    private var tts: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val utteranceCounter = AtomicLong(0L)
    private val pendingUtteranceIds = ConcurrentHashMap.newKeySet<String>()
    private val doneCallbacks = ConcurrentHashMap<String, () -> Unit>()

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _currentTranscript = MutableStateFlow("")
    val currentTranscript: StateFlow<String> = _currentTranscript.asStateFlow()

    private val _audioRmsLevel = MutableStateFlow(0f)
    val audioRmsLevel: StateFlow<Float> = _audioRmsLevel.asStateFlow()

    private val _isTtsReady = MutableStateFlow(false)
    val isTtsReady: StateFlow<Boolean> = _isTtsReady.asStateFlow()

    var speechRate: Float = 1.0f
        set(value) {
            field = value.coerceIn(0.5f, 2.0f)
            tts?.setSpeechRate(field)
        }

    var speechPitch: Float = 1.0f
        set(value) {
            field = value.coerceIn(0.5f, 2.0f)
            tts?.setPitch(field)
        }

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
            tts?.setPitch(speechPitch)

            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    _isSpeaking.value = true
                }

                override fun onDone(utteranceId: String?) {
                    if (utteranceId != null) {
                        pendingUtteranceIds.remove(utteranceId)
                    }
                    if (pendingUtteranceIds.isEmpty()) {
                        _isSpeaking.value = false
                    }
                    val callback = utteranceId?.let { doneCallbacks.remove(it) }
                    if (callback != null) {
                        mainHandler.post { callback() }
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    if (utteranceId != null) {
                        pendingUtteranceIds.remove(utteranceId)
                        doneCallbacks.remove(utteranceId)
                    }
                    if (pendingUtteranceIds.isEmpty()) {
                        _isSpeaking.value = false
                    }
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    if (utteranceId != null) {
                        pendingUtteranceIds.remove(utteranceId)
                        doneCallbacks.remove(utteranceId)
                    }
                    if (pendingUtteranceIds.isEmpty()) {
                        _isSpeaking.value = false
                    }
                }
            })
        } else {
            _isTtsReady.value = false
            Log.e(TAG, "TTS Initialization failed with status: $status")
        }
    }

    private fun updateTtsLocale(language: JarvisLanguage) {
        val targetLocale = when (language) {
            JarvisLanguage.ENGLISH -> Locale.UK
            JarvisLanguage.HINDI -> Locale("hi", "IN")
            JarvisLanguage.GUJARATI -> Locale("gu", "IN")
        }
        val result = tts?.setLanguage(targetLocale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            tts?.setLanguage(Locale.US)
        }
    }

    data class VoiceErrorInfo(
        val message: String,
        val isPermissionDenied: Boolean = false,
        val isRecoverableSilence: Boolean = false
    )

    fun speak(text: String, onDone: () -> Unit = {}): Boolean {
        if (!_isTtsReady.value || text.isBlank()) return false
        val engine = tts ?: return false

        stopSpeaking()

        val chunks = splitTextIntoChunks(text, MAX_TTS_CHUNK_CHARS)
        if (chunks.isEmpty()) return false

        var queuedSuccessfully = false
        val sessionPrefix = "jarvis_${System.currentTimeMillis()}_${utteranceCounter.incrementAndGet()}"

        chunks.forEachIndexed { index, chunk ->
            val utteranceId = "${sessionPrefix}_$index"
            val isLast = index == chunks.lastIndex
            pendingUtteranceIds.add(utteranceId)
            if (isLast) {
                doneCallbacks[utteranceId] = onDone
            }

            val params = Bundle().apply {
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            }
            val queueMode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            val result = engine.speak(chunk, queueMode, params, utteranceId)
            if (result == TextToSpeech.SUCCESS) {
                queuedSuccessfully = true
            } else {
                pendingUtteranceIds.remove(utteranceId)
                doneCallbacks.remove(utteranceId)
            }
        }

        _isSpeaking.value = queuedSuccessfully
        return queuedSuccessfully
    }

    fun stopSpeaking() {
        pendingUtteranceIds.clear()
        doneCallbacks.clear()
        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop TTS", e)
        }
        _isSpeaking.value = false
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

        stopSpeaking()
        stopListening()

        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        _isListening.value = true
                        _currentTranscript.value = "Listening..."
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
                        onError(errorInfo)
                    }

                    override fun onResults(results: Bundle?) {
                        _isListening.value = false
                        _audioRmsLevel.value = 0f
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull() ?: ""
                        if (text.isNotBlank()) {
                            _currentTranscript.value = text
                            onResult(text)
                        }
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull() ?: ""
                        if (text.isNotBlank()) {
                            _currentTranscript.value = text
                        }
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, when (currentLanguage) {
                    JarvisLanguage.ENGLISH -> "en-US"
                    JarvisLanguage.HINDI -> "hi-IN"
                    JarvisLanguage.GUJARATI -> "gu-IN"
                })
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            }
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start speech recognition", e)
            _isListening.value = false
            onError(
                VoiceErrorInfo(
                    message = "Failed to initiate voice input: ${e.localizedMessage ?: "Unknown error"}"
                )
            )
        }
    }

    fun stopListening() {
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to destroy speech recognizer", e)
        }
        speechRecognizer = null
        _isListening.value = false
        _audioRmsLevel.value = 0f
    }

    fun release() {
        stopSpeaking()
        stopListening()
        tts?.shutdown()
        tts = null
    }

    companion object {
        const val MAX_TTS_CHUNK_CHARS = 3800

        fun splitTextIntoChunks(text: String, maxLength: Int = MAX_TTS_CHUNK_CHARS): List<String> {
            val cleaned = text.trim()
            if (cleaned.isEmpty()) return emptyList()
            if (cleaned.length <= maxLength) return listOf(cleaned)

            val chunks = mutableListOf<String>()
            var start = 0
            while (start < cleaned.length) {
                val end = (start + maxLength).coerceAtMost(cleaned.length)
                if (end == cleaned.length) {
                    chunks.add(cleaned.substring(start).trim())
                    break
                }
                var splitAt = -1
                for (delim in charArrayOf('.', '!', '?', '\n', ' ')) {
                    val idx = cleaned.lastIndexOf(delim, end - 1)
                    if (idx > start + maxLength / 2) {
                        splitAt = idx + 1
                        break
                    }
                }
                if (splitAt <= start) splitAt = end
                val piece = cleaned.substring(start, splitAt).trim()
                if (piece.isNotEmpty()) chunks.add(piece)
                start = splitAt
            }
            return chunks
        }
    }
}
