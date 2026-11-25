package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.ManageSearch
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.preferences.CoreVisualMode
import com.example.data.preferences.DashboardLayoutMode
import com.example.data.preferences.HudThemePreset
import com.example.ui.ScreenDestination
import com.example.ui.SharedAiState
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

data class DockModuleItem(
    val label: String,
    val icon: ImageVector,
    val destination: ScreenDestination,
    val tag: String
)

private val CORE_DOCK_MODULES = listOf(
    DockModuleItem("Chat", Icons.Default.AutoAwesome, ScreenDestination.CHAT, "dock_chat"),
    DockModuleItem("Multi-AI", Icons.Default.Hub, ScreenDestination.MULTI_AI_CENTER, "dock_multi_ai"),
    DockModuleItem("Research", Icons.Default.ManageSearch, ScreenDestination.RESEARCH_STUDIO, "dock_research"),
    DockModuleItem("Ultron 3D", Icons.Default.ViewInAr, ScreenDestination.ULTRON_HOLOGRAM, "dock_ultron"),
    DockModuleItem("Orbital 3D", Icons.Default.SportsEsports, ScreenDestination.ORBITAL_GAME, "dock_orbital"),
    DockModuleItem("Music", Icons.Default.LibraryMusic, ScreenDestination.MUSIC_STUDIO, "dock_music"),
    DockModuleItem("YouTube", Icons.Default.PlayArrow, ScreenDestination.YOUTUBE_MEDIA, "dock_youtube"),
    DockModuleItem("Web Hub", Icons.Default.Public, ScreenDestination.AUTOMATION_HUB, "dock_automation"),
    DockModuleItem("Voice", Icons.Default.Mic, ScreenDestination.VOICE_HUD, "dock_voice"),
    DockModuleItem("Planner", Icons.Default.TaskAlt, ScreenDestination.PRODUCTIVITY, "dock_planner"),
    DockModuleItem("OpenJarvis", Icons.Default.RocketLaunch, ScreenDestination.OPEN_JARVIS, "dock_openjarvis"),
    DockModuleItem("Sync Diag", Icons.Default.CloudSync, ScreenDestination.ECOSYSTEM_DIAGNOSTICS, "dock_diagnostics"),
    DockModuleItem("Security", Icons.Default.Security, ScreenDestination.SECURITY, "dock_security"),
    DockModuleItem("CLI", Icons.Default.Terminal, ScreenDestination.SYSTEM_TELEMETRY, "dock_telemetry"),
    DockModuleItem("Settings", Icons.Default.Settings, ScreenDestination.SETTINGS, "dock_settings")
)

private val REACTOR_SECTORS: List<Pair<String, ScreenDestination>> = listOf(
    "CHAT" to ScreenDestination.CHAT,
    "BRAIN" to ScreenDestination.MULTI_AI_CENTER,
    "RESEARCH" to ScreenDestination.RESEARCH_STUDIO,
    "VOICE" to ScreenDestination.VOICE_HUD,
    "ULTRON" to ScreenDestination.ULTRON_HOLOGRAM,
    "ORBITAL" to ScreenDestination.ORBITAL_GAME,
    "MUSIC" to ScreenDestination.MUSIC_STUDIO,
    "MEDIA" to ScreenDestination.YOUTUBE_MEDIA,
    "WEB" to ScreenDestination.AUTOMATION_HUB,
    "TASKS" to ScreenDestination.PRODUCTIVITY,
    "VAULT" to ScreenDestination.MEMORY_VAULT,
    "SYNC" to ScreenDestination.ECOSYSTEM_DIAGNOSTICS
)

@Composable
fun CockpitTopStrip(
    sharedAiState: SharedAiState,
    layoutMode: DashboardLayoutMode,
    isSyncing: Boolean,
    onNavigate: (ScreenDestination) -> Unit,
    onTriggerStandby: () -> Unit,
    onSyncNow: () -> Unit,
    onToggleClassicLayout: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    val stateColor = when (sharedAiState) {
        SharedAiState.LISTENING -> SentinelEmerald
        SharedAiState.THINKING -> QuantumGold
        SharedAiState.SPEAKING -> AtmosphericVioletGlow
        SharedAiState.OFFLINE -> AlertCrimson
        SharedAiState.IDLE -> tokens.accentBright
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(tokens.surfaceBg.copy(alpha = 0.92f))
            .border(1.dp, tokens.glassBorder, RoundedCornerShape(14.dp))
            .padding(10.dp)
            .testTag("cockpit_top_strip"),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(stateColor, CircleShape)
                )
                Text(
                    text = "AM AI OS • ${sharedAiState.name}",
                    color = stateColor,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }

            // 5-button chamfered action strip: STBY | DIAG | SYNC | CLSC | LOCK
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                CockpitActionPill("STBY", tokens.textMuted, "cockpit_btn_stby", onTriggerStandby)
                CockpitActionPill("DIAG", tokens.accentBright, "cockpit_btn_diag") {
                    onNavigate(ScreenDestination.ECOSYSTEM_DIAGNOSTICS)
                }
                CockpitActionPill(
                    label = if (isSyncing) "..." else "SYNC",
                    tint = SentinelEmerald,
                    tag = "cockpit_btn_sync",
                    onClick = onSyncNow
                )
                CockpitActionPill(
                    label = if (layoutMode == DashboardLayoutMode.CLASSIC) "CSMC" else "CLSC",
                    tint = QuantumGold,
                    tag = "cockpit_btn_clsc",
                    onClick = onToggleClassicLayout
                )
                CockpitActionPill("LOCK", AlertCrimson, "cockpit_btn_lock") {
                    onNavigate(ScreenDestination.OPENING)
                }
            }
        }

        // Scrollable Top Module Dock Ribbon
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            CORE_DOCK_MODULES.forEach { mod ->
                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(tokens.glassBg)
                        .border(1.dp, tokens.glassBorder, RoundedCornerShape(10.dp))
                        .clickable { onNavigate(mod.destination) }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                        .testTag(mod.tag),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    Icon(
                        imageVector = mod.icon,
                        contentDescription = mod.label,
                        tint = tokens.accentBright,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = mod.label,
                        color = tokens.textPrimary,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

@Composable
private fun CockpitActionPill(
    label: String,
    tint: Color,
    tag: String,
    onClick: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    Box(
        modifier = Modifier
            .defaultMinSize(minWidth = 38.dp, minHeight = 32.dp)
            .clip(RoundedCornerShape(7.dp))
            .background(tint.copy(alpha = 0.14f))
            .border(1.dp, tint.copy(alpha = 0.45f), RoundedCornerShape(7.dp))
            .clickable { onClick() }
            .padding(horizontal = 7.dp, vertical = 4.dp)
            .testTag(tag),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = if (tokens.isLight && tint == tokens.textMuted) tokens.textPrimary else tint,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun CosmicHudThemeAndLayoutBar(
    currentPreset: HudThemePreset,
    currentLayout: DashboardLayoutMode,
    currentCoreMode: CoreVisualMode,
    onSelectPreset: (HudThemePreset) -> Unit,
    onSelectLayout: (DashboardLayoutMode) -> Unit,
    onSelectCoreMode: (CoreVisualMode) -> Unit
) {
    val tokens = LocalJarvisTokens.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(tokens.glassBg.copy(alpha = 0.85f), RoundedCornerShape(14.dp))
            .border(1.dp, tokens.glassBorder, RoundedCornerShape(14.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            HudThemePreset.entries.forEach { preset ->
                val selected = preset == currentPreset
                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 36.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(if (selected) tokens.accent.copy(alpha = 0.22f) else tokens.surfaceBg)
                        .border(
                            1.dp,
                            if (selected) tokens.accentBright else tokens.glassBorder,
                            RoundedCornerShape(9.dp)
                        )
                        .clickable { onSelectPreset(preset) }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                        .testTag("hud_theme_${preset.id}"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(preset.primaryColor, CircleShape)
                            .border(1.dp, preset.bgColor, CircleShape)
                    )
                    Text(
                        text = preset.shortLabel,
                        color = if (selected) tokens.accentBright else tokens.textMuted,
                        fontSize = 10.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            DashboardLayoutMode.entries.forEach { mode ->
                val selected = mode == currentLayout
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (selected) tokens.accent.copy(alpha = 0.2f) else Color.Transparent)
                        .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(8.dp))
                        .clickable { onSelectLayout(mode) }
                        .padding(horizontal = 9.dp, vertical = 5.dp)
                        .testTag("layout_mode_${mode.key.lowercase()}")
                ) {
                    Text(
                        text = mode.key,
                        color = if (selected) tokens.accentBright else tokens.textMuted,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            CoreVisualMode.entries.forEach { core ->
                val selected = core == currentCoreMode
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (selected) QuantumGold.copy(alpha = 0.18f) else Color.Transparent)
                        .border(1.dp, if (selected) QuantumGold else tokens.glassBorder, RoundedCornerShape(8.dp))
                        .clickable { onSelectCoreMode(core) }
                        .padding(horizontal = 9.dp, vertical = 5.dp)
                        .testTag("core_visual_${core.key}")
                ) {
                    Text(
                        text = core.label,
                        color = if (selected) QuantumGold else tokens.textMuted,
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
fun HologramSphere3DCanvas(
    sharedAiState: SharedAiState,
    audioPulse: Float,
    modifier: Modifier = Modifier,
    onCoreTap: () -> Unit = {}
) {
    val tokens = LocalJarvisTokens.current
    var dragYaw by remember { mutableFloatStateOf(0f) }
    var dragPitch by remember { mutableFloatStateOf(0.28f) }
    var nowMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(Unit) {
        while (true) {
            nowMillis = System.currentTimeMillis()
            delay(1000L)
        }
    }

    val stateColor = when (sharedAiState) {
        SharedAiState.LISTENING -> SentinelEmerald
        SharedAiState.THINKING -> QuantumGold
        SharedAiState.SPEAKING -> AtmosphericVioletGlow
        SharedAiState.OFFLINE -> AlertCrimson
        SharedAiState.IDLE -> tokens.accentBright
    }

    val speedDuration = when (sharedAiState) {
        SharedAiState.THINKING -> 5500
        SharedAiState.SPEAKING -> 7000
        SharedAiState.LISTENING -> 8500
        else -> 14000
    }

    val infinite = rememberInfiniteTransition(label = "hologram_3d_sphere")
    val autoAngle by infinite.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(speedDuration, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "sphere_spin"
    )
    val pulseScale by infinite.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "sphere_pulse"
    )

    val timeStr = remember(nowMillis) {
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(nowMillis))
    }
    val dateStr = remember(nowMillis) {
        SimpleDateFormat("EEE • dd MMM", Locale.getDefault()).format(Date(nowMillis)).uppercase()
    }

    Box(
        modifier = modifier
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    dragYaw += dragAmount.x * 0.008f
                    dragPitch = (dragPitch + dragAmount.y * 0.006f).coerceIn(-1.1f, 1.1f)
                }
            }
            .pointerInput(Unit) {
                detectTapGestures(onTap = { onCoreTap() })
            }
            .testTag("hologram_3d_sphere"),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val radius = (minOf(size.width, size.height) * 0.39f) *
                (pulseScale + (audioPulse.coerceIn(0f, 1f) * 0.08f))

            // Ambient backdrop glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(stateColor.copy(alpha = 0.22f), stateColor.copy(alpha = 0.05f), Color.Transparent),
                    center = Offset(cx, cy),
                    radius = radius * 1.45f
                )
            )

            // Outer orbital reticle rings
            drawCircle(
                color = stateColor.copy(alpha = 0.35f),
                radius = radius * 1.14f,
                center = Offset(cx, cy),
                style = Stroke(width = 1.6f)
            )
            drawArc(
                color = stateColor.copy(alpha = 0.8f),
                startAngle = Math.toDegrees(autoAngle.toDouble()).toFloat(),
                sweepAngle = 72f,
                useCenter = false,
                topLeft = Offset(cx - radius * 1.2f, cy - radius * 1.2f),
                size = Size(radius * 2.4f, radius * 2.4f),
                style = Stroke(width = 3f, cap = StrokeCap.Round)
            )

            val yaw = autoAngle + dragYaw
            val cosY = cos(yaw)
            val sinY = sin(yaw)
            val cosP = cos(dragPitch)
            val sinP = sin(dragPitch)
            val camDist = radius * 3.1f

            fun project(x: Float, y: Float, z: Float): Pair<Offset, Float> {
                val x1 = x * cosY - z * sinY
                val z1 = x * sinY + z * cosY
                val y2 = y * cosP - z1 * sinP
                val z2 = y * sinP + z1 * cosP
                val depthScale = camDist / (camDist - z2)
                return Offset(cx + x1 * depthScale, cy + y2 * depthScale) to z2
            }

            // Latitude wireframe rings
            val latSteps = listOf(-0.68f, -0.35f, 0f, 0.35f, 0.68f)
            latSteps.forEach { latFrac ->
                val phi = latFrac * (PI.toFloat() / 2f)
                val ringR = radius * cos(phi)
                val ringY = radius * sin(phi)
                val segs = 28
                var prev: Pair<Offset, Float>? = null
                for (i in 0..segs) {
                    val theta = (i.toFloat() / segs) * 2f * PI.toFloat()
                    val curr = project(ringR * cos(theta), ringY, ringR * sin(theta))
                    prev?.let { p ->
                        val frontAlpha = if ((p.second + curr.second) * 0.5f > 0f) 0.55f else 0.16f
                        drawLine(
                            color = stateColor.copy(alpha = frontAlpha),
                            start = p.first,
                            end = curr.first,
                            strokeWidth = if (frontAlpha > 0.4f) 1.5f else 0.9f
                        )
                    }
                    prev = curr
                }
            }

            // Longitude wireframe meridians + luminous geodesic nodes
            val meridians = 8
            for (m in 0 until meridians) {
                val theta = (m.toFloat() / meridians) * PI.toFloat()
                val segs = 24
                var prev: Pair<Offset, Float>? = null
                for (i in 0..segs) {
                    val phi = (i.toFloat() / segs) * 2f * PI.toFloat()
                    val x = radius * cos(phi) * cos(theta)
                    val y = radius * sin(phi)
                    val z = radius * cos(phi) * sin(theta)
                    val curr = project(x, y, z)
                    prev?.let { p ->
                        val frontAlpha = if ((p.second + curr.second) * 0.5f > 0f) 0.50f else 0.14f
                        drawLine(
                            color = stateColor.copy(alpha = frontAlpha),
                            start = p.first,
                            end = curr.first,
                            strokeWidth = if (frontAlpha > 0.4f) 1.4f else 0.8f
                        )
                    }
                    if (i % 4 == 0 && curr.second > 0f) {
                        drawCircle(
                            color = stateColor.copy(alpha = 0.85f),
                            radius = 2.6f,
                            center = curr.first
                        )
                    }
                    prev = curr
                }
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = timeStr,
                color = tokens.textPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = FontFamily.Monospace
            )
            Text(
                text = dateStr,
                color = stateColor,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
            Text(
                text = "STATE: ${sharedAiState.name}",
                color = tokens.textMuted,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}

@Composable
fun AmReactor12SectorCanvas(
    sharedAiState: SharedAiState,
    audioPulse: Float,
    modifier: Modifier = Modifier,
    onSectorSelected: (ScreenDestination, String) -> Unit,
    onCoreTap: () -> Unit
) {
    val tokens = LocalJarvisTokens.current
    val stateColor = when (sharedAiState) {
        SharedAiState.LISTENING -> SentinelEmerald
        SharedAiState.THINKING -> QuantumGold
        SharedAiState.SPEAKING -> AtmosphericVioletGlow
        SharedAiState.OFFLINE -> AlertCrimson
        SharedAiState.IDLE -> tokens.accentBright
    }

    val infinite = rememberInfiniteTransition(label = "arc_reactor")
    val ringRotation by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(18000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "reactor_rot"
    )

    Box(
        modifier = modifier
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val cx = size.width / 2f
                    val cy = size.height / 2f
                    val dx = offset.x - cx
                    val dy = offset.y - cy
                    val dist = hypot(dx, dy)
                    val maxR = minOf(size.width, size.height) * 0.45f
                    if (dist <= maxR * 0.36f) {
                        onCoreTap()
                    } else if (dist <= maxR * 1.1f) {
                        var deg = Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())).toFloat()
                        if (deg < 0f) deg += 360f
                        val idx = ((deg / 30f).toInt()).coerceIn(0, REACTOR_SECTORS.lastIndex)
                        val (label, dest) = REACTOR_SECTORS[idx]
                        onSectorSelected(dest, label)
                    }
                }
            }
            .testTag("arc_reactor_12_sector"),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val outerR = minOf(size.width, size.height) * 0.43f * (1f + audioPulse.coerceIn(0f, 1f) * 0.06f)
            val innerR = outerR * 0.40f

            for (i in 0 until 12) {
                val startAngle = i * 30f + 2.5f
                drawArc(
                    color = stateColor.copy(alpha = if (i % 2 == 0) 0.72f else 0.42f),
                    startAngle = startAngle,
                    sweepAngle = 25f,
                    useCenter = false,
                    topLeft = Offset(cx - outerR, cy - outerR),
                    size = Size(outerR * 2f, outerR * 2f),
                    style = Stroke(width = 16f, cap = StrokeCap.Butt)
                )
            }

            drawArc(
                color = QuantumGold.copy(alpha = 0.78f),
                startAngle = ringRotation,
                sweepAngle = 90f,
                useCenter = false,
                topLeft = Offset(cx - outerR * 0.72f, cy - outerR * 0.72f),
                size = Size(outerR * 1.44f, outerR * 1.44f),
                style = Stroke(width = 4f, cap = StrokeCap.Round)
            )
            drawArc(
                color = stateColor.copy(alpha = 0.78f),
                startAngle = -ringRotation * 1.4f,
                sweepAngle = 110f,
                useCenter = false,
                topLeft = Offset(cx - innerR * 1.25f, cy - innerR * 1.25f),
                size = Size(innerR * 2.5f, innerR * 2.5f),
                style = Stroke(width = 4f, cap = StrokeCap.Round)
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(stateColor.copy(alpha = 0.55f), stateColor.copy(alpha = 0.12f), Color.Transparent),
                    center = Offset(cx, cy),
                    radius = innerR * 1.2f
                )
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "AM CORE",
                color = tokens.textPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = FontFamily.Monospace
            )
            Text(
                text = "12 SECTORS",
                color = stateColor,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
