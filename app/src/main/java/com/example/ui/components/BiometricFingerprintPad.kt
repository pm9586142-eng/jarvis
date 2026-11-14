package com.example.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.SentinelEmerald
import kotlinx.coroutines.launch

/**
 * Realistic Stark Biometric Fingerprint Pad:
 * Detects touch-and-hold gestures, displays an animated laser sweep across
 * biometric print ridges, tracks calibration progress, and triggers authentication.
 */
@Composable
fun BiometricFingerprintPad(
    modifier: Modifier = Modifier,
    onVerified: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var isHolding by remember { mutableStateOf(false) }
    var isVerified by remember { mutableStateOf(false) }
    val progress = remember { Animatable(0f) }

    // Laser scanning sweep animation while holding
    val infiniteTransition = rememberInfiniteTransition(label = "laser_sweep")
    val laserY by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laser_pos"
    )

    // Touch-and-hold progress controller
    LaunchedEffect(isHolding) {
        if (isHolding && !isVerified) {
            progress.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = 1200, easing = LinearEasing)
            )
            if (progress.value >= 0.99f) {
                isVerified = true
                onVerified()
            }
        } else if (!isVerified) {
            // Reset quickly if released early
            progress.animateTo(
                targetValue = 0f,
                animationSpec = tween(durationMillis = 300, easing = LinearEasing)
            )
        }
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Biometric Scanner Touch Area
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(ObsidianGlass, CircleShape)
                .border(
                    width = 2.dp,
                    color = when {
                        isVerified -> SentinelEmerald
                        isHolding -> IceBlueBright
                        else -> IceBlue.copy(alpha = 0.5f)
                    },
                    shape = CircleShape
                )
                .pointerInput(isVerified) {
                    if (!isVerified) {
                        detectTapGestures(
                            onPress = {
                                isHolding = true
                                tryAwaitRelease()
                                isHolding = false
                            }
                        )
                    }
                }
                .testTag("biometric_scanner_pad"),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(80.dp)) {
                val w = size.width
                val h = size.height
                val center = Offset(w / 2f, h / 2f)

                // 1. Concentric Biometric Fingerprint Ridges
                val ridgeColor = when {
                    isVerified -> SentinelEmerald.copy(alpha = 0.9f)
                    isHolding -> IceBlueBright.copy(alpha = 0.85f)
                    else -> IceBlue.copy(alpha = 0.4f)
                }

                for (r in 1..4) {
                    val radius = r * 8.5f
                    drawArc(
                        color = ridgeColor,
                        startAngle = 140f,
                        sweepAngle = 260f,
                        useCenter = false,
                        topLeft = Offset(center.x - radius, center.y - radius * 1.1f),
                        size = Size(radius * 2f, radius * 2.2f),
                        style = Stroke(width = 2f, cap = StrokeCap.Round)
                    )
                }

                // Center core ridge
                drawArc(
                    color = ridgeColor,
                    startAngle = 180f,
                    sweepAngle = 180f,
                    useCenter = false,
                    topLeft = Offset(center.x - 5f, center.y - 6f),
                    size = Size(10f, 12f),
                    style = Stroke(width = 2f, cap = StrokeCap.Round)
                )

                // 2. Circular Hold Progress Bar (0% to 100%)
                if (progress.value > 0f) {
                    drawArc(
                        brush = Brush.sweepGradient(
                            listOf(
                                IceBlue,
                                IceBlueBright,
                                if (isVerified) SentinelEmerald else IceBlueBright
                            )
                        ),
                        startAngle = -90f,
                        sweepAngle = progress.value * 360f,
                        useCenter = false,
                        topLeft = Offset(2f, 2f),
                        size = Size(w - 4f, h - 4f),
                        style = Stroke(width = 3.5f, cap = StrokeCap.Round)
                    )
                }

                // 3. Animated Laser Beam across fingerprint while holding
                if (isHolding && !isVerified) {
                    val scanLineY = h * laserY
                    drawLine(
                        brush = Brush.horizontalGradient(
                            listOf(
                                Color.Transparent,
                                IceBlueBright.copy(alpha = 0.8f),
                                Color.White,
                                IceBlueBright.copy(alpha = 0.8f),
                                Color.Transparent
                            )
                        ),
                        start = Offset(6f, scanLineY),
                        end = Offset(w - 6f, scanLineY),
                        strokeWidth = 2.5f
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Real-Time Scanner Telemetry Label
        Text(
            text = when {
                isVerified -> "BIOMETRIC MATCH: TONY STARK [LEVEL 5]"
                isHolding -> "QUANTUM CALIBRATION: ${(progress.value * 100).toInt()}%"
                else -> "TOUCH & HOLD SENSOR TO INITIALIZE"
            },
            color = when {
                isVerified -> SentinelEmerald
                isHolding -> IceBlueBright
                else -> MetallicSilverMuted
            },
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp
        )
    }
}
