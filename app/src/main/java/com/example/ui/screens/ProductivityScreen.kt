package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun ProductivityScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    val isParsingReminder by viewModel.isParsingReminder.collectAsState()
    val reminderError by viewModel.reminderError.collectAsState()

    var smartReminderInput by remember { mutableStateOf("") }
    var notificationPermissionDenied by remember { mutableStateOf(false) }

    var hasNotifPermission by remember {
        mutableStateOf(
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
        )
    }

    var pendingSmartText by remember { mutableStateOf<String?>(null) }

    val notifPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasNotifPermission = granted
        notificationPermissionDenied = !granted
        val queued = pendingSmartText
        pendingSmartText = null
        if (!queued.isNullOrBlank()) {
            viewModel.createSmartReminder(queued)
            smartReminderInput = ""
        }
    }

    fun submitSmartReminder(text: String) {
        val cleaned = text.trim()
        if (cleaned.isBlank() || isParsingReminder) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
            pendingSmartText = cleaned
            notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            viewModel.createSmartReminder(cleaned)
            smartReminderInput = ""
        }
    }

    var showAddTaskDialog by remember { mutableStateOf(false) }
    var newTitle by remember { mutableStateOf("") }
    var newDescription by remember { mutableStateOf("") }
    var newDueTime by remember { mutableStateOf("15:00 Today") }
    val newPriority by remember { mutableStateOf("HIGH") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "EXECUTIVE PRODUCTIVITY",
            subtitle = "FRIDAY Agenda & Smart Reminders",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header summary card
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "STARK EXECUTIVE AGENDA",
                            color = IceBlueBright,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        val pending = tasks.count { !it.isCompleted }
                        Text(
                            text = "$pending Action Items Pending",
                            color = MetallicSilver,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Button(
                        onClick = { showAddTaskDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = IceBlue,
                            contentColor = ObsidianBlack
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.testTag("add_task_btn")
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "Add Task")
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("NEW ITEM", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Natural Language Smart Reminder Input Card
            NeuralGlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = IceBlue.copy(alpha = 0.45f)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = "Smart Reminder",
                                tint = IceBlueBright,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "SMART NATURAL REMINDER",
                                color = IceBlueBright,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
                            Text(
                                text = "ENABLE ALERTS",
                                color = QuantumGold,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .clickable {
                                        notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                    }
                                    .padding(4.dp)
                                    .testTag("enable_notif_btn")
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.NotificationsActive,
                                    contentDescription = "Notifications ready",
                                    tint = SentinelEmerald,
                                    modifier = Modifier.size(13.dp)
                                )
                                Text(
                                    text = "ALERTS ARMED",
                                    color = SentinelEmerald,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = smartReminderInput,
                            onValueChange = { smartReminderInput = it },
                            placeholder = {
                                Text(
                                    text = "remind me to call Raj tomorrow at 5 pm",
                                    color = MetallicSilverMuted,
                                    fontSize = 12.sp
                                )
                            },
                            singleLine = true,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("smart_reminder_input"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = MetallicSilver,
                                unfocusedTextColor = MetallicSilver,
                                focusedBorderColor = IceBlue,
                                unfocusedBorderColor = ObsidianGlassBorder,
                                focusedContainerColor = ObsidianGlass,
                                unfocusedContainerColor = ObsidianGlass
                            ),
                            shape = RoundedCornerShape(10.dp)
                        )
                        Button(
                            onClick = { submitSmartReminder(smartReminderInput) },
                            enabled = smartReminderInput.isNotBlank() && !isParsingReminder,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SentinelEmerald,
                                contentColor = ObsidianBlack
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .height(50.dp)
                                .testTag("schedule_smart_reminder_btn")
                        ) {
                            if (isParsingReminder) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = ObsidianBlack,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Alarm,
                                    contentDescription = "Schedule reminder",
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(
                            "Remind me to call Raj tomorrow at 5 pm",
                            "Check reactor telemetry in 10 minutes",
                            "Team briefing tonight at 8 pm"
                        ).forEach { preset ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(ObsidianGlass)
                                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                                    .clickable { smartReminderInput = preset }
                                    .padding(horizontal = 8.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = preset,
                                    color = IceBlueBright,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }

                    if (notificationPermissionDenied) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Notification permission denied. Task saved without system alert.",
                                color = QuantumGold,
                                fontSize = 10.sp,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(
                                onClick = {
                                    val intent = Intent(
                                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                        Uri.fromParts("package", context.packageName, null)
                                    ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                                    context.startActivity(intent)
                                }
                            ) {
                                Text("Settings", color = IceBlueBright, fontSize = 10.sp)
                            }
                        }
                    }

                    reminderError?.let { err ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = err,
                                color = AlertCrimson,
                                fontSize = 11.sp,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = { viewModel.clearReminderError() }) {
                                Text("Dismiss", color = MetallicSilverMuted, fontSize = 10.sp)
                            }
                        }
                    }
                }
            }

            // Task List with Empty State
            if (tasks.isEmpty()) {
                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Alarm,
                            contentDescription = "No tasks",
                            tint = IceBlue,
                            modifier = Modifier.size(28.dp)
                        )
                        Text(
                            text = "Agenda queue is clear, Sir.",
                            color = MetallicSilver,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Type a natural reminder above or tap NEW ITEM.",
                            color = MetallicSilverMuted,
                            fontSize = 11.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(tasks, key = { it.id }) { task ->
                        NeuralGlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            borderColor = if (task.isCompleted) ObsidianGlassBorder else IceBlue.copy(alpha = 0.3f)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = { viewModel.toggleTask(task) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = if (task.isCompleted) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                        contentDescription = "Toggle Complete",
                                        tint = if (task.isCompleted) SentinelEmerald else IceBlue
                                    )
                                }

                                Spacer(modifier = Modifier.width(10.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = task.title,
                                            color = if (task.isCompleted) MetallicSilverMuted else MetallicSilver,
                                            fontSize = 13.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.weight(1f, fill = false)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "[${task.priority}]",
                                            color = when (task.priority) {
                                                "HIGH" -> AlertCrimson
                                                "MEDIUM" -> QuantumGold
                                                else -> IceBlueBright
                                            },
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    if (task.description.isNotBlank()) {
                                        Text(
                                            text = task.description,
                                            color = MetallicSilverMuted,
                                            fontSize = 11.5.sp,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                    }
                                    if (task.dueTime.isNotBlank()) {
                                        Row(
                                            modifier = Modifier.padding(top = 3.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            if (task.triggerAtMillis != null && !task.isCompleted) {
                                                Icon(
                                                    imageVector = Icons.Default.Alarm,
                                                    contentDescription = "Scheduled alarm",
                                                    tint = SentinelEmerald,
                                                    modifier = Modifier.size(12.dp)
                                                )
                                            }
                                            Text(
                                                text = "Due: ${task.dueTime}",
                                                color = if (task.triggerAtMillis != null && !task.isCompleted) SentinelEmerald else IceBlueBright,
                                                fontSize = 10.5.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }
                                }

                                if (!task.isCompleted) {
                                    OutlinedButton(
                                        onClick = { viewModel.snoozeTask(task, 15) },
                                        shape = RoundedCornerShape(8.dp),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, QuantumGold.copy(alpha = 0.5f)),
                                        modifier = Modifier
                                            .padding(end = 4.dp)
                                            .testTag("snooze_task_${task.id}")
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Snooze,
                                            contentDescription = "Snooze 15m",
                                            tint = QuantumGold,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "+15m",
                                            color = QuantumGold,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }

                                IconButton(
                                    onClick = { viewModel.deleteTask(task) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Delete",
                                        tint = MetallicSilverMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Add Task Dialog
    if (showAddTaskDialog) {
        AlertDialog(
            onDismissRequest = { showAddTaskDialog = false },
            title = { Text("Create Executive Item", color = MetallicSilver) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newTitle,
                        onValueChange = { newTitle = it },
                        label = { Text("Task Title", color = MetallicSilverMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder
                        )
                    )
                    OutlinedTextField(
                        value = newDescription,
                        onValueChange = { newDescription = it },
                        label = { Text("Details / Objective", color = MetallicSilverMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder
                        )
                    )
                    OutlinedTextField(
                        value = newDueTime,
                        onValueChange = { newDueTime = it },
                        label = { Text("Scheduled Time", color = MetallicSilverMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newTitle.isNotBlank()) {
                            viewModel.addTask(newTitle, newDescription, newDueTime, newPriority, "TASK")
                            newTitle = ""
                            newDescription = ""
                            showAddTaskDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IceBlue, contentColor = ObsidianBlack)
                ) {
                    Text("ADD ITEM")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddTaskDialog = false }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            },
            containerColor = ObsidianGlass
        )
    }
}
