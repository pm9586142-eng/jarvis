package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.db.SecurityLogEntity
import com.example.data.db.TaskEntity
import com.example.productivity.DailySummaryComposer
import com.example.security.SecurityReport
import com.example.ui.DailyBriefingState
import com.example.ui.ScreenDestination
import com.example.ui.StartupBriefingSpeechState
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun StartupDailySummaryCard(
    dailyBriefing: DailyBriefingState,
    pendingTasksCount: Int,
    highPriorityPendingCount: Int,
    securityReport: SecurityReport,
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
    val tokens = LocalJarvisTokens.current
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
        StartupBriefingSpeechState.SPEAKING -> tokens.accentBright
        StartupBriefingSpeechState.PAUSED -> QuantumGold
        StartupBriefingSpeechState.COMPLETED -> SentinelEmerald
        StartupBriefingSpeechState.MUTED, StartupBriefingSpeechState.DISABLED -> tokens.textMuted
        else -> tokens.accent
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
                                color = tokens.accentBright,
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
                            color = tokens.textMuted,
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
                        tint = tokens.textMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Text(
                text = previewText,
                color = tokens.textPrimary,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tokens.surfaceBg, RoundedCornerShape(10.dp))
                    .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                    .padding(10.dp)
                    .testTag("startup_summary_preview_text")
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .background(tokens.surfaceBg, RoundedCornerShape(10.dp))
                        .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                        .clickable { onOpenTasks() }
                        .padding(horizontal = 8.dp, vertical = 7.dp)
                        .testTag("startup_summary_tasks_chip"),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = if (pendingTasksCount == 0) Icons.Default.CheckCircle else Icons.Default.TaskAlt,
                            contentDescription = stringResource(R.string.daily_summary_pending_tasks_label),
                            tint = if (pendingTasksCount == 0) SentinelEmerald else tokens.accentBright,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = stringResource(R.string.daily_summary_pending_tasks_label),
                            color = tokens.textMuted,
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
                        color = tokens.textPrimary,
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
                        .background(tokens.surfaceBg, RoundedCornerShape(10.dp))
                        .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                        .padding(horizontal = 8.dp, vertical = 7.dp)
                        .testTag("startup_summary_weather_chip"),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            imageVector = Icons.Default.WbSunny,
                            contentDescription = stringResource(R.string.daily_summary_weather_label),
                            tint = if (hasWeather) QuantumGold else tokens.textMuted,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = stringResource(R.string.daily_summary_weather_label),
                            color = tokens.textMuted,
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
                        color = tokens.textPrimary,
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
                        .background(tokens.surfaceBg, RoundedCornerShape(10.dp))
                        .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
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
                            color = tokens.textMuted,
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
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = tokens.accentBright,
                                    contentColor = if (tokens.isLight) Color.White else tokens.screenBg
                                )
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
                                    containerColor = tokens.accent.copy(alpha = 0.22f),
                                    contentColor = tokens.accentBright
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
                        color = tokens.textMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Switch(
                        checked = autoSpeakOnLaunch,
                        onCheckedChange = onToggleAutoSpeak,
                        modifier = Modifier.testTag("startup_summary_auto_switch"),
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = if (tokens.isLight) Color.White else tokens.screenBg,
                            checkedTrackColor = tokens.accentBright
                        )
                    )
                }
            }
        }
    }
}

@Composable
fun QuickNewTaskDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit
) {
    val tokens = LocalJarvisTokens.current
    var title by remember { mutableStateOf("") }
    var due by remember { mutableStateOf("Today 17:00") }
    var priority by remember { mutableStateOf("HIGH") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = tokens.surfaceBg,
        title = { Text("Create Mission Task", color = tokens.accentBright, fontFamily = FontFamily.Monospace) },
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
                colors = ButtonDefaults.buttonColors(
                    containerColor = tokens.accentBright,
                    contentColor = if (tokens.isLight) Color.White else tokens.screenBg
                )
            ) { Text("Create Task") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = tokens.textMuted) }
        }
    )
}

@Composable
fun CommandSearchDialog(
    tasks: List<TaskEntity>,
    memoriesCount: Int,
    onNavigate: (ScreenDestination) -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    var query by remember { mutableStateOf("") }
    val routes = remember {
        listOf(
            "AI Core / Neural Chat" to ScreenDestination.CHAT,
            "Multi-AI Brain Control Center" to ScreenDestination.MULTI_AI_CENTER,
            "Research & Report Studio" to ScreenDestination.RESEARCH_STUDIO,
            "Ultron 3D Holographic AI" to ScreenDestination.ULTRON_HOLOGRAM,
            "Orbital Aegis 3D Space Game" to ScreenDestination.ORBITAL_GAME,
            "Music Studio" to ScreenDestination.MUSIC_STUDIO,
            "Web Automation Hub" to ScreenDestination.AUTOMATION_HUB,
            "YouTube & Safe Web Browser" to ScreenDestination.YOUTUBE_MEDIA,
            "Ecosystem Sync & Diagnostics" to ScreenDestination.ECOSYSTEM_DIAGNOSTICS,
            "Agents & Workflows" to ScreenDestination.MULTI_AGENT,
            "Tasks & Calendar Planner" to ScreenDestination.PRODUCTIVITY,
            "Memory Vault" to ScreenDestination.MEMORY_VAULT,
            "OpenJarvis Core" to ScreenDestination.OPEN_JARVIS,
            "Voice Matrix HUD" to ScreenDestination.VOICE_HUD,
            "Security Matrix" to ScreenDestination.SECURITY,
            "System Telemetry & CLI" to ScreenDestination.SYSTEM_TELEMETRY,
            "Settings" to ScreenDestination.SETTINGS
        )
    }
    val q = query.trim().lowercase()
    val filteredRoutes = remember(q) {
        if (q.isBlank()) routes.take(6) else routes.filter { it.first.lowercase().contains(q) }
    }
    val filteredTasks = remember(q, tasks) {
        if (q.isBlank()) tasks.take(3) else tasks.filter { it.title.lowercase().contains(q) }.take(4)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = tokens.surfaceBg,
        title = { Text("Search Command Center", color = tokens.accentBright, fontFamily = FontFamily.Monospace) },
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
                        color = tokens.accentBright,
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
                        color = tokens.textPrimary,
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
            TextButton(onClick = onDismiss) { Text("Close", color = tokens.accentBright) }
        }
    )
}

@Composable
fun CommandNotificationsDialog(
    pendingTasks: List<TaskEntity>,
    securityLogs: List<SecurityLogEntity>,
    onOpenPlanner: () -> Unit,
    onOpenSecurity: () -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = tokens.surfaceBg,
        title = { Text("Command Alerts", color = QuantumGold, fontFamily = FontFamily.Monospace) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("PENDING TASKS (${pendingTasks.size})", color = tokens.accentBright, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                if (pendingTasks.isEmpty()) {
                    Text("All mission tasks completed.", color = SentinelEmerald, fontSize = 12.sp)
                } else {
                    pendingTasks.forEach { t ->
                        Text("• ${t.title} (${t.dueTime})", color = tokens.textPrimary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text("SECURITY STREAM", color = SentinelEmerald, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                securityLogs.forEach { log ->
                    Text("• [${log.severity}] ${log.description}", color = tokens.textMuted, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
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
