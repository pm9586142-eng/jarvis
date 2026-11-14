package com.example.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.agents.MultiAgentSystem
import com.example.ai.AiRepository
import com.example.data.db.ConversationEntity
import com.example.data.db.JarvisDatabase
import com.example.data.db.MemoryEntity
import com.example.data.db.SecurityLogEntity
import com.example.data.db.TaskEntity
import com.example.plugins.PluginManager
import com.example.security.SecurityAuditModule
import com.example.security.SecurityReport
import com.example.system.JarvisSystemMonitor
import com.example.system.SystemTelemetry
import com.example.voice.JarvisVoiceManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

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

class JarvisViewModel(application: Application) : AndroidViewModel(application) {

    private val db = JarvisDatabase.getDatabase(application)
    private val memoryDao = db.memoryDao()
    private val conversationDao = db.conversationDao()
    private val taskDao = db.taskDao()
    private val securityLogDao = db.securityLogDao()

    val voiceManager = JarvisVoiceManager(application)
    val systemMonitor = JarvisSystemMonitor(application)
    val securityModule = SecurityAuditModule(application)
    val pluginManager = PluginManager()
    val agentSystem = MultiAgentSystem()
    val aiRepository = AiRepository()

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

    // Database Flows
    val memories: StateFlow<List<MemoryEntity>> = memoryDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val conversations: StateFlow<List<ConversationEntity>> = conversationDao.getAll()
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
        // Seed initial memories and sample tasks if database is fresh
        viewModelScope.launch {
            seedDefaultsIfEmpty()
            refreshTelemetryLoop()
        }
    }

    private suspend fun seedDefaultsIfEmpty() {
        val initialMemories = listOf(
            MemoryEntity(key = "Owner Title", category = "PREFERENCE", content = "Address owner as 'Sir'. Maintain subtle British wit.", importance = 5),
            MemoryEntity(key = "Primary Project", category = "PROJECT", content = "Project Clean Energy & Mark 85 Autonomous Upgrades", importance = 5),
            MemoryEntity(key = "Preferred Tone", category = "PREFERENCE", content = "Polite, calm, highly intelligent, and proactive.", importance = 4),
            MemoryEntity(key = "Emergency Directive", category = "INSTRUCTION", content = "In DEFCON 1, lock armor bay and isolate neural mesh.", importance = 5)
        )
        for (m in initialMemories) {
            memoryDao.insert(m)
        }

        val initialTasks = listOf(
            TaskEntity(title = "Review Mark 85 Flight Telemetry", description = "Analyze thermal dissipation on high-altitude thrusters", dueTime = "14:00 Today", priority = "HIGH", category = "TASK"),
            TaskEntity(title = "Stark Industries Board Briefing", description = "Clean energy distribution Q4 targets", dueTime = "16:30 Today", priority = "HIGH", category = "SCHEDULE"),
            TaskEntity(title = "Run Security Audit with HOMER", description = "Routine integrity scan on satellite link", dueTime = "19:00", priority = "MEDIUM", category = "REMINDER")
        )
        for (t in initialTasks) {
            taskDao.insert(t)
        }

        securityLogDao.insert(
            SecurityLogEntity(
                eventType = "AUTH",
                description = "Master Stark biometric token verified. JARVIS awoke.",
                severity = "INFO",
                sourceAgent = "JARVIS_SECURITY"
            )
        )
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
    }

    // Send Chat Message & AI Streaming Response
    fun sendMessage(userText: String, isVoice: Boolean = false) {
        if (userText.isBlank()) return
        val text = userText.trim()

        viewModelScope.launch {
            // Save user message
            conversationDao.insert(
                ConversationEntity(
                    role = "user",
                    text = text,
                    agentName = "Sir",
                    isVoice = isVoice
                )
            )

            // Auto-route specialized agent if using default JARVIS Prime
            val activeAgent = if (_selectedAgent.value == JarvisAgent.JARVIS_PRIME) {
                val routed = agentSystem.routeIntent(text)
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
            try {
                aiRepository.generateStreamingResponse(
                    prompt = text,
                    agent = activeAgent,
                    language = _selectedLanguage.value,
                    telemetry = _telemetry.value,
                    memories = memories.value
                ).collect { chunk ->
                    _currentStreamingAiText.value = chunk
                    fullText = chunk
                }
            } catch (e: Exception) {
                fullText = "Sir, an anomaly was encountered while querying the neural mesh: ${e.localizedMessage}"
            } finally {
                _isAiThinking.value = false
                _currentStreamingAiText.value = ""
            }

            // Save AI reply to Room DB
            conversationDao.insert(
                ConversationEntity(
                    role = "jarvis",
                    text = fullText,
                    agentName = activeAgent.codename,
                    isVoice = isVoice
                )
            )

            // Audio synthesis if voice requested
            if (isVoice || _currentScreen.value == ScreenDestination.VOICE_HUD) {
                voiceManager.speak(fullText)
            }
        }
    }

    // Voice recognition trigger
    fun startVoiceListening() {
        voiceManager.startListening(
            onResult = { resultText ->
                sendMessage(resultText, isVoice = true)
            },
            onError = { errorMsg ->
                // Voice error logged
            }
        )
    }

    fun stopVoiceListening() {
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

    // Task CRUD
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
            taskDao.update(task.copy(isCompleted = !task.isCompleted))
        }
    }

    fun deleteTask(task: TaskEntity) {
        viewModelScope.launch {
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
            conversationDao.clearAll()
        }
    }

    override fun onCleared() {
        super.onCleared()
        voiceManager.release()
    }
}
