package com.example.ai

import com.example.agents.JarvisLanguage
import com.example.data.db.ConversationEntity

enum class DetectedBrainLanguage(val label: String) {
    ENGLISH("English"),
    HINDI("Hindi"),
    HINGLISH("Hinglish"),
    GUJARATI("Gujarati")
}

enum class BrainIntent(val label: String) {
    CONVERSATION("Conversation"),
    FOLLOW_UP("Follow-Up"),
    CODING("Engineering & Code"),
    PLANNING("Multi-Step Planning"),
    RESEARCH("Research & Analysis"),
    SUMMARIZATION("Summarization"),
    MEMORY("Smart Memory"),
    DIAGNOSTICS("System Diagnostics")
}

data class BrainAnalysis(
    val detectedLanguage: DetectedBrainLanguage,
    val intent: BrainIntent,
    val isFollowUp: Boolean,
    val thinkingBudget: Int
)

object JarvisBrainEngine {
    const val MAX_RECENT_TURNS = 16

    private val DEVANAGARI_REGEX = Regex("[\\u0900-\\u097F]")
    private val GUJARATI_REGEX = Regex("[\\u0A80-\\u0AFF]")
    private val WORD_SPLIT_REGEX = Regex("[^a-zA-Z0-9\\u0900-\\u097F\\u0A80-\\u0AFF]+")

    private val HINGLISH_MARKERS = setOf(
        "kya", "kaise", "kaisa", "kaisi", "kyu", "kyun", "hai", "hain", "ho", "hun", "hoon",
        "mera", "meri", "mere", "tum", "aap", "apna", "mujhe", "mujhko", "batao", "bataiye",
        "samjhao", "samjha", "karo", "karna", "karke", "chahiye", "chahta", "chahti", "tha",
        "thi", "the", "nahi", "nhi", "haan", "achha", "accha", "theek", "thik", "yaad",
        "bhool", "kal", "aaj", "abhi", "phir", "fir", "bahut", "thoda", "zyada", "sahi",
        "galat", "bhai", "yaar", "krna", "banao", "likho", "dekho", "sunno", "bolo", "kaam"
    )

    private val FOLLOW_UP_PHRASES = listOf(
        "and ", "also ", "what about", "how about", "why?", "why is", "why did", "explain that",
        "explain more", "elaborate", "tell me more", "continue", "go on", "next step",
        "previous", "above", "that code", "that plan", "this error", "fix it", "update it",
        "shorten it", "summarize it", "same in", "in hindi", "in english", "in hinglish",
        "iska", "iske", "iski", "uske", "uska", "phir se", "aur batao", "ise", "usse", "ye wala", "wo wala"
    )

    private val CODING_KEYWORDS = listOf(
        "code", "kotlin", "python", "javascript", "typescript", "react", "compose", "sql",
        "api", "bug", "debug", "error", "exception", "stack trace", "function", "class",
        "algorithm", "refactor", "compile", "gradle", "regex", "endpoint", "database", "query"
    )

    private val PLANNING_KEYWORDS = listOf(
        "plan", "roadmap", "step by step", "steps", "architecture", "strategy", "schedule",
        "design", "workflow", "how to build", "how should i", "breakdown", "milestone",
        "yojana", "banaye", "kaise kare"
    )

    private val SUMMARIZE_KEYWORDS = listOf(
        "summarize", "summary", "tl;dr", "tldr", "recap", "key points", "takeaways",
        "brief me", "saaransh", "short mein"
    )

    private val RESEARCH_KEYWORDS = listOf(
        "explain", "compare", "difference between", "pros and cons", "why does",
        "what is", "how does", "research", "analyze", "analysis", "latest", "weather", "news"
    )

    private val MEMORY_KEYWORDS = listOf(
        "remember", "forget", "what do you remember", "my memories", "yaad rakh",
        "bhool ja", "update my", "saved preference"
    )

    private val DIAGNOSTICS_KEYWORDS = listOf(
        "battery", "ram", "storage", "cpu", "system health", "telemetry", "security scan", "defcon"
    )

    fun detectLanguage(prompt: String, selectedLanguage: JarvisLanguage): DetectedBrainLanguage {
        val text = prompt.trim()
        if (text.isEmpty()) {
            return when (selectedLanguage) {
                JarvisLanguage.HINDI -> DetectedBrainLanguage.HINDI
                JarvisLanguage.HINGLISH -> DetectedBrainLanguage.HINGLISH
                JarvisLanguage.GUJARATI -> DetectedBrainLanguage.GUJARATI
                JarvisLanguage.ENGLISH -> DetectedBrainLanguage.ENGLISH
            }
        }
        if (GUJARATI_REGEX.containsMatchIn(text)) return DetectedBrainLanguage.GUJARATI
        if (DEVANAGARI_REGEX.containsMatchIn(text)) {
            val hasAsciiWords = Regex("[a-zA-Z]{3,}").containsMatchIn(text)
            return if (hasAsciiWords && selectedLanguage == JarvisLanguage.HINGLISH) {
                DetectedBrainLanguage.HINGLISH
            } else {
                DetectedBrainLanguage.HINDI
            }
        }

        val tokens = text.lowercase()
            .split(WORD_SPLIT_REGEX)
            .filter { it.isNotBlank() }
        val hinglishHits = tokens.count { it in HINGLISH_MARKERS }
        if (hinglishHits >= 2 || (hinglishHits == 1 && tokens.size <= 6)) {
            return DetectedBrainLanguage.HINGLISH
        }

        return when (selectedLanguage) {
            JarvisLanguage.HINGLISH -> DetectedBrainLanguage.HINGLISH
            JarvisLanguage.HINDI -> DetectedBrainLanguage.HINDI
            JarvisLanguage.GUJARATI -> DetectedBrainLanguage.GUJARATI
            JarvisLanguage.ENGLISH -> DetectedBrainLanguage.ENGLISH
        }
    }

    fun isFollowUpQuery(prompt: String, hasHistory: Boolean): Boolean {
        if (!hasHistory) return false
        val lower = prompt.trim().lowercase()
        if (lower.isEmpty()) return false
        if (FOLLOW_UP_PHRASES.any { lower.startsWith(it) || lower.contains(" $it") }) return true
        val words = lower.split(Regex("\\s+")).filter { it.isNotBlank() }
        val pronouns = setOf("it", "this", "that", "those", "them", "they", "ise", "ye", "wo", "iska", "uska")
        return words.size <= 7 && words.any { it in pronouns }
    }

    fun detectIntent(prompt: String, hasHistory: Boolean): Pair<BrainIntent, Boolean> {
        val lower = prompt.trim().lowercase()
        val followUp = isFollowUpQuery(prompt, hasHistory)
        val intent = when {
            MEMORY_KEYWORDS.any { lower.contains(it) } -> BrainIntent.MEMORY
            SUMMARIZE_KEYWORDS.any { lower.contains(it) } -> BrainIntent.SUMMARIZATION
            CODING_KEYWORDS.any { lower.contains(it) } -> BrainIntent.CODING
            PLANNING_KEYWORDS.any { lower.contains(it) } -> BrainIntent.PLANNING
            DIAGNOSTICS_KEYWORDS.any { lower.contains(it) } -> BrainIntent.DIAGNOSTICS
            followUp -> BrainIntent.FOLLOW_UP
            RESEARCH_KEYWORDS.any { lower.contains(it) } -> BrainIntent.RESEARCH
            else -> BrainIntent.CONVERSATION
        }
        return intent to followUp
    }

    fun analyzePrompt(
        prompt: String,
        selectedLanguage: JarvisLanguage,
        hasHistory: Boolean
    ): BrainAnalysis {
        val detectedLang = detectLanguage(prompt, selectedLanguage)
        val (intent, isFollowUp) = detectIntent(prompt, hasHistory)
        val thinkingBudget = when {
            intent == BrainIntent.CODING || intent == BrainIntent.PLANNING || intent == BrainIntent.RESEARCH -> 1024
            prompt.length > 260 -> 1024
            else -> 0
        }
        return BrainAnalysis(
            detectedLanguage = detectedLang,
            intent = intent,
            isFollowUp = isFollowUp,
            thinkingBudget = thinkingBudget
        )
    }

    fun buildContextDigest(earlierHistory: List<ConversationEntity>): String {
        val valid = earlierHistory.filter { it.text.isNotBlank() && !AiRepository.isErrorConversation(it) }
        if (valid.isEmpty()) return ""
        val snippetLines = valid.takeLast(8).map { msg ->
            val role = if (msg.role == "user") "Sir" else msg.agentName
            val compact = msg.text.replace(Regex("\\s+"), " ").trim().take(120)
            "- $role: $compact"
        }
        return "Earlier Conversation Digest (${valid.size} older messages):\n" + snippetLines.joinToString("\n")
    }

    fun buildBrainDirectiveBlock(
        analysis: BrainAnalysis,
        selectedLanguage: JarvisLanguage,
        earlierDigest: String = ""
    ): String {
        val langRule = when (analysis.detectedLanguage) {
            DetectedBrainLanguage.HINGLISH ->
                "Language Mode: Hinglish. Respond naturally in Romanized Hindi-English mix matching the user's style, keeping technical terms clear and accurate."
            DetectedBrainLanguage.HINDI ->
                "Language Mode: Hindi (हिंदी). Respond clearly in natural, refined Devanagari Hindi while preserving code identifiers and technical accuracy."
            DetectedBrainLanguage.GUJARATI ->
                "Language Mode: Gujarati (ગુજરાતી). Respond clearly in polite Gujarati while preserving technical accuracy."
            DetectedBrainLanguage.ENGLISH ->
                if (selectedLanguage == JarvisLanguage.HINGLISH) {
                    "Language Mode: Hinglish/English. Match the user's English or Hinglish tone naturally."
                } else {
                    "Language Mode: Refined British-technical English. Address the owner respectfully as 'Sir'."
                }
        }

        val intentGuidance = when (analysis.intent) {
            BrainIntent.CODING ->
                "Playbook: Provide clean, production-ready code with fenced language blocks, clear reasoning, and edge-case notes."
            BrainIntent.PLANNING ->
                "Playbook: Think step-by-step and output an actionable, structured plan with concrete phases and trade-offs."
            BrainIntent.SUMMARIZATION ->
                "Playbook: Provide a crisp executive summary with bullet takeaways and open action items."
            BrainIntent.RESEARCH ->
                "Playbook: Explain clearly from fundamentals to practical implications, citing facts accurately."
            BrainIntent.FOLLOW_UP ->
                "Playbook: Resolve pronouns and references directly against the recent conversation context without asking the user to repeat themselves."
            BrainIntent.MEMORY ->
                "Playbook: Respect stored user preferences and keep memory-related answers strictly accurate."
            BrainIntent.DIAGNOSTICS ->
                "Playbook: Report grounded telemetry facts clearly; never invent unmeasured hardware metrics."
            BrainIntent.CONVERSATION ->
                "Playbook: Answer concisely and helpfully; ask a short clarifying question only if instructions are genuinely ambiguous."
        }

        return buildString {
            appendLine("[JARVIS AI BRAIN DIRECTIVE]")
            appendLine("- Detected Intent: ${analysis.intent.label}${if (analysis.isFollowUp) " (Follow-up context resolved)" else ""}")
            appendLine("- $langRule")
            appendLine("- $intentGuidance")
            if (earlierDigest.isNotBlank()) {
                appendLine()
                appendLine(earlierDigest)
            }
        }.trim()
    }

    fun classifyGeminiError(rawMessage: String, httpCode: Int? = null): String {
        val lower = rawMessage.lowercase()
        return when {
            httpCode == 401 || httpCode == 403 || lower.contains("api key") || lower.contains("unauthorized") ->
                "Sir, Gemini authentication failed. Verify your GEMINI_API_KEY in AI Studio Secrets or your BACKEND_URL access token."
            httpCode == 404 ||
                lower.contains("no longer available") ||
                lower.contains("not found for api version") ||
                (lower.contains("model") && lower.contains("not found")) ->
                "Sir, Gemini model is unavailable (${rawMessage.ifBlank { "HTTP 404" }}). JARVIS defaults to gemini-3.8-flash; update GEMINI_MODEL if overridden."
            httpCode == 429 || lower.contains("quota") || lower.contains("rate limit") || lower.contains("resource exhausted") ->
                "Sir, the Gemini neural link is temporarily rate-limited. Please retry in a few seconds."
            httpCode == 400 || lower.contains("invalid") ->
                "Sir, the request could not be processed by Gemini ($rawMessage). Try shortening the prompt or attachment."
            lower.contains("timeout") || lower.contains("unable to resolve host") || lower.contains("failed to connect") ->
                "Sir, the network link to Gemini timed out or is offline. Check connectivity and try again."
            else ->
                "Sir, Gemini API error encountered: ${rawMessage.ifBlank { "HTTP ${httpCode ?: 500}" }}"
        }
    }
}
