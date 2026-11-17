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
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.R
import com.example.productivity.DailySummaryComposer
import com.example.ui.DailyBriefingState
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.StartupBriefingSpeechState
import com.example.ui.components.ActiveAgentsCommandPanel
import com.example.ui.components.AiCoreOverviewPanel
import com.example.ui.components.CommandCenterBottomBar
import com.example.ui.components.CommandCenterDrawerContent
import com.example.ui.components.JarvisHeader
import com.example.ui.components.LiveIntelligenceFeedPanel
import com.example.ui.components.LlmStatusAndroidPanel
import com.example.ui.components.MemoryInsightsAndroidPanel
import com.example.ui.components.MissionTimelinePanel
import com.example.ui.components.NeuralGlassCard
import com.example.ui.components.NeuralIntelligenceCanvas
import com.example.ui.components.QuickCommandsPanel
import com.example.ui.components.SystemMonitorAndroidPanel
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericViolet
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.IceBlueGlow
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
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
            in 5..11 -> "Good morning, Sir."
            in 12..16 -> "Good afternoon, Sir."
            else -> "Good evening, Sir."
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
        List(60) { Triple(rng.nextFloat(), rng.nextFloat(), 0.8f + rng.nextFloat() * 1.8f) }
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
                .background(ObsidianBlack)
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = size.width
                val h = size.height
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            AtmosphericVioletGlow.copy(alpha = 0.16f),
                            AtmosphericViolet.copy(alpha = 0.06f),
                            Color.Transparent
                        ),
                        center = Offset(w * 0.82f, h * 0.22f),
                        radius = w * 0.72f
                    )
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(IceBlueGlow.copy(alpha = 0.14f), Color.Transparent),
                        center = Offset(w * 0.18f, h * 0.75f),
                        radius = w * 0.65f
                    )
                )
                for ((idx, s) in stars.withIndex()) {
                    val alpha = (0.25f + 0.5f * sin(starTwinkle + idx)).coerceIn(0.1f, 0.85f)
                    drawCircle(
                        color = if (idx % 2 == 0) IceBlueBright.copy(alpha = alpha) else SynapticSpark.copy(alpha = alpha),
                        radius = s.third,
                        center = Offset(s.first * w, s.second * h)
                    )
                }
            }

            Column(modifier = Modifier.fillMaxSize()) {
                JarvisHeader(
                    title = "J · A · R · V · I · S",
                    subtitle = "COMMAND CENTER • STARK OS 2050",
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

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Startup Voice-Synthesized Daily Summary Card
                        if (!startupSummaryDismissed) {
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

                        // Central Holographic JARVIS AI CORE Hero Card
                        HeroCommandCoreCard(
                            greeting = greeting,
                            audioLevel = audioLevel,
                            isListening = isListening,
                            dailyBriefing = dailyBriefing,
                            onSpeakBriefing = { viewModel.speakDailySummary() },
                            onRefreshBriefing = { viewModel.refreshDailyBriefing(forceRefresh = true) },
                            onOpenChat = { viewModel.navigateTo(ScreenDestination.CHAT) }
                        )

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
                                        geminiModelName = viewModel.aiRepository.modelName
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
                                geminiModelName = viewModel.aiRepository.modelName
                            )
                        }

                        // Preserved Subsystems Strip
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
            containerColor = ObsidianBlack,
            title = { Text("Operator Profile • SIR", color = IceBlueBright, fontFamily = FontFamily.Monospace) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Active Orchestrator: ${activeAgent.codename}", color = MetallicSilver, fontSize = 13.sp)
                    Text("Security Clearance: DEFCON ${securityReport.defconLevel} (${securityReport.score}/100)", color = SentinelEmerald, fontSize = 12.sp)
                    Text("Gemini AI Logic: ${if (viewModel.isGeminiReady) "Connected" else "API Key Required"}", color = MetallicSilverMuted, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showProfileDialog = false
                        viewModel.navigateTo(ScreenDestination.SETTINGS)
                    }
                ) { Text("Settings") }
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
private fun StartupDailySummaryCard(
    dailyBriefing: DailyBriefingState,
    pendingTasksCount: Int,
    highPriorityPendingCount: Int,
    securityReport: com.example.security.SecurityReport,
    autoSpeakOnLaunch: Boolean,
    onPlay: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
    onDismiss: () -> Unit,
    onToggleAutoSpeak: (Boolean) -> Unit,
    onOpenTasks: () -> Unit,
    onOpenSecurity: () -> Unit
) {
    val speechState = dailyBriefing.startupSpeechState
    val statusText = when (speechState) {
        StartupBriefingSpeechState.PREPARING -> stringResource(R.string.daily_summary_status_preparing)
        StartupBriefingSpeechState.SPEAKING -> stringResource(R.string.daily_summary_status_speaking)
        StartupBriefingSpeechState.PAUSED -> stringResource(R.string.daily_summary_status_paused)
        StartupBriefingSpeechState.COMPLETED -> stringResource(R.string.daily_summary_status_completed)
        StartupBriefingSpeechState.MUTED -> stringResource(R.string.daily_summary_status_muted)
        StartupBriefingSpeechState.DISABLED -> stringResource(R.string.daily_summary_status_disabled)
        StartupBriefingSpeechState.READY -> stringResource(R.string.daily_summary_status_ready)
    }
    val statusColor = when (speechState) {
        StartupBriefingSpeechState.SPEAKING -> IceBlueBright
        StartupBriefingSpeechState.PAUSED -> QuantumGold
        StartupBriefingSpeechState.COMPLETED -> SentinelEmerald
        StartupBriefingSpeechState.MUTED, StartupBriefingSpeechState.DISABLED -> MetallicSilverMuted
        else -> IceBlue
    }
    val hasWeather = DailySummaryComposer.isWeatherSummaryAvailable(dailyBriefing.weatherSummary)
    val securityHud = dailyBriefing.securitySummary.ifBlank {
        DailySummaryComposer.buildSecurityHudSummary(securityReport)
    }
    val securityColor = when {
        securityReport.defconLevel == 1 -> AlertCrimson
        securityReport.defconLevel <= 4 -> QuantumGold
        else -> SentinelEmerald
    }
    val previewText = dailyBriefing.spokenSummary.ifBlank {
        "${dailyBriefing.greeting.ifBlank { DailySummaryComposer.getTimeGreeting() }} ${dailyBriefing.tasksSummary}"
    }

    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("startup_daily_summary_card"),
        borderColor = statusColor.copy(alpha = 0.5f)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = if (speechState == StartupBriefingSpeechState.MUTED) {
                            Icons.AutoMirrored.Filled.VolumeOff
                        } else {
                            Icons.AutoMirrored.Filled.VolumeUp
                        },
                        contentDescription = stringResource(R.string.daily_summary_title),
                        tint = statusColor,
                        modifier = Modifier.size(18.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.daily_summary_title),
                                color = IceBlueBright,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = statusText,
                                color = statusColor,
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                modifier = Modifier
                                    .background(statusColor.copy(alpha = 0.14f), RoundedCornerShape(6.dp))
                                    .border(1.dp, statusColor.copy(alpha = 0.45f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                    .testTag("startup_summary_status_badge")
                            )
                        }
                        Text(
                            text = stringResource(R.string.daily_summary_subtitle),
                            color = MetallicSilverMuted,
                            fontSize = 10.5.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                        .testTag("startup_summary_dismiss_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.daily_summary_dismiss),
                        tint = MetallicSilverMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Text(
                text = previewText,
                color = MetallicSilver,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianGlass, RoundedCornerShape(10.dp))
                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                    .padding(10.dp)
                    .testTag("startup_summary_preview_text")
            )

            // Tasks, Weather, and Security Snapshot Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .background(ObsidianGlass, RoundedCornerShape(10.dp))
                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                        .clickable { onOpenTasks() }
                        .padding(horizontal = 8.dp, vertical = 7.dp)
                        .testTag("startup_summary_tasks_chip"),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = if (pendingTasksCount == 0) Icons.Default.CheckCircle else Icons.Default.TaskAlt,
                            contentDescription = stringResource(R.string.daily_summary_pending_tasks_label),
                            tint = if (pendingTasksCount == 0) SentinelEmerald else IceBlueBright,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = stringResource(R.string.daily_summary_pending_tasks_label),
                            color = MetallicSilverMuted,
                            fontSize = 8.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Text(
                        text = if (pendingTasksCount == 0) {
                            stringResource(R.string.daily_summary_all_tasks_done)
                        } else if (highPriorityPendingCount > 0) {
                            "$pendingTasksCount ($highPriorityPendingCount high)"
                        } else {
                            "$pendingTasksCount pending"
                        },
                        color = MetallicSilver,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .background(ObsidianGlass, RoundedCornerShape(10.dp))
                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                        .padding(horizontal = 8.dp, vertical = 7.dp)
                        .testTag("startup_summary_weather_chip"),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = Icons.Default.WbSunny,
                            contentDescription = stringResource(R.string.daily_summary_weather_label),
                            tint = if (hasWeather) QuantumGold else MetallicSilverMuted,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = stringResource(R.string.daily_summary_weather_label),
                            color = MetallicSilverMuted,
                            fontSize = 8.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Text(
                        text = when {
                            hasWeather -> dailyBriefing.weatherSummary
                            dailyBriefing.isLoading -> stringResource(R.string.daily_summary_weather_syncing)
                            else -> stringResource(R.string.daily_summary_weather_standby)
                        },
                        color = MetallicSilver,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .background(ObsidianGlass, RoundedCornerShape(10.dp))
                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                        .clickable { onOpenSecurity() }
                        .padding(horizontal = 8.dp, vertical = 7.dp)
                        .testTag("startup_summary_security_chip"),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = stringResource(R.string.daily_summary_security_label),
                            tint = securityColor,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = stringResource(R.string.daily_summary_security_label),
                            color = MetallicSilverMuted,
                            fontSize = 8.5.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Text(
                        text = securityHud,
                        color = securityColor,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Playback controls & launch toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    when (speechState) {
                        StartupBriefingSpeechState.SPEAKING -> {
                            OutlinedButton(
                                onClick = onPause,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("startup_summary_pause_btn"),
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, QuantumGold.copy(alpha = 0.6f))
                            ) {
                                Icon(Icons.Default.Pause, contentDescription = stringResource(R.string.daily_summary_pause), tint = QuantumGold, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(stringResource(R.string.daily_summary_pause), color = QuantumGold, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                            OutlinedButton(
                                onClick = onStop,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("startup_summary_stop_btn"),
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, AlertCrimson.copy(alpha = 0.6f))
                            ) {
                                Icon(Icons.Default.Stop, contentDescription = stringResource(R.string.daily_summary_stop), tint = AlertCrimson, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(stringResource(R.string.daily_summary_stop), color = AlertCrimson, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                        StartupBriefingSpeechState.PAUSED -> {
                            Button(
                                onClick = onResume,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("startup_summary_resume_btn"),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = IceBlueBright, contentColor = ObsidianBlack)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = stringResource(R.string.daily_summary_resume), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(stringResource(R.string.daily_summary_resume), fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = onStop,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("startup_summary_stop_btn"),
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, AlertCrimson.copy(alpha = 0.6f))
                            ) {
                                Icon(Icons.Default.Stop, contentDescription = stringResource(R.string.daily_summary_stop), tint = AlertCrimson, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(stringResource(R.string.daily_summary_stop), color = AlertCrimson, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                        else -> {
                            Button(
                                onClick = onPlay,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("startup_summary_play_btn"),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = IceBlue.copy(alpha = 0.22f),
                                    contentColor = IceBlueBright
                                )
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = stringResource(R.string.daily_summary_play), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (speechState == StartupBriefingSpeechState.COMPLETED) {
                                        stringResource(R.string.daily_summary_replay)
                                    } else {
                                        stringResource(R.string.daily_summary_play)
                                    },
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = stringResource(R.string.daily_summary_auto_launch_label),
                        color = MetallicSilverMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Switch(
                        checked = autoSpeakOnLaunch,
                        onCheckedChange = onToggleAutoSpeak,
                        modifier = Modifier.testTag("startup_summary_auto_switch"),
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = ObsidianBlack,
                            checkedTrackColor = IceBlueBright
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun HeroCommandCoreCard(
    greeting: String,
    audioLevel: Float,
    isListening: Boolean,
    dailyBriefing: DailyBriefingState,
    onSpeakBriefing: () -> Unit,
    onRefreshBriefing: () -> Unit,
    onOpenChat: () -> Unit
) {
    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("hero_command_core_card"),
        borderColor = IceBlue.copy(alpha = 0.45f)
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
                        color = MetallicSilver,
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
                    border = androidx.compose.foundation.BorderStroke(1.dp, IceBlue.copy(alpha = 0.45f))
                ) {
                    Icon(Icons.Default.Chat, contentDescription = "Open Neural Chat", tint = IceBlueBright, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Neural Chat", color = IceBlueBright, fontSize = 11.5.sp)
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                contentAlignment = Alignment.Center
            ) {
                NeuralIntelligenceCanvas(
                    modifier = Modifier.fillMaxSize(),
                    audioPulse = audioLevel,
                    nodeCount = 56,
                    isInteractive = true,
                    showCoreLabel = true
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianGlass, RoundedCornerShape(10.dp))
                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
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
                        color = IceBlueBright,
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
                            Icon(Icons.Default.VolumeUp, contentDescription = "Read aloud", tint = IceBlueBright, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Speak", color = IceBlueBright, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                        Row(
                            modifier = Modifier
                                .clickable(enabled = !dailyBriefing.isLoading) { onRefreshBriefing() }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                                .testTag("briefing_refresh_btn"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh briefing", tint = MetallicSilver, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (dailyBriefing.isLoading) "..." else "Refresh", color = MetallicSilver, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }

                Text(
                    text = dailyBriefing.error ?: dailyBriefing.aiLine.ifBlank { "Synchronizing executive telemetry..." },
                    color = if (dailyBriefing.error != null) QuantumGold else MetallicSilver,
                    fontSize = 12.sp,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${dailyBriefing.weatherSummary} • ${if (isListening) "Voice Matrix Active" else dailyBriefing.tasksSummary}",
                    color = IceBlueBright,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
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
    val items = remember {
        listOf(
            SubsystemQuickItem("Neural Chat", Icons.Default.Chat, IceBlueBright, ScreenDestination.CHAT, "nav_chat_btn"),
            SubsystemQuickItem("Voice Matrix", Icons.Default.Mic, AtmosphericVioletGlow, ScreenDestination.VOICE_HUD, "nav_voice_btn"),
            SubsystemQuickItem("Multi-Agent", Icons.Default.AutoAwesome, QuantumGold, ScreenDestination.MULTI_AGENT, "nav_multiagent_btn"),
            SubsystemQuickItem("Security", Icons.Default.Security, SentinelEmerald, ScreenDestination.SECURITY, "nav_security_btn"),
            SubsystemQuickItem("Telemetry", Icons.Default.Terminal, IceBlueBright, ScreenDestination.SYSTEM_TELEMETRY, "nav_telemetry_btn"),
            SubsystemQuickItem("Plugins", Icons.Default.Extension, SynapticSpark, ScreenDestination.PLUGINS, "nav_plugins_btn"),
            SubsystemQuickItem("Smart Home", Icons.Default.Home, SentinelEmerald, ScreenDestination.SMART_HOME, "nav_smarthome_btn"),
            SubsystemQuickItem("Vision OCR", Icons.Default.CameraAlt, IceBlueBright, ScreenDestination.VISION_SCANNER, "nav_vision_btn"),
            SubsystemQuickItem("Insights", Icons.Default.Insights, IceBlue, ScreenDestination.INSIGHTS, "nav_insights_btn"),
            SubsystemQuickItem("Settings", Icons.Default.Settings, QuantumGold, ScreenDestination.SETTINGS, "nav_settings_btn")
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "SUBSYSTEMS & MODULES",
            color = MetallicSilverMuted,
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
                            .background(ObsidianGlass, RoundedCornerShape(10.dp))
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                            .clickable { onNavigate(item.dest) }
                            .padding(horizontal = 10.dp, vertical = 10.dp)
                            .testTag(item.tag),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(item.icon, contentDescription = item.title, tint = item.accent, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(item.title, color = MetallicSilver, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickNewTaskDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var due by remember { mutableStateOf("Today 17:00") }
    var priority by remember { mutableStateOf("HIGH") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = ObsidianBlack,
        title = { Text("Create Mission Task", color = IceBlueBright, fontFamily = FontFamily.Monospace) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Task Objective") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = due,
                    onValueChange = { due = it },
                    label = { Text("Due Window") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("HIGH", "MEDIUM", "LOW").forEach { level ->
                        FilterChip(
                            selected = priority == level,
                            onClick = { priority = level },
                            label = { Text(level, fontSize = 11.sp) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank()) onSave(title.trim(), due.trim(), priority) },
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = IceBlueBright, contentColor = ObsidianBlack)
            ) { Text("Create Task") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = MetallicSilverMuted) }
        }
    )
}

@Composable
private fun CommandSearchDialog(
    tasks: List<com.example.data.db.TaskEntity>,
    memoriesCount: Int,
    onNavigate: (ScreenDestination) -> Unit,
    onDismiss: () -> Unit
) {
    var query by remember { mutableStateOf("") }
    val routes = remember {
        listOf(
            "AI Core / Neural Chat" to ScreenDestination.CHAT,
            "Agents & Workflows" to ScreenDestination.MULTI_AGENT,
            "Tasks & Calendar Planner" to ScreenDestination.PRODUCTIVITY,
            "Memory Vault" to ScreenDestination.MEMORY_VAULT,
            "Insights & Analytics" to ScreenDestination.INSIGHTS,
            "Tools & Skills / Plugins" to ScreenDestination.PLUGINS,
            "Voice Matrix HUD" to ScreenDestination.VOICE_HUD,
            "Stark Security Perimeter" to ScreenDestination.SECURITY,
            "System Telemetry & CLI" to ScreenDestination.SYSTEM_TELEMETRY,
            "Settings" to ScreenDestination.SETTINGS
        )
    }
    val q = query.trim().lowercase()
    val filteredRoutes = remember(q) {
        if (q.isBlank()) routes.take(5) else routes.filter { it.first.lowercase().contains(q) }
    }
    val filteredTasks = remember(q, tasks) {
        if (q.isBlank()) tasks.take(3) else tasks.filter { it.title.lowercase().contains(q) }.take(4)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = ObsidianBlack,
        title = { Text("Search Command Center", color = IceBlueBright, fontFamily = FontFamily.Monospace) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Search modules, tasks, vault ($memoriesCount memories)...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                filteredRoutes.forEach { (label, dest) ->
                    Text(
                        text = "• Module: $label",
                        color = IceBlueBright,
                        fontSize = 12.5.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 40.dp)
                            .clickable { onNavigate(dest) }
                            .padding(vertical = 6.dp)
                    )
                }
                filteredTasks.forEach { t ->
                    Text(
                        text = "• Task: ${t.title} (${t.dueTime})",
                        color = MetallicSilver,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate(ScreenDestination.PRODUCTIVITY) }
                            .padding(vertical = 4.dp)
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close", color = IceBlueBright) }
        }
    )
}

@Composable
private fun CommandNotificationsDialog(
    pendingTasks: List<com.example.data.db.TaskEntity>,
    securityLogs: List<com.example.data.db.SecurityLogEntity>,
    onOpenPlanner: () -> Unit,
    onOpenSecurity: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = ObsidianBlack,
        title = { Text("Command Alerts", color = QuantumGold, fontFamily = FontFamily.Monospace) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("PENDING TASKS (${pendingTasks.size})", color = IceBlueBright, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                if (pendingTasks.isEmpty()) {
                    Text("All mission tasks completed.", color = SentinelEmerald, fontSize = 12.sp)
                } else {
                    pendingTasks.forEach { t ->
                        Text("• ${t.title} (${t.dueTime})", color = MetallicSilver, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text("SECURITY STREAM", color = SentinelEmerald, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                securityLogs.forEach { log ->
                    Text("• [${log.severity}] ${log.description}", color = MetallicSilverMuted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        },
        confirmButton = {
            Button(onClick = onOpenPlanner) { Text("Planner") }
        },
        dismissButton = {
            TextButton(onClick = onOpenSecurity) { Text("Security", color = SentinelEmerald) }
        }
    )
}
