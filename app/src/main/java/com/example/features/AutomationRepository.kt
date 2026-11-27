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

    private val VOICE_SITE_ALIASES: List<Triple<List<String>, String, String>> = listOf(
        Triple(listOf("google", "गूगल"), "Google", "https://www.google.com"),
        Triple(listOf("wikipedia", "wiki", "विकिपीडिया"), "Wikipedia", "https://www.wikipedia.org"),
        Triple(listOf("github", "गिटहब"), "GitHub", "https://github.com"),
        Triple(listOf("stackoverflow", "stack overflow"), "Stack Overflow", "https://stackoverflow.com"),
        Triple(listOf("mdn", "mdn web docs"), "MDN Web Docs", "https://developer.mozilla.org"),
        Triple(listOf("khan academy"), "Khan Academy", "https://www.khanacademy.org"),
        Triple(listOf("nasa"), "NASA", "https://www.nasa.gov"),
        Triple(listOf("wolfram", "wolfram alpha"), "Wolfram Alpha", "https://www.wolframalpha.com"),
        Triple(listOf("spotify", "स्पॉटिफाई"), "Spotify", "https://open.spotify.com"),
        Triple(listOf("instagram", "insta", "इंस्टाग्राम"), "Instagram", "https://www.instagram.com"),
        Triple(listOf("flipkart", "फ्लिपकार्ट"), "Flipkart", "https://www.flipkart.com"),
        Triple(listOf("amazon", "अमेज़न", "अमेजन"), "Amazon", "https://www.amazon.in"),
        Triple(listOf("chatgpt", "chat gpt"), "ChatGPT", "https://chatgpt.com"),
        Triple(listOf("claude"), "Claude", "https://claude.ai"),
        Triple(listOf("gmail", "जीमेल"), "Gmail", "https://mail.google.com"),
        Triple(listOf("whatsapp", "whatsapp web"), "WhatsApp Web", "https://web.whatsapp.com"),
        Triple(listOf("linkedin"), "LinkedIn", "https://www.linkedin.com"),
        Triple(listOf("reddit"), "Reddit", "https://www.reddit.com"),
        Triple(listOf("irctc"), "IRCTC", "https://www.irctc.co.in")
    )

    private val INTERNAL_SCREEN_TOKENS = setOf(
        "home", "dashboard", "command center", "chat", "ai chat", "neural chat",
        "voice", "voice hud", "voice assistant", "voice matrix", "security",
        "security center", "security audit", "brain center", "multi ai", "multi ai brain",
        "control center", "media", "media control", "media player", "youtube",
        "research", "research studio", "automation", "automation hub", "multi agent",
        "telemetry", "system telemetry", "plugins", "memory", "memory vault",
        "productivity", "tasks", "reminders", "planner", "notes", "notes vault",
        "insights", "smart home", "vision", "vision scanner", "music studio",
        "orbital", "orbital game", "ultron", "openjarvis", "open jarvis",
        "diagnostics", "ecosystem diagnostics", "settings", "preferences", "models"
    )

    fun resolveWebsiteVoiceCommand(rawText: String): Pair<String, String>? {
        val cleaned = rawText
            .trim()
            .replace(Regex("^(?:(?:hey|ok|okay|hi|hello|हे|ओके)\\s+)?(?:am\\s+ai|am|jarvis|ए\\s*एम|जार्विस)[,!?:\\s-]*", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[।.!?]+$"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (cleaned.isBlank()) return null

        val enMatch = Regex("^(?:open|go\\s+to|visit|launch|navigate\\s+to)\\s+(.+)$", RegexOption.IGNORE_CASE)
            .find(cleaned)
        val indicMatch = Regex("^(.+?)\\s+(?:kholo|khol\\s+do|open\\s+karo|open\\s+kar\\s+do|खोलो|खोल\\s+दो|ओपन\\s+करो)$", RegexOption.IGNORE_CASE)
            .find(cleaned)
        val rawTarget = (enMatch?.groupValues?.getOrNull(1) ?: indicMatch?.groupValues?.getOrNull(1))
            ?.trim()
            ?.removeSuffix("website")
            ?.trim()
            ?: return null

        val lowerTarget = rawTarget.lowercase()
        if (lowerTarget in INTERNAL_SCREEN_TOKENS) return null

        for ((aliases, label, url) in VOICE_SITE_ALIASES) {
            if (aliases.any { it == lowerTarget || lowerTarget == "$it site" }) {
                return label to url
            }
        }

        // Check domain-like target (e.g. "github.com" or "example.org")
        val normalizedDomain = rawTarget
            .replace(Regex("\\s+dot\\s+", RegexOption.IGNORE_CASE), ".")
            .replace(" ", "")
        if (normalizedDomain.contains(".") && !normalizedDomain.contains("..")) {
            val valid = validateWebsiteUrl(normalizedDomain).getOrNull()
            if (valid != null) {
                return rawTarget to valid
            }
        }
        return null
    }
}
