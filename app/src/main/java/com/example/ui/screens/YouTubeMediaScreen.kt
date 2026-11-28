package com.example.ui.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.PlaylistAdd
import androidx.compose.material.icons.automirrored.filled.PlaylistPlay
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.automirrored.filled.VolumeDown
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import com.example.R
import com.example.features.AutomationRepository
import com.example.features.SafeWebsiteEntry
import com.example.media.YouTubePlaybackStatus
import com.example.media.YouTubePlayerAction
import com.example.media.YouTubeRepository
import com.example.media.YouTubeSearchMode
import com.example.media.YouTubeVideoItem
import com.example.ui.JarvisViewModel
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.LocalJarvisTokens
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import kotlin.math.abs

private val AM_PLAYER_SPEEDS = listOf(0.5f, 1.0f, 1.25f, 1.5f, 2.0f)

private val AM_PLAYER_CATEGORIES = listOf(
    Triple("Python Tutorials", "Python programming tutorial for beginners", YouTubeSearchMode.EDUCATION),
    Triple("Tech & AI", "Artificial Intelligence future technology news", YouTubeSearchMode.EDUCATION),
    Triple("Space 4K", "Space exploration cosmic universe 4K", YouTubeSearchMode.VIDEO),
    Triple("Cyberpunk Lo-Fi", "Cyberpunk synthwave lo-fi study beats", YouTubeSearchMode.MUSIC),
    Triple("Cricket Highlights", "Cricket highlights today", YouTubeSearchMode.VIDEO),
    Triple("News Today", "World tech news today", YouTubeSearchMode.VIDEO)
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun YouTubeMediaScreen(viewModel: JarvisViewModel) {
    val state by viewModel.youTubeState.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val tokens = LocalJarvisTokens.current
    val context = LocalContext.current

    var queryText by remember { mutableStateOf(state.query) }
    // 0=Results, 1=Related, 2=Queue, 3=Favorites, 4=Playlists, 5=History
    var activeTab by remember { mutableIntStateOf(0) }
    var mediaSection by remember { mutableIntStateOf(0) } // 0 = AM Player, 1 = Safe Web Browser
    var showCategoriesDrawer by remember { mutableStateOf(false) }
    var playlistTargetItem by remember { mutableStateOf<YouTubeVideoItem?>(null) }
    var newPlaylistName by remember { mutableStateOf("") }

    var customBrowserInput by remember { mutableStateOf("https://en.wikipedia.org") }
    var activeBrowserUrl by remember { mutableStateOf<String?>(null) }
    var pendingLaunchSite by remember { mutableStateOf<Pair<String, String>?>(null) }
    var browserError by remember { mutableStateOf<String?>(null) }
    val webViewHolder = remember { mutableStateOf<WebView?>(null) }

    LaunchedEffect(state.query) {
        if (state.query.isNotBlank() && queryText.isBlank()) {
            queryText = state.query
        }
    }

    LaunchedEffect(state.searchResults.size) {
        if (state.searchResults.isNotEmpty() && activeTab !in listOf(0, 2)) {
            activeTab = 0
        }
    }

    // Dispatch Kotlin -> Official YouTube IFrame JS commands
    LaunchedEffect(state.pendingCommand?.id) {
        val cmd = state.pendingCommand ?: return@LaunchedEffect
        val wv = webViewHolder.value ?: return@LaunchedEffect
        val js = when (val action = cmd.action) {
            is YouTubePlayerAction.LoadVideo -> {
                val safeId = action.videoId.replace(Regex("[^A-Za-z0-9_-]"), "")
                "window.jarvisLoadVideo('$safeId', ${action.autoPlay});"
            }
            YouTubePlayerAction.Play -> "window.jarvisPlay();"
            YouTubePlayerAction.Pause -> "window.jarvisPause();"
            YouTubePlayerAction.Stop -> "window.jarvisStop();"
            is YouTubePlayerAction.SeekBy -> "window.jarvisSeekBy(${action.deltaSeconds});"
            is YouTubePlayerAction.SeekTo -> "window.jarvisSeekTo(${action.seconds});"
            is YouTubePlayerAction.SetVolume -> "window.jarvisSetVolume(${action.level});"
            YouTubePlayerAction.Mute -> "window.jarvisMute();"
            YouTubePlayerAction.Unmute -> "window.jarvisUnmute();"
            is YouTubePlayerAction.SetPlaybackRate -> "window.jarvisSetPlaybackRate(${action.rate});"
        }
        wv.evaluateJavascript(js, null)
        viewModel.consumeYouTubeCommand(cmd.id)
    }

    DisposableEffect(Unit) {
        onDispose {
            webViewHolder.value?.let { wv ->
                wv.stopLoading()
                wv.destroy()
            }
            webViewHolder.value = null
        }
    }

    fun openExternalUrl(url: String) {
        runCatching {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
        }
    }

    val favoriteIds = remember(state.favorites) {
        state.favorites.map { it.videoId }.toSet()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.screenBg)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .testTag("youtube_media_screen")
    ) {
        // Top AM Player Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(tokens.surfaceBg)
                .border(1.dp, tokens.glassBorder)
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = { viewModel.navigateBack() },
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .testTag("youtube_back_btn")
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.youtube_back_desc),
                    tint = tokens.accentBright
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "AM PLAYER",
                        color = tokens.accentBright,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.6.sp
                    )
                    Box(
                        modifier = Modifier
                            .background(QuantumGold.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                            .border(1.dp, QuantumGold.copy(alpha = 0.6f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 5.dp, vertical = 1.dp)
                    ) {
                        Text(
                            text = "PRO",
                            color = QuantumGold,
                            fontSize = 8.5.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
                Text(
                    text = if (state.isBackendConfigured) {
                        "WATCH • SEARCH • ENJOY"
                    } else {
                        stringResource(R.string.youtube_status_direct_mode)
                    },
                    color = if (state.isBackendConfigured) SentinelEmerald else QuantumGold,
                    fontSize = 9.5.sp,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.1.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            if (mediaSection == 0) {
                IconButton(
                    onClick = { viewModel.toggleYouTubeFullscreen() },
                    modifier = Modifier
                        .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                        .testTag("youtube_fullscreen_btn")
                ) {
                    Icon(
                        imageVector = if (state.isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                        contentDescription = stringResource(R.string.youtube_fullscreen_desc),
                        tint = tokens.accentBright
                    )
                }
            }

            IconButton(
                onClick = {
                    if (isListening) viewModel.stopVoiceListening() else viewModel.startVoiceListening()
                },
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .background(
                        if (isListening) AlertCrimson.copy(alpha = 0.25f) else tokens.accent.copy(alpha = 0.16f),
                        CircleShape
                    )
                    .testTag("youtube_voice_btn")
            ) {
                Icon(
                    imageVector = if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = stringResource(R.string.youtube_voice_search_desc),
                    tint = if (isListening) AlertCrimson else tokens.accentBright
                )
            }
        }

        if (!state.isFullscreen) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = { mediaSection = 0 },
                    border = BorderStroke(1.dp, if (mediaSection == 0) tokens.accentBright else tokens.glassBorder),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (mediaSection == 0) tokens.accent.copy(alpha = 0.18f) else tokens.glassBg
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .testTag("media_switch_youtube")
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null, tint = tokens.accentBright, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.youtube_tab_youtube), color = tokens.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
                OutlinedButton(
                    onClick = { mediaSection = 1 },
                    border = BorderStroke(1.dp, if (mediaSection == 1) tokens.accentBright else tokens.glassBorder),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (mediaSection == 1) tokens.accent.copy(alpha = 0.18f) else tokens.glassBg
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .testTag("media_switch_browser")
                ) {
                    Icon(Icons.Default.Public, contentDescription = null, tint = tokens.accentBright, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.youtube_tab_browser), color = tokens.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }

        if (mediaSection == 1) {
            SafeWebBrowserSection(
                urlInput = customBrowserInput,
                onUrlInputChange = {
                    customBrowserInput = it
                    browserError = null
                },
                activePreviewUrl = activeBrowserUrl,
                errorMessage = browserError,
                onRequestOpenUrl = { label, rawUrl ->
                    AutomationRepository.validateWebsiteUrl(rawUrl).fold(
                        onSuccess = { validUrl ->
                            browserError = null
                            pendingLaunchSite = label to validUrl
                        },
                        onFailure = { err ->
                            browserError = err.localizedMessage ?: "Invalid URL"
                        }
                    )
                },
                onOpenExternal = { url -> openExternalUrl(url) },
                modifier = Modifier.weight(1f)
            )
            pendingLaunchSite?.let { (label, url) ->
                AlertDialog(
                    onDismissRequest = { pendingLaunchSite = null },
                    containerColor = tokens.surfaceBg,
                    title = { Text("Launch Safe Website?", color = tokens.textPrimary, fontFamily = FontFamily.Monospace) },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(label, color = tokens.accentBright, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(url, color = tokens.textMuted, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                            Text(
                                "Verified HTTPS origin. Open inside AM AI Secure Preview or launch externally?",
                                color = tokens.textMuted,
                                fontSize = 12.sp
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                activeBrowserUrl = url
                                pendingLaunchSite = null
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = tokens.accentBright, contentColor = tokens.screenBg)
                        ) { Text("IN-APP PREVIEW") }
                    },
                    dismissButton = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            TextButton(onClick = {
                                openExternalUrl(url)
                                pendingLaunchSite = null
                            }) { Text("EXTERNAL", color = SentinelEmerald) }
                            TextButton(onClick = { pendingLaunchSite = null }) { Text("CANCEL", color = tokens.textMuted) }
                        }
                    }
                )
            }
        } else {
            // Persistent Official YouTube IFrame WebView Player Stage
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (state.isFullscreen) {
                            Modifier.weight(1f)
                        } else {
                            Modifier
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                .aspectRatio(16f / 9f)
                                .clip(RoundedCornerShape(16.dp))
                                .border(1.5.dp, IceBlue.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                        }
                    )
                    .background(Color.Black)
                    .testTag("youtube_iframe_stage")
            ) {
                YouTubeIFrameWebView(
                    initialVideoId = state.currentVideo?.videoId,
                    onWebViewReady = { wv -> webViewHolder.value = wv },
                    onStateChanged = { code -> viewModel.onYouTubePlayerStateChanged(code) },
                    onProgress = { cur, dur -> viewModel.onYouTubePlayerProgress(cur, dur) },
                    onError = { code -> viewModel.onYouTubePlayerError(code) }
                )

                // Honest overlay for Idle, Embed Blocked, or Error states
                if (state.currentVideo == null ||
                    state.status == YouTubePlaybackStatus.IDLE ||
                    state.status == YouTubePlaybackStatus.EMBED_BLOCKED ||
                    state.status == YouTubePlaybackStatus.ERROR
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(ObsidianBlack.copy(alpha = 0.88f))
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        if (state.status == YouTubePlaybackStatus.EMBED_BLOCKED || state.status == YouTubePlaybackStatus.ERROR) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = stringResource(R.string.youtube_error_desc),
                                tint = QuantumGold,
                                modifier = Modifier.size(30.dp)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = if (state.status == YouTubePlaybackStatus.EMBED_BLOCKED) {
                                    stringResource(R.string.youtube_embed_blocked_title)
                                } else {
                                    stringResource(R.string.youtube_player_error_title)
                                },
                                color = QuantumGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = state.errorMessage ?: stringResource(R.string.youtube_embed_blocked_body),
                                color = MetallicSilver,
                                fontSize = 11.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                val targetUrl = state.currentVideo?.watchUrl ?: state.fallbackUrl
                                if (!targetUrl.isNullOrBlank()) {
                                    Button(
                                        onClick = { openExternalUrl(targetUrl) },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = QuantumGold,
                                            contentColor = ObsidianBlack
                                        ),
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(stringResource(R.string.youtube_open_external), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                if (state.queue.size > 1) {
                                    OutlinedButton(
                                        onClick = { viewModel.playNextYouTubeVideo() },
                                        border = BorderStroke(1.dp, IceBlueBright),
                                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                    ) {
                                        Text(stringResource(R.string.youtube_next_track), color = IceBlueBright, fontSize = 11.sp)
                                    }
                                }
                            }
                        } else {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = IceBlueBright,
                                modifier = Modifier.size(34.dp)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = stringResource(R.string.youtube_player_ready_title),
                                color = IceBlueBright,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = stringResource(R.string.youtube_player_ready_hint),
                                color = MetallicSilverMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }

            // Scrollable Hero Banner, Controls, Search, Quick Tiles, and Tabs
            if (!state.isFullscreen) {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // 1. COSMIC INTELLIGENCE HERO AVATAR BANNER & QUICK TILES
                    item {
                        AmPlayerHeroCard(
                            isListening = isListening,
                            onTrendingClick = {
                                activeTab = 0
                                viewModel.fetchTrendingVideos()
                            },
                            onPopularClick = {
                                queryText = "Trending popular songs and videos"
                                activeTab = 0
                                viewModel.searchYouTube(queryText, YouTubeSearchMode.VIDEO)
                            },
                            onHistoryClick = { activeTab = 5 },
                            onFavoritesClick = { activeTab = 3 },
                            onCategoriesClick = { showCategoriesDrawer = !showCategoriesDrawer },
                            onMicClick = {
                                if (isListening) viewModel.stopVoiceListening() else viewModel.startVoiceListening()
                            }
                        )
                    }

                    // Expandable Quick Categories Drawer
                    if (showCategoriesDrawer) {
                        item {
                            NeuralGlassCard(
                                modifier = Modifier.fillMaxWidth(),
                                borderColor = IceBlue.copy(alpha = 0.45f)
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        text = "DISCOVER CATEGORIES",
                                        color = IceBlueBright,
                                        fontSize = 10.5.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        AM_PLAYER_CATEGORIES.forEach { (label, query, mode) ->
                                            FilterChip(
                                                selected = false,
                                                onClick = {
                                                    queryText = query
                                                    activeTab = 0
                                                    showCategoriesDrawer = false
                                                    viewModel.searchYouTube(query, mode)
                                                },
                                                label = { Text(label, fontSize = 11.sp) },
                                                colors = FilterChipDefaults.filterChipColors(
                                                    containerColor = ObsidianGlass,
                                                    labelColor = MetallicSilverLight
                                                )
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2. SEARCH BAR + MODE CHIPS + HISTORY
                    item {
                        NeuralGlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            borderColor = ObsidianGlassBorder
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedTextField(
                                        value = queryText,
                                        onValueChange = { queryText = it },
                                        placeholder = {
                                            Text(
                                                text = stringResource(R.string.youtube_search_placeholder),
                                                color = MetallicSilverMuted,
                                                fontSize = 12.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        },
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                                        keyboardActions = KeyboardActions(
                                            onSearch = {
                                                if (queryText.isNotBlank()) {
                                                    activeTab = 0
                                                    viewModel.searchOrPlayYouTubeInput(queryText, state.mode)
                                                }
                                            }
                                        ),
                                        trailingIcon = {
                                            if (queryText.isNotEmpty()) {
                                                IconButton(onClick = { queryText = "" }) {
                                                    Icon(Icons.Default.Close, contentDescription = "Clear", tint = MetallicSilverMuted)
                                                }
                                            }
                                        },
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = IceBlueBright,
                                            unfocusedBorderColor = ObsidianGlassBorder,
                                            focusedTextColor = MetallicSilverLight,
                                            unfocusedTextColor = MetallicSilverLight
                                        ),
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("youtube_search_field")
                                    )

                                    Button(
                                        onClick = {
                                            if (queryText.isNotBlank()) {
                                                activeTab = 0
                                                viewModel.searchOrPlayYouTubeInput(queryText, state.mode)
                                            }
                                        },
                                        enabled = queryText.isNotBlank() && !state.isSearching,
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = IceBlueBright,
                                            contentColor = ObsidianBlack
                                        ),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
                                        modifier = Modifier
                                            .defaultMinSize(minHeight = 52.dp)
                                            .testTag("youtube_search_submit_btn")
                                    ) {
                                        if (state.isSearching) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(18.dp),
                                                color = ObsidianBlack,
                                                strokeWidth = 2.dp
                                            )
                                        } else {
                                            Icon(Icons.Default.Search, contentDescription = stringResource(R.string.youtube_search_action))
                                        }
                                    }
                                }

                                // Category Filter Chips
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    YouTubeSearchMode.entries.forEach { mode ->
                                        val selected = state.mode == mode
                                        FilterChip(
                                            selected = selected,
                                            onClick = {
                                                viewModel.setYouTubeSearchMode(mode)
                                                if (queryText.isNotBlank()) {
                                                    viewModel.searchYouTube(queryText, mode)
                                                }
                                            },
                                            label = {
                                                Text(
                                                    text = mode.label,
                                                    fontSize = 11.sp,
                                                    fontFamily = FontFamily.Monospace
                                                )
                                            },
                                            colors = FilterChipDefaults.filterChipColors(
                                                selectedContainerColor = IceBlue.copy(alpha = 0.25f),
                                                selectedLabelColor = IceBlueBright,
                                                labelColor = MetallicSilverMuted
                                            ),
                                            modifier = Modifier.testTag("youtube_mode_${mode.apiValue}")
                                        )
                                    }
                                }

                                // Recent Search Chips
                                if (state.searchHistory.isNotEmpty()) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .horizontalScroll(rememberScrollState()),
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        state.searchHistory.take(6).forEach { hist ->
                                            OutlinedButton(
                                                onClick = {
                                                    queryText = hist
                                                    activeTab = 0
                                                    viewModel.searchYouTube(hist, state.mode)
                                                },
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                                border = BorderStroke(1.dp, ObsidianGlassBorder),
                                                modifier = Modifier.defaultMinSize(minHeight = 40.dp)
                                            ) {
                                                Text(hist, color = MetallicSilver, fontSize = 11.sp)
                                            }
                                        }
                                        TextButton(onClick = { viewModel.clearYouTubeSearchHistory() }) {
                                            Text(stringResource(R.string.youtube_clear_history), color = AlertCrimson, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 3. NOW PLAYING & FULL TRANSPORT DECK (WITH SPEED, FAVORITE, PLAYLIST)
                    item {
                        NeuralGlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            borderColor = IceBlue.copy(alpha = 0.35f)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                val current = state.currentVideo
                                val isFav = current != null && favoriteIds.contains(current.videoId)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "${state.status.name} • ${
                                                if (state.queue.isNotEmpty()) "${state.currentIndex + 1}/${state.queue.size}" else "STANDBY"
                                            }",
                                            color = IceBlueBright,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = current?.title ?: stringResource(R.string.youtube_no_video_selected),
                                            color = MetallicSilverLight,
                                            fontSize = 13.5.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (current != null) {
                                            val views = YouTubeRepository.formatCompactCount(current.viewCount)
                                            val meta = buildString {
                                                append(current.channelTitle)
                                                if (current.durationText.isNotBlank()) append(" • ${current.durationText}")
                                                if (views != null) append(" • $views views")
                                            }
                                            Text(
                                                text = meta,
                                                color = MetallicSilverMuted,
                                                fontSize = 11.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }

                                    if (current != null) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            IconButton(
                                                onClick = { viewModel.toggleFavoriteVideo(current) },
                                                modifier = Modifier
                                                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                                    .testTag("am_player_favorite_btn")
                                            ) {
                                                Icon(
                                                    imageVector = if (isFav) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                                    contentDescription = "Favorite",
                                                    tint = if (isFav) Color(0xFFF472B6) else MetallicSilverMuted
                                                )
                                            }
                                            IconButton(
                                                onClick = { playlistTargetItem = current },
                                                modifier = Modifier
                                                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                                    .testTag("am_player_add_playlist_btn")
                                            ) {
                                                Icon(
                                                    imageVector = Icons.AutoMirrored.Filled.PlaylistAdd,
                                                    contentDescription = "Add to playlist",
                                                    tint = IceBlueBright
                                                )
                                            }
                                            IconButton(
                                                onClick = { openExternalUrl(current.watchUrl) },
                                                modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                                                    contentDescription = stringResource(R.string.youtube_open_external),
                                                    tint = IceBlueBright
                                                )
                                            }
                                        }
                                    }
                                }

                                val progress = if (state.durationSec > 0) {
                                    (state.currentTimeSec.toFloat() / state.durationSec.toFloat()).coerceIn(0f, 1f)
                                } else 0f
                                LinearProgressIndicator(
                                    progress = { progress },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(5.dp)
                                        .clip(RoundedCornerShape(4.dp)),
                                    color = IceBlueBright,
                                    trackColor = ObsidianGlassBorder
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = YouTubeRepository.formatDuration(state.currentTimeSec),
                                        color = MetallicSilverMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        text = YouTubeRepository.formatDuration(state.durationSec),
                                        color = MetallicSilverMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }

                                // Transport Deck
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceEvenly,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    IconButton(
                                        onClick = { viewModel.playPreviousYouTubeVideo() },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .testTag("youtube_prev_btn")
                                    ) {
                                        Icon(Icons.Default.SkipPrevious, contentDescription = stringResource(R.string.youtube_prev_track), tint = MetallicSilverLight)
                                    }
                                    IconButton(
                                        onClick = { viewModel.seekYouTubeBy(-10) },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .testTag("youtube_rewind_btn")
                                    ) {
                                        Icon(Icons.Default.Replay10, contentDescription = stringResource(R.string.youtube_rewind_10), tint = MetallicSilverLight)
                                    }
                                    IconButton(
                                        onClick = {
                                            if (state.status == YouTubePlaybackStatus.PLAYING) {
                                                viewModel.pauseYouTube()
                                            } else {
                                                viewModel.playYouTube()
                                            }
                                        },
                                        modifier = Modifier
                                            .size(52.dp)
                                            .background(IceBlueBright, CircleShape)
                                            .testTag("youtube_play_pause_btn")
                                    ) {
                                        Icon(
                                            imageVector = if (state.status == YouTubePlaybackStatus.PLAYING) Icons.Default.Pause else Icons.Default.PlayArrow,
                                            contentDescription = stringResource(R.string.youtube_play_pause_desc),
                                            tint = ObsidianBlack
                                        )
                                    }
                                    IconButton(
                                        onClick = { viewModel.seekYouTubeBy(10) },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .testTag("youtube_forward_btn")
                                    ) {
                                        Icon(Icons.Default.Forward10, contentDescription = stringResource(R.string.youtube_forward_10), tint = MetallicSilverLight)
                                    }
                                    IconButton(
                                        onClick = { viewModel.playNextYouTubeVideo() },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .testTag("youtube_next_btn")
                                    ) {
                                        Icon(Icons.Default.SkipNext, contentDescription = stringResource(R.string.youtube_next_track), tint = MetallicSilverLight)
                                    }
                                    IconButton(
                                        onClick = { viewModel.stopYouTube() },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .testTag("youtube_stop_btn")
                                    ) {
                                        Icon(Icons.Default.Stop, contentDescription = stringResource(R.string.youtube_stop_desc), tint = QuantumGold)
                                    }
                                }

                                // Playback Speed Chips
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .horizontalScroll(rememberScrollState()),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "SPEED:",
                                        color = MetallicSilverMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    AM_PLAYER_SPEEDS.forEach { spd ->
                                        val activeSpd = abs(state.playbackRate - spd) < 0.05f
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(if (activeSpd) IceBlueBright else ObsidianGlass)
                                                .border(
                                                    1.dp,
                                                    if (activeSpd) IceBlueBright else ObsidianGlassBorder,
                                                    RoundedCornerShape(8.dp)
                                                )
                                                .clickable { viewModel.setYouTubePlaybackSpeed(spd) }
                                                .padding(horizontal = 10.dp, vertical = 6.dp)
                                                .testTag("am_player_speed_${spd}x")
                                        ) {
                                            Text(
                                                text = "${spd}x",
                                                color = if (activeSpd) ObsidianBlack else MetallicSilverLight,
                                                fontSize = 10.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }
                                }

                                // Volume & Mute
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    IconButton(
                                        onClick = { viewModel.toggleYouTubeMute() },
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                            .testTag("youtube_mute_btn")
                                    ) {
                                        Icon(
                                            imageVector = if (state.isMuted || state.volume == 0) {
                                                Icons.AutoMirrored.Filled.VolumeOff
                                            } else {
                                                Icons.AutoMirrored.Filled.VolumeUp
                                            },
                                            contentDescription = stringResource(R.string.youtube_mute_desc),
                                            tint = if (state.isMuted) QuantumGold else IceBlueBright
                                        )
                                    }
                                    IconButton(
                                        onClick = { viewModel.adjustYouTubeVolume(-10) },
                                        modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                    ) {
                                        Icon(Icons.AutoMirrored.Filled.VolumeDown, contentDescription = stringResource(R.string.youtube_vol_down), tint = MetallicSilver)
                                    }
                                    Slider(
                                        value = (if (state.isMuted) 0 else state.volume).toFloat(),
                                        onValueChange = { viewModel.setYouTubeVolume(it.toInt()) },
                                        valueRange = 0f..100f,
                                        colors = SliderDefaults.colors(
                                            thumbColor = IceBlueBright,
                                            activeTrackColor = IceBlueBright,
                                            inactiveTrackColor = ObsidianGlassBorder
                                        ),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = if (state.isMuted) "MUTE" else "${state.volume}%",
                                        color = IceBlueBright,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        modifier = Modifier.width(42.dp)
                                    )
                                }

                                state.lastFeedback?.let { fb ->
                                    Text(
                                        text = fb,
                                        color = SentinelEmerald,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }

                    // 4. 6-TAB BAR (Results, Related, Queue, Favorites, Playlists, History)
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            val tabs = listOf(
                                0 to "RESULTS (${state.searchResults.size})",
                                1 to "RELATED (${state.relatedVideos.size})",
                                2 to "QUEUE (${state.queue.size})",
                                3 to "FAVES (${state.favorites.size})",
                                4 to "PLAYLISTS (${state.playlists.size})",
                                5 to "HISTORY (${state.recentlyPlayed.size})"
                            )
                            tabs.forEach { (idx, label) ->
                                val selected = activeTab == idx
                                OutlinedButton(
                                    onClick = { activeTab = idx },
                                    border = BorderStroke(1.dp, if (selected) IceBlueBright else ObsidianGlassBorder),
                                    colors = ButtonDefaults.outlinedButtonColors(
                                        containerColor = if (selected) IceBlue.copy(alpha = 0.2f) else ObsidianGlass
                                    ),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                    modifier = Modifier
                                        .defaultMinSize(minHeight = 44.dp)
                                        .testTag("am_player_tab_$idx")
                                ) {
                                    Text(
                                        text = label,
                                        color = if (selected) IceBlueBright else MetallicSilverLight,
                                        fontSize = 10.5.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    // Error banner on Results tab
                    if (activeTab == 0 && !state.errorMessage.isNullOrBlank() && state.searchResults.isEmpty()) {
                        item {
                            NeuralGlassCard(
                                modifier = Modifier.fillMaxWidth(),
                                borderColor = QuantumGold.copy(alpha = 0.55f)
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(
                                        text = state.errorMessage ?: "",
                                        color = QuantumGold,
                                        fontSize = 12.sp
                                    )
                                    state.fallbackUrl?.let { url ->
                                        Button(
                                            onClick = { openExternalUrl(url) },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = QuantumGold,
                                                contentColor = ObsidianBlack
                                            ),
                                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                        ) {
                                            Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(stringResource(R.string.youtube_open_search_browser), fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Tab 4: Playlists view
                    if (activeTab == 4) {
                        if (state.playlists.isEmpty()) {
                            item {
                                NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = ObsidianGlassBorder) {
                                    Text(
                                        text = "No saved playlists yet. Tap the playlist (+) icon on any video to save it to a custom playlist.",
                                        color = MetallicSilverMuted,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        } else {
                            itemsIndexed(state.playlists, key = { _, pl -> "pl_${pl.id}" }) { _, playlist ->
                                NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = IceBlue.copy(alpha = 0.3f)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Icon(Icons.AutoMirrored.Filled.PlaylistPlay, contentDescription = null, tint = IceBlueBright)
                                            Column {
                                                Text(playlist.name, color = MetallicSilverLight, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                                Text("${playlist.items.size} video(s)", color = MetallicSilverMuted, fontSize = 11.sp)
                                            }
                                        }
                                        Row {
                                            if (playlist.items.isNotEmpty()) {
                                                TextButton(onClick = { viewModel.playYouTubeFromResults(playlist.items, 0) }) {
                                                    Text("PLAY ALL", color = IceBlueBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                                }
                                            }
                                            IconButton(onClick = { viewModel.deleteMediaPlaylist(playlist.name) }) {
                                                Icon(Icons.Default.Delete, contentDescription = "Delete playlist", tint = AlertCrimson)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Video List tabs: 0=Results, 1=Related, 2=Queue, 3=Favorites, 5=History
                        val displayedList = when (activeTab) {
                            0 -> state.searchResults
                            1 -> state.relatedVideos
                            2 -> state.queue
                            3 -> state.favorites
                            5 -> state.recentlyPlayed
                            else -> state.searchResults
                        }

                        if (activeTab == 5 && state.recentlyPlayed.isNotEmpty()) {
                            item {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                    TextButton(onClick = { viewModel.clearMediaHistory() }) {
                                        Text("Clear Watch History", color = AlertCrimson, fontSize = 11.sp)
                                    }
                                }
                            }
                        }

                        if (displayedList.isEmpty() && !(activeTab == 0 && !state.errorMessage.isNullOrBlank())) {
                            item {
                                NeuralGlassCard(
                                    modifier = Modifier.fillMaxWidth(),
                                    borderColor = ObsidianGlassBorder
                                ) {
                                    Text(
                                        text = when (activeTab) {
                                            0 -> stringResource(R.string.youtube_empty_results)
                                            1 -> "Play a video to discover related recommendations."
                                            2 -> stringResource(R.string.youtube_empty_queue)
                                            3 -> "No favorite videos saved yet. Tap the heart icon on any video."
                                            5 -> "Your recently played watch history is empty."
                                            else -> ""
                                        },
                                        color = MetallicSilverMuted,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        } else {
                            itemsIndexed(displayedList, key = { idx, item -> "${activeTab}_${item.videoId}_$idx" }) { idx, item ->
                                val isPlayingThis = state.currentVideo?.videoId == item.videoId
                                YouTubeVideoRow(
                                    index = idx,
                                    item = item,
                                    isActive = isPlayingThis,
                                    isFavorite = favoriteIds.contains(item.videoId),
                                    onSelect = {
                                        if (activeTab == 2) {
                                            viewModel.selectYouTubeQueueIndex(idx)
                                        } else {
                                            viewModel.playYouTubeFromResults(displayedList, idx)
                                        }
                                    },
                                    onToggleFavorite = { viewModel.toggleFavoriteVideo(item) },
                                    onAddToPlaylist = { playlistTargetItem = item },
                                    onOpenExternal = { openExternalUrl(item.watchUrl) }
                                )
                            }
                        }
                    }

                    // Pagination Bar (Results Tab)
                    if (activeTab == 0 && (state.prevPageToken != null || state.nextPageToken != null)) {
                        item {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp, bottom = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                OutlinedButton(
                                    onClick = {
                                        state.prevPageToken?.let { token ->
                                            viewModel.searchYouTube(state.query, state.mode, pageToken = token)
                                        }
                                    },
                                    enabled = state.prevPageToken != null && !state.isSearching,
                                    border = BorderStroke(1.dp, IceBlue.copy(alpha = 0.5f)),
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Text(stringResource(R.string.youtube_prev_page), color = IceBlueBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                }
                                OutlinedButton(
                                    onClick = {
                                        state.nextPageToken?.let { token ->
                                            viewModel.searchYouTube(state.query, state.mode, pageToken = token)
                                        }
                                    },
                                    enabled = state.nextPageToken != null && !state.isSearching,
                                    border = BorderStroke(1.dp, tokens.accent.copy(alpha = 0.5f)),
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Text(stringResource(R.string.youtube_next_page), color = tokens.accentBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Add-to-Playlist Dialog
    playlistTargetItem?.let { item ->
        AlertDialog(
            onDismissRequest = { playlistTargetItem = null },
            containerColor = tokens.surfaceBg,
            title = { Text("ADD TO PLAYLIST", color = IceBlueBright, fontFamily = FontFamily.Monospace, fontSize = 14.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(item.title, color = MetallicSilverLight, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (state.playlists.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            state.playlists.forEach { pl ->
                                OutlinedButton(
                                    onClick = {
                                        viewModel.addToMediaPlaylist(pl.name, item)
                                        playlistTargetItem = null
                                    },
                                    border = BorderStroke(1.dp, ObsidianGlassBorder),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("${pl.name} (${pl.items.size})", color = MetallicSilverLight, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        value = newPlaylistName,
                        onValueChange = { newPlaylistName = it },
                        placeholder = { Text("New playlist name...", fontSize = 12.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newPlaylistName.isNotBlank()) {
                            viewModel.addToMediaPlaylist(newPlaylistName, item)
                            newPlaylistName = ""
                            playlistTargetItem = null
                        }
                    },
                    enabled = newPlaylistName.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = IceBlueBright, contentColor = ObsidianBlack)
                ) {
                    Text("CREATE & ADD", fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            },
            dismissButton = {
                TextButton(onClick = { playlistTargetItem = null }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            }
        )
    }
}

@Composable
private fun AmPlayerHeroCard(
    isListening: Boolean,
    onTrendingClick: () -> Unit,
    onPopularClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onFavoritesClick: () -> Unit,
    onCategoriesClick: () -> Unit,
    onMicClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF08142B), Color(0xFF040917), Color(0xFF0A1B38))
                )
            )
            .border(1.2.dp, IceBlue.copy(alpha = 0.55f), RoundedCornerShape(18.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.img_am_player_avatar),
                    contentDescription = "AM Player Cosmic AI Avatar",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.5.dp, IceBlueBright.copy(alpha = 0.7f), RoundedCornerShape(14.dp))
                )
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "COSMIC MEDIA ENGINE",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.2.sp
                    )
                    Text(
                        text = "Hello Sir, welcome in. How are you?",
                        color = MetallicSilverLight,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.clickable { onMicClick() }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(if (isListening) AlertCrimson else SentinelEmerald, CircleShape)
                        )
                        Text(
                            text = if (isListening) "Listening for command..." else "Tap mic or say \"AM Player kholo\"",
                            color = if (isListening) AlertCrimson else MetallicSilverMuted,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            // 5 Quick Discovery Tiles
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                AmHeroTile("Trending", Icons.Default.LocalFireDepartment, Color(0xFFF43F5E), Modifier.weight(1f), onTrendingClick)
                AmHeroTile("Popular", Icons.Default.Star, QuantumGold, Modifier.weight(1f), onPopularClick)
                AmHeroTile("History", Icons.Default.History, IceBlueBright, Modifier.weight(1f), onHistoryClick)
                AmHeroTile("Faves", Icons.Default.Favorite, Color(0xFFEC4899), Modifier.weight(1f), onFavoritesClick)
                AmHeroTile("Topics", Icons.Default.GridView, Color(0xFF818CF8), Modifier.weight(1f), onCategoriesClick)
            }
        }
    }
}

@Composable
private fun AmHeroTile(
    label: String,
    icon: ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0A1326))
            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(imageVector = icon, contentDescription = label, tint = tint, modifier = Modifier.size(18.dp))
        Text(
            text = label,
            color = MetallicSilverLight,
            fontSize = 9.5.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            maxLines = 1
        )
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun SafeWebBrowserSection(
    urlInput: String,
    onUrlInputChange: (String) -> Unit,
    activePreviewUrl: String?,
    errorMessage: String?,
    onRequestOpenUrl: (String, String) -> Unit,
    onOpenExternal: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val tokens = LocalJarvisTokens.current
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Security, contentDescription = null, tint = SentinelEmerald, modifier = Modifier.size(16.dp))
                        Text(
                            text = stringResource(R.string.youtube_browser_title),
                            color = tokens.accentBright,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = urlInput,
                            onValueChange = onUrlInputChange,
                            placeholder = {
                                Text(
                                    stringResource(R.string.youtube_browser_placeholder),
                                    color = tokens.textMuted,
                                    fontSize = 12.sp
                                )
                            },
                            singleLine = true,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("safe_browser_url_input"),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = tokens.accentBright,
                                unfocusedBorderColor = tokens.glassBorder,
                                focusedTextColor = tokens.textPrimary,
                                unfocusedTextColor = tokens.textPrimary
                            )
                        )
                        Button(
                            onClick = { onRequestOpenUrl("Custom HTTPS URL", urlInput) },
                            colors = ButtonDefaults.buttonColors(containerColor = tokens.accentBright, contentColor = tokens.screenBg),
                            modifier = Modifier
                                .defaultMinSize(minHeight = 52.dp)
                                .testTag("safe_browser_launch_btn")
                        ) {
                            Text("GO", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        }
                    }
                    errorMessage?.let { err ->
                        Text(err, color = AlertCrimson, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }

        if (!activePreviewUrl.isNullOrBlank()) {
            item {
                NeuralGlassCard(modifier = Modifier.fillMaxWidth(), borderColor = tokens.accent.copy(alpha = 0.55f)) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = activePreviewUrl,
                                color = tokens.accentBright,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = { onOpenExternal(activePreviewUrl) }) {
                                Text("OPEN EXTERNAL", color = SentinelEmerald, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                        AndroidView(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(340.dp)
                                .clip(RoundedCornerShape(12.dp)),
                            factory = { ctx ->
                                WebView(ctx).apply {
                                    settings.javaScriptEnabled = true
                                    settings.domStorageEnabled = true
                                    webViewClient = WebViewClient()
                                    loadUrl(activePreviewUrl)
                                }
                            },
                            update = { wv ->
                                if (wv.url != activePreviewUrl) wv.loadUrl(activePreviewUrl)
                            }
                        )
                    }
                }
            }
        }

        item {
            Text(
                text = "APPROVED SAFE DIRECTORY (${AutomationRepository.APPROVED_WEBSITES.size})",
                color = tokens.textMuted,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        itemsIndexed(AutomationRepository.APPROVED_WEBSITES, key = { _, site -> site.id }) { idx, site: SafeWebsiteEntry ->
            NeuralGlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onRequestOpenUrl(site.name, site.url) }
                    .testTag("approved_site_${site.id}_$idx")
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Language, contentDescription = site.name, tint = tokens.accentBright, modifier = Modifier.size(20.dp))
                        Column {
                            Text(site.name, color = tokens.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("${site.category} • ${site.description}", color = tokens.textMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open ${site.name}", tint = tokens.accentBright, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

@Composable
private fun YouTubeVideoRow(
    index: Int,
    item: YouTubeVideoItem,
    isActive: Boolean,
    isFavorite: Boolean,
    onSelect: () -> Unit,
    onToggleFavorite: () -> Unit,
    onAddToPlaylist: () -> Unit,
    onOpenExternal: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (isActive) IceBlue.copy(alpha = 0.16f) else ObsidianGlass)
            .border(
                1.dp,
                if (isActive) IceBlueBright.copy(alpha = 0.7f) else ObsidianGlassBorder,
                RoundedCornerShape(12.dp)
            )
            .clickable { onSelect() }
            .padding(8.dp)
            .testTag("youtube_video_item_$index"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .width(104.dp)
                .height(60.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(ObsidianBlack)
        ) {
            if (item.thumbnailUrl.isNotBlank()) {
                AsyncImage(
                    model = item.thumbnailUrl,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = item.title,
                    tint = IceBlueBright,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
            if (item.durationText.isNotBlank()) {
                Text(
                    text = item.durationText,
                    color = Color.White,
                    fontSize = 9.5.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(3.dp)
                        .background(Color.Black.copy(alpha = 0.8f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "${index + 1}. ${item.title}",
                color = MetallicSilverLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = item.channelTitle,
                color = MetallicSilverMuted,
                fontSize = 10.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            val views = YouTubeRepository.formatCompactCount(item.viewCount)
            val likes = YouTubeRepository.formatCompactCount(item.likeCount)
            if (views != null || likes != null || !item.embeddable) {
                val stats = buildList {
                    if (views != null) add("$views views")
                    if (likes != null) add("$likes likes")
                    if (!item.embeddable) add("NO EMBED")
                }.joinToString(" • ")
                Text(
                    text = stats,
                    color = if (!item.embeddable) QuantumGold else IceBlueBright.copy(alpha = 0.85f),
                    fontSize = 9.5.sp,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onToggleFavorite,
                modifier = Modifier.defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
            ) {
                Icon(
                    imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = "Toggle Favorite",
                    tint = if (isFavorite) Color(0xFFF472B6) else MetallicSilverMuted,
                    modifier = Modifier.size(18.dp)
                )
            }
            IconButton(
                onClick = onAddToPlaylist,
                modifier = Modifier.defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add to playlist",
                    tint = IceBlueBright,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

private class YouTubePlayerBridge(
    private val mainHandler: Handler,
    private val onStateChanged: (Int) -> Unit,
    private val onProgress: (Int, Int) -> Unit,
    private val onError: (Int) -> Unit
) {
    @JavascriptInterface
    fun onPlayerState(stateCode: Int) {
        mainHandler.post { onStateChanged(stateCode) }
    }

    @JavascriptInterface
    fun onPlayerProgress(curSec: Int, durSec: Int) {
        mainHandler.post { onProgress(curSec, durSec) }
    }

    @JavascriptInterface
    fun onPlayerError(errorCode: Int) {
        mainHandler.post { onError(errorCode) }
    }
}

@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
private fun YouTubeIFrameWebView(
    initialVideoId: String?,
    onWebViewReady: (WebView) -> Unit,
    onStateChanged: (Int) -> Unit,
    onProgress: (Int, Int) -> Unit,
    onError: (Int) -> Unit
) {
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val latestOnStateChanged by rememberUpdatedState(onStateChanged)
    val latestOnProgress by rememberUpdatedState(onProgress)
    val latestOnError by rememberUpdatedState(onError)

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            val playerBridge = YouTubePlayerBridge(
                mainHandler = mainHandler,
                onStateChanged = { latestOnStateChanged(it) },
                onProgress = { cur, dur -> latestOnProgress(cur, dur) },
                onError = { latestOnError(it) }
            )
            WebView(ctx).apply {
                setBackgroundColor(android.graphics.Color.BLACK)
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                webChromeClient = WebChromeClient()
                webViewClient = WebViewClient()
                addJavascriptInterface(playerBridge, "JarvisAndroidYT")

                val safeInitial = (initialVideoId ?: "").replace(Regex("[^A-Za-z0-9_-]"), "")
                val html = buildOfficialYouTubeIFrameHtml(safeInitial)
                loadDataWithBaseURL(
                    "https://www.youtube-nocookie.com",
                    html,
                    "text/html",
                    "UTF-8",
                    null
                )
                onWebViewReady(this)
            }
        }
    )
}

private fun buildOfficialYouTubeIFrameHtml(initialVideoId: String): String {
    return """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
          <style>
            html, body, #player { margin:0; padding:0; width:100%; height:100%; background:#000; overflow:hidden; }
          </style>
        </head>
        <body>
          <div id="player"></div>
          <script src="https://www.youtube.com/iframe_api"></script>
          <script>
            var ytPlayer = null;
            var ytReady = false;
            var queuedVideo = "$initialVideoId";
            var queuedAutoPlay = true;
            var progressTimer = null;

            function onYouTubeIframeAPIReady() {
              ytPlayer = new YT.Player('player', {
                width: '100%',
                height: '100%',
                videoId: queuedVideo || undefined,
                playerVars: {
                  autoplay: queuedVideo ? 1 : 0,
                  playsinline: 1,
                  rel: 0,
                  modestbranding: 1,
                  enablejsapi: 1
                },
                events: {
                  onReady: function() {
                    ytReady = true;
                    if (queuedVideo) {
                      if (queuedAutoPlay) ytPlayer.loadVideoById(queuedVideo);
                      else ytPlayer.cueVideoById(queuedVideo);
                    }
                    if (!progressTimer) {
                      progressTimer = setInterval(function() {
                        if (ytReady && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                          var cur = Math.floor(ytPlayer.getCurrentTime() || 0);
                          var dur = Math.floor(ytPlayer.getDuration() || 0);
                          JarvisAndroidYT.onPlayerProgress(cur, dur);
                        }
                      }, 1000);
                    }
                  },
                  onStateChange: function(e) {
                    JarvisAndroidYT.onPlayerState(e.data);
                  },
                  onError: function(e) {
                    JarvisAndroidYT.onPlayerError(e.data);
                  }
                }
              });
            }

            window.jarvisLoadVideo = function(videoId, autoPlay) {
              queuedVideo = videoId;
              queuedAutoPlay = !!autoPlay;
              if (ytReady && ytPlayer) {
                if (queuedAutoPlay) ytPlayer.loadVideoById(videoId);
                else ytPlayer.cueVideoById(videoId);
              }
            };
            window.jarvisPlay = function() { if (ytReady && ytPlayer) ytPlayer.playVideo(); };
            window.jarvisPause = function() { if (ytReady && ytPlayer) ytPlayer.pauseVideo(); };
            window.jarvisStop = function() { if (ytReady && ytPlayer) ytPlayer.stopVideo(); };
            window.jarvisSeekBy = function(delta) {
              if (ytReady && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
                var next = Math.max(0, (ytPlayer.getCurrentTime() || 0) + delta);
                ytPlayer.seekTo(next, true);
              }
            };
            window.jarvisSeekTo = function(sec) { if (ytReady && ytPlayer) ytPlayer.seekTo(Math.max(0, sec), true); };
            window.jarvisSetVolume = function(lvl) {
              if (ytReady && ytPlayer) {
                ytPlayer.unMute();
                ytPlayer.setVolume(Math.max(0, Math.min(100, lvl)));
              }
            };
            window.jarvisMute = function() { if (ytReady && ytPlayer) ytPlayer.mute(); };
            window.jarvisUnmute = function() { if (ytReady && ytPlayer) ytPlayer.unMute(); };
            window.jarvisSetPlaybackRate = function(rate) {
              if (ytReady && ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
                ytPlayer.setPlaybackRate(rate);
              }
            };
          </script>
        </body>
        </html>
    """.trimIndent()
}
