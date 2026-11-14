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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.components.CinematicOpeningScreen
import com.example.ui.screens.AiChatScreen
import com.example.ui.screens.MainDashboardScreen
import com.example.ui.screens.MemoryVaultScreen
import com.example.ui.screens.MultiAgentScreen
import com.example.ui.screens.PluginsScreen
import com.example.ui.screens.ProductivityScreen
import com.example.ui.screens.SecurityCenterScreen
import com.example.ui.screens.SmartHomeScreen
import com.example.ui.screens.SystemTelemetryScreen
import com.example.ui.screens.VisionScannerScreen
import com.example.ui.screens.VoiceHudScreen
import com.example.ui.theme.JarvisTheme
import com.example.ui.theme.ObsidianBlack

class MainActivity : ComponentActivity() {

    private val viewModel: JarvisViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            JarvisTheme {
                val currentScreen by viewModel.currentScreen.collectAsState()
                val telemetry by viewModel.telemetry.collectAsState()

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
                                ScreenDestination.SETTINGS -> SecurityCenterScreen(viewModel)
                            }
                        }
                    }
                }
            }
        }
    }
}
