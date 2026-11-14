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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.plugins.TrelloKanbanPlugin
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlinx.coroutines.launch

@Composable
fun PluginsScreen(viewModel: JarvisViewModel) {
    val coroutineScope = rememberCoroutineScope()
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val plugins by viewModel.pluginManager.pluginList.collectAsState()

    var executionResultText by remember { mutableStateOf("") }
    var showAddCardDialog by remember { mutableStateOf(false) }
    var newCardTitle by remember { mutableStateOf("") }
    var newCardColumn by remember { mutableStateOf("To Do") }

    val trelloPlugin = plugins.find { it.id == "plugin_trello_asana" } as? TrelloKanbanPlugin

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "PLUGIN ARCHITECTURE",
            subtitle = "Extensible Neural Plugin Bus",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Architecture Info
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(
                        text = "JARVIS OPEN EXTENSION API",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Plugins run inside an isolated sandbox with declared tools and input/output schemas. They interface directly with JARVIS's intent pipeline and multi-agent coordination mesh.",
                        color = MetallicSilverMuted,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }

            // Installed Plugins
            Text(
                text = "ACTIVE EXTENSIONS",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            plugins.forEach { plugin ->
                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .background(IceBlue.copy(alpha = 0.16f), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Extension,
                                        contentDescription = plugin.name,
                                        tint = IceBlue,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = plugin.name,
                                        color = MetallicSilver,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "v${plugin.version} • ${plugin.category}",
                                        color = IceBlueBright,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }

                            Switch(
                                checked = plugin.isEnabled,
                                onCheckedChange = { viewModel.pluginManager.togglePlugin(plugin.id) },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = IceBlue,
                                    checkedTrackColor = IceBlue.copy(alpha = 0.35f)
                                )
                            )
                        }

                        Text(
                            text = plugin.description,
                            color = MetallicSilverMuted,
                            fontSize = 11.5.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )

                        // Tools exposed by plugin
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            plugin.getDeclaredTools().forEach { tool ->
                                Box(
                                    modifier = Modifier
                                        .background(ObsidianGlass, RoundedCornerShape(8.dp))
                                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                                        .clickable {
                                            coroutineScope.launch {
                                                val res = viewModel.pluginManager.executePluginTool(
                                                    pluginId = plugin.id,
                                                    toolId = tool.id,
                                                    params = mapOf("workflow_name" to "production-deploy", "scene_name" to "Stark Lab Focus")
                                                )
                                                executionResultText = res.summary
                                            }
                                        }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.PlayArrow,
                                            contentDescription = "Run",
                                            tint = IceBlue,
                                            modifier = Modifier.size(12.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = tool.name,
                                            color = IceBlueBright,
                                            fontSize = 10.5.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Live Interactive Demonstration: Trello / Asana Kanban Board
            if (trelloPlugin != null && trelloPlugin.isEnabled) {
                Text(
                    text = "LIVE DEMONSTRATION: STARK KANBAN BOARD",
                    color = MetallicSilverMuted,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Sprint Alpha (Active)",
                                color = MetallicSilver,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Button(
                                onClick = { showAddCardDialog = true },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = IceBlue,
                                    contentColor = ObsidianBlack
                                ),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.height(32.dp).testTag("add_kanban_card_btn")
                            ) {
                                Icon(imageVector = Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("ADD CARD", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        trelloPlugin.boardCards.forEach { (id, title, col) ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(ObsidianGlass, RoundedCornerShape(8.dp))
                                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                                    .padding(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "[$id] $title",
                                            color = MetallicSilver,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Text(
                                            text = "Status: $col",
                                            color = when (col) {
                                                "Done" -> SentinelEmerald
                                                "In Progress" -> IceBlueBright
                                                else -> QuantumGold
                                            },
                                            fontSize = 10.5.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }

                                    // Move column button
                                    TextButton(
                                        onClick = {
                                            coroutineScope.launch {
                                                val nextCol = when (col) {
                                                    "To Do" -> "In Progress"
                                                    "In Progress" -> "Done"
                                                    else -> "To Do"
                                                }
                                                val res = trelloPlugin.executeTool(
                                                    "move_card",
                                                    mapOf("card_id" to id, "column" to nextCol)
                                                )
                                                executionResultText = res.summary
                                            }
                                        }
                                    ) {
                                        Text(
                                            text = "ADVANCE →",
                                            color = IceBlue,
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

            // Output from executed plugin tools
            if (executionResultText.isNotBlank()) {
                Text(
                    text = "PLUGIN EXECUTION TELEMETRY",
                    color = MetallicSilverMuted,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ObsidianGlass, RoundedCornerShape(10.dp))
                        .border(1.dp, IceBlue.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        .padding(12.dp)
                ) {
                    Text(
                        text = executionResultText,
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        lineHeight = 18.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    // Add Card Dialog
    if (showAddCardDialog && trelloPlugin != null) {
        AlertDialog(
            onDismissRequest = { showAddCardDialog = false },
            title = { Text("Create Kanban Card", color = MetallicSilver) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = newCardTitle,
                        onValueChange = { newCardTitle = it },
                        label = { Text("Task Title", color = MetallicSilverMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder
                        )
                    )
                    OutlinedTextField(
                        value = newCardColumn,
                        onValueChange = { newCardColumn = it },
                        label = { Text("Column (To Do / In Progress / Done)", color = MetallicSilverMuted) },
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
                        if (newCardTitle.isNotBlank()) {
                            coroutineScope.launch {
                                val res = trelloPlugin.executeTool(
                                    "create_card",
                                    mapOf("title" to newCardTitle, "column" to newCardColumn)
                                )
                                executionResultText = res.summary
                                newCardTitle = ""
                                showAddCardDialog = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IceBlue, contentColor = ObsidianBlack)
                ) {
                    Text("ADD")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddCardDialog = false }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            },
            containerColor = ObsidianGlass
        )
    }
}
