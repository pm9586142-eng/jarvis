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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import org.json.JSONObject

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EcosystemDiagnosticsScreen(viewModel: JarvisViewModel) {
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val isOnline by viewModel.isNetworkOnline.collectAsState()
    val networkLabel by viewModel.networkLabel.collectAsState()
    val config by viewModel.ecosystemConfig.collectAsState()
    val isSyncing by viewModel.isSyncingConfig.collectAsState()
    val probes by viewModel.providerProbes.collectAsState()
    val adminNotice by viewModel.configAdminMessage.collectAsState()

    var activeProviderDraft by remember(config.version) { mutableStateOf(config.activeProvider) }
    var fallbackProviderDraft by remember(config.version) { mutableStateOf(config.fallbackProvider) }
    var defaultModelDraft by remember(config.version) { mutableStateOf(config.defaultModel) }
    var defaultLangDraft by remember(config.version) { mutableStateOf(config.defaultLanguage) }
    var neuralTtsDraft by remember(config.version) { mutableStateOf(config.neuralTtsEnabled) }
    var femaleVoiceDraft by remember(config.version) { mutableStateOf(config.femaleVoiceEnabled) }

    LaunchedEffect(Unit) {
        viewModel.syncRemoteConfigNow()
    }

    val providerIds = listOf("gemini", "groq", "openrouter")
    val languages = listOf("ENGLISH", "HINDI", "HINGLISH")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
    ) {
        JarvisHeader(
            title = "ECOSYSTEM DIAGNOSTICS",
            subtitle = "Unified Backend Telemetry & Remote Admin",
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
            adminNotice?.let { msg ->
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
                    TextButton(onClick = { viewModel.clearConfigAdminMessage() }) {
                        Text("OK", color = tokens.textPrimary, fontSize = 11.sp)
                    }
                }
            }

            // Live Sync Status Card
            NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = tokens.accent.copy(alpha = 0.45f)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(
                                imageVector = if (isOnline) Icons.Default.CloudDone else Icons.Default.CloudOff,
                                contentDescription = "Backend Status",
                                tint = if (isOnline) SentinelEmerald else AlertCrimson,
                                modifier = Modifier.size(18.dp)
                            )
                            Text("SINGLE SOURCE OF TRUTH", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }

                        Box(
                            modifier = Modifier
                                .background(
                                    if (config.isCompatible) SentinelEmerald.copy(alpha = 0.16f) else QuantumGold.copy(alpha = 0.18f),
                                    RoundedCornerShape(8.dp)
                                )
                                .border(
                                    1.dp,
                                    if (config.isCompatible) SentinelEmerald.copy(alpha = 0.5f) else QuantumGold.copy(alpha = 0.6f),
                                    RoundedCornerShape(8.dp)
                                )
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                .testTag("diagnostics_compat_badge")
                        ) {
                            Text(
                                text = if (config.isCompatible) "COMPATIBLE" else "UPGRADE RECOMMENDED",
                                color = if (config.isCompatible) SentinelEmerald else QuantumGold,
                                fontSize = 9.5.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Text(
                        text = "Backend: ${viewModel.resolveEffectiveBackendUrl().ifBlank { "UNSET" }}",
                        color = tokens.accentBright,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Network: $networkLabel • Config v${config.version} • API ${config.apiVersion}",
                        color = tokens.textPrimary,
                        fontSize = 11.5.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Min Android: ${config.minClientVersionAndroid} • Cache Mode: ${if (config.fromCache) "CACHED FALLBACK" else "LIVE VERIFIED"}",
                        color = tokens.textMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    config.errorMessage?.let { err ->
                        Text("Sync Note: $err", color = QuantumGold, fontSize = 11.sp)
                    }

                    Button(
                        onClick = { viewModel.syncRemoteConfigNow() },
                        enabled = !isSyncing,
                        colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.22f), contentColor = tokens.accentBright),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).testTag("diagnostics_sync_now_btn")
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = tokens.accentBright)
                        } else {
                            Icon(Icons.Default.Sync, contentDescription = "Sync Config", modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isSyncing) "SYNCHRONIZING..." else "SYNC NOW", fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Per-Provider Real Connection Probes
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.VerifiedUser, contentDescription = "Provider Probes", tint = tokens.accent, modifier = Modifier.size(18.dp))
                        Text("LIVE PROVIDER CONNECTION PROBES", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }

                    providerIds.forEach { pid ->
                        val probe = probes[pid]
                        val syncedInfo = config.providers.find { it.id.equals(pid, ignoreCase = true) }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(tokens.glassBg, RoundedCornerShape(10.dp))
                                .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                Text(
                                    text = pid.uppercase() + (syncedInfo?.maskedKey?.takeIf { it.isNotBlank() }?.let { " ($it)" } ?: ""),
                                    color = tokens.textPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                                Text(
                                    text = if (probe != null) {
                                        "${probe.connectionState} (${probe.latencyMs}ms) • ${probe.detail}"
                                    } else if (syncedInfo?.configured == true) {
                                        "Server key configured • Tap TEST to verify live"
                                    } else {
                                        "Tap TEST to run live server probe"
                                    },
                                    color = when {
                                        probe == null -> tokens.textMuted
                                        probe.ok -> SentinelEmerald
                                        else -> AlertCrimson
                                    },
                                    fontSize = 10.5.sp
                                )
                            }
                            Button(
                                onClick = { viewModel.testBackendProvider(pid) },
                                colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.2f), contentColor = tokens.accentBright),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.defaultMinSize(minHeight = 48.dp).testTag("diagnostics_probe_$pid")
                            ) {
                                Text("TEST", fontSize = 10.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Remote Config Admin Editor
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.AdminPanelSettings, contentDescription = "Remote Admin", tint = QuantumGold, modifier = Modifier.size(18.dp))
                        Text("REMOTE CONFIG ADMIN EDITOR", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }

                    Text("ACTIVE PROVIDER", color = tokens.textMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        providerIds.forEach { pid ->
                            val selected = activeProviderDraft == pid
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                                    .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(8.dp))
                                    .clickable { activeProviderDraft = pid }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(pid.uppercase(), color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }

                    Text("FALLBACK PROVIDER", color = tokens.textMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        providerIds.forEach { pid ->
                            val selected = fallbackProviderDraft == pid
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) SentinelEmerald.copy(alpha = 0.2f) else tokens.glassBg)
                                    .border(1.dp, if (selected) SentinelEmerald else tokens.glassBorder, RoundedCornerShape(8.dp))
                                    .clickable { fallbackProviderDraft = pid }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(pid.uppercase(), color = if (selected) SentinelEmerald else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }

                    OutlinedTextField(
                        value = defaultModelDraft,
                        onValueChange = { defaultModelDraft = it },
                        label = { Text("Default AI Model ID", fontSize = 12.sp) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = tokens.accent,
                            unfocusedBorderColor = tokens.glassBorder,
                            focusedTextColor = tokens.textPrimary,
                            unfocusedTextColor = tokens.textPrimary
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("diagnostics_default_model_input")
                    )

                    Text("DEFAULT LANGUAGE", color = tokens.textMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        languages.forEach { lang ->
                            val selected = defaultLangDraft.equals(lang, ignoreCase = true)
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                                    .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(8.dp))
                                    .clickable { defaultLangDraft = lang }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(lang, color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Neural TTS Enabled", color = tokens.textPrimary, fontSize = 12.5.sp)
                        Switch(
                            checked = neuralTtsDraft,
                            onCheckedChange = { neuralTtsDraft = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = tokens.screenBg, checkedTrackColor = tokens.accent)
                        )
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Female Voice Enabled", color = tokens.textPrimary, fontSize = 12.5.sp)
                        Switch(
                            checked = femaleVoiceDraft,
                            onCheckedChange = { femaleVoiceDraft = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = tokens.screenBg, checkedTrackColor = tokens.accent)
                        )
                    }

                    Button(
                        onClick = {
                            val patch = JSONObject().apply {
                                put("activeProvider", activeProviderDraft)
                                put("fallbackProvider", fallbackProviderDraft)
                                put("defaultModel", defaultModelDraft.trim())
                                put("defaultLanguage", defaultLangDraft)
                                put(
                                    "voice",
                                    JSONObject().apply {
                                        put("neuralTtsEnabled", neuralTtsDraft)
                                        put("femaleVoiceEnabled", femaleVoiceDraft)
                                    }
                                )
                            }
                            viewModel.pushRemoteConfigPatch(patch)
                        },
                        enabled = !isSyncing,
                        colors = ButtonDefaults.buttonColors(containerColor = SentinelEmerald.copy(alpha = 0.22f), contentColor = SentinelEmerald),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).testTag("diagnostics_push_config_btn")
                    ) {
                        Text("PUBLISH REMOTE CONFIG", fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
