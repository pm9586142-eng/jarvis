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
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MusicStudioScreen(viewModel: JarvisViewModel) {
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val tracks by viewModel.generatedTracks.collectAsState()
    val isGenerating by viewModel.isMusicGenerating.collectAsState()
    val musicError by viewModel.musicError.collectAsState()
    val isPlaying by viewModel.isMusicPlaying.collectAsState()

    var promptDraft by remember { mutableStateOf("") }
    var lyricsDraft by remember { mutableStateOf("") }
    var selectedMode by remember { mutableStateOf("Electronic / Synth") }

    val modes = listOf("Electronic / Synth", "Ambient Focus", "Lo-Fi Chill", "Cinematic Score")

    DisposableEffect(Unit) {
        onDispose {
            viewModel.stopMusicTrack()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
    ) {
        JarvisHeader(
            title = "AM MUSIC STUDIO",
            subtitle = "Songwriting, Chords & Lyria Synthesis",
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
            NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = tokens.accent.copy(alpha = 0.45f)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.LibraryMusic, contentDescription = "Music Studio", tint = tokens.accent, modifier = Modifier.size(18.dp))
                        Text("COMPOSE TRACK OR BLUEPRINT", color = tokens.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }

                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        modes.forEach { mode ->
                            val selected = selectedMode == mode
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                                    .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(10.dp))
                                    .clickable { selectedMode = mode }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(mode, color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }

                    OutlinedTextField(
                        value = promptDraft,
                        onValueChange = { promptDraft = it },
                        label = { Text("Mood, tempo, instruments, or theme", fontSize = 12.sp) },
                        placeholder = { Text("Uplifting synthwave orbit theme at 118 BPM", fontSize = 12.sp) },
                        minLines = 2,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = tokens.accent,
                            unfocusedBorderColor = tokens.glassBorder,
                            focusedTextColor = tokens.textPrimary,
                            unfocusedTextColor = tokens.textPrimary
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("music_prompt_input")
                    )

                    OutlinedTextField(
                        value = lyricsDraft,
                        onValueChange = { lyricsDraft = it },
                        label = { Text("Optional lyrics or hook lines", fontSize = 12.sp) },
                        minLines = 2,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = tokens.accent,
                            unfocusedBorderColor = tokens.glassBorder,
                            focusedTextColor = tokens.textPrimary,
                            unfocusedTextColor = tokens.textPrimary
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("music_lyrics_input")
                    )

                    Button(
                        onClick = { viewModel.generateMusic(promptDraft, selectedMode, lyricsDraft) },
                        enabled = promptDraft.isNotBlank() && !isGenerating,
                        colors = ButtonDefaults.buttonColors(containerColor = tokens.accent.copy(alpha = 0.22f), contentColor = tokens.accentBright),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).testTag("music_generate_btn")
                    ) {
                        Icon(Icons.Default.MusicNote, contentDescription = "Compose", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isGenerating) "COMPOSING..." else "GENERATE MUSIC", fontSize = 11.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }

                    Text(
                        text = "Free Tier Guarantee: Uses backend Lyria audio when configured or generates complete BPM, chords, instrumentation & lyrics blueprint at ₹0.",
                        color = tokens.textMuted,
                        fontSize = 10.5.sp
                    )
                }
            }

            if (isGenerating) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = tokens.accent)
                    Text("Arranging harmonic layers...", color = tokens.accentBright, fontSize = 11.5.sp, fontFamily = FontFamily.Monospace)
                }
            }

            musicError?.let { err ->
                Text(
                    text = err,
                    color = QuantumGold,
                    fontSize = 11.5.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(QuantumGold.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                )
            }

            if (tracks.isEmpty() && !isGenerating) {
                NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "No studio tracks yet. Enter a musical prompt above to generate audio or a full arrangement blueprint.",
                        color = tokens.textMuted,
                        fontSize = 12.sp
                    )
                }
            } else {
                tracks.forEach { track ->
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = SentinelEmerald.copy(alpha = 0.35f)) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                                    Text(track.title, color = tokens.textPrimary, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                                    Text("${track.mode} • ${track.sourceLabel}", color = SentinelEmerald, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)
                                }
                                if (track.audioBase64.isNotBlank()) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Button(
                                            onClick = { viewModel.playMusicTrack(track) },
                                            colors = ButtonDefaults.buttonColors(containerColor = SentinelEmerald.copy(alpha = 0.2f), contentColor = SentinelEmerald),
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                        ) {
                                            Icon(Icons.Default.PlayArrow, contentDescription = "Play Track", modifier = Modifier.size(16.dp))
                                            Text("PLAY", fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)
                                        }
                                        if (isPlaying) {
                                            Button(
                                                onClick = { viewModel.stopMusicTrack() },
                                                colors = ButtonDefaults.buttonColors(containerColor = AlertCrimson.copy(alpha = 0.2f), contentColor = AlertCrimson),
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                            ) {
                                                Icon(Icons.Default.Stop, contentDescription = "Stop Track", modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    }
                                }
                            }
                            if (track.lyricsAndChords.isNotBlank()) {
                                Text(track.lyricsAndChords, color = tokens.textPrimary, fontSize = 12.sp, lineHeight = 18.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
