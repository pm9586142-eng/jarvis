package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.FolderShared
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.ManageSearch
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.data.preferences.CoreVisualMode
import com.example.data.preferences.DashboardLayoutMode
import com.example.ui.DailyBriefingState
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.SharedAiState
import com.example.ui.components.ActiveAgentsCommandPanel
import com.example.ui.components.AiCoreOverviewPanel
import com.example.ui.components.AmReactor12SectorCanvas
import com.example.ui.components.CockpitTopStrip
import com.example.ui.components.CommandCenterBottomBar
import com.example.ui.components.CommandCenterDrawerContent
import com.example.ui.components.CommandNotificationsDialog
import com.example.ui.components.CommandSearchDialog
import com.example.ui.components.CosmicHudThemeAndLayoutBar
import com.example.ui.components.HologramSphere3DCanvas
import com.example.ui.components.JarvisHeader
import com.example.ui.components.LiveIntelligenceFeedPanel
import com.example.ui.components.LlmStatusAndroidPanel
import com.example.ui.components.MemoryInsightsAndroidPanel
import com.example.ui.components.MissionTimelinePanel
import com.example.ui.components.NeuralGlassCard
import com.example.ui.components.QuickCommandsPanel
import com.example.ui.components.QuickNewTaskDialog
import com.example.ui.components.StartupDailySummaryCard
import com.example.ui.components.SystemMonitorAndroidPanel
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import com.example.ui.theme.SynapticSpark
import kotlinx.coroutines.launch
import java.util.Calendar
import kotlin.math.sin
import kotlin.random.Random

@Composable
fun MainDashboardScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val tokens = LocalJarvisTokens.current

    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val securityReport by viewModel.securityReport.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val audioLevel by viewModel.voiceManager.audioRmsLevel.collectAsState()
    val dailyBriefing by viewModel.dailyBriefing.collectAsState()
    val startupSummaryDismissed by viewModel.startupSummaryDismissed.collectAsState()
    val userPrefs by viewModel.userPreferences.collectAsState()
    val memories by viewModel.memories.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    val conversations by viewModel.allConversations.collectAsState()
    val securityLogs by viewModel.securityLogs.collectAsState()
    val activeAgent by viewModel.selectedAgent.collectAsState()
    val multiProviderStatus by viewModel.aiRepository.multiProviderStatus.collectAsState()
    val localModelInstalled by viewModel.liteRtLmManager.isModelInstalled.collectAsState()
    val localModelName by viewModel.liteRtLmManager.loadedModelName.collectAsState()
    val sharedAiState by viewModel.sharedAiState.collectAsState()
    val ecosystemConfig by viewModel.ecosystemConfig.collectAsState()
    val isSyncingConfig by viewModel.isSyncingConfig.collectAsState()

    var showNewTaskDialog by remember { mutableStateOf(false) }
    var showSearchDialog by remember { mutableStateOf(false) }
    var showNotificationsDialog by remember { mutableStateOf(false) }
    var showProfileDialog by remember { mutableStateOf(false) }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            viewModel.startVoiceListening()
        } else {
            viewModel.markMicPermissionDenied(true)
        }
    }

    val handleMicToggle: () -> Unit = {
        if (isListening) {
            viewModel.stopVoiceListening()
        } else {
            val hasMic = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
            if (hasMic) {
                viewModel.startVoiceListening()
            } else {
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    val currentHour = remember { Calendar.getInstance().get(Calendar.HOUR_OF_DAY) }
    val greeting = remember(currentHour) {
        when (currentHour) {
            in 5..11 -> "Good morning."
            in 12..16 -> "Good afternoon."
            else -> "Good evening."
        }
    }

    val pendingTasks = remember(tasks) { tasks.filter { !it.isCompleted } }
    val criticalLogs = remember(securityLogs) { securityLogs.filter { it.severity == "CRITICAL" } }
    val statusLabel = when {
        securityReport.defconLevel == 1 -> "LOCKDOWN"
        !telemetry.isConnected -> "OFFLINE"
        !viewModel.isGeminiReady -> "KEY NEEDED"
        else -> "OPTIMAL"
    }
    val statusHealthy = securityReport.defconLevel != 1 && telemetry.isConnected

    val stars = remember {
        val rng = Random(88)
        List(56) { Triple(rng.nextFloat(), rng.nextFloat(), 0.8f + rng.nextFloat() * 1.8f) }
    }
    val infiniteTransition = rememberInfiniteTransition(label = "cosmic_bg")
    val starTwinkle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28f,
        animationSpec = infiniteRepeatable(
            animation = tween(5000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "twinkle"
    )

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            CommandCenterDrawerContent(
                currentScreen = ScreenDestination.DASHBOARD,
                onSelectDestination = { dest -> viewModel.navigateTo(dest) },
                onCloseDrawer = { scope.launch { drawerState.close() } }
            )
        }
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(tokens.screenBg)
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            tokens.accentGlow.copy(alpha = if (tokens.isLight) 0.08f else 0.16f),
                            Color.Transparent
                        ),
                        center = Offset(w * 0.82f, h * 0.22f),
                        radius = w * 0.72f
                    )
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            tokens.accent.copy(alpha = if (tokens.isLight) 0.06f else 0.14f),
                            Color.Transparent
                        ),
                        center = Offset(w * 0.18f, h * 0.75f),
                        radius = w * 0.65f
                    )
                )
                if (!tokens.isLight) {
                    for ((idx, s) in stars.withIndex()) {
                        val alpha = (0.25f + 0.5f * sin(starTwinkle + idx)).coerceIn(0.1f, 0.85f)
                        drawCircle(
                            color = if (idx % 2 == 0) tokens.accentBright.copy(alpha = alpha) else SynapticSpark.copy(alpha = alpha),
                            radius = s.third,
                            center = Offset(s.first * w, s.second * h)
                        )
                    }
                }
            }

            Column(modifier = Modifier.fillMaxSize()) {
                JarvisHeader(
                    title = "A M  A I",
                    subtitle = "UNIFIED COMMAND CENTER • v${ecosystemConfig.version} (${userPrefs.hudThemePreset.shortLabel})",
                    telemetry = telemetry,
                    currentLanguage = language,
                    onLanguageSelected = { viewModel.selectLanguage(it) },
                    showBackButton = false,
                    onOpenSettings = { viewModel.navigateTo(ScreenDestination.SETTINGS) },
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    statusLabel = statusLabel,
                    statusIsHealthy = statusHealthy,
                    showLiveClock = true,
                    onOpenSearch = { showSearchDialog = true },
                    unreadNotificationCount = pendingTasks.size + criticalLogs.size,
                    onOpenNotifications = { showNotificationsDialog = true },
                    onOpenProfile = { showProfileDialog = true }
                )

                BoxWithConstraints(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    val isTabletWide = maxWidth >= 820.dp
                    val layoutMode = userPrefs.dashboardLayoutMode

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        CockpitTopStrip(
                            sharedAiState = sharedAiState,
                            layoutMode = layoutMode,
                            isSyncing = isSyncingConfig,
                            onNavigate = { viewModel.navigateTo(it) },
                            onTriggerStandby = {
                                viewModel.stopSpeaking()
                                viewModel.stopVoiceListening()
                            },
                            onSyncNow = { viewModel.syncRemoteConfigNow() },
                            onToggleClassicLayout = {
                                val next = if (layoutMode == DashboardLayoutMode.CLASSIC) {
                                    DashboardLayoutMode.COSMIC
                                } else {
                                    DashboardLayoutMode.CLASSIC
                                }
                                viewModel.updateDashboardLayoutMode(next)
                            }
                        )

                        if (!startupSummaryDismissed && layoutMode != DashboardLayoutMode.FOCUS) {
                            StartupDailySummaryCard(
                                dailyBriefing = dailyBriefing,
                                pendingTasksCount = pendingTasks.size,
                                highPriorityPendingCount = pendingTasks.count { it.priority.equals("HIGH", ignoreCase = true) },
                                securityReport = securityReport,
                                autoSpeakOnLaunch = userPrefs.autoSpeakDailySummary,
                                onPlay = { viewModel.speakDailySummary() },
                                onPause = { viewModel.pauseDailySummary() },
                                onResume = { viewModel.resumeDailySummary() },
                                onStop = { viewModel.stopDailySummary() },
                                onDismiss = { viewModel.dismissStartupSummaryBanner() },
                                onToggleAutoSpeak = { viewModel.updateAutoSpeakDailySummary(it) },
                                onOpenTasks = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) },
                                onOpenSecurity = { viewModel.navigateTo(ScreenDestination.SECURITY) }
                            )
                        }

                        HeroCommandCoreCard(
                            greeting = greeting,
                            audioLevel = audioLevel,
                            isListening = isListening,
                            sharedAiState = sharedAiState,
                            coreVisualMode = userPrefs.coreVisualMode,
                            dailyBriefing = dailyBriefing,
                            engineLabel = multiProviderStatus.activeProviderLabel,
                            ramMb = "${viewModel.hardwareSpecs.availableRamMb}MB",
                            vaultCount = memories.size,
                            tasksCount = pendingTasks.size,
                            localAiLabel = if (localModelInstalled) (localModelName ?: "READY") else "CLOUD",
                            syncVersion = "v${ecosystemConfig.version}",
                            onCoreTap = handleMicToggle,
                            onReactorSectorTap = { dest -> viewModel.navigateTo(dest) },
                            onSpeakBriefing = { viewModel.speakDailySummary() },
                            onRefreshBriefing = { viewModel.refreshDailyBriefing(forceRefresh = true) },
                            onOpenChat = { viewModel.navigateTo(ScreenDestination.CHAT) }
                        )

                        CosmicHudThemeAndLayoutBar(
                            currentPreset = userPrefs.hudThemePreset,
                            currentLayout = layoutMode,
                            currentCoreMode = userPrefs.coreVisualMode,
                            onSelectPreset = { viewModel.updateHudThemePreset(it) },
                            onSelectLayout = { viewModel.updateDashboardLayoutMode(it) },
                            onSelectCoreMode = { viewModel.updateCoreVisualMode(it) }
                        )

                        // Signature Web Protocols Strip
                        if (layoutMode != DashboardLayoutMode.FOCUS) {
                            SignatureProtocolsRow(
                                onGoodMorning = {
                                    viewModel.refreshDailyBriefing(forceRefresh = true)
                                    viewModel.speakDailySummary()
                                },
                                onFocus = { viewModel.updateDashboardLayoutMode(DashboardLayoutMode.FOCUS) },
                                onMusic = { viewModel.navigateTo(ScreenDestination.MUSIC_STUDIO) },
                                onDiagnostics = { viewModel.navigateTo(ScreenDestination.ECOSYSTEM_DIAGNOSTICS) },
                                onStandby = {
                                    viewModel.stopSpeaking()
                                    viewModel.stopVoiceListening()
                                }
                            )
                        }

                        if (layoutMode == DashboardLayoutMode.COSMIC || layoutMode == DashboardLayoutMode.CLASSIC) {
                            if (isTabletWide) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Column(
                                        modifier = Modifier.weight(1.3f),
                                        verticalArrangement = Arrangement.spacedBy(14.dp)
                                    ) {
                                        AiCoreOverviewPanel(
                                            isGeminiReady = viewModel.isGeminiReady,
                                            memoryCount = memories.size,
                                            isListening = isListening,
                                            telemetry = telemetry,
                                            securityReport = securityReport
                                        )
                                        ActiveAgentsCommandPanel { agent, screen ->
                                            agent?.let { viewModel.selectAgent(it) }
                                            viewModel.navigateTo(screen)
                                        }
                                        QuickCommandsPanel(
                                            onStartNewTask = { showNewTaskDialog = true },
                                            onOpenCalendar = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) },
                                            onStartVoiceChat = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) },
                                            onRunWorkflow = { viewModel.navigateTo(ScreenDestination.MULTI_AGENT) }
                                        )
                                        LiveIntelligenceFeedPanel(
                                            conversations = conversations,
                                            securityLogs = securityLogs,
                                            onOpenChat = { viewModel.navigateTo(ScreenDestination.CHAT) }
                                        )
                                        MissionTimelinePanel(
                                            tasks = tasks,
                                            onToggleTask = { viewModel.toggleTask(it) },
                                            onOpenPlanner = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) }
                                        )
                                    }

                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(14.dp)
                                    ) {
                                        SystemMonitorAndroidPanel(
                                            telemetry = telemetry,
                                            cpuCoreCount = viewModel.cpuCoreCount
                                        )
                                        MemoryInsightsAndroidPanel(
                                            memoryCount = memories.size,
                                            conversationCount = conversations.size,
                                            taskCount = tasks.size,
                                            onViewMemoryMap = { viewModel.navigateTo(ScreenDestination.MEMORY_VAULT) }
                                        )
                                        LlmStatusAndroidPanel(
                                            isGeminiReady = viewModel.isGeminiReady,
                                            geminiModelName = viewModel.aiRepository.modelName,
                                            multiProviderStatus = multiProviderStatus,
                                            usesBackendProxy = viewModel.aiRepository.usesBackendProxy,
                                            localModelInstalled = localModelInstalled,
                                            localModelName = localModelName
                                        )
                                    }
                                }
                            } else {
                                AiCoreOverviewPanel(
                                    isGeminiReady = viewModel.isGeminiReady,
                                    memoryCount = memories.size,
                                    isListening = isListening,
                                    telemetry = telemetry,
                                    securityReport = securityReport
                                )
                                ActiveAgentsCommandPanel { agent, screen ->
                                    agent?.let { viewModel.selectAgent(it) }
                                    viewModel.navigateTo(screen)
                                }
                                QuickCommandsPanel(
                                    onStartNewTask = { showNewTaskDialog = true },
                                    onOpenCalendar = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) },
                                    onStartVoiceChat = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) },
                                    onRunWorkflow = { viewModel.navigateTo(ScreenDestination.MULTI_AGENT) }
                                )
                                if (layoutMode == DashboardLayoutMode.COSMIC) {
                                    LiveIntelligenceFeedPanel(
                                        conversations = conversations,
                                        securityLogs = securityLogs,
                                        onOpenChat = { viewModel.navigateTo(ScreenDestination.CHAT) }
                                    )
                                    MissionTimelinePanel(
                                        tasks = tasks,
                                        onToggleTask = { viewModel.toggleTask(it) },
                                        onOpenPlanner = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) }
                                    )
                                }
                                SystemMonitorAndroidPanel(
                                    telemetry = telemetry,
                                    cpuCoreCount = viewModel.cpuCoreCount
                                )
                                MemoryInsightsAndroidPanel(
                                    memoryCount = memories.size,
                                    conversationCount = conversations.size,
                                    taskCount = tasks.size,
                                    onViewMemoryMap = { viewModel.navigateTo(ScreenDestination.MEMORY_VAULT) }
                                )
                                LlmStatusAndroidPanel(
                                    isGeminiReady = viewModel.isGeminiReady,
                                    geminiModelName = viewModel.aiRepository.modelName,
                                    multiProviderStatus = multiProviderStatus,
                                    usesBackendProxy = viewModel.aiRepository.usesBackendProxy,
                                    localModelInstalled = localModelInstalled,
                                    localModelName = localModelName
                                )
                            }
                        } else if (layoutMode == DashboardLayoutMode.COMPACT) {
                            QuickCommandsPanel(
                                onStartNewTask = { showNewTaskDialog = true },
                                onOpenCalendar = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) },
                                onStartVoiceChat = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) },
                                onRunWorkflow = { viewModel.navigateTo(ScreenDestination.MULTI_AGENT) }
                            )
                        }

                        // Complete Subsystems & Web-Parity Modules Grid
                        PreservedSubsystemsGrid(
                            onNavigate = { viewModel.navigateTo(it) }
                        )

                        Spacer(modifier = Modifier.height(6.dp))
                    }
                }

                CommandCenterBottomBar(
                    telemetry = telemetry,
                    dailyBriefing = dailyBriefing,
                    isListening = isListening,
                    audioLevel = audioLevel,
                    onToggleMic = handleMicToggle,
                    onTalkToJarvis = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) },
                    onPlayBriefing = { viewModel.speakDailySummary() }
                )
            }
        }
    }

    if (showNewTaskDialog) {
        QuickNewTaskDialog(
            onDismiss = { showNewTaskDialog = false },
            onSave = { title, due, priority ->
                viewModel.addTask(
                    title = title,
                    description = "Created via Command Center",
                    dueTime = due.ifBlank { "Today" },
                    priority = priority,
                    category = "TASK"
                )
                showNewTaskDialog = false
            }
        )
    }

    if (showSearchDialog) {
        CommandSearchDialog(
            tasks = tasks,
            memoriesCount = memories.size,
            onNavigate = { dest ->
                showSearchDialog = false
                viewModel.navigateTo(dest)
            },
            onDismiss = { showSearchDialog = false }
        )
    }

    if (showNotificationsDialog) {
        CommandNotificationsDialog(
            pendingTasks = pendingTasks.take(5),
            securityLogs = securityLogs.take(4),
            onOpenPlanner = {
                showNotificationsDialog = false
                viewModel.navigateTo(ScreenDestination.PRODUCTIVITY)
            },
            onOpenSecurity = {
                showNotificationsDialog = false
                viewModel.navigateTo(ScreenDestination.SECURITY)
            },
            onDismiss = { showNotificationsDialog = false }
        )
    }

    if (showProfileDialog) {
        AlertDialog(
            onDismissRequest = { showProfileDialog = false },
            containerColor = tokens.surfaceBg,
            title = { Text("Operator Profile • AM AI", color = tokens.accentBright, fontFamily = FontFamily.Monospace) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Active Orchestrator: ${activeAgent.codename}", color = tokens.textPrimary, fontSize = 13.sp)
                    Text("Ecosystem Config: v${ecosystemConfig.version} (${ecosystemConfig.activeProvider})", color = tokens.accentBright, fontSize = 12.sp)
                    Text("Security Clearance: DEFCON ${securityReport.defconLevel} (${securityReport.score}/100)", color = SentinelEmerald, fontSize = 12.sp)
                    Text("AI Failover Pool: ${if (viewModel.isGeminiReady) "Connected" else "Standby"}", color = tokens.textMuted, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showProfileDialog = false
                        viewModel.navigateTo(ScreenDestination.ECOSYSTEM_DIAGNOSTICS)
                    }
                ) { Text("Sync & Diagnostics") }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showProfileDialog = false
                        viewModel.navigateTo(ScreenDestination.OPENING)
                    }
                ) { Text("Lock Gate", color = QuantumGold) }
            }
        )
    }
}

@Composable
private fun HeroCommandCoreCard(
    greeting: String,
    audioLevel: Float,
    isListening: Boolean,
    sharedAiState: SharedAiState,
    coreVisualMode: CoreVisualMode,
    dailyBriefing: DailyBriefingState,
    engineLabel: String,
    ramMb: String,
    vaultCount: Int,
    tasksCount: Int,
    localAiLabel: String,
    syncVersion: String,
    onCoreTap: () -> Unit,
    onReactorSectorTap: (ScreenDestination) -> Unit,
    onSpeakBriefing: () -> Unit,
    onRefreshBriefing: () -> Unit,
    onOpenChat: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("hero_command_core_card"),
        borderColor = tokens.accent.copy(alpha = 0.45f)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Beyond the stars, intelligence awakens.",
                        color = AtmosphericVioletGlow,
                        fontSize = 10.5.sp,
                        fontFamily = FontFamily.Monospace,
                        fontStyle = FontStyle.Italic
                    )
                    Text(
                        text = greeting,
                        color = tokens.textPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                OutlinedButton(
                    onClick = onOpenChat,
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .testTag("hero_neural_chat_btn"),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, tokens.accent.copy(alpha = 0.45f))
                ) {
                    Icon(Icons.Default.Chat, contentDescription = "Open Neural Chat", tint = tokens.accentBright, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Neural Chat", color = tokens.accentBright, fontSize = 11.5.sp)
                }
            }

            // Flanking Telemetry Pills (matching Web Cockpit)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                FlankingMetricChip("ENGINE", engineLabel.take(10), Modifier.weight(1f))
                FlankingMetricChip("RAM", ramMb, Modifier.weight(1f))
                FlankingMetricChip("VAULT", "$vaultCount", Modifier.weight(1f))
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp),
                contentAlignment = Alignment.Center
            ) {
                if (coreVisualMode == CoreVisualMode.ARC_REACTOR) {
                    AmReactor12SectorCanvas(
                        sharedAiState = sharedAiState,
                        audioPulse = audioLevel,
                        modifier = Modifier.fillMaxSize(),
                        onSectorSelected = { dest, _ -> onReactorSectorTap(dest) },
                        onCoreTap = onCoreTap
                    )
                } else {
                    HologramSphere3DCanvas(
                        sharedAiState = sharedAiState,
                        audioPulse = audioLevel,
                        modifier = Modifier.fillMaxSize(),
                        onCoreTap = onCoreTap
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                FlankingMetricChip("TASKS", "$tasksCount OPEN", Modifier.weight(1f))
                FlankingMetricChip("LOCAL AI", localAiLabel.take(10), Modifier.weight(1f))
                FlankingMetricChip("SYNC", syncVersion, Modifier.weight(1f))
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tokens.surfaceBg, RoundedCornerShape(10.dp))
                    .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "EXECUTIVE BRIEFING",
                        color = tokens.accentBright,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier
                                .clickable(enabled = !dailyBriefing.isLoading) { onSpeakBriefing() }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                                .testTag("briefing_speak_btn"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.VolumeUp, contentDescription = "Read aloud", tint = tokens.accentBright, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Speak", color = tokens.accentBright, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                        Row(
                            modifier = Modifier
                                .clickable(enabled = !dailyBriefing.isLoading) { onRefreshBriefing() }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                                .testTag("briefing_refresh_btn"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh briefing", tint = tokens.textPrimary, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (dailyBriefing.isLoading) "..." else "Refresh", color = tokens.textPrimary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }

                Text(
                    text = dailyBriefing.error ?: dailyBriefing.aiLine.ifBlank { "Synchronizing executive telemetry..." },
                    color = if (dailyBriefing.error != null) QuantumGold else tokens.textPrimary,
                    fontSize = 12.sp,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${dailyBriefing.weatherSummary} • ${if (isListening) "Voice Matrix Active" else dailyBriefing.tasksSummary}",
                    color = tokens.accentBright,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun FlankingMetricChip(label: String, value: String, modifier: Modifier = Modifier) {
    val tokens = LocalJarvisTokens.current
    Column(
        modifier = modifier
            .background(tokens.surfaceBg, RoundedCornerShape(8.dp))
            .border(1.dp, tokens.glassBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(label, color = tokens.textMuted, fontSize = 8.5.sp, fontFamily = FontFamily.Monospace)
        Text(value, color = tokens.accentBright, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun SignatureProtocolsRow(
    onGoodMorning: () -> Unit,
    onFocus: () -> Unit,
    onMusic: () -> Unit,
    onDiagnostics: () -> Unit,
    onStandby: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    val items = listOf(
        Triple("Good Morning", SentinelEmerald, onGoodMorning),
        Triple("Focus Mode", tokens.accentBright, onFocus),
        Triple("Music Mode", AtmosphericVioletGlow, onMusic),
        Triple("Diagnostics", QuantumGold, onDiagnostics),
        Triple("Standby", tokens.textMuted, onStandby)
    )
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "SIGNATURE PROTOCOLS",
            color = tokens.textMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items.forEach { (label, tint, action) ->
                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(tint.copy(alpha = 0.14f))
                        .border(1.dp, tint.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
                        .clickable { action() }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = label,
                        color = if (tokens.isLight && tint == tokens.textMuted) tokens.textPrimary else tint,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

private data class SubsystemQuickItem(
    val title: String,
    val icon: ImageVector,
    val accent: Color,
    val dest: ScreenDestination,
    val tag: String
)

@Composable
private fun PreservedSubsystemsGrid(onNavigate: (ScreenDestination) -> Unit) {
    val tokens = LocalJarvisTokens.current
    val items = remember(tokens.accentBright, tokens.accent) {
        listOf(
            SubsystemQuickItem("Neural Chat", Icons.Default.Chat, tokens.accentBright, ScreenDestination.CHAT, "nav_chat_btn"),
            SubsystemQuickItem("Multi-AI Brain", Icons.Default.Hub, SentinelEmerald, ScreenDestination.MULTI_AI_CENTER, "nav_multiai_btn"),
            SubsystemQuickItem("Research Studio", Icons.Default.ManageSearch, tokens.accentBright, ScreenDestination.RESEARCH_STUDIO, "nav_research_btn"),
            SubsystemQuickItem("Music Studio", Icons.Default.LibraryMusic, AtmosphericVioletGlow, ScreenDestination.MUSIC_STUDIO, "nav_music_btn"),
            SubsystemQuickItem("Ultron 3D AI", Icons.Default.ViewInAr, tokens.accentBright, ScreenDestination.ULTRON_HOLOGRAM, "nav_ultron_btn"),
            SubsystemQuickItem("Orbital Aegis 3D", Icons.Default.SportsEsports, QuantumGold, ScreenDestination.ORBITAL_GAME, "nav_orbital_btn"),
            SubsystemQuickItem("YouTube & Web", Icons.Default.PlayArrow, SentinelEmerald, ScreenDestination.YOUTUBE_MEDIA, "nav_youtube_btn"),
            SubsystemQuickItem("Automation Hub", Icons.Default.Public, tokens.accentBright, ScreenDestination.AUTOMATION_HUB, "nav_automation_btn"),
            SubsystemQuickItem("Ecosystem Sync", Icons.Default.CloudSync, SentinelEmerald, ScreenDestination.ECOSYSTEM_DIAGNOSTICS, "nav_diagnostics_btn"),
            SubsystemQuickItem("OpenJarvis Core", Icons.Default.RocketLaunch, QuantumGold, ScreenDestination.OPEN_JARVIS, "nav_openjarvis_btn"),
            SubsystemQuickItem("Voice Matrix", Icons.Default.Mic, AtmosphericVioletGlow, ScreenDestination.VOICE_HUD, "nav_voice_btn"),
            SubsystemQuickItem("Multi-Agent", Icons.Default.AutoAwesome, QuantumGold, ScreenDestination.MULTI_AGENT, "nav_multiagent_btn"),
            SubsystemQuickItem("Tasks & Notes", Icons.Default.TaskAlt, SentinelEmerald, ScreenDestination.PRODUCTIVITY, "nav_productivity_btn"),
            SubsystemQuickItem("Memory Vault", Icons.Default.FolderShared, tokens.accentBright, ScreenDestination.MEMORY_VAULT, "nav_memory_btn"),
            SubsystemQuickItem("Security", Icons.Default.Security, SentinelEmerald, ScreenDestination.SECURITY, "nav_security_btn"),
            SubsystemQuickItem("Telemetry & CLI", Icons.Default.Terminal, tokens.accentBright, ScreenDestination.SYSTEM_TELEMETRY, "nav_telemetry_btn"),
            SubsystemQuickItem("Plugins", Icons.Default.Extension, SynapticSpark, ScreenDestination.PLUGINS, "nav_plugins_btn"),
            SubsystemQuickItem("Smart Home", Icons.Default.Home, SentinelEmerald, ScreenDestination.SMART_HOME, "nav_smarthome_btn"),
            SubsystemQuickItem("Vision OCR", Icons.Default.CameraAlt, tokens.accentBright, ScreenDestination.VISION_SCANNER, "nav_vision_btn"),
            SubsystemQuickItem("Insights", Icons.Default.Insights, tokens.accent, ScreenDestination.INSIGHTS, "nav_insights_btn"),
            SubsystemQuickItem("Settings", Icons.Default.Settings, QuantumGold, ScreenDestination.SETTINGS, "nav_settings_btn")
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "UNIFIED SUBSYSTEMS & WEB PARITY MODULES",
            color = tokens.textMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp
        )
        items.chunked(2).forEach { pair ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                pair.forEach { item ->
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                            .background(tokens.glassBg, RoundedCornerShape(10.dp))
                            .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                            .clickable { onNavigate(item.dest) }
                            .padding(horizontal = 10.dp, vertical = 10.dp)
                            .testTag(item.tag),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(item.icon, contentDescription = item.title, tint = item.accent, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(item.title, color = tokens.textPrimary, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (pair.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}
