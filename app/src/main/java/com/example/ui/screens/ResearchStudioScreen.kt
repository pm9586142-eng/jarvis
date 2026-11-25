package com.example.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.ManageSearch
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.example.features.AutomationRepository
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ResearchStudioScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val result by viewModel.researchResult.collectAsState()
    val isLoading by viewModel.isResearchLoading.collectAsState()
    val errorMsg by viewModel.researchError.collectAsState()

    var activeTab by remember { mutableIntStateOf(0) } // 0 = Web Search, 1 = Report Generator
    var searchQuery by remember { mutableStateOf("") }
    var reportTitle by remember { mutableStateOf("") }
    var reportSource by remember { mutableStateOf("") }
    var reportType by remember { mutableStateOf("Executive Brief") }

    val reportTypes = listOf("Executive Brief", "Technical Spec", "Study Guide", "Comparison Matrix")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
    ) {
        JarvisHeader(
            title = "RESEARCH & REPORTS",
            subtitle = "VERONICA Grounded Web Search & Report Studio",
            telemetry = telemetry,
            currentLanguage = prefs.language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("Web Search", "Report Generator").forEachIndexed { idx, label ->
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
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                        .testTag("research_tab_$idx")
                ) {
                    Text(
                        text = label,
                        color = if (selected) tokens.accentBright else tokens.textMuted,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
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
            if (activeTab == 0) {
                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.ManageSearch, contentDescription = "Web Research", tint = tokens.accent, modifier = Modifier.size(18.dp))
                            Text("LIVE WEB RESEARCH", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            label = { Text("Research query or topic", fontSize = 12.sp) },
                            placeholder = { Text("Latest Android Jetpack Compose adaptive layout best practices", fontSize = 12.sp) },
                            singleLine = false,
                            maxLines = 3,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = tokens.accent,
                                unfocusedBorderColor = tokens.glassBorder,
                                focusedTextColor = tokens.textPrimary,
                                unfocusedTextColor = tokens.textPrimary
                            ),
                            modifier = Modifier.fillMaxWidth().testTag("research_query_input")
                        )
                        Button(
                            onClick = { viewModel.runWebResearch(searchQuery) },
                            enabled = searchQuery.isNotBlank() && !isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.22f), contentColor = tokens.accentBright),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).testTag("research_run_btn")
                        ) {
                            Text(if (isLoading) "RESEARCHING..." else "SEARCH & SYNTHESIZE", fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Description, contentDescription = "Report Generator", tint = tokens.accent, modifier = Modifier.size(18.dp))
                            Text("STRUCTURED REPORT STUDIO", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            reportTypes.forEach { rType ->
                                val selected = reportType == rType
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier
                                        .defaultMinSize(minHeight = 48.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                                        .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(10.dp))
                                        .clickable { reportType = rType }
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(rType, color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                }
                            }
                        }

                        OutlinedTextField(
                            value = reportTitle,
                            onValueChange = { reportTitle = it },
                            label = { Text("Report title (optional)", fontSize = 12.sp) },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = tokens.accent,
                                unfocusedBorderColor = tokens.glassBorder,
                                focusedTextColor = tokens.textPrimary,
                                unfocusedTextColor = tokens.textPrimary
                            ),
                            modifier = Modifier.fillMaxWidth().testTag("report_title_input")
                        )

                        OutlinedTextField(
                            value = reportSource,
                            onValueChange = { reportSource = it },
                            label = { Text("Source notes, brief, or topic", fontSize = 12.sp) },
                            minLines = 4,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = tokens.accent,
                                unfocusedBorderColor = tokens.glassBorder,
                                focusedTextColor = tokens.textPrimary,
                                unfocusedTextColor = tokens.textPrimary
                            ),
                            modifier = Modifier.fillMaxWidth().testTag("report_source_input")
                        )

                        Button(
                            onClick = { viewModel.generateStructuredReport(reportType, reportTitle, reportSource) },
                            enabled = reportSource.isNotBlank() && !isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = SentinelEmerald.copy(alpha = 0.2f), contentColor = SentinelEmerald),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).testTag("report_generate_btn")
                        ) {
                            Text(if (isLoading) "GENERATING..." else "GENERATE REPORT", fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (isLoading) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = tokens.accent)
                    Text("Processing knowledge synthesis...", color = tokens.accentBright, fontSize = 11.5.sp, fontFamily = FontFamily.Monospace)
                }
            }

            errorMsg?.let { err ->
                Text(
                    text = err,
                    color = AlertCrimson,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AlertCrimson.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                )
            }

            result?.let { res ->
                NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = tokens.accent.copy(alpha = 0.45f)) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = "${res.mode} • ${res.providerLabel}" + if (res.modelUsed.isNotBlank()) " (${res.modelUsed})" else "",
                            color = tokens.accentBright,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(res.summary, color = tokens.textPrimary, fontSize = 12.5.sp, lineHeight = 19.sp)

                        if (res.verifiedFacts.isNotEmpty()) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Verified, contentDescription = "Verified Facts", tint = SentinelEmerald, modifier = Modifier.size(15.dp))
                                Text("VERIFIED FACTS", color = SentinelEmerald, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            }
                            res.verifiedFacts.forEach { fact ->
                                Text("• $fact", color = tokens.textPrimary, fontSize = 12.sp)
                            }
                        }

                        if (res.uncertainNotes.isNotEmpty()) {
                            Text("CAVEATS & VERIFICATION", color = QuantumGold, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            res.uncertainNotes.forEach { note ->
                                Text("• $note", color = tokens.textMuted, fontSize = 11.5.sp)
                            }
                        }

                        if (res.sources.isNotEmpty()) {
                            Text("CITATIONS (${res.sources.size})", color = tokens.accent, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            res.sources.forEach { src ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .defaultMinSize(minHeight = 48.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(tokens.glassBg)
                                        .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                                        .clickable {
                                            AutomationRepository.validateWebsiteUrl(src.uri).onSuccess { safeUrl ->
                                                runCatching {
                                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(safeUrl)))
                                                }
                                            }
                                        }
                                        .padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                        Text(src.title, color = tokens.accentBright, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        Text(src.uri, color = tokens.textMuted, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace, maxLines = 1)
                                    }
                                    Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open Citation", tint = tokens.accentBright, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }

            if (result == null && !isLoading) {
                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Tip: Ask VERONICA for real-time technical summaries or paste raw notes in Report Generator to build structured briefs.",
                        color = tokens.textMuted,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
