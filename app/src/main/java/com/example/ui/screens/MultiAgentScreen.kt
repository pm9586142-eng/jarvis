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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SyncAlt
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
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.agents.JarvisAgent
import com.example.data.db.CustomAgentEntity
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
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
import com.example.ui.theme.ObsidianSurface
import com.example.ui.theme.SentinelEmerald
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val AGENT_COLOR_CHOICES = listOf(
    0xFF00F0FFL,
    0xFFA78BFAL,
    0xFF10B981L,
    0xFFFBBF24L,
    0xFFF43F5EL,
    0xFF38BDF8L
)

@Composable
fun MultiAgentScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val collaborationLogs by viewModel.agentSystem.logs.collectAsState()
    val customAgents by viewModel.customAgents.collectAsState()

    var multiTaskPrompt by remember { mutableStateOf("Coordinate flight test, run security audit, and update schedule") }
    var showBuilderDialog by remember { mutableStateOf(false) }
    var editingAgent by remember { mutableStateOf<CustomAgentEntity?>(null) }
    var nameDraft by remember { mutableStateOf("") }
    var codenameDraft by remember { mutableStateOf("") }
    var promptDraft by remember { mutableStateOf("") }
    var keywordsDraft by remember { mutableStateOf("") }
    var colorDraft by remember { mutableLongStateOf(AGENT_COLOR_CHOICES.first()) }

    fun openBuilder(existing: CustomAgentEntity?) {
        editingAgent = existing
        nameDraft = existing?.name ?: ""
        codenameDraft = existing?.codename ?: ""
        promptDraft = existing?.systemPrompt
            ?: "You are a specialized Stark Lab agent. Address the owner as Sir and be concise."
        keywordsDraft = existing?.keywords ?: ""
        colorDraft = existing?.colorHex ?: AGENT_COLOR_CHOICES.first()
        showBuilderDialog = true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "MULTI-AGENT MATRIX",
            subtitle = "Distributed Neural Agent Pipeline",
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
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "NEURAL AGENT ORCHESTRATION",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "JARVIS operates via a federated multi-agent architecture. Create custom agents with keyword triggers and specialized system prompts.",
                        color = MetallicSilverMuted,
                        fontSize = 12.5.sp,
                        lineHeight = 18.sp
                    )
                    Button(
                        onClick = { openBuilder(null) },
                        modifier = Modifier.testTag("create_custom_agent_btn"),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = IceBlue,
                            contentColor = ObsidianBlack
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "Create Custom Agent", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("CREATE CUSTOM AGENT", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (customAgents.isNotEmpty()) {
                Text(
                    text = "CUSTOM AGENTS (${customAgents.size})",
                    color = IceBlueBright,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                customAgents.forEach { custom ->
                    val accent = Color(custom.colorHex)
                    NeuralGlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                viewModel.selectCustomAgent(custom)
                                viewModel.navigateTo(ScreenDestination.CHAT)
                            },
                        borderColor = accent.copy(alpha = 0.45f)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .background(accent.copy(alpha = 0.16f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = custom.codename,
                                    tint = accent,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${custom.codename} • ${custom.name}",
                                    color = MetallicSilver,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = custom.systemPrompt,
                                    color = MetallicSilverMuted,
                                    fontSize = 11.5.sp,
                                    maxLines = 2
                                )
                                if (custom.keywords.isNotBlank()) {
                                    Text(
                                        text = "Triggers: ${custom.keywords}",
                                        color = accent,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                            IconButton(onClick = { openBuilder(custom) }) {
                                Icon(imageVector = Icons.Default.Edit, contentDescription = "Edit agent", tint = IceBlueBright)
                            }
                            IconButton(onClick = { viewModel.deleteCustomAgent(custom.id) }) {
                                Icon(imageVector = Icons.Default.Delete, contentDescription = "Delete agent", tint = AlertCrimson)
                            }
                        }
                    }
                }
            }

            // Built-in Agents Directory
            Text(
                text = "SPECIALIZED AGENT NODES",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            JarvisAgent.entries.forEach { agent ->
                NeuralGlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            viewModel.selectAgent(agent)
                            viewModel.navigateTo(ScreenDestination.CHAT)
                        },
                    borderColor = agent.accentColor.copy(alpha = 0.35f)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(agent.accentColor.copy(alpha = 0.16f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = agent.icon,
                                contentDescription = agent.codename,
                                tint = agent.accentColor,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = agent.codename,
                                    color = MetallicSilver,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(SentinelEmerald, CircleShape)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "ONLINE",
                                    color = SentinelEmerald,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            Text(
                                text = agent.designation,
                                color = agent.accentColor,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = agent.specialization,
                                color = MetallicSilverMuted,
                                fontSize = 11.5.sp,
                                maxLines = 2,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Engage",
                            tint = agent.accentColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // Interactive Task Delegation Test
            Text(
                text = "DELEGATE MULTI-AGENT DIRECTIVE",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = multiTaskPrompt,
                        onValueChange = { multiTaskPrompt = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("multiagent_directive_input"),
                        label = { Text("Multi-Part Objective", color = MetallicSilverMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder,
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedContainerColor = ObsidianGlass,
                            unfocusedContainerColor = ObsidianGlass
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Button(
                        onClick = {
                            val text = multiTaskPrompt
                            viewModel.agentSystem.recordCollaboration(
                                from = JarvisAgent.JARVIS_PRIME,
                                to = JarvisAgent.DUM_E_ENGINEER,
                                action = "Engineering Task Handshake",
                                detail = "Objective '$text' parsed and dispatched to DUM-E & FRIDAY."
                            )
                            viewModel.sendMessage(text)
                            viewModel.navigateTo(ScreenDestination.CHAT)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("dispatch_directive_btn"),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = IceBlue,
                            contentColor = ObsidianBlack
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.SyncAlt, contentDescription = "Delegate", modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "DISPATCH DIRECTIVE TO AGENT MESH",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Real-Time Inter-Agent Collaboration Event Stream
            Text(
                text = "INTER-AGENT NEURAL BUS LOGS",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                collaborationLogs.forEach { log ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ObsidianGlass, RoundedCornerShape(10.dp))
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "${log.fromAgent.codename} → ${log.toAgent.codename}",
                                        color = IceBlueBright,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "• ${log.action}",
                                        color = MetallicSilver,
                                        fontSize = 11.sp
                                    )
                                }
                                val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                                Text(
                                    text = sdf.format(Date(log.timestamp)),
                                    color = MetallicSilverMuted,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            Text(
                                text = log.detail,
                                color = MetallicSilverMuted,
                                fontSize = 11.5.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    if (showBuilderDialog) {
        AlertDialog(
            onDismissRequest = { showBuilderDialog = false },
            containerColor = ObsidianSurface,
            title = {
                Text(
                    text = if (editingAgent != null) "Edit Custom Agent" else "New Custom Agent",
                    color = MetallicSilver,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = nameDraft,
                        onValueChange = { nameDraft = it },
                        label = { Text("Display Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = codenameDraft,
                        onValueChange = { codenameDraft = it },
                        label = { Text("Codename (e.g. ATHENA)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = keywordsDraft,
                        onValueChange = { keywordsDraft = it },
                        label = { Text("Keywords (comma-separated)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = promptDraft,
                        onValueChange = { promptDraft = it },
                        label = { Text("System Prompt") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        AGENT_COLOR_CHOICES.forEach { hex ->
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .background(Color(hex), CircleShape)
                                    .border(
                                        width = if (colorDraft == hex) 2.dp else 0.dp,
                                        color = Color.White,
                                        shape = CircleShape
                                    )
                                    .clickable { colorDraft = hex }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.saveCustomAgent(
                            id = editingAgent?.id,
                            name = nameDraft,
                            codename = codenameDraft,
                            systemPrompt = promptDraft,
                            colorHex = colorDraft,
                            keywords = keywordsDraft
                        )
                        showBuilderDialog = false
                    }
                ) {
                    Text("SAVE", color = IceBlueBright, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showBuilderDialog = false }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            }
        )
    }
}
