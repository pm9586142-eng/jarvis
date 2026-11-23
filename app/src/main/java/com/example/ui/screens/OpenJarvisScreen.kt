package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.TravelExplore
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun OpenJarvisScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val snapshot by viewModel.openJarvisSnapshot.collectAsState()
    val loading by viewModel.isOpenJarvisLoading.collectAsState()
    val outcome by viewModel.openJarvisOutcome.collectAsState()
    val searchResults by viewModel.openJarvisSearchResults.collectAsState()
    val errorMsg by viewModel.openJarvisError.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) }
    var promptText by remember { mutableStateOf("") }
    var selectedMode by remember { mutableStateOf("auto") }
    var selectedEngine by remember { mutableStateOf("auto") }
    var searchQuery by remember { mutableStateOf("") }
    var searchMode by remember { mutableStateOf("hybrid") }
    var docTitle by remember { mutableStateOf("") }
    var docBody by remember { mutableStateOf("") }
    var researchQuery by remember { mutableStateOf("") }
    var customServiceDraft by remember(prefs.openJarvisServiceUrl) { mutableStateOf(prefs.openJarvisServiceUrl) }

    val accent = MaterialTheme.colorScheme.primary

    LaunchedEffect(Unit) {
        viewModel.refreshOpenJarvisStatus()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "OPENJARVIS CORE",
            subtitle = "10 Assistants • Hybrid RAG • Learning Telemetry",
            telemetry = telemetry,
            currentLanguage = prefs.language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Top Status Card
            NeuralGlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = accent.copy(alpha = 0.5f)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Hub, contentDescription = "OpenJarvis Core", tint = accent)
                            Text(
                                text = "OPENJARVIS EXTENSION ACTIVE",
                                color = accent,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                        OutlinedButton(
                            onClick = { viewModel.refreshOpenJarvisStatus() },
                            modifier = Modifier
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("oj_refresh_btn")
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh OpenJarvis", modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("SYNC", fontSize = 11.sp)
                        }
                    }

                    Text(
                        text = "Runtime: ${snapshot.runtimeMode} • Docs: ${snapshot.docsCount} • Traces: ${snapshot.totalTraces} (${snapshot.successRate}% ok) • Python Companion: ${if (snapshot.pythonConnected) "ONLINE" else "STANDBY"}",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    if (errorMsg != null) {
                        Text(
                            text = errorMsg.orEmpty(),
                            color = QuantumGold,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Tab Bar
            val tabs = listOf("10 Assistants", "Engines & Models", "Hybrid RAG", "Deep Research", "Monitors & Traces")
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tabs.forEachIndexed { idx, label ->
                    FilterChip(
                        selected = selectedTab == idx,
                        onClick = { selectedTab = idx },
                        label = { Text(label, fontSize = 12.sp) },
                        modifier = Modifier
                            .defaultMinSize(minHeight = 48.dp)
                            .testTag("oj_tab_$idx")
                    )
                }
            }

            if (loading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = accent, modifier = Modifier.size(28.dp))
                }
            }

            when (selectedTab) {
                // TAB 0: 10 UNIFIED ASSISTANTS
                0 -> {
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = "Select Assistant Mode",
                                color = IceBlueBright,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                FilterChip(
                                    selected = selectedMode == "auto",
                                    onClick = { selectedMode = "auto" },
                                    label = { Text("Auto") },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                )
                                snapshot.assistantModes.forEach { m ->
                                    FilterChip(
                                        selected = selectedMode == m.id,
                                        onClick = { selectedMode = m.id },
                                        label = { Text(m.name) },
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    )
                                }
                            }

                            OutlinedTextField(
                                value = promptText,
                                onValueChange = { promptText = it },
                                label = { Text("Command or Question (EN / HI / Hinglish)") },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("oj_agent_prompt_input"),
                                minLines = 2
                            )

                            Button(
                                onClick = {
                                    if (promptText.isNotBlank()) {
                                        viewModel.runOpenJarvisAgent(
                                            prompt = promptText,
                                            assistantMode = selectedMode,
                                            engineId = selectedEngine
                                        )
                                    }
                                },
                                enabled = !loading && promptText.isNotBlank(),
                                colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = ObsidianBlack),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("oj_run_agent_btn")
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Execute agent")
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("EXECUTE OPENJARVIS AGENT", fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    outcome?.let { res ->
                        NeuralGlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            borderColor = if (res.ok) SentinelEmerald.copy(alpha = 0.55f) else QuantumGold.copy(alpha = 0.6f)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "${res.assistantName.ifBlank { res.assistantMode }} • ${res.engineId} (${res.latencyMs}ms)",
                                        color = IceBlueBright,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    if (res.answer.isNotBlank()) {
                                        OutlinedButton(
                                            onClick = { viewModel.speakOpenJarvisText(res.answer) },
                                            modifier = Modifier
                                                .defaultMinSize(minHeight = 48.dp)
                                                .testTag("oj_speak_result_btn")
                                        ) {
                                            Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = "Speak answer")
                                            Spacer(modifier = Modifier.size(4.dp))
                                            Text("SPEAK", fontSize = 11.sp)
                                        }
                                    }
                                }

                                if (res.requiresConfirmation && !res.confirmationToken.isNullOrBlank()) {
                                    Text(
                                        text = res.error ?: "Sensitive action confirmation required.",
                                        color = QuantumGold,
                                        fontSize = 12.sp
                                    )
                                    Button(
                                        onClick = {
                                            viewModel.runOpenJarvisAgent(
                                                prompt = promptText,
                                                assistantMode = selectedMode,
                                                engineId = selectedEngine,
                                                confirmToken = res.confirmationToken
                                            )
                                        },
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    ) {
                                        Text("Approve Sensitive Action")
                                    }
                                } else {
                                    Text(
                                        text = res.answer.ifBlank { res.error.orEmpty() },
                                        color = MetallicSilver,
                                        fontSize = 13.sp
                                    )
                                }
                            }
                        }
                    }
                }

                // TAB 1: ENGINES & MODELS + REMOTE PYTHON CONFIG
                1 -> {
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "PC-Hosted OpenJarvis Companion URL (Optional)",
                                color = IceBlueBright,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            Text(
                                text = "Ollama, llama.cpp, vLLM, and SGLang run on your PC workstation. Leave empty to use AM AI Vercel backend (`/api/openjarvis/*`).",
                                color = MetallicSilverMuted,
                                fontSize = 11.sp
                            )
                            OutlinedTextField(
                                value = customServiceDraft,
                                onValueChange = { customServiceDraft = it },
                                label = { Text("https://your-pc-tunnel.example or http://192.168.x.x:8100") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                            Button(
                                onClick = { viewModel.saveOpenJarvisServiceUrl(customServiceDraft) },
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("oj_save_url_btn")
                            ) {
                                Text("Save & Test Connection")
                            }
                        }
                    }

                    snapshot.engines.forEach { eng ->
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(eng.name, color = MetallicSilver, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Text(eng.status, color = SentinelEmerald, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                                }
                                Text(eng.lastMessage, color = MetallicSilverMuted, fontSize = 11.sp)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(
                                        onClick = { viewModel.probeOpenJarvisEngine(eng.id) },
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    ) {
                                        Text("Health Probe", fontSize = 11.sp)
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            selectedEngine = eng.id
                                            selectedTab = 0
                                        },
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    ) {
                                        Text("Use Engine", fontSize = 11.sp)
                                    }
                                }
                            }
                        }
                    }

                    snapshot.models.take(6).forEach { m ->
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(m.name, color = IceBlueBright, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                    Text(m.fitStatus, color = QuantumGold, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                                }
                                Text(m.fitReason, color = MetallicSilverMuted, fontSize = 11.sp)
                            }
                        }
                    }
                }

                // TAB 2: HYBRID RAG (BM25 + VECTOR + COLBERT)
                2 -> {
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Hybrid Retrieval (BM25 + Vector + ColBERT)",
                                color = IceBlueBright,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                listOf("hybrid", "bm25", "vector", "colbert").forEach { mode ->
                                    FilterChip(
                                        selected = searchMode == mode,
                                        onClick = { searchMode = mode },
                                        label = { Text(mode.uppercase(), fontSize = 11.sp) },
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    )
                                }
                            }
                            OutlinedTextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                label = { Text("Search documents & AM AI memory") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    if (searchQuery.isNotBlank()) viewModel.searchOpenJarvisMemory(searchQuery, searchMode)
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("oj_hybrid_search_btn")
                            ) {
                                Icon(Icons.Default.Search, contentDescription = "Run hybrid search")
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("SEARCH HYBRID INDEX")
                            }
                        }
                    }

                    searchResults.forEach { hit ->
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(hit.title, color = IceBlueBright, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    Text("score=${hit.score}", color = SentinelEmerald, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                                }
                                Text(hit.text, color = MetallicSilver, fontSize = 12.sp)
                                Text(
                                    "BM25=${hit.bm25} | Vector=${hit.vector} | ColBERT=${hit.colbert}",
                                    color = MetallicSilverMuted,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }

                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Index Knowledge Document", color = IceBlueBright, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            OutlinedTextField(value = docTitle, onValueChange = { docTitle = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = docBody, onValueChange = { docBody = it }, label = { Text("Content") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                            OutlinedButton(
                                onClick = {
                                    if (docTitle.isNotBlank() && docBody.isNotBlank()) {
                                        viewModel.indexOpenJarvisDocument(docTitle, docBody)
                                        docTitle = ""
                                        docBody = ""
                                    }
                                },
                                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(Icons.Default.Storage, contentDescription = "Index document")
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("Index into Hybrid Store")
                            }
                        }
                    }
                }

                // TAB 3: DEEP RESEARCH
                3 -> {
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = "Deep Research Cross-Source Synthesis",
                                color = IceBlueBright,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            OutlinedTextField(
                                value = researchQuery,
                                onValueChange = { researchQuery = it },
                                label = { Text("Enter Research Topic") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    if (researchQuery.isNotBlank()) viewModel.runOpenJarvisDeepResearch(researchQuery, selectedEngine)
                                },
                                enabled = !loading && researchQuery.isNotBlank(),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 48.dp)
                                    .testTag("oj_deep_research_btn")
                            ) {
                                Icon(Icons.Default.TravelExplore, contentDescription = "Run deep research")
                                Spacer(modifier = Modifier.size(6.dp))
                                Text("RUN DEEP RESEARCH")
                            }
                        }
                    }
                    outcome?.let { res ->
                        if (res.answer.isNotBlank()) {
                            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(res.answer, color = MetallicSilver, fontSize = 13.sp)
                                    if (res.citations.isNotEmpty()) {
                                        Text("Citations:", color = IceBlueBright, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                        res.citations.forEach { c ->
                                            Text("• $c", color = MetallicSilverMuted, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // TAB 4: MONITORS, BENCHMARKS & LEARNING TRACES
                else -> {
                    Button(
                        onClick = { viewModel.runOpenJarvisBenchmark() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                            .testTag("oj_benchmark_btn")
                    ) {
                        Icon(Icons.Default.Bolt, contentDescription = "Run benchmark")
                        Spacer(modifier = Modifier.size(6.dp))
                        Text("RUN LIVE REACT BENCHMARK")
                    }

                    snapshot.workflows.forEach { wf ->
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(wf.name, color = IceBlueBright, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("${wf.kind} • every ${wf.intervalMinutes}m • runs=${wf.runCount}", color = MetallicSilverMuted, fontSize = 11.sp)
                                Text(wf.lastSummary, color = MetallicSilver, fontSize = 11.sp)
                                OutlinedButton(
                                    onClick = { viewModel.runOpenJarvisWorkflow(wf.id) },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Text("Trigger Monitor Check", fontSize = 11.sp)
                                }
                            }
                        }
                    }

                    snapshot.recentTraces.take(8).forEach { tr ->
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "${if (tr.ok) "OK" else "FAIL"} • ${tr.agentId} • ${tr.engineId} (${tr.latencyMs}ms)",
                                    color = if (tr.ok) SentinelEmerald else QuantumGold,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp
                                )
                                Text(tr.promptPreview, color = MetallicSilver, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
