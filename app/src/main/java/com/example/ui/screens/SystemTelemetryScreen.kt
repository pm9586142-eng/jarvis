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
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun SystemTelemetryScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val terminalHistory by viewModel.terminalHistory.collectAsState()

    var terminalInput by remember { mutableStateOf("") }
    var volumeSlider by remember { mutableFloatStateOf(viewModel.systemMonitor.getMediaVolumePercent().toFloat()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "SYSTEM & HARDWARE TELEMETRY",
            subtitle = "HOMER Diagnostic Sentinel",
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
            // Hardware Resource Progress Gauges
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(
                        text = "CORE HARDWARE GAUGES",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )

                    // RAM Progress
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("RAM ALLOCATION", color = MetallicSilver, fontSize = 12.sp)
                            Text("${telemetry.ramUsedMb} MB / ${telemetry.ramTotalMb} MB (${telemetry.ramPercent}%)", color = IceBlue, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        LinearProgressIndicator(
                            progress = { telemetry.ramPercent / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .padding(top = 4.dp),
                            color = IceBlue,
                            trackColor = ObsidianGlassBorder
                        )
                    }

                    // Storage Progress
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("INTERNAL STORAGE", color = MetallicSilver, fontSize = 12.sp)
                            Text("${telemetry.storageUsedGb} GB / ${telemetry.storageTotalGb} GB (${telemetry.storagePercent}%)", color = QuantumGold, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        LinearProgressIndicator(
                            progress = { telemetry.storagePercent / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .padding(top = 4.dp),
                            color = QuantumGold,
                            trackColor = ObsidianGlassBorder
                        )
                    }

                    // Battery Progress
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("BATTERY CELL", color = MetallicSilver, fontSize = 12.sp)
                            Text("${telemetry.batteryLevel}% (${if (telemetry.isCharging) "Charging" else "Discharging"})", color = SentinelEmerald, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        LinearProgressIndicator(
                            progress = { telemetry.batteryLevel / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .padding(top = 4.dp),
                            color = SentinelEmerald,
                            trackColor = ObsidianGlassBorder
                        )
                    }
                }
            }

            // Audio Volume Slider
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("SYSTEM MEDIA VOLUME", color = MetallicSilver, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                        Text("${volumeSlider.toInt()}%", color = IceBlueBright, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                    }
                    Slider(
                        value = volumeSlider,
                        onValueChange = {
                            volumeSlider = it
                            viewModel.systemMonitor.setMediaVolumePercent(it.toInt())
                        },
                        valueRange = 0f..100f,
                        colors = SliderDefaults.colors(
                            thumbColor = IceBlueBright,
                            activeTrackColor = IceBlue,
                            inactiveTrackColor = ObsidianGlassBorder
                        )
                    )
                }
            }

            // Real App Launcher Shortcuts
            Text(
                text = "SYSTEM APPLICATION LAUNCHERS",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AppLauncherButton("Browser", Icons.Default.Language, Modifier.weight(1f)) {
                    viewModel.systemMonitor.launchBrowser()
                }
                AppLauncherButton("Settings", Icons.Default.Settings, Modifier.weight(1f)) {
                    viewModel.systemMonitor.launchSettings()
                }
                AppLauncherButton("Camera", Icons.Default.CameraAlt, Modifier.weight(1f)) {
                    viewModel.systemMonitor.launchCamera()
                }
                AppLauncherButton("Clock", Icons.Default.Alarm, Modifier.weight(1f)) {
                    viewModel.systemMonitor.launchClock()
                }
                AppLauncherButton("Dialer", Icons.Default.Phone, Modifier.weight(1f)) {
                    viewModel.systemMonitor.launchDialer()
                }
            }

            // Interactive Terminal CLI
            Text(
                text = "STARK NEURAL CLI CONSOLE",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .background(ObsidianBlack, RoundedCornerShape(8.dp))
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                            .padding(10.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            terminalHistory.forEach { (cmd, out) ->
                                Text(
                                    text = "> $cmd",
                                    color = IceBlueBright,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = out,
                                    color = MetallicSilverLight,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = terminalInput,
                            onValueChange = { terminalInput = it },
                            placeholder = { Text("Enter command (e.g. sysinfo, ping, diagnostics, clean-cache)...", fontSize = 11.sp, color = MetallicSilverMuted) },
                            modifier = Modifier
                                .weight(1f)
                                .testTag("terminal_input_field"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = IceBlue,
                                unfocusedBorderColor = ObsidianGlassBorder,
                                focusedTextColor = MetallicSilver,
                                unfocusedTextColor = MetallicSilver,
                                focusedContainerColor = ObsidianGlass,
                                unfocusedContainerColor = ObsidianGlass
                            ),
                            shape = RoundedCornerShape(10.dp),
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        IconButton(
                            onClick = {
                                if (terminalInput.isNotBlank()) {
                                    val cmd = terminalInput
                                    terminalInput = ""
                                    viewModel.runTerminal(cmd)
                                }
                            },
                            modifier = Modifier
                                .background(IceBlue, CircleShape)
                                .testTag("terminal_send_btn")
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Execute",
                                tint = ObsidianBlack,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun AppLauncherButton(name: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .clickable(onClick = onClick)
            .background(ObsidianGlass, RoundedCornerShape(10.dp))
            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(imageVector = icon, contentDescription = name, tint = IceBlue, modifier = Modifier.size(20.dp))
            Text(text = name, color = MetallicSilver, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}
