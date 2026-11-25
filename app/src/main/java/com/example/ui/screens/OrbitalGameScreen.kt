package com.example.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.components.JarvisHeader
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

private enum class OrbitalDifficulty(val label: String, val speedMul: Float, val spawnSec: Float, val targetScore: Int) {
    CADET("CADET", 0.78f, 1.05f, 450),
    VANGUARD("VANGUARD", 1.05f, 0.75f, 800),
    ACE("ACE", 1.38f, 0.52f, 1200)
}

private enum class OrbitalGamePhase { READY, PLAYING, PAUSED, VICTORY, GAME_OVER }

private data class StarNode(var x: Float, var y: Float, var z: Float)
private data class LaserBolt(var x: Float, var y: Float)
private data class EnemyTarget(var x: Float, var y: Float, var speed: Float, var radius: Float, var isDrone: Boolean, var hp: Int)

@Composable
fun OrbitalGameScreen(viewModel: JarvisViewModel) {
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()

    var difficulty by remember { mutableStateOf(OrbitalDifficulty.VANGUARD) }
    var phase by remember { mutableStateOf(OrbitalGamePhase.READY) }
    var shipX by remember { mutableFloatStateOf(0.5f) } // normalized [0.1, 0.9]
    var shield by remember { mutableIntStateOf(100) }
    var score by remember { mutableIntStateOf(0) }
    var combo by remember { mutableIntStateOf(1) }
    var wave by remember { mutableIntStateOf(1) }

    val stars = remember {
        mutableStateListOf<StarNode>().apply {
            repeat(55) {
                add(StarNode(Random.nextFloat() * 2f - 1f, Random.nextFloat() * 2f - 1f, Random.nextFloat().coerceAtLeast(0.08f)))
            }
        }
    }
    val lasers = remember { mutableStateListOf<LaserBolt>() }
    val enemies = remember { mutableStateListOf<EnemyTarget>() }

    fun resetGame(startImmediately: Boolean) {
        shipX = 0.5f
        shield = 100
        score = 0
        combo = 1
        wave = 1
        lasers.clear()
        enemies.clear()
        phase = if (startImmediately) OrbitalGamePhase.PLAYING else OrbitalGamePhase.READY
    }

    LaunchedEffect(phase, difficulty) {
        if (phase != OrbitalGamePhase.PLAYING) return@LaunchedEffect
        var lastNs = 0L
        var fireAccum = 0f
        var spawnAccum = 0f

        while (phase == OrbitalGamePhase.PLAYING) {
            withFrameNanos { frameNs ->
                if (lastNs == 0L) {
                    lastNs = frameNs
                    return@withFrameNanos
                }
                val dt = ((frameNs - lastNs) / 1_000_000_000f).coerceIn(0f, 0.05f)
                lastNs = frameNs

                // Advance 3D starfield
                stars.forEach { s ->
                    s.z -= dt * (0.45f * difficulty.speedMul)
                    if (s.z <= 0.05f) {
                        s.x = Random.nextFloat() * 2f - 1f
                        s.y = Random.nextFloat() * 2f - 1f
                        s.z = 1.0f
                    }
                }

                // Auto-pulse twin plasma lasers
                fireAccum += dt
                if (fireAccum >= 0.22f) {
                    fireAccum = 0f
                    lasers.add(LaserBolt((shipX - 0.025f).coerceIn(0.05f, 0.95f), 0.80f))
                    lasers.add(LaserBolt((shipX + 0.025f).coerceIn(0.05f, 0.95f), 0.80f))
                }

                // Spawn enemy drones & asteroids
                spawnAccum += dt
                val waveRate = (difficulty.spawnSec - (wave - 1) * 0.05f).coerceAtLeast(0.28f)
                if (spawnAccum >= waveRate) {
                    spawnAccum = 0f
                    val isDrone = Random.nextFloat() < 0.42f
                    enemies.add(
                        EnemyTarget(
                            x = 0.08f + Random.nextFloat() * 0.84f,
                            y = -0.04f,
                            speed = (0.24f + wave * 0.03f) * difficulty.speedMul,
                            radius = if (isDrone) 0.038f else 0.046f,
                            isDrone = isDrone,
                            hp = if (isDrone) 2 else 1
                        )
                    )
                }

                // Move lasers
                val laserIter = lasers.listIterator()
                while (laserIter.hasNext()) {
                    val l = laserIter.next()
                    l.y -= dt * 1.15f
                    if (l.y < -0.05f) laserIter.remove()
                }

                // Move enemies & resolve collisions
                val enemyIter = enemies.listIterator()
                while (enemyIter.hasNext()) {
                    val e = enemyIter.next()
                    e.y += dt * e.speed

                    var destroyed = false
                    val hitLaserIter = lasers.listIterator()
                    while (hitLaserIter.hasNext()) {
                        val l = hitLaserIter.next()
                        if (abs(l.x - e.x) < e.radius + 0.022f && abs(l.y - e.y) < e.radius + 0.035f) {
                            hitLaserIter.remove()
                            e.hp -= 1
                            if (e.hp <= 0) {
                                destroyed = true
                                score += (if (e.isDrone) 35 else 20) * combo
                                combo = (combo + 1).coerceAtMost(8)
                                wave = (score / 220) + 1
                                break
                            }
                        }
                    }

                    if (destroyed) {
                        enemyIter.remove()
                        continue
                    }

                    // Player collision at ship altitude y ~ 0.84
                    if (abs(e.y - 0.84f) < e.radius + 0.04f && abs(e.x - shipX) < e.radius + 0.045f) {
                        enemyIter.remove()
                        shield = (shield - 25).coerceAtLeast(0)
                        combo = 1
                        if (shield <= 0) {
                            phase = OrbitalGamePhase.GAME_OVER
                        }
                        continue
                    }

                    if (e.y > 1.06f) {
                        enemyIter.remove()
                        combo = 1
                    }
                }

                if (score >= difficulty.targetScore) {
                    phase = OrbitalGamePhase.VICTORY
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
            .windowInsetsPadding(WindowInsets.navigationBars)
    ) {
        JarvisHeader(
            title = "ORBITAL AEGIS 3D",
            subtitle = "Interactive Starfighter Defense Simulation",
            telemetry = telemetry,
            currentLanguage = prefs.language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        // HUD Telemetry Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("SCORE $score / ${difficulty.targetScore}", color = tokens.accentBright, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                Text("WAVE $wave • COMBO x$combo", color = QuantumGold, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)
            }
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.width(140.dp)) {
                Text("SHIELD $shield%", color = if (shield > 35) SentinelEmerald else AlertCrimson, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                Spacer(modifier = Modifier.height(4.dp))
                LinearProgressIndicator(
                    progress = { (shield / 100f).coerceIn(0f, 1f) },
                    color = if (shield > 35) SentinelEmerald else AlertCrimson,
                    trackColor = tokens.glassBg,
                    modifier = Modifier.fillMaxWidth().height(6.dp)
                )
            }
        }

        // Difficulty Selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OrbitalDifficulty.entries.forEach { diff ->
                val selected = difficulty == diff
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selected) tokens.accent.copy(alpha = 0.2f) else tokens.glassBg)
                        .border(1.dp, if (selected) tokens.accent else tokens.glassBorder, RoundedCornerShape(10.dp))
                        .clickable {
                            difficulty = diff
                            if (phase == OrbitalGamePhase.GAME_OVER || phase == OrbitalGamePhase.VICTORY) {
                                resetGame(startImmediately = false)
                            }
                        }
                        .testTag("orbital_diff_${diff.name.lowercase()}")
                ) {
                    Text(diff.label, color = if (selected) tokens.accentBright else tokens.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Interactive 3D Space Arena Canvas
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF020612))
                .border(1.5.dp, tokens.glassBorder, RoundedCornerShape(16.dp))
                .pointerInput(phase) {
                    detectDragGestures { change, dragAmount ->
                        change.consume()
                        if (phase == OrbitalGamePhase.PLAYING && size.width > 0) {
                            shipX = (shipX + dragAmount.x / size.width.toFloat()).coerceIn(0.08f, 0.92f)
                        }
                    }
                }
                .testTag("orbital_arena_canvas")
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val cx = size.width / 2f
                val cy = size.height * 0.34f

                // Perspective grid horizon lines
                for (i in 1..4) {
                    val yLine = size.height * (0.28f + i * 0.16f)
                    drawLine(
                        color = tokens.accent.copy(alpha = 0.08f),
                        start = Offset(0f, yLine),
                        end = Offset(size.width, yLine),
                        strokeWidth = 1f
                    )
                }

                // 3D Starfield projection
                stars.forEach { s ->
                    val px = cx + (s.x / s.z) * size.width * 0.48f
                    val py = cy + (s.y / s.z) * size.height * 0.45f
                    if (px in 0f..size.width && py in 0f..size.height) {
                        val r = ((1f - s.z) * 3.5f + 1f).coerceIn(1f, 4.5f)
                        drawCircle(
                            color = tokens.accentBright.copy(alpha = (1f - s.z).coerceIn(0.2f, 0.9f)),
                            radius = r,
                            center = Offset(px, py)
                        )
                    }
                }

                // Plasma laser bolts
                lasers.forEach { l ->
                    val lx = l.x * size.width
                    val ly = l.y * size.height
                    drawLine(
                        color = SentinelEmerald,
                        start = Offset(lx, ly),
                        end = Offset(lx, ly - 18f),
                        strokeWidth = 4f
                    )
                }

                // Enemy asteroids & drones
                enemies.forEach { e ->
                    val ex = e.x * size.width
                    val ey = e.y * size.height
                    val er = e.radius * size.width
                    if (e.isDrone) {
                        drawCircle(
                            color = AlertCrimson.copy(alpha = 0.28f),
                            radius = er,
                            center = Offset(ex, ey)
                        )
                        drawCircle(
                            color = AlertCrimson,
                            radius = er,
                            center = Offset(ex, ey),
                            style = Stroke(width = 2.4f)
                        )
                        drawCircle(color = QuantumGold, radius = er * 0.35f, center = Offset(ex, ey))
                    } else {
                        val poly = Path()
                        for (k in 0..6) {
                            val ang = (k / 7f) * (2f * Math.PI.toFloat())
                            val rr = er * (if (k % 2 == 0) 1f else 0.78f)
                            val px = ex + rr * cos(ang)
                            val py = ey + rr * sin(ang)
                            if (k == 0) poly.moveTo(px, py) else poly.lineTo(px, py)
                        }
                        poly.close()
                        drawPath(poly, color = QuantumGold.copy(alpha = 0.25f))
                        drawPath(poly, color = QuantumGold, style = Stroke(width = 2f))
                    }
                }

                // Player Starfighter
                val sx = shipX * size.width
                val sy = size.height * 0.85f
                val shipPath = Path().apply {
                    moveTo(sx, sy - 26f)
                    lineTo(sx - 22f, sy + 18f)
                    lineTo(sx, sy + 8f)
                    lineTo(sx + 22f, sy + 18f)
                    close()
                }
                drawPath(shipPath, color = tokens.accent.copy(alpha = 0.35f))
                drawPath(shipPath, color = tokens.accentBright, style = Stroke(width = 2.5f))
                drawCircle(color = SentinelEmerald, radius = 4f, center = Offset(sx, sy - 4f))
            }

            if (phase != OrbitalGamePhase.PLAYING) {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .background(Color(0xD9050B18), RoundedCornerShape(16.dp))
                        .border(1.dp, tokens.accent.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.SportsEsports, contentDescription = "Orbital Game", tint = tokens.accentBright, modifier = Modifier.size(30.dp))
                    Text(
                        text = when (phase) {
                            OrbitalGamePhase.READY -> "ORBITAL AEGIS READY"
                            OrbitalGamePhase.PAUSED -> "SIMULATION PAUSED"
                            OrbitalGamePhase.VICTORY -> "SECTOR SECURED!"
                            OrbitalGamePhase.GAME_OVER -> "SHIELDS DEPLETED"
                            OrbitalGamePhase.PLAYING -> ""
                        },
                        color = when (phase) {
                            OrbitalGamePhase.VICTORY -> SentinelEmerald
                            OrbitalGamePhase.GAME_OVER -> AlertCrimson
                            else -> Color.White
                        },
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Drag across the starfield to steer. Auto-lasers engage incoming hostiles.",
                        color = Color(0xFFCBD5E1),
                        fontSize = 11.5.sp
                    )
                    Button(
                        onClick = {
                            if (phase == OrbitalGamePhase.PAUSED) phase = OrbitalGamePhase.PLAYING
                            else resetGame(startImmediately = true)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = tokens.accent, contentColor = Color(0xFF020612)),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp).testTag("orbital_start_btn")
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = "Start Mission", modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (phase == OrbitalGamePhase.PAUSED) "RESUME" else if (phase == OrbitalGamePhase.READY) "LAUNCH MISSION" else "PLAY AGAIN",
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }

        // Control Footer
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = {
                    phase = when (phase) {
                        OrbitalGamePhase.PLAYING -> OrbitalGamePhase.PAUSED
                        OrbitalGamePhase.PAUSED -> OrbitalGamePhase.PLAYING
                        else -> OrbitalGamePhase.PLAYING
                    }
                },
                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("orbital_pause_btn"),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(
                    imageVector = if (phase == OrbitalGamePhase.PLAYING) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = "Pause or Play",
                    tint = tokens.accentBright,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(if (phase == OrbitalGamePhase.PLAYING) "PAUSE" else "PLAY", color = tokens.accentBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }

            OutlinedButton(
                onClick = { resetGame(startImmediately = true) },
                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("orbital_restart_btn"),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = "Restart", tint = QuantumGold, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("RESTART", color = QuantumGold, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }

            OutlinedButton(
                onClick = { viewModel.navigateTo(ScreenDestination.MUSIC_STUDIO) },
                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).testTag("orbital_music_btn"),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.LibraryMusic, contentDescription = "Soundtrack", tint = SentinelEmerald, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("AUDIO", color = SentinelEmerald, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }
        }
    }
}
