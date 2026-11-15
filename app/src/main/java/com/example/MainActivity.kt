package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.components.CinematicOpeningScreen
import com.example.ui.screens.AiChatScreen
import com.example.ui.screens.InsightsScreen
import com.example.ui.screens.MainDashboardScreen
import com.example.ui.screens.MemoryVaultScreen
import com.example.ui.screens.MultiAgentScreen
import com.example.ui.screens.PluginsScreen
import com.example.ui.screens.ProductivityScreen
import com.example.ui.screens.SecurityCenterScreen
import com.example.ui.screens.SettingsScreen
import com.example.ui.screens.SmartHomeScreen
import com.example.ui.screens.SystemTelemetryScreen
import com.example.ui.screens.VisionScannerScreen
import com.example.ui.screens.VoiceHudScreen
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.JarvisTheme
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.SentinelEmerald

class MainActivity : ComponentActivity() {

    private val viewModel: JarvisViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val userPrefs by viewModel.userPreferences.collectAsState()
            JarvisTheme(accentTheme = userPrefs.accentTheme) {
                val currentScreen by viewModel.currentScreen.collectAsState()
                val telemetry by viewModel.telemetry.collectAsState()
                val memoryBanner by viewModel.memorySavedBanner.collectAsState()

                // BackHandler for intuitive sub-screen navigation
                BackHandler(enabled = currentScreen != ScreenDestination.DASHBOARD && currentScreen != ScreenDestination.OPENING) {
                    viewModel.navigateBack()
                }

                Scaffold(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(ObsidianBlack),
                    containerColor = ObsidianBlack
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        Crossfade(
                            targetState = currentScreen,
                            animationSpec = tween(400),
                            label = "screen_crossfade"
                        ) { screen ->
                            when (screen) {
                                ScreenDestination.OPENING -> {
                                    CinematicOpeningScreen(
                                        telemetry = telemetry,
                                        onInitializeJarvis = {
                                            viewModel.voiceManager.speak("Biometric match verified. Welcome back, Sir. All quantum systems are operational.")
                                            viewModel.navigateTo(ScreenDestination.DASHBOARD)
                                        },
                                        onEnterVoiceMode = {
                                            viewModel.navigateTo(ScreenDestination.VOICE_HUD)
                                            viewModel.startVoiceListening()
                                        }
                                    )
                                }
                                ScreenDestination.DASHBOARD -> MainDashboardScreen(viewModel)
                                ScreenDestination.CHAT -> AiChatScreen(viewModel)
                                ScreenDestination.VOICE_HUD -> VoiceHudScreen(viewModel)
                                ScreenDestination.MULTI_AGENT -> MultiAgentScreen(viewModel)
                                ScreenDestination.SECURITY -> SecurityCenterScreen(viewModel)
                                ScreenDestination.SYSTEM_TELEMETRY -> SystemTelemetryScreen(viewModel)
                                ScreenDestination.PLUGINS -> PluginsScreen(viewModel)
                                ScreenDestination.MEMORY_VAULT -> MemoryVaultScreen(viewModel)
                                ScreenDestination.PRODUCTIVITY -> ProductivityScreen(viewModel)
                                ScreenDestination.SMART_HOME -> SmartHomeScreen(viewModel)
                                ScreenDestination.VISION_SCANNER -> VisionScannerScreen(viewModel)
                                ScreenDestination.INSIGHTS -> InsightsScreen(viewModel)
                                ScreenDestination.SETTINGS -> SettingsScreen(viewModel)
                            }
                        }

                        memoryBanner?.let { banner ->
                            Row(
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(horizontal = 16.dp, vertical = 72.dp)
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(ObsidianGlass.copy(alpha = 0.96f))
                                    .border(1.dp, SentinelEmerald.copy(alpha = 0.65f), RoundedCornerShape(14.dp))
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                                    .testTag("memory_saved_toast"),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Psychology,
                                    contentDescription = "Memory saved",
                                    tint = SentinelEmerald,
                                    modifier = Modifier.size(18.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Memory saved (${banner.savedIds.size})",
                                        color = SentinelEmerald,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = banner.summary,
                                        color = MetallicSilverLight,
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                TextButton(
                                    onClick = { viewModel.undoSavedMemories(banner.savedIds) },
                                    modifier = Modifier.testTag("undo_memory_toast_btn")
                                ) {
                                    Text(
                                        text = "UNDO",
                                        color = IceBlueBright,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                IconButton(
                                    onClick = { viewModel.dismissMemoryBanner() },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Dismiss",
                                        tint = MetallicSilverLight,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
