package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.agents.JarvisAgent
import com.example.data.db.ConversationEntity
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericViolet
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.ObsidianSurface
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun AiChatScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val selectedAgent by viewModel.selectedAgent.collectAsState()
    val conversations by viewModel.conversations.collectAsState()
    val isAiThinking by viewModel.isAiThinking.collectAsState()
    val streamingText by viewModel.currentStreamingAiText.collectAsState()
    val isSpeaking by viewModel.voiceManager.isSpeaking.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()

    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.startVoiceListening()
        }
    }

    LaunchedEffect(conversations.size, streamingText) {
        if (conversations.isNotEmpty() || streamingText.isNotEmpty()) {
            listState.animateScrollToItem(
                (conversations.size + if (streamingText.isNotEmpty()) 1 else 0).coerceAtLeast(0)
            )
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        // Top Header
        JarvisHeader(
            title = "NEURAL CHAT",
            subtitle = "${selectedAgent.codename} • ${selectedAgent.designation}",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        // Specialized Agent Tabs
        ScrollableTabRow(
            selectedTabIndex = JarvisAgent.entries.indexOf(selectedAgent),
            containerColor = ObsidianSurface,
            contentColor = IceBlue,
            edgePadding = 12.dp,
            indicator = { tabPositions ->
                val index = JarvisAgent.entries.indexOf(selectedAgent)
                if (index in tabPositions.indices) {
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[index]),
                        color = selectedAgent.accentColor
                    )
                }
            }
        ) {
            JarvisAgent.entries.forEach { agent ->
                Tab(
                    selected = agent == selectedAgent,
                    onClick = { viewModel.selectAgent(agent) },
                    text = {
                        Text(
                            text = agent.codename,
                            color = if (agent == selectedAgent) agent.accentColor else MetallicSilverMuted,
                            fontSize = 12.sp,
                            fontWeight = if (agent == selectedAgent) FontWeight.Bold else FontWeight.Normal,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                )
            }
        }

        // Gemini Connection Notice Banner
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ObsidianGlass)
                .border(1.dp, ObsidianGlassBorder)
                .padding(horizontal = 14.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Info,
                contentDescription = "Notice",
                tint = IceBlue,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (viewModel.aiRepository.hasRealApiKey)
                    "GEMINI 2.5 FLASH STREAMING LINK ACTIVE"
                else
                    "GEMINI READY • Set GEMINI_API_KEY in AI Studio Secrets",
                color = if (viewModel.aiRepository.hasRealApiKey) SentinelEmerald else IceBlueBright,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
            if (conversations.isNotEmpty()) {
                IconButton(
                    onClick = { viewModel.clearChatHistory() },
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Clear History",
                        tint = MetallicSilverMuted,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // Conversation List
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (conversations.isEmpty() && streamingText.isEmpty()) {
                item {
                    EmptyChatGreeting(
                        agent = selectedAgent,
                        onPromptClick = { prompt ->
                            inputText = prompt
                            viewModel.sendMessage(prompt)
                            inputText = ""
                        }
                    )
                }
            }

            items(conversations, key = { it.id }) { msg ->
                ChatBubble(
                    message = msg,
                    onSpeak = { viewModel.voiceManager.speak(msg.text) },
                    isSpeaking = isSpeaking
                )
            }

            // Real-time Streaming Response Item
            if (streamingText.isNotEmpty()) {
                item {
                    StreamingAiBubble(
                        agent = selectedAgent,
                        text = streamingText
                    )
                }
            } else if (isAiThinking) {
                item {
                    AiThinkingIndicator(agent = selectedAgent)
                }
            }
        }

        // Bottom Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ObsidianSurface)
                .border(1.dp, ObsidianGlassBorder)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Voice Input / Mic Button
            IconButton(
                onClick = {
                    if (isSpeaking) {
                        viewModel.stopSpeaking()
                    } else if (isListening) {
                        viewModel.stopVoiceListening()
                    } else {
                        val hasAudioPerm = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED
                        if (hasAudioPerm) {
                            viewModel.startVoiceListening()
                        } else {
                            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    }
                },
                modifier = Modifier
                    .background(
                        if (isListening) AlertCrimson.copy(alpha = 0.25f) else ObsidianGlass,
                        CircleShape
                    )
                    .testTag("chat_mic_button")
            ) {
                Icon(
                    imageVector = if (isSpeaking) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = "Voice",
                    tint = if (isListening) AlertCrimson else if (isSpeaking) QuantumGold else IceBlue
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                modifier = Modifier
                    .weight(1f)
                    .testTag("chat_input_field"),
                placeholder = {
                    Text(
                        text = "Speak to ${selectedAgent.codename}...",
                        color = MetallicSilverMuted,
                        fontSize = 13.sp
                    )
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = IceBlue,
                    unfocusedBorderColor = ObsidianGlassBorder,
                    focusedTextColor = MetallicSilver,
                    unfocusedTextColor = MetallicSilver,
                    cursorColor = IceBlueBright,
                    focusedContainerColor = ObsidianGlass,
                    unfocusedContainerColor = ObsidianGlass
                ),
                shape = RoundedCornerShape(12.dp),
                maxLines = 4
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    if (inputText.isNotBlank()) {
                        val text = inputText
                        inputText = ""
                        viewModel.sendMessage(text)
                    }
                },
                modifier = Modifier
                    .background(IceBlue, CircleShape)
                    .testTag("chat_send_button")
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = ObsidianBlack,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun ChatBubble(
    message: ConversationEntity,
    onSpeak: () -> Unit,
    isSpeaking: Boolean
) {
    val isUser = message.role == "user"
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (isUser) "Sir" else message.agentName,
                color = if (isUser) MetallicSilverMuted else IceBlueBright,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            if (message.isVoice) {
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "[VOICE]",
                    color = SentinelEmerald,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        Box(
            modifier = Modifier
                .clip(
                    RoundedCornerShape(
                        topStart = 14.dp,
                        topEnd = 14.dp,
                        bottomStart = if (isUser) 14.dp else 2.dp,
                        bottomEnd = if (isUser) 2.dp else 14.dp
                    )
                )
                .background(
                    if (isUser) ObsidianGlass.copy(alpha = 0.95f) else AtmosphericViolet.copy(alpha = 0.45f)
                )
                .border(
                    1.dp,
                    if (isUser) ObsidianGlassBorder else IceBlue.copy(alpha = 0.35f),
                    RoundedCornerShape(
                        topStart = 14.dp,
                        topEnd = 14.dp,
                        bottomStart = if (isUser) 14.dp else 2.dp,
                        bottomEnd = if (isUser) 2.dp else 14.dp
                    )
                )
                .padding(12.dp)
        ) {
            Column {
                Text(
                    text = message.text,
                    color = MetallicSilverLight,
                    fontSize = 13.5.sp,
                    lineHeight = 20.sp
                )

                if (!isUser) {
                    Row(
                        modifier = Modifier
                            .align(Alignment.End)
                            .padding(top = 4.dp)
                            .clickable(onClick = onSpeak),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = "Speak Text",
                            tint = IceBlue,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "SPEAK",
                            color = IceBlue,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StreamingAiBubble(agent: JarvisAgent, text: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = agent.codename,
            color = agent.accentColor,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
        )
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomEnd = 14.dp, bottomStart = 2.dp))
                .background(AtmosphericViolet.copy(alpha = 0.55f))
                .border(1.dp, agent.accentColor.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                .padding(12.dp)
        ) {
            Text(
                text = text,
                color = MetallicSilverLight,
                fontSize = 13.5.sp,
                lineHeight = 20.sp
            )
        }
    }
}

@Composable
private fun AiThinkingIndicator(agent: JarvisAgent) {
    Row(
        modifier = Modifier
            .background(ObsidianGlass, RoundedCornerShape(12.dp))
            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(agent.accentColor, CircleShape)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "${agent.codename} neural mesh computing...",
            color = MetallicSilverMuted,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun EmptyChatGreeting(
    agent: JarvisAgent,
    onPromptClick: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = agent.icon,
            contentDescription = agent.codename,
            tint = agent.accentColor,
            modifier = Modifier.size(36.dp)
        )
        Text(
            text = agent.designation,
            color = MetallicSilver,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 8.dp)
        )
        Text(
            text = agent.specialization,
            color = MetallicSilverMuted,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(top = 4.dp)
        )

        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Suggested Directives:",
            color = IceBlueBright,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace
        )

        val prompts = when (agent) {
            JarvisAgent.VERONICA_RESEARCH -> listOf(
                "VERONICA, what is the current weather forecast?",
                "Provide an intelligence briefing on global tech news",
                "Fact check: What are the principles of quantum computing?"
            )
            JarvisAgent.DUM_E_ENGINEER -> listOf(
                "Write an optimized Python script for data pipelines",
                "Show me a Jetpack Compose UI component architecture",
                "Explain the time complexity of A* pathfinding"
            )
            JarvisAgent.FRIDAY_COORDINATOR -> listOf(
                "FRIDAY, give me the morning executive briefing",
                "Add a task: Review Mark 85 thruster telemetry",
                "What is my agenda for today?"
            )
            JarvisAgent.HOMER_DIAGNOSTICS -> listOf(
                "HOMER, run a full system diagnostics check",
                "What is our current RAM and storage allocation?",
                "Check perimeter security and DEFCON status"
            )
            JarvisAgent.JARVIS_PRIME -> listOf(
                "Good day, JARVIS. Report on all available systems.",
                "Tell me an intelligent joke, JARVIS.",
                "Adjust Stark Lab ambient lights and climate."
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            prompts.forEach { p ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onPromptClick(p) }
                        .background(ObsidianGlass, RoundedCornerShape(10.dp))
                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                        .padding(10.dp)
                ) {
                    Text(
                        text = "• $p",
                        color = MetallicSilver,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}
