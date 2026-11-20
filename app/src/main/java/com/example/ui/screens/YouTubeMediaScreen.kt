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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.automirrored.filled.QueueMusic
import androidx.compose.material.icons.automirrored.filled.VolumeDown
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Warning
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
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
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun YouTubeMediaScreen(viewModel: JarvisViewModel) {
    val state by viewModel.youTubeState.collectAsState()
    val isListening by viewModel.voiceManager.isListening.collectAsState()
    val context = LocalContext.current

    var queryText by remember { mutableStateOf(state.query) }
    var activeTab by remember { mutableIntStateOf(0) } // 0 = Results, 1 = Queue
    val webViewHolder = remember { mutableStateOf<WebView?>(null) }

    LaunchedEffect(state.query) {
        if (state.query.isNotBlank() && queryText.isBlank()) {
            queryText = state.query
        }
    }

    LaunchedEffect(state.searchResults.size) {
        if (state.searchResults.isNotEmpty()) {
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .testTag("youtube_media_screen")
    ) {
        // Top HUD Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ObsidianGlass)
                .border(1.dp, ObsidianGlassBorder)
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
                    tint = IceBlueBright
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.youtube_media_title),
                    color = IceBlueBright,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.4.sp
                )
                Text(
                    text = if (state.isBackendConfigured) {
                        stringResource(R.string.youtube_status_proxy_ready)
                    } else {
                        stringResource(R.string.youtube_status_direct_mode)
                    },
                    color = if (state.isBackendConfigured) SentinelEmerald else QuantumGold,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            IconButton(
                onClick = { viewModel.toggleYouTubeFullscreen() },
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .testTag("youtube_fullscreen_btn")
            ) {
                Icon(
                    imageVector = if (state.isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                    contentDescription = stringResource(R.string.youtube_fullscreen_desc),
                    tint = IceBlueBright
                )
            }

            IconButton(
                onClick = {
                    if (isListening) viewModel.stopVoiceListening() else viewModel.startVoiceListening()
                },
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .background(
                        if (isListening) AlertCrimson.copy(alpha = 0.25f) else IceBlue.copy(alpha = 0.16f),
                        CircleShape
                    )
                    .testTag("youtube_voice_btn")
            ) {
                Icon(
                    imageVector = if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = stringResource(R.string.youtube_voice_search_desc),
                    tint = if (isListening) AlertCrimson else IceBlueBright
                )
            }
        }

        // Persistent Official YouTube IFrame WebView Player Stage
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (state.isFullscreen) {
                        Modifier.weight(1f)
                    } else {
                        Modifier
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, IceBlue.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
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
                        .background(ObsidianBlack.copy(alpha = 0.9f))
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

        // Scrollable controls, search, results, and queue (hidden in fullscreen mode)
        if (!state.isFullscreen) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Now Playing & Full Playback Controls Card
                item {
                    NeuralGlassCard(
                        modifier = Modifier.fillMaxWidth(),
                        borderColor = IceBlue.copy(alpha = 0.35f)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            val current = state.currentVideo
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

                            // Progress bar + timestamps
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

                            // Transport Deck (Prev, -10s, Play/Pause, +10s, Next, Stop)
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

                            // Volume & Mute Controls
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

                // YouTube Search Engine Bar + Mode Filters + History
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

                            // Search History Chips
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

                // Results vs Queue Tab Selector
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { activeTab = 0 },
                            border = BorderStroke(
                                1.dp,
                                if (activeTab == 0) IceBlueBright else ObsidianGlassBorder
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (activeTab == 0) IceBlue.copy(alpha = 0.18f) else ObsidianGlass
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("youtube_tab_results")
                        ) {
                            Icon(Icons.Default.Search, contentDescription = null, tint = IceBlueBright, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("RESULTS (${state.searchResults.size})", color = MetallicSilverLight, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }

                        OutlinedButton(
                            onClick = { activeTab = 1 },
                            border = BorderStroke(
                                1.dp,
                                if (activeTab == 1) IceBlueBright else ObsidianGlassBorder
                            ),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (activeTab == 1) IceBlue.copy(alpha = 0.18f) else ObsidianGlass
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                                .testTag("youtube_tab_queue")
                        ) {
                            Icon(Icons.AutoMirrored.Filled.QueueMusic, contentDescription = null, tint = IceBlueBright, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("QUEUE (${state.queue.size})", color = MetallicSilverLight, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }

                // Error / Setup Notice Banner when search failed or backend unset
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

                // Active List Items (Search Results or Queue)
                val displayedList = if (activeTab == 0) state.searchResults else state.queue
                if (displayedList.isEmpty() && state.errorMessage.isNullOrBlank()) {
                    item {
                        NeuralGlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            borderColor = ObsidianGlassBorder
                        ) {
                            Text(
                                text = if (activeTab == 0) {
                                    stringResource(R.string.youtube_empty_results)
                                } else {
                                    stringResource(R.string.youtube_empty_queue)
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
                            onSelect = {
                                if (activeTab == 0) {
                                    viewModel.playYouTubeFromResults(state.searchResults, idx)
                                } else {
                                    viewModel.selectYouTubeQueueIndex(idx)
                                }
                            },
                            onOpenExternal = { openExternalUrl(item.watchUrl) }
                        )
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
                                border = BorderStroke(1.dp, IceBlue.copy(alpha = 0.5f)),
                                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                            ) {
                                Text(stringResource(R.string.youtube_next_page), color = IceBlueBright, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
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
    onSelect: () -> Unit,
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
        horizontalArrangement = Arrangement.spacedBy(10.dp)
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
                fontSize = 12.5.sp,
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

        IconButton(
            onClick = onOpenExternal,
            modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = stringResource(R.string.youtube_open_external),
                tint = MetallicSilverMuted,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun YouTubeIFrameWebView(
    initialVideoId: String?,
    onWebViewReady: (WebView) -> Unit,
    onStateChanged: (Int) -> Unit,
    onProgress: (Int, Int) -> Unit,
    onError: (Int) -> Unit
) {
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val bridge = remember {
        object {
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
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            WebView(ctx).apply {
                setBackgroundColor(android.graphics.Color.BLACK)
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                webChromeClient = WebChromeClient()
                webViewClient = WebViewClient()
                addJavascriptInterface(bridge, "JarvisAndroidYT")

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
          </script>
        </body>
        </html>
    """.trimIndent()
}
