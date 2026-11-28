package com.example.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Summarize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
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
import coil.compose.AsyncImage
import com.example.agents.JarvisAgent
import com.example.data.db.ChatSessionEntity
import com.example.data.db.ConversationEntity
import com.example.media.YouTubeMediaUiState
import com.example.ui.JarvisViewModel
import com.example.ui.ScreenDestination
import com.example.ui.components.ChatInlineMediaInfo
import com.example.ui.components.ChatMediaDeckCard
import com.example.ui.components.ChatSidebarContent
import com.example.ui.components.FullscreenChatMediaDialog
import com.example.ui.components.MarkdownText
import com.example.ui.components.resolveChatInlineMedia
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

@Composable
fun AiChatScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
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
    val multiProviderStatus by viewModel.aiRepository.multiProviderStatus.collectAsState()
    val youTubeState by viewModel.youTubeState.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var sessionSearchQuery by remember { mutableStateOf("") }
    var renameTarget by remember { mutableStateOf<ChatSessionEntity?>(null) }
    var renameDraft by remember { mutableStateOf("") }
    var editMessageTarget by remember { mutableStateOf<ConversationEntity?>(null) }
    var editMessageDraft by remember { mutableStateOf("") }
    var attachMenuExpanded by remember { mutableStateOf(false) }
    var isWideSidebarExpanded by remember { mutableStateOf(true) }
    var expandedMediaMessageId by remember { mutableStateOf<Long?>(null) }
    var fullscreenMediaTarget by remember { mutableStateOf<ChatInlineMediaInfo?>(null) }

    val listState = rememberLazyListState()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()

    val isNearBottom by remember {
        derivedStateOf {
            val layout = listState.layoutInfo
            val lastVisible = layout.visibleItemsInfo.lastOrNull()
            lastVisible == null || lastVisible.index >= layout.totalItemsCount - 2
        }
    }

    LaunchedEffect(chatVoiceDraft) {
        val draft = chatVoiceDraft?.trim()
        if (!draft.isNullOrEmpty()) {
            inputText = if (inputText.isBlank()) draft else "${inputText.trimEnd()} $draft"
            viewModel.consumeChatVoiceDraft()
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

    LaunchedEffect(conversations.size, streamingText.length) {
        if ((conversations.isNotEmpty() || streamingText.isNotEmpty()) && isNearBottom) {
            val targetIndex = (conversations.size + if (streamingText.isNotEmpty() || isAiThinking) 1 else 0)
                .coerceAtLeast(1) - 1
            listState.animateScrollToItem(targetIndex)
        }
    }

    val activeAgentCodename = selectedCustomAgent?.codename ?: selectedAgent.codename
    val activeAgentAccent = selectedCustomAgent?.let { Color(it.colorHex) } ?: selectedAgent.accentColor

    val triggerMicOrInterrupt = {
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
    }

    val sidebarBody: @Composable (showCollapse: Boolean, onAfterAction: () -> Unit) -> Unit = { showCollapse, onAfterAction ->
        ChatSidebarContent(
            sessions = chatSessions,
            activeSessionId = activeSessionId,
            sessionSearchQuery = sessionSearchQuery,
            onSessionSearchChange = { sessionSearchQuery = it },
            selectedAgent = selectedAgent,
            customAgents = customAgents,
            selectedCustomAgent = selectedCustomAgent,
            showCollapseButton = showCollapse,
            onCollapse = { isWideSidebarExpanded = false },
            onNewChat = {
                viewModel.createNewChatSession()
                onAfterAction()
            },
            onSelectSession = { id ->
                viewModel.selectChatSession(id)
                onAfterAction()
            },
            onToggleSaveSession = { id -> viewModel.toggleSaveChatSession(id) },
            onRenameSession = { session ->
                renameTarget = session
                renameDraft = session.title
            },
            onDeleteSession = { id -> viewModel.deleteChatSession(id) },
            onSelectAgent = { agent ->
                viewModel.selectAgent(agent)
                onAfterAction()
            },
            onSelectCustomAgent = { custom ->
                viewModel.selectCustomAgent(custom)
                onAfterAction()
            },
            onNavigate = { dest ->
                onAfterAction()
                viewModel.navigateTo(dest)
            },
            onClearHistory = {
                viewModel.clearChatHistory()
                onAfterAction()
            },
            hasMessagesInActiveSession = conversations.isNotEmpty()
        )
    }

    val workspaceContent: @Composable (isWide: Boolean, onToggleSidebar: () -> Unit) -> Unit = { isWide, onToggleSidebar ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0xFF02050B),
                            Color(0xFF040916),
                            Color(0xFF02050B)
                        )
                    )
                )
                .testTag("ai_chat_workspace")
        ) {
            // Compact Cosmic Top Bar (Single row)
            CompactChatHeaderBar(
                activeSessionTitle = activeSession?.title ?: "$activeAgentCodename Chat",
                isSessionSaved = activeSession?.isSaved == true,
                agentCodename = activeAgentCodename,
                agentAccent = activeAgentAccent,
                hasRealKey = viewModel.aiRepository.hasRealApiKey,
                usesBackendProxy = viewModel.aiRepository.usesBackendProxy,
                allExhausted = multiProviderStatus.allProvidersExhausted,
                cooldownSec = multiProviderStatus.shortestCooldownSeconds,
                activeProviderLabel = multiProviderStatus.activeProviderLabel,
                activeModel = multiProviderStatus.activeModel,
                fallbackOrSwitched = multiProviderStatus.fallbackUsed || multiProviderStatus.switchedFromProvider != null,
                isSpeaking = isSpeaking,
                isListening = isListening,
                canSummarize = conversations.size >= 2,
                isSummarizing = isSummarizing,
                isAiThinking = isAiThinking,
                showSidebarOpenButton = !isWide || !isWideSidebarExpanded,
                onToggleSidebar = onToggleSidebar,
                onToggleSave = { viewModel.toggleSaveChatSession(activeSessionId) },
                onSummarize = { viewModel.summarizeActiveSession() },
                onVoiceMode = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) },
                onNewChat = { viewModel.createNewChatSession() }
            )

            HorizontalDivider(color = ObsidianGlassBorder.copy(alpha = 0.7f))

            // Centered Ultra-Wide Chat Stream + Notices + Composer
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.TopCenter
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .widthIn(max = 960.dp)
                ) {
                    if (sessionSummary != null || summaryError != null) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(AtmosphericViolet.copy(alpha = 0.22f))
                                .border(1.dp, IceBlue.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                                .testTag("chat_summary_card"),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (summaryError != null) "SUMMARY NOTICE" else "CONVERSATION SUMMARY",
                                    color = if (summaryError != null) AlertCrimson else IceBlueBright,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                                IconButton(
                                    onClick = { viewModel.clearSessionSummary() },
                                    modifier = Modifier.defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Close summary",
                                        tint = MetallicSilverMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                            Text(
                                text = summaryError ?: sessionSummary.orEmpty(),
                                color = MetallicSilverLight,
                                fontSize = 13.sp,
                                lineHeight = 19.sp
                            )
                        }
                    }

                    if (continuousVoiceMode || voiceErrorMessage != null || micPermissionDenied) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (voiceErrorMessage != null || micPermissionDenied) AlertCrimson.copy(alpha = 0.16f)
                                    else SentinelEmerald.copy(alpha = 0.14f)
                                )
                                .border(
                                    1.dp,
                                    if (voiceErrorMessage != null || micPermissionDenied) AlertCrimson.copy(alpha = 0.55f)
                                    else SentinelEmerald.copy(alpha = 0.5f),
                                    RoundedCornerShape(10.dp)
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
                                fontSize = 11.5.sp,
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
                                    Text("Settings", color = IceBlueBright, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            if (continuousVoiceMode) {
                                TextButton(onClick = { viewModel.exitContinuousVoiceMode() }) {
                                    Text("Exit Voice", color = AlertCrimson, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            } else if (voiceErrorMessage != null) {
                                TextButton(onClick = { viewModel.clearVoiceError() }) {
                                    Text("Dismiss", color = MetallicSilverMuted, fontSize = 11.sp)
                                }
                            }
                        }
                    }

                    // Spacious Full-Width Conversation Stream
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .testTag("chat_conversation_list"),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp)
                    ) {
                        if (conversations.isEmpty() && streamingText.isEmpty() && !isAiThinking) {
                            item(key = "empty_greeting") {
                                EmptyChatGreeting(
                                    agent = selectedAgent,
                                    customCodename = selectedCustomAgent?.codename,
                                    customDesignation = selectedCustomAgent?.systemPrompt?.take(72),
                                    onPromptClick = { prompt ->
                                        inputText = ""
                                        viewModel.sendMessage(prompt)
                                    }
                                )
                            }
                        }

                        val lastMsgId = conversations.lastOrNull()?.id
                        items(conversations, key = { it.id }) { msg ->
                            val isLastAiReply = msg.id == lastMsgId && msg.role != "user"
                            val inlineMedia = remember(msg.id, msg.mediaVideoId, msg.text) {
                                if (msg.role == "user") null else resolveChatInlineMedia(msg)
                            }
                            WorkspaceChatTurn(
                                message = msg,
                                inlineMedia = inlineMedia,
                                ytState = youTubeState,
                                isInlinePlayerExpanded = expandedMediaMessageId == msg.id,
                                isFullscreenOpen = fullscreenMediaTarget != null,
                                isSpeaking = isSpeaking,
                                isLastAiReply = isLastAiReply,
                                canMutate = !isAiThinking,
                                onSpeak = { viewModel.voiceManager.speak(msg.text) },
                                onStopSpeaking = { viewModel.stopSpeaking() },
                                onRegenerate = { viewModel.regenerateLastResponse() },
                                onEditAndResend = {
                                    editMessageTarget = msg
                                    editMessageDraft = msg.text
                                },
                                onToggleInlinePlayer = {
                                    expandedMediaMessageId =
                                        if (expandedMediaMessageId == msg.id) null else msg.id
                                },
                                onPlayInlineMedia = { media ->
                                    expandedMediaMessageId = msg.id
                                    viewModel.playYouTubeVideoById(
                                        videoId = media.videoId,
                                        title = media.title,
                                        channelTitle = media.channelTitle,
                                        thumbnailUrl = media.thumbnailUrl,
                                        durationText = media.durationText
                                    )
                                },
                                onPauseMedia = { viewModel.pauseYouTube() },
                                onToggleMuteMedia = { viewModel.toggleYouTubeMute() },
                                onOpenFullscreenMedia = { media -> fullscreenMediaTarget = media },
                                onOpenAmPlayer = { viewModel.navigateTo(ScreenDestination.YOUTUBE_MEDIA) },
                                onConsumeYouTubeCommand = { cmdId -> viewModel.consumeYouTubeCommand(cmdId) },
                                onYouTubeStateChanged = { code -> viewModel.onYouTubePlayerStateChanged(code) },
                                onYouTubeProgress = { cur, dur -> viewModel.onYouTubePlayerProgress(cur, dur) },
                                onYouTubeError = { code -> viewModel.onYouTubePlayerError(code) }
                            )
                        }

                        if (streamingText.isNotEmpty()) {
                            item(key = "streaming_ai") {
                                StreamingWideAiProse(
                                    agentCodename = activeAgentCodename,
                                    accent = activeAgentAccent,
                                    text = streamingText
                                )
                            }
                        } else if (isAiThinking) {
                            item(key = "thinking_ai") {
                                AiThinkingIndicator(
                                    agentCodename = activeAgentCodename,
                                    accent = activeAgentAccent
                                )
                            }
                        }
                    }

                    // Active Voice / Stop Generating / Attachment Status Strips above Composer
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .windowInsetsPadding(WindowInsets.navigationBars)
                            .imePadding()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (isAiThinking || streamingText.isNotEmpty()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Row(
                                    modifier = Modifier
                                        .defaultMinSize(minHeight = 48.dp)
                                        .clip(RoundedCornerShape(24.dp))
                                        .background(AlertCrimson.copy(alpha = 0.22f))
                                        .border(1.dp, AlertCrimson.copy(alpha = 0.7f), RoundedCornerShape(24.dp))
                                        .clickable { viewModel.stopGenerating() }
                                        .padding(horizontal = 18.dp, vertical = 10.dp)
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
                                        color = Color.White,
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
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(AlertCrimson.copy(alpha = 0.16f))
                                    .border(1.dp, AlertCrimson.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = errMsg,
                                    color = AlertCrimson,
                                    fontSize = 11.5.sp,
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(onClick = { viewModel.clearAttachmentError() }) {
                                    Text("OK", color = MetallicSilverLight, fontSize = 11.sp)
                                }
                            }
                        }

                        pendingAttachment?.let { att ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(ObsidianGlass)
                                    .border(1.dp, IceBlue.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                if (att.mimeType.startsWith("image/")) {
                                    AsyncImage(
                                        model = Uri.parse(att.uriString),
                                        contentDescription = att.name,
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .border(1.dp, IceBlue.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Description,
                                        contentDescription = att.name,
                                        tint = IceBlueBright,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = att.name,
                                        color = MetallicSilverLight,
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
                                            .padding(horizontal = 8.dp, vertical = 6.dp)
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
                                    modifier = Modifier.defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "Remove attachment",
                                        tint = AlertCrimson,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }

                        if (isSpeaking || isSpeechPaused) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(QuantumGold.copy(alpha = 0.14f))
                                    .border(1.dp, QuantumGold.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp, vertical = 4.dp)
                                    .testTag("chat_tts_control_bar"),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = if (isSpeechPaused) "VOICE PAUSED" else "AM AI SPEAKING",
                                    color = QuantumGold,
                                    fontSize = 10.5.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f)
                                )
                                IconButton(
                                    onClick = {
                                        if (isSpeechPaused) viewModel.resumeSpeaking() else viewModel.pauseSpeaking()
                                    },
                                    modifier = Modifier
                                        .defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                                        .testTag("chat_tts_pause_resume_btn")
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
                                    modifier = Modifier
                                        .defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                                        .testTag("chat_tts_stop_btn")
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
                                    modifier = Modifier
                                        .defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                                        .testTag("chat_tts_mute_btn")
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

                        // Large ChatGPT-Style Docked Bottom Composer
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0xFF071326))
                                .border(1.dp, IceBlue.copy(alpha = 0.34f), RoundedCornerShape(20.dp))
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            OutlinedTextField(
                                value = inputText,
                                onValueChange = { if (it.length <= 8000) inputText = it },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 52.dp)
                                    .testTag("chat_input_field"),
                                placeholder = {
                                    Text(
                                        text = when {
                                            isListening -> "Listening... speak now"
                                            pendingAttachment != null -> "Ask about ${pendingAttachment!!.name}..."
                                            else -> "Message $activeAgentCodename (English / Hindi / Hinglish)..."
                                        },
                                        color = if (isListening) SentinelEmerald else MetallicSilverMuted,
                                        fontSize = 15.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                },
                                textStyle = androidx.compose.ui.text.TextStyle(
                                    color = Color.White,
                                    fontSize = 15.sp,
                                    lineHeight = 22.sp
                                ),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent,
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    cursorColor = IceBlueBright,
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent
                                ),
                                maxLines = 6
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Left: Attach / Image / File tools
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box {
                                        ComposerActionChip(
                                            icon = Icons.Default.AttachFile,
                                            label = "Attach",
                                            tint = IceBlueBright,
                                            highlighted = pendingAttachment != null,
                                            tag = "chat_attach_button",
                                            onClick = { attachMenuExpanded = true }
                                        )
                                        DropdownMenu(
                                            expanded = attachMenuExpanded,
                                            onDismissRequest = { attachMenuExpanded = false },
                                            containerColor = ObsidianGlass
                                        ) {
                                            DropdownMenuItem(
                                                text = { Text("Upload Image (Photo Picker)", color = MetallicSilver, fontSize = 13.sp) },
                                                leadingIcon = { Icon(Icons.Default.Image, contentDescription = null, tint = IceBlue) },
                                                onClick = {
                                                    attachMenuExpanded = false
                                                    photoPickerLauncher.launch(
                                                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                                    )
                                                }
                                            )
                                            DropdownMenuItem(
                                                text = { Text("Upload Document (PDF / Text)", color = MetallicSilver, fontSize = 13.sp) },
                                                leadingIcon = { Icon(Icons.Default.Description, contentDescription = null, tint = QuantumGold) },
                                                onClick = {
                                                    attachMenuExpanded = false
                                                    documentPickerLauncher.launch(arrayOf("application/pdf", "text/*", "application/json", "*/*"))
                                                }
                                            )
                                        }
                                    }

                                    ComposerActionChip(
                                        icon = Icons.Default.Image,
                                        label = "Image",
                                        tint = IceBlue,
                                        highlighted = false,
                                        tag = "chat_image_button",
                                        onClick = {
                                            photoPickerLauncher.launch(
                                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                            )
                                        }
                                    )

                                    ComposerActionChip(
                                        icon = Icons.Default.Description,
                                        label = "File",
                                        tint = QuantumGold,
                                        highlighted = false,
                                        tag = "chat_file_button",
                                        onClick = {
                                            documentPickerLauncher.launch(arrayOf("application/pdf", "text/*", "application/json", "*/*"))
                                        }
                                    )
                                }

                                // Right: Mic / Voice Conversation / Send-or-Stop
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    activeBrainAnalysis?.let { meta ->
                                        if (inputText.length > 500) {
                                            Text(
                                                text = "${inputText.length}/8000",
                                                color = if (inputText.length > 7600) AlertCrimson else MetallicSilverMuted,
                                                fontSize = 10.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        } else {
                                            Text(
                                                text = meta.detectedLanguage.label.uppercase(),
                                                color = MetallicSilverMuted,
                                                fontSize = 9.5.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }

                                    IconButton(
                                        onClick = triggerMicOrInterrupt,
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (isListening) AlertCrimson.copy(alpha = 0.25f) else ObsidianGlass
                                            )
                                            .testTag("chat_mic_button")
                                    ) {
                                        Icon(
                                            imageVector = if (isSpeaking || isListening) Icons.Default.Stop else Icons.Default.Mic,
                                            contentDescription = if (isListening) "Stop listening" else "Microphone input",
                                            tint = if (isListening) AlertCrimson else if (isSpeaking) QuantumGold else IceBlueBright
                                        )
                                    }

                                    IconButton(
                                        onClick = { viewModel.navigateTo(ScreenDestination.VOICE_HUD) },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .clip(CircleShape)
                                            .background(AtmosphericViolet.copy(alpha = 0.24f))
                                            .border(1.dp, AtmosphericViolet.copy(alpha = 0.5f), CircleShape)
                                            .testTag("chat_voice_conversation_btn")
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.GraphicEq,
                                            contentDescription = "Voice conversation mode",
                                            tint = Color.White
                                        )
                                    }

                                    if (isAiThinking || streamingText.isNotEmpty()) {
                                        IconButton(
                                            onClick = { viewModel.stopGenerating() },
                                            modifier = Modifier
                                                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                                .clip(CircleShape)
                                                .background(AlertCrimson)
                                                .testTag("chat_stop_button")
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Stop,
                                                contentDescription = "Stop generating",
                                                tint = ObsidianBlack,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    } else {
                                        val canSend = inputText.isNotBlank() || pendingAttachment != null
                                        IconButton(
                                            onClick = {
                                                if (canSend) {
                                                    val text = inputText
                                                    inputText = ""
                                                    viewModel.sendMessage(text)
                                                }
                                            },
                                            modifier = Modifier
                                                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                                .clip(CircleShape)
                                                .background(if (canSend) IceBlue else ObsidianGlass)
                                                .testTag("chat_send_button")
                                        ) {
                                            Icon(
                                                imageVector = Icons.AutoMirrored.Filled.Send,
                                                contentDescription = "Send",
                                                tint = if (canSend) ObsidianBlack else MetallicSilverMuted,
                                                modifier = Modifier.size(20.dp)
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
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        val isWideScreen = maxWidth >= 840.dp
        if (isWideScreen) {
            Row(modifier = Modifier.fillMaxSize()) {
                AnimatedVisibility(visible = isWideSidebarExpanded) {
                    Box(
                        modifier = Modifier
                            .width(292.dp)
                            .fillMaxHeight()
                            .border(1.dp, ObsidianGlassBorder)
                            .windowInsetsPadding(WindowInsets.statusBars)
                    ) {
                        sidebarBody(true) {}
                    }
                }
                Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                    workspaceContent(true) {
                        isWideSidebarExpanded = !isWideSidebarExpanded
                    }
                }
            }
        } else {
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    ModalDrawerSheet(
                        drawerContainerColor = ObsidianSurface,
                        drawerContentColor = MetallicSilver,
                        modifier = Modifier.widthIn(max = 312.dp)
                    ) {
                        sidebarBody(false) {
                            coroutineScope.launch { drawerState.close() }
                        }
                    }
                }
            ) {
                workspaceContent(false) {
                    coroutineScope.launch { drawerState.open() }
                }
            }
        }
    }

    fullscreenMediaTarget?.let { target ->
        FullscreenChatMediaDialog(
            media = target,
            ytState = youTubeState,
            onPlay = {
                if (youTubeState.currentVideo?.videoId == target.videoId) {
                    viewModel.playYouTube()
                } else {
                    viewModel.playYouTubeVideoById(
                        videoId = target.videoId,
                        title = target.title,
                        channelTitle = target.channelTitle,
                        thumbnailUrl = target.thumbnailUrl,
                        durationText = target.durationText
                    )
                }
            },
            onPause = { viewModel.pauseYouTube() },
            onPrevious = { viewModel.playPreviousYouTubeVideo() },
            onNext = { viewModel.playNextYouTubeVideo() },
            onToggleMute = { viewModel.toggleYouTubeMute() },
            onConsumeCommand = { cmdId -> viewModel.consumeYouTubeCommand(cmdId) },
            onPlayerStateChanged = { code -> viewModel.onYouTubePlayerStateChanged(code) },
            onPlayerProgress = { cur, dur -> viewModel.onYouTubePlayerProgress(cur, dur) },
            onPlayerError = { code -> viewModel.onYouTubePlayerError(code) },
            onDismiss = { fullscreenMediaTarget = null }
        )
    }

    renameTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            containerColor = ObsidianGlass,
            title = { Text("Rename Conversation", color = MetallicSilverLight) },
            text = {
                OutlinedTextField(
                    value = renameDraft,
                    onValueChange = { renameDraft = it },
                    singleLine = true,
                    label = { Text("Conversation Title", color = MetallicSilverMuted) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MetallicSilverLight,
                        unfocusedTextColor = MetallicSilverLight,
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
                    label = { Text("Message", color = MetallicSilverMuted) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("edit_message_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MetallicSilverLight,
                        unfocusedTextColor = MetallicSilverLight,
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
private fun CompactChatHeaderBar(
    activeSessionTitle: String,
    isSessionSaved: Boolean,
    agentCodename: String,
    agentAccent: Color,
    hasRealKey: Boolean,
    usesBackendProxy: Boolean,
    allExhausted: Boolean,
    cooldownSec: Int,
    activeProviderLabel: String,
    activeModel: String,
    fallbackOrSwitched: Boolean,
    isSpeaking: Boolean,
    isListening: Boolean,
    canSummarize: Boolean,
    isSummarizing: Boolean,
    isAiThinking: Boolean,
    showSidebarOpenButton: Boolean,
    onToggleSidebar: () -> Unit,
    onToggleSave: () -> Unit,
    onSummarize: () -> Unit,
    onVoiceMode: () -> Unit,
    onNewChat: () -> Unit
) {
    val statusDotColor = when {
        isListening -> SentinelEmerald
        isSpeaking -> QuantumGold
        !hasRealKey -> IceBlueBright
        !usesBackendProxy && allExhausted -> AlertCrimson
        fallbackOrSwitched -> QuantumGold
        else -> SentinelEmerald
    }
    val statusSummary = when {
        !hasRealKey -> "$agentCodename • FREE READY"
        !usesBackendProxy && allExhausted -> "COOLDOWN ${cooldownSec}S"
        usesBackendProxy -> "$agentCodename • ${activeProviderLabel.uppercase()} • ₹0"
        else -> "$agentCodename • ${activeModel.uppercase().take(18)}"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF060E1F))
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        IconButton(
            onClick = onToggleSidebar,
            modifier = Modifier
                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                .testTag("open_sessions_drawer_btn")
        ) {
            Icon(
                imageVector = Icons.Default.Menu,
                contentDescription = if (showSidebarOpenButton) "Open sidebar" else "Toggle sidebar",
                tint = IceBlueBright
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = activeSessionTitle,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(statusDotColor)
                )
                Text(
                    text = statusSummary,
                    color = agentAccent.copy(alpha = 0.92f),
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.testTag("chat_model_status_banner")
                )
            }
        }

        IconButton(
            onClick = onToggleSave,
            modifier = Modifier
                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                .testTag("header_save_session_btn")
        ) {
            Icon(
                imageVector = if (isSessionSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                contentDescription = if (isSessionSaved) "Remove from Saved" else "Save conversation",
                tint = if (isSessionSaved) QuantumGold else MetallicSilverMuted
            )
        }

        if (canSummarize) {
            IconButton(
                onClick = onSummarize,
                enabled = !isSummarizing && !isAiThinking,
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .testTag("summarize_chat_btn")
            ) {
                Icon(
                    imageVector = Icons.Default.Summarize,
                    contentDescription = "Summarize conversation",
                    tint = if (isSummarizing) QuantumGold else IceBlueBright
                )
            }
        }

        IconButton(
            onClick = onVoiceMode,
            modifier = Modifier
                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                .clip(CircleShape)
                .background(AtmosphericViolet.copy(alpha = 0.22f))
                .testTag("chat_header_voice_mode_btn")
        ) {
            Icon(
                imageVector = Icons.Default.GraphicEq,
                contentDescription = "Open Voice Mode",
                tint = Color.White
            )
        }

        IconButton(
            onClick = onNewChat,
            modifier = Modifier
                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                .clip(CircleShape)
                .background(IceBlue.copy(alpha = 0.16f))
                .testTag("new_chat_button")
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "New Chat",
                tint = IceBlueBright
            )
        }
    }
}

@Composable
private fun ComposerActionChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tint: Color,
    highlighted: Boolean,
    tag: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (highlighted) IceBlue.copy(alpha = 0.22f) else ObsidianGlass)
            .border(
                1.dp,
                if (highlighted) IceBlue else ObsidianGlassBorder.copy(alpha = 0.7f),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = tint,
            modifier = Modifier.size(16.dp)
        )
        Text(
            text = label,
            color = MetallicSilverLight,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1
        )
    }
}

@Composable
private fun WorkspaceChatTurn(
    message: ConversationEntity,
    inlineMedia: ChatInlineMediaInfo?,
    ytState: YouTubeMediaUiState,
    isInlinePlayerExpanded: Boolean,
    isFullscreenOpen: Boolean,
    isSpeaking: Boolean,
    isLastAiReply: Boolean,
    canMutate: Boolean,
    onSpeak: () -> Unit,
    onStopSpeaking: () -> Unit,
    onRegenerate: () -> Unit,
    onEditAndResend: () -> Unit,
    onToggleInlinePlayer: () -> Unit,
    onPlayInlineMedia: (ChatInlineMediaInfo) -> Unit,
    onPauseMedia: () -> Unit,
    onToggleMuteMedia: () -> Unit,
    onOpenFullscreenMedia: (ChatInlineMediaInfo) -> Unit,
    onOpenAmPlayer: () -> Unit,
    onConsumeYouTubeCommand: (Long) -> Unit,
    onYouTubeStateChanged: (Int) -> Unit,
    onYouTubeProgress: (Int, Int) -> Unit,
    onYouTubeError: (Int) -> Unit
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

    if (isUser) {
        // Right-Aligned Electric Blue User Message
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.End
        ) {
            Column(
                modifier = Modifier
                    .widthIn(max = 640.dp)
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 4.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(
                                Color(0xFF0A3D8F),
                                Color(0xFF1464D8)
                            )
                        )
                    )
                    .border(
                        1.dp,
                        IceBlueBright.copy(alpha = 0.4f),
                        RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 4.dp)
                    )
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                AttachmentPreviewBlock(message = message)
                Text(
                    text = message.text,
                    color = Color.White,
                    fontSize = 15.sp,
                    lineHeight = 22.sp
                )
            }
            Row(
                modifier = Modifier.padding(top = 4.dp, end = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TurnMiniAction(
                    icon = if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                    label = if (copied) "COPIED" else "COPY",
                    tint = if (copied) SentinelEmerald else MetallicSilverMuted,
                    tag = "copy_message_${message.id}",
                    onClick = {
                        clipboard.setText(AnnotatedString(message.text))
                        copied = true
                    }
                )
                if (canMutate) {
                    TurnMiniAction(
                        icon = Icons.Default.Edit,
                        label = "EDIT",
                        tint = IceBlueBright,
                        tag = "edit_resend_${message.id}",
                        onClick = onEditAndResend
                    )
                }
            }
        }
    } else {
        // Left-Aligned Wide Borderless AI Prose with Subtle Purple Highlight
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .testTag("ai_wide_response_${message.id}"),
            horizontalAlignment = Alignment.Start
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(AtmosphericViolet.copy(alpha = 0.35f))
                        .border(1.dp, AtmosphericViolet.copy(alpha = 0.7f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = message.agentName.take(1).uppercase(),
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Text(
                    text = message.agentName,
                    color = IceBlueBright,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                if (message.isVoice) {
                    Text(
                        text = "VOICE",
                        color = SentinelEmerald,
                        fontSize = 9.5.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            val stripeColor = if (message.isError) AlertCrimson else AtmosphericViolet
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        if (message.isError) {
                            Brush.horizontalGradient(
                                listOf(AlertCrimson.copy(alpha = 0.16f), Color.Transparent)
                            )
                        } else {
                            Brush.horizontalGradient(
                                listOf(
                                    AtmosphericViolet.copy(alpha = 0.16f),
                                    AtmosphericViolet.copy(alpha = 0.05f),
                                    Color.Transparent
                                )
                            )
                        }
                    )
                    .drawBehind {
                        drawRect(
                            color = stripeColor,
                            topLeft = Offset.Zero,
                            size = Size(width = 3.dp.toPx(), height = size.height)
                        )
                    }
                    .padding(start = 14.dp, end = 6.dp, top = 8.dp, bottom = 8.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    AttachmentPreviewBlock(message = message)
                    MarkdownText(markdown = message.text)

                    if (inlineMedia != null) {
                        ChatMediaDeckCard(
                            media = inlineMedia,
                            ytState = ytState,
                            isInlinePlayerExpanded = isInlinePlayerExpanded,
                            isFullscreenOpen = isFullscreenOpen,
                            onToggleInlinePlayer = onToggleInlinePlayer,
                            onPlayTrack = { onPlayInlineMedia(inlineMedia) },
                            onPause = onPauseMedia,
                            onToggleMute = onToggleMuteMedia,
                            onOpenFullscreen = { onOpenFullscreenMedia(inlineMedia) },
                            onOpenAmPlayer = onOpenAmPlayer,
                            onConsumeCommand = onConsumeYouTubeCommand,
                            onPlayerStateChanged = onYouTubeStateChanged,
                            onPlayerProgress = onYouTubeProgress,
                            onPlayerError = onYouTubeError
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.padding(start = 15.dp, top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TurnMiniAction(
                    icon = if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                    label = if (copied) "COPIED" else "COPY",
                    tint = if (copied) SentinelEmerald else MetallicSilverMuted,
                    tag = "copy_message_${message.id}",
                    onClick = {
                        clipboard.setText(AnnotatedString(message.text))
                        copied = true
                    }
                )
                if (isLastAiReply && canMutate) {
                    TurnMiniAction(
                        icon = Icons.Default.Refresh,
                        label = "REGENERATE",
                        tint = IceBlueBright,
                        tag = "regenerate_last_button",
                        onClick = onRegenerate
                    )
                }
                if (!message.isError) {
                    TurnMiniAction(
                        icon = Icons.AutoMirrored.Filled.VolumeUp,
                        label = if (isSpeaking) "STOP" else "SPEAK",
                        tint = if (isSpeaking) QuantumGold else IceBlueBright,
                        tag = "speak_message_${message.id}",
                        onClick = { if (isSpeaking) onStopSpeaking() else onSpeak() }
                    )
                }
            }
        }
    }
}

@Composable
private fun AttachmentPreviewBlock(message: ConversationEntity) {
    if (message.attachmentName.isNullOrBlank()) return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(ObsidianBlack.copy(alpha = 0.55f))
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
                    .height(160.dp)
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

@Composable
private fun TurnMiniAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tint: Color,
    tag: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .defaultMinSize(minHeight = 36.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 4.dp)
            .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = tint,
            modifier = Modifier.size(14.dp)
        )
        Text(
            text = label,
            color = tint,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun StreamingWideAiProse(agentCodename: String, accent: Color, text: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.Start
    ) {
        Text(
            text = "$agentCodename • STREAMING",
            color = accent,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            AtmosphericViolet.copy(alpha = 0.18f),
                            AtmosphericViolet.copy(alpha = 0.05f),
                            Color.Transparent
                        )
                    )
                )
                .drawBehind {
                    drawRect(
                        color = accent,
                        topLeft = Offset.Zero,
                        size = Size(width = 3.dp.toPx(), height = size.height)
                    )
                }
                .padding(start = 14.dp, end = 6.dp, top = 8.dp, bottom = 8.dp)
        ) {
            Box(modifier = Modifier.weight(1f)) {
                MarkdownText(markdown = text)
            }
        }
    }
}

@Composable
private fun AiThinkingIndicator(agentCodename: String, accent: Color) {
    Row(
        modifier = Modifier
            .background(AtmosphericViolet.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
            .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(accent, CircleShape)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = "$agentCodename is thinking...",
            color = MetallicSilverLight,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun EmptyChatGreeting(
    agent: JarvisAgent,
    customCodename: String?,
    customDesignation: String?,
    onPromptClick: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = agent.icon,
            contentDescription = customCodename ?: agent.codename,
            tint = agent.accentColor,
            modifier = Modifier.size(44.dp)
        )
        Text(
            text = if (customCodename != null) "$customCodename Online" else "AM AI • ${agent.designation}",
            color = Color.White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 12.dp)
        )
        Text(
            text = customDesignation ?: agent.specialization,
            color = MetallicSilverMuted,
            fontSize = 13.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(top = 4.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))
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
                "Play relaxing lofi music on YouTube",
                "Summarize the latest AI breakthroughs in a clean comparison table",
                "Good day, AM AI. Report on all available systems."
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 680.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            prompts.forEach { p ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(ObsidianGlass)
                        .border(1.dp, IceBlue.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
                        .clickable { onPromptClick(p) }
                        .padding(horizontal = 16.dp, vertical = 14.dp)
                ) {
                    Text(
                        text = p,
                        color = MetallicSilverLight,
                        fontSize = 13.5.sp
                    )
                }
            }
        }
    }
}
