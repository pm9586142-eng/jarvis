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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.SentinelEmerald

@Composable
fun VisionScannerScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    var isScanning by remember { mutableStateOf(false) }
    var scanResult by remember {
        mutableStateOf(
            """
            [OPTICAL SCANNER TELEMETRY]
            Target: Mark 85 Flight Schematic & Lab Apparatus
            Confidence Score: 99.4%
            Detected Boundaries: [X: 124, Y: 88, W: 640, H: 480]
            OCR Text Extracted: 'STARK INDUSTRIES - CLEAN ENERGY PROTOCOL 2050'
            Integrity Check: PASSED. Zero structural defects.
            """.trimIndent()
        )
    }

    val infiniteTransition = rememberInfiniteTransition(label = "scanner_sweep")
    val sweepPos by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "sweep_line"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "OPTICAL VISION SCANNER",
            subtitle = "Computer Vision & OCR Telemetry",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Scanner Viewport with Reticle
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .background(ObsidianGlass, RoundedCornerShape(16.dp))
                    .border(1.dp, IceBlue.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            ) {
                // High-tech Reticle & Sweep Animation
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val w = size.width
                    val h = size.height

                    // Corner brackets
                    val bracketLen = 32f
                    // Top-Left
                    drawLine(IceBlue, Offset(20f, 20f), Offset(20f + bracketLen, 20f), 2.5f)
                    drawLine(IceBlue, Offset(20f, 20f), Offset(20f, 20f + bracketLen), 2.5f)
                    // Top-Right
                    drawLine(IceBlue, Offset(w - 20f, 20f), Offset(w - 20f - bracketLen, 20f), 2.5f)
                    drawLine(IceBlue, Offset(w - 20f, 20f), Offset(w - 20f, 20f + bracketLen), 2.5f)
                    // Bottom-Left
                    drawLine(IceBlue, Offset(20f, h - 20f), Offset(20f + bracketLen, h - 20f), 2.5f)
                    drawLine(IceBlue, Offset(20f, h - 20f), Offset(20f, h - 20f - bracketLen), 2.5f)
                    // Bottom-Right
                    drawLine(IceBlue, Offset(w - 20f, h - 20f), Offset(w - 20f - bracketLen, h - 20f), 2.5f)
                    drawLine(IceBlue, Offset(w - 20f, h - 20f), Offset(w - 20f, h - 20f - bracketLen), 2.5f)

                    // Target Crosshair
                    val cx = w / 2f
                    val cy = h / 2f
                    drawCircle(IceBlue.copy(alpha = 0.4f), radius = 48f, center = Offset(cx, cy), style = Stroke(1.5f))
                    drawLine(IceBlue.copy(alpha = 0.6f), Offset(cx - 24f, cy), Offset(cx + 24f, cy), 1.5f)
                    drawLine(IceBlue.copy(alpha = 0.6f), Offset(cx, cy - 24f), Offset(cx, cy + 24f), 1.5f)

                    // Moving Laser Scan Line
                    val lineY = h * sweepPos
                    drawLine(
                        brush = Brush.horizontalGradient(
                            listOf(Color.Transparent, IceBlueBright, Color.White, IceBlueBright, Color.Transparent)
                        ),
                        start = Offset(20f, lineY),
                        end = Offset(w - 20f, lineY),
                        strokeWidth = 2.5f
                    )
                }

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(16.dp)
                ) {
                    Text(
                        text = if (hasCameraPermission) "OPTICAL SENSOR: ONLINE" else "OPTICAL SENSOR: STANDBY",
                        color = if (hasCameraPermission) SentinelEmerald else IceBlueBright,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "SPECTRAL RESOLUTION: 4K • TARGET LOCK: ACQUIRED",
                        color = MetallicSilverMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = {
                        if (!hasCameraPermission) {
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        } else {
                            viewModel.systemMonitor.launchCamera()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = IceBlue,
                        contentColor = ObsidianBlack
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).testTag("open_hardware_camera_btn")
                ) {
                    Icon(imageVector = Icons.Default.CameraAlt, contentDescription = "Camera", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("OPEN CAMERA", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = {
                        isScanning = true
                        scanResult = """
                            [DEEP TELEMETRY SCAN COMPLETE]
                            Object Class: Quantum Micro-Controller
                            Identified Text: 'NEURAL CORE MODEL 2050'
                            Hardware State: NOMINAL
                            Recommendation: Ready for telemetry upload to VERONICA.
                        """.trimIndent()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ObsidianGlass,
                        contentColor = MetallicSilver
                    ),
                    border = androidx.compose.foundation.BorderStroke(1.dp, ObsidianGlassBorder),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).testTag("analyze_frame_btn")
                ) {
                    Icon(imageVector = Icons.Default.DocumentScanner, contentDescription = "Analyze", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("ANALYZE TARGET", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Extracted Insights
            Text(
                text = "OPTICAL RECOGNITION INSIGHTS",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = scanResult,
                    color = IceBlueBright,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    lineHeight = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
