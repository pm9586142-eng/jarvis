package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val JarvisColorScheme = darkColorScheme(
    primary = IceBlue,
    onPrimary = Color(0xFF003248),
    primaryContainer = Color(0xFF004B6E),
    onPrimaryContainer = IceBlueBright,
    secondary = IceBlueGlow,
    onSecondary = Color(0xFF003351),
    secondaryContainer = ObsidianGlass,
    onSecondaryContainer = MetallicSilver,
    tertiary = AtmosphericVioletGlow,
    onTertiary = Color(0xFF280056),
    tertiaryContainer = AtmosphericViolet,
    onTertiaryContainer = SynapticSpark,
    background = ObsidianBlack,
    onBackground = MetallicSilver,
    surface = ObsidianSurface,
    onSurface = MetallicSilver,
    surfaceVariant = ObsidianGlass,
    onSurfaceVariant = MetallicSilverMuted,
    outline = ObsidianGlassBorder,
    outlineVariant = IceBlue,
    error = AlertCrimson,
    onError = Color.White
)

@Composable
fun JarvisTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = JarvisColorScheme,
        typography = Typography,
        content = content
    )
}

// Keep MyApplicationTheme alias if needed
@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) = JarvisTheme(content = content)
