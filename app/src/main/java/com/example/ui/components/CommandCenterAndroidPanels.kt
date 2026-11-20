package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.AddTask
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.FolderShared
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.agents.JarvisAgent
import com.example.data.db.ConversationEntity
import com.example.data.db.SecurityLogEntity
import com.example.data.db.TaskEntity
import com.example.security.SecurityReport
import com.example.system.SystemTelemetry
import com.example.ui.DailyBriefingState
import com.example.ui.ScreenDestination
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import com.example.ui.theme.SynapticSpark
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class CommandDrawerEntry(
    val label: String,
    val icon: ImageVector,
    val destination: ScreenDestination,
    val tag: String
)

@Composable
fun CommandCenterDrawerContent(
    currentScreen: ScreenDestination,
    onSelectDestination: (ScreenDestination) -> Unit,
    onCloseDrawer: () -> Unit
) {
    val primaryNav = remember {
        listOf(
            CommandDrawerEntry("Command Center", Icons.Default.Dashboard, ScreenDestination.DASHBOARD, "drawer_command_center"),
            CommandDrawerEntry("AI Core", Icons.Default.AutoAwesome, ScreenDestination.CHAT, "drawer_ai_core"),
            CommandDrawerEntry("Agents", Icons.Default.SmartToy, ScreenDestination.MULTI_AGENT, "drawer_agents"),
            CommandDrawerEntry("Tasks", Icons.Default.TaskAlt, ScreenDestination.PRODUCTIVITY, "drawer_tasks"),
            CommandDrawerEntry("Calendar", Icons.Default.CalendarToday, ScreenDestination.PRODUCTIVITY, "drawer_calendar"),
            CommandDrawerEntry("Memory", Icons.Default.FolderShared, ScreenDestination.MEMORY_VAULT, "drawer_memory"),
            CommandDrawerEntry("Conversations", Icons.AutoMirrored.Filled.Chat, ScreenDestination.CHAT, "drawer_conversations"),
            CommandDrawerEntry("Knowledge Base", Icons.Default.Insights, ScreenDestination.INSIGHTS, "drawer_knowledge_base"),
            CommandDrawerEntry("Tools & Skills", Icons.Default.Extension, ScreenDestination.PLUGINS, "drawer_tools_skills"),
            CommandDrawerEntry("Workflows", Icons.Default.AccountTree, ScreenDestination.MULTI_AGENT, "drawer_workflows")
        )
    }

    val subsystemsNav = remember {
        listOf(
            CommandDrawerEntry("Voice Matrix", Icons.Default.Mic, ScreenDestination.VOICE_HUD, "drawer_voice"),
            CommandDrawerEntry("YouTube Media", Icons.Default.PlayArrow, ScreenDestination.YOUTUBE_MEDIA, "drawer_youtube_media"),
            CommandDrawerEntry("Stark Security", Icons.Default.Security, ScreenDestination.SECURITY, "drawer_security"),
            CommandDrawerEntry("Telemetry & CLI", Icons.Default.Terminal, ScreenDestination.SYSTEM_TELEMETRY, "drawer_telemetry"),
            CommandDrawerEntry("Smart Home", Icons.Default.Home, ScreenDestination.SMART_HOME, "drawer_smart_home"),
            CommandDrawerEntry("Vision Scanner", Icons.Default.CameraAlt, ScreenDestination.VISION_SCANNER, "drawer_vision"),
            CommandDrawerEntry("System Settings", Icons.Default.Settings, ScreenDestination.SETTINGS, "drawer_settings")
        )
    }

    ModalDrawerSheet(
        drawerContainerColor = ObsidianBlack,
        drawerContentColor = MetallicSilver
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .background(IceBlue.copy(alpha = 0.16f), CircleShape)
                        .border(1.dp, IceBlueBright.copy(alpha = 0.6f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "J",
                        color = IceBlueBright,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "J·A·R·V·I·S",
                        color = IceBlueBright,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = "COMMAND CENTER",
                        color = MetallicSilverMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            HorizontalDivider(color = ObsidianGlassBorder, modifier = Modifier.padding(vertical = 8.dp))

            Text(
                text = "PRIMARY COMMAND",
                color = IceBlueBright,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )

            primaryNav.forEach { item ->
                val selected = currentScreen == item.destination && item.label == "Command Center"
                NavigationDrawerItem(
                    label = {
                        Text(
                            text = item.label,
                            fontSize = 13.5.sp,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                        )
                    },
                    icon = {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = item.label,
                            modifier = Modifier.size(19.dp)
                        )
                    },
                    selected = selected,
                    onClick = {
                        onCloseDrawer()
                        onSelectDestination(item.destination)
                    },
                    colors = NavigationDrawerItemDefaults.colors(
                        selectedContainerColor = IceBlue.copy(alpha = 0.18f),
                        selectedIconColor = IceBlueBright,
                        selectedTextColor = IceBlueBright,
                        unselectedContainerColor = Color.Transparent,
                        unselectedIconColor = MetallicSilverMuted,
                        unselectedTextColor = MetallicSilver
                    ),
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .testTag(item.tag)
                )
            }

            HorizontalDivider(color = ObsidianGlassBorder, modifier = Modifier.padding(vertical = 8.dp))

            Text(
                text = "SUBSYSTEMS",
                color = MetallicSilverMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )

            subsystemsNav.forEach { item ->
                NavigationDrawerItem(
                    label = { Text(text = item.label, fontSize = 13.sp) },
                    icon = {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = item.label,
                            modifier = Modifier.size(18.dp)
                        )
                    },
                    selected = currentScreen == item.destination,
                    onClick = {
                        onCloseDrawer()
                        onSelectDestination(item.destination)
                    },
                    colors = NavigationDrawerItemDefaults.colors(
                        selectedContainerColor = IceBlue.copy(alpha = 0.16f),
                        selectedIconColor = IceBlueBright,
                        selectedTextColor = IceBlueBright,
                        unselectedContainerColor = Color.Transparent,
                        unselectedIconColor = MetallicSilverMuted,
                        unselectedTextColor = MetallicSilver
                    ),
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .testTag(item.tag)
                )
            }

            HorizontalDivider(color = ObsidianGlassBorder, modifier = Modifier.padding(vertical = 8.dp))

            NavigationDrawerItem(
                label = { Text("Biometric Lock Gate", fontSize = 13.sp) },
                icon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Biometric Lock Gate",
                        modifier = Modifier.size(18.dp)
                    )
                },
                selected = false,
                onClick = {
                    onCloseDrawer()
                    onSelectDestination(ScreenDestination.OPENING)
                },
                colors = NavigationDrawerItemDefaults.colors(
                    unselectedContainerColor = QuantumGold.copy(alpha = 0.08f),
                    unselectedIconColor = QuantumGold,
                    unselectedTextColor = QuantumGold
                ),
                modifier = Modifier
                    .defaultMinSize(minHeight = 48.dp)
                    .testTag("drawer_biometric_gate")
            )
        }
    }
}

@Composable
fun AiCoreOverviewPanel(
    isGeminiReady: Boolean,
    memoryCount: Int,
    isListening: Boolean,
    telemetry: SystemTelemetry,
    securityReport: SecurityReport
) {
    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("ai_core_overview_panel"),
        borderColor = IceBlue.copy(alpha = 0.38f)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "AI CORE OVERVIEW",
                color = IceBlueBright,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )

            val metrics = listOf(
                Triple("AI Core", if (isGeminiReady) "Active" else "Standby", if (isGeminiReady) SentinelEmerald else QuantumGold),
                Triple("Memory", "$memoryCount Vaulted", SentinelEmerald),
                Triple("Voice", if (isListening) "Listening" else "Online", if (isListening) IceBlueBright else SentinelEmerald),
                Triple("Agents", "${JarvisAgent.entries.size} Ready", IceBlueBright),
                Triple("LLMs", if (isGeminiReady) "Gemini OK" else "Key Needed", if (isGeminiReady) SentinelEmerald else QuantumGold),
                Triple(
                    "System",
                    if (securityReport.defconLevel == 1) "Lockdown" else if (telemetry.isConnected) "Optimal" else "Offline",
                    if (securityReport.defconLevel == 1) AlertCrimson else if (telemetry.isConnected) SentinelEmerald else QuantumGold
                )
            )

            metrics.chunked(3).forEach { rowItems ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    rowItems.forEach { (label, status, color) ->
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .background(ObsidianGlass, RoundedCornerShape(10.dp))
                                .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = label.uppercase(),
                                color = MetallicSilverMuted,
                                fontSize = 9.5.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = status,
                                color = color,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

private data class CommandAgentCardItem(
    val title: String,
    val role: String,
    val stateLabel: String,
    val accent: Color,
    val icon: ImageVector,
    val agentToSelect: JarvisAgent?,
    val targetScreen: ScreenDestination
)

@Composable
fun ActiveAgentsCommandPanel(
    onOpenAgent: (JarvisAgent?, ScreenDestination) -> Unit
) {
    val agents = remember {
        listOf(
            CommandAgentCardItem("Coding Agent", "DUM-E Architect", "ONLINE", QuantumGold, Icons.Default.Build, JarvisAgent.DUM_E_ENGINEER, ScreenDestination.CHAT),
            CommandAgentCardItem("Research Agent", "VERONICA Intel", "READY", IceBlueBright, Icons.Default.TravelExplore, JarvisAgent.VERONICA_RESEARCH, ScreenDestination.CHAT),
            CommandAgentCardItem("Memory Agent", "SQLite Vault", "SYNCED", SentinelEmerald, Icons.Default.FolderShared, null, ScreenDestination.MEMORY_VAULT),
            CommandAgentCardItem("Browser Agent", "Web Grounding", "STANDBY", AtmosphericVioletGlow, Icons.Default.AutoAwesome, JarvisAgent.VERONICA_RESEARCH, ScreenDestination.PLUGINS),
            CommandAgentCardItem("Task Agent", "FRIDAY Planner", "ONLINE", SentinelEmerald, Icons.Default.TaskAlt, JarvisAgent.FRIDAY_COORDINATOR, ScreenDestination.PRODUCTIVITY),
            CommandAgentCardItem("System Agent", "HOMER Sentinel", "ACTIVE", AlertCrimson, Icons.Default.Memory, JarvisAgent.HOMER_DIAGNOSTICS, ScreenDestination.SYSTEM_TELEMETRY)
        )
    }

    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("active_agents_panel"),
        borderColor = ObsidianGlassBorder
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "ACTIVE AGENTS",
                    color = IceBlueBright,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "6 NODES",
                    color = SentinelEmerald,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            agents.chunked(2).forEach { pair ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    pair.forEach { card ->
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 56.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(ObsidianGlass)
                                .border(1.dp, card.accent.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                                .clickable { onOpenAgent(card.agentToSelect, card.targetScreen) }
                                .padding(horizontal = 10.dp, vertical = 10.dp)
                                .testTag("agent_card_${card.title.lowercase().replace(" ", "_")}"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(card.accent.copy(alpha = 0.16f), RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = card.icon,
                                    contentDescription = card.title,
                                    tint = card.accent,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = card.title,
                                    color = MetallicSilver,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "${card.role} • ${card.stateLabel}",
                                    color = card.accent,
                                    fontSize = 9.5.sp,
                                    fontFamily = FontFamily.Monospace,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun QuickCommandsPanel(
    onStartNewTask: () -> Unit,
    onOpenCalendar: () -> Unit,
    onStartVoiceChat: () -> Unit,
    onRunWorkflow: () -> Unit
) {
    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("quick_commands_panel"),
        borderColor = IceBlue.copy(alpha = 0.3f)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "QUICK COMMANDS",
                color = IceBlueBright,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickCmdBtn(
                    modifier = Modifier.weight(1f),
                    label = "Start New Task",
                    icon = Icons.Default.AddTask,
                    accent = IceBlueBright,
                    tag = "quick_cmd_new_task",
                    onClick = onStartNewTask
                )
                QuickCmdBtn(
                    modifier = Modifier.weight(1f),
                    label = "Open Calendar",
                    icon = Icons.Default.CalendarToday,
                    accent = QuantumGold,
                    tag = "quick_cmd_calendar",
                    onClick = onOpenCalendar
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickCmdBtn(
                    modifier = Modifier.weight(1f),
                    label = "Start Voice Chat",
                    icon = Icons.Default.Mic,
                    accent = SentinelEmerald,
                    tag = "quick_cmd_voice_chat",
                    onClick = onStartVoiceChat
                )
                QuickCmdBtn(
                    modifier = Modifier.weight(1f),
                    label = "Run Workflow",
                    icon = Icons.Default.PlayArrow,
                    accent = AtmosphericVioletGlow,
                    tag = "quick_cmd_workflow",
                    onClick = onRunWorkflow
                )
            }
        }
    }
}

@Composable
private fun QuickCmdBtn(
    modifier: Modifier = Modifier,
    label: String,
    icon: ImageVector,
    accent: Color,
    tag: String,
    onClick: () -> Unit
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .defaultMinSize(minHeight = 48.dp)
            .testTag(tag),
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.45f)),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = accent.copy(alpha = 0.08f),
            contentColor = accent
        )
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun LiveIntelligenceFeedPanel(
    conversations: List<ConversationEntity>,
    securityLogs: List<SecurityLogEntity>,
    onOpenChat: () -> Unit
) {
    val recentChats = remember(conversations) { conversations.takeLast(4).reversed() }
    val recentLogs = remember(securityLogs) { securityLogs.take(3) }

    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("live_intelligence_feed_panel"),
        borderColor = ObsidianGlassBorder
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "LIVE INTELLIGENCE FEED",
                    color = IceBlueBright,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "OPEN CHAT →",
                    color = IceBlueBright,
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier
                        .clickable { onOpenChat() }
                        .padding(vertical = 4.dp)
                )
            }

            if (recentChats.isEmpty() && recentLogs.isEmpty()) {
                Text(
                    text = "No neural transmissions recorded yet.",
                    color = MetallicSilverMuted,
                    fontSize = 12.sp
                )
            } else {
                recentChats.forEach { msg ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ObsidianGlass, RoundedCornerShape(8.dp))
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bolt,
                            contentDescription = null,
                            tint = if (msg.role == "user") QuantumGold else IceBlueBright,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "${msg.agentName} • ${formatCompactTime(msg.timestamp)}",
                                color = MetallicSilverMuted,
                                fontSize = 9.5.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = msg.text,
                                color = MetallicSilver,
                                fontSize = 11.5.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                recentLogs.forEach { log ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ObsidianGlass, RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = null,
                            tint = if (log.severity == "CRITICAL") AlertCrimson else SentinelEmerald,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "[${log.sourceAgent}] ${log.description}",
                            color = MetallicSilverMuted,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MissionTimelinePanel(
    tasks: List<TaskEntity>,
    onToggleTask: (TaskEntity) -> Unit,
    onOpenPlanner: () -> Unit
) {
    val sorted = remember(tasks) {
        tasks.sortedWith(compareBy<TaskEntity> { it.isCompleted }.thenByDescending { it.createdAt }).take(5)
    }

    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("mission_timeline_panel"),
        borderColor = ObsidianGlassBorder
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "MISSION TIMELINE",
                    color = IceBlueBright,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "PLANNER →",
                    color = QuantumGold,
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier
                        .clickable { onOpenPlanner() }
                        .padding(vertical = 4.dp)
                )
            }

            if (sorted.isEmpty()) {
                Text(
                    text = "No scheduled tasks or calendar objectives.",
                    color = MetallicSilverMuted,
                    fontSize = 12.sp
                )
            } else {
                sorted.forEach { task ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(ObsidianGlass)
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                            .clickable { onToggleTask(task) }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (task.isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                            contentDescription = if (task.isCompleted) "Completed" else "Pending",
                            tint = if (task.isCompleted) SentinelEmerald else IceBlueBright,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = task.title,
                                color = if (task.isCompleted) MetallicSilverMuted else MetallicSilver,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "${task.dueTime} • ${task.priority}",
                                color = if (task.priority == "HIGH") QuantumGold else MetallicSilverMuted,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SystemMonitorAndroidPanel(
    telemetry: SystemTelemetry,
    cpuCoreCount: Int
) {
    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("system_monitor_panel"),
        borderColor = ObsidianGlassBorder
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SYSTEM MONITOR",
                    color = IceBlueBright,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = if (telemetry.isConnected) telemetry.networkType else "OFFLINE",
                    color = if (telemetry.isConnected) SentinelEmerald else AlertCrimson,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("CPU Topology", color = MetallicSilverMuted, fontSize = 11.sp)
                    Text(
                        "$cpuCoreCount Cores (OS % Kernel-Restricted)",
                        color = IceBlueBright,
                        fontSize = 10.5.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("RAM Usage", color = MetallicSilverMuted, fontSize = 11.sp)
                    Text(
                        "${telemetry.ramUsedMb} / ${telemetry.ramTotalMb} MB (${telemetry.ramPercent}%)",
                        color = IceBlueBright,
                        fontSize = 10.5.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
                LinearProgressIndicator(
                    progress = { (telemetry.ramPercent / 100f).coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = IceBlueBright,
                    trackColor = ObsidianGlass
                )

                Spacer(modifier = Modifier.height(2.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Device Storage", color = MetallicSilverMuted, fontSize = 11.sp)
                    Text(
                        "${telemetry.storageUsedGb} / ${telemetry.storageTotalGb} GB (${telemetry.storagePercent}%)",
                        color = QuantumGold,
                        fontSize = 10.5.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
                LinearProgressIndicator(
                    progress = { (telemetry.storagePercent / 100f).coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = QuantumGold,
                    trackColor = ObsidianGlass
                )
            }
        }
    }
}

@Composable
fun MemoryInsightsAndroidPanel(
    memoryCount: Int,
    conversationCount: Int,
    taskCount: Int,
    onViewMemoryMap: () -> Unit
) {
    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("memory_insights_panel"),
        borderColor = ObsidianGlassBorder
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "MEMORY INSIGHTS",
                    color = IceBlueBright,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "View Memory Map →",
                    color = IceBlueBright,
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier
                        .clickable { onViewMemoryMap() }
                        .padding(vertical = 4.dp)
                        .testTag("view_memory_map_btn")
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InsightMiniStat(Modifier.weight(1f), "STORED", "$memoryCount", SentinelEmerald)
                InsightMiniStat(Modifier.weight(1f), "MESSAGES", "$conversationCount", IceBlueBright)
                InsightMiniStat(Modifier.weight(1f), "OBJECTIVES", "$taskCount", QuantumGold)
            }

            val bars = remember(memoryCount, conversationCount, taskCount) {
                listOf(
                    (memoryCount + 1).coerceAtLeast(1),
                    (conversationCount + 1).coerceAtLeast(1),
                    (taskCount + 1).coerceAtLeast(1),
                    ((memoryCount + taskCount) / 2 + 1).coerceAtLeast(1),
                    ((conversationCount + memoryCount) / 2 + 1).coerceAtLeast(1)
                )
            }
            val maxVal = (bars.maxOrNull() ?: 1).coerceAtLeast(1)

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .background(ObsidianGlass, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                val step = size.width / bars.size.coerceAtLeast(1)
                val barW = step * 0.55f
                bars.forEachIndexed { idx, value ->
                    val hRatio = (value.toFloat() / maxVal.toFloat()).coerceIn(0.15f, 1f)
                    val barH = size.height * hRatio
                    drawRoundRect(
                        color = if (idx % 2 == 0) IceBlueBright else SynapticSpark,
                        topLeft = Offset(idx * step + (step - barW) / 2f, size.height - barH),
                        size = Size(barW, barH),
                        cornerRadius = CornerRadius(6f, 6f)
                    )
                }
            }
        }
    }
}

@Composable
private fun InsightMiniStat(modifier: Modifier, label: String, value: String, color: Color) {
    Column(
        modifier = modifier
            .background(ObsidianGlass, RoundedCornerShape(8.dp))
            .padding(8.dp)
    ) {
        Text(label, color = MetallicSilverMuted, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
        Text(value, color = color, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
fun LlmStatusAndroidPanel(
    isGeminiReady: Boolean,
    geminiModelName: String
) {
    val providers = remember(isGeminiReady, geminiModelName) {
        listOf(
            "Gemini ($geminiModelName)" to (if (isGeminiReady) "CONNECTED" else "KEY MISSING"),
            "OpenAI" to "NOT CONFIGURED",
            "Claude" to "NOT CONFIGURED",
            "Groq" to "NOT CONFIGURED",
            "OpenRouter" to "NOT CONFIGURED",
            "Ollama" to "NOT CONFIGURED",
            "Claude Code" to "NOT CONFIGURED",
            "Cursor" to "NOT CONFIGURED",
            "Copilot" to "NOT CONFIGURED"
        )
    }

    NeuralGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("llm_status_panel"),
        borderColor = ObsidianGlassBorder
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "LLM & BRIDGE STATUS",
                color = IceBlueBright,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )

            providers.forEach { (name, state) ->
                val isConnected = state == "CONNECTED"
                val color = when (state) {
                    "CONNECTED" -> SentinelEmerald
                    "KEY MISSING" -> QuantumGold
                    else -> MetallicSilverMuted
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ObsidianGlass, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = name,
                        color = if (isConnected) MetallicSilver else MetallicSilverMuted,
                        fontSize = 11.5.sp,
                        fontWeight = if (isConnected) FontWeight.SemiBold else FontWeight.Normal,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = state,
                        color = color,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
fun CommandCenterBottomBar(
    telemetry: SystemTelemetry,
    dailyBriefing: DailyBriefingState,
    isListening: Boolean,
    audioLevel: Float,
    onToggleMic: () -> Unit,
    onTalkToJarvis: () -> Unit,
    onPlayBriefing: () -> Unit
) {
    val tzName = remember { TimeZone.getDefault().id.substringAfter('/').replace('_', ' ') }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(ObsidianBlack.copy(alpha = 0.96f))
            .border(1.dp, ObsidianGlassBorder)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "LOC: $tzName",
                color = MetallicSilverMuted,
                fontSize = 9.5.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = dailyBriefing.weatherSummary.take(28),
                color = IceBlueBright,
                fontSize = 9.5.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (telemetry.isConnected) "NET: ONLINE" else "NET: OFFLINE",
                color = if (telemetry.isConnected) SentinelEmerald else AlertCrimson,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        AudioWaveVisualizer(
            audioLevel = audioLevel,
            isActive = isListening,
            height = 24.dp,
            barCount = 24
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = onToggleMic,
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .testTag("bottom_mic_toggle_btn"),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isListening) AlertCrimson else IceBlue.copy(alpha = 0.5f)
                ),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = if (isListening) AlertCrimson.copy(alpha = 0.16f) else ObsidianGlass,
                    contentColor = if (isListening) AlertCrimson else IceBlueBright
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Mic,
                    contentDescription = if (isListening) "Stop Listening" else "Start Listening",
                    modifier = Modifier.size(18.dp)
                )
            }

            Button(
                onClick = onTalkToJarvis,
                modifier = Modifier
                    .weight(1f)
                    .defaultMinSize(minHeight = 48.dp)
                    .testTag("talk_to_jarvis_button"),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = IceBlueBright,
                    contentColor = ObsidianBlack
                )
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = "Talk to JARVIS",
                    modifier = Modifier.size(17.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (isListening) "LISTENING..." else "TALK TO JARVIS",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    maxLines = 1
                )
            }

            OutlinedButton(
                onClick = onPlayBriefing,
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .testTag("bottom_briefing_btn"),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, QuantumGold.copy(alpha = 0.5f)),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = ObsidianGlass,
                    contentColor = QuantumGold
                )
            ) {
                Icon(
                    imageVector = Icons.Default.VolumeUp,
                    contentDescription = "Executive Briefing",
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

private fun formatCompactTime(millis: Long): String {
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(millis))
}
