package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.ui.JarvisViewModel
import com.example.ui.SharedAiState
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericVioletGlow
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

enum class UltronShape(val label: String) {
    SPHERE("Sphere"),
    TORUS("Torus"),
    OCTAHEDRON("Octahedron"),
    DOUBLE_HELIX("Double Helix"),
    GALAXY("Galaxy")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun UltronAssistantScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val tokens = LocalJarvisTokens.current
    val telemetry by viewModel.telemetry.collectAsState()
    val prefs by viewModel.userPreferences.collectAsState()
    val sharedState by viewModel.sharedAiState.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val isSpeaking by viewModel.voiceManager.isSpeaking.collectAsState()
    val isThinking by viewModel.isAiThinking.collectAsState()
    val streamingText by viewModel.currentStreamingAiText.collectAsState()
    val conversations by viewModel.conversations.collectAsState()

    var currentShape by remember { mutableStateOf(UltronShape.SPHERE) }
    var promptDraft by remember { mutableStateOf("") }
    var dragYaw by remember { mutableFloatStateOf(0f) }
    var dragPitch by remember { mutableFloatStateOf(0.28f) }

    val micLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.startVoiceListening()
        else viewModel.markMicPermissionDenied(true)
    }

    // Auto-morph shape when voice or user message names a shape
    val latestUserPrompt = conversations.lastOrNull { it.role == "user" }?.text.orEmpty()
    LaunchedEffect(latestUserPrompt) {
        val low = latestUserPrompt.lowercase()
        when {
            "torus" in low -> currentShape = UltronShape.TORUS
            "helix" in low -> currentShape = UltronShape.DOUBLE_HELIX
            "galaxy" in low -> currentShape = UltronShape.GALAXY
            "octahedron" in low -> currentShape = UltronShape.OCTAHEDRON
            "sphere" in low -> currentShape = UltronShape.SPHERE
        }
    }

    val stateColor = when (sharedState) {
        SharedAiState.LISTENING -> SentinelEmerald
        SharedAiState.THINKING -> QuantumGold
        SharedAiState.SPEAKING -> AtmosphericVioletGlow
        SharedAiState.OFFLINE -> AlertCrimson
        SharedAiState.IDLE -> tokens.accentBright
    }

    val latestReply = streamingText.ifBlank {
        conversations.lastOrNull { it.role != "user" }?.text
            ?: "ULTRON 3D Holographic Matrix online. Select a geometric form or speak/type a query."
    }

    fun sendPrompt() {
        val q = promptDraft.trim()
        if (q.isBlank()) return
        val low = q.lowercase()
        when {
            "torus" in low -> currentShape = UltronShape.TORUS
            "helix" in low -> currentShape = UltronShape.DOUBLE_HELIX
            "galaxy" in low -> currentShape = UltronShape.GALAXY
            "octahedron" in low -> currentShape = UltronShape.OCTAHEDRON
            "sphere" in low -> currentShape = UltronShape.SPHERE
        }
        promptDraft = ""
        viewModel.sendMessage(q, isVoice = true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
    ) {
        JarvisHeader(
            title = "ULTRON 3D HOLOGRAM",
            subtitle = "5-Shape Morphing Neural Core • ${sharedState.name}",
            telemetry = telemetry,
            currentLanguage = prefs.language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Shape Selector Chips
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                UltronShape.entries.forEach { shape ->
                    val selected = currentShape == shape
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .defaultMinSize(minHeight = 48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selected) stateColor.copy(alpha = 0.2f) else tokens.glassBg)
                            .border(1.dp, if (selected) stateColor else tokens.glassBorder, RoundedCornerShape(10.dp))
                            .clickable { currentShape = shape }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                            .testTag("ultron_shape_${shape.name.lowercase()}")
                    ) {
                        Text(
                            text = shape.label,
                            color = if (selected) stateColor else tokens.textMuted,
                            fontSize = 11.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            // Interactive 3D Morphing Canvas
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(260.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFF030714))
                    .border(1.5.dp, stateColor.copy(alpha = 0.45f), RoundedCornerShape(18.dp))
                    .pointerInput(Unit) {
                        detectDragGestures { change, drag ->
                            change.consume()
                            dragYaw += drag.x * 0.012f
                            dragPitch = (dragPitch + drag.y * 0.01f).coerceIn(-1.2f, 1.2f)
                        }
                    }
                    .pointerInput(currentShape) {
                        detectTapGestures {
                            val list = UltronShape.entries
                            currentShape = list[(list.indexOf(currentShape) + 1) % list.size]
                        }
                    }
                    .testTag("ultron_hologram_canvas"),
                contentAlignment = Alignment.Center
            ) {
                UltronMorphCanvas(
                    shape = currentShape,
                    color = stateColor,
                    dragYaw = dragYaw,
                    dragPitch = dragPitch,
                    isActive = isListening || isThinking || isSpeaking
                )
                Text(
                    text = "${currentShape.label.uppercase()} • DRAG TO ROTATE • TAP TO MORPH",
                    color = stateColor.copy(alpha = 0.85f),
                    fontSize = 9.5.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp)
                )
            }

            // Live Neural Response Readout
            NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = stateColor.copy(alpha = 0.45f)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isThinking) "SYNTHESIZING RESPONSE..." else if (isSpeaking) "VOCALIZING OUTPUT..." else "ULTRON HOLOGRAPHIC FEED",
                            color = stateColor,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        if (isSpeaking) {
                            Button(
                                onClick = { viewModel.stopSpeaking() },
                                colors = ButtonDefaults.buttonColors(containerColor = AlertCrimson.copy(alpha = 0.2f), contentColor = AlertCrimson),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.defaultMinSize(minHeight = 40.dp).testTag("ultron_stop_speaking_btn")
                            ) {
                                Icon(Icons.Default.Stop, contentDescription = "Stop Voice", modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("STOP", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
                    Text(
                        text = latestReply,
                        color = tokens.textPrimary,
                        fontSize = 12.5.sp,
                        lineHeight = 18.sp
                    )
                }
            }

            // Voice & Text Input Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = {
                        if (isListening) {
                            viewModel.stopVoiceListening()
                        } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            viewModel.startVoiceListening()
                        } else {
                            micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isListening) SentinelEmerald.copy(alpha = 0.25f) else tokens.glassBg)
                        .border(1.dp, if (isListening) SentinelEmerald else tokens.glassBorder, RoundedCornerShape(12.dp))
                        .testTag("ultron_mic_btn")
                ) {
                    Icon(
                        imageVector = if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = if (isListening) "Stop Listening" else "Speak to Ultron",
                        tint = if (isListening) SentinelEmerald else tokens.accentBright
                    )
                }

                OutlinedTextField(
                    value = promptDraft,
                    onValueChange = { promptDraft = it },
                    placeholder = { Text("Ask ULTRON or say 'torus' / 'galaxy'...", fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = stateColor,
                        unfocusedBorderColor = tokens.glassBorder,
                        focusedTextColor = tokens.textPrimary,
                        unfocusedTextColor = tokens.textPrimary
                    ),
                    modifier = Modifier.weight(1f).testTag("ultron_prompt_input")
                )

                IconButton(
                    onClick = { sendPrompt() },
                    enabled = promptDraft.isNotBlank() && !isThinking,
                    modifier = Modifier
                        .size(52.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(stateColor.copy(alpha = 0.22f))
                        .border(1.dp, stateColor, RoundedCornerShape(12.dp))
                        .testTag("ultron_send_btn")
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send to Ultron", tint = stateColor)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun UltronMorphCanvas(
    shape: UltronShape,
    color: Color,
    dragYaw: Float,
    dragPitch: Float,
    isActive: Boolean
) {
    val transition = rememberInfiniteTransition(label = "ultron_orbit")
    val spin by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2f * PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(if (isActive) 6500 else 12000, easing = LinearEasing), RepeatMode.Restart),
        label = "spin"
    )
    val pulse by transition.animateFloat(
        initialValue = 0.92f,
        targetValue = if (isActive) 1.09f else 1.02f,
        animationSpec = infiniteRepeatable(tween(1500), RepeatMode.Reverse),
        label = "pulse"
    )

    val points = remember(shape) { buildUltronPoints(shape) }

    Canvas(modifier = Modifier.fillMaxSize()) {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val scale = (minOf(size.width, size.height) * 0.34f) * pulse
        val yaw = spin + dragYaw
        val pitch = dragPitch

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(color.copy(alpha = 0.25f), Color.Transparent),
                center = Offset(cx, cy),
                radius = scale * 1.45f
            ),
            radius = scale * 1.45f,
            center = Offset(cx, cy)
        )

        val projected = points.map { (px, py, pz) ->
            val x1 = px * cos(yaw) - pz * sin(yaw)
            val z1 = px * sin(yaw) + pz * cos(yaw)
            val y2 = py * cos(pitch) - z1 * sin(pitch)
            val z2 = py * sin(pitch) + z1 * cos(pitch)
            val persp = 2.4f / (2.4f - z2 * 0.7f)
            Triple(cx + x1 * scale * persp, cy + y2 * scale * persp, z2)
        }

        for (i in projected.indices) {
            val (x1, y1, z1) = projected[i]
            val depthAlpha = ((z1 + 1.2f) / 2.2f).coerceIn(0.25f, 0.95f)
            drawCircle(
                color = color.copy(alpha = depthAlpha),
                radius = if (z1 > 0f) 3.2f else 2.0f,
                center = Offset(x1, y1)
            )
            val nextIdx = (i + 1) % projected.size
            if (shape != UltronShape.GALAXY || i % 3 != 2) {
                val (x2, y2, _) = projected[nextIdx]
                drawLine(
                    color = color.copy(alpha = depthAlpha * 0.38f),
                    start = Offset(x1, y1),
                    end = Offset(x2, y2),
                    strokeWidth = 1.2f
                )
            }
        }
    }
}

private fun buildUltronPoints(shape: UltronShape): List<Triple<Float, Float, Float>> = when (shape) {
    UltronShape.SPHERE -> buildList {
        val rings = 8
        val segs = 14
        for (i in 1 until rings) {
            val phi = PI.toFloat() * i / rings
            for (j in 0 until segs) {
                val theta = (2f * PI.toFloat() * j) / segs
                add(Triple(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta)))
            }
        }
    }
    UltronShape.TORUS -> buildList {
        val major = 18
        val minor = 8
        for (i in 0 until major) {
            val u = (2f * PI.toFloat() * i) / major
            for (j in 0 until minor) {
                val v = (2f * PI.toFloat() * j) / minor
                val r = 0.68f + 0.28f * cos(v)
                add(Triple(r * cos(u), 0.28f * sin(v), r * sin(u)))
            }
        }
    }
    UltronShape.OCTAHEDRON -> buildList {
        val verts = listOf(
            Triple(0f, -1f, 0f), Triple(1f, 0f, 0f), Triple(0f, 0f, 1f),
            Triple(-1f, 0f, 0f), Triple(0f, 0f, -1f), Triple(0f, 1f, 0f)
        )
        val edges = listOf(0 to 1, 0 to 2, 0 to 3, 0 to 4, 5 to 1, 5 to 2, 5 to 3, 5 to 4, 1 to 2, 2 to 3, 3 to 4, 4 to 1)
        edges.forEach { (a, b) ->
            for (step in 0..5) {
                val t = step / 5f
                add(
                    Triple(
                        verts[a].first * (1 - t) + verts[b].first * t,
                        verts[a].second * (1 - t) + verts[b].second * t,
                        verts[a].third * (1 - t) + verts[b].third * t
                    )
                )
            }
        }
    }
    UltronShape.DOUBLE_HELIX -> buildList {
        val steps = 42
        for (i in 0 until steps) {
            val t = (i.toFloat() / steps) * (4f * PI.toFloat())
            val y = (i.toFloat() / steps) * 1.8f - 0.9f
            add(Triple(0.55f * cos(t), y, 0.55f * sin(t)))
            add(Triple(0.55f * cos(t + PI.toFloat()), y, 0.55f * sin(t + PI.toFloat())))
        }
    }
    UltronShape.GALAXY -> buildList {
        val arms = 3
        val perArm = 26
        for (a in 0 until arms) {
            val offset = (2f * PI.toFloat() * a) / arms
            for (i in 1..perArm) {
                val frac = i / perArm.toFloat()
                val angle = offset + frac * 4.2f
                val radius = frac * 1.05f
                val waveY = 0.14f * sin(frac * 6f + a)
                add(Triple(radius * cos(angle), waveY, radius * sin(angle)))
            }
        }
    }
}
