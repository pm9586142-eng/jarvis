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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import kotlin.math.sin

@Composable
fun AudioWaveVisualizer(
    modifier: Modifier = Modifier,
    audioLevel: Float = 0f,
    isActive: Boolean = false,
    height: Dp = 48.dp,
    barCount: Int = 28
) {
    val infiniteTransition = rememberInfiniteTransition(label = "audio_wave")
    val animOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 6.28f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "wave_offset"
    )

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
            val wave = sin(normalizedX * 6f + animOffset) * 0.5f + 0.5f
            val baseScale = if (isActive) (0.2f + (wave * 0.4f) + (audioLevel * 0.8f)) else 0.08f
            val barHeight = (totalHeight * baseScale).coerceIn(4f, totalHeight)

            val x = i * (barWidth + spacing)
            val y = (totalHeight - barHeight) / 2f

            drawRect(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        IceBlueBright,
                        IceBlue,
                        AtmosphericVioletGlow
                    )
                ),
                topLeft = Offset(x, y),
                size = Size(barWidth, barHeight)
            )
        }
    }
}
