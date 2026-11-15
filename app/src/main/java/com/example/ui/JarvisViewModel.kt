package com.example.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.agents.MultiAgentSystem
import com.example.ai.AiRepository
import com.example.data.db.ChatSessionEntity
import com.example.data.db.ConversationEntity
import com.example.data.db.JarvisDatabase
import com.example.data.db.MemoryDeduplicator
import com.example.data.db.MemoryEntity
import com.example.data.db.SecurityLogEntity
import com.example.data.db.TaskEntity
import com.example.data.preferences.JarvisAccentTheme
import com.example.data.preferences.JarvisPreferencesRepository
import com.example.data.preferences.JarvisUserPreferences
import com.example.plugins.PluginManager
import com.example.productivity.ReminderParser
import com.example.productivity.ReminderScheduler
import com.example.security.SecurityAuditModule
import com.example.security.SecurityReport
import com.example.system.JarvisSystemMonitor
import com.example.system.SystemTelemetry
import com.example.voice.JarvisVoiceManager
import com.example.voice.LocalVoiceCommand
import com.example.voice.VoiceCommandParser
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

enum class ScreenDestination {
    OPENING,
    DASHBOARD,
    CHAT,
    VOICE_HUD,
    MULTI_AGENT,
    SECURITY,
    SYSTEM_TELEMETRY,
    PLUGINS,
    MEMORY_VAULT,
    PRODUCTIVITY,
    SMART_HOME,
    VISION_SCANNER,
    SETTINGS
}

data class SmartDevice(
    val id: String,
    val name: String,
    val room: String,
    val type: String, // "LIGHT", "CLIMATE", "SECURITY", "APPLIANCE"
    var isOn: Boolean,
    var value: String = ""
)

data class MemorySavedBanner(
    val summary: String,
    val savedIds: List<Long>
)

class JarvisViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val db = JarvisDatabase.getDatabase(application)
    private val memoryDao = db.memoryDao()
    private val conversationDao = db.conversationDao()
    private val chatSessionDao = db.chatSessionDao()
    private val taskDao = db.taskDao()
    private val securityLogDao = db.securityLogDao()
    private val preferencesRepo = JarvisPreferencesRepository(application)

    val voiceManager = JarvisVoiceManager(application)
    val systemMonitor = JarvisSystemMonitor(application)
    val securityModule = SecurityAuditModule(application)
    val pluginManager = PluginManager()
    val agentSystem = MultiAgentSystem()
    val aiRepository = AiRepository()

    val userPreferences: StateFlow<JarvisUserPreferences> = preferencesRepo.preferencesFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, JarvisUserPreferences())
    private var hasAppliedInitialDefaultAgent = false

    // Navigation & Screen Stack
    private val screenStack = mutableListOf<ScreenDestination>()
    private val _currentScreen = MutableStateFlow(ScreenDestination.OPENING)
    val currentScreen: StateFlow<ScreenDestination> = _currentScreen.asStateFlow()

    // Agent & Language
    private val _selectedAgent = MutableStateFlow(JarvisAgent.JARVIS_PRIME)
    val selectedAgent: StateFlow<JarvisAgent> = _selectedAgent.asStateFlow()

    private val _selectedLanguage = MutableStateFlow(JarvisLanguage.ENGLISH)
    val selectedLanguage: StateFlow<JarvisLanguage> = _selectedLanguage.asStateFlow()

    // System Telemetry
    private val _telemetry = MutableStateFlow(systemMonitor.getTelemetry())
    val telemetry: StateFlow<SystemTelemetry> = _telemetry.asStateFlow()

    // Chat Sessions
    private val _activeSessionId = MutableStateFlow(
        prefs.getString(KEY_ACTIVE_SESSION_ID, DEFAULT_SESSION_ID) ?: DEFAULT_SESSION_ID
    )
    val activeSessionId: StateFlow<String> = _activeSessionId.asStateFlow()

    val chatSessions: StateFlow<List<ChatSessionEntity>> = chatSessionDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Database Flows
    val memories: StateFlow<List<MemoryEntity>> = memoryDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val conversations: StateFlow<List<ConversationEntity>> = _activeSessionId
        .flatMapLatest { sessionId -> conversationDao.getBySession(sessionId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val tasks: StateFlow<List<TaskEntity>> = taskDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val securityLogs: StateFlow<List<SecurityLogEntity>> = securityLogDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val securityReport: StateFlow<SecurityReport> = securityModule.securityReport

    // Chat AI State
    private val _currentStreamingAiText = MutableStateFlow("")
    val currentStreamingAiText: StateFlow<String> = _currentStreamingAiText.asStateFlow()

    private val _isAiThinking = MutableStateFlow(false)
    val isAiThinking: StateFlow<Boolean> = _isAiThinking.asStateFlow()

    private val _memorySavedBanner = MutableStateFlow<MemorySavedBanner?>(null)
    val memorySavedBanner: StateFlow<MemorySavedBanner?> = _memorySavedBanner.asStateFlow()
    private var memoryBannerJob: Job? = null

    private val _continuousVoiceMode = MutableStateFlow(false)
    val continuousVoiceMode: StateFlow<Boolean> = _continuousVoiceMode.asStateFlow()

    private val _voiceErrorMessage = MutableStateFlow<String?>(null)
    val voiceErrorMessage: StateFlow<String?> = _voiceErrorMessage.asStateFlow()

    private val _micPermissionDenied = MutableStateFlow(false)
    val micPermissionDenied: StateFlow<Boolean> = _micPermissionDenied.asStateFlow()

    private val _lastVoiceCommandFeedback = MutableStateFlow<String?>(null)
    val lastVoiceCommandFeedback: StateFlow<String?> = _lastVoiceCommandFeedback.asStateFlow()

    private val _isParsingReminder = MutableStateFlow(false)
    val isParsingReminder: StateFlow<Boolean> = _isParsingReminder.asStateFlow()

    private val _reminderError = MutableStateFlow<String?>(null)
    val reminderError: StateFlow<String?> = _reminderError.asStateFlow()

    private var continuousRestartJob: Job? = null
    private var consecutiveSilenceRetries = 0
    private var activeChatJob: Job? = null

    // Terminal History
    private val _terminalHistory = MutableStateFlow<List<Pair<String, String>>>(
        listOf(
            "sysinfo" to "Stark OS 2050 Neural Kernel initialized. Telemetry Nominal.",
            "diagnostics" to "All 5 specialized agents online. Memory vault operational."
        )
    )
    val terminalHistory: StateFlow<List<Pair<String, String>>> = _terminalHistory.asStateFlow()

    // Smart Home Devices
    private val _smartDevices = MutableStateFlow(
        listOf(
            SmartDevice("dev_1", "Arc Core Ambient Lighting", "Stark Lab", "LIGHT", true, "Ice-Blue 100%"),
            SmartDevice("dev_2", "Cryo-HVAC Climate Control", "Stark Lab", "CLIMATE", true, "21.5°C"),
            SmartDevice("dev_3", "Mark 85 Armor Bay Bay-Doors", "Armor Bay", "SECURITY", true, "Armed"),
            SmartDevice("dev_4", "Perimeter Defense Shields", "Tower Perimeter", "SECURITY", true, "Active 100%"),
            SmartDevice("dev_5", "Holographic Workspace Display", "Study", "APPLIANCE", true, "Online")
        )
    )
    val smartDevices: StateFlow<List<SmartDevice>> = _smartDevices.asStateFlow()

    init {
        viewModelScope.launch {
            preferencesRepo.preferencesFlow.collect { prefsData ->
                _selectedLanguage.value = prefsData.language
                voiceManager.currentLanguage = prefsData.language
                voiceManager.speechRate = prefsData.speechRate
                voiceManager.speechPitch = prefsData.speechPitch
                if (!hasAppliedInitialDefaultAgent) {
                    _selectedAgent.value = prefsData.defaultAgent
                    hasAppliedInitialDefaultAgent = true
                }
            }
        }
        viewModelScope.launch {
            seedDefaultsIfEmpty()
            refreshTelemetryLoop()
        }
    }

    private suspend fun seedDefaultsIfEmpty() {
        if (prefs.getBoolean(KEY_DEFAULTS_SEEDED, false)) {
            return
        }

        if (memoryDao.count() == 0) {
            val initialMemories = listOf(
                MemoryEntity(key = "Owner Title", category = "PREFERENCE", content = "Address owner as 'Sir'. Maintain subtle British wit.", importance = 5),
                MemoryEntity(key = "Primary Project", category = "PROJECT", content = "Project Clean Energy & Mark 85 Autonomous Upgrades", importance = 5),
                MemoryEntity(key = "Preferred Tone", category = "PREFERENCE", content = "Polite, calm, highly intelligent, and proactive.", importance = 4),
                MemoryEntity(key = "Emergency Directive", category = "INSTRUCTION", content = "In DEFCON 1, lock armor bay and isolate neural mesh.", importance = 5)
            )
            for (m in initialMemories) {
                memoryDao.insert(m)
            }
        }

        if (taskDao.count() == 0) {
            val initialTasks = listOf(
                TaskEntity(title = "Review Mark 85 Flight Telemetry", description = "Analyze thermal dissipation on high-altitude thrusters", dueTime = "14:00 Today", priority = "HIGH", category = "TASK"),
                TaskEntity(title = "Stark Industries Board Briefing", description = "Clean energy distribution Q4 targets", dueTime = "16:30 Today", priority = "HIGH", category = "SCHEDULE"),
                TaskEntity(title = "Run Security Audit with HOMER", description = "Routine integrity scan on satellite link", dueTime = "19:00", priority = "MEDIUM", category = "REMINDER")
            )
            for (t in initialTasks) {
                taskDao.insert(t)
            }
        }

        if (securityLogDao.count() == 0) {
            securityLogDao.insert(
                SecurityLogEntity(
                    eventType = "AUTH",
                    description = "Master Stark biometric token verified. JARVIS awoke.",
                    severity = "INFO",
                    sourceAgent = "JARVIS_SECURITY"
                )
            )
        }

        ensureActiveSessionExists()
        prefs.edit().putBoolean(KEY_DEFAULTS_SEEDED, true).apply()
    }

    private suspend fun ensureActiveSessionExists() {
        val currentId = _activeSessionId.value
        if (chatSessionDao.getById(currentId) == null) {
            chatSessionDao.insert(
                ChatSessionEntity(
                    id = currentId,
                    title = if (currentId == DEFAULT_SESSION_ID) DEFAULT_SESSION_TITLE else NEW_SESSION_TITLE,
                    agentName = _selectedAgent.value.codename
                )
            )
        }
    }

    fun createNewChatSession(title: String = NEW_SESSION_TITLE): String {
        val newId = "session_${UUID.randomUUID()}"
        val now = System.currentTimeMillis()
        _activeSessionId.value = newId
        prefs.edit().putString(KEY_ACTIVE_SESSION_ID, newId).apply()
        _currentStreamingAiText.value = ""
        viewModelScope.launch {
            chatSessionDao.insert(
                ChatSessionEntity(
                    id = newId,
                    title = title,
                    agentName = _selectedAgent.value.codename,
                    createdAt = now,
                    updatedAt = now
                )
            )
        }
        return newId
    }

    fun selectChatSession(sessionId: String) {
        if (_activeSessionId.value == sessionId) return
        stopGenerating()
        _currentStreamingAiText.value = ""
        _activeSessionId.value = sessionId
        prefs.edit().putString(KEY_ACTIVE_SESSION_ID, sessionId).apply()
    }

    fun renameChatSession(sessionId: String, newTitle: String) {
        val cleaned = newTitle.trim()
        if (cleaned.isBlank()) return
        viewModelScope.launch {
            chatSessionDao.updateTitle(sessionId, cleaned, System.currentTimeMillis())
        }
    }

    fun deleteChatSession(sessionId: String) {
        viewModelScope.launch {
            conversationDao.clearSession(sessionId)
            chatSessionDao.deleteById(sessionId)
            if (_activeSessionId.value == sessionId) {
                val remaining = chatSessionDao.getAll().first()
                if (remaining.isNotEmpty()) {
                    val nextId = remaining.first().id
                    _activeSessionId.value = nextId
                    prefs.edit().putString(KEY_ACTIVE_SESSION_ID, nextId).apply()
                } else {
                    createNewChatSession()
                }
            }
        }
    }

    private fun refreshTelemetryLoop() {
        viewModelScope.launch {
            while (true) {
                _telemetry.value = systemMonitor.getTelemetry()
                delay(4000L)
            }
        }
    }

    // Navigation
    fun navigateTo(destination: ScreenDestination) {
        if (_currentScreen.value != destination) {
            screenStack.add(_currentScreen.value)
            _currentScreen.value = destination
        }
    }

    fun navigateBack(): Boolean {
        return if (screenStack.isNotEmpty()) {
            _currentScreen.value = screenStack.removeAt(screenStack.size - 1)
            true
        } else if (_currentScreen.value != ScreenDestination.DASHBOARD && _currentScreen.value != ScreenDestination.OPENING) {
            _currentScreen.value = ScreenDestination.DASHBOARD
            true
        } else {
            false
        }
    }

    fun selectAgent(agent: JarvisAgent) {
        _selectedAgent.value = agent
    }

    fun selectLanguage(lang: JarvisLanguage) {
        _selectedLanguage.value = lang
        voiceManager.currentLanguage = lang
        viewModelScope.launch { preferencesRepo.setLanguage(lang) }
    }

    fun updateDefaultAgent(agent: JarvisAgent) {
        _selectedAgent.value = agent
        viewModelScope.launch { preferencesRepo.setDefaultAgent(agent) }
    }

    fun updateSpeechRate(rate: Float) {
        val clamped = rate.coerceIn(0.5f, 2.0f)
        voiceManager.speechRate = clamped
        viewModelScope.launch { preferencesRepo.setSpeechRate(clamped) }
    }

    fun updateSpeechPitch(pitch: Float) {
        val clamped = pitch.coerceIn(0.5f, 2.0f)
        voiceManager.speechPitch = clamped
        viewModelScope.launch { preferencesRepo.setSpeechPitch(clamped) }
    }

    fun updateAutoSpeakReplies(enabled: Boolean) {
        viewModelScope.launch { preferencesRepo.setAutoSpeakReplies(enabled) }
    }

    fun updateWebSearchEnabled(enabled: Boolean) {
        viewModelScope.launch { preferencesRepo.setWebSearchEnabled(enabled) }
    }

    fun updateAutoExtractMemories(enabled: Boolean) {
        viewModelScope.launch { preferencesRepo.setAutoExtractMemories(enabled) }
    }

    fun updateAccentTheme(theme: JarvisAccentTheme) {
        viewModelScope.launch { preferencesRepo.setAccentTheme(theme) }
    }

    fun clearAllMemories() {
        viewModelScope.launch { memoryDao.clearAll() }
    }

    fun stopGenerating() {
        activeChatJob?.cancel()
        activeChatJob = null
        _isAiThinking.value = false
    }

    // Send Chat Message & AI Streaming Response
    fun sendMessage(userText: String, isVoice: Boolean = false) {
        if (userText.isBlank()) return
        val text = userText.trim()

        activeChatJob?.cancel()
        activeChatJob = viewModelScope.launch {
            val sessionId = _activeSessionId.value
            ensureActiveSessionExists()

            val historySnapshot = conversationDao.getBySession(sessionId).first()
            val existingSession = chatSessionDao.getById(sessionId)
            val isDefaultTitle = existingSession?.title == NEW_SESSION_TITLE || existingSession?.title == DEFAULT_SESSION_TITLE
            if (historySnapshot.isEmpty() || isDefaultTitle) {
                val autoTitle = buildAutoSessionTitle(text)
                chatSessionDao.updateTitle(sessionId, autoTitle, System.currentTimeMillis())
            } else {
                chatSessionDao.touch(sessionId, System.currentTimeMillis())
            }

            conversationDao.insert(
                ConversationEntity(
                    sessionId = sessionId,
                    role = "user",
                    text = text,
                    agentName = "Sir",
                    isVoice = isVoice
                )
            )

            launchStreamingReply(
                sessionId = sessionId,
                prompt = text,
                historyBeforePrompt = historySnapshot,
                isVoice = isVoice
            )
        }
    }

    fun regenerateLastResponse() {
        if (_isAiThinking.value) return
        activeChatJob?.cancel()
        activeChatJob = viewModelScope.launch {
            val sessionId = _activeSessionId.value
            val allMsgs = conversationDao.getBySession(sessionId).first()
            val lastUser = allMsgs.lastOrNull { it.role == "user" } ?: return@launch
            conversationDao.deleteSessionAfterId(sessionId, lastUser.id)
            val historyBefore = allMsgs.takeWhile { it.id != lastUser.id }

            launchStreamingReply(
                sessionId = sessionId,
                prompt = lastUser.text,
                historyBeforePrompt = historyBefore,
                isVoice = lastUser.isVoice
            )
        }
    }

    fun editAndResendMessage(message: ConversationEntity, newText: String) {
        val cleaned = newText.trim()
        if (cleaned.isBlank() || _isAiThinking.value || message.role != "user") return

        activeChatJob?.cancel()
        activeChatJob = viewModelScope.launch {
            val sessionId = message.sessionId
            val allMsgs = conversationDao.getBySession(sessionId).first()
            conversationDao.update(
                message.copy(
                    text = cleaned,
                    timestamp = System.currentTimeMillis()
                )
            )
            conversationDao.deleteSessionAfterId(sessionId, message.id)
            val historyBefore = allMsgs.takeWhile { it.id != message.id }

            launchStreamingReply(
                sessionId = sessionId,
                prompt = cleaned,
                historyBeforePrompt = historyBefore,
                isVoice = message.isVoice
            )
        }
    }

    private suspend fun launchStreamingReply(
        sessionId: String,
        prompt: String,
        historyBeforePrompt: List<ConversationEntity>,
        isVoice: Boolean
    ) {
        val memorySnapshot = memoryDao.getAll().first().take(AiRepository.MAX_MEMORY_CONTEXT_ITEMS)

        // Auto-route specialized agent if using default JARVIS Prime
        val activeAgent = if (_selectedAgent.value == JarvisAgent.JARVIS_PRIME) {
            val routed = agentSystem.routeIntent(prompt)
            if (routed != JarvisAgent.JARVIS_PRIME) {
                agentSystem.recordCollaboration(
                    from = JarvisAgent.JARVIS_PRIME,
                    to = routed,
                    action = "Sub-system Intent Delegation",
                    detail = "Prompt delegated to ${routed.designation}."
                )
            }
            routed
        } else {
            _selectedAgent.value
        }

        _isAiThinking.value = true
        _currentStreamingAiText.value = ""

        var fullText = ""
        var wasCancelled = false
        var isError = false
        val currentPrefs = userPreferences.value
        try {
            aiRepository.generateStreamingResponse(
                prompt = prompt,
                agent = activeAgent,
                language = _selectedLanguage.value,
                telemetry = _telemetry.value,
                memories = memorySnapshot,
                history = historyBeforePrompt,
                enableWebSearch = currentPrefs.webSearchEnabled || activeAgent == JarvisAgent.VERONICA_RESEARCH
            ).collect { chunk ->
                _currentStreamingAiText.value = chunk
                fullText = chunk
            }
        } catch (_: CancellationException) {
            wasCancelled = true
        } catch (e: Exception) {
            isError = true
            fullText = "Sir, an anomaly was encountered while querying the neural mesh: ${e.localizedMessage}"
        } finally {
            withContext(NonCancellable) {
                _isAiThinking.value = false
                _currentStreamingAiText.value = ""
                if (fullText.isNotBlank()) {
                    val savedText = if (wasCancelled) "$fullText\n\n[Generation stopped]" else fullText
                    val detectedError = isError || savedText.startsWith("Sir, Gemini API error") ||
                        savedText.startsWith("Sir, communication with the Gemini")
                    conversationDao.insert(
                        ConversationEntity(
                            sessionId = sessionId,
                            role = "jarvis",
                            text = savedText,
                            agentName = activeAgent.codename,
                            isVoice = isVoice,
                            isError = detectedError
                        )
                    )
                    chatSessionDao.touch(sessionId, System.currentTimeMillis())
                }
            }
        }

        if (!wasCancelled && fullText.isNotBlank()) {
            val shouldSpeak = isVoice || currentPrefs.autoSpeakReplies ||
                _currentScreen.value == ScreenDestination.VOICE_HUD ||
                _continuousVoiceMode.value
            if (shouldSpeak) {
                val queued = voiceManager.speak(fullText) {
                    if (_continuousVoiceMode.value) {
                        scheduleContinuousListenResume()
                    }
                }
                if (!queued && _continuousVoiceMode.value) {
                    scheduleContinuousListenResume(900L)
                }
            } else if (_continuousVoiceMode.value) {
                scheduleContinuousListenResume(600L)
            }
        } else if (!wasCancelled && _continuousVoiceMode.value) {
            scheduleContinuousListenResume(700L)
        }

        if (!wasCancelled && !isError && fullText.isNotBlank() && currentPrefs.autoExtractMemories && prompt.length >= 6) {
            launchAutoMemoryExtraction(prompt = prompt, reply = fullText)
        }
    }

    private fun launchAutoMemoryExtraction(prompt: String, reply: String) {
        viewModelScope.launch {
            val currentMemories = memoryDao.getAll().first()
            val extracted = aiRepository.extractDurableMemories(prompt, reply, currentMemories)
            if (extracted.isEmpty()) return@launch

            val latestMemories = memoryDao.getAll().first()
            val unique = MemoryDeduplicator.filterUniqueCandidates(extracted, latestMemories)
            if (unique.isEmpty()) return@launch

            val savedIds = mutableListOf<Long>()
            for (cand in unique) {
                val id = memoryDao.insert(
                    MemoryEntity(
                        key = cand.key,
                        category = cand.category,
                        content = cand.content,
                        importance = cand.importance
                    )
                )
                savedIds.add(id)
            }

            if (savedIds.isNotEmpty()) {
                _memorySavedBanner.value = MemorySavedBanner(
                    summary = unique.joinToString(", ") { it.key },
                    savedIds = savedIds
                )
                memoryBannerJob?.cancel()
                memoryBannerJob = viewModelScope.launch {
                    delay(6500L)
                    _memorySavedBanner.value = null
                }
            }
        }
    }

    fun undoSavedMemories(ids: List<Long>) {
        memoryBannerJob?.cancel()
        _memorySavedBanner.value = null
        viewModelScope.launch {
            for (id in ids) {
                memoryDao.deleteById(id)
            }
        }
    }

    fun dismissMemoryBanner() {
        memoryBannerJob?.cancel()
        _memorySavedBanner.value = null
    }

    // Voice recognition & Continuous Hands-Free Mode
    fun clearVoiceError() {
        _voiceErrorMessage.value = null
    }

    fun markMicPermissionDenied(denied: Boolean) {
        _micPermissionDenied.value = denied
        if (denied) {
            _continuousVoiceMode.value = false
            continuousRestartJob?.cancel()
            _voiceErrorMessage.value = "Microphone permission was denied. Please grant Microphone access in App Settings to use voice control."
        } else {
            _voiceErrorMessage.value = null
        }
    }

    fun startContinuousVoiceConversation() {
        _continuousVoiceMode.value = true
        _micPermissionDenied.value = false
        _voiceErrorMessage.value = null
        consecutiveSilenceRetries = 0
        startVoiceListening()
    }

    fun exitContinuousVoiceMode() {
        _continuousVoiceMode.value = false
        continuousRestartJob?.cancel()
        consecutiveSilenceRetries = 0
        voiceManager.stopListening()
        voiceManager.stopSpeaking()
        stopGenerating()
    }

    private fun scheduleContinuousListenResume(delayMs: Long = 350L) {
        continuousRestartJob?.cancel()
        if (!_continuousVoiceMode.value) return
        continuousRestartJob = viewModelScope.launch {
            delay(delayMs)
            if (_continuousVoiceMode.value && !_isAiThinking.value) {
                startVoiceListening()
            }
        }
    }

    fun processVoiceInput(transcript: String) {
        val cleaned = transcript.trim()
        if (cleaned.isBlank()) return
        consecutiveSilenceRetries = 0
        _voiceErrorMessage.value = null

        val localCommand = VoiceCommandParser.parse(cleaned)
        if (localCommand != null) {
            executeLocalVoiceCommand(localCommand)
        } else {
            sendMessage(cleaned, isVoice = true)
        }
    }

    private fun executeLocalVoiceCommand(command: LocalVoiceCommand) {
        when (command) {
            LocalVoiceCommand.OPEN_SECURITY -> {
                _lastVoiceCommandFeedback.value = "LOCAL CMD: Opening Security Center"
                navigateTo(ScreenDestination.SECURITY)
                speakCommandAck("Opening security perimeter matrix, Sir.")
            }
            LocalVoiceCommand.TOGGLE_LOCKDOWN -> {
                toggleLockdown()
                val locked = securityModule.isLockdownActive.value
                val msg = if (locked) {
                    "Emergency DEFCON 1 lockdown engaged, Sir."
                } else {
                    "Lockdown disengaged. Perimeter normalized, Sir."
                }
                _lastVoiceCommandFeedback.value = "LOCAL CMD: $msg"
                speakCommandAck(msg)
            }
            LocalVoiceCommand.CHECK_BATTERY -> {
                val latest = systemMonitor.getTelemetry()
                _telemetry.value = latest
                val status = if (latest.isCharging) "and currently charging" else "on battery power"
                val msg = "Battery is at ${latest.batteryLevel} percent, $status, Sir."
                _lastVoiceCommandFeedback.value = "LOCAL CMD: Battery ${latest.batteryLevel}%"
                speakCommandAck(msg)
            }
            LocalVoiceCommand.NEW_CHAT -> {
                createNewChatSession()
                _lastVoiceCommandFeedback.value = "LOCAL CMD: New neural session initialized"
                speakCommandAck("New neural chat session initialized, Sir.")
            }
            LocalVoiceCommand.STOP -> {
                _lastVoiceCommandFeedback.value = "LOCAL CMD: Stopped"
                exitContinuousVoiceMode()
            }
        }
    }

    private fun speakCommandAck(message: String) {
        val queued = voiceManager.speak(message) {
            if (_continuousVoiceMode.value) {
                scheduleContinuousListenResume()
            }
        }
        if (!queued && _continuousVoiceMode.value) {
            scheduleContinuousListenResume(800L)
        }
    }

    fun startVoiceListening() {
        _voiceErrorMessage.value = null
        _micPermissionDenied.value = false
        continuousRestartJob?.cancel()
        voiceManager.startListening(
            onResult = { resultText ->
                processVoiceInput(resultText)
            },
            onError = { errorInfo ->
                if (errorInfo.isPermissionDenied) {
                    markMicPermissionDenied(true)
                } else if (_continuousVoiceMode.value && errorInfo.isRecoverableSilence && consecutiveSilenceRetries < 2) {
                    consecutiveSilenceRetries++
                    _voiceErrorMessage.value = "${errorInfo.message} Re-engaging mic..."
                    scheduleContinuousListenResume(950L)
                } else {
                    if (_continuousVoiceMode.value && errorInfo.isRecoverableSilence) {
                        _continuousVoiceMode.value = false
                        _voiceErrorMessage.value = "No speech detected after multiple attempts. Hands-free paused — tap Hands-Free Loop to resume."
                    } else {
                        _continuousVoiceMode.value = false
                        _voiceErrorMessage.value = errorInfo.message
                    }
                }
            }
        )
    }

    fun stopVoiceListening() {
        continuousRestartJob?.cancel()
        voiceManager.stopListening()
    }

    fun stopSpeaking() {
        voiceManager.stopSpeaking()
    }

    // Terminal Execution
    fun runTerminal(command: String) {
        if (command.isBlank()) return
        val output = systemMonitor.executeTerminalCommand(command)
        val history = ArrayList(_terminalHistory.value)
        history.add(command to output)
        _terminalHistory.value = history

        // Log if sensitive
        if (command.lowercase().contains("defcon") || command.lowercase().contains("clean")) {
            viewModelScope.launch {
                securityLogDao.insert(
                    SecurityLogEntity(
                        eventType = "TOOL_EXEC",
                        description = "Terminal command '$command' executed by owner.",
                        severity = "INFO",
                        sourceAgent = "HOMER"
                    )
                )
            }
        }
    }

    // Memory CRUD
    fun addMemory(key: String, category: String, content: String, importance: Int) {
        viewModelScope.launch {
            memoryDao.insert(
                MemoryEntity(
                    key = key,
                    category = category,
                    content = content,
                    importance = importance
                )
            )
        }
    }

    fun deleteMemory(memory: MemoryEntity) {
        viewModelScope.launch {
            memoryDao.delete(memory)
        }
    }

    // Task & Smart Reminder CRUD
    fun clearReminderError() {
        _reminderError.value = null
    }

    fun createSmartReminder(naturalInput: String) {
        val cleaned = naturalInput.trim()
        if (cleaned.isBlank() || _isParsingReminder.value) return

        viewModelScope.launch {
            _isParsingReminder.value = true
            _reminderError.value = null
            try {
                val parsed = aiRepository.parseNaturalReminder(cleaned)
                val taskId = taskDao.insert(
                    TaskEntity(
                        title = parsed.title,
                        description = parsed.description,
                        dueTime = parsed.dueTime,
                        triggerAtMillis = parsed.triggerAtMillis,
                        priority = parsed.priority,
                        category = parsed.category
                    )
                )
                ReminderScheduler.scheduleReminder(
                    context = getApplication(),
                    taskId = taskId,
                    title = parsed.title,
                    dueTime = parsed.dueTime,
                    description = parsed.description,
                    triggerAtMillis = parsed.triggerAtMillis
                )
            } catch (e: Exception) {
                _reminderError.value = "Failed to schedule reminder: ${e.localizedMessage ?: "Unknown error"}"
            } finally {
                _isParsingReminder.value = false
            }
        }
    }

    fun snoozeTask(task: TaskEntity, minutes: Int = 15) {
        viewModelScope.launch {
            val nextTrigger = System.currentTimeMillis() + minutes * 60_000L
            val label = ReminderParser.formatDueLabel(nextTrigger)
            val updatedDue = "Snoozed ($label)"
            taskDao.update(
                task.copy(
                    isCompleted = false,
                    dueTime = updatedDue,
                    triggerAtMillis = nextTrigger
                )
            )
            ReminderScheduler.scheduleReminder(
                context = getApplication(),
                taskId = task.id,
                title = task.title,
                dueTime = label,
                description = task.description,
                triggerAtMillis = nextTrigger
            )
        }
    }

    fun addTask(title: String, description: String, dueTime: String, priority: String, category: String) {
        viewModelScope.launch {
            taskDao.insert(
                TaskEntity(
                    title = title,
                    description = description,
                    dueTime = dueTime,
                    priority = priority,
                    category = category
                )
            )
        }
    }

    fun toggleTask(task: TaskEntity) {
        viewModelScope.launch {
            val nextCompleted = !task.isCompleted
            taskDao.update(task.copy(isCompleted = nextCompleted))
            if (nextCompleted) {
                ReminderScheduler.cancelReminder(getApplication(), task.id)
            } else if (task.triggerAtMillis != null && task.triggerAtMillis > System.currentTimeMillis()) {
                ReminderScheduler.scheduleReminder(
                    context = getApplication(),
                    taskId = task.id,
                    title = task.title,
                    dueTime = task.dueTime,
                    description = task.description,
                    triggerAtMillis = task.triggerAtMillis
                )
            }
        }
    }

    fun deleteTask(task: TaskEntity) {
        viewModelScope.launch {
            ReminderScheduler.cancelReminder(getApplication(), task.id)
            taskDao.delete(task)
        }
    }

    // Smart Home Toggles
    fun toggleSmartDevice(deviceId: String) {
        val list = _smartDevices.value.map { dev ->
            if (dev.id == deviceId) {
                dev.copy(isOn = !dev.isOn)
            } else dev
        }
        _smartDevices.value = list
    }

    // Security Actions
    fun triggerSecurityScan() {
        securityModule.runComprehensiveScan(securityLogs.value)
        viewModelScope.launch {
            securityLogDao.insert(
                SecurityLogEntity(
                    eventType = "SCAN",
                    description = "Comprehensive defensive sweep conducted. Integrity index verified.",
                    severity = "INFO",
                    sourceAgent = "HOMER"
                )
            )
        }
    }

    fun toggleLockdown() {
        securityModule.toggleEmergencyLockdown()
        val isLocked = securityModule.isLockdownActive.value
        viewModelScope.launch {
            securityLogDao.insert(
                SecurityLogEntity(
                    eventType = "ANOMALY",
                    description = if (isLocked) "EMERGENCY DEFCON 1 LOCKDOWN ENGAGED BY OWNER." else "Lockdown disengaged. Systems normalized.",
                    severity = if (isLocked) "CRITICAL" else "INFO",
                    sourceAgent = "JARVIS_SECURITY"
                )
            )
        }
    }

    fun clearChatHistory() {
        viewModelScope.launch {
            conversationDao.clearSession(_activeSessionId.value)
        }
    }

    fun clearAllChatHistory() {
        viewModelScope.launch {
            conversationDao.clearAll()
            chatSessionDao.clearAll()
            ensureActiveSessionExists()
        }
    }

    override fun onCleared() {
        super.onCleared()
        activeChatJob?.cancel()
        voiceManager.release()
    }

    companion object {
        const val PREFS_NAME = "jarvis_prefs"
        const val KEY_DEFAULTS_SEEDED = "defaults_seeded"
        const val KEY_ACTIVE_SESSION_ID = "active_session_id"
        const val DEFAULT_SESSION_ID = "default_session"
        const val DEFAULT_SESSION_TITLE = "Primary Neural Link"
        const val NEW_SESSION_TITLE = "New Neural Session"

        fun buildAutoSessionTitle(firstMessage: String): String {
            val cleaned = firstMessage.trim().replace(Regex("\\s+"), " ")
            if (cleaned.isBlank()) return NEW_SESSION_TITLE
            return if (cleaned.length <= 42) cleaned else "${cleaned.take(39).trimEnd()}..."
        }
    }
}
