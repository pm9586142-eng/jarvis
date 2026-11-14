package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val tasks by viewModel.tasks.collectAsState()

    var showAddTaskDialog by remember { mutableStateOf(false) }
    var newTitle by remember { mutableStateOf("") }
    var newDescription by remember { mutableStateOf("") }
    var newDueTime by remember { mutableStateOf("15:00 Today") }
    var newPriority by remember { mutableStateOf("HIGH") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "EXECUTIVE PRODUCTIVITY",
            subtitle = "FRIDAY Coordinator Agenda",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header summary card
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
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

            // Task List
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
                                        fontWeight = FontWeight.Bold
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
                                    Text(
                                        text = "Due: ${task.dueTime}",
                                        color = IceBlueBright,
                                        fontSize = 10.5.sp,
                                        fontFamily = FontFamily.Monospace,
                                        modifier = Modifier.padding(top = 2.dp)
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
