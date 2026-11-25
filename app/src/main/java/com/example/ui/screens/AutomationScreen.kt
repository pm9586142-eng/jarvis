package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
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
import com.example.features.AutomationRepository
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.SentinelEmerald

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AutomationScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val logs by viewModel.automationLogs.collectAsState()

    var directoryFilter by remember { mutableStateOf("") }
    var customUrlInput by remember { mutableStateOf("") }
    var urlError by remember { mutableStateOf<String?>(null) }
    var pendingLaunchUrl by remember { mutableStateOf<Pair<String, String>?>(null) } // label to validUrl

    val filteredSites = remember(directoryFilter) {
        AutomationRepository.searchApprovedWebsites(directoryFilter)
    }

    fun requestValidatedLaunch(label: String, rawUrl: String) {
        AutomationRepository.validateWebsiteUrl(rawUrl).fold(
            onSuccess = { validUrl ->
                urlError = null
                pendingLaunchUrl = label to validUrl
            },
            onFailure = { err ->
                urlError = err.localizedMessage ?: "Blocked unsafe URL"
                viewModel.logAutomationAction("BLOCKED", rawUrl, err.localizedMessage ?: "Blocked")
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
    ) {
        JarvisHeader(
            title = "AUTOMATION & WEB HUB",
            subtitle = "Safe HTTPS Web Launcher & Action Audit",
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
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Custom Safe URL / Google Search Launcher
            NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = tokens.accent.copy(alpha = 0.45f)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Security, contentDescription = "HTTPS Guard", tint = SentinelEmerald, modifier = Modifier.size(18.dp))
                        Text("SAFE HTTPS WEB LAUNCHER", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    OutlinedTextField(
                        value = customUrlInput,
                        onValueChange = {
                            customUrlInput = it
                            urlError = null
                        },
                        label = { Text("Website URL or search phrase", fontSize = 12.sp) },
                        placeholder = { Text("https://developer.android.com", fontSize = 12.sp) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = tokens.accent,
                            unfocusedBorderColor = tokens.glassBorder,
                            focusedTextColor = tokens.textPrimary,
                            unfocusedTextColor = tokens.textPrimary
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("automation_url_input")
                    )

                    urlError?.let { err ->
                        Text(err, color = AlertCrimson, fontSize = 11.5.sp, fontFamily = FontFamily.Monospace)
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { requestValidatedLaunch("Custom URL", customUrlInput) },
                            enabled = customUrlInput.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.2f), contentColor = tokens.accentBright),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("automation_launch_url_btn")
                        ) {
                            Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Launch URL", modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("OPEN HTTPS", fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                val searchUrl = AutomationRepository.buildGoogleSearchUrl(customUrlInput)
                                requestValidatedLaunch("Google Search", searchUrl)
                            },
                            enabled = customUrlInput.isNotBlank(),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("automation_google_search_btn")
                        ) {
                            Icon(Icons.Default.Search, contentDescription = "Google Search", tint = SentinelEmerald, modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("GOOGLE", color = SentinelEmerald, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Approved Website Directory
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Public, contentDescription = "Verified Sites", tint = tokens.accent, modifier = Modifier.size(18.dp))
                        Text("APPROVED WEBSITE DIRECTORY", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedTextField(
                        value = directoryFilter,
                        onValueChange = { directoryFilter = it },
                        label = { Text("Filter directory...", fontSize = 12.sp) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = tokens.accent,
                            unfocusedBorderColor = tokens.glassBorder,
                            focusedTextColor = tokens.textPrimary,
                            unfocusedTextColor = tokens.textPrimary
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("automation_filter_input")
                    )

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        filteredSites.forEach { site ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth(0.48f)
                                    .defaultMinSize(minHeight = 68.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(tokens.glassBg)
                                    .border(1.dp, tokens.glassBorder, RoundedCornerShape(12.dp))
                                    .clickable { requestValidatedLaunch(site.name, site.url) }
                                    .padding(10.dp)
                                    .testTag("automation_site_${site.id}"),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Icon(Icons.Default.Language, contentDescription = site.name, tint = tokens.accentBright, modifier = Modifier.size(14.dp))
                                        Text(site.name, color = tokens.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Text(site.category, color = tokens.accent, fontSize = 9.5.sp, fontFamily = FontFamily.Monospace)
                                }
                                Text(site.description, color = tokens.textMuted, fontSize = 10.5.sp, maxLines = 2)
                            }
                        }
                    }
                }
            }

            // Recent Launch Audit Feed
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.History, contentDescription = "Automation Audit", tint = tokens.accent, modifier = Modifier.size(18.dp))
                        Text("EXECUTION AUDIT LOG", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    if (logs.isEmpty()) {
                        Text("No web actions executed in this session yet.", color = tokens.textMuted, fontSize = 11.5.sp)
                    } else {
                        logs.forEach { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(tokens.glassBg, RoundedCornerShape(8.dp))
                                    .border(1.dp, tokens.glassBorder, RoundedCornerShape(8.dp))
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f).padding(end = 6.dp)) {
                                    Text("${item.action}: ${item.target}", color = tokens.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, maxLines = 1)
                                }
                                Text(
                                    text = item.status,
                                    color = if (item.status.contains("Block", true)) AlertCrimson else SentinelEmerald,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    pendingLaunchUrl?.let { (label, safeUrl) ->
        AlertDialog(
            onDismissRequest = { pendingLaunchUrl = null },
            containerColor = tokens.surfaceBg,
            title = { Text("Confirm External Launch", color = tokens.textPrimary) },
            text = {
                Text(
                    text = "Open $label in your external browser?\n\n$safeUrl",
                    color = tokens.textMuted,
                    fontSize = 12.5.sp,
                    fontFamily = FontFamily.Monospace
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val launched = runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(safeUrl)))
                        }.isSuccess
                        viewModel.logAutomationAction(
                            action = "LAUNCH",
                            target = label,
                            status = if (launched) "OPENED" else "NO_BROWSER"
                        )
                        pendingLaunchUrl = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SentinelEmerald, contentColor = tokens.screenBg)
                ) {
                    Text("OPEN")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingLaunchUrl = null }) {
                    Text("CANCEL", color = tokens.textMuted)
                }
            }
        )
    }
}
