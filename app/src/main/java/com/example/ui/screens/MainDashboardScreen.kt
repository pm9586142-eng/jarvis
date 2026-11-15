package com.example.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.FolderShared
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.agents.JarvisAgent
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.components.NeuralIntelligenceCanvas
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericViolet
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.IceBlueGlow
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import com.example.ui.theme.SynapticSpark
import java.util.Calendar
import kotlin.math.sin
import kotlin.random.Random

@Composable
fun MainDashboardScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val securityReport by viewModel.securityReport.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val audioLevel by viewModel.voiceManager.audioRmsLevel.collectAsState()

    val currentHour = remember { Calendar.getInstance().get(Calendar.HOUR_OF_DAY) }
    val greeting = remember(currentHour) {
        when (currentHour) {
            in 5..11 -> "Good morning, Sir."
            in 12..16 -> "Good afternoon, Sir."
            else -> "Good evening, Sir."
        }
    }

    // Background cosmic drifting stars
    val stars = remember {
        val rng = Random(88)
        List(60) {
            Triple(rng.nextFloat(), rng.nextFloat(), 0.8f + rng.nextFloat() * 1.8f)
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "cosmic_bg")
    val starTwinkle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28f,
        animationSpec = infiniteRepeatable(
            animation = tween(5000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "twinkle"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        // Multi-Layer Cosmic Background Canvas
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Soft nebular gradient blooms
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        AtmosphericVioletGlow.copy(alpha = 0.18f),
                        AtmosphericViolet.copy(alpha = 0.08f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.8f, h * 0.25f),
                    radius = w * 0.7f
                )
            )

            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        IceBlueGlow.copy(alpha = 0.14f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.2f, h * 0.75f),
                    radius = w * 0.6f
                )
            )

            // Drifting cosmic particles
            for ((idx, s) in stars.withIndex()) {
                val alpha = (0.25f + 0.5f * sin(starTwinkle + idx)).coerceIn(0.1f, 0.85f)
                drawCircle(
                    color = if (idx % 2 == 0) IceBlueBright.copy(alpha = alpha) else SynapticSpark.copy(alpha = alpha),
                    radius = s.third,
                    center = Offset(s.first * w, s.second * h)
                )
            }
        }

        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            JarvisHeader(
                title = "J · A · R · V · I · S",
                subtitle = "Cosmic Intelligence Mesh • 2050",
                telemetry = telemetry,
                currentLanguage = language,
                onLanguageSelected = { viewModel.selectLanguage(it) },
                showBackButton = false,
                onOpenSettings = { viewModel.navigateTo(ScreenDestination.SETTINGS) }
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Central Cosmic Intelligence Entity Card
                NeuralGlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(310.dp),
                    borderColor = IceBlue.copy(alpha = 0.4f)
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        // The New 3D Cosmic Intelligence Entity
                        NeuralIntelligenceCanvas(
                            modifier = Modifier.fillMaxSize(),
                            audioPulse = audioLevel,
                            nodeCount = 52,
                            isInteractive = true
                        )

                        // Cosmic Overlay Typography
                        Column(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(4.dp)
                        ) {
                            Text(
                                text = "Beyond the stars, intelligence awakens.",
                                color = AtmosphericVioletGlow,
                                fontSize = 11.5.sp,
                                fontFamily = FontFamily.Monospace,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                            )
                            Text(
                                text = greeting,
                                color = MetallicSilver,
                                fontSize = 21.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                            Text(
                                text = "Your personal intelligence is ready.",
                                color = IceBlueBright,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        // Voice Mode Action Button
                        Button(
                            onClick = {
                                if (isListening) {
                                    viewModel.stopVoiceListening()
                                } else {
                                    viewModel.navigateTo(ScreenDestination.VOICE_HUD)
                                }
                            },
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .testTag("dashboard_voice_btn"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isListening) AlertCrimson else IceBlue,
                                contentColor = ObsidianBlack
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Mic,
                                contentDescription = "Voice",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isListening) "LISTENING..." else "ACTIVATE VOICE MATRIX",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                }

                // Telemetry Ribbon
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CosmicTelemetryPill(
                        modifier = Modifier.weight(1f),
                        label = "BATTERY",
                        value = "${telemetry.batteryLevel}%",
                        sub = if (telemetry.isCharging) "Charging" else "Optimal",
                        color = SentinelEmerald
                    )
                    CosmicTelemetryPill(
                        modifier = Modifier.weight(1f),
                        label = "RAM",
                        value = "${telemetry.ramPercent}%",
                        sub = "${telemetry.ramUsedMb} MB",
                        color = IceBlue
                    )
                    CosmicTelemetryPill(
                        modifier = Modifier.weight(1f),
                        label = "STORAGE",
                        value = "${telemetry.storagePercent}%",
                        sub = "${telemetry.storageUsedGb} GB",
                        color = QuantumGold
                    )
                    CosmicTelemetryPill(
                        modifier = Modifier.weight(1f),
                        label = "LINK",
                        value = if (telemetry.isConnected) "5G ACTIVE" else "OFFLINE",
                        sub = telemetry.networkType.take(8),
                        color = if (telemetry.isConnected) SentinelEmerald else AlertCrimson
                    )
                }

                // Security & DEFCON Readiness Strip
                NeuralGlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.navigateTo(ScreenDestination.SECURITY) }
                        .testTag("security_strip_card"),
                    borderColor = if (securityReport.defconLevel == 1) AlertCrimson else ObsidianGlassBorder
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(
                                        if (securityReport.defconLevel == 1) AlertCrimson.copy(alpha = 0.2f) else SentinelEmerald.copy(alpha = 0.2f),
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Security,
                                    contentDescription = "Security",
                                    tint = if (securityReport.defconLevel == 1) AlertCrimson else SentinelEmerald,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "STARK DEFENSE MATRIX",
                                    color = MetallicSilver,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = securityReport.threatStatus,
                                    color = if (securityReport.defconLevel == 1) AlertCrimson else IceBlueBright,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }

                        Text(
                            text = "SCORE: ${securityReport.score}/100",
                            color = if (securityReport.score > 80) SentinelEmerald else QuantumGold,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                // Specialized Multi-Agents Directory
                Text(
                    text = "SPECIALIZED NEURAL NODES",
                    color = MetallicSilverMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp,
                    fontFamily = FontFamily.Monospace
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    JarvisAgent.entries.take(5).forEach { agent ->
                        AgentBadge(
                            agent = agent,
                            isSelected = false,
                            onClick = {
                                viewModel.selectAgent(agent)
                                viewModel.navigateTo(ScreenDestination.CHAT)
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Core System Modules
                Text(
                    text = "COSMIC MODULES",
                    color = MetallicSilverMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp,
                    fontFamily = FontFamily.Monospace
                )

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Neural Chat",
                            description = "Real Gemini conversational reasoning",
                            icon = Icons.Default.Chat,
                            accent = IceBlue,
                            tag = "nav_chat_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.CHAT) }
                        )
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Voice Matrix",
                            description = "Acoustic speech visualizer",
                            icon = Icons.Default.Mic,
                            accent = AtmosphericVioletGlow,
                            tag = "nav_voice_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Multi-Agent Hub",
                            description = "Inter-agent task delegation",
                            icon = Icons.Default.AutoAwesome,
                            accent = QuantumGold,
                            tag = "nav_multiagent_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.MULTI_AGENT) }
                        )
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Security Audit",
                            description = "Vulnerability scan & DEFCON",
                            icon = Icons.Default.Security,
                            accent = SentinelEmerald,
                            tag = "nav_security_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.SECURITY) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Telemetry & CLI",
                            description = "Hardware gauges & Stark terminal",
                            icon = Icons.Default.Terminal,
                            accent = IceBlueBright,
                            tag = "nav_telemetry_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.SYSTEM_TELEMETRY) }
                        )
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Plugin Matrix",
                            description = "Trello Kanban, GitHub & Home Asst",
                            icon = Icons.Default.Extension,
                            accent = SynapticSpark,
                            tag = "nav_plugins_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.PLUGINS) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Memory Vault",
                            description = "Persistent SQLite knowledge",
                            icon = Icons.Default.FolderShared,
                            accent = IceBlue,
                            tag = "nav_memory_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.MEMORY_VAULT) }
                        )
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Executive Planner",
                            description = "Schedules, tasks & daily briefings",
                            icon = Icons.Default.Schedule,
                            accent = QuantumGold,
                            tag = "nav_productivity_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.PRODUCTIVITY) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Stark Smart Home",
                            description = "Lab lighting, HVAC & defense",
                            icon = Icons.Default.Home,
                            accent = SentinelEmerald,
                            tag = "nav_smarthome_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.SMART_HOME) }
                        )
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "Vision Scanner",
                            description = "Camera optical telemetry & OCR",
                            icon = Icons.Default.CameraAlt,
                            accent = IceBlueBright,
                            tag = "nav_vision_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.VISION_SCANNER) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CosmicModuleButton(
                            modifier = Modifier.weight(1f),
                            title = "System Settings",
                            description = "Voice, accent, agent & vault",
                            icon = Icons.Default.Settings,
                            accent = MaterialTheme.colorScheme.primary,
                            tag = "nav_settings_btn",
                            onClick = { viewModel.navigateTo(ScreenDestination.SETTINGS) }
                        )
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun CosmicTelemetryPill(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    sub: String,
    color: Color
) {
    Box(
        modifier = modifier
            .background(ObsidianGlass, RoundedCornerShape(12.dp))
            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        Column {
            Text(
                text = label,
                color = MetallicSilverMuted,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Text(
                text = value,
                color = color,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(vertical = 2.dp)
            )
            Text(
                text = sub,
                color = MetallicSilver,
                fontSize = 10.sp,
                maxLines = 1
            )
        }
    }
}

@Composable
private fun AgentBadge(
    agent: JarvisAgent,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .background(
                if (isSelected) agent.accentColor.copy(alpha = 0.18f) else ObsidianGlass,
                RoundedCornerShape(12.dp)
            )
            .border(
                1.dp,
                if (isSelected) agent.accentColor else ObsidianGlassBorder,
                RoundedCornerShape(12.dp)
            )
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = agent.icon,
            contentDescription = agent.codename,
            tint = agent.accentColor,
            modifier = Modifier.size(18.dp)
        )
        Text(
            text = agent.codename,
            color = MetallicSilver,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun CosmicModuleButton(
    modifier: Modifier = Modifier,
    title: String,
    description: String,
    icon: ImageVector,
    accent: Color,
    tag: String,
    onClick: () -> Unit
) {
    NeuralGlassCard(
        modifier = modifier
            .clickable(onClick = onClick)
            .testTag(tag),
        borderColor = ObsidianGlassBorder
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(accent.copy(alpha = 0.16f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = accent,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = title,
                    color = MetallicSilver,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = description,
                    color = MetallicSilverMuted,
                    fontSize = 11.sp,
                    maxLines = 1
                )
            }
        }
    }
}
