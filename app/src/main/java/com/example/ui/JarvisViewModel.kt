package com.example.ui

import android.app.Application
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.BuildConfig
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.agents.MultiAgentSystem
import com.example.ai.AiRepository
import com.example.ai.AndroidAiRoutingMode
import com.example.ai.AndroidCanonicalCommandEngine
import com.example.ai.AndroidHardwareInspector
import com.example.ai.AndroidHardwareSpecs
import com.example.ai.AndroidHybridAiRouter
import com.example.ai.BrainAnalysis
import com.example.ai.CanonicalCommandOutcome
import com.example.ai.JarvisBrainEngine
import com.example.ai.LiteRtLmManager
import com.example.ai.RequestTelemetrySummary
import com.example.ai.WeatherCityResult
import com.example.data.backup.BackupImportPreview
import com.example.data.backup.JarvisBackupManager
import com.example.data.db.ChatSessionEntity
import com.example.data.db.CommandHistoryEntity
import com.example.data.db.ConversationEntity
import com.example.data.db.CustomAgentEntity
import com.example.data.db.JarvisDatabase
import com.example.data.db.LocalModelEntity
import com.example.data.db.MediaItemEntity
import com.example.data.db.MemoryCommandEngine
import com.example.data.db.MemoryDeduplicator
import com.example.data.db.MemoryEntity
import com.example.data.db.NoteEntity
import com.example.data.db.NoteSyncStatus
import com.example.data.db.SecurityLogEntity
import com.example.data.db.TaskEntity
import com.example.data.db.TaskSyncStatus
import com.example.media.AmPlaylist
import com.example.data.preferences.CoreVisualMode
import com.example.data.preferences.DashboardLayoutMode
import com.example.data.preferences.HudThemePreset
import com.example.data.preferences.JarvisAccentTheme
import com.example.data.preferences.JarvisPreferencesRepository
import com.example.data.preferences.JarvisUserPreferences
import com.example.data.sync.DeferredSyncWorker
import com.example.features.AutomationLogEntry
import com.example.features.AutomationRepository
import com.example.features.BrainCoordinateOutcome
import com.example.features.GeneratedMusicTrack
import com.example.features.MultiAiBrainClient
import com.example.features.MultiAiBrainSnapshot
import com.example.features.MusicStudioRepository
import com.example.features.ResearchRepository
import com.example.features.ResearchStudioResult
import com.example.plugins.PluginManager
import com.example.productivity.DailySummaryComposer
import com.example.productivity.ReminderParser
import com.example.productivity.ReminderScheduler
import com.example.security.SecurityAuditModule
import com.example.security.SecurityReport
import com.example.sync.AndroidRemoteConfigSyncManager
import com.example.sync.EcosystemConfigSnapshot
import com.example.sync.ProviderConnectionProbe
import com.example.system.AndroidNetworkStateManager
import com.example.system.JarvisSystemMonitor
import com.example.system.SystemTelemetry
import com.example.media.PendingYouTubeCommand
import com.example.media.YouTubeMediaUiState
import com.example.media.YouTubePlaybackStatus
import com.example.media.YouTubePlayerAction
import com.example.media.YouTubeRepository
import com.example.media.YouTubeSearchMode
import com.example.media.YouTubeVideoItem
import com.example.media.YouTubeVoiceCommand
import com.example.media.YouTubeVoiceCommandParser
import com.example.openjarvis.OpenJarvisRepository
import com.example.openjarvis.OpenJarvisRunOutcome
import com.example.openjarvis.OpenJarvisSearchResult
import com.example.openjarvis.OpenJarvisUiSnapshot
import com.example.voice.JarvisVoiceManager
import com.example.voice.LocalVoiceCommand
import com.example.voice.OpenJarvisVoiceDirective
import com.example.voice.VoiceCommandParser
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

enum class SharedAiState {
    IDLE,
    LISTENING,
    THINKING,
    SPEAKING,
    OFFLINE
}

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
    YOUTUBE_MEDIA,
    INSIGHTS,
    SETTINGS,
    OPEN_JARVIS,
    MULTI_AI_CENTER,
    RESEARCH_STUDIO,
    AUTOMATION_HUB,
    MUSIC_STUDIO,
    ORBITAL_GAME,
    ULTRON_HOLOGRAM,
    ECOSYSTEM_DIAGNOSTICS
}

enum class StartupBriefingSpeechState {
    PREPARING,
    SPEAKING,
    PAUSED,
    COMPLETED,
    MUTED,
    DISABLED,
    READY
}

data class DailyBriefingState(
    val greeting: String = "",
    val weatherSummary: String = "Checking weather...",
    val tasksSummary: String = "Scanning task queue...",
    val batterySummary: String = "",
    val securitySummary: String = "",
    val spokenSummary: String = "",
    val aiLine: String = "",
    val source: String = "fallback",
    val generatedAt: Long = 0L,
    val isLoading: Boolean = false,
    val error: String? = null,
    val startupSpeechState: StartupBriefingSpeechState = StartupBriefingSpeechState.PREPARING
)

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

data class PendingChatAttachment(
    val name: String,
    val mimeType: String,
    val sizeBytes: Long,
    val uriString: String,
    val base64Data: String? = null,
    val textContent: String? = null,
    val useAsTextContext: Boolean = false
)

class JarvisViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val db = JarvisDatabase.getDatabase(application)
    private val memoryDao = db.memoryDao()
    private val conversationDao = db.conversationDao()
    private val chatSessionDao = db.chatSessionDao()
    private val taskDao = db.taskDao()
    private val securityLogDao = db.securityLogDao()
    private val customAgentDao = db.customAgentDao()
    private val noteDao = db.noteDao()
    private val localModelDao = db.localModelDao()
    private val commandHistoryDao = db.commandHistoryDao()
    private val mediaItemDao = db.mediaItemDao()
    private val preferencesRepo = JarvisPreferencesRepository(application)

    val userPreferences: StateFlow<JarvisUserPreferences> = preferencesRepo.preferencesFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, JarvisUserPreferences())
    private var hasAppliedInitialDefaultAgent = false
    private var lastAppliedRemoteVersion = 0

    fun resolveEffectiveBackendUrl(): String {
        val custom = userPreferences.value.customBackendUrl.trim().trimEnd('/')
        if (custom.isNotBlank() && custom.startsWith("http")) return custom
        val buildCfg = BuildConfig.BACKEND_URL.trim().trimEnd('/')
        return if (buildCfg.isNotBlank() && !buildCfg.equals("UNSET", ignoreCase = true) && buildCfg.startsWith("http")) {
            buildCfg
        } else {
            ""
        }
    }

    val voiceManager = JarvisVoiceManager(
        context = application,
        backendUrlProvider = { resolveEffectiveBackendUrl() }
    )
    val systemMonitor = JarvisSystemMonitor(application)
    val networkStateManager = AndroidNetworkStateManager(application)
    val securityModule = SecurityAuditModule(application)
    val pluginManager = PluginManager()
    val agentSystem = MultiAgentSystem()
    val aiRepository = AiRepository(runtimeBackendUrlProvider = { resolveEffectiveBackendUrl() })
    val liteRtLmManager = LiteRtLmManager(application)
    val youTubeRepository = YouTubeRepository(backendUrlProvider = { resolveEffectiveBackendUrl() })
    val remoteConfigSyncManager = AndroidRemoteConfigSyncManager(backendUrlProvider = { resolveEffectiveBackendUrl() })
    private val multiAiBrainClient = MultiAiBrainClient(
        backendUrlProvider = { resolveEffectiveBackendUrl() },
        aiRepository = aiRepository
    )
    private val researchRepository = ResearchRepository(
        backendUrlProvider = { resolveEffectiveBackendUrl() },
        aiRepository = aiRepository
    )
    private val musicStudioRepository = MusicStudioRepository(
        context = application,
        backendUrlProvider = { resolveEffectiveBackendUrl() },
        aiRepository = aiRepository
    )

    val isNetworkOnline: StateFlow<Boolean> = networkStateManager.isOnline
    val networkLabel: StateFlow<String> = networkStateManager.networkLabel
    private val _backendReachable = MutableStateFlow(aiRepository.usesBackendProxy && networkStateManager.isOnline.value)
    val backendReachable: StateFlow<Boolean> = _backendReachable.asStateFlow()

    val requestTelemetrySummary: StateFlow<RequestTelemetrySummary> = aiRepository.telemetryTracker.summary
    val activeStreamStatus: StateFlow<String?> = aiRepository.activeStreamStatus
    val backendCircuitRemainingSeconds: StateFlow<Int> = aiRepository.backendCircuitRemainingSec

    private val _weatherCitySearchResults = MutableStateFlow<List<WeatherCityResult>>(emptyList())
    val weatherCitySearchResults: StateFlow<List<WeatherCityResult>> = _weatherCitySearchResults.asStateFlow()
    private val _isSearchingWeatherCity = MutableStateFlow(false)
    val isSearchingWeatherCity: StateFlow<Boolean> = _isSearchingWeatherCity.asStateFlow()

    val hardwareSpecs: AndroidHardwareSpecs by lazy {
        AndroidHardwareInspector.inspect(application)
    }

    val cpuCoreCount: Int = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
    val isGeminiReady: Boolean
        get() = aiRepository.hasRealApiKey

    // Navigation & Screen Stack
    private val screenStack = mutableListOf<ScreenDestination>()
    private val _currentScreen = MutableStateFlow(ScreenDestination.CHAT)
    val currentScreen: StateFlow<ScreenDestination> = _currentScreen.asStateFlow()

    // Agent & Language
    private val _selectedAgent = MutableStateFlow(JarvisAgent.JARVIS_PRIME)
    val selectedAgent: StateFlow<JarvisAgent> = _selectedAgent.asStateFlow()

    val customAgents: StateFlow<List<CustomAgentEntity>> = customAgentDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _selectedCustomAgent = MutableStateFlow<CustomAgentEntity?>(null)
    val selectedCustomAgent: StateFlow<CustomAgentEntity?> = _selectedCustomAgent.asStateFlow()

    private val _selectedLanguage = MutableStateFlow(JarvisLanguage.ENGLISH)
    val selectedLanguage: StateFlow<JarvisLanguage> = _selectedLanguage.asStateFlow()

    // System Telemetry
    private val _telemetry = MutableStateFlow(systemMonitor.getTelemetry())
    val telemetry: StateFlow<SystemTelemetry> = _telemetry.asStateFlow()

    // Daily Briefing (1-hour cache + startup voice synthesis state)
    private val _dailyBriefing = MutableStateFlow(DailyBriefingState(isLoading = true))
    val dailyBriefing: StateFlow<DailyBriefingState> = _dailyBriefing.asStateFlow()

    private val _startupSummaryDismissed = MutableStateFlow(false)
    val startupSummaryDismissed: StateFlow<Boolean> = _startupSummaryDismissed.asStateFlow()

    private var hasTriggeredStartupSummary = false
    private var isDailySummaryPlaying = false
    private var isBriefingRefreshInFlight = false

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

    val recentlyUpdatedMemories: StateFlow<List<MemoryEntity>> = memoryDao.getRecentlyUpdated()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allConversations: StateFlow<List<ConversationEntity>> = conversationDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val conversations: StateFlow<List<ConversationEntity>> = _activeSessionId
        .flatMapLatest { sessionId -> conversationDao.getBySession(sessionId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val tasks: StateFlow<List<TaskEntity>> = taskDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val notes: StateFlow<List<NoteEntity>> = noteDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val localModels: StateFlow<List<LocalModelEntity>> = localModelDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val commandHistory: StateFlow<List<CommandHistoryEntity>> = commandHistoryDao.getRecent(50)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val securityLogs: StateFlow<List<SecurityLogEntity>> = securityLogDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val securityReport: StateFlow<SecurityReport> = securityModule.securityReport

    // Chat AI State
    private val _currentStreamingAiText = MutableStateFlow("")
    val currentStreamingAiText: StateFlow<String> = _currentStreamingAiText.asStateFlow()

    private val _isAiThinking = MutableStateFlow(false)
    val isAiThinking: StateFlow<Boolean> = _isAiThinking.asStateFlow()

    val sharedAiState: StateFlow<SharedAiState> = combine(
        isNetworkOnline,
        voiceManager.isListening,
        _isAiThinking,
        voiceManager.isSpeaking
    ) { online, listening, thinking, speaking ->
        when {
            listening -> SharedAiState.LISTENING
            thinking -> SharedAiState.THINKING
            speaking -> SharedAiState.SPEAKING
            !online -> SharedAiState.OFFLINE
            else -> SharedAiState.IDLE
        }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, SharedAiState.IDLE)

    // Unified Ecosystem Remote Config & Telemetry
    private val _ecosystemConfig = MutableStateFlow(EcosystemConfigSnapshot())
    val ecosystemConfig: StateFlow<EcosystemConfigSnapshot> = _ecosystemConfig.asStateFlow()

    private val _isSyncingConfig = MutableStateFlow(false)
    val isSyncingConfig: StateFlow<Boolean> = _isSyncingConfig.asStateFlow()

    private val _providerProbes = MutableStateFlow<Map<String, ProviderConnectionProbe>>(emptyMap())
    val providerProbes: StateFlow<Map<String, ProviderConnectionProbe>> = _providerProbes.asStateFlow()

    private val _configAdminMessage = MutableStateFlow<String?>(null)
    val configAdminMessage: StateFlow<String?> = _configAdminMessage.asStateFlow()

    // Multi-AI Brain Control Center
    private val _brainSnapshot = MutableStateFlow(MultiAiBrainSnapshot())
    val brainSnapshot: StateFlow<MultiAiBrainSnapshot> = _brainSnapshot.asStateFlow()

    private val _isBrainLoading = MutableStateFlow(false)
    val isBrainLoading: StateFlow<Boolean> = _isBrainLoading.asStateFlow()

    private val _brainCoordinateOutcome = MutableStateFlow<BrainCoordinateOutcome?>(null)
    val brainCoordinateOutcome: StateFlow<BrainCoordinateOutcome?> = _brainCoordinateOutcome.asStateFlow()

    private val _brainActionNotice = MutableStateFlow<String?>(null)
    val brainActionNotice: StateFlow<String?> = _brainActionNotice.asStateFlow()

    // Research & Report Studio
    private val _researchResult = MutableStateFlow<ResearchStudioResult?>(null)
    val researchResult: StateFlow<ResearchStudioResult?> = _researchResult.asStateFlow()

    private val _isResearchLoading = MutableStateFlow(false)
    val isResearchLoading: StateFlow<Boolean> = _isResearchLoading.asStateFlow()

    private val _researchError = MutableStateFlow<String?>(null)
    val researchError: StateFlow<String?> = _researchError.asStateFlow()

    // Web Automation Hub
    private val _automationLogs = MutableStateFlow<List<AutomationLogEntry>>(emptyList())
    val automationLogs: StateFlow<List<AutomationLogEntry>> = _automationLogs.asStateFlow()

    // Music Studio
    private val _generatedTracks = MutableStateFlow<List<GeneratedMusicTrack>>(emptyList())
    val generatedTracks: StateFlow<List<GeneratedMusicTrack>> = _generatedTracks.asStateFlow()

    private val _isMusicGenerating = MutableStateFlow(false)
    val isMusicGenerating: StateFlow<Boolean> = _isMusicGenerating.asStateFlow()

    private val _musicError = MutableStateFlow<String?>(null)
    val musicError: StateFlow<String?> = _musicError.asStateFlow()

    private val _isMusicPlaying = MutableStateFlow(false)
    val isMusicPlaying: StateFlow<Boolean> = _isMusicPlaying.asStateFlow()

    private val _activeBrainAnalysis = MutableStateFlow<BrainAnalysis?>(null)
    val activeBrainAnalysis: StateFlow<BrainAnalysis?> = _activeBrainAnalysis.asStateFlow()

    private val _sessionSummary = MutableStateFlow<String?>(null)
    val sessionSummary: StateFlow<String?> = _sessionSummary.asStateFlow()

    private val _isSummarizing = MutableStateFlow(false)
    val isSummarizing: StateFlow<Boolean> = _isSummarizing.asStateFlow()

    private val _summaryError = MutableStateFlow<String?>(null)
    val summaryError: StateFlow<String?> = _summaryError.asStateFlow()

    private val _memorySavedBanner = MutableStateFlow<MemorySavedBanner?>(null)
    val memorySavedBanner: StateFlow<MemorySavedBanner?> = _memorySavedBanner.asStateFlow()
    private var memoryBannerJob: Job? = null

    private val _memoryActionError = MutableStateFlow<String?>(null)
    val memoryActionError: StateFlow<String?> = _memoryActionError.asStateFlow()

    private val _continuousVoiceMode = MutableStateFlow(false)
    val continuousVoiceMode: StateFlow<Boolean> = _continuousVoiceMode.asStateFlow()

    private val _chatVoiceDraft = MutableStateFlow<String?>(null)
    val chatVoiceDraft: StateFlow<String?> = _chatVoiceDraft.asStateFlow()

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

    private val _backupImportPreview = MutableStateFlow<BackupImportPreview?>(null)
    val backupImportPreview: StateFlow<BackupImportPreview?> = _backupImportPreview.asStateFlow()

    private val _backupStatusMessage = MutableStateFlow<String?>(null)
    val backupStatusMessage: StateFlow<String?> = _backupStatusMessage.asStateFlow()

    private val _pendingAttachment = MutableStateFlow<PendingChatAttachment?>(null)
    val pendingAttachment: StateFlow<PendingChatAttachment?> = _pendingAttachment.asStateFlow()

    private val _attachmentError = MutableStateFlow<String?>(null)
    val attachmentError: StateFlow<String?> = _attachmentError.asStateFlow()

    private var continuousRestartJob: Job? = null
    private var consecutiveSilenceRetries = 0
    private var activeChatJob: Job? = null
    private var lastSubmittedPrompt: String = ""
    private var lastSubmittedAtMs: Long = 0L

    // YouTube Search & Media Control State (Phase 8 Android Integration)
    private var youTubeCommandSeq = 0L
    private val _youTubeState = MutableStateFlow(
        YouTubeMediaUiState(isBackendConfigured = youTubeRepository.isBackendConfigured)
    )
    val youTubeState: StateFlow<YouTubeMediaUiState> = _youTubeState.asStateFlow()

    // OpenJarvis Isolated Extension State
    private val openJarvisRepository = OpenJarvisRepository()
    private val _openJarvisSnapshot = MutableStateFlow(OpenJarvisUiSnapshot())
    val openJarvisSnapshot: StateFlow<OpenJarvisUiSnapshot> = _openJarvisSnapshot.asStateFlow()

    private val _openJarvisOutcome = MutableStateFlow<OpenJarvisRunOutcome?>(null)
    val openJarvisOutcome: StateFlow<OpenJarvisRunOutcome?> = _openJarvisOutcome.asStateFlow()

    private val _openJarvisSearchResults = MutableStateFlow<List<OpenJarvisSearchResult>>(emptyList())
    val openJarvisSearchResults: StateFlow<List<OpenJarvisSearchResult>> = _openJarvisSearchResults.asStateFlow()

    private val _isOpenJarvisLoading = MutableStateFlow(false)
    val isOpenJarvisLoading: StateFlow<Boolean> = _isOpenJarvisLoading.asStateFlow()

    private val _openJarvisError = MutableStateFlow<String?>(null)
    val openJarvisError: StateFlow<String?> = _openJarvisError.asStateFlow()

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
                voiceManager.voiceVolume = prefsData.voiceVolume
                voiceManager.femaleVoiceEnabled = prefsData.femaleVoiceEnabled
                voiceManager.neuralTtsEnabled = prefsData.neuralTtsEnabled
                voiceManager.setMuted(prefsData.voiceMuted)
                if (!prefsData.voiceModeEnabled && _continuousVoiceMode.value) {
                    exitContinuousVoiceMode()
                }
                if (prefsData.voiceMuted) {
                    isDailySummaryPlaying = false
                    _dailyBriefing.value = _dailyBriefing.value.copy(
                        startupSpeechState = StartupBriefingSpeechState.MUTED
                    )
                } else {
                    val currentSpeech = _dailyBriefing.value.startupSpeechState
                    if (!prefsData.autoSpeakDailySummary &&
                        (currentSpeech == StartupBriefingSpeechState.PREPARING ||
                            currentSpeech == StartupBriefingSpeechState.READY ||
                            currentSpeech == StartupBriefingSpeechState.MUTED)
                    ) {
                        _dailyBriefing.value = _dailyBriefing.value.copy(
                            startupSpeechState = StartupBriefingSpeechState.DISABLED
                        )
                    } else if (prefsData.autoSpeakDailySummary &&
                        (currentSpeech == StartupBriefingSpeechState.DISABLED ||
                            currentSpeech == StartupBriefingSpeechState.MUTED)
                    ) {
                        _dailyBriefing.value = _dailyBriefing.value.copy(
                            startupSpeechState = StartupBriefingSpeechState.READY
                        )
                    }
                }
                if (!hasAppliedInitialDefaultAgent) {
                    _selectedAgent.value = prefsData.defaultAgent
                    hasAppliedInitialDefaultAgent = true
                }
            }
        }
        viewModelScope.launch {
            if (aiRepository.usesBackendProxy) {
                val ok = aiRepository.syncBackendHealth()
                _backendReachable.value = ok
            }
        }
        viewModelScope.launch {
            var previousOnline = networkStateManager.isOnline.value
            networkStateManager.isOnline.collect { online ->
                if (online && !previousOnline && aiRepository.usesBackendProxy) {
                    _backendReachable.value = aiRepository.syncBackendHealth()
                    DeferredSyncWorker.enqueueWhenConnected(getApplication())
                } else if (!online && previousOnline) {
                    _backendReachable.value = false
                }
                previousOnline = online
            }
        }
        viewModelScope.launch {
            seedDefaultsIfEmpty()
            val initialPrefs = preferencesRepo.preferencesFlow.first()
            if (initialPrefs.cachedRemoteConfigJson.isNotBlank()) {
                runCatching {
                    val cached = remoteConfigSyncManager.parseConfigJson(initialPrefs.cachedRemoteConfigJson, fromCache = true)
                    _ecosystemConfig.value = cached
                }
            }
            refreshDailyBriefingInternal(forceRefresh = false)
            launch { triggerStartupDailySummaryIfNeeded(initialPrefs) }
            launch {
                syncRemoteConfigInternal(manual = false)
                while (true) {
                    delay(60_000L)
                    if (networkStateManager.isOnline.value) {
                        syncRemoteConfigInternal(manual = false)
                    }
                }
            }
            launch {
                combine(
                    mediaItemDao.getFavorites(),
                    mediaItemDao.getHistory(),
                    mediaItemDao.getPlaylistItems()
                ) { favs, hist, plItems ->
                    Triple(favs, hist, plItems)
                }.collect { (favs, hist, plItems) ->
                    val favModels = favs.map { it.toYouTubeVideoItem() }
                    val histModels = hist.map { it.toYouTubeVideoItem() }
                    val playlistGroups = plItems
                        .groupBy { it.playlistName }
                        .map { (name, items) ->
                            AmPlaylist(
                                id = name,
                                name = name,
                                items = items.map { it.toYouTubeVideoItem() }
                            )
                        }
                    _youTubeState.value = _youTubeState.value.copy(
                        favorites = favModels,
                        recentlyPlayed = histModels,
                        playlists = playlistGroups
                    )
                }
            }
            refreshTelemetryLoop()
        }
    }

    private fun MediaItemEntity.toYouTubeVideoItem() = YouTubeVideoItem(
        videoId = videoId,
        title = title,
        channelTitle = channelTitle,
        thumbnailUrl = thumbnailUrl,
        durationText = durationText,
        durationSeconds = durationSeconds
    )

    private suspend fun seedDefaultsIfEmpty() {
        // Migrate legacy pre-seeded "Sir" owner title memory if present
        memoryDao.getAll().first().forEach { mem ->
            if (mem.key == "Owner Title" && mem.content.contains("Sir", ignoreCase = true)) {
                memoryDao.update(
                    mem.copy(
                        content = "Address user as a friendly peer using warm natural language.",
                        updatedAt = System.currentTimeMillis()
                    )
                )
            }
        }
        if (prefs.getBoolean(KEY_DEFAULTS_SEEDED, false)) {
            return
        }

        if (memoryDao.count() == 0) {
            val initialMemories = listOf(
                MemoryEntity(key = "Owner Title", category = "PREFERENCE", content = "Address user as a friendly peer using warm natural language.", importance = 5),
                MemoryEntity(key = "Primary Project", category = "PROJECT", content = "AM AI Unified Neural Ecosystem & Autonomous Modules", importance = 5),
                MemoryEntity(key = "Preferred Tone", category = "PREFERENCE", content = "Polite, calm, highly intelligent, and proactive.", importance = 4),
                MemoryEntity(key = "Emergency Directive", category = "INSTRUCTION", content = "In DEFCON 1, lock perimeter and isolate neural mesh.", importance = 5)
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
        _sessionSummary.value = null
        _summaryError.value = null
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

    fun toggleSaveChatSession(sessionId: String) {
        viewModelScope.launch {
            val existing = chatSessionDao.getById(sessionId) ?: return@launch
            chatSessionDao.setSaved(sessionId, !existing.isSaved, System.currentTimeMillis())
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
        } else if (_currentScreen.value != ScreenDestination.CHAT && _currentScreen.value != ScreenDestination.OPENING) {
            _currentScreen.value = ScreenDestination.CHAT
            true
        } else {
            false
        }
    }

    fun selectAgent(agent: JarvisAgent) {
        _selectedCustomAgent.value = null
        _selectedAgent.value = agent
    }

    fun selectCustomAgent(agent: CustomAgentEntity) {
        _selectedCustomAgent.value = agent
        _selectedAgent.value = JarvisAgent.JARVIS_PRIME
    }

    fun saveCustomAgent(
        id: String?,
        name: String,
        codename: String,
        systemPrompt: String,
        colorHex: Long,
        keywords: String
    ) {
        val cleanName = name.trim()
        val cleanPrompt = systemPrompt.trim()
        if (cleanName.isBlank() || cleanPrompt.isBlank()) return
        val cleanCodename = codename.trim().ifBlank { cleanName }.uppercase().take(18)
        val agentId = id?.takeIf { it.isNotBlank() } ?: "custom_${UUID.randomUUID()}"
        viewModelScope.launch {
            customAgentDao.upsert(
                CustomAgentEntity(
                    id = agentId,
                    name = cleanName,
                    codename = cleanCodename,
                    systemPrompt = cleanPrompt,
                    colorHex = colorHex,
                    keywords = keywords.trim()
                )
            )
        }
    }

    fun deleteCustomAgent(id: String) {
        viewModelScope.launch {
            customAgentDao.deleteById(id)
            if (_selectedCustomAgent.value?.id == id) {
                _selectedCustomAgent.value = null
            }
        }
    }

    fun refreshDailyBriefing(forceRefresh: Boolean = false) {
        viewModelScope.launch {
            refreshDailyBriefingInternal(forceRefresh)
        }
    }

    private suspend fun refreshDailyBriefingInternal(forceRefresh: Boolean) {
        if (!forceRefresh && isBriefingRefreshInFlight) return
        isBriefingRefreshInFlight = true
        try {
            val now = System.currentTimeMillis()
        val cachedAt = prefs.getLong(KEY_BRIEFING_TIME, 0L)
        val greeting = DailySummaryComposer.getTimeGreeting()

        val allTasks = taskDao.getAll().first()
        val pendingTasks = DailySummaryComposer.getPrioritizedPendingTasks(allTasks)
        val tasksSummary = if (pendingTasks.isEmpty()) {
            "All scheduled objectives are complete."
        } else {
            val high = pendingTasks.count { it.priority.equals("HIGH", ignoreCase = true) }
            val preview = pendingTasks.take(2).joinToString("; ") { it.title }
            "${pendingTasks.size} pending ($high high priority): $preview"
        }

        val secLogs = securityLogDao.getAll().first()
        val secReport = securityModule.runComprehensiveScan(secLogs)
        val securitySummary = DailySummaryComposer.buildSecurityHudSummary(secReport)

        val t = systemMonitor.getTelemetry()
        val batterySummary = "Battery ${t.batteryLevel}% (${if (t.isCharging) "Charging" else "Optimal"}) • ${t.networkType}"
        val existingSpeechState = _dailyBriefing.value.startupSpeechState

        if (!forceRefresh && cachedAt > 0L && (now - cachedAt) < 3_600_000L) {
            val cachedWeather = prefs.getString(KEY_BRIEFING_WEATHER, null)
            val cachedLine = prefs.getString(KEY_BRIEFING_LINE, null)
            val cachedSource = prefs.getString(KEY_BRIEFING_SOURCE, "fallback") ?: "fallback"
            if (!cachedWeather.isNullOrBlank() && !cachedLine.isNullOrBlank()) {
                val spoken = DailySummaryComposer.composeSpokenDailySummary(
                    greeting = greeting,
                    tasks = allTasks,
                    weatherSummary = cachedWeather,
                    securityReport = secReport,
                    aiLine = cachedLine,
                    aiSource = cachedSource
                )
                _dailyBriefing.value = DailyBriefingState(
                    greeting = greeting,
                    weatherSummary = cachedWeather,
                    tasksSummary = tasksSummary,
                    batterySummary = batterySummary,
                    securitySummary = securitySummary,
                    spokenSummary = spoken,
                    aiLine = cachedLine,
                    source = cachedSource,
                    generatedAt = cachedAt,
                    isLoading = false,
                    startupSpeechState = existingSpeechState
                )
                return
            }
        }

        val immediateSpoken = DailySummaryComposer.composeSpokenDailySummary(
            greeting = greeting,
            tasks = allTasks,
            weatherSummary = _dailyBriefing.value.weatherSummary,
            securityReport = secReport
        )
        _dailyBriefing.value = _dailyBriefing.value.copy(
            greeting = greeting,
            tasksSummary = tasksSummary,
            batterySummary = batterySummary,
            securitySummary = securitySummary,
            spokenSummary = immediateSpoken,
            isLoading = true,
            error = null
        )

        try {
            val curPrefs = userPreferences.value
            val weather = aiRepository.fetchOpenMeteoWeatherSummary(
                lat = curPrefs.weatherLatitude,
                lon = curPrefs.weatherLongitude,
                cityLabel = curPrefs.weatherCityName
            )
            val (aiLine, source) = aiRepository.generateDailyBriefingLine(
                tasksSummary = tasksSummary,
                weatherSummary = weather,
                batterySummary = batterySummary,
                language = _selectedLanguage.value
            )
            val spoken = DailySummaryComposer.composeSpokenDailySummary(
                greeting = greeting,
                tasks = allTasks,
                weatherSummary = weather,
                securityReport = secReport,
                aiLine = aiLine,
                aiSource = source
            )
            val updatedAt = System.currentTimeMillis()
            prefs.edit()
                .putLong(KEY_BRIEFING_TIME, updatedAt)
                .putString(KEY_BRIEFING_WEATHER, weather)
                .putString(KEY_BRIEFING_LINE, aiLine)
                .putString(KEY_BRIEFING_SOURCE, source)
                .apply()
            _dailyBriefing.value = DailyBriefingState(
                greeting = greeting,
                weatherSummary = weather,
                tasksSummary = tasksSummary,
                batterySummary = batterySummary,
                securitySummary = securitySummary,
                spokenSummary = spoken,
                aiLine = aiLine,
                source = source,
                generatedAt = updatedAt,
                isLoading = false,
                startupSpeechState = _dailyBriefing.value.startupSpeechState
            )
        } catch (e: Exception) {
            val fallbackSpoken = DailySummaryComposer.composeSpokenDailySummary(
                greeting = greeting,
                tasks = allTasks,
                weatherSummary = null,
                securityReport = secReport
            )
            _dailyBriefing.value = _dailyBriefing.value.copy(
                greeting = greeting,
                tasksSummary = tasksSummary,
                batterySummary = batterySummary,
                securitySummary = securitySummary,
                spokenSummary = fallbackSpoken,
                isLoading = false,
                error = "Briefing sync error: ${e.localizedMessage ?: "Offline"}"
            )
        }
        } finally {
            isBriefingRefreshInFlight = false
        }
    }

    private suspend fun triggerStartupDailySummaryIfNeeded(initialPrefs: JarvisUserPreferences) {
        if (hasTriggeredStartupSummary) return
        hasTriggeredStartupSummary = true

        if (!initialPrefs.autoSpeakDailySummary || !initialPrefs.voiceModeEnabled) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.DISABLED
            )
            return
        }
        if (initialPrefs.voiceMuted) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.MUTED
            )
            return
        }

        // Wait for Android TextToSpeech onInit(SUCCESS) so startup playback isn't silently dropped
        val ttsReady = withTimeoutOrNull(8_000L) {
            voiceManager.isTtsReady.first { it }
        } == true

        val latestPrefs = userPreferences.value
        if (!latestPrefs.autoSpeakDailySummary || !latestPrefs.voiceModeEnabled) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.DISABLED
            )
            return
        }
        if (latestPrefs.voiceMuted) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.MUTED
            )
            return
        }
        if (!ttsReady || voiceManager.isListening.value || voiceManager.isSpeaking.value) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.READY
            )
            return
        }

        speakDailySummaryInternal(prefix = null)
    }

    fun speakDailySummary(prefix: String? = null) {
        viewModelScope.launch {
            if (userPreferences.value.voiceMuted) {
                _dailyBriefing.value = _dailyBriefing.value.copy(
                    startupSpeechState = StartupBriefingSpeechState.MUTED
                )
                return@launch
            }
            if (!voiceManager.isTtsReady.value) {
                withTimeoutOrNull(4_000L) { voiceManager.isTtsReady.first { it } }
            }
            speakDailySummaryInternal(prefix = prefix)
        }
    }

    private suspend fun speakDailySummaryInternal(prefix: String?) {
        val current = _dailyBriefing.value
        val latestTasks = taskDao.getAll().first()
        val latestSecurity = securityReport.value
        val spoken = DailySummaryComposer.composeSpokenDailySummary(
            greeting = current.greeting.ifBlank { DailySummaryComposer.getTimeGreeting() },
            tasks = latestTasks,
            weatherSummary = current.weatherSummary,
            securityReport = latestSecurity,
            aiLine = current.aiLine,
            aiSource = current.source,
            prefix = prefix
        )
        if (spoken.isBlank()) return

        _startupSummaryDismissed.value = false
        isDailySummaryPlaying = true
        _dailyBriefing.value = _dailyBriefing.value.copy(
            spokenSummary = spoken,
            securitySummary = DailySummaryComposer.buildSecurityHudSummary(latestSecurity),
            startupSpeechState = StartupBriefingSpeechState.SPEAKING
        )

        val queued = voiceManager.speak(spoken) {
            if (isDailySummaryPlaying) {
                isDailySummaryPlaying = false
                _dailyBriefing.value = _dailyBriefing.value.copy(
                    startupSpeechState = StartupBriefingSpeechState.COMPLETED
                )
            }
        }
        if (!queued) {
            isDailySummaryPlaying = false
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = if (userPreferences.value.voiceMuted) {
                    StartupBriefingSpeechState.MUTED
                } else {
                    StartupBriefingSpeechState.READY
                }
            )
        }
    }

    fun pauseDailySummary() {
        voiceManager.pauseSpeaking()
        if (isDailySummaryPlaying) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.PAUSED
            )
        }
    }

    fun resumeDailySummary() {
        val resumed = voiceManager.resumeSpeaking()
        if (resumed && isDailySummaryPlaying) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.SPEAKING
            )
        } else if (!resumed) {
            speakDailySummary()
        }
    }

    fun stopDailySummary() {
        isDailySummaryPlaying = false
        voiceManager.stopSpeaking()
        _dailyBriefing.value = _dailyBriefing.value.copy(
            startupSpeechState = StartupBriefingSpeechState.READY
        )
    }

    fun dismissStartupSummaryBanner() {
        _startupSummaryDismissed.value = true
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

    fun updateVoiceVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        voiceManager.voiceVolume = clamped
        viewModelScope.launch { preferencesRepo.setVoiceVolume(clamped) }
    }

    fun setVoiceMuted(muted: Boolean) {
        voiceManager.setMuted(muted)
        viewModelScope.launch { preferencesRepo.setVoiceMuted(muted) }
    }

    fun toggleVoiceMuted() {
        setVoiceMuted(!userPreferences.value.voiceMuted)
    }

    fun updateVoiceModeEnabled(enabled: Boolean) {
        if (!enabled) {
            exitContinuousVoiceMode()
            voiceManager.stopSpeaking()
        }
        viewModelScope.launch { preferencesRepo.setVoiceModeEnabled(enabled) }
    }

    fun updateFemaleVoiceEnabled(enabled: Boolean) {
        voiceManager.femaleVoiceEnabled = enabled
        viewModelScope.launch { preferencesRepo.setFemaleVoiceEnabled(enabled) }
    }

    fun updateNeuralTtsEnabled(enabled: Boolean) {
        voiceManager.neuralTtsEnabled = enabled
        viewModelScope.launch { preferencesRepo.setNeuralTtsEnabled(enabled) }
    }

    fun testVoice(targetLanguage: JarvisLanguage? = null) {
        val target = targetLanguage ?: userPreferences.value.language
        voiceManager.speak(com.example.voice.SpeechFormatter.getVoiceTestSample(target))
    }

    fun updateContinuousConversationPreference(enabled: Boolean) {
        viewModelScope.launch { preferencesRepo.setContinuousConversationMode(enabled) }
    }

    fun updateAutoSpeakReplies(enabled: Boolean) {
        viewModelScope.launch { preferencesRepo.setAutoSpeakReplies(enabled) }
    }

    fun updateAutoSpeakDailySummary(enabled: Boolean) {
        viewModelScope.launch { preferencesRepo.setAutoSpeakDailySummary(enabled) }
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

    fun updateHudThemePreset(preset: HudThemePreset) {
        viewModelScope.launch { preferencesRepo.setHudThemePreset(preset) }
    }

    fun updateDashboardLayoutMode(mode: DashboardLayoutMode) {
        viewModelScope.launch { preferencesRepo.setDashboardLayoutMode(mode) }
    }

    fun updateCoreVisualMode(mode: CoreVisualMode) {
        viewModelScope.launch { preferencesRepo.setCoreVisualMode(mode) }
    }

    fun updateCustomBackendUrl(url: String) {
        viewModelScope.launch {
            preferencesRepo.setCustomBackendUrl(url)
            syncRemoteConfigInternal(manual = true)
            refreshBackendConnection()
        }
    }

    fun updateAiRoutingMode(mode: AndroidAiRoutingMode) {
        viewModelScope.launch { preferencesRepo.setAiRoutingMode(mode) }
    }

    fun refreshBackendConnection() {
        viewModelScope.launch {
            networkStateManager.refreshState()
            if (aiRepository.usesBackendProxy) {
                _backendReachable.value = aiRepository.syncBackendHealth()
                _youTubeState.value = _youTubeState.value.copy(isBackendConfigured = youTubeRepository.isBackendConfigured)
                DeferredSyncWorker.enqueueWhenConnected(getApplication())
            }
        }
    }

    // Unified Ecosystem Remote Config Synchronization
    fun syncRemoteConfigNow() {
        viewModelScope.launch {
            syncRemoteConfigInternal(manual = true)
        }
    }

    private suspend fun syncRemoteConfigInternal(manual: Boolean) {
        if (_isSyncingConfig.value) return
        if (!networkStateManager.isOnline.value) {
            if (manual) _configAdminMessage.value = "Offline — using cached ecosystem configuration."
            return
        }
        _isSyncingConfig.value = true
        remoteConfigSyncManager.fetchRemoteConfig().fold(
            onSuccess = { (snapshot, rawJson) ->
                _ecosystemConfig.value = snapshot
                _backendReachable.value = true
                preferencesRepo.setCachedRemoteConfigJson(rawJson)
                if (snapshot.version > lastAppliedRemoteVersion) {
                    lastAppliedRemoteVersion = snapshot.version
                    // Sync voice & language flags from server only when version advances
                    val mappedLang = JarvisLanguage.entries.find {
                        it.name.equals(snapshot.defaultLanguage, ignoreCase = true)
                    }
                    if (mappedLang != null && manual) {
                        selectLanguage(mappedLang)
                    }
                    preferencesRepo.setNeuralTtsEnabled(snapshot.neuralTtsEnabled)
                    preferencesRepo.setFemaleVoiceEnabled(snapshot.femaleVoiceEnabled)
                }
                if (manual) {
                    _configAdminMessage.value = "Synced config v${snapshot.version} (${snapshot.activeProvider} / ${snapshot.defaultModel})."
                }
            },
            onFailure = { err ->
                _ecosystemConfig.value = _ecosystemConfig.value.copy(errorMessage = err.localizedMessage)
                if (manual) {
                    _configAdminMessage.value = "Sync fallback active: ${err.localizedMessage ?: "backend unreachable"}"
                }
            }
        )
        _isSyncingConfig.value = false
    }

    fun testBackendProvider(providerId: String) {
        viewModelScope.launch {
            val probe = remoteConfigSyncManager.testProviderConnection(providerId)
            _providerProbes.value = _providerProbes.value.toMutableMap().apply {
                put(providerId, probe)
            }
        }
    }

    fun pushRemoteConfigPatch(patch: JSONObject) {
        viewModelScope.launch {
            _isSyncingConfig.value = true
            remoteConfigSyncManager.pushRemoteConfigUpdate(patch).fold(
                onSuccess = { (snapshot, rawJson) ->
                    _ecosystemConfig.value = snapshot
                    preferencesRepo.setCachedRemoteConfigJson(rawJson)
                    _configAdminMessage.value = "Updated backend config to v${snapshot.version}."
                },
                onFailure = { err ->
                    _configAdminMessage.value = "Update failed: ${err.localizedMessage ?: "Unauthorized or offline"}"
                }
            )
            _isSyncingConfig.value = false
        }
    }

    fun clearConfigAdminMessage() {
        _configAdminMessage.value = null
    }

    // Multi-AI Brain Control Center Actions
    fun refreshBrainStatus() {
        viewModelScope.launch {
            _isBrainLoading.value = true
            _brainSnapshot.value = multiAiBrainClient.fetchStatusSnapshot()
            _isBrainLoading.value = false
        }
    }

    fun testBrainProvider(providerId: String) {
        viewModelScope.launch {
            _isBrainLoading.value = true
            val (ok, detail) = multiAiBrainClient.testProvider(providerId)
            _brainActionNotice.value = "${providerId.uppercase()}: $detail"
            if (ok) _brainSnapshot.value = multiAiBrainClient.fetchStatusSnapshot()
            _isBrainLoading.value = false
        }
    }

    fun resetBrainCooldowns() {
        viewModelScope.launch {
            _isBrainLoading.value = true
            multiAiBrainClient.resetCooldowns()
            _brainSnapshot.value = multiAiBrainClient.fetchStatusSnapshot()
            _brainActionNotice.value = "All provider rate-limit cooldowns cleared."
            _isBrainLoading.value = false
        }
    }

    fun updateBrainCollaborationMode(mode: String) {
        viewModelScope.launch {
            multiAiBrainClient.updateCollaborationMode(mode)
            _brainSnapshot.value = _brainSnapshot.value.copy(collaborationMode = mode)
            _brainActionNotice.value = "Collaboration mode set to $mode."
        }
    }

    fun runBrainCoordinate(prompt: String, collaborationMode: String, preferredProvider: String?) {
        if (prompt.isBlank()) return
        viewModelScope.launch {
            _isBrainLoading.value = true
            val outcome = multiAiBrainClient.coordinateTask(
                prompt = prompt,
                collaborationMode = collaborationMode,
                preferredProvider = preferredProvider,
                language = _selectedLanguage.value,
                telemetry = _telemetry.value
            )
            _brainCoordinateOutcome.value = outcome
            _isBrainLoading.value = false
        }
    }

    fun clearBrainNotice() {
        _brainActionNotice.value = null
    }

    // Research & Report Studio Actions
    fun runWebResearch(query: String) {
        viewModelScope.launch {
            _isResearchLoading.value = true
            _researchError.value = null
            researchRepository.performWebResearch(query, _selectedLanguage.value, _telemetry.value).fold(
                onSuccess = { res -> _researchResult.value = res },
                onFailure = { err -> _researchError.value = err.localizedMessage ?: "Research failed." }
            )
            _isResearchLoading.value = false
        }
    }

    fun generateStructuredReport(reportType: String, title: String, sourceText: String) {
        viewModelScope.launch {
            _isResearchLoading.value = true
            _researchError.value = null
            researchRepository.generateStructuredReport(
                reportType = reportType,
                title = title,
                sourceText = sourceText,
                language = _selectedLanguage.value,
                telemetry = _telemetry.value
            ).fold(
                onSuccess = { res -> _researchResult.value = res },
                onFailure = { err -> _researchError.value = err.localizedMessage ?: "Report generation failed." }
            )
            _isResearchLoading.value = false
        }
    }

    // Automation Hub Actions
    fun logAutomationAction(action: String, target: String, status: String) {
        val entry = AutomationLogEntry(
            id = UUID.randomUUID().toString(),
            action = action,
            target = target,
            status = status
        )
        _automationLogs.value = (listOf(entry) + _automationLogs.value).take(30)
    }

    // Music Studio Actions
    fun generateMusic(prompt: String, mode: String, lyrics: String) {
        viewModelScope.launch {
            _isMusicGenerating.value = true
            _musicError.value = null
            musicStudioRepository.generateTrackOrComposition(
                prompt = prompt,
                mode = mode,
                lyrics = lyrics,
                language = _selectedLanguage.value
            ).fold(
                onSuccess = { track ->
                    _generatedTracks.value = listOf(track) + _generatedTracks.value
                },
                onFailure = { err ->
                    _musicError.value = err.localizedMessage ?: "Music generation failed."
                }
            )
            _isMusicGenerating.value = false
        }
    }

    fun playMusicTrack(track: GeneratedMusicTrack) {
        if (track.audioBase64.isBlank()) {
            _musicError.value = "Blueprint composition mode (text/chords ready below)."
            return
        }
        _isMusicPlaying.value = true
        musicStudioRepository.playBase64Audio(track.audioBase64) {
            _isMusicPlaying.value = false
        }.onFailure { err ->
            _isMusicPlaying.value = false
            _musicError.value = err.localizedMessage ?: "Audio playback failed."
        }
    }

    fun stopMusicTrack() {
        musicStudioRepository.stopAudio()
        _isMusicPlaying.value = false
    }

    fun clearAllMemories() {
        viewModelScope.launch {
            memoryDao.clearAll()
            _memorySavedBanner.value = null
            _memoryActionError.value = null
        }
    }

    fun clearSessionSummary() {
        _sessionSummary.value = null
        _summaryError.value = null
    }

    fun summarizeActiveSession() {
        if (_isSummarizing.value) return
        viewModelScope.launch {
            _isSummarizing.value = true
            _summaryError.value = null
            val history = conversationDao.getBySession(_activeSessionId.value).first()
            val result = aiRepository.summarizeConversation(history, _selectedLanguage.value)
            result.fold(
                onSuccess = { summary -> _sessionSummary.value = summary },
                onFailure = { err -> _summaryError.value = err.message ?: "Unable to summarize conversation." }
            )
            _isSummarizing.value = false
        }
    }

    fun stopGenerating() {
        activeChatJob?.cancel()
        activeChatJob = null
        _isAiThinking.value = false
    }

    fun clearAttachmentError() {
        _attachmentError.value = null
    }

    fun clearPendingAttachment() {
        _pendingAttachment.value = null
    }

    fun toggleAttachmentTextContext() {
        val current = _pendingAttachment.value ?: return
        if (current.textContent != null) {
            _pendingAttachment.value = current.copy(useAsTextContext = !current.useAsTextContext)
        }
    }

    fun attachUri(uri: Uri) {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            _attachmentError.value = null
            val app = getApplication<Application>()
            val resolver = app.contentResolver
            val detectedMime = (resolver.getType(uri) ?: "").lowercase()
            var displayName = "attachment"
            var sizeBytes = -1L

            resolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (nameIdx >= 0) displayName = cursor.getString(nameIdx) ?: displayName
                    if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) sizeBytes = cursor.getLong(sizeIdx)
                }
            }

            if (sizeBytes > AiRepository.MAX_ATTACHMENT_BYTES) {
                _attachmentError.value = "File \"$displayName\" exceeds the 4 MB limit."
                return@launch
            }

            val lowerName = displayName.lowercase()
            val isText = detectedMime.startsWith("text/") ||
                detectedMime == "application/json" ||
                lowerName.endsWith(".txt") || lowerName.endsWith(".md") ||
                lowerName.endsWith(".csv") || lowerName.endsWith(".json")
            val isPdf = detectedMime == "application/pdf" || lowerName.endsWith(".pdf")
            val isImage = detectedMime.startsWith("image/") ||
                lowerName.endsWith(".png") || lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") || lowerName.endsWith(".webp")

            if (!isText && !isPdf && !isImage) {
                _attachmentError.value = "Unsupported file type. Choose an image, PDF, or text/MD/CSV/JSON file."
                return@launch
            }

            val bytes = try {
                resolver.openInputStream(uri)?.use { it.readBytes() }
            } catch (e: Exception) {
                _attachmentError.value = "Could not open file: ${e.localizedMessage}"
                null
            } ?: return@launch

            if (bytes.size > AiRepository.MAX_ATTACHMENT_BYTES) {
                _attachmentError.value = "File \"$displayName\" exceeds the 4 MB limit."
                return@launch
            }

            val resolvedMime = when {
                isPdf -> "application/pdf"
                isText -> detectedMime.ifBlank { "text/plain" }
                else -> detectedMime.ifBlank { "image/jpeg" }
            }

            try {
                app.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {
                // PickVisualMedia or one-time providers may not allow persistable grants
            }

            if (isText) {
                val text = bytes.toString(Charsets.UTF_8).take(60_000)
                _pendingAttachment.value = PendingChatAttachment(
                    name = displayName,
                    mimeType = resolvedMime,
                    sizeBytes = bytes.size.toLong(),
                    uriString = uri.toString(),
                    base64Data = Base64.encodeToString(bytes, Base64.NO_WRAP),
                    textContent = text,
                    useAsTextContext = true
                )
            } else {
                _pendingAttachment.value = PendingChatAttachment(
                    name = displayName,
                    mimeType = resolvedMime,
                    sizeBytes = bytes.size.toLong(),
                    uriString = uri.toString(),
                    base64Data = Base64.encodeToString(bytes, Base64.NO_WRAP),
                    textContent = null,
                    useAsTextContext = false
                )
            }
        }
    }

    // Send Chat Message & AI Streaming Response
    fun sendMessage(userText: String, isVoice: Boolean = false) {
        val attachment = _pendingAttachment.value
        if (userText.isBlank() && attachment == null) return
        if (_isAiThinking.value || activeChatJob?.isActive == true) return
        val text = userText.trim().ifBlank { "Analyze attached file: ${attachment?.name ?: "document"}" }
        val nowMs = System.currentTimeMillis()
        if (attachment == null && text == lastSubmittedPrompt && (nowMs - lastSubmittedAtMs) < 1200L) {
            return
        }
        lastSubmittedPrompt = text
        lastSubmittedAtMs = nowMs
        _pendingAttachment.value = null
        _attachmentError.value = null

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
                    agentName = "You",
                    isVoice = isVoice,
                    attachmentName = attachment?.name,
                    attachmentMimeType = attachment?.mimeType,
                    attachmentUri = attachment?.uriString
                )
            )

            // Phase 3: Intercept explicit Smart Memory commands before Gemini call
            if (attachment == null) {
                val memResult = MemoryCommandEngine.executeIfMemoryCommand(
                    prompt = text,
                    memoryDao = memoryDao,
                    chatSessionDao = chatSessionDao,
                    conversationDao = conversationDao,
                    activeSessionId = sessionId
                )
                if (memResult.handled) {
                    conversationDao.insert(
                        ConversationEntity(
                            sessionId = sessionId,
                            role = "jarvis",
                            text = memResult.replyText,
                            agentName = "JARVIS MEMORY",
                            isVoice = isVoice,
                            isError = false
                        )
                    )
                    chatSessionDao.touch(sessionId, System.currentTimeMillis())
                    if (memResult.savedBannerSummary != null && memResult.savedIds.isNotEmpty()) {
                        showMemoryBanner(memResult.savedBannerSummary, memResult.savedIds)
                    }
                    val currentPrefs = userPreferences.value
                    val shouldSpeak = currentPrefs.voiceModeEnabled &&
                        (isVoice || currentPrefs.autoSpeakReplies ||
                            _currentScreen.value == ScreenDestination.VOICE_HUD ||
                            _continuousVoiceMode.value)
                    if (shouldSpeak) {
                        val queued = voiceManager.speak(memResult.replyText) {
                            if (_continuousVoiceMode.value) scheduleContinuousListenResume()
                        }
                        if (!queued && _continuousVoiceMode.value) {
                            scheduleContinuousListenResume(700L)
                        }
                    } else if (_continuousVoiceMode.value) {
                        scheduleContinuousListenResume(600L)
                    }
                    return@launch
                }

                val canonical = AndroidCanonicalCommandEngine.parse(text)
                if (canonical != null) {
                    val replyText = executeCanonicalChatCommand(canonical)
                    commandHistoryDao.insert(
                        CommandHistoryEntity(
                            rawText = canonical.rawText,
                            intent = canonical.intent,
                            engine = canonical.engine,
                            resultSummary = replyText.take(180)
                        )
                    )
                    conversationDao.insert(
                        ConversationEntity(
                            sessionId = sessionId,
                            role = "jarvis",
                            text = replyText,
                            agentName = "AM COMMAND",
                            isVoice = isVoice,
                            isError = false
                        )
                    )
                    chatSessionDao.touch(sessionId, System.currentTimeMillis())
                    val currentPrefs = userPreferences.value
                    val shouldSpeak = currentPrefs.voiceModeEnabled &&
                        (isVoice || currentPrefs.autoSpeakReplies ||
                            _currentScreen.value == ScreenDestination.VOICE_HUD ||
                            _continuousVoiceMode.value)
                    if (shouldSpeak) {
                        val queued = voiceManager.speak(replyText) {
                            if (_continuousVoiceMode.value) scheduleContinuousListenResume()
                        }
                        if (!queued && _continuousVoiceMode.value) {
                            scheduleContinuousListenResume(700L)
                        }
                    } else if (_continuousVoiceMode.value) {
                        scheduleContinuousListenResume(600L)
                    }
                    return@launch
                }

                val ytChatCmd = YouTubeVoiceCommandParser.parse(text)
                when (ytChatCmd) {
                    is YouTubeVoiceCommand.OpenAMPlayer,
                    is YouTubeVoiceCommand.OpenYouTube -> {
                        navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                        val replyText = "Opening AM Player for you, Sir."
                        conversationDao.insert(
                            ConversationEntity(
                                sessionId = sessionId,
                                role = "jarvis",
                                text = replyText,
                                agentName = "JARVIS MEDIA",
                                isVoice = isVoice,
                                isError = false
                            )
                        )
                        chatSessionDao.touch(sessionId, System.currentTimeMillis())
                        return@launch
                    }
                    is YouTubeVoiceCommand.PlayQuery,
                    is YouTubeVoiceCommand.SearchYouTube -> {
                        val query = when (ytChatCmd) {
                            is YouTubeVoiceCommand.PlayQuery -> ytChatCmd.query
                            is YouTubeVoiceCommand.SearchYouTube -> ytChatCmd.query
                            else -> ""
                        }
                        val mode = when (ytChatCmd) {
                            is YouTubeVoiceCommand.PlayQuery -> ytChatCmd.mode
                            is YouTubeVoiceCommand.SearchYouTube -> ytChatCmd.mode
                            else -> YouTubeSearchMode.VIDEO
                        }
                        val shouldAutoPlay = ytChatCmd is YouTubeVoiceCommand.PlayQuery
                        val result = youTubeRepository.search(query, mode, null, maxResults = 8)
                        if (result.ok && result.items.isNotEmpty()) {
                            val startIdx = result.items.indexOfFirst { it.embeddable }.coerceAtLeast(0)
                            val top = result.items[startIdx]
                            _youTubeState.value = _youTubeState.value.copy(
                                query = query,
                                mode = mode,
                                isSearching = false,
                                isBackendConfigured = result.configured,
                                searchResults = result.items,
                                queue = result.items,
                                fallbackUrl = result.fallbackUrl,
                                errorMessage = null
                            )
                            if (shouldAutoPlay) {
                                playYouTubeFromResults(result.items, startIdx)
                            }
                            val replyText = if (shouldAutoPlay) {
                                "**Now Playing in AM Media Deck**\n- **Title:** ${top.title}\n- **Channel:** ${top.channelTitle}\n- [Watch on YouTube](https://www.youtube.com/watch?v=${top.videoId})"
                            } else {
                                "**YouTube Results for \"$query\"**\n- **Top Match:** ${top.title} (${top.channelTitle})\n- Found ${result.items.size} videos • [Watch on YouTube](https://www.youtube.com/watch?v=${top.videoId})"
                            }
                            conversationDao.insert(
                                ConversationEntity(
                                    sessionId = sessionId,
                                    role = "jarvis",
                                    text = replyText,
                                    agentName = "JARVIS MEDIA",
                                    isVoice = isVoice,
                                    isError = false,
                                    mediaVideoId = top.videoId,
                                    mediaTitle = top.title,
                                    mediaChannel = top.channelTitle,
                                    mediaThumbnailUrl = top.thumbnailUrl,
                                    mediaDurationText = top.durationText
                                )
                            )
                        } else {
                            val fallbackUrl = result.fallbackUrl
                            val reason = result.reason ?: "YouTube Search API unavailable right now."
                            conversationDao.insert(
                                ConversationEntity(
                                    sessionId = sessionId,
                                    role = "jarvis",
                                    text = "$reason\n\n- [Open YouTube Search for \"$query\"]($fallbackUrl)",
                                    agentName = "JARVIS MEDIA",
                                    isVoice = isVoice,
                                    isError = false
                                )
                            )
                        }
                        chatSessionDao.touch(sessionId, System.currentTimeMillis())
                        return@launch
                    }
                    else -> Unit
                }
            }

            launchStreamingReply(
                sessionId = sessionId,
                prompt = text,
                historyBeforePrompt = historySnapshot,
                isVoice = isVoice,
                attachment = attachment
            )
        }
    }

    private suspend fun executeCanonicalChatCommand(cmd: CanonicalCommandOutcome): String {
        return when (cmd.intent) {
            "QUERY_TIME" -> {
                val now = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
                "The current system time is $now."
            }
            "QUERY_DATE" -> {
                val today = SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.getDefault()).format(Date())
                "Today's date is $today."
            }
            "CREATE_TASK" -> {
                val title = cmd.title?.trim().orEmpty()
                if (title.isBlank()) return "Please specify a task title."
                val parsed = aiRepository.parseNaturalReminder(title)
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
                DeferredSyncWorker.enqueueWhenConnected(getApplication())
                "Task added to your queue: \"${parsed.title}\" (${parsed.dueTime})."
            }
            "LIST_TASKS" -> {
                val pending = taskDao.getAll().first().filter { !it.isCompleted }
                if (pending.isEmpty()) {
                    "All scheduled tasks are currently complete."
                } else {
                    val preview = pending.take(6).mapIndexed { idx, t ->
                        "${idx + 1}. ${t.title} (${t.dueTime.ifBlank { t.priority }})"
                    }.joinToString("\n")
                    "Pending tasks (${pending.size}):\n$preview"
                }
            }
            "CREATE_NOTE" -> {
                val body = cmd.content?.trim().orEmpty()
                val title = cmd.title?.ifBlank { "Quick Note" } ?: "Quick Note"
                noteDao.insert(
                    NoteEntity(
                        title = title,
                        content = body,
                        category = "GENERAL",
                        syncStatus = NoteSyncStatus.PENDING_UPSERT
                    )
                )
                DeferredSyncWorker.enqueueWhenConnected(getApplication())
                "Note saved to Vault: \"$title\"."
            }
            "LIST_NOTES" -> {
                val allNotes = noteDao.getAll().first()
                if (allNotes.isEmpty()) {
                    "Your Notes Vault is currently empty."
                } else {
                    val preview = allNotes.take(6).mapIndexed { idx, n ->
                        "${idx + 1}. ${n.title}: ${n.content.take(70)}"
                    }.joinToString("\n")
                    "Saved notes (${allNotes.size}):\n$preview"
                }
            }
            "SAVE_MEMORY" -> {
                val content = cmd.content?.trim().orEmpty()
                if (content.isBlank() || MemoryDeduplicator.containsSensitiveSecret(content)) {
                    "Blocked or empty memory entry."
                } else {
                    val key = content.split(Regex("\\s+")).take(4).joinToString(" ").take(48)
                    val id = memoryDao.insert(
                        MemoryEntity(
                            key = key,
                            category = "FACT",
                            content = content.take(260),
                            importance = 4
                        )
                    )
                    showMemoryBanner(key, listOf(id))
                    DeferredSyncWorker.enqueueWhenConnected(getApplication())
                    "Stored in AM Memory Vault: \"$content\"."
                }
            }
            "OPEN_SCREEN" -> {
                val dest = when (cmd.screen) {
                    "dashboard" -> ScreenDestination.DASHBOARD
                    "chat" -> ScreenDestination.CHAT
                    "voice" -> ScreenDestination.VOICE_HUD
                    "youtube_media" -> ScreenDestination.YOUTUBE_MEDIA
                    "memory_vault" -> ScreenDestination.MEMORY_VAULT
                    "productivity" -> ScreenDestination.PRODUCTIVITY
                    "settings" -> ScreenDestination.SETTINGS
                    "multi_ai" -> ScreenDestination.MULTI_AI_CENTER
                    "multi_agent" -> ScreenDestination.MULTI_AGENT
                    "security" -> ScreenDestination.SECURITY
                    "telemetry" -> ScreenDestination.SYSTEM_TELEMETRY
                    "plugins" -> ScreenDestination.PLUGINS
                    "insights" -> ScreenDestination.INSIGHTS
                    "smart_home" -> ScreenDestination.SMART_HOME
                    "vision" -> ScreenDestination.VISION_SCANNER
                    "research" -> ScreenDestination.RESEARCH_STUDIO
                    "music" -> ScreenDestination.MUSIC_STUDIO
                    "automation" -> ScreenDestination.AUTOMATION_HUB
                    "orbital" -> ScreenDestination.ORBITAL_GAME
                    "ultron" -> ScreenDestination.ULTRON_HOLOGRAM
                    "open_jarvis" -> ScreenDestination.OPEN_JARVIS
                    "diagnostics" -> ScreenDestination.ECOSYSTEM_DIAGNOSTICS
                    else -> null
                }
                if (dest != null) {
                    navigateTo(dest)
                    "Opening ${dest.name.lowercase().replace('_', ' ')}."
                } else {
                    "Unable to resolve target module."
                }
            }
            "RUN_PROTOCOL" -> {
                when (cmd.protocol) {
                    "GOOD_MORNING" -> {
                        refreshDailyBriefing(forceRefresh = true)
                        "Good Morning Protocol initiated. Syncing live briefing telemetry."
                    }
                    "FOCUS" -> "Focus Mode protocol engaged. Priority queue isolated."
                    "DIAGNOSTICS" -> {
                        val t = systemMonitor.getTelemetry()
                        _telemetry.value = t
                        val specs = hardwareSpecs
                        "Diagnostics nominal. Battery ${t.batteryLevel}%, RAM avail ${specs.availableRamMb}MB/${specs.totalRamMb}MB, Net: ${networkLabel.value}."
                    }
                    "STANDBY" -> {
                        stopSpeaking()
                        stopVoiceListening()
                        "Standing by."
                    }
                    else -> "Protocol acknowledged."
                }
            }
            else -> "Command executed."
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
        isVoice: Boolean,
        attachment: PendingChatAttachment? = null
    ) {
        val allMemories = memoryDao.getAll().first()
        val allSessionsSnapshot = chatSessionDao.getAll().first()
        val allConversationsSnapshot = conversationDao.getAll().first()
        val retrievedPastSnippets = MemoryDeduplicator.retrieveRelevantConversations(
            query = prompt,
            activeSessionId = sessionId,
            sessions = allSessionsSnapshot,
            allMessages = allConversationsSnapshot,
            limit = 4
        )
        val brainAnalysis = JarvisBrainEngine.analyzePrompt(
            prompt = prompt,
            selectedLanguage = _selectedLanguage.value,
            hasHistory = historyBeforePrompt.isNotEmpty()
        )
        _activeBrainAnalysis.value = brainAnalysis

        // Check custom agent selection or keyword match before built-in auto-routing
        val activeCustom = _selectedCustomAgent.value ?: run {
            if (_selectedAgent.value == JarvisAgent.JARVIS_PRIME) {
                val lowerPrompt = prompt.lowercase()
                customAgents.value.firstOrNull { custom ->
                    custom.keywords.split(",")
                        .map { it.trim().lowercase() }
                        .any { kw -> kw.isNotEmpty() && lowerPrompt.contains(kw) }
                }
            } else null
        }

        val activeAgent = if (activeCustom != null) {
            JarvisAgent.JARVIS_PRIME
        } else if (_selectedAgent.value == JarvisAgent.JARVIS_PRIME) {
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

        val speakerCodename = activeCustom?.codename ?: activeAgent.codename
        val customPromptOverride = activeCustom?.systemPrompt

        _isAiThinking.value = true
        _currentStreamingAiText.value = ""

        var fullText = ""
        var wasCancelled = false
        var isError = false
        var detectedError = false
        val currentPrefs = userPreferences.value
        val useTextContext = attachment?.useAsTextContext == true && !attachment.textContent.isNullOrBlank()
        val effectivePrompt = if (useTextContext) {
            "$prompt\n\n[ATTACHED DOCUMENT: ${attachment!!.name}]\n```\n${attachment.textContent}\n```"
        } else {
            prompt
        }

        try {
            val routingDecision = AndroidHybridAiRouter.resolve(
                mode = currentPrefs.aiRoutingMode,
                browserOnline = networkStateManager.isOnline.value || _backendReachable.value,
                backendReachable = _backendReachable.value,
                cloudAiConfigured = aiRepository.hasRealApiKey,
                localModelInstalled = liteRtLmManager.isModelInstalled.value
            )

            when (routingDecision.target) {
                "local_litert" -> {
                    liteRtLmManager.generateLocalResponseStream(effectivePrompt).collect { chunk ->
                        _currentStreamingAiText.value = chunk
                        fullText = chunk
                    }
                }
                "offline_guidance" -> {
                    fullText = routingDecision.reason
                    _currentStreamingAiText.value = fullText
                }
                else -> {
                    val streamFlow = if (!useTextContext && attachment?.base64Data != null) {
                        aiRepository.generateMultimodalStreamingResponse(
                            prompt = effectivePrompt,
                            fileBase64 = attachment.base64Data,
                            mimeType = attachment.mimeType,
                            fileName = attachment.name,
                            agent = activeAgent,
                            language = _selectedLanguage.value,
                            telemetry = _telemetry.value,
                            memories = allMemories,
                            history = historyBeforePrompt,
                            enableWebSearch = currentPrefs.webSearchEnabled || activeAgent == JarvisAgent.VERONICA_RESEARCH,
                            customSystemPromptOverride = customPromptOverride,
                            retrievedConversationSnippets = retrievedPastSnippets
                        )
                    } else {
                        aiRepository.generateStreamingResponse(
                            prompt = effectivePrompt,
                            agent = activeAgent,
                            language = _selectedLanguage.value,
                            telemetry = _telemetry.value,
                            memories = allMemories,
                            history = historyBeforePrompt,
                            enableWebSearch = currentPrefs.webSearchEnabled || activeAgent == JarvisAgent.VERONICA_RESEARCH,
                            customSystemPromptOverride = customPromptOverride,
                            retrievedConversationSnippets = retrievedPastSnippets,
                            analysisOverride = brainAnalysis
                        )
                    }
                    streamFlow.collect { chunk ->
                        _currentStreamingAiText.value = chunk
                        fullText = chunk
                    }
                    if (routingDecision.allowFallbackToLocal &&
                        (fullText.isBlank() || AiRepository.isErrorConversation(
                            ConversationEntity(sessionId = sessionId, role = "jarvis", text = fullText)
                        ))
                    ) {
                        fullText = ""
                        liteRtLmManager.generateLocalResponseStream(effectivePrompt).collect { localChunk ->
                            _currentStreamingAiText.value = localChunk
                            fullText = localChunk
                        }
                    }
                }
            }
        } catch (_: CancellationException) {
            wasCancelled = true
        } catch (e: Exception) {
            isError = true
            fullText = JarvisBrainEngine.classifyGeminiError(e.localizedMessage ?: "Neural mesh error")
        } finally {
            withContext(NonCancellable) {
                _isAiThinking.value = false
                _currentStreamingAiText.value = ""
                if (fullText.isNotBlank()) {
                    val savedText = if (wasCancelled) "$fullText\n\n[Generation stopped]" else fullText
                    detectedError = isError || AiRepository.isErrorConversation(
                        ConversationEntity(
                            sessionId = sessionId,
                            role = "jarvis",
                            text = savedText
                        )
                    )
                    conversationDao.insert(
                        ConversationEntity(
                            sessionId = sessionId,
                            role = "jarvis",
                            text = savedText,
                            agentName = speakerCodename,
                            isVoice = isVoice,
                            isError = detectedError
                        )
                    )
                    chatSessionDao.touch(sessionId, System.currentTimeMillis())
                }
            }
        }

        if (!wasCancelled && fullText.isNotBlank()) {
            val shouldSpeak = currentPrefs.voiceModeEnabled &&
                (isVoice || currentPrefs.autoSpeakReplies ||
                    _currentScreen.value == ScreenDestination.VOICE_HUD ||
                    _continuousVoiceMode.value)
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

        if (!wasCancelled && !isError && !detectedError && fullText.isNotBlank() &&
            currentPrefs.autoExtractMemories && JarvisBrainEngine.shouldAutoExtractMemories(prompt)
        ) {
            launchAutoMemoryExtraction(prompt = prompt, reply = fullText)
        }
    }

    private fun launchAutoMemoryExtraction(prompt: String, reply: String) {
        viewModelScope.launch {
            val currentMemories = memoryDao.getAll().first()
            val extracted = aiRepository.extractDurableMemories(prompt, reply, currentMemories)
            if (extracted.isEmpty()) return@launch

            val latestPool = memoryDao.getAll().first().toMutableList()
            val savedIds = mutableListOf<Long>()
            val labels = mutableListOf<String>()
            val now = System.currentTimeMillis()

            for (raw in extracted) {
                val clean = MemoryDeduplicator.sanitizeCandidate(raw) ?: continue
                val conflict = MemoryDeduplicator.findConflictingMemory(
                    clean.key,
                    clean.category,
                    clean.content,
                    latestPool
                )
                if (conflict != null) {
                    if (MemoryDeduplicator.normalize(conflict.content) != MemoryDeduplicator.normalize(clean.content)) {
                        val updated = MemoryDeduplicator.mergeMemoryCandidate(
                            existing = conflict,
                            newKey = conflict.key,
                            newCategory = clean.category,
                            newContent = clean.content,
                            newImportance = clean.importance,
                            nowMillis = now
                        )
                        memoryDao.update(updated)
                        val idx = latestPool.indexOfFirst { it.id == conflict.id }
                        if (idx >= 0) latestPool[idx] = updated
                        savedIds.add(updated.id)
                        labels.add("Updated ${updated.key}")
                    }
                } else if (!MemoryDeduplicator.isNearDuplicate(clean.key, clean.content, latestPool)) {
                    val entity = MemoryEntity(
                        key = clean.key,
                        category = clean.category,
                        content = clean.content,
                        importance = clean.importance,
                        createdAt = now,
                        updatedAt = now
                    )
                    val id = memoryDao.insert(entity)
                    latestPool.add(entity.copy(id = id))
                    savedIds.add(id)
                    labels.add(clean.key)
                }
                if (savedIds.size >= 3) break
            }

            if (savedIds.isNotEmpty()) {
                showMemoryBanner(labels.joinToString(", "), savedIds)
            }
        }
    }

    private fun showMemoryBanner(summary: String, savedIds: List<Long>) {
        _memorySavedBanner.value = MemorySavedBanner(
            summary = summary,
            savedIds = savedIds
        )
        memoryBannerJob?.cancel()
        memoryBannerJob = viewModelScope.launch {
            delay(6500L)
            _memorySavedBanner.value = null
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
        if (!userPreferences.value.voiceModeEnabled) {
            _voiceErrorMessage.value = "Voice Mode is currently disabled in Settings."
            return
        }
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
        if (!_continuousVoiceMode.value || !userPreferences.value.voiceModeEnabled) return
        continuousRestartJob = viewModelScope.launch {
            delay(delayMs)
            if (_continuousVoiceMode.value && userPreferences.value.voiceModeEnabled && !_isAiThinking.value) {
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
            return
        }

        val ytCommand = YouTubeVoiceCommandParser.parse(cleaned)
        if (ytCommand != null) {
            executeYouTubeVoiceCommand(ytCommand, cleaned)
            return
        }

        val ojDirective = VoiceCommandParser.parseOpenJarvisDirective(cleaned)
        if (ojDirective != null) {
            executeOpenJarvisVoiceDirective(ojDirective, cleaned)
            return
        }

        val canonical = AndroidCanonicalCommandEngine.parse(cleaned)
        if (canonical != null) {
            viewModelScope.launch {
                val replyText = executeCanonicalChatCommand(canonical)
                commandHistoryDao.insert(
                    CommandHistoryEntity(
                        rawText = canonical.rawText,
                        intent = canonical.intent,
                        engine = canonical.engine,
                        resultSummary = replyText.take(180)
                    )
                )
                _lastVoiceCommandFeedback.value = "CMD (${canonical.intent}): ${replyText.take(80)}"
                speakCommandAck(replyText)
            }
            return
        }

        val websiteTarget = AutomationRepository.resolveWebsiteVoiceCommand(cleaned)
        if (websiteTarget != null) {
            val safeUrl = AutomationRepository.validateWebsiteUrl(websiteTarget.second).getOrNull()
            if (safeUrl != null) {
                val launched = systemMonitor.launchBrowser(safeUrl)
                logAutomationAction(
                    action = "VOICE_OPEN_WEBSITE",
                    target = safeUrl,
                    status = if (launched) "Launched" else "Browser unavailable"
                )
                _lastVoiceCommandFeedback.value = "WEB: Opening ${websiteTarget.first}"
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        english = "Opening ${websiteTarget.first}.",
                        hindi = "${websiteTarget.first} खोल रही हूँ।",
                        rawText = cleaned,
                        selectedLanguage = _selectedLanguage.value
                    )
                )
                return
            }
        }

        sendMessage(cleaned, isVoice = true)
    }

    // YouTube Media Control & Bilingual Voice Command Execution
    private fun dispatchYouTubeAction(action: YouTubePlayerAction) {
        val nextId = ++youTubeCommandSeq
        _youTubeState.value = _youTubeState.value.copy(
            pendingCommand = PendingYouTubeCommand(nextId, action)
        )
    }

    fun consumeYouTubeCommand(commandId: Long) {
        val current = _youTubeState.value
        if (current.pendingCommand?.id == commandId) {
            _youTubeState.value = current.copy(pendingCommand = null)
        }
    }

    fun setYouTubeSearchMode(mode: YouTubeSearchMode) {
        _youTubeState.value = _youTubeState.value.copy(mode = mode)
    }

    fun clearYouTubeSearchHistory() {
        _youTubeState.value = _youTubeState.value.copy(searchHistory = emptyList())
    }

    fun searchOrPlayYouTubeInput(input: String, mode: YouTubeSearchMode = _youTubeState.value.mode) {
        val trimmed = input.trim()
        if (trimmed.isBlank()) return
        val extractedId = YouTubeRepository.extractVideoIdFromInput(trimmed)
        if (extractedId != null) {
            val directItem = YouTubeVideoItem(
                videoId = extractedId,
                title = "YouTube Video ($extractedId)",
                channelTitle = "Direct YouTube Embed",
                thumbnailUrl = "https://i.ytimg.com/vi/$extractedId/hqdefault.jpg"
            )
            playYouTubeFromResults(listOf(directItem), 0)
            return
        }
        searchYouTube(trimmed, mode)
    }

    fun searchYouTube(
        query: String,
        mode: YouTubeSearchMode = _youTubeState.value.mode,
        pageToken: String? = null,
        autoPlayFirst: Boolean = false,
        rawSpokenInput: String? = null
    ) {
        val clean = query.trim()
        if (clean.isBlank()) return
        val updatedHistory = if (pageToken == null) {
            (listOf(clean) + _youTubeState.value.searchHistory.filterNot { it.equals(clean, ignoreCase = true) }).take(10)
        } else {
            _youTubeState.value.searchHistory
        }

        _youTubeState.value = _youTubeState.value.copy(
            query = clean,
            mode = mode,
            isSearching = true,
            searchResults = if (pageToken == null) emptyList() else _youTubeState.value.searchResults,
            nextPageToken = if (pageToken == null) null else _youTubeState.value.nextPageToken,
            prevPageToken = if (pageToken == null) null else _youTubeState.value.prevPageToken,
            errorMessage = null,
            searchHistory = updatedHistory
        )

        viewModelScope.launch {
            val result = youTubeRepository.search(clean, mode, pageToken, maxResults = 8)
            if (result.ok && result.items.isNotEmpty()) {
                _youTubeState.value = _youTubeState.value.copy(
                    isSearching = false,
                    isBackendConfigured = result.configured,
                    searchResults = result.items,
                    nextPageToken = result.nextPageToken,
                    prevPageToken = result.prevPageToken,
                    totalResults = result.totalResults,
                    fallbackUrl = result.fallbackUrl,
                    errorMessage = null,
                    queue = if (_youTubeState.value.queue.isEmpty() || autoPlayFirst) result.items else _youTubeState.value.queue
                )
                if (autoPlayFirst) {
                    val startIdx = result.items.indexOfFirst { it.embeddable }.coerceAtLeast(0)
                    playYouTubeFromResults(result.items, startIdx)
                    val top = result.items[startIdx]
                    if (rawSpokenInput != null) {
                        val reply = YouTubeVoiceCommandParser.bilingualReply(
                            english = "Playing your selected video: ${top.title.take(60)}.",
                            hindi = "आपका चुना हुआ वीडियो चला रही हूँ।",
                            rawText = rawSpokenInput,
                            selectedLanguage = _selectedLanguage.value
                        )
                        speakCommandAck(reply)
                    }
                } else if (rawSpokenInput != null) {
                    val reply = YouTubeVoiceCommandParser.bilingualReply(
                        english = "Searching YouTube for you. Found ${result.items.size} results.",
                        hindi = "आपके लिए वीडियो खोज रही हूँ। ${result.items.size} परिणाम मिल गए हैं।",
                        rawText = rawSpokenInput,
                        selectedLanguage = _selectedLanguage.value
                    )
                    speakCommandAck(reply)
                }
            } else {
                val reason = result.reason ?: "No relevant videos found."
                _youTubeState.value = _youTubeState.value.copy(
                    isSearching = false,
                    isBackendConfigured = result.configured,
                    searchResults = emptyList(),
                    nextPageToken = null,
                    prevPageToken = null,
                    fallbackUrl = result.fallbackUrl,
                    errorMessage = reason
                )
                if (rawSpokenInput != null) {
                    val reply = YouTubeVoiceCommandParser.bilingualReply(
                        english = "$reason You can tap Open Search on YouTube.",
                        hindi = "यूट्यूब परिणाम अभी उपलब्ध नहीं हैं। आप सीधे यूट्यूब पर खोज खोल सकते हैं।",
                        rawText = rawSpokenInput,
                        selectedLanguage = _selectedLanguage.value
                    )
                    speakCommandAck(reply)
                }
            }
        }
    }

    fun playYouTubeVideoById(
        videoId: String,
        title: String = "YouTube Video",
        channelTitle: String = "YouTube",
        thumbnailUrl: String = "https://i.ytimg.com/vi/$videoId/hqdefault.jpg",
        durationText: String = ""
    ) {
        val cleanId = videoId.trim()
        if (cleanId.isBlank()) return
        val existing = _youTubeState.value.queue.indexOfFirst { it.videoId == cleanId }
        if (existing >= 0) {
            playYouTubeFromResults(_youTubeState.value.queue, existing)
            return
        }
        val item = YouTubeVideoItem(
            videoId = cleanId,
            title = title.ifBlank { "YouTube Video ($cleanId)" },
            channelTitle = channelTitle.ifBlank { "YouTube" },
            thumbnailUrl = thumbnailUrl.ifBlank { "https://i.ytimg.com/vi/$cleanId/hqdefault.jpg" },
            durationText = durationText,
            durationSeconds = 0,
            embeddable = true
        )
        playYouTubeFromResults(listOf(item), 0)
    }

    fun playYouTubeFromResults(items: List<YouTubeVideoItem>, index: Int) {
        if (items.isEmpty()) return
        val safeIdx = index.coerceIn(0, items.lastIndex)
        val item = items[safeIdx]
        _youTubeState.value = _youTubeState.value.copy(
            queue = items,
            currentIndex = safeIdx,
            currentVideo = item,
            status = YouTubePlaybackStatus.LOADING,
            currentTimeSec = 0,
            durationSec = item.durationSeconds,
            errorMessage = null,
            lastFeedback = "Loading: ${item.title}"
        )
        dispatchYouTubeAction(YouTubePlayerAction.LoadVideo(item.videoId, autoPlay = true))
        viewModelScope.launch {
            runCatching {
                mediaItemDao.insert(
                    MediaItemEntity(
                        videoId = item.videoId,
                        title = item.title,
                        channelTitle = item.channelTitle,
                        thumbnailUrl = item.thumbnailUrl,
                        durationText = item.durationText,
                        durationSeconds = item.durationSeconds,
                        itemType = "HISTORY",
                        playlistName = ""
                    )
                )
            }
            fetchRelatedVideos(item.videoId)
        }
    }

    fun fetchTrendingVideos(categoryId: String? = null) {
        _youTubeState.value = _youTubeState.value.copy(isSearching = true, errorMessage = null)
        viewModelScope.launch {
            val result = youTubeRepository.fetchTrending(categoryId = categoryId, maxResults = 12)
            if (result.ok && result.items.isNotEmpty()) {
                _youTubeState.value = _youTubeState.value.copy(
                    isSearching = false,
                    isBackendConfigured = result.configured,
                    query = "Trending",
                    searchResults = result.items,
                    nextPageToken = result.nextPageToken,
                    prevPageToken = result.prevPageToken,
                    fallbackUrl = result.fallbackUrl,
                    errorMessage = null
                )
            } else {
                _youTubeState.value = _youTubeState.value.copy(
                    isSearching = false,
                    errorMessage = result.reason ?: "Unable to fetch trending videos."
                )
            }
        }
    }

    fun fetchRelatedVideos(videoId: String) {
        viewModelScope.launch {
            val result = youTubeRepository.fetchRelated(videoId, maxResults = 10)
            if (result.ok) {
                _youTubeState.value = _youTubeState.value.copy(relatedVideos = result.items)
            }
        }
    }

    fun toggleFavoriteVideo(item: YouTubeVideoItem) {
        viewModelScope.launch {
            if (mediaItemDao.isFavorite(item.videoId)) {
                mediaItemDao.removeFavorite(item.videoId)
            } else {
                mediaItemDao.insert(
                    MediaItemEntity(
                        videoId = item.videoId,
                        title = item.title,
                        channelTitle = item.channelTitle,
                        thumbnailUrl = item.thumbnailUrl,
                        durationText = item.durationText,
                        durationSeconds = item.durationSeconds,
                        itemType = "FAVORITE",
                        playlistName = ""
                    )
                )
            }
        }
    }

    fun addToMediaPlaylist(playlistName: String, item: YouTubeVideoItem) {
        val cleanName = playlistName.trim()
        if (cleanName.isBlank()) return
        viewModelScope.launch {
            mediaItemDao.insert(
                MediaItemEntity(
                    videoId = item.videoId,
                    title = item.title,
                    channelTitle = item.channelTitle,
                    thumbnailUrl = item.thumbnailUrl,
                    durationText = item.durationText,
                    durationSeconds = item.durationSeconds,
                    itemType = "PLAYLIST",
                    playlistName = cleanName
                )
            )
            _youTubeState.value = _youTubeState.value.copy(lastFeedback = "Added to playlist: $cleanName")
        }
    }

    fun clearMediaHistory() {
        viewModelScope.launch {
            mediaItemDao.clearHistory()
        }
    }

    fun deleteMediaPlaylist(name: String) {
        viewModelScope.launch {
            mediaItemDao.deletePlaylist(name)
        }
    }

    fun setYouTubePlaybackSpeed(rate: Float) {
        val clamped = rate.coerceIn(0.25f, 2.5f)
        _youTubeState.value = _youTubeState.value.copy(
            playbackRate = clamped,
            lastFeedback = "Speed: ${clamped}x"
        )
        dispatchYouTubeAction(YouTubePlayerAction.SetPlaybackRate(clamped))
    }

    fun resetBackendCircuit() {
        aiRepository.resetBackendCircuit()
        viewModelScope.launch {
            if (aiRepository.usesBackendProxy) {
                _backendReachable.value = aiRepository.syncBackendHealth()
            }
        }
    }

    fun searchWeatherCities(query: String) {
        val clean = query.trim()
        if (clean.length < 2) {
            _weatherCitySearchResults.value = emptyList()
            return
        }
        viewModelScope.launch {
            _isSearchingWeatherCity.value = true
            aiRepository.searchOpenMeteoCities(clean)
                .onSuccess { _weatherCitySearchResults.value = it }
                .onFailure { _weatherCitySearchResults.value = emptyList() }
            _isSearchingWeatherCity.value = false
        }
    }

    fun selectWeatherCity(city: WeatherCityResult) {
        viewModelScope.launch {
            preferencesRepo.setWeatherLocation(city.displayLabel, city.latitude, city.longitude)
            _weatherCitySearchResults.value = emptyList()
            refreshDailyBriefingInternal(forceRefresh = true)
        }
    }

    fun selectYouTubeQueueIndex(index: Int) {
        val list = _youTubeState.value.queue
        if (index in list.indices) {
            playYouTubeFromResults(list, index)
        }
    }

    fun playYouTube() {
        val state = _youTubeState.value
        if (state.currentVideo == null && state.queue.isNotEmpty()) {
            selectYouTubeQueueIndex(0)
            return
        }
        _youTubeState.value = state.copy(lastFeedback = "Resuming playback")
        dispatchYouTubeAction(YouTubePlayerAction.Play)
    }

    fun pauseYouTube() {
        _youTubeState.value = _youTubeState.value.copy(
            status = YouTubePlaybackStatus.PAUSED,
            lastFeedback = "Video paused"
        )
        dispatchYouTubeAction(YouTubePlayerAction.Pause)
    }

    fun stopYouTube() {
        _youTubeState.value = _youTubeState.value.copy(
            status = YouTubePlaybackStatus.IDLE,
            currentTimeSec = 0,
            lastFeedback = "Video stopped"
        )
        dispatchYouTubeAction(YouTubePlayerAction.Stop)
    }

    fun playNextYouTubeVideo() {
        val state = _youTubeState.value
        if (state.queue.size <= 1) return
        val nextIdx = (state.currentIndex + 1) % state.queue.size
        selectYouTubeQueueIndex(nextIdx)
    }

    fun playPreviousYouTubeVideo() {
        val state = _youTubeState.value
        if (state.queue.size <= 1) return
        val prevIdx = if (state.currentIndex - 1 < 0) state.queue.lastIndex else state.currentIndex - 1
        selectYouTubeQueueIndex(prevIdx)
    }

    fun seekYouTubeBy(deltaSeconds: Int) {
        val state = _youTubeState.value
        val nextTime = (state.currentTimeSec + deltaSeconds).coerceAtLeast(0)
        _youTubeState.value = state.copy(
            currentTimeSec = nextTime,
            lastFeedback = if (deltaSeconds >= 0) "Skipped +${deltaSeconds}s" else "Rewound ${-deltaSeconds}s"
        )
        dispatchYouTubeAction(YouTubePlayerAction.SeekBy(deltaSeconds))
    }

    fun setYouTubeVolume(level: Int) {
        val clamped = level.coerceIn(0, 100)
        _youTubeState.value = _youTubeState.value.copy(
            volume = clamped,
            isMuted = clamped == 0,
            lastFeedback = "Volume set to $clamped%"
        )
        dispatchYouTubeAction(YouTubePlayerAction.SetVolume(clamped))
    }

    fun adjustYouTubeVolume(delta: Int) {
        setYouTubeVolume(_youTubeState.value.volume + delta)
    }

    fun toggleYouTubeMute(explicitMute: Boolean? = null) {
        val nextMuted = explicitMute ?: !_youTubeState.value.isMuted
        _youTubeState.value = _youTubeState.value.copy(
            isMuted = nextMuted,
            lastFeedback = if (nextMuted) "Video muted" else "Video unmuted"
        )
        dispatchYouTubeAction(if (nextMuted) YouTubePlayerAction.Mute else YouTubePlayerAction.Unmute)
    }

    fun toggleYouTubeFullscreen(explicitEnable: Boolean? = null) {
        val next = explicitEnable ?: !_youTubeState.value.isFullscreen
        _youTubeState.value = _youTubeState.value.copy(
            isFullscreen = next,
            lastFeedback = if (next) "Fullscreen enabled" else "Exited fullscreen"
        )
    }

    fun onYouTubePlayerStateChanged(ytStateCode: Int) {
        val mapped = when (ytStateCode) {
            1 -> YouTubePlaybackStatus.PLAYING
            2 -> YouTubePlaybackStatus.PAUSED
            3 -> YouTubePlaybackStatus.LOADING
            0 -> YouTubePlaybackStatus.ENDED
            else -> _youTubeState.value.status
        }
        _youTubeState.value = _youTubeState.value.copy(
            status = mapped,
            errorMessage = if (mapped == YouTubePlaybackStatus.PLAYING) null else _youTubeState.value.errorMessage
        )
        if (mapped == YouTubePlaybackStatus.ENDED && _youTubeState.value.queue.size > 1) {
            playNextYouTubeVideo()
        }
    }

    fun onYouTubePlayerProgress(curSec: Int, durSec: Int) {
        val cur = _youTubeState.value
        _youTubeState.value = cur.copy(
            currentTimeSec = curSec.coerceAtLeast(0),
            durationSec = if (durSec > 0) durSec else cur.durationSec
        )
    }

    fun onYouTubePlayerError(errorCode: Int) {
        val isEmbedBlocked = errorCode == 101 || errorCode == 150
        _youTubeState.value = _youTubeState.value.copy(
            status = if (isEmbedBlocked) YouTubePlaybackStatus.EMBED_BLOCKED else YouTubePlaybackStatus.ERROR,
            errorMessage = if (isEmbedBlocked) {
                "Embedded playback is disabled by the video owner. Tap Open on YouTube or skip to the next video."
            } else {
                "YouTube embedded player error (code $errorCode). Tap Open on YouTube to watch externally."
            }
        )
    }

    private fun executeYouTubeVoiceCommand(cmd: YouTubeVoiceCommand, rawText: String) {
        val lang = _selectedLanguage.value
        when (cmd) {
            YouTubeVoiceCommand.OpenYouTube -> {
                navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                _lastVoiceCommandFeedback.value = "YOUTUBE: Opened YouTube Media Core"
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Opening AM AI YouTube Media Core.",
                        "यूट्यूब खोल रही हूँ।",
                        rawText,
                        lang
                    )
                )
            }
            is YouTubeVoiceCommand.SearchYouTube -> {
                navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                _lastVoiceCommandFeedback.value = "YOUTUBE SEARCH: ${cmd.query}"
                searchYouTube(cmd.query, cmd.mode, autoPlayFirst = false, rawSpokenInput = rawText)
            }
            is YouTubeVoiceCommand.PlayQuery -> {
                navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                _lastVoiceCommandFeedback.value = "YOUTUBE PLAY: ${cmd.query}"
                searchYouTube(cmd.query, cmd.mode, autoPlayFirst = true, rawSpokenInput = rawText)
            }
            is YouTubeVoiceCommand.SelectIndex -> {
                navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                val list = _youTubeState.value.queue.ifEmpty { _youTubeState.value.searchResults }
                if (cmd.index in list.indices) {
                    playYouTubeFromResults(list, cmd.index)
                    speakCommandAck(
                        YouTubeVoiceCommandParser.bilingualReply(
                            "Playing your selected video.",
                            "आपका चुना हुआ वीडियो चला रही हूँ।",
                            rawText,
                            lang
                        )
                    )
                } else {
                    speakCommandAck(
                        YouTubeVoiceCommandParser.bilingualReply(
                            "No video is loaded at that position yet. Please search YouTube first.",
                            "अभी उस नंबर पर कोई वीडियो उपलब्ध नहीं है। पहले यूट्यूब पर खोजें।",
                            rawText,
                            lang
                        )
                    )
                }
            }
            YouTubeVoiceCommand.NextVideo -> {
                playNextYouTubeVideo()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Moving to the next video.", "अगला वीडियो चला रही हूँ।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.PreviousVideo -> {
                playPreviousYouTubeVideo()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Moving to the previous video.", "पिछला वीडियो चला रही हूँ।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.Pause -> {
                pauseYouTube()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Video paused.", "वीडियो रोक दिया है।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.Resume -> {
                playYouTube()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Resuming playback.", "वीडियो फिर से चला रही हूँ।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.Stop -> {
                stopYouTube()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Video stopped.", "वीडियो बंद कर दिया है।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.VolumeUp -> {
                adjustYouTubeVolume(15)
                val vol = _youTubeState.value.volume
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Volume increased to $vol percent.", "आवाज़ बढ़ाकर $vol प्रतिशत कर दी है।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.VolumeDown -> {
                adjustYouTubeVolume(-15)
                val vol = _youTubeState.value.volume
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Volume decreased to $vol percent.", "आवाज़ कम करके $vol प्रतिशत कर दी है।", rawText, lang)
                )
            }
            is YouTubeVoiceCommand.SetVolume -> {
                setYouTubeVolume(cmd.level)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Volume set to ${cmd.level} percent.", "आवाज़ ${cmd.level} प्रतिशत कर दी है।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.Mute -> {
                toggleYouTubeMute(true)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Video muted.", "आवाज़ बंद कर दी है।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.Unmute -> {
                toggleYouTubeMute(false)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Video unmuted.", "आवाज़ चालू कर दी है।", rawText, lang)
                )
            }
            is YouTubeVoiceCommand.SeekForward -> {
                seekYouTubeBy(cmd.seconds)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Skipped forward ${cmd.seconds} seconds.", "${cmd.seconds} सेकंड आगे बढ़ा दिया है।", rawText, lang)
                )
            }
            is YouTubeVoiceCommand.SeekBackward -> {
                seekYouTubeBy(-cmd.seconds)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply("Rewound ${cmd.seconds} seconds.", "${cmd.seconds} सेकंड पीछे कर दिया है।", rawText, lang)
                )
            }
            YouTubeVoiceCommand.PlayDifferent -> {
                val currentState = _youTubeState.value
                if (currentState.queue.size > 1) {
                    playNextYouTubeVideo()
                    speakCommandAck(
                        YouTubeVoiceCommandParser.bilingualReply("Playing the next item in your queue.", "कतार से अगला वीडियो चला रही हूँ।", rawText, lang)
                    )
                } else {
                    val fallbackTopic = currentState.query.takeIf { it.isNotBlank() }
                        ?: currentState.currentVideo?.channelTitle?.takeIf { it.isNotBlank() }
                    if (fallbackTopic != null) {
                        navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                        searchYouTube(fallbackTopic, currentState.mode, autoPlayFirst = true, rawSpokenInput = rawText)
                    } else {
                        speakCommandAck(
                            YouTubeVoiceCommandParser.bilingualReply(
                                "What video or song would you like me to play next, Sir?",
                                "आप अगला कौन-सा वीडियो या गाना चलाना चाहते हैं?",
                                rawText,
                                lang
                            )
                        )
                    }
                }
            }
            is YouTubeVoiceCommand.ToggleFullscreen -> {
                toggleYouTubeFullscreen(cmd.enable)
                val isFull = _youTubeState.value.isFullscreen
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        if (isFull) "Fullscreen enabled." else "Exited fullscreen.",
                        if (isFull) "फुलस्क्रीन चालू कर दिया है।" else "फुलस्क्रीन बंद कर दिया है।",
                        rawText,
                        lang
                    )
                )
            }
            YouTubeVoiceCommand.OpenAMPlayer -> {
                navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                _lastVoiceCommandFeedback.value = "AM PLAYER: Opened AM Player"
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Sure Sir, opening AM Player.",
                        "ज़रूर सर, एएम प्लेयर खोल रही हूँ।",
                        rawText,
                        lang
                    )
                )
            }
            is YouTubeVoiceCommand.SetPlaybackSpeed -> {
                setYouTubePlaybackSpeed(cmd.speed)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Playback speed set to ${cmd.speed}x.",
                        "प्लेबैक स्पीड ${cmd.speed}x कर दी है।",
                        rawText,
                        lang
                    )
                )
            }
            is YouTubeVoiceCommand.ClarificationNeeded -> {
                navigateTo(ScreenDestination.YOUTUBE_MEDIA)
                _lastVoiceCommandFeedback.value = "AM PLAYER CLARIFY: ${cmd.question}"
                speakCommandAck(cmd.question)
            }
        }
    }

    private fun executeLocalVoiceCommand(command: LocalVoiceCommand) {
        when (command) {
            LocalVoiceCommand.OPEN_SECURITY -> {
                _lastVoiceCommandFeedback.value = "LOCAL CMD: Opening Security Center"
                navigateTo(ScreenDestination.SECURITY)
                speakCommandAck("Opening security perimeter matrix.")
            }
            LocalVoiceCommand.TOGGLE_LOCKDOWN -> {
                toggleLockdown()
                val locked = securityModule.isLockdownActive.value
                val msg = if (locked) {
                    "Emergency DEFCON 1 lockdown engaged."
                } else {
                    "Lockdown disengaged. Perimeter normalized."
                }
                _lastVoiceCommandFeedback.value = "LOCAL CMD: $msg"
                speakCommandAck(msg)
            }
            LocalVoiceCommand.CHECK_BATTERY -> {
                val latest = systemMonitor.getTelemetry()
                _telemetry.value = latest
                val status = if (latest.isCharging) "and currently charging" else "on battery power"
                val msg = "Battery is at ${latest.batteryLevel} percent, $status."
                _lastVoiceCommandFeedback.value = "LOCAL CMD: Battery ${latest.batteryLevel}%"
                speakCommandAck(msg)
            }
            LocalVoiceCommand.NEW_CHAT -> {
                createNewChatSession()
                _lastVoiceCommandFeedback.value = "LOCAL CMD: New neural session initialized"
                speakCommandAck("New neural chat session initialized.")
            }
            LocalVoiceCommand.STOP -> {
                _lastVoiceCommandFeedback.value = "LOCAL CMD: Stopped"
                exitContinuousVoiceMode()
            }
        }
    }

    private fun speakCommandAck(message: String) {
        if (!userPreferences.value.voiceModeEnabled) return
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
        if (!userPreferences.value.voiceModeEnabled) {
            _voiceErrorMessage.value = "Voice Mode is currently disabled. Enable it in Settings."
            return
        }
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
                        _voiceErrorMessage.value = "No speech detected after multiple attempts. Hands-free paused — tap Start Voice Mode to resume."
                    } else {
                        _continuousVoiceMode.value = false
                        _voiceErrorMessage.value = errorInfo.message
                    }
                }
            }
        )
    }

    fun startChatDictation() {
        if (!userPreferences.value.voiceModeEnabled) {
            _voiceErrorMessage.value = "Voice Mode is disabled in Settings."
            return
        }
        _voiceErrorMessage.value = null
        _micPermissionDenied.value = false
        voiceManager.startListening(
            onResult = { recognized ->
                _chatVoiceDraft.value = recognized.trim()
            },
            onError = { errorInfo ->
                if (errorInfo.isPermissionDenied) {
                    markMicPermissionDenied(true)
                } else {
                    _voiceErrorMessage.value = errorInfo.message
                }
            }
        )
    }

    fun consumeChatVoiceDraft() {
        _chatVoiceDraft.value = null
    }

    fun stopVoiceListening() {
        continuousRestartJob?.cancel()
        voiceManager.stopListening()
    }

    fun pauseSpeaking() {
        voiceManager.pauseSpeaking()
        if (isDailySummaryPlaying) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.PAUSED
            )
        }
    }

    fun resumeSpeaking() {
        val resumed = voiceManager.resumeSpeaking()
        if (resumed && isDailySummaryPlaying) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.SPEAKING
            )
        }
    }

    fun stopSpeaking() {
        val wasSummary = isDailySummaryPlaying
        isDailySummaryPlaying = false
        voiceManager.stopSpeaking()
        if (wasSummary) {
            _dailyBriefing.value = _dailyBriefing.value.copy(
                startupSpeechState = StartupBriefingSpeechState.READY
            )
        }
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

    fun clearMemoryActionError() {
        _memoryActionError.value = null
    }

    // Memory CRUD
    fun addMemory(key: String, category: String, content: String, importance: Int) {
        val cleanKey = key.trim().take(64)
        val cleanContent = content.trim().take(260)
        if (cleanKey.isBlank() || cleanContent.isBlank()) return

        if (MemoryDeduplicator.containsSensitiveSecret("$cleanKey $cleanContent")) {
            _memoryActionError.value = "Blocked: sensitive secrets, passwords, PINs, or API keys cannot be stored in Memory Vault."
            return
        }
        _memoryActionError.value = null

        viewModelScope.launch {
            val now = System.currentTimeMillis()
            val normalizedCat = MemoryDeduplicator.normalizeCategory(category)
            val existing = memoryDao.getAll().first()
            val conflict = MemoryDeduplicator.findConflictingMemory(cleanKey, normalizedCat, cleanContent, existing)
            if (conflict != null) {
                val merged = MemoryDeduplicator.mergeMemoryCandidate(
                    existing = conflict,
                    newKey = cleanKey,
                    newCategory = normalizedCat,
                    newContent = cleanContent,
                    newImportance = importance,
                    nowMillis = now
                )
                memoryDao.update(merged)
                showMemoryBanner("Updated: ${merged.key}", listOf(merged.id))
            } else {
                val id = memoryDao.insert(
                    MemoryEntity(
                        key = cleanKey,
                        category = normalizedCat,
                        content = cleanContent,
                        importance = importance.coerceIn(1, 5),
                        createdAt = now,
                        updatedAt = now
                    )
                )
                showMemoryBanner(cleanKey, listOf(id))
            }
        }
    }

    fun updateMemory(
        memory: MemoryEntity,
        newKey: String,
        newCategory: String,
        newContent: String,
        newImportance: Int
    ) {
        val cleanKey = newKey.trim().take(64)
        val cleanContent = newContent.trim().take(260)
        if (cleanKey.isBlank() || cleanContent.isBlank()) return

        if (MemoryDeduplicator.containsSensitiveSecret("$cleanKey $cleanContent")) {
            _memoryActionError.value = "Blocked: sensitive secrets, passwords, PINs, or API keys cannot be stored in Memory Vault."
            return
        }
        _memoryActionError.value = null

        viewModelScope.launch {
            val updated = memory.copy(
                key = cleanKey,
                category = MemoryDeduplicator.normalizeCategory(newCategory),
                content = cleanContent,
                importance = newImportance.coerceIn(1, 5),
                updatedAt = System.currentTimeMillis()
            )
            memoryDao.update(updated)
            showMemoryBanner("Updated: ${updated.key}", listOf(updated.id))
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
                DeferredSyncWorker.enqueueWhenConnected(getApplication())
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
                    triggerAtMillis = nextTrigger,
                    updatedAt = System.currentTimeMillis(),
                    syncStatus = TaskSyncStatus.PENDING_UPSERT
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
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
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
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
        }
    }

    fun toggleTask(task: TaskEntity) {
        viewModelScope.launch {
            val nextCompleted = !task.isCompleted
            taskDao.update(
                task.copy(
                    isCompleted = nextCompleted,
                    updatedAt = System.currentTimeMillis(),
                    syncStatus = TaskSyncStatus.PENDING_UPSERT
                )
            )
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
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
        }
    }

    fun deleteTask(task: TaskEntity) {
        viewModelScope.launch {
            ReminderScheduler.cancelReminder(getApplication(), task.id)
            taskDao.markSoftDeleted(task.id)
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
        }
    }

    // Notes CRUD (Offline-first + Deferred Sync)
    fun addNote(title: String, content: String, category: String = "GENERAL", pinned: Boolean = false) {
        val cleanTitle = title.trim()
        val cleanContent = content.trim()
        if (cleanTitle.isBlank() && cleanContent.isBlank()) return
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            noteDao.insert(
                NoteEntity(
                    title = cleanTitle.ifBlank { cleanContent.take(48) },
                    content = cleanContent,
                    category = category.uppercase().ifBlank { "GENERAL" },
                    pinned = pinned,
                    createdAt = now,
                    updatedAt = now,
                    syncStatus = NoteSyncStatus.PENDING_UPSERT
                )
            )
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
        }
    }

    fun toggleNotePin(note: NoteEntity) {
        viewModelScope.launch {
            noteDao.update(
                note.copy(
                    pinned = !note.pinned,
                    updatedAt = System.currentTimeMillis(),
                    syncStatus = NoteSyncStatus.PENDING_UPSERT
                )
            )
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
        }
    }

    fun deleteNote(note: NoteEntity) {
        viewModelScope.launch {
            noteDao.softDelete(note.id)
            DeferredSyncWorker.enqueueWhenConnected(getApplication())
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

    // Export & Import Vault Backup
    fun clearBackupStatusMessage() {
        _backupStatusMessage.value = null
    }

    fun dismissBackupImportPreview() {
        _backupImportPreview.value = null
    }

    fun exportBackup(format: String) {
        viewModelScope.launch {
            val allSessions = chatSessionDao.getAll().first()
            val allMessages = conversationDao.getAll().first()
            val allMemories = memoryDao.getAll().first()
            val allTasks = taskDao.getAll().first()
            val stamp = JarvisBackupManager.buildTimestampSlug()

            val (content, filename, mimeType) = if (format.equals("md", ignoreCase = true)) {
                Triple(
                    JarvisBackupManager.buildMarkdownBackup(allSessions, allMessages, allMemories, allTasks),
                    "jarvis-backup-$stamp.md",
                    "text/markdown"
                )
            } else {
                Triple(
                    JarvisBackupManager.buildJsonBackup(allSessions, allMessages, allMemories, allTasks),
                    "jarvis-backup-$stamp.json",
                    "application/json"
                )
            }

            val result = JarvisBackupManager.writeAndShareBackup(
                context = getApplication(),
                content = content,
                filename = filename,
                mimeType = mimeType
            )
            _backupStatusMessage.value = result.fold(
                onSuccess = { "Backup ready: $filename" },
                onFailure = { err -> "Backup export failed: ${err.localizedMessage ?: "Unknown error"}" }
            )
        }
    }

    fun inspectBackupJson(rawJson: String, filename: String) {
        viewModelScope.launch {
            val currentMemories = memoryDao.getAll().first()
            val currentSessions = chatSessionDao.getAll().first()
            val currentTasks = taskDao.getAll().first()
            val preview = JarvisBackupManager.parseAndValidateBackup(
                rawJson = rawJson,
                filename = filename,
                existingMemories = currentMemories,
                existingSessions = currentSessions,
                existingTasks = currentTasks
            )
            _backupImportPreview.value = preview
        }
    }

    fun confirmImportBackup() {
        val preview = _backupImportPreview.value ?: return
        if (!preview.isValid) return
        _backupImportPreview.value = null

        viewModelScope.launch {
            for (bundle in preview.sessionsToImport) {
                chatSessionDao.insert(bundle.session)
                for (msg in bundle.messages) {
                    conversationDao.insert(msg)
                }
            }
            for (mem in preview.memoriesToImport) {
                memoryDao.insert(mem)
            }
            for (task in preview.tasksToImport) {
                val id = taskDao.insert(task)
                val trigger = task.triggerAtMillis
                if (!task.isCompleted && trigger != null && trigger > System.currentTimeMillis()) {
                    ReminderScheduler.scheduleReminder(
                        context = getApplication(),
                        taskId = id,
                        title = task.title,
                        dueTime = task.dueTime,
                        description = task.description,
                        triggerAtMillis = trigger
                    )
                }
            }
            _backupStatusMessage.value =
                "Imported ${preview.sessionsToImport.size} sessions, ${preview.memoriesToImport.size} memories, ${preview.tasksToImport.size} tasks."
        }
    }

    // OpenJarvis Isolated Extension Operations
    private fun executeOpenJarvisVoiceDirective(directive: OpenJarvisVoiceDirective, rawText: String) {
        val lang = userPreferences.value.language
        when (directive) {
            OpenJarvisVoiceDirective.OpenScreen -> {
                _lastVoiceCommandFeedback.value = "OPENJARVIS: Opening Core Workspace"
                navigateTo(ScreenDestination.OPEN_JARVIS)
                refreshOpenJarvisStatus()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Opening OpenJarvis Core workspace.",
                        "ओपनजर्विस कोर वर्कस्पेस खोल रही हूँ।",
                        rawText,
                        lang
                    )
                )
            }
            OpenJarvisVoiceDirective.CheckEngines -> {
                _lastVoiceCommandFeedback.value = "OPENJARVIS: Checking inference engines"
                navigateTo(ScreenDestination.OPEN_JARVIS)
                refreshOpenJarvisStatus()
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Checking OpenJarvis inference engines and learning telemetry.",
                        "ओपनजर्विस इंजन और लर्निंग टेलीमेट्री की जांच कर रही हूँ।",
                        rawText,
                        lang
                    )
                )
            }
            is OpenJarvisVoiceDirective.DeepResearch -> {
                _lastVoiceCommandFeedback.value = "OPENJARVIS: Deep research on ${directive.query}"
                navigateTo(ScreenDestination.OPEN_JARVIS)
                runOpenJarvisDeepResearch(directive.query)
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Running OpenJarvis deep research on ${directive.query}.",
                        "${directive.query} पर ओपनजर्विस डीप रिसर्च शुरू कर रही हूँ।",
                        rawText,
                        lang
                    )
                )
            }
            is OpenJarvisVoiceDirective.HybridSearch -> {
                _lastVoiceCommandFeedback.value = "OPENJARVIS: Hybrid search for ${directive.query}"
                navigateTo(ScreenDestination.OPEN_JARVIS)
                searchOpenJarvisMemory(directive.query, mode = "hybrid")
                speakCommandAck(
                    YouTubeVoiceCommandParser.bilingualReply(
                        "Searching hybrid BM25 and vector memory for ${directive.query}.",
                        "${directive.query} के लिए हाइब्रिड मेमोरी खोज रही हूँ।",
                        rawText,
                        lang
                    )
                )
            }
        }
    }

    fun refreshOpenJarvisStatus() {
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.fetchStatus(customUrl).fold(
                onSuccess = { snap -> _openJarvisSnapshot.value = snap },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Failed to sync OpenJarvis status." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun runOpenJarvisAgent(
        prompt: String,
        assistantMode: String = "auto",
        engineId: String = "auto",
        confirmToken: String? = null
    ) {
        val clean = prompt.trim()
        if (clean.isEmpty()) return
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.runAgent(
                prompt = clean,
                assistantMode = assistantMode,
                engineId = engineId,
                confirmToken = confirmToken,
                customServiceUrl = customUrl
            ).fold(
                onSuccess = { outcome ->
                    _openJarvisOutcome.value = outcome
                    if (!outcome.ok && !outcome.requiresConfirmation && !outcome.error.isNullOrBlank()) {
                        _openJarvisError.value = outcome.error
                    } else if (outcome.ok) {
                        openJarvisRepository.fetchStatus(customUrl).onSuccess { snap ->
                            _openJarvisSnapshot.value = snap
                        }
                    }
                },
                onFailure = { err ->
                    _openJarvisError.value = err.localizedMessage ?: "OpenJarvis agent execution failed."
                }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun runOpenJarvisDeepResearch(query: String, engineId: String = "auto") {
        val clean = query.trim()
        if (clean.isEmpty()) return
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.runDeepResearch(
                query = clean,
                engineId = engineId,
                customServiceUrl = customUrl
            ).fold(
                onSuccess = { outcome ->
                    _openJarvisOutcome.value = outcome
                    if (!outcome.ok && !outcome.error.isNullOrBlank()) {
                        _openJarvisError.value = outcome.error
                    } else {
                        openJarvisRepository.fetchStatus(customUrl).onSuccess { snap ->
                            _openJarvisSnapshot.value = snap
                        }
                    }
                },
                onFailure = { err ->
                    _openJarvisError.value = err.localizedMessage ?: "Deep research failed."
                }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun searchOpenJarvisMemory(query: String, mode: String = "hybrid") {
        val clean = query.trim()
        if (clean.isEmpty()) return
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.searchHybridMemory(
                query = clean,
                mode = mode,
                customServiceUrl = customUrl
            ).fold(
                onSuccess = { hits -> _openJarvisSearchResults.value = hits },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Hybrid search failed." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun indexOpenJarvisDocument(title: String, text: String) {
        val cleanTitle = title.trim()
        val cleanText = text.trim()
        if (cleanTitle.isEmpty() || cleanText.isEmpty()) return
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.indexDocument(
                title = cleanTitle,
                text = cleanText,
                customServiceUrl = customUrl
            ).fold(
                onSuccess = { ok ->
                    if (ok) {
                        openJarvisRepository.fetchStatus(customUrl).onSuccess { snap ->
                            _openJarvisSnapshot.value = snap
                        }
                    } else {
                        _openJarvisError.value = "Document indexing was rejected."
                    }
                },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Document indexing failed." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun probeOpenJarvisEngine(engineId: String) {
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.probeEngine(engineId, customUrl).fold(
                onSuccess = { msg ->
                    _openJarvisError.value = "$engineId: $msg"
                    openJarvisRepository.fetchStatus(customUrl).onSuccess { snap ->
                        _openJarvisSnapshot.value = snap
                    }
                },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Engine probe failed." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun runOpenJarvisWorkflow(workflowId: String) {
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.runWorkflowNow(workflowId, customUrl).fold(
                onSuccess = { summary ->
                    _openJarvisError.value = summary
                    openJarvisRepository.fetchStatus(customUrl).onSuccess { snap ->
                        _openJarvisSnapshot.value = snap
                    }
                },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Workflow run failed." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun runOpenJarvisBenchmark(engineId: String = "amai_cloud") {
        val customUrl = userPreferences.value.openJarvisServiceUrl
        viewModelScope.launch {
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.runBenchmark(engineId, customUrl).fold(
                onSuccess = { msg ->
                    _openJarvisError.value = msg
                    openJarvisRepository.fetchStatus(customUrl).onSuccess { snap ->
                        _openJarvisSnapshot.value = snap
                    }
                },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Benchmark failed." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun saveOpenJarvisServiceUrl(rawUrl: String) {
        val (valid, sanitizedOrReason) = OpenJarvisRepository.validateRemoteUrl(rawUrl)
        if (!valid) {
            _openJarvisError.value = sanitizedOrReason
            return
        }
        viewModelScope.launch {
            preferencesRepo.setOpenJarvisServiceUrl(sanitizedOrReason)
            _isOpenJarvisLoading.value = true
            _openJarvisError.value = null
            openJarvisRepository.fetchStatus(sanitizedOrReason).fold(
                onSuccess = { snap -> _openJarvisSnapshot.value = snap },
                onFailure = { err -> _openJarvisError.value = err.localizedMessage ?: "Connection test failed." }
            )
            _isOpenJarvisLoading.value = false
        }
    }

    fun speakOpenJarvisText(text: String) {
        val clean = text.trim()
        if (clean.isEmpty() || !userPreferences.value.voiceModeEnabled) return
        voiceManager.speak(clean.take(700))
    }

    override fun onCleared() {
        super.onCleared()
        activeChatJob?.cancel()
        musicStudioRepository.stopAudio()
        networkStateManager.release()
        voiceManager.release()
        CoroutineScope(Dispatchers.IO).launch {
            liteRtLmManager.release()
        }
    }

    companion object {
        const val PREFS_NAME = "jarvis_prefs"
        const val KEY_DEFAULTS_SEEDED = "defaults_seeded"
        const val KEY_ACTIVE_SESSION_ID = "active_session_id"
        const val KEY_BRIEFING_TIME = "daily_briefing_timestamp"
        const val KEY_BRIEFING_WEATHER = "daily_briefing_weather"
        const val KEY_BRIEFING_LINE = "daily_briefing_line"
        const val KEY_BRIEFING_SOURCE = "daily_briefing_source"
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
