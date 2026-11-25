package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MultiAiControlCenterScreen(viewModel: JarvisViewModel) {
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val snapshot by viewModel.brainSnapshot.collectAsState()
    val isLoading by viewModel.isBrainLoading.collectAsState()
    val outcome by viewModel.brainCoordinateOutcome.collectAsState()
    val notice by viewModel.brainActionNotice.collectAsState()

    var activeTab by remember { mutableIntStateOf(0) }
    var promptDraft by remember { mutableStateOf("") }
    var selectedCollabMode by remember(snapshot.collaborationMode) { mutableStateOf(snapshot.collaborationMode) }
    var preferredProvider by remember { mutableStateOf("auto") }

    LaunchedEffect(Unit) {
        viewModel.refreshBrainStatus()
    }

    val tabs = listOf("Overview", "Providers", "Agents", "Coordinate")
    val collabModes = listOf(
        "parallel_review" to "Parallel Review",
        "single" to "Single Fast",
        "consensus" to "Consensus Mesh",
        "code_audit" to "Code & Security Audit"
    )
    val providerChoices = listOf("auto", "gemini", "groq", "openrouter")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
    ) {
        JarvisHeader(
            title = "MULTI-AI BRAIN",
            subtitle = "Zero-Cost Provider Mesh & Orchestration",
            telemetry = telemetry,
            currentLanguage = prefs.language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        // Sub-Tab Selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            tabs.forEachIndexed { idx, label ->
                val selected = activeTab == idx
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                        .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(10.dp))
                        .clickable { activeTab = idx }
                        .padding(horizontal = 6.dp, vertical = 8.dp)
                        .testTag("multi_ai_tab_${label.lowercase()}")
                ) {
                    Text(
                        text = label,
                        color = if (selected) tokens.accentBright else tokens.textMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        maxLines = 1
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            notice?.let { msg ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SentinelEmerald.copy(alpha = 0.14f), RoundedCornerShape(12.dp))
                        .border(1.dp, SentinelEmerald.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(msg, color = SentinelEmerald, fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                    TextButton(onClick = { viewModel.clearBrainNotice() }) {
                        Text("OK", color = tokens.textPrimary, fontSize = 11.sp)
                    }
                }
            }

            if (isLoading) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = tokens.accent)
                    Text("Synchronizing Multi-AI Telemetry...", color = tokens.accentBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }

            when (activeTab) {
                0 -> {
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = tokens.accent.copy(alpha = 0.45f)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Icon(Icons.Default.Hub, contentDescription = "Brain Core", tint = tokens.accent, modifier = Modifier.size(18.dp))
                                    Text("MESH HEALTH & ROUTING", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                                Text(
                                    text = "${snapshot.healthScore}%",
                                    color = if (snapshot.healthScore >= 80) SentinelEmerald else QuantumGold,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            Text(
                                text = "Routing Policy: ${snapshot.routingPolicy.uppercase()} • Zero-Cost Guard: ${if (snapshot.strictZeroCostEnforced) "ENFORCED" else "OPEN"}",
                                color = tokens.accentBright,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "Active Provider: ${snapshot.activeProvider.uppercase()} • Mode: ${snapshot.collaborationMode} • Requests: ${snapshot.totalRequests}",
                                color = tokens.textMuted,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = if (snapshot.loadedFromBackend) "Telemetry Source: Live Express Brain API" else (snapshot.errorNote ?: "Telemetry Source: Local Android Mesh"),
                                color = tokens.textMuted,
                                fontSize = 11.sp
                            )
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(
                                    onClick = { viewModel.refreshBrainStatus() },
                                    modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("multi_ai_refresh_btn"),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Icon(Icons.Default.Refresh, contentDescription = "Refresh Brain", tint = tokens.accentBright, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("REFRESH", color = tokens.accentBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                }
                                OutlinedButton(
                                    onClick = { viewModel.resetBrainCooldowns() },
                                    modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("multi_ai_reset_cooldowns_btn"),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Icon(Icons.Default.RestartAlt, contentDescription = "Reset Cooldowns", tint = QuantumGold, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("RESET 429", color = QuantumGold, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                }
                            }
                        }
                    }

                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("COLLABORATION POLICY", color = tokens.accent, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                collabModes.forEach { (id, label) ->
                                    val selected = snapshot.collaborationMode == id
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .defaultMinSize(minHeight = 48.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                                            .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(10.dp))
                                            .clickable {
                                                selectedCollabMode = id
                                                viewModel.updateBrainCollaborationMode(id)
                                            }
                                            .padding(horizontal = 12.dp, vertical = 8.dp)
                                    ) {
                                        Text(label, color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.5.sp, fontFamily = FontFamily.Monospace)
                                    }
                                }
                            }
                        }
                    }

                    if (snapshot.auditLogs.isNotEmpty()) {
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("AUDIT TRACE", color = tokens.accent, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                snapshot.auditLogs.take(8).forEach { trace ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(tokens.glassBg, RoundedCornerShape(8.dp))
                                            .border(1.dp, tokens.glassBorder, RoundedCornerShape(8.dp))
                                            .padding(8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(trace.action, color = tokens.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                            Text(trace.detail, color = tokens.textMuted, fontSize = 10.5.sp)
                                        }
                                        Text(
                                            text = trace.status,
                                            color = if (trace.status.equals("WARN", true) || trace.status.equals("ERROR", true)) QuantumGold else SentinelEmerald,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    snapshot.providers.forEach { provider ->
                        val statusColor = when {
                            provider.status.contains("READY", true) || provider.status.contains("CONNECTED", true) -> SentinelEmerald
                            provider.configured -> QuantumGold
                            else -> AlertCrimson
                        }
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = statusColor.copy(alpha = 0.4f)) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(provider.name, color = tokens.textPrimary, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                                        Text(
                                            text = "Tier: ${provider.tier.uppercase()} • Model: ${provider.defaultModel.ifBlank { "auto" }}",
                                            color = tokens.textMuted,
                                            fontSize = 11.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                    Box(
                                        modifier = Modifier
                                            .background(statusColor.copy(alpha = 0.16f), RoundedCornerShape(8.dp))
                                            .border(1.dp, statusColor.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                            .padding(horizontal = 8.dp, vertical = 4.dp)
                                    ) {
                                        Text(provider.status, color = statusColor, fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (provider.latencyMs != null) "Latency: ${provider.latencyMs}ms" else if (provider.configured) "Configured" else "Needs Key / Proxy",
                                        color = tokens.textMuted,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Button(
                                        onClick = { viewModel.testBrainProvider(provider.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.18f), contentColor = tokens.accentBright),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp).testTag("multi_ai_test_${provider.id}")
                                    ) {
                                        Icon(Icons.Default.VerifiedUser, contentDescription = "Test ${provider.name}", modifier = Modifier.size(15.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("LIVE TEST", fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                2 -> {
                    snapshot.agents.forEach { agent ->
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .background(tokens.accent.copy(alpha = 0.16f), CircleShape)
                                            .border(1.dp, tokens.accent.copy(alpha = 0.45f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.SmartToy, contentDescription = agent.name, tint = tokens.accentBright, modifier = Modifier.size(18.dp))
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(agent.name, color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                        Text("${agent.role} • Prefers ${agent.preferredProvider.uppercase()}", color = tokens.accentBright, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)
                                        Text(agent.specialty, color = tokens.textMuted, fontSize = 11.5.sp)
                                    }
                                }
                                Text(
                                    text = if (agent.enabled) "ONLINE" else "PAUSED",
                                    color = if (agent.enabled) SentinelEmerald else tokens.textMuted,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }

                3 -> {
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("COORDINATE & VERIFY PROMPT", color = tokens.accent, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            OutlinedTextField(
                                value = promptDraft,
                                onValueChange = { promptDraft = it },
                                label = { Text("Task for multi-agent synthesis", fontSize = 12.sp) },
                                placeholder = { Text("Compare Kotlin coroutines vs Flow backpressure...", fontSize = 12.sp) },
                                minLines = 3,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = tokens.accent,
                                    unfocusedBorderColor = tokens.glassBorder,
                                    focusedTextColor = tokens.textPrimary,
                                    unfocusedTextColor = tokens.textPrimary
                                ),
                                modifier = Modifier.fillMaxWidth().testTag("multi_ai_coordinate_input")
                            )

                            Text("COLLABORATION MODE", color = tokens.textMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                collabModes.forEach { (id, label) ->
                                    val selected = selectedCollabMode == id
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .defaultMinSize(minHeight = 48.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                                            .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(8.dp))
                                            .clickable { selectedCollabMode = id }
                                            .padding(horizontal = 10.dp, vertical = 6.dp)
                                    ) {
                                        Text(label, color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    }
                                }
                            }

                            Text("PREFERRED PROVIDER", color = tokens.textMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                providerChoices.forEach { prov ->
                                    val selected = preferredProvider == prov
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .defaultMinSize(minHeight = 48.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(if (selected) SentinelEmerald.copy(alpha = 0.2f) else tokens.glassBg)
                                            .border(1.dp, if (selected) SentinelEmerald else tokens.glassBorder, RoundedCornerShape(8.dp))
                                            .clickable { preferredProvider = prov }
                                            .padding(horizontal = 12.dp, vertical = 6.dp)
                                    ) {
                                        Text(prov.uppercase(), color = if (selected) SentinelEmerald else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    }
                                }
                            }

                            Button(
                                onClick = {
                                    viewModel.runBrainCoordinate(
                                        prompt = promptDraft,
                                        collaborationMode = selectedCollabMode,
                                        preferredProvider = if (preferredProvider == "auto") null else preferredProvider
                                    )
                                },
                                enabled = promptDraft.isNotBlank() && !isLoading,
                                colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.22f), contentColor = tokens.accentBright),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).testTag("multi_ai_run_coordinate_btn")
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Run Coordinate", modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(if (isLoading) "SYNTHESIZING..." else "RUN MULTI-AI SYNTHESIS", fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    outcome?.let { res ->
                        NeuralGlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            borderColor = if (res.ok) SentinelEmerald.copy(alpha = 0.5f) else AlertCrimson.copy(alpha = 0.5f)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = "${res.providerLabel} • ${res.modelUsed.ifBlank { "Mesh" }}",
                                    color = if (res.ok) SentinelEmerald else AlertCrimson,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                                if (res.agentsUsed.isNotEmpty()) {
                                    Text(
                                        text = "Agents: ${res.agentsUsed.joinToString(" -> ")}",
                                        color = tokens.accentBright,
                                        fontSize = 10.5.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                if (res.verificationNote.isNotBlank()) {
                                    Text(res.verificationNote, color = QuantumGold, fontSize = 11.sp)
                                }
                                Text(res.text, color = tokens.textPrimary, fontSize = 12.5.sp, lineHeight = 18.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
