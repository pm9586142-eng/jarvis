package com.example.ui.screens

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.agents.JarvisAgent
import com.example.agents.JarvisLanguage
import com.example.ai.FreeModelHealth
import com.example.data.preferences.JarvisAccentTheme
import com.example.ui.JarvisViewModel
import com.example.ui.components.BackupImportPreviewDialog
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlin.math.roundToInt

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val memories by viewModel.memories.collectAsState()
    val sessions by viewModel.chatSessions.collectAsState()
    val importPreview by viewModel.backupImportPreview.collectAsState()
    val backupStatus by viewModel.backupStatusMessage.collectAsState()
    val freeModelPool by viewModel.aiRepository.freeModelPoolStatus.collectAsState()
    val multiProviderStatus by viewModel.aiRepository.multiProviderStatus.collectAsState()

    var confirmClearTarget by remember { mutableStateOf<String?>(null) }
    var statusNotice by remember { mutableStateOf<String?>(null) }

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        val displayName = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        } ?: "backup.json"
        val rawText = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: ""
        viewModel.inspectBackupJson(rawText, displayName)
    }

    val accent = MaterialTheme.colorScheme.primary

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "SYSTEM SETTINGS",
            subtitle = "DataStore Preferences • Voice & HUD Calibration",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            (statusNotice ?: backupStatus)?.let { notice ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SentinelEmerald.copy(alpha = 0.16f), RoundedCornerShape(12.dp))
                        .border(1.dp, SentinelEmerald.copy(alpha = 0.55f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notice,
                        color = SentinelEmerald,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = {
                        statusNotice = null
                        viewModel.clearBackupStatusMessage()
                    }) {
                        Text("OK", color = MetallicSilver, fontSize = 11.sp)
                    }
                }
            }

            // Active Engine Status
            NeuralGlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = accent.copy(alpha = 0.45f)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "CORE ENGINE DIAGNOSTICS",
                        color = accent,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = if (viewModel.aiRepository.usesBackendProxy)
                            "Mode: Express Backend Proxy (${viewModel.aiRepository.backendUrl})"
                        else if (viewModel.aiRepository.hasRealApiKey)
                            "Mode: Direct Free Multi-Provider • Active: ${multiProviderStatus.activeProviderLabel} (${multiProviderStatus.activeModel})"
                        else
                            "Mode: Standby (Set GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or BACKEND_URL in Secrets)",
                        color = MetallicSilver,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "Active Sessions: ${sessions.size} • Vault Memories: ${memories.size}",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Free-Only Multi-Provider AI Router Card (Gemini Free -> Groq Free -> OpenRouter $0)
            NeuralGlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("settings_free_fallback_card"),
                borderColor = when {
                    multiProviderStatus.allProvidersExhausted -> AlertCrimson.copy(alpha = 0.55f)
                    multiProviderStatus.fallbackUsed || multiProviderStatus.switchedFromProvider != null -> QuantumGold.copy(alpha = 0.55f)
                    else -> SentinelEmerald.copy(alpha = 0.45f)
                }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "FREE-ONLY MULTI-PROVIDER AI",
                            color = accent,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Box(
                            modifier = Modifier
                                .background(SentinelEmerald.copy(alpha = 0.16f), RoundedCornerShape(6.dp))
                                .border(1.dp, SentinelEmerald.copy(alpha = 0.45f), RoundedCornerShape(6.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "₹0 • PAID BLOCKED",
                                color = SentinelEmerald,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    Text(
                        text = "Active: ${multiProviderStatus.activeProviderLabel} • ${multiProviderStatus.activeModel} • Switches: ${multiProviderStatus.totalProviderSwitches}",
                        color = MetallicSilver,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    Text(
                        text = "Automatically switches across Google Gemini Free, Groq Free API, and live \$0-verified OpenRouter :free models on HTTP 429 limits while preserving context. Never calls paid models.",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        multiProviderStatus.providers.forEach { prov ->
                            val isCurrent = prov.id == multiProviderStatus.activeProvider && (prov.configured || viewModel.aiRepository.usesBackendProxy)
                            val provColor = when {
                                !prov.configured -> MetallicSilverMuted
                                prov.readyModels > 0 -> SentinelEmerald
                                else -> QuantumGold
                            }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(ObsidianGlass, RoundedCornerShape(8.dp))
                                    .border(
                                        1.dp,
                                        if (isCurrent) accent.copy(alpha = 0.65f) else ObsidianGlassBorder,
                                        RoundedCornerShape(8.dp)
                                    )
                                    .padding(horizontal = 10.dp, vertical = 7.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = prov.label,
                                        color = if (isCurrent) IceBlueBright else MetallicSilver,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal
                                    )
                                    if (isCurrent) {
                                        Text(
                                            text = "ACTIVE",
                                            color = accent,
                                            fontSize = 9.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                                Text(
                                    text = if (viewModel.aiRepository.usesBackendProxy && !prov.configured) "SERVER MANAGED" else prov.statusLabel,
                                    color = if (viewModel.aiRepository.usesBackendProxy && !prov.configured) IceBlueBright else provColor,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Text(
                        text = "GEMINI FREE TIER SUB-POOL",
                        color = MetallicSilverMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        freeModelPool.models.forEach { entry ->
                            val statusLabel = when (entry.status) {
                                FreeModelHealth.AVAILABLE -> "READY"
                                FreeModelHealth.COOLDOWN -> "COOLDOWN ${entry.cooldownRemainingSeconds}S"
                                FreeModelHealth.RPD_EXHAUSTED -> "DAILY RESET WAIT"
                                FreeModelHealth.UNAVAILABLE -> "UNAVAILABLE"
                            }
                            val statusColor = when (entry.status) {
                                FreeModelHealth.AVAILABLE -> SentinelEmerald
                                FreeModelHealth.COOLDOWN -> QuantumGold
                                FreeModelHealth.RPD_EXHAUSTED, FreeModelHealth.UNAVAILABLE -> AlertCrimson
                            }
                            val isActiveModel = entry.model == freeModelPool.lastActiveModel
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(ObsidianGlass, RoundedCornerShape(8.dp))
                                    .border(
                                        1.dp,
                                        if (isActiveModel) accent.copy(alpha = 0.55f) else ObsidianGlassBorder,
                                        RoundedCornerShape(8.dp)
                                    )
                                    .padding(horizontal = 10.dp, vertical = 7.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = entry.model,
                                        color = if (isActiveModel) IceBlueBright else MetallicSilver,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = if (isActiveModel) FontWeight.Bold else FontWeight.Normal
                                    )
                                    if (entry.isPrimary) {
                                        Text(
                                            text = "PRIMARY",
                                            color = accent,
                                            fontSize = 9.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                    } else if (isActiveModel) {
                                        Text(
                                            text = "ACTIVE",
                                            color = QuantumGold,
                                            fontSize = 9.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                                Text(
                                    text = statusLabel,
                                    color = statusColor,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            // Language Preference
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Language, contentDescription = "Language", tint = accent, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("PRIMARY LANGUAGE", color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        JarvisLanguage.entries.forEach { lang ->
                            val selected = prefs.language == lang
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) accent.copy(alpha = 0.18f) else ObsidianGlass)
                                    .border(1.dp, if (selected) accent else ObsidianGlassBorder, RoundedCornerShape(10.dp))
                                    .clickable { viewModel.selectLanguage(lang) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                                    .testTag("settings_lang_${lang.name.lowercase()}")
                            ) {
                                Text(
                                    text = lang.displayName,
                                    color = if (selected) accent else MetallicSilverMuted,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }
                }
            }

            // Default Agent Preference
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.SmartToy, contentDescription = "Default Agent", tint = accent, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("DEFAULT NEURAL AGENT", color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        JarvisAgent.entries.forEach { agent ->
                            val selected = prefs.defaultAgent == agent
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) agent.accentColor.copy(alpha = 0.18f) else ObsidianGlass)
                                    .border(
                                        1.dp,
                                        if (selected) agent.accentColor else ObsidianGlassBorder,
                                        RoundedCornerShape(10.dp)
                                    )
                                    .clickable { viewModel.updateDefaultAgent(agent) }
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                                    .testTag("settings_agent_${agent.codename.lowercase()}")
                            ) {
                                Text(
                                    text = agent.codename,
                                    color = if (selected) agent.accentColor else MetallicSilverMuted,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }
                }
            }

            // Voice Speech Rate, Pitch, Volume & Playback Controls
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = "Voice Calibration", tint = accent, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("VOICE ASSISTANT CALIBRATION", color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            TextButton(
                                onClick = { viewModel.voiceManager.speak(prefs.language.greeting) },
                                modifier = Modifier.testTag("settings_test_voice_btn")
                            ) {
                                Text("TEST VOICE", color = accent, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                            TextButton(
                                onClick = { viewModel.stopSpeaking() },
                                modifier = Modifier.testTag("settings_stop_voice_btn")
                            ) {
                                Text("STOP", color = AlertCrimson, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }

                    SettingsToggleRow(
                        icon = Icons.Default.Mic,
                        title = "Voice Mode Master Switch",
                        subtitle = "Enable microphone input and Voice HUD synthesis",
                        checked = prefs.voiceModeEnabled,
                        accent = accent,
                        tag = "settings_voice_mode_switch",
                        onCheckedChange = { viewModel.updateVoiceModeEnabled(it) }
                    )

                    SettingsToggleRow(
                        icon = Icons.AutoMirrored.Filled.VolumeOff,
                        title = "Mute Voice Output",
                        subtitle = "Silence spoken responses while keeping text replies active",
                        checked = prefs.voiceMuted,
                        accent = QuantumGold,
                        tag = "settings_voice_mute_switch",
                        onCheckedChange = { viewModel.setVoiceMuted(it) }
                    )

                    SettingsToggleRow(
                        icon = Icons.AutoMirrored.Filled.VolumeUp,
                        title = stringResource(R.string.settings_daily_summary_title),
                        subtitle = stringResource(R.string.settings_daily_summary_subtitle),
                        checked = prefs.autoSpeakDailySummary,
                        accent = accent,
                        tag = "settings_auto_speak_daily_summary",
                        onCheckedChange = { viewModel.updateAutoSpeakDailySummary(it) }
                    )

                    SettingsToggleRow(
                        icon = Icons.AutoMirrored.Filled.VolumeUp,
                        title = "Auto-Speak AI Replies",
                        subtitle = "Automatically read completed Gemini replies aloud",
                        checked = prefs.autoSpeakReplies,
                        accent = accent,
                        tag = "settings_autospeak_switch",
                        onCheckedChange = { viewModel.updateAutoSpeakReplies(it) }
                    )

                    SettingsToggleRow(
                        icon = Icons.Default.GraphicEq,
                        title = "Continuous Hands-Free Loop",
                        subtitle = "Listen again automatically after JARVIS finishes speaking",
                        checked = prefs.continuousConversationMode,
                        accent = SentinelEmerald,
                        tag = "settings_continuous_mode_switch",
                        onCheckedChange = { viewModel.updateContinuousConversationPreference(it) }
                    )

                    Text(
                        text = "Voice Volume: ${(prefs.voiceVolume * 100).roundToInt()}%",
                        color = IceBlueBright,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Slider(
                        value = prefs.voiceVolume,
                        onValueChange = { viewModel.updateVoiceVolume(it) },
                        valueRange = 0f..1f,
                        colors = SliderDefaults.colors(thumbColor = accent, activeTrackColor = accent),
                        modifier = Modifier.testTag("settings_voice_volume_slider")
                    )

                    Text(
                        text = "Speech Rate: ${((prefs.speechRate * 100).roundToInt() / 100f)}x",
                        color = IceBlueBright,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Slider(
                        value = prefs.speechRate,
                        onValueChange = { viewModel.updateSpeechRate(it) },
                        valueRange = 0.5f..2.0f,
                        colors = SliderDefaults.colors(thumbColor = accent, activeTrackColor = accent),
                        modifier = Modifier.testTag("settings_speech_rate_slider")
                    )

                    Text(
                        text = "Speech Pitch: ${((prefs.speechPitch * 100).roundToInt() / 100f)}x",
                        color = IceBlueBright,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Slider(
                        value = prefs.speechPitch,
                        onValueChange = { viewModel.updateSpeechPitch(it) },
                        valueRange = 0.5f..2.0f,
                        colors = SliderDefaults.colors(thumbColor = accent, activeTrackColor = accent),
                        modifier = Modifier.testTag("settings_speech_pitch_slider")
                    )
                }
            }

            // Intelligence Toggles
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SettingsToggleRow(
                        icon = Icons.Default.Public,
                        title = "Google Search Grounding",
                        subtitle = "Enable live web search citations when proxy/model supports it",
                        checked = prefs.webSearchEnabled,
                        accent = accent,
                        tag = "settings_websearch_switch",
                        onCheckedChange = { viewModel.updateWebSearchEnabled(it) }
                    )
                    SettingsToggleRow(
                        icon = Icons.Default.Psychology,
                        title = "Automatic Memory Extraction",
                        subtitle = "Extract durable user preferences & projects after replies",
                        checked = prefs.autoExtractMemories,
                        accent = accent,
                        tag = "settings_memory_extract_switch",
                        onCheckedChange = { viewModel.updateAutoExtractMemories(it) }
                    )
                }
            }

            // Theme Accent Color
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Palette, contentDescription = "Theme Accent", tint = accent, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("THEME ACCENT COLOR", color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        JarvisAccentTheme.entries.forEach { themeOption ->
                            val selected = prefs.accentTheme == themeOption
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { viewModel.updateAccentTheme(themeOption) }
                                    .padding(6.dp)
                                    .testTag("settings_accent_${themeOption.key.lowercase()}")
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .background(themeOption.primary, CircleShape)
                                        .border(
                                            width = if (selected) 2.5.dp else 1.dp,
                                            color = if (selected) MetallicSilver else ObsidianGlassBorder,
                                            shape = CircleShape
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (selected) {
                                        Icon(
                                            imageVector = Icons.Default.Check,
                                            contentDescription = "Selected",
                                            tint = ObsidianBlack,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = themeOption.key,
                                    color = if (selected) themeOption.bright else MetallicSilverMuted,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }

            // Export & Import Vault Backup
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Download, contentDescription = "Backup", tint = accent, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("EXPORT & IMPORT VAULT BACKUP", color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Text(
                        text = "Export chats, memories, and tasks via Android Share Sheet or import a validated JSON backup.",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { viewModel.exportBackup("json") },
                            colors = ButtonDefaults.buttonColors(containerColor = accent.copy(alpha = 0.18f), contentColor = accent),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).testTag("settings_export_json_btn")
                        ) {
                            Text("EXPORT JSON", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        }
                        Button(
                            onClick = { viewModel.exportBackup("md") },
                            colors = ButtonDefaults.buttonColors(containerColor = ObsidianGlass, contentColor = MetallicSilver),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).testTag("settings_export_md_btn")
                        ) {
                            Text("EXPORT MD", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        }
                    }
                    Button(
                        onClick = { importLauncher.launch(arrayOf("application/json", "text/*")) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = SentinelEmerald.copy(alpha = 0.18f),
                            contentColor = SentinelEmerald
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().testTag("settings_import_json_btn")
                    ) {
                        Icon(Icons.Default.UploadFile, contentDescription = "Import Backup", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("IMPORT JSON BACKUP", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                    }
                }
            }

            // Clear Data Controls
            NeuralGlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = AlertCrimson.copy(alpha = 0.35f)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.DeleteForever, contentDescription = "Vault Reset", tint = AlertCrimson, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("VAULT & HISTORY MANAGEMENT", color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { confirmClearTarget = "CHATS" },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AlertCrimson.copy(alpha = 0.18f),
                                contentColor = AlertCrimson
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).testTag("settings_clear_chats_btn")
                        ) {
                            Text("CLEAR CHATS", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        }
                        Button(
                            onClick = { confirmClearTarget = "MEMORIES" },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = QuantumGold.copy(alpha = 0.18f),
                                contentColor = QuantumGold
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).testTag("settings_clear_memories_btn")
                        ) {
                            Text("CLEAR MEMORIES", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    confirmClearTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { confirmClearTarget = null },
            containerColor = ObsidianGlass,
            title = {
                Text(
                    text = if (target == "CHATS") "Clear All Chat Sessions?" else "Clear All Memory Vault Entries?",
                    color = MetallicSilver
                )
            },
            text = {
                Text(
                    text = if (target == "CHATS")
                        "This permanently removes all conversation sessions and messages on this device."
                    else
                        "This permanently deletes all saved facts and preferences from your Memory Vault.",
                    color = MetallicSilverMuted,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (target == "CHATS") {
                            viewModel.clearAllChatHistory()
                            statusNotice = "All chat sessions cleared."
                        } else {
                            viewModel.clearAllMemories()
                            statusNotice = "Memory vault cleared."
                        }
                        confirmClearTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AlertCrimson, contentColor = MetallicSilver)
                ) {
                    Text("CONFIRM")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmClearTarget = null }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            }
        )
    }

    importPreview?.let { preview ->
        BackupImportPreviewDialog(
            preview = preview,
            onConfirm = { viewModel.confirmImportBackup() },
            onDismiss = { viewModel.dismissBackupImportPreview() }
        )
    }
}

@Composable
private fun SettingsToggleRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    accent: androidx.compose.ui.graphics.Color,
    tag: String,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier.weight(1f).padding(end = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = title, tint = accent, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(title, color = MetallicSilver, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = MetallicSilverMuted, fontSize = 11.sp, lineHeight = 15.sp)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            modifier = Modifier.testTag(tag),
            colors = SwitchDefaults.colors(
                checkedThumbColor = ObsidianBlack,
                checkedTrackColor = accent
            )
        )
    }
}
