package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.example.data.preferences.HudThemePreset
import com.example.data.preferences.JarvisAccentTheme

@Immutable
data class JarvisThemeTokens(
    val preset: HudThemePreset = HudThemePreset.COSMIC_DEFAULT,
    val isLight: Boolean = false,
    val screenBg: Color = HudThemePreset.COSMIC_DEFAULT.bgColor,
    val surfaceBg: Color = HudThemePreset.COSMIC_DEFAULT.surfaceColor,
    val glassBg: Color = HudThemePreset.COSMIC_DEFAULT.glassColor,
    val glassBorder: Color = HudThemePreset.COSMIC_DEFAULT.borderColor,
    val accent: Color = HudThemePreset.COSMIC_DEFAULT.primaryColor,
    val accentBright: Color = HudThemePreset.COSMIC_DEFAULT.brightColor,
    val accentGlow: Color = HudThemePreset.COSMIC_DEFAULT.glowColor,
    val textPrimary: Color = HudThemePreset.COSMIC_DEFAULT.textPrimary,
    val textMuted: Color = HudThemePreset.COSMIC_DEFAULT.textMuted
)

val LocalJarvisAccent = staticCompositionLocalOf { JarvisAccentTheme.CYAN }
val LocalJarvisTokens = staticCompositionLocalOf { JarvisThemeTokens() }

@Composable
fun JarvisTheme(
    accentTheme: JarvisAccentTheme = JarvisAccentTheme.CYAN,
    hudPreset: HudThemePreset = HudThemePreset.COSMIC_DEFAULT,
    content: @Composable () -> Unit
) {
    // Use preset primary/bright/glow unless user customized accent on cosmic default
    val usePresetColors = hudPreset != HudThemePreset.COSMIC_DEFAULT || accentTheme == JarvisAccentTheme.CYAN
    val primaryColor = if (usePresetColors) hudPreset.primaryColor else accentTheme.primary
    val brightColor = if (usePresetColors) hudPreset.brightColor else accentTheme.bright
    val glowColor = if (usePresetColors) hudPreset.glowColor else accentTheme.glow

    val tokens = JarvisThemeTokens(
        preset = hudPreset,
        isLight = hudPreset.isLight,
        screenBg = hudPreset.bgColor,
        surfaceBg = hudPreset.surfaceColor,
        glassBg = hudPreset.glassColor,
        glassBorder = hudPreset.borderColor,
        accent = primaryColor,
        accentBright = brightColor,
        accentGlow = glowColor,
        textPrimary = hudPreset.textPrimary,
        textMuted = hudPreset.textMuted
    )

    val colorScheme = if (hudPreset.isLight) {
        lightColorScheme(
            primary = primaryColor,
            onPrimary = Color.White,
            primaryContainer = Color(0xFFD6E6FA),
            onPrimaryContainer = Color(0xFF003878),
            secondary = glowColor,
            onSecondary = Color.White,
            secondaryContainer = hudPreset.glassColor,
            onSecondaryContainer = hudPreset.textPrimary,
            tertiary = Color(0xFF6D28D9),
            onTertiary = Color.White,
            tertiaryContainer = Color(0xFFEDE9FE),
            onTertiaryContainer = Color(0xFF4C1D95),
            background = hudPreset.bgColor,
            onBackground = hudPreset.textPrimary,
            surface = hudPreset.surfaceColor,
            onSurface = hudPreset.textPrimary,
            surfaceVariant = hudPreset.glassColor,
            onSurfaceVariant = hudPreset.textMuted,
            outline = hudPreset.borderColor,
            outlineVariant = primaryColor.copy(alpha = 0.45f),
            error = AlertCrimson,
            onError = Color.White
        )
    } else {
        darkColorScheme(
            primary = primaryColor,
            onPrimary = Color(0xFF002438),
            primaryContainer = primaryColor.copy(alpha = 0.22f),
            onPrimaryContainer = brightColor,
            secondary = glowColor,
            onSecondary = Color(0xFF002438),
            secondaryContainer = hudPreset.glassColor,
            onSecondaryContainer = hudPreset.textPrimary,
            tertiary = AtmosphericVioletGlow,
            onTertiary = Color(0xFF280056),
            tertiaryContainer = AtmosphericViolet,
            onTertiaryContainer = SynapticSpark,
            background = hudPreset.bgColor,
            onBackground = hudPreset.textPrimary,
            surface = hudPreset.surfaceColor,
            onSurface = hudPreset.textPrimary,
            surfaceVariant = hudPreset.glassColor,
            onSurfaceVariant = hudPreset.textMuted,
            outline = hudPreset.borderColor,
            outlineVariant = primaryColor.copy(alpha = 0.55f),
            error = AlertCrimson,
            onError = Color.White
        )
    }

    CompositionLocalProvider(
        LocalJarvisAccent provides accentTheme,
        LocalJarvisTokens provides tokens
    ) {
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
    hudPreset: HudThemePreset = HudThemePreset.COSMIC_DEFAULT,
    content: @Composable () -> Unit
) = JarvisTheme(accentTheme = accentTheme, hudPreset = hudPreset, content = content)
