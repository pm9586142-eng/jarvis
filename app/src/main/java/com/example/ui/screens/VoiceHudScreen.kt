package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.ui.JarvisViewModel
import com.example.ui.components.AudioWaveVisualizer
import com.example.ui.components.NeuralIntelligenceCanvas
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
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val transcript by viewModel.voiceManager.currentTranscript.collectAsState()
    val audioRms by viewModel.voiceManager.audioRmsLevel.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.startVoiceListening()
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
                viewModel.stopSpeaking()
                viewModel.stopVoiceListening()
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

        // Language indicator Top Right
        Text(
            text = "LANG: ${language.name}",
            color = IceBlueBright,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(20.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 50.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
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
                Text(
                    text = when {
                        isSpeaking -> "JARVIS VOCAL SYNTHESIS ACTIVE"
                        isListening -> "LIVE ACOUSTIC LISTENING MATRIX"
                        else -> "VOICE MATRIX STANDBY • TAP TO SPEAK"
                    },
                    color = when {
                        isSpeaking -> QuantumGold
                        isListening -> SentinelEmerald
                        else -> MetallicSilverMuted
                    },
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Living Neural AI Core (Expands with voice volume)
            Box(
                modifier = Modifier
                    .size(280.dp),
                contentAlignment = Alignment.Center
            ) {
                NeuralIntelligenceCanvas(
                    modifier = Modifier.fillMaxSize(),
                    audioPulse = if (isSpeaking || isListening) audioRms else 0.05f,
                    nodeCount = 52,
                    isInteractive = true
                )
            }

            // Live Speech Transcript
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianGlass, RoundedCornerShape(14.dp))
                    .border(1.dp, if (isListening) SentinelEmerald else ObsidianGlassBorder, RoundedCornerShape(14.dp))
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (transcript.isNotBlank()) "\"$transcript\"" else if (isListening) "Listening for speech..." else "Tap the microphone below to issue a voice command to JARVIS.",
                    color = MetallicSilver,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )
            }

            // Audio Wave Visualizer
            AudioWaveVisualizer(
                audioLevel = audioRms,
                isActive = isSpeaking || isListening,
                height = 36.dp
            )

            // Primary Controls: Mic and Stop Button
            Row(
                horizontalArrangement = Arrangement.spacedBy(20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isSpeaking) {
                    Button(
                        onClick = { viewModel.stopSpeaking() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AlertCrimson,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.testTag("voice_hud_interrupt_btn")
                    ) {
                        Icon(imageVector = Icons.Default.Stop, contentDescription = "Interrupt", modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("INTERRUPT SPEAKING")
                    }
                } else {
                    Button(
                        onClick = {
                            if (isListening) {
                                viewModel.stopVoiceListening()
                            } else {
                                val hasAudioPerm = ContextCompat.checkSelfPermission(
                                    context,
                                    Manifest.permission.RECORD_AUDIO
                                ) == PackageManager.PERMISSION_GRANTED
                                if (hasAudioPerm) {
                                    viewModel.startVoiceListening()
                                } else {
                                    micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isListening) AlertCrimson else IceBlue,
                            contentColor = ObsidianBlack
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .height(50.dp)
                            .testTag("voice_hud_mic_btn")
                    ) {
                        Icon(
                            imageVector = if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                            contentDescription = "Microphone",
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isListening) "STOP LISTENING" else "START SPEAKING",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }

            // Quick Speech Commands
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickVoicePill(
                    text = "System Status",
                    modifier = Modifier.weight(1f),
                    onClick = { viewModel.sendMessage("What is our current system status?", isVoice = true) }
                )
                QuickVoicePill(
                    text = "Today's Agenda",
                    modifier = Modifier.weight(1f),
                    onClick = { viewModel.sendMessage("Give me the executive daily schedule briefing", isVoice = true) }
                )
                QuickVoicePill(
                    text = "Stark Lab Lights",
                    modifier = Modifier.weight(1f),
                    onClick = { viewModel.sendMessage("Adjust Stark Lab lights to Ice-Blue", isVoice = true) }
                )
            }
        }
    }
}

@Composable
private fun QuickVoicePill(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clickable(onClick = onClick)
            .background(ObsidianGlass, RoundedCornerShape(10.dp))
            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
            .padding(vertical = 8.dp),
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
