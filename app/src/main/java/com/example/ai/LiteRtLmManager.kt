package com.example.ai

import android.content.Context
import android.os.StatFs
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.LogSeverity
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

data class LocalModelCatalogItem(
    val id: String,
    val name: String,
    val description: String,
    val sizeMb: Int,
    val filename: String,
    val downloadUrl: String
)

class LiteRtLmManager(private val context: Context) {
    private val TAG = "LiteRtLmManager"
    private val mutex = Mutex()
    private val engineDispatcher = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "LiteRtLmEngineThread").apply { isDaemon = true }
    }.asCoroutineDispatcher()

    private var activeEngine: Engine? = null
    private var loadedModelId: String? = null

    private val downloadClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    private val _isModelInstalled = MutableStateFlow(false)
    val isModelInstalled: StateFlow<Boolean> = _isModelInstalled.asStateFlow()

    private val _isModelLoading = MutableStateFlow(false)
    val isModelLoading: StateFlow<Boolean> = _isModelLoading.asStateFlow()

    private val _loadedModelName = MutableStateFlow<String?>(null)
    val loadedModelName: StateFlow<String?> = _loadedModelName.asStateFlow()

    private val _downloadProgress = MutableStateFlow<Float?>(null)
    val downloadProgress: StateFlow<Float?> = _downloadProgress.asStateFlow()

    private val _statusError = MutableStateFlow<String?>(null)
    val statusError: StateFlow<String?> = _statusError.asStateFlow()

    val availableModels = listOf(
        LocalModelCatalogItem(
            id = "gemma2_2b_q4",
            name = "Gemma 2 2B Q4 (On-Device)",
            description = "High-performance quantized on-device LLM optimized for Android CPU & GPU via LiteRT-LM.",
            sizeMb = 1250,
            filename = "gemma2_2b_q4.litertlm",
            downloadUrl = "https://huggingface.co/litert-community/Gemma2-2B-IT/resolve/main/gemma2-2b-it-gpu-int8.bin"
        ),
        LocalModelCatalogItem(
            id = "phi3_mini_q4",
            name = "Phi-3 Mini Q4 (On-Device)",
            description = "Compact reasoning and summarization model for offline AM AI operations.",
            sizeMb = 1420,
            filename = "phi3_mini_q4.litertlm",
            downloadUrl = "https://huggingface.co/litert-community/Phi-3.5-mini-instruct/resolve/main/phi3.5-mini-instruct_q4.litertlm"
        )
    )

    init {
        checkInstalledModels()
    }

    private fun checkInstalledModels() {
        val modelsDir = File(context.filesDir, "litert_models")
        if (!modelsDir.exists()) {
            _isModelInstalled.value = false
            return
        }
        val found = modelsDir.listFiles()?.any {
            (it.name.endsWith(".bin") || it.name.endsWith(".litert") || it.name.endsWith(".litertlm")) &&
                it.length() > 1024L * 1024L
        } == true
        _isModelInstalled.value = found
    }

    fun getModelFile(modelId: String): File {
        val modelsDir = File(context.filesDir, "litert_models").apply { mkdirs() }
        val catalogItem = availableModels.find { it.id == modelId } ?: availableModels.first()
        return File(modelsDir, catalogItem.filename)
    }

    suspend fun downloadModel(modelId: String = availableModels.first().id): Result<File> =
        withContext(engineDispatcher) {
            val catalogItem = availableModels.find { it.id == modelId } ?: availableModels.first()
            val targetFile = getModelFile(catalogItem.id)
            val tmpFile = File(targetFile.parentFile, "${targetFile.name}.part")
            try {
                val stat = StatFs(context.filesDir.absolutePath)
                val availableMb = (stat.availableBlocksLong * stat.blockSizeLong) / (1024L * 1024L)
                val requiredMb = catalogItem.sizeMb + 256L
                if (availableMb < requiredMb) {
                    val msg = "Insufficient device storage (${availableMb}MB free, requires ${requiredMb}MB)."
                    _statusError.value = msg
                    return@withContext Result.failure(IllegalStateException(msg))
                }

                _statusError.value = null
                _downloadProgress.value = 0f

                val req = Request.Builder().url(catalogItem.downloadUrl).get().build()
                downloadClient.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) {
                        val msg = "Download failed (HTTP ${resp.code})."
                        _statusError.value = msg
                        return@withContext Result.failure(IllegalStateException(msg))
                    }
                    val body = resp.body ?: return@withContext Result.failure(IllegalStateException("Empty download body."))
                    val totalBytes = body.contentLength()
                    var downloadedBytes = 0L
                    body.byteStream().use { input ->
                        FileOutputStream(tmpFile).use { output ->
                            val buffer = ByteArray(64 * 1024)
                            var read: Int
                            while (input.read(buffer).also { read = it } != -1) {
                                output.write(buffer, 0, read)
                                downloadedBytes += read
                                if (totalBytes > 0) {
                                    _downloadProgress.value = (downloadedBytes.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f)
                                }
                            }
                            output.flush()
                        }
                    }
                }
                if (targetFile.exists()) targetFile.delete()
                tmpFile.renameTo(targetFile)
                _isModelInstalled.value = true
                _downloadProgress.value = null
                Result.success(targetFile)
            } catch (e: Exception) {
                tmpFile.delete()
                _downloadProgress.value = null
                val msg = "Model download failed: ${e.localizedMessage ?: "Network error"}"
                _statusError.value = msg
                Result.failure(IllegalStateException(msg, e))
            }
        }

    suspend fun initializeEngine(modelId: String = availableModels.first().id): Boolean =
        withContext(engineDispatcher) {
            mutex.withLock {
                val file = getModelFile(modelId)
                if (!file.exists() || file.length() < 1024L * 1024L) {
                    Log.w(TAG, "Local model file missing at ${file.absolutePath}. Operating in offline command mode.")
                    _isModelInstalled.value = false
                    return@withContext false
                }

                if (activeEngine != null && loadedModelId == modelId) {
                    return@withContext true
                }

                try {
                    _isModelLoading.value = true
                    _statusError.value = null
                    activeEngine?.close()
                    activeEngine = null

                    Engine.setNativeMinLogSeverity(LogSeverity.ERROR)
                    val cacheDir = File(context.cacheDir, "litert_cache").apply { mkdirs() }
                    val engine = try {
                        Engine(
                            EngineConfig(
                                modelPath = file.absolutePath,
                                backend = Backend.GPU(),
                                cacheDir = cacheDir.absolutePath
                            )
                        ).also { it.initialize() }
                    } catch (gpuErr: Exception) {
                        Log.w(TAG, "GPU backend unavailable (${gpuErr.message}); falling back to CPU backend.")
                        Engine(
                            EngineConfig(
                                modelPath = file.absolutePath,
                                backend = Backend.CPU(),
                                cacheDir = cacheDir.absolutePath
                            )
                        ).also { it.initialize() }
                    }

                    activeEngine = engine
                    loadedModelId = modelId
                    _isModelInstalled.value = true
                    _loadedModelName.value = availableModels.find { it.id == modelId }?.name ?: "On-Device LiteRT-LM"
                    true
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to initialize LiteRT-LM engine", e)
                    _statusError.value = e.localizedMessage ?: "Engine initialization error"
                    false
                } finally {
                    _isModelLoading.value = false
                }
            }
        }

    fun generateLocalResponseStream(
        prompt: String,
        systemInstruction: String = "You are AM AI operating offline on Android. Be concise, warm, and natural without formal honorifics."
    ): Flow<String> = flow {
        val modelId = loadedModelId ?: availableModels.first().id
        val ready = if (activeEngine == null) initializeEngine(modelId) else true
        val engine = activeEngine
        if (!ready || engine == null) {
            emit(
                "Local AI model is not installed. Please open Settings > Local Models to download an offline model. " +
                    "Deterministic offline commands (time, date, tasks, notes, memory, and protocols) remain fully operational."
            )
            return@flow
        }

        val conversationConfig = ConversationConfig(
            systemInstruction = Contents.of(systemInstruction)
        )
        val accumulated = StringBuilder()
        engine.createConversation(conversationConfig).use { conversation ->
            conversation.sendMessageAsync(prompt).collect { token ->
                val chunk = token.toString()
                if (chunk.isNotEmpty()) {
                    accumulated.append(chunk)
                    emit(accumulated.toString())
                }
            }
        }
    }.flowOn(engineDispatcher)

    suspend fun generateLocalResponse(prompt: String): String = withContext(engineDispatcher) {
        val sb = StringBuilder()
        generateLocalResponseStream(prompt).collect { chunk ->
            sb.clear()
            sb.append(chunk)
        }
        sb.toString().ifBlank {
            "Local LiteRT-LM inference completed without output."
        }
    }

    suspend fun release() = withContext(engineDispatcher) {
        mutex.withLock {
            try {
                activeEngine?.close()
            } catch (_: Exception) {
                // ignore shutdown error
            }
            activeEngine = null
            loadedModelId = null
            _loadedModelName.value = null
        }
    }
}
