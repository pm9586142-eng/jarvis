package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.example.data.preferences.JarvisAccentTheme

val LocalJarvisAccent = staticCompositionLocalOf { JarvisAccentTheme.CYAN }

@Composable
fun JarvisTheme(
    accentTheme: JarvisAccentTheme = JarvisAccentTheme.CYAN,
    content: @Composable () -> Unit
) {
    val colorScheme = darkColorScheme(
        primary = accentTheme.primary,
        onPrimary = Color(0xFF003248),
        primaryContainer = Color(0xFF004B6E),
        onPrimaryContainer = accentTheme.bright,
        secondary = accentTheme.glow,
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
        outlineVariant = accentTheme.primary,
        error = AlertCrimson,
        onError = Color.White
    )

    CompositionLocalProvider(LocalJarvisAccent provides accentTheme) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}

@Composable
fun MyApplicationTheme(
    accentTheme: JarvisAccentTheme = JarvisAccentTheme.CYAN,
    content: @Composable () -> Unit
) = JarvisTheme(accentTheme = accentTheme, content = content)
