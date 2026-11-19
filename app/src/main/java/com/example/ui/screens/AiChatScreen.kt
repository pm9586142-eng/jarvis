package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import coil.compose.AsyncImage
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Summarize
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.agents.JarvisAgent
import com.example.data.db.ChatSessionEntity
import com.example.data.db.ConversationEntity
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.MarkdownText
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun AiChatScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val selectedAgent by viewModel.selectedAgent.collectAsState()
    val customAgents by viewModel.customAgents.collectAsState()
    val selectedCustomAgent by viewModel.selectedCustomAgent.collectAsState()
    val conversations by viewModel.conversations.collectAsState()
    val chatSessions by viewModel.chatSessions.collectAsState()
    val activeSessionId by viewModel.activeSessionId.collectAsState()
    val isAiThinking by viewModel.isAiThinking.collectAsState()
    val streamingText by viewModel.currentStreamingAiText.collectAsState()
    val activeBrainAnalysis by viewModel.activeBrainAnalysis.collectAsState()
    val sessionSummary by viewModel.sessionSummary.collectAsState()
    val isSummarizing by viewModel.isSummarizing.collectAsState()
    val summaryError by viewModel.summaryError.collectAsState()
    val isSpeaking by viewModel.voiceManager.isSpeaking.collectAsState()
    val isSpeechPaused by viewModel.voiceManager.isSpeechPaused.collectAsState()
    val isVoiceMuted by viewModel.voiceManager.isMuted.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val continuousVoiceMode by viewModel.continuousVoiceMode.collectAsState()
    val chatVoiceDraft by viewModel.chatVoiceDraft.collectAsState()
    val voiceErrorMessage by viewModel.voiceErrorMessage.collectAsState()
    val micPermissionDenied by viewModel.micPermissionDenied.collectAsState()
    val pendingAttachment by viewModel.pendingAttachment.collectAsState()
    val attachmentError by viewModel.attachmentError.collectAsState()
    val freeModelPool by viewModel.aiRepository.freeModelPoolStatus.collectAsState()
    val multiProviderStatus by viewModel.aiRepository.multiProviderStatus.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var sessionSearchQuery by remember { mutableStateOf("") }
    var renameTarget by remember { mutableStateOf<ChatSessionEntity?>(null) }
    var renameDraft by remember { mutableStateOf("") }
    var editMessageTarget by remember { mutableStateOf<ConversationEntity?>(null) }
    var editMessageDraft by remember { mutableStateOf("") }
    var attachMenuExpanded by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(chatVoiceDraft) {
        val draft = chatVoiceDraft?.trim()
        if (!draft.isNullOrEmpty()) {
            inputText = if (inputText.isBlank()) draft else "${inputText.trimEnd()} $draft"
            viewModel.consumeChatVoiceDraft()
        }
    }

    val filteredSessions = remember(chatSessions, sessionSearchQuery) {
        val q = sessionSearchQuery.trim()
        if (q.isEmpty()) chatSessions
        else chatSessions.filter {
            it.title.contains(q, ignoreCase = true) || it.agentName.contains(q, ignoreCase = true)
        }
    }

    val activeSession = remember(chatSessions, activeSessionId) {
        chatSessions.find { it.id == activeSessionId }
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.markMicPermissionDenied(false)
            viewModel.startChatDictation()
        } else {
            viewModel.markMicPermissionDenied(true)
        }
    }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) viewModel.attachUri(uri)
    }

    val documentPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) viewModel.attachUri(uri)
    }

    LaunchedEffect(conversations.size, streamingText) {
        if (conversations.isNotEmpty() || streamingText.isNotEmpty()) {
            listState.animateScrollToItem(
                (conversations.size + if (streamingText.isNotEmpty()) 1 else 0).coerceAtLeast(0)
            )
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = ObsidianSurface,
                drawerContentColor = MetallicSilver,
                modifier = Modifier.widthIn(max = 320.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "NEURAL SESSIONS",
                                color = IceBlueBright,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "${chatSessions.size} conversation thread(s)",
                                color = MetallicSilverMuted,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        Button(
                            onClick = {
                                viewModel.createNewChatSession()
                                coroutineScope.launch { drawerState.close() }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = IceBlue,
                                contentColor = ObsidianBlack
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.testTag("drawer_new_chat_button")
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "New chat", modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("New chat", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    OutlinedTextField(
                        value = sessionSearchQuery,
                        onValueChange = { sessionSearchQuery = it },
                        placeholder = {
                            Text("Search sessions...", color = MetallicSilverMuted, fontSize = 12.sp)
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = "Search", tint = IceBlue, modifier = Modifier.size(18.dp))
                        },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("session_search_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder,
                            focusedContainerColor = ObsidianGlass,
                            unfocusedContainerColor = ObsidianGlass
                        ),
                        shape = RoundedCornerShape(10.dp)
                    )

                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredSessions, key = { it.id }) { session ->
                            val isSelected = session.id == activeSessionId
                            val timeLabel = remember(session.updatedAt) {
                                SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()).format(Date(session.updatedAt))
                            }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        if (isSelected) IceBlue.copy(alpha = 0.14f) else ObsidianGlass
                                    )
                                    .border(
                                        1.dp,
                                        if (isSelected) IceBlue else ObsidianGlassBorder,
                                        RoundedCornerShape(12.dp)
                                    )
                                    .clickable {
                                        viewModel.selectChatSession(session.id)
                                        coroutineScope.launch { drawerState.close() }
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                                    .testTag("session_item_${session.id}"),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ChatBubbleOutline,
                                    contentDescription = "Session",
                                    tint = if (isSelected) IceBlueBright else MetallicSilverMuted,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = session.title,
                                        color = if (isSelected) IceBlueBright else MetallicSilver,
                                        fontSize = 13.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = "${session.agentName} • $timeLabel",
                                        color = MetallicSilverMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        renameTarget = session
                                        renameDraft = session.title
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Rename session",
                                        tint = IceBlue,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                IconButton(
                                    onClick = { viewModel.deleteChatSession(session.id) },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Delete,
                                        contentDescription = "Delete session",
                                        tint = AlertCrimson.copy(alpha = 0.85f),
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(ObsidianBlack)
        ) {
            // Top Header
            JarvisHeader(
                title = "NEURAL CHAT",
                subtitle = activeSession?.title ?: "${selectedAgent.codename} • ${selectedAgent.designation}",
                telemetry = telemetry,
                currentLanguage = language,
                onLanguageSelected = { viewModel.selectLanguage(it) },
                showBackButton = true,
                onBack = { viewModel.navigateBack() }
            )

            // Session Action Ribbon (Sessions Drawer + Summarize + New Chat)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianSurface)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(ObsidianGlass)
                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                        .clickable { coroutineScope.launch { drawerState.open() } }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                        .testTag("open_sessions_drawer_btn"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Forum,
                        contentDescription = "Sessions",
                        tint = IceBlue,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Sessions (${chatSessions.size.coerceAtLeast(1)})",
                        color = MetallicSilver,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (conversations.size >= 2) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(AtmosphericViolet.copy(alpha = 0.25f))
                                .border(1.dp, IceBlue.copy(alpha = 0.45f), RoundedCornerShape(8.dp))
                                .clickable(enabled = !isSummarizing && !isAiThinking) {
                                    viewModel.summarizeActiveSession()
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                                .testTag("summarize_chat_btn"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Summarize,
                                contentDescription = "Summarize conversation",
                                tint = IceBlueBright,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (isSummarizing) "Summarizing..." else "Summarize",
                                color = IceBlueBright,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(IceBlue.copy(alpha = 0.16f))
                            .border(1.dp, IceBlue.copy(alpha = 0.55f), RoundedCornerShape(8.dp))
                            .clickable { viewModel.createNewChatSession() }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                            .testTag("new_chat_button"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "New chat",
                            tint = IceBlueBright,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "New chat",
                            color = IceBlueBright,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Specialized + Custom Agent Tabs
            val activeBuiltInIndex = if (selectedCustomAgent == null) {
                JarvisAgent.entries.indexOf(selectedAgent)
            } else {
                val cIdx = customAgents.indexOfFirst { it.id == selectedCustomAgent?.id }
                if (cIdx >= 0) JarvisAgent.entries.size + cIdx else 0
            }
            ScrollableTabRow(
                selectedTabIndex = activeBuiltInIndex,
                containerColor = ObsidianSurface,
                contentColor = IceBlue,
                edgePadding = 12.dp,
                indicator = { tabPositions ->
                    if (activeBuiltInIndex in tabPositions.indices) {
                        val indicatorColor = selectedCustomAgent?.let { Color(it.colorHex) }
                            ?: selectedAgent.accentColor
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(tabPositions[activeBuiltInIndex]),
                            color = indicatorColor
                        )
                    }
                }
            ) {
                JarvisAgent.entries.forEach { agent ->
                    val isSelected = selectedCustomAgent == null && agent == selectedAgent
                    Tab(
                        selected = isSelected,
                        onClick = { viewModel.selectAgent(agent) },
                        text = {
                            Text(
                                text = agent.codename,
                                color = if (isSelected) agent.accentColor else MetallicSilverMuted,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    )
                }
                customAgents.forEach { custom ->
                    val isSelected = selectedCustomAgent?.id == custom.id
                    val accent = Color(custom.colorHex)
                    Tab(
                        selected = isSelected,
                        onClick = { viewModel.selectCustomAgent(custom) },
                        text = {
                            Text(
                                text = custom.codename,
                                color = if (isSelected) accent else MetallicSilverMuted,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    )
                }
            }

            // Gemini Connection & Brain Status Notice Banner
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianGlass)
                    .border(1.dp, ObsidianGlassBorder)
                    .padding(horizontal = 14.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Psychology,
                    contentDescription = "Brain Status",
                    tint = IceBlue,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    val activeProviderUpper = multiProviderStatus.activeProviderLabel.uppercase()
                    val activeModelUpper = multiProviderStatus.activeModel.uppercase()
                    val bannerText = when {
                        !viewModel.aiRepository.hasRealApiKey ->
                            "FREE AI READY • Set GEMINI/GROQ/OPENROUTER key or BACKEND_URL in Secrets"
                        !viewModel.aiRepository.usesBackendProxy && multiProviderStatus.allProvidersExhausted ->
                            "ALL FREE PROVIDERS EXHAUSTED • WAIT ~${multiProviderStatus.shortestCooldownSeconds}S (₹0 GUARD)"
                        multiProviderStatus.switchedFromProvider != null ->
                            "FREE SWITCH: $activeProviderUpper • $activeModelUpper (₹0)"
                        multiProviderStatus.fallbackUsed ->
                            "FREE FALLBACK: $activeProviderUpper • $activeModelUpper (₹0)"
                        viewModel.aiRepository.usesBackendProxy ->
                            "BACKEND SSE: $activeProviderUpper • $activeModelUpper (₹0)"
                        else ->
                            "$activeProviderUpper • $activeModelUpper • ₹0 GUARD"
                    }
                    val bannerColor = when {
                        !viewModel.aiRepository.hasRealApiKey -> IceBlueBright
                        !viewModel.aiRepository.usesBackendProxy && multiProviderStatus.allProvidersExhausted -> AlertCrimson
                        multiProviderStatus.fallbackUsed || multiProviderStatus.switchedFromProvider != null -> QuantumGold
                        else -> SentinelEmerald
                    }
                    Text(
                        text = bannerText,
                        color = bannerColor,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.testTag("chat_model_status_banner")
                    )
                    activeBrainAnalysis?.let { meta ->
                        Text(
                            text = "INTENT: ${meta.intent.label.uppercase()} • LANG: ${meta.detectedLanguage.label.uppercase()}",
                            color = MetallicSilverMuted,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
                if (conversations.isNotEmpty()) {
                    IconButton(
                        onClick = { viewModel.clearChatHistory() },
                        modifier = Modifier.size(28.dp)
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

            if (sessionSummary != null || summaryError != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AtmosphericViolet.copy(alpha = 0.25f))
                        .border(1.dp, IceBlue.copy(alpha = 0.45f))
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                        .testTag("chat_summary_card"),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (summaryError != null) "SUMMARY NOTICE" else "NEURAL CONVERSATION SUMMARY",
                            color = if (summaryError != null) AlertCrimson else IceBlueBright,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(
                            onClick = { viewModel.clearSessionSummary() },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Close summary", tint = MetallicSilverMuted, modifier = Modifier.size(14.dp))
                        }
                    }
                    Text(
                        text = summaryError ?: sessionSummary.orEmpty(),
                        color = MetallicSilverLight,
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                }
            }

            if (continuousVoiceMode || voiceErrorMessage != null || micPermissionDenied) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (voiceErrorMessage != null || micPermissionDenied) AlertCrimson.copy(alpha = 0.16f)
                            else SentinelEmerald.copy(alpha = 0.14f)
                        )
                        .border(
                            1.dp,
                            if (voiceErrorMessage != null || micPermissionDenied) AlertCrimson.copy(alpha = 0.55f)
                            else SentinelEmerald.copy(alpha = 0.5f)
                        )
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = voiceErrorMessage
                            ?: if (micPermissionDenied) "Microphone permission denied."
                            else "Hands-free voice loop active",
                        color = MetallicSilverLight,
                        fontSize = 11.sp,
                        modifier = Modifier.weight(1f)
                    )
                    if (micPermissionDenied) {
                        TextButton(
                            onClick = {
                                val intent = Intent(
                                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                    Uri.fromParts("package", context.packageName, null)
                                ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                                context.startActivity(intent)
                            }
                        ) {
                            Text("App Settings", color = IceBlueBright, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (continuousVoiceMode) {
                        TextButton(onClick = { viewModel.exitContinuousVoiceMode() }) {
                            Text("Exit Hands-Free", color = AlertCrimson, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    } else if (voiceErrorMessage != null) {
                        TextButton(onClick = { viewModel.clearVoiceError() }) {
                            Text("Dismiss", color = MetallicSilverMuted, fontSize = 11.sp)
                        }
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

                val lastMsgId = conversations.lastOrNull()?.id
                items(conversations, key = { it.id }) { msg ->
                    val isLastAiReply = msg.id == lastMsgId && msg.role != "user"
                    ChatBubble(
                        message = msg,
                        isSpeaking = isSpeaking,
                        isLastAiReply = isLastAiReply,
                        canMutate = !isAiThinking,
                        onSpeak = { viewModel.voiceManager.speak(msg.text) },
                        onStopSpeaking = { viewModel.stopSpeaking() },
                        onRegenerate = { viewModel.regenerateLastResponse() },
                        onEditAndResend = {
                            editMessageTarget = msg
                            editMessageDraft = msg.text
                        }
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

            if (isAiThinking || streamingText.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ObsidianSurface.copy(alpha = 0.9f))
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.Center
                ) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(AlertCrimson.copy(alpha = 0.2f))
                            .border(1.dp, AlertCrimson.copy(alpha = 0.7f), RoundedCornerShape(10.dp))
                            .clickable { viewModel.stopGenerating() }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                            .testTag("stop_generating_button"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = "Stop generating",
                            tint = AlertCrimson,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Stop generating",
                            color = MetallicSilverLight,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            attachmentError?.let { errMsg ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AlertCrimson.copy(alpha = 0.16f))
                        .border(1.dp, AlertCrimson.copy(alpha = 0.55f))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = errMsg,
                        color = AlertCrimson,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { viewModel.clearAttachmentError() }) {
                        Text("OK", color = MetallicSilver, fontSize = 11.sp)
                    }
                }
            }

            pendingAttachment?.let { att ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ObsidianGlass)
                        .border(1.dp, IceBlue.copy(alpha = 0.45f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (att.mimeType.startsWith("image/")) {
                        AsyncImage(
                            model = Uri.parse(att.uriString),
                            contentDescription = att.name,
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, IceBlue.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Description,
                            contentDescription = att.name,
                            tint = IceBlueBright,
                            modifier = Modifier.size(26.dp)
                        )
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = att.name,
                            color = MetallicSilver,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${att.mimeType} • ${(att.sizeBytes / 1024L).coerceAtLeast(1)} KB",
                            color = MetallicSilverMuted,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    if (att.textContent != null) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (att.useAsTextContext) SentinelEmerald.copy(alpha = 0.2f)
                                    else ObsidianSurface
                                )
                                .border(
                                    1.dp,
                                    if (att.useAsTextContext) SentinelEmerald else ObsidianGlassBorder,
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable { viewModel.toggleAttachmentTextContext() }
                                .padding(horizontal = 8.dp, vertical = 5.dp)
                                .testTag("toggle_text_context_btn")
                        ) {
                            Text(
                                text = if (att.useAsTextContext) "Context ON" else "Context OFF",
                                color = if (att.useAsTextContext) SentinelEmerald else MetallicSilverMuted,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    IconButton(
                        onClick = { viewModel.clearPendingAttachment() },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Remove attachment", tint = AlertCrimson, modifier = Modifier.size(16.dp))
                    }
                }
            }

            if (isSpeaking || isSpeechPaused) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(QuantumGold.copy(alpha = 0.14f))
                        .border(1.dp, QuantumGold.copy(alpha = 0.45f))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                        .testTag("chat_tts_control_bar"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = if (isSpeechPaused) "VOICE PAUSED" else "JARVIS SPEAKING",
                        color = QuantumGold,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = {
                            if (isSpeechPaused) viewModel.resumeSpeaking() else viewModel.pauseSpeaking()
                        },
                        modifier = Modifier.size(32.dp).testTag("chat_tts_pause_resume_btn")
                    ) {
                        Icon(
                            imageVector = if (isSpeechPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                            contentDescription = if (isSpeechPaused) "Resume voice" else "Pause voice",
                            tint = QuantumGold,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    IconButton(
                        onClick = { viewModel.stopSpeaking() },
                        modifier = Modifier.size(32.dp).testTag("chat_tts_stop_btn")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = "Stop speaking",
                            tint = AlertCrimson,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    IconButton(
                        onClick = { viewModel.toggleVoiceMuted() },
                        modifier = Modifier.size(32.dp).testTag("chat_tts_mute_btn")
                    ) {
                        Icon(
                            imageVector = if (isVoiceMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = if (isVoiceMuted) "Unmute voice" else "Mute voice",
                            tint = if (isVoiceMuted) AlertCrimson else IceBlueBright,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Bottom Input Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianSurface)
                    .border(1.dp, ObsidianGlassBorder)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box {
                    IconButton(
                        onClick = { attachMenuExpanded = true },
                        modifier = Modifier
                            .background(
                                if (pendingAttachment != null) IceBlue.copy(alpha = 0.24f) else ObsidianGlass,
                                CircleShape
                            )
                            .testTag("chat_attach_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.AttachFile,
                            contentDescription = "Attach file",
                            tint = IceBlueBright
                        )
                    }

                    DropdownMenu(
                        expanded = attachMenuExpanded,
                        onDismissRequest = { attachMenuExpanded = false },
                        containerColor = ObsidianGlass
                    ) {
                        DropdownMenuItem(
                            text = { Text("Attach Image (Photo Picker)", color = MetallicSilver, fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Image, contentDescription = null, tint = IceBlue) },
                            onClick = {
                                attachMenuExpanded = false
                                photoPickerLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Attach PDF or Text Document", color = MetallicSilver, fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Description, contentDescription = null, tint = QuantumGold) },
                            onClick = {
                                attachMenuExpanded = false
                                documentPickerLauncher.launch(arrayOf("application/pdf", "text/*", "application/json"))
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.width(6.dp))

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
                                viewModel.startChatDictation()
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
                        imageVector = if (isSpeaking || isListening) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = if (isListening) "Stop voice input" else "Dictate voice input",
                        tint = if (isListening) AlertCrimson else if (isSpeaking) QuantumGold else IceBlue
                    )
                }

                Spacer(modifier = Modifier.width(6.dp))

                OutlinedTextField(
                    value = inputText,
                    onValueChange = { if (it.length <= 8000) inputText = it },
                    modifier = Modifier
                        .weight(1f)
                        .testTag("chat_input_field"),
                    placeholder = {
                        Text(
                            text = when {
                                isListening -> "Listening... speak now"
                                pendingAttachment != null -> "Ask about ${pendingAttachment!!.name}..."
                                else -> "Ask ${selectedAgent.codename} (EN / HI / Hinglish)..."
                            },
                            color = if (isListening) SentinelEmerald else MetallicSilverMuted,
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    },
                    supportingText = if (inputText.length > 500) {
                        {
                            Text(
                                text = "${inputText.length}/8000",
                                color = if (inputText.length > 7600) AlertCrimson else MetallicSilverMuted,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    } else null,
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

                Spacer(modifier = Modifier.width(6.dp))

                if (isAiThinking || streamingText.isNotEmpty()) {
                    IconButton(
                        onClick = { viewModel.stopGenerating() },
                        modifier = Modifier
                            .background(AlertCrimson, CircleShape)
                            .testTag("chat_stop_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Stop,
                            contentDescription = "Stop generating",
                            tint = ObsidianBlack,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else {
                    IconButton(
                        onClick = {
                            if (inputText.isNotBlank() || pendingAttachment != null) {
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
    }

    renameTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            containerColor = ObsidianGlass,
            title = { Text("Rename Neural Session", color = MetallicSilver) },
            text = {
                OutlinedTextField(
                    value = renameDraft,
                    onValueChange = { renameDraft = it },
                    singleLine = true,
                    label = { Text("Session Title", color = MetallicSilverMuted) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MetallicSilver,
                        unfocusedTextColor = MetallicSilver,
                        focusedBorderColor = IceBlue,
                        unfocusedBorderColor = ObsidianGlassBorder
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.renameChatSession(target.id, renameDraft)
                        renameTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IceBlue, contentColor = ObsidianBlack)
                ) {
                    Text("SAVE")
                }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            }
        )
    }

    editMessageTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { editMessageTarget = null },
            containerColor = ObsidianGlass,
            title = { Text("Edit & Resend Prompt", color = IceBlueBright) },
            text = {
                OutlinedTextField(
                    value = editMessageDraft,
                    onValueChange = { editMessageDraft = it },
                    minLines = 3,
                    maxLines = 6,
                    label = { Text("Directive", color = MetallicSilverMuted) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("edit_message_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MetallicSilver,
                        unfocusedTextColor = MetallicSilver,
                        focusedBorderColor = IceBlue,
                        unfocusedBorderColor = ObsidianGlassBorder
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.editAndResendMessage(target, editMessageDraft)
                        editMessageTarget = null
                    },
                    enabled = editMessageDraft.isNotBlank() && !isAiThinking,
                    colors = ButtonDefaults.buttonColors(containerColor = IceBlue, contentColor = ObsidianBlack),
                    modifier = Modifier.testTag("confirm_edit_resend_button")
                ) {
                    Text("RESEND")
                }
            },
            dismissButton = {
                TextButton(onClick = { editMessageTarget = null }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            }
        )
    }
}

@Composable
private fun ChatBubble(
    message: ConversationEntity,
    isSpeaking: Boolean,
    isLastAiReply: Boolean,
    canMutate: Boolean,
    onSpeak: () -> Unit,
    onStopSpeaking: () -> Unit,
    onRegenerate: () -> Unit,
    onEditAndResend: () -> Unit
) {
    val isUser = message.role == "user"
    val clipboard = LocalClipboardManager.current
    var copied by remember(message.id) { mutableStateOf(false) }

    LaunchedEffect(copied) {
        if (copied) {
            delay(1800)
            copied = false
        }
    }

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
                    if (message.isError) AlertCrimson.copy(alpha = 0.16f)
                    else if (isUser) ObsidianGlass.copy(alpha = 0.95f)
                    else AtmosphericViolet.copy(alpha = 0.45f)
                )
                .border(
                    1.dp,
                    if (message.isError) AlertCrimson.copy(alpha = 0.6f)
                    else if (isUser) ObsidianGlassBorder
                    else IceBlue.copy(alpha = 0.35f),
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
                if (!message.attachmentName.isNullOrBlank()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 8.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ObsidianBlack.copy(alpha = 0.6f))
                            .border(1.dp, IceBlue.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                            .padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        if (message.attachmentMimeType?.startsWith("image/") == true && !message.attachmentUri.isNullOrBlank()) {
                            AsyncImage(
                                model = Uri.parse(message.attachmentUri),
                                contentDescription = message.attachmentName,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(140.dp)
                                    .clip(RoundedCornerShape(8.dp))
                            )
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Description,
                                contentDescription = "Attachment",
                                tint = IceBlueBright,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = message.attachmentName,
                                color = IceBlueBright,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                if (isUser) {
                    Text(
                        text = message.text,
                        color = MetallicSilverLight,
                        fontSize = 13.5.sp,
                        lineHeight = 20.sp
                    )
                } else {
                    MarkdownText(markdown = message.text)
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.End)
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier
                            .clickable {
                                clipboard.setText(AnnotatedString(message.text))
                                copied = true
                            }
                            .padding(vertical = 2.dp)
                            .testTag("copy_message_${message.id}"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                            contentDescription = "Copy message",
                            tint = if (copied) SentinelEmerald else MetallicSilverMuted,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (copied) "COPIED" else "COPY",
                            color = if (copied) SentinelEmerald else MetallicSilverMuted,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    if (isUser && canMutate) {
                        Row(
                            modifier = Modifier
                                .clickable(onClick = onEditAndResend)
                                .padding(vertical = 2.dp)
                                .testTag("edit_resend_${message.id}"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "Edit and resend",
                                tint = IceBlue,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "EDIT",
                                color = IceBlue,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    if (isLastAiReply && canMutate) {
                        Row(
                            modifier = Modifier
                                .clickable(onClick = onRegenerate)
                                .padding(vertical = 2.dp)
                                .testTag("regenerate_last_button"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Regenerate response",
                                tint = IceBlue,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "REGENERATE",
                                color = IceBlue,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    if (!isUser && !message.isError) {
                        Row(
                            modifier = Modifier
                                .clickable { if (isSpeaking) onStopSpeaking() else onSpeak() }
                                .padding(vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.VolumeUp,
                                contentDescription = "Speak Text",
                                tint = IceBlue,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (isSpeaking) "STOP" else "SPEAK",
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
            MarkdownText(markdown = text)
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
