package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.ui.theme.IceBlue
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder

@Composable
fun NeuralGlassCard(
    modifier: Modifier = Modifier,
    borderColor: Color = ObsidianGlassBorder,
    borderWidth: Dp = 1.dp,
    containerColor: Color = ObsidianGlass.copy(alpha = 0.85f),
    shape: RoundedCornerShape = RoundedCornerShape(16.dp),
    content: @Composable BoxScope.() -> Unit
) {
    Surface(
        modifier = modifier,
        shape = shape,
        color = containerColor,
        border = BorderStroke(borderWidth, borderColor)
    ) {
        Box(modifier = Modifier.padding(16.dp)) {
            content()
        }
    }
}
