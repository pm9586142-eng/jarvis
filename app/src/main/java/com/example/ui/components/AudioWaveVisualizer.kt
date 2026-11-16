package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlin.math.sin

enum class VisualizerMode {
    STANDBY,
    LISTENING,
    PROCESSING,
    SPEAKING
}

@Composable
fun AudioWaveVisualizer(
    modifier: Modifier = Modifier,
    audioLevel: Float = 0f,
    isActive: Boolean = false,
    mode: VisualizerMode = if (isActive) VisualizerMode.LISTENING else VisualizerMode.STANDBY,
    height: Dp = 48.dp,
    barCount: Int = 28
) {
    val active = isActive || mode != VisualizerMode.STANDBY
    val durationMs = when (mode) {
        VisualizerMode.LISTENING -> 900
        VisualizerMode.SPEAKING -> 1100
        VisualizerMode.PROCESSING -> 1600
        VisualizerMode.STANDBY -> 2400
    }
    val infiniteTransition = rememberInfiniteTransition(label = "audio_wave")
    val animOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28318f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMs, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wave_offset"
    )

    val palette = when (mode) {
        VisualizerMode.LISTENING -> listOf(SentinelEmerald, IceBlueBright, IceBlue)
        VisualizerMode.SPEAKING -> listOf(QuantumGold, IceBlueBright, AtmosphericVioletGlow)
        VisualizerMode.PROCESSING -> listOf(IceBlueBright, AtmosphericVioletGlow, IceBlue)
        VisualizerMode.STANDBY -> listOf(IceBlueBright, IceBlue, AtmosphericVioletGlow)
    }

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
    ) {
        val totalWidth = size.width
        val totalHeight = size.height
        val barWidth = (totalWidth / (barCount * 1.5f))
        val spacing = (totalWidth - (barWidth * barCount)) / (barCount - 1).coerceAtLeast(1)

        for (i in 0 until barCount) {
            val normalizedX = i.toFloat() / barCount
            val wave = sin(normalizedX * 6.5f + animOffset) * 0.5f + 0.5f
            val baseScale = when {
                mode == VisualizerMode.PROCESSING -> 0.25f + wave * 0.35f
                active -> 0.2f + (wave * 0.45f) + (audioLevel * 0.75f)
                else -> 0.08f
            }
            val barHeight = (totalHeight * baseScale).coerceIn(4f, totalHeight)

            val x = i * (barWidth + spacing)
            val y = (totalHeight - barHeight) / 2f

            drawRect(
                brush = Brush.verticalGradient(colors = palette),
                topLeft = Offset(x, y),
                size = Size(barWidth, barHeight)
            )
        }
    }
}
