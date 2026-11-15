package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PointMode
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.IceBlueGlow
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.SentinelEmerald
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Realistic Quantum AI Core:
 * Features multi-axis gyroscopic orbital rings, coronal magnetic energy flares,
 * harmonic particle filaments, and dynamic perspective tilting responsive to touch and voice.
 */
@Composable
fun NeuralIntelligenceCanvas(
    modifier: Modifier = Modifier,
    audioPulse: Float = 0f, // 0.0f to 1.0f from voice RMS
    nodeCount: Int = 48,
    isInteractive: Boolean = true,
    showCoreLabel: Boolean = false
) {
    val infiniteTransition = rememberInfiniteTransition(label = "quantum_core")

    // Multi-speed gyroscopic ring rotations
    val ring1Rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28318f,
        animationSpec = infiniteRepeatable(
            animation = tween(12000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring1_rot"
    )

    val ring2Rotation by infiniteTransition.animateFloat(
        initialValue = 6.28318f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(8000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring2_rot"
    )

    val ring3Rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28318f,
        animationSpec = infiniteRepeatable(
            animation = tween(16000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ring3_rot"
    )

    // Coronal flare breathing pulsation
    val flarePulse by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.18f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "flare_pulse"
    )

    // Touch parallax displacement
    var touchPitch by remember { mutableFloatStateOf(0f) }
    var touchYaw by remember { mutableFloatStateOf(0f) }

    // Seeded quantum particle dust
    val quantumParticles = remember {
        val rng = Random(101)
        List(nodeCount) {
            Triple(
                rng.nextFloat() * 6.28f, // orbital angle
                0.35f + rng.nextFloat() * 0.65f, // radius multiplier
                rng.nextInt(3) // assigned to ring 0, 1, or 2
            )
        }
    }

    Box(
        modifier = modifier
            .then(
                if (isInteractive) {
                    Modifier.pointerInput(Unit) {
                        detectDragGestures(
                            onDrag = { change, dragAmount ->
                                change.consume()
                                touchPitch = (touchPitch + dragAmount.y * 0.006f).coerceIn(-0.6f, 0.6f)
                                touchYaw = (touchYaw + dragAmount.x * 0.006f).coerceIn(-0.8f, 0.8f)
                            },
                            onDragEnd = {
                                touchPitch *= 0.82f
                                touchYaw *= 0.82f
                            }
                        )
                    }
                } else Modifier
            )
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height
            val centerX = width / 2f
            val centerY = height / 2f
            val maxR = minOf(width, height) * 0.44f * (flarePulse + audioPulse * 0.25f)

            // 1. Core Background Magnetic Glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        IceBlueBright.copy(alpha = 0.35f + (audioPulse * 0.3f)),
                        IceBlueGlow.copy(alpha = 0.2f),
                        Color.Transparent
                    ),
                    center = Offset(centerX, centerY),
                    radius = maxR * 1.5f
                ),
                center = Offset(centerX, centerY),
                radius = maxR * 1.5f
            )

            // 2. Gyroscopic Orbital Ring 1 (Outer Segmented Caliper Ring)
            val r1 = maxR * 0.95f
            val r1Height = r1 * (0.45f + touchPitch * 0.3f)
            drawOval(
                brush = Brush.sweepGradient(
                    listOf(
                        IceBlue.copy(alpha = 0.2f),
                        IceBlueBright.copy(alpha = 0.85f),
                        IceBlueGlow.copy(alpha = 0.3f),
                        IceBlue.copy(alpha = 0.2f)
                    ),
                    center = Offset(centerX, centerY)
                ),
                topLeft = Offset(centerX - r1, centerY - r1Height / 2f),
                size = Size(r1 * 2f, r1Height),
                style = Stroke(width = 2.2f)
            )

            // Segmented notches on Ring 1
            for (i in 0 until 12) {
                val ang = (i / 12f) * 6.28318f + ring1Rotation
                val nx = centerX + r1 * cos(ang)
                val ny = centerY + (r1Height / 2f) * sin(ang)
                drawCircle(
                    color = IceBlueBright,
                    radius = 2.5f,
                    center = Offset(nx, ny)
                )
            }

            // 3. Gyroscopic Orbital Ring 2 (Middle Tilted Counter-Rotating Ring)
            val r2 = maxR * 0.72f
            val r2Height = r2 * (0.75f - touchPitch * 0.25f)
            drawOval(
                brush = Brush.sweepGradient(
                    listOf(
                        Color.Transparent,
                        Color.White.copy(alpha = 0.9f),
                        IceBlueBright.copy(alpha = 0.7f),
                        Color.Transparent
                    ),
                    center = Offset(centerX, centerY)
                ),
                topLeft = Offset(centerX - r2, centerY - r2Height / 2f),
                size = Size(r2 * 2f, r2Height),
                style = Stroke(width = 1.8f)
            )

            // 4. Gyroscopic Orbital Ring 3 (Inner Fast Conductor Ring)
            val r3 = maxR * 0.48f
            val r3Height = r3 * (0.85f + touchYaw * 0.2f)
            drawOval(
                color = IceBlueBright.copy(alpha = 0.75f + audioPulse * 0.25f),
                topLeft = Offset(centerX - r3, centerY - r3Height / 2f),
                size = Size(r3 * 2f, r3Height),
                style = Stroke(width = 2.5f)
            )

            // 5. Coronal Flare Beams radiating from the central quantum core
            val flareCount = 12
            for (k in 0 until flareCount) {
                val flareAngle = (k / flareCount.toFloat()) * 6.28318f + ring2Rotation
                val flareLen = (maxR * 0.85f) * (0.75f + 0.35f * sin(flareAngle * 3f + ring1Rotation) + audioPulse * 0.4f)
                val endX = centerX + flareLen * cos(flareAngle)
                val endY = centerY + flareLen * sin(flareAngle) * 0.85f

                drawLine(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.9f + audioPulse * 0.1f),
                            IceBlueBright.copy(alpha = 0.6f + audioPulse * 0.3f),
                            Color.Transparent
                        ),
                        start = Offset(centerX, centerY),
                        end = Offset(endX, endY)
                    ),
                    start = Offset(centerX, centerY),
                    end = Offset(endX, endY),
                    strokeWidth = 2f + audioPulse * 2f,
                    cap = StrokeCap.Round
                )
            }

            // 6. Floating Quantum Particle Nodes orbiting along rings
            val particlePoints = ArrayList<Offset>(quantumParticles.size)
            for (p in quantumParticles) {
                val rotOffset = when (p.third) {
                    0 -> ring1Rotation
                    1 -> ring2Rotation
                    else -> ring3Rotation
                }
                val angle = p.first + rotOffset + touchYaw
                val ringRad = maxR * p.second
                val px = centerX + ringRad * cos(angle)
                val py = centerY + ringRad * sin(angle) * (0.55f + touchPitch * 0.2f)
                particlePoints.add(Offset(px, py))

                drawCircle(
                    color = if (p.third == 0) Color.White else IceBlueBright,
                    radius = (2f + audioPulse * 1.5f),
                    center = Offset(px, py)
                )
            }

            // Synaptic connection strands between adjacent quantum nodes
            for (i in 0 until particlePoints.size - 1 step 2) {
                val pt1 = particlePoints[i]
                val pt2 = particlePoints[i + 1]
                val dx = pt1.x - pt2.x
                val dy = pt1.y - pt2.y
                if ((dx * dx + dy * dy) < (maxR * maxR * 0.25f)) {
                    drawLine(
                        color = IceBlue.copy(alpha = 0.5f + audioPulse * 0.3f),
                        start = pt1,
                        end = pt2,
                        strokeWidth = 1.2f
                    )
                }
            }

            // 7. Central Quantum Singularity Core (Bright Stark Energy Heart)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color.White,
                        IceBlueBright.copy(alpha = 0.95f),
                        IceBlue.copy(alpha = 0.6f),
                        Color.Transparent
                    ),
                    center = Offset(centerX, centerY),
                    radius = (26f + (audioPulse * 28f))
                ),
                center = Offset(centerX, centerY),
                radius = (26f + (audioPulse * 28f))
            )
        }

        if (showCoreLabel) {
            androidx.compose.foundation.layout.Column(
                modifier = androidx.compose.ui.Modifier
                    .align(androidx.compose.ui.Alignment.Center),
                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
            ) {
                androidx.compose.material3.Text(
                    text = "JARVIS",
                    color = Color.White,
                    fontSize = androidx.compose.ui.unit.TextUnit(22f, androidx.compose.ui.unit.TextUnitType.Sp),
                    fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    letterSpacing = androidx.compose.ui.unit.TextUnit(5f, androidx.compose.ui.unit.TextUnitType.Sp)
                )
                androidx.compose.material3.Text(
                    text = "AI CORE",
                    color = IceBlueBright,
                    fontSize = androidx.compose.ui.unit.TextUnit(10f, androidx.compose.ui.unit.TextUnitType.Sp),
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                    letterSpacing = androidx.compose.ui.unit.TextUnit(3f, androidx.compose.ui.unit.TextUnitType.Sp)
                )
            }
        }
    }
}
