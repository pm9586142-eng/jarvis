package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.system.SystemTelemetry
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.IceBlueGlow
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.SentinelEmerald
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.sin
import kotlin.random.Random

@Composable
fun CinematicOpeningScreen(
    telemetry: SystemTelemetry?,
    onInitializeJarvis: () -> Unit,
    onEnterVoiceMode: () -> Unit
) {
    val currentFormattedDate = remember {
        val sdf = SimpleDateFormat("EEE, MMM d, yyyy • HH:mm", Locale.getDefault())
        sdf.format(Date())
    }

    val stars = remember {
        val rng = Random(42)
        List(80) {
            Triple(rng.nextFloat(), rng.nextFloat(), 0.8f + rng.nextFloat() * 1.6f)
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "hud_scan")
    val scanProgress by infiniteTransition.animateFloat(
        initialValue = -0.2f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(3500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "scan_laser"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        // Holographic HUD Coordinate Canvas & Background Nebula
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Cosmic ambient glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        IceBlueGlow.copy(alpha = 0.22f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.5f, h * 0.35f),
                    radius = w * 0.65f
                ),
                center = Offset(w * 0.5f, h * 0.35f),
                radius = w * 0.65f
            )

            // Fine holographic grid lines
            val step = 64f
            var x = 0f
            while (x < w) {
                drawLine(
                    color = IceBlue.copy(alpha = 0.05f),
                    start = Offset(x, 0f),
                    end = Offset(x, h),
                    strokeWidth = 1f
                )
                x += step
            }

            var y = 0f
            while (y < h) {
                drawLine(
                    color = IceBlue.copy(alpha = 0.05f),
                    start = Offset(0f, y),
                    end = Offset(w, y),
                    strokeWidth = 1f
                )
                y += step
            }

            // Distant starlight points
            for ((idx, s) in stars.withIndex()) {
                val alpha = (0.25f + 0.4f * sin(scanProgress * 6f + idx)).coerceIn(0.15f, 0.85f)
                drawCircle(
                    color = IceBlueBright.copy(alpha = alpha),
                    radius = s.third,
                    center = Offset(s.first * w, s.second * h)
                )
            }

            // High-tech laser sweep line
            val sweepY = h * scanProgress
            drawLine(
                brush = Brush.horizontalGradient(
                    colors = listOf(
                        Color.Transparent,
                        IceBlue.copy(alpha = 0.4f),
                        IceBlueBright.copy(alpha = 0.8f),
                        IceBlue.copy(alpha = 0.4f),
                        Color.Transparent
                    )
                ),
                start = Offset(0f, sweepY),
                end = Offset(w, sweepY),
                strokeWidth = 1.8f
            )
        }

        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val isWide = maxWidth > 650.dp

            if (isWide) {
                // Landscape / Tablet layout: Quantum Core Left, Biometric Scanner Right
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 40.dp, vertical = 24.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Left Column: Quantum Core
                    Box(
                        modifier = Modifier
                            .weight(1.2f)
                            .fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        NeuralIntelligenceCanvas(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp),
                            nodeCount = 56,
                            isInteractive = true
                        )
                    }

                    // Right Column: Telemetry & Biometric Fingerprint Pad
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        RealisticHeaderContent()

                        Spacer(modifier = Modifier.height(28.dp))

                        // Biometric Scanner Pad
                        BiometricFingerprintPad(
                            modifier = Modifier.fillMaxWidth(),
                            onVerified = onInitializeJarvis
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        RealisticActionButtons(
                            onBypass = onInitializeJarvis,
                            onVoiceMode = onEnterVoiceMode
                        )
                    }
                }
            } else {
                // Portrait Compact layout: Upper Quantum Core, Lower Biometric Scanner
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    // Quantum Core Display
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(270.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        NeuralIntelligenceCanvas(
                            modifier = Modifier.fillMaxSize(),
                            nodeCount = 44,
                            isInteractive = true
                        )
                    }

                    RealisticHeaderContent()

                    Spacer(modifier = Modifier.height(20.dp))

                    // Biometric Touch Scanner
                    BiometricFingerprintPad(
                        modifier = Modifier.fillMaxWidth(),
                        onVerified = onInitializeJarvis
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    RealisticActionButtons(
                        onBypass = onInitializeJarvis,
                        onVoiceMode = onEnterVoiceMode
                    )

                    Spacer(modifier = Modifier.height(30.dp))
                }
            }
        }

        // Bottom Telemetry Bar
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(ObsidianBlack.copy(alpha = 0.92f))
                .border(1.dp, ObsidianGlassBorder.copy(alpha = 0.4f))
                .padding(horizontal = 18.dp, vertical = 8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    StarkPill("QUANTUM CORE", "ONLINE", SentinelEmerald)
                    StarkPill("SECURITY", "LEVEL 5", IceBlue)
                    StarkPill("TELEMETRY", "${telemetry?.batteryLevel ?: 88}%", SentinelEmerald)
                }

                Text(
                    text = currentFormattedDate,
                    color = MetallicSilverMuted,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        // Quick Bypass Scan Affordance (Top Right)
        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(18.dp)
                .clickable(onClick = onInitializeJarvis)
                .testTag("bypass_scan_button"),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "BYPASS SCAN",
                color = IceBlueBright,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.width(4.dp))
            Icon(
                imageVector = Icons.Default.SkipNext,
                contentDescription = "Bypass Scan",
                tint = IceBlueBright,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun RealisticHeaderContent() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "STARK INDUSTRIES OS 2050",
            color = IceBlueBright,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 2.sp
        )
        Text(
            text = "J · A · R · V · I · S",
            color = MetallicSilverLight,
            fontSize = 34.sp,
            fontWeight = FontWeight.Light,
            letterSpacing = 6.sp,
            fontFamily = FontFamily.SansSerif,
            modifier = Modifier.padding(vertical = 4.dp)
        )
        Text(
            text = "JUST A RATHER VERY INTELLIGENT SYSTEM",
            color = IceBlue,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp
        )
        Text(
            text = "Quantum Neural Bus • Mark 85 Protocol",
            color = MetallicSilverMuted,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
private fun RealisticActionButtons(
    onBypass: () -> Unit,
    onVoiceMode: () -> Unit
) {
    Column(
        modifier = Modifier.widthIn(max = 420.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Fast Initializer Button
        Button(
            onClick = onBypass,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .testTag("authenticate_system_btn"),
            colors = ButtonDefaults.buttonColors(
                containerColor = IceBlue,
                contentColor = ObsidianBlack
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Fingerprint,
                contentDescription = "Verify",
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "AUTHENTICATE SYSTEM ACCESS",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        // Voice Assistant Access
        OutlinedButton(
            onClick = onVoiceMode,
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp)
                .testTag("enter_voice_mode_btn"),
            border = androidx.compose.foundation.BorderStroke(1.dp, IceBlue.copy(alpha = 0.65f)),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = IceBlueBright
            )
        ) {
            Icon(
                imageVector = Icons.Default.Mic,
                contentDescription = "Voice Matrix",
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "ACTIVATE VOICE MATRIX",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.sp
            )
        }
    }
}

@Composable
private fun StarkPill(label: String, value: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .background(color, CircleShape)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = "$label: $value",
            color = MetallicSilverMuted,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}
