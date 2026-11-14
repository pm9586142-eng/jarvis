package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.SmartDevice
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
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
fun SmartHomeScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val devices by viewModel.smartDevices.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "STARK TOWER AUTOMATION",
            subtitle = "Home & Lab Environmental Protocol",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Automation Routines
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(
                        text = "STARK AUTOMATION SCENES",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                viewModel.sendMessage("Set Stark Lab lighting to optimal 4000K Ice-Blue")
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = IceBlue,
                                contentColor = ObsidianBlack
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).testTag("scene_lab_focus_btn")
                        ) {
                            Text("LAB FOCUS", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = {
                                viewModel.sendMessage("Engage Night Owl protocol across all quarters")
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = ObsidianGlass,
                                contentColor = MetallicSilver
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, ObsidianGlassBorder),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("NIGHT OWL", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Text(
                text = "CONNECTED DEVICES",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            // Devices list
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(devices, key = { it.id }) { dev ->
                    SmartDeviceItem(
                        device = dev,
                        onToggle = { viewModel.toggleSmartDevice(dev.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SmartDeviceItem(device: SmartDevice, onToggle: () -> Unit) {
    val icon = when (device.type) {
        "LIGHT" -> Icons.Default.Lightbulb
        "CLIMATE" -> Icons.Default.AcUnit
        "SECURITY" -> Icons.Default.Security
        else -> Icons.Default.Tv
    }
    val iconTint = if (device.isOn) IceBlueBright else MetallicSilverMuted

    NeuralGlassCard(
        modifier = Modifier.fillMaxWidth(),
        borderColor = if (device.isOn) IceBlue.copy(alpha = 0.35f) else ObsidianGlassBorder
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .background(if (device.isOn) IceBlue.copy(alpha = 0.18f) else ObsidianGlass, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = device.name,
                        tint = iconTint,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = device.name,
                        color = MetallicSilver,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "${device.room} • ${device.value}",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            Switch(
                checked = device.isOn,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = IceBlue,
                    checkedTrackColor = IceBlue.copy(alpha = 0.35f)
                )
            )
        }
    }
}
