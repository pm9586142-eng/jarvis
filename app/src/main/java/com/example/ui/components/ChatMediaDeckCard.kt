package com.example.ui.components

import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.SmartDisplay
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.example.data.db.ConversationEntity
import com.example.media.YouTubeMediaUiState
import com.example.media.YouTubePlaybackStatus
import com.example.media.YouTubePlayerAction
import com.example.ui.theme.AtmosphericViolet
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.ObsidianSurface
import com.example.ui.theme.QuantumGold

data class ChatInlineMediaInfo(
    val videoId: String,
    val title: String,
    val channelTitle: String,
    val thumbnailUrl: String,
    val durationText: String
)

private val YT_URL_EXTRACT_REGEX = Regex(
    "(?:https?://)?(?:www\\.|m\\.)?(?:youtube\\.com/(?:watch\\?(?:[^#\\s]*&)?v=|embed/|shorts/)|youtu\\.be/)([A-Za-z0-9_-]{11})",
    RegexOption.IGNORE_CASE
)

fun resolveChatInlineMedia(message: ConversationEntity): ChatInlineMediaInfo? {
    val explicitId = message.mediaVideoId?.trim().orEmpty()
    val detectedId = if (explicitId.isNotBlank()) {
        explicitId
    } else {
        YT_URL_EXTRACT_REGEX.find(message.text)?.groupValues?.getOrNull(1).orEmpty()
    }
    if (detectedId.isBlank()) return null
    return ChatInlineMediaInfo(
        videoId = detectedId,
        title = message.mediaTitle?.takeIf { it.isNotBlank() } ?: "YouTube Video ($detectedId)",
        channelTitle = message.mediaChannel?.takeIf { it.isNotBlank() } ?: "AM Media Deck",
        thumbnailUrl = message.mediaThumbnailUrl?.takeIf { it.isNotBlank() }
            ?: "https://i.ytimg.com/vi/$detectedId/hqdefault.jpg",
        durationText = message.mediaDurationText.orEmpty()
    )
}

@Composable
fun ChatMediaDeckCard(
    media: ChatInlineMediaInfo,
    ytState: YouTubeMediaUiState,
    isInlinePlayerExpanded: Boolean,
    isFullscreenOpen: Boolean,
    onToggleInlinePlayer: () -> Unit,
    onPlayTrack: () -> Unit,
    onPause: () -> Unit,
    onToggleMute: () -> Unit,
    onOpenFullscreen: () -> Unit,
    onOpenAmPlayer: () -> Unit,
    onConsumeCommand: (Long) -> Unit,
    onPlayerStateChanged: (Int) -> Unit,
    onPlayerProgress: (Int, Int) -> Unit,
    onPlayerError: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isThisLoaded = ytState.currentVideo?.videoId == media.videoId
    val isPlaying = isThisLoaded && ytState.status == YouTubePlaybackStatus.PLAYING
    val showLiveWebView = isInlinePlayerExpanded && isThisLoaded && !isFullscreenOpen
    val progress = if (isThisLoaded && ytState.durationSec > 0) {
        (ytState.currentTimeSec.toFloat() / ytState.durationSec.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }

    val webViewHolder = remember { mutableStateOf<WebView?>(null) }
    LaunchedEffect(showLiveWebView, media.videoId, ytState.pendingCommand?.id) {
        if (!showLiveWebView) return@LaunchedEffect
        val cmd = ytState.pendingCommand ?: return@LaunchedEffect
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
        onConsumeCommand(cmd.id)
    }
    DisposableEffect(showLiveWebView) {
        onDispose {
            if (!showLiveWebView) {
                webViewHolder.value?.destroy()
                webViewHolder.value = null
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 10.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.linearGradient(
                    listOf(
                        Color(0xFF071326),
                        Color(0xFF050B18),
                        AtmosphericViolet.copy(alpha = 0.25f)
                    )
                )
            )
            .border(1.dp, IceBlue.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
            .testTag("chat_media_deck_${media.videoId}")
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .background(Color.Black)
        ) {
            if (showLiveWebView) {
                YouTubeIFrameWebView(
                    initialVideoId = media.videoId,
                    onWebViewReady = { webViewHolder.value = it },
                    onStateChanged = onPlayerStateChanged,
                    onProgress = onPlayerProgress,
                    onError = onPlayerError
                )
            } else {
                AsyncImage(
                    model = media.thumbnailUrl,
                    contentDescription = media.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable {
                            onPlayTrack()
                            if (!isInlinePlayerExpanded) onToggleInlinePlayer()
                        }
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, ObsidianBlack.copy(alpha = 0.78f))
                            )
                        )
                )
                Row(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .clip(RoundedCornerShape(24.dp))
                        .background(IceBlue)
                        .clickable {
                            onPlayTrack()
                            if (!isInlinePlayerExpanded) onToggleInlinePlayer()
                        }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play video inline",
                        tint = ObsidianBlack,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = if (isThisLoaded && isPlaying) "SHOW INLINE VIDEO" else "PLAY IN CHAT",
                        color = ObsidianBlack,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            if (media.durationText.isNotBlank() && !showLiveWebView) {
                Text(
                    text = media.durationText,
                    color = Color.White,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(ObsidianBlack.copy(alpha = 0.85f))
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                )
            }
        }

        if (isThisLoaded && ytState.durationSec > 0) {
            LinearProgressIndicator(
                progress = { progress },
                color = IceBlueBright,
                trackColor = ObsidianSurface,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.SmartDisplay,
                    contentDescription = "Media deck",
                    tint = IceBlueBright,
                    modifier = Modifier.size(16.dp)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = media.title,
                        color = Color.White,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = media.channelTitle,
                        color = MetallicSilverMuted,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier
                            .defaultMinSize(minHeight = 40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(IceBlue)
                            .clickable {
                                if (isPlaying) {
                                    onPause()
                                } else {
                                    onPlayTrack()
                                    if (!isInlinePlayerExpanded) onToggleInlinePlayer()
                                }
                            }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .testTag("chat_media_play_${media.videoId}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = ObsidianBlack,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = if (isPlaying) "PAUSE" else "PLAY",
                            color = ObsidianBlack,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    IconButton(
                        onClick = onToggleMute,
                        modifier = Modifier
                            .defaultMinSize(minWidth = 44.dp, minHeight = 44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ObsidianGlass)
                    ) {
                        Icon(
                            imageVector = if (ytState.isMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = if (ytState.isMuted) "Unmute" else "Mute",
                            tint = if (ytState.isMuted) QuantumGold else IceBlueBright,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier
                            .defaultMinSize(minHeight = 40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ObsidianGlass)
                            .border(1.dp, IceBlue.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
                            .clickable {
                                onPlayTrack()
                                onOpenFullscreen()
                            }
                            .padding(horizontal = 10.dp, vertical = 8.dp)
                            .testTag("chat_media_fullscreen_${media.videoId}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Fullscreen,
                            contentDescription = "Expand fullscreen",
                            tint = IceBlueBright,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "EXPAND",
                            color = IceBlueBright,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    IconButton(
                        onClick = onOpenAmPlayer,
                        modifier = Modifier
                            .defaultMinSize(minWidth = 44.dp, minHeight = 44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ObsidianGlass)
                            .testTag("chat_media_am_player_${media.videoId}")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                            contentDescription = "Open AM Player",
                            tint = MetallicSilverLight,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    IconButton(
                        onClick = {
                            val watchUri = Uri.parse("https://www.youtube.com/watch?v=${media.videoId}")
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, watchUri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        },
                        modifier = Modifier
                            .defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ObsidianGlass)
                    ) {
                        Icon(
                            imageVector = Icons.Default.SmartDisplay,
                            contentDescription = "Watch on YouTube app",
                            tint = IceBlue,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun FullscreenChatMediaDialog(
    media: ChatInlineMediaInfo,
    ytState: YouTubeMediaUiState,
    onPlay: () -> Unit,
    onPause: () -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToggleMute: () -> Unit,
    onConsumeCommand: (Long) -> Unit,
    onPlayerStateChanged: (Int) -> Unit,
    onPlayerProgress: (Int, Int) -> Unit,
    onPlayerError: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    val activeVideo = ytState.currentVideo
    val videoId = activeVideo?.videoId ?: media.videoId
    val title = activeVideo?.title ?: media.title
    val channel = activeVideo?.channelTitle ?: media.channelTitle
    val isPlaying = ytState.status == YouTubePlaybackStatus.PLAYING
    val webViewHolder = remember { mutableStateOf<WebView?>(null) }

    LaunchedEffect(videoId, ytState.pendingCommand?.id) {
        val cmd = ytState.pendingCommand ?: return@LaunchedEffect
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
        onConsumeCommand(cmd.id)
    }
    DisposableEffect(Unit) {
        onDispose {
            webViewHolder.value?.destroy()
            webViewHolder.value = null
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(ObsidianBlack)
                .testTag("fullscreen_media_dialog")
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianSurface)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        color = IceBlueBright,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "$channel • AM Media Deck Fullscreen",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp
                    )
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                        .testTag("close_fullscreen_media_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close fullscreen player",
                        tint = Color.White
                    )
                }
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(Color.Black)
            ) {
                YouTubeIFrameWebView(
                    initialVideoId = videoId,
                    onWebViewReady = { webViewHolder.value = it },
                    onStateChanged = onPlayerStateChanged,
                    onProgress = onPlayerProgress,
                    onError = onPlayerError
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianSurface)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onPrevious,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.SkipPrevious, contentDescription = "Previous", tint = MetallicSilverLight)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(IceBlue)
                        .clickable { if (isPlaying) onPause() else onPlay() }
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = ObsidianBlack
                    )
                    Text(
                        text = if (isPlaying) "PAUSE" else "PLAY",
                        color = ObsidianBlack,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = onNext,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.SkipNext, contentDescription = "Next", tint = MetallicSilverLight)
                }
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(
                    onClick = onToggleMute,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(
                        imageVector = if (ytState.isMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                        contentDescription = "Toggle mute",
                        tint = if (ytState.isMuted) QuantumGold else IceBlueBright
                    )
                }
            }
        }
    }
}
