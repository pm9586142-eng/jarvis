package com.example.media

import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.TimeUnit

@JsonClass(generateAdapter = true)
internal data class YouTubeVideoItemDto(
    val videoId: String? = null,
    val title: String? = null,
    val channelTitle: String? = null,
    val thumbnailUrl: String? = null,
    val durationText: String? = null,
    val durationSeconds: Int? = null,
    val viewCount: Long? = null,
    val likeCount: Long? = null,
    val embeddable: Boolean? = null,
    val watchUrl: String? = null,
    val embedUrl: String? = null
)

@JsonClass(generateAdapter = true)
internal data class YouTubeSearchResponseDto(
    val ok: Boolean? = null,
    val configured: Boolean? = null,
    val query: String? = null,
    val fallbackUrl: String? = null,
    val nextPageToken: String? = null,
    val prevPageToken: String? = null,
    val totalResults: Int? = null,
    val reason: String? = null,
    val error: String? = null,
    val code: String? = null,
    val items: List<YouTubeVideoItemDto>? = null
)

/**
 * Android YouTube Search Repository.
 * Calls the existing J.A.R.V.I.S. Express backend proxy (/api/youtube/search, /api/youtube/video/:id)
 * so YOUTUBE_API_KEY remains strictly server-side and is never embedded in the Android APK.
 */
class YouTubeRepository(
    private val backendUrlProvider: () -> String = { resolveConfiguredBackendUrl() },
    private val accessTokenProvider: () -> String = { resolveConfiguredAccessToken() }
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build()

    val isBackendConfigured: Boolean
        get() = backendUrlProvider().isNotBlank()

    suspend fun search(
        query: String,
        mode: YouTubeSearchMode = YouTubeSearchMode.VIDEO,
        pageToken: String? = null,
        maxResults: Int = 8
    ): YouTubeSearchResult = withContext(Dispatchers.IO) {
        val cleanQuery = query.trim()
        val fallbackUrl = buildFallbackYouTubeSearchUrl(cleanQuery)
        if (cleanQuery.isBlank()) {
            return@withContext YouTubeSearchResult(
                ok = false,
                configured = isBackendConfigured,
                query = "",
                mode = mode,
                fallbackUrl = fallbackUrl,
                reason = "Enter a YouTube search query or video link.",
                code = "INVALID_QUERY"
            )
        }

        val base = backendUrlProvider().trimEnd('/')
        if (base.isBlank()) {
            return@withContext YouTubeSearchResult(
                ok = false,
                configured = false,
                query = cleanQuery,
                mode = mode,
                fallbackUrl = fallbackUrl,
                reason = "Configure BACKEND_URL (your J.A.R.V.I.S. Express server with YOUTUBE_API_KEY) to load YouTube search results inside Android, or tap Open on YouTube / paste a YouTube video link.",
                code = "BACKEND_URL_UNSET"
            )
        }

        val urlBuilder = "$base/api/youtube/search".toHttpUrlOrNull()?.newBuilder()
            ?: return@withContext YouTubeSearchResult(
                ok = false,
                configured = false,
                query = cleanQuery,
                mode = mode,
                fallbackUrl = fallbackUrl,
                reason = "Invalid BACKEND_URL configuration.",
                code = "INVALID_BACKEND_URL"
            )

        urlBuilder.addQueryParameter("q", cleanQuery)
        urlBuilder.addQueryParameter("mode", mode.apiValue)
        urlBuilder.addQueryParameter("maxResults", maxResults.coerceIn(1, 15).toString())
        if (!pageToken.isNullOrBlank()) {
            urlBuilder.addQueryParameter("pageToken", pageToken.trim())
        }

        val reqBuilder = Request.Builder()
            .url(urlBuilder.build())
            .get()
            .addHeader("Accept", "application/json")

        val token = accessTokenProvider()
        if (token.isNotBlank()) {
            reqBuilder.addHeader("Authorization", "Bearer $token")
        }

        try {
            client.newCall(reqBuilder.build()).execute().use { resp ->
                val bodyStr = resp.body?.string().orEmpty()
                if (bodyStr.isBlank()) {
                    return@withContext YouTubeSearchResult(
                        ok = false,
                        configured = true,
                        query = cleanQuery,
                        mode = mode,
                        fallbackUrl = fallbackUrl,
                        reason = "YouTube backend returned an empty response (HTTP ${resp.code}).",
                        code = "HTTP_${resp.code}"
                    )
                }
                parseSearchResponseJson(bodyStr, cleanQuery, mode)
            }
        } catch (e: Exception) {
            YouTubeSearchResult(
                ok = false,
                configured = true,
                query = cleanQuery,
                mode = mode,
                fallbackUrl = fallbackUrl,
                reason = "Could not reach J.A.R.V.I.S. YouTube backend (${e.localizedMessage ?: "network error"}).",
                code = "NETWORK_ERROR"
            )
        }
    }

    companion object {
        private val moshi: Moshi = Moshi.Builder().build()
        private val searchResponseAdapter = moshi.adapter(YouTubeSearchResponseDto::class.java).lenient()
        private val VIDEO_ID_REGEX = Regex("^[A-Za-z0-9_-]{11}$")
        private val YOUTUBE_URL_ID_REGEX = Regex(
            "(?:youtube\\.com/(?:watch\\?.*v=|embed/|shorts/|live/)|youtu\\.be/)([A-Za-z0-9_-]{11})",
            RegexOption.IGNORE_CASE
        )

        private fun isUnsetSentinel(value: String): Boolean {
            return value.isBlank() ||
                value.equals("UNSET", ignoreCase = true) ||
                value.equals("NONE", ignoreCase = true) ||
                value.equals("PLACEHOLDER", ignoreCase = true)
        }

        fun resolveConfiguredBackendUrl(): String {
            return try {
                BuildConfig.BACKEND_URL.trim().takeUnless { isUnsetSentinel(it) }.orEmpty().trimEnd('/')
            } catch (_: Exception) {
                ""
            }
        }

        fun resolveConfiguredAccessToken(): String {
            return try {
                BuildConfig.APP_ACCESS_TOKEN.trim().takeUnless { isUnsetSentinel(it) }.orEmpty()
            } catch (_: Exception) {
                ""
            }
        }

        fun buildFallbackYouTubeSearchUrl(query: String): String {
            val encoded = URLEncoder.encode(query.trim(), "UTF-8")
            return "https://www.youtube.com/results?search_query=$encoded"
        }

        /**
         * Extracts a valid 11-character YouTube videoId from a pasted URL or direct ID.
         */
        fun extractVideoIdFromInput(input: String): String? {
            val trimmed = input.trim()
            if (VIDEO_ID_REGEX.matches(trimmed)) return trimmed
            return YOUTUBE_URL_ID_REGEX.find(trimmed)?.groupValues?.getOrNull(1)
        }

        fun formatCompactCount(count: Long?): String? {
            if (count == null || count < 0L) return null
            fun formatWithSuffix(value: Double, suffix: String): String {
                val base = String.format(Locale.US, "%.1f", value).removeSuffix(".0")
                return "$base$suffix"
            }
            return when {
                count >= 1_000_000_000L -> formatWithSuffix(count / 1_000_000_000.0, "B")
                count >= 1_000_000L -> formatWithSuffix(count / 1_000_000.0, "M")
                count >= 1_000L -> formatWithSuffix(count / 1_000.0, "K")
                else -> count.toString()
            }
        }

        fun formatDuration(seconds: Int): String {
            if (seconds <= 0) return "0:00"
            val hrs = seconds / 3600
            val mins = (seconds % 3600) / 60
            val secs = seconds % 60
            return if (hrs > 0) {
                String.format(Locale.US, "%d:%02d:%02d", hrs, mins, secs)
            } else {
                String.format(Locale.US, "%d:%02d", mins, secs)
            }
        }

        fun parseSearchResponseJson(
            rawJson: String,
            fallbackQuery: String,
            fallbackMode: YouTubeSearchMode
        ): YouTubeSearchResult {
            return try {
                val dto = searchResponseAdapter.fromJson(rawJson)
                    ?: throw IllegalArgumentException("Empty JSON object")
                val ok = dto.ok ?: false
                val configured = dto.configured ?: ok
                val query = dto.query?.trim().orEmpty().ifBlank { fallbackQuery }
                val fallbackUrl = dto.fallbackUrl?.trim().orEmpty()
                    .ifBlank { buildFallbackYouTubeSearchUrl(query) }
                val nextPageToken = dto.nextPageToken?.trim()?.takeIf { it.isNotBlank() && it != "null" }
                val prevPageToken = dto.prevPageToken?.trim()?.takeIf { it.isNotBlank() && it != "null" }
                val totalResults = dto.totalResults?.takeIf { it >= 0 }
                val reason = dto.reason?.trim()?.takeIf { it.isNotBlank() }
                    ?: dto.error?.trim()?.takeIf { it.isNotBlank() }
                val code = dto.code?.trim()?.takeIf { it.isNotBlank() }

                val parsedItems = dto.items.orEmpty().mapNotNull { item ->
                    val videoId = item.videoId?.trim().orEmpty()
                    if (!VIDEO_ID_REGEX.matches(videoId)) return@mapNotNull null
                    YouTubeVideoItem(
                        videoId = videoId,
                        title = item.title?.takeIf { it.isNotBlank() } ?: "Untitled YouTube Video",
                        channelTitle = item.channelTitle?.takeIf { it.isNotBlank() } ?: "YouTube",
                        thumbnailUrl = item.thumbnailUrl.orEmpty(),
                        durationText = item.durationText.orEmpty(),
                        durationSeconds = (item.durationSeconds ?: 0).coerceAtLeast(0),
                        viewCount = item.viewCount?.takeIf { it >= 0L },
                        likeCount = item.likeCount?.takeIf { it >= 0L },
                        embeddable = item.embeddable ?: true,
                        watchUrl = item.watchUrl?.trim().orEmpty()
                            .ifBlank { "https://www.youtube.com/watch?v=$videoId" },
                        embedUrl = item.embedUrl?.trim().orEmpty()
                            .ifBlank { "https://www.youtube.com/embed/$videoId" }
                    )
                }

                YouTubeSearchResult(
                    ok = ok,
                    configured = configured,
                    query = query,
                    mode = fallbackMode,
                    items = parsedItems,
                    nextPageToken = nextPageToken,
                    prevPageToken = prevPageToken,
                    totalResults = totalResults,
                    fallbackUrl = fallbackUrl,
                    reason = reason,
                    code = code
                )
            } catch (_: Exception) {
                YouTubeSearchResult(
                    ok = false,
                    configured = true,
                    query = fallbackQuery,
                    mode = fallbackMode,
                    fallbackUrl = buildFallbackYouTubeSearchUrl(fallbackQuery),
                    reason = "Unable to parse YouTube response from backend.",
                    code = "PARSE_ERROR"
                )
            }
        }
    }
}
