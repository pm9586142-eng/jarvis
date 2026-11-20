package com.example.media

enum class YouTubeSearchMode(val apiValue: String, val label: String) {
    VIDEO("video", "Videos"),
    MUSIC("music", "Music"),
    EDUCATION("education", "Education")
}

enum class YouTubePlaybackStatus {
    IDLE,
    LOADING,
    PLAYING,
    PAUSED,
    ENDED,
    EMBED_BLOCKED,
    ERROR
}

data class YouTubeVideoItem(
    val videoId: String,
    val title: String,
    val channelTitle: String,
    val thumbnailUrl: String = "",
    val durationText: String = "",
    val durationSeconds: Int = 0,
    val viewCount: Long? = null,
    val likeCount: Long? = null,
    val embeddable: Boolean = true,
    val watchUrl: String = "https://www.youtube.com/watch?v=$videoId",
    val embedUrl: String = "https://www.youtube.com/embed/$videoId"
)

data class YouTubeSearchResult(
    val ok: Boolean,
    val configured: Boolean,
    val query: String,
    val mode: YouTubeSearchMode,
    val items: List<YouTubeVideoItem> = emptyList(),
    val nextPageToken: String? = null,
    val prevPageToken: String? = null,
    val totalResults: Int? = null,
    val fallbackUrl: String = "",
    val reason: String? = null,
    val code: String? = null
)

sealed class YouTubePlayerAction {
    data class LoadVideo(val videoId: String, val autoPlay: Boolean = true) : YouTubePlayerAction()
    data object Play : YouTubePlayerAction()
    data object Pause : YouTubePlayerAction()
    data object Stop : YouTubePlayerAction()
    data class SeekBy(val deltaSeconds: Int) : YouTubePlayerAction()
    data class SeekTo(val seconds: Int) : YouTubePlayerAction()
    data class SetVolume(val level: Int) : YouTubePlayerAction()
    data object Mute : YouTubePlayerAction()
    data object Unmute : YouTubePlayerAction()
}

data class PendingYouTubeCommand(
    val id: Long,
    val action: YouTubePlayerAction
)

data class YouTubeMediaUiState(
    val query: String = "",
    val mode: YouTubeSearchMode = YouTubeSearchMode.VIDEO,
    val isSearching: Boolean = false,
    val isBackendConfigured: Boolean = false,
    val searchResults: List<YouTubeVideoItem> = emptyList(),
    val nextPageToken: String? = null,
    val prevPageToken: String? = null,
    val totalResults: Int? = null,
    val fallbackUrl: String? = null,
    val errorMessage: String? = null,
    val searchHistory: List<String> = emptyList(),
    val queue: List<YouTubeVideoItem> = emptyList(),
    val currentIndex: Int = -1,
    val currentVideo: YouTubeVideoItem? = null,
    val status: YouTubePlaybackStatus = YouTubePlaybackStatus.IDLE,
    val currentTimeSec: Int = 0,
    val durationSec: Int = 0,
    val volume: Int = 80,
    val isMuted: Boolean = false,
    val isFullscreen: Boolean = false,
    val lastFeedback: String? = null,
    val pendingCommand: PendingYouTubeCommand? = null
)
