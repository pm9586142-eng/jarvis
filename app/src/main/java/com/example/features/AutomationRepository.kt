package com.example.features

import java.net.URI

data class SafeWebsiteEntry(
    val id: String,
    val name: String,
    val category: String,
    val url: String,
    val description: String
)

data class AutomationLogEntry(
    val id: String,
    val action: String,
    val target: String,
    val status: String,
    val timestamp: Long = System.currentTimeMillis()
)

object AutomationRepository {
    val APPROVED_WEBSITES: List<SafeWebsiteEntry> = listOf(
        SafeWebsiteEntry(
            id = "google",
            name = "Google Search",
            category = "Search",
            url = "https://www.google.com",
            description = "Web search and quick knowledge lookup"
        ),
        SafeWebsiteEntry(
            id = "wikipedia",
            name = "Wikipedia",
            category = "Knowledge",
            url = "https://en.wikipedia.org",
            description = "Free encyclopedia and topic references"
        ),
        SafeWebsiteEntry(
            id = "youtube",
            name = "YouTube",
            category = "Media",
            url = "https://www.youtube.com",
            description = "Video streaming, music, and lectures"
        ),
        SafeWebsiteEntry(
            id = "github",
            name = "GitHub",
            category = "Developer",
            url = "https://github.com",
            description = "Code repositories, issues, and documentation"
        ),
        SafeWebsiteEntry(
            id = "stackoverflow",
            name = "Stack Overflow",
            category = "Developer",
            url = "https://stackoverflow.com",
            description = "Engineering Q&A and debugging threads"
        ),
        SafeWebsiteEntry(
            id = "mdn",
            name = "MDN Web Docs",
            category = "Developer",
            url = "https://developer.mozilla.org",
            description = "Web standards and API documentation"
        ),
        SafeWebsiteEntry(
            id = "khanacademy",
            name = "Khan Academy",
            category = "Learning",
            url = "https://www.khanacademy.org",
            description = "Free STEM courses and tutorials"
        ),
        SafeWebsiteEntry(
            id = "nasa",
            name = "NASA",
            category = "Science",
            url = "https://www.nasa.gov",
            description = "Space missions, astronomy, and telemetry news"
        ),
        SafeWebsiteEntry(
            id = "wolfram",
            name = "Wolfram Alpha",
            category = "Science",
            url = "https://www.wolframalpha.com",
            description = "Computational math and scientific intelligence"
        ),
        SafeWebsiteEntry(
            id = "spotify",
            name = "Spotify Web",
            category = "Media",
            url = "https://open.spotify.com",
            description = "Music playlists and podcasts"
        )
    )

    private val BLOCKED_HOSTS = setOf(
        "169.254.169.254",
        "metadata.google.internal",
        "0.0.0.0",
        "127.0.0.1",
        "localhost"
    )

    fun validateWebsiteUrl(raw: String): Result<String> {
        val trimmed = raw.trim()
        if (trimmed.isBlank()) {
            return Result.failure(IllegalArgumentException("Enter a URL to launch."))
        }
        val candidate = if (trimmed.contains("://")) trimmed else "https://$trimmed"
        val lower = candidate.lowercase()
        if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("file:") || lower.startsWith("content:")) {
            return Result.failure(IllegalArgumentException("Unsafe URI scheme blocked for security."))
        }
        return try {
            val uri = URI(candidate)
            val scheme = uri.scheme?.lowercase().orEmpty()
            val host = uri.host?.lowercase().orEmpty()
            if (scheme != "https") {
                return Result.failure(IllegalArgumentException("Only HTTPS websites are permitted in Safe Web Launcher."))
            }
            if (host.isBlank() || !host.contains(".") || host in BLOCKED_HOSTS || host.startsWith("169.254.") || host.startsWith("10.") || host.startsWith("192.168.")) {
                return Result.failure(IllegalArgumentException("Blocked unsafe or local network host: $host"))
            }
            Result.success(candidate)
        } catch (e: Exception) {
            Result.failure(IllegalArgumentException("Malformed website URL."))
        }
    }

    fun searchApprovedWebsites(query: String): List<SafeWebsiteEntry> {
        val q = query.trim().lowercase()
        if (q.isBlank()) return APPROVED_WEBSITES
        return APPROVED_WEBSITES.filter {
            it.name.lowercase().contains(q) ||
                it.category.lowercase().contains(q) ||
                it.description.lowercase().contains(q) ||
                it.url.lowercase().contains(q)
        }
    }

    fun buildGoogleSearchUrl(query: String): String {
        val encoded = java.net.URLEncoder.encode(query.trim(), "UTF-8")
        return "https://www.google.com/search?q=$encoded"
    }
}
