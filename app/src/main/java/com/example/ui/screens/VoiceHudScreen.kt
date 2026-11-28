package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.agents.JarvisLanguage
import com.example.ui.JarvisViewModel
import com.example.ui.components.AudioWaveVisualizer
import com.example.ui.components.NeuralIntelligenceCanvas
import com.example.ui.components.VisualizerMode
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
fun VoiceHudScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val isSpeaking by viewModel.voiceManager.isSpeaking.collectAsState()
    val isSpeechPaused by viewModel.voiceManager.isSpeechPaused.collectAsState()
    val isVoiceMuted by viewModel.voiceManager.isMuted.collectAsState()
    val voiceStatusLabel by viewModel.voiceManager.voiceStatusLabel.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val transcript by viewModel.voiceManager.currentTranscript.collectAsState()
    val audioRms by viewModel.voiceManager.audioRmsLevel.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val isAiThinking by viewModel.isAiThinking.collectAsState()
    val continuousVoiceMode by viewModel.continuousVoiceMode.collectAsState()
    val voiceErrorMessage by viewModel.voiceErrorMessage.collectAsState()
    val micPermissionDenied by viewModel.micPermissionDenied.collectAsState()
    val commandFeedback by viewModel.lastVoiceCommandFeedback.collectAsState()

    var pendingHandsFreeRequest by remember { mutableStateOf(false) }

    val visualizerMode = when {
        isSpeaking -> VisualizerMode.SPEAKING
        isListening -> VisualizerMode.LISTENING
        isAiThinking -> VisualizerMode.PROCESSING
        else -> VisualizerMode.STANDBY
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.markMicPermissionDenied(false)
            if (pendingHandsFreeRequest) {
                pendingHandsFreeRequest = false
                viewModel.startContinuousVoiceConversation()
            } else {
                viewModel.startVoiceListening()
            }
        } else {
            pendingHandsFreeRequest = false
            viewModel.markMicPermissionDenied(true)
        }
    }

    fun launchWithMicPermission(handsFree: Boolean) {
        if (!prefs.voiceModeEnabled) {
            viewModel.updateVoiceModeEnabled(true)
        }
        val hasAudioPerm = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (hasAudioPerm) {
            viewModel.markMicPermissionDenied(false)
            if (handsFree) {
                viewModel.startContinuousVoiceConversation()
            } else {
                viewModel.startVoiceListening()
            }
        } else {
            pendingHandsFreeRequest = handsFree
            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        // Back Button Top Left
        IconButton(
            onClick = {
                viewModel.exitContinuousVoiceMode()
                viewModel.navigateBack()
            },
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(16.dp)
                .testTag("voice_hud_back_btn")
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = IceBlue
            )
        }

        // Mute toggle + Language badge Top Right
        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(
                onClick = { viewModel.toggleVoiceMuted() },
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        if (isVoiceMuted) AlertCrimson.copy(alpha = 0.2f) else ObsidianGlass,
                        RoundedCornerShape(10.dp)
                    )
                    .border(
                        1.dp,
                        if (isVoiceMuted) AlertCrimson.copy(alpha = 0.6f) else ObsidianGlassBorder,
                        RoundedCornerShape(10.dp)
                    )
                    .testTag("voice_hud_mute_btn")
            ) {
                Icon(
                    imageVector = if (isVoiceMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                    contentDescription = if (isVoiceMuted) "Unmute voice output" else "Mute voice output",
                    tint = if (isVoiceMuted) AlertCrimson else IceBlueBright,
                    modifier = Modifier.size(18.dp)
                )
            }
            Text(
                text = language.name,
                color = IceBlueBright,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 60.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header Designation
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "VOICE INTELLIGENCE HUD",
                    color = MetallicSilver,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 2.sp,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(
                            when {
                                voiceStatusLabel.startsWith("ElevenLabs – Monika") -> SentinelEmerald.copy(alpha = 0.14f)
                                voiceStatusLabel.contains("Reconnecting") -> QuantumGold.copy(alpha = 0.14f)
                                voiceStatusLabel.contains("Built-in") -> IceBlue.copy(alpha = 0.14f)
                                else -> AlertCrimson.copy(alpha = 0.14f)
                            }
                        )
                        .border(
                            1.dp,
                            when {
                                voiceStatusLabel.startsWith("ElevenLabs – Monika") -> SentinelEmerald.copy(alpha = 0.55f)
                                voiceStatusLabel.contains("Reconnecting") -> QuantumGold.copy(alpha = 0.55f)
                                voiceStatusLabel.contains("Built-in") -> IceBlue.copy(alpha = 0.55f)
                                else -> AlertCrimson.copy(alpha = 0.55f)
                            },
                            RoundedCornerShape(999.dp)
                        )
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                        .testTag("hud_voice_status_badge")
                ) {
                    Text(
                        text = voiceStatusLabel,
                        color = when {
                            voiceStatusLabel.startsWith("ElevenLabs – Monika") -> SentinelEmerald
                            voiceStatusLabel.contains("Reconnecting") -> QuantumGold
                            voiceStatusLabel.contains("Built-in") -> IceBlueBright
                            else -> AlertCrimson
                        },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                if (continuousVoiceMode) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(SentinelEmerald.copy(alpha = 0.16f))
                            .border(1.dp, SentinelEmerald.copy(alpha = 0.65f), RoundedCornerShape(999.dp))
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "CONTINUOUS VOICE MODE ENGAGED",
                            color = SentinelEmerald,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
                Text(
                    text = when {
                        !prefs.voiceModeEnabled -> "VOICE MODE DISABLED IN SETTINGS"
                        isSpeechPaused -> "VOICE OUTPUT PAUSED"
                        isSpeaking -> "JARVIS VOCAL SYNTHESIS ACTIVE"
                        isAiThinking -> "PROCESSING NEURAL DIRECTIVE..."
                        isListening -> "LIVE ACOUSTIC LISTENING MATRIX"
                        continuousVoiceMode -> "CONTINUOUS VOICE STANDBY"
                        else -> "VOICE MATRIX STANDBY • TAP TO SPEAK"
                    },
                    color = when {
                        !prefs.voiceModeEnabled -> AlertCrimson
                        isSpeaking || isSpeechPaused -> QuantumGold
                        isAiThinking -> IceBlueBright
                        isListening -> SentinelEmerald
                        else -> MetallicSilverMuted
                    },
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }

            if (!prefs.voiceModeEnabled) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(QuantumGold.copy(alpha = 0.14f))
                        .border(1.dp, QuantumGold.copy(alpha = 0.55f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Voice Mode is muted globally.",
                        color = MetallicSilver,
                        fontSize = 12.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = { viewModel.updateVoiceModeEnabled(true) },
                        colors = ButtonDefaults.buttonColors(containerColor = QuantumGold, contentColor = ObsidianBlack),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("ENABLE", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Living Neural AI Core Orb (Expands with voice volume & mode)
            Box(
                modifier = Modifier.size(220.dp),
                contentAlignment = Alignment.Center
            ) {
                NeuralIntelligenceCanvas(
                    modifier = Modifier.fillMaxSize(),
                    audioPulse = when {
                        isSpeaking || isListening -> audioRms.coerceAtLeast(0.25f)
                        isAiThinking -> 0.22f
                        else -> 0.05f
                    },
                    nodeCount = 52,
                    isInteractive = true
                )
            }

            // Quick Language Pills (EN / HI / Hinglish / GU)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                JarvisLanguage.entries.forEach { lang ->
                    val selected = lang == language
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (selected) IceBlue.copy(alpha = 0.2f) else ObsidianGlass)
                            .border(1.dp, if (selected) IceBlueBright else ObsidianGlassBorder, RoundedCornerShape(999.dp))
                            .clickable { viewModel.selectLanguage(lang) }
                            .padding(horizontal = 12.dp, vertical = 7.dp)
                            .testTag("voice_hud_lang_${lang.name.lowercase()}")
                    ) {
                        Text(
                            text = lang.displayName,
                            color = if (selected) IceBlueBright else MetallicSilverMuted,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            // Live Speech Transcript
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianGlass, RoundedCornerShape(14.dp))
                    .border(
                        1.dp,
                        when {
                            isListening -> SentinelEmerald
                            isSpeaking -> QuantumGold
                            else -> ObsidianGlassBorder
                        },
                        RoundedCornerShape(14.dp)
                    )
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (transcript.isNotBlank()) {
                            "\"$transcript\""
                        } else if (isListening) {
                            "Listening for speech (English / Hindi / Hinglish)..."
                        } else if (continuousVoiceMode) {
                            "Continuous conversation active: speak naturally and JARVIS will reply aloud and resume listening."
                        } else {
                            "Tap Speak for a single voice turn, or Start Voice Mode for hands-free conversation."
                        },
                        color = MetallicSilver,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 22.sp
                    )
                    commandFeedback?.let { feedback ->
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = feedback,
                            color = SentinelEmerald,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Friendly Voice Error & App Settings Recovery Card
            if (voiceErrorMessage != null || micPermissionDenied) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(AlertCrimson.copy(alpha = 0.14f))
                        .border(1.dp, AlertCrimson.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
                        .padding(12.dp)
                        .testTag("voice_error_banner"),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ErrorOutline,
                            contentDescription = "Voice Notice",
                            tint = AlertCrimson,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = voiceErrorMessage
                                ?: "Microphone access was denied. Enable Microphone permission in App Settings to talk to JARVIS.",
                            color = MetallicSilver,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = { viewModel.clearVoiceError() },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Dismiss error",
                                tint = MetallicSilverMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    if (micPermissionDenied) {
                        OutlinedButton(
                            onClick = {
                                val intent = Intent(
                                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                    Uri.fromParts("package", context.packageName, null)
                                ).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                context.startActivity(intent)
                            },
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, IceBlue),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("open_app_settings_btn")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "Open App Settings",
                                tint = IceBlueBright,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "OPEN APP SETTINGS",
                                color = IceBlueBright,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Audio Wave Visualizer (Mode-aware for Listening / Speaking / Processing / Standby)
            AudioWaveVisualizer(
                audioLevel = audioRms,
                isActive = isSpeaking || isListening || isAiThinking,
                mode = visualizerMode,
                height = 42.dp
            )

            // Natural AI Voice Output Controls (Pause / Resume / Stop)
            if (isSpeaking || isSpeechPaused) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            if (isSpeechPaused) viewModel.resumeSpeaking() else viewModel.pauseSpeaking()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = QuantumGold,
                            contentColor = ObsidianBlack
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("voice_hud_pause_resume_btn")
                    ) {
                        Icon(
                            imageVector = if (isSpeechPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                            contentDescription = if (isSpeechPaused) "Resume speaking" else "Pause speaking",
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isSpeechPaused) "RESUME" else "PAUSE", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    Button(
                        onClick = { viewModel.stopSpeaking() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AlertCrimson,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("voice_hud_stop_tts_btn")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = "Stop speaking",
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("STOP AUDIO", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }

            // Primary Voice Input Controls
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (continuousVoiceMode) {
                    Button(
                        onClick = { viewModel.exitContinuousVoiceMode() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AlertCrimson,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("exit_hands_free_btn")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = "Stop Voice Mode",
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "STOP VOICE MODE",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = {
                                if (isListening) {
                                    viewModel.stopVoiceListening()
                                } else {
                                    launchWithMicPermission(handsFree = false)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isListening) AlertCrimson else IceBlue,
                                contentColor = if (isListening) Color.White else ObsidianBlack
                            ),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                                .testTag("voice_hud_mic_btn")
                        ) {
                            Icon(
                                imageVector = if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                                contentDescription = "Microphone",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isListening) "STOP MIC" else "SPEAK",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.8.sp
                            )
                        }

                        Button(
                            onClick = { launchWithMicPermission(handsFree = true) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = ObsidianGlass,
                                contentColor = SentinelEmerald
                            ),
                            border = BorderStroke(1.dp, SentinelEmerald.copy(alpha = 0.7f)),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1.25f)
                                .height(50.dp)
                                .testTag("hands_free_loop_btn")
                        ) {
                            Icon(
                                imageVector = Icons.Default.GraphicEq,
                                contentDescription = "Start Voice Mode",
                                tint = SentinelEmerald,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "START VOICE MODE",
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.6.sp
                            )
                        }
                    }
                }
            }

            // Local Instant Voice Commands (Zero latency, handled before Gemini)
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "INSTANT OFFLINE VOICE COMMANDS",
                    color = MetallicSilverMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        "open security",
                        "toggle lockdown",
                        "what's my battery",
                        "new chat",
                        "stop"
                    ).forEach { cmd ->
                        QuickVoicePill(
                            text = "\"$cmd\"",
                            onClick = { viewModel.processVoiceInput(cmd) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickVoicePill(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .background(ObsidianGlass, RoundedCornerShape(10.dp))
            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = IceBlueBright,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.Center
        )
    }
}
