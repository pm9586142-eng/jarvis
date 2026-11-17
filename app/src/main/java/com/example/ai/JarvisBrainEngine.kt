package com.example.ai

import com.example.agents.JarvisLanguage
import com.example.data.db.ConversationEntity
import org.json.JSONObject
import kotlin.math.ceil

enum class GeminiQuotaCategory(val label: String) {
    NONE("None"),
    RPM("RPM Rate Limit"),
    TPM("TPM Token Rate Limit"),
    RPD("Daily Quota (RPD) Exhausted"),
    BILLING("Billing / Zero Quota Limit"),
    SPEND_CAP("Spend Cap Reached"),
    GENERIC_RATE_LIMIT("Gemini Rate Limit / Quota")
}

data class GeminiUpstreamError(
    val httpStatus: Int?,
    val grpcStatus: String?,
    val upstreamMessage: String,
    val retryAfterSeconds: Double?,
    val quotaMetrics: List<String>,
    val quotaIds: List<String>,
    val hasZeroQuotaLimit: Boolean,
    val errorReason: String?
)

data class GeminiErrorClassification(
    val code: String,
    val quotaCategory: GeminiQuotaCategory,
    val httpStatus: Int,
    val grpcStatus: String,
    val upstreamMessage: String,
    val retryable: Boolean,
    val retryAfterSeconds: Double?,
    val quotaMetrics: List<String>,
    val displayMessage: String
)

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

    private val AUTO_MEMORY_SIGNAL_REGEX = Regex(
        "\\b(remember|prefer|preference|always|never|from now on|call me|my name|i am|i'm|i live|i work|my job|my role|my project|our project|we are building|i'm building|i am building|my stack|my tech stack|my team|my goal|my schedule|my favorite|my favourite|i like|i hate|i use|don't use|do not use|switch to|decided to|decision|deadline|mera|meri|mere|mujhe|main|hum|yaad rakh|pasand)\\b|मेरा|मेरी|मेरे|मुझे|मैं|याद रख|पसंद",
        RegexOption.IGNORE_CASE
    )

    private val GREETING_ONLY_REGEX = Regex(
        "^(hi|hello|hey|good morning|good afternoon|good evening|namaste|jarvis|hello jarvis|hi jarvis|kaise ho|kya haal hai)[!.,?\\s]*$",
        RegexOption.IGNORE_CASE
    )

    fun shouldAutoExtractMemories(prompt: String): Boolean {
        val trimmed = prompt.trim()
        if (trimmed.length < 10) return false
        if (GREETING_ONLY_REGEX.matches(trimmed)) return false
        return AUTO_MEMORY_SIGNAL_REGEX.containsMatchIn(trimmed)
    }

    fun parseRetryDelaySeconds(rawValue: String?): Double? {
        val str = rawValue?.trim().orEmpty()
        if (str.isEmpty()) return null

        Regex("^(\\d+(?:\\.\\d+)?)\\s*ms$", RegexOption.IGNORE_CASE).matchEntire(str)?.let {
            return it.groupValues[1].toDoubleOrNull()?.div(1000.0)
        }
        Regex("^(\\d+(?:\\.\\d+)?)\\s*s(?:ec(?:ond)?s?)?$", RegexOption.IGNORE_CASE).matchEntire(str)?.let {
            return it.groupValues[1].toDoubleOrNull()
        }
        str.toDoubleOrNull()?.takeIf { it >= 0.0 }?.let { return it }

        val inline = Regex(
            "(?:retry\\s+(?:in|after)|try again in)\\s+(\\d+(?:\\.\\d+)?)\\s*(ms|s|sec|seconds|m|min|minutes)?",
            RegexOption.IGNORE_CASE
        ).find(str)
        if (inline != null) {
            val num = inline.groupValues[1].toDoubleOrNull() ?: return null
            val unit = inline.groupValues[2].lowercase()
            return when {
                unit == "ms" -> num / 1000.0
                unit == "m" || unit.startsWith("min") -> num * 60.0
                else -> num
            }
        }
        return null
    }

    fun parseUpstreamError(
        errorBody: String,
        httpCode: Int? = null,
        retryAfterHeader: String? = null
    ): GeminiUpstreamError {
        val trimmedBody = errorBody.trim()
        var resolvedCode = httpCode
        var grpcStatus: String? = null
        var upstreamMessage = trimmedBody
        var retryAfterSeconds: Double? = null
        val quotaMetrics = mutableListOf<String>()
        val quotaIds = mutableListOf<String>()
        var hasZeroQuotaLimit = false
        var errorReason: String? = null

        val firstBrace = trimmedBody.indexOf('{')
        val lastBrace = trimmedBody.lastIndexOf('}')
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            try {
                val root = JSONObject(trimmedBody.substring(firstBrace, lastBrace + 1))
                val errObj = root.optJSONObject("error") ?: root
                val parsedMsg = errObj.optString("message").takeIf { it.isNotBlank() }
                    ?: root.optString("upstreamMessage").takeIf { it.isNotBlank() }
                    ?: root.optString("error").takeIf { it.isNotBlank() && !it.startsWith("{") }
                if (!parsedMsg.isNullOrBlank()) {
                    upstreamMessage = parsedMsg.trim()
                }
                if (resolvedCode == null) {
                    val codeVal = errObj.optInt("code", -1)
                    if (codeVal in 100..599) resolvedCode = codeVal
                }
                grpcStatus = errObj.optString("status").takeIf { it.isNotBlank() }
                    ?: root.optString("upstreamGrpcStatus").takeIf { it.isNotBlank() }

                val details = errObj.optJSONArray("details")
                if (details != null) {
                    for (i in 0 until details.length()) {
                        val detail = details.optJSONObject(i) ?: continue
                        val violations = detail.optJSONArray("violations")
                        if (violations != null) {
                            for (j in 0 until violations.length()) {
                                val v = violations.optJSONObject(j) ?: continue
                                val metric = v.optString("quotaMetric").ifBlank { v.optString("subject") }.trim()
                                val quotaId = v.optString("quotaId").trim()
                                val quotaValue = v.optString("quotaValue").trim()
                                if (metric.isNotEmpty()) quotaMetrics.add(metric)
                                if (quotaId.isNotEmpty()) quotaIds.add(quotaId)
                                if (quotaValue == "0") hasZeroQuotaLimit = true
                            }
                        }
                        if (retryAfterSeconds == null && detail.has("retryDelay")) {
                            retryAfterSeconds = parseRetryDelaySeconds(detail.optString("retryDelay"))
                        }
                        if (errorReason == null && detail.has("reason")) {
                            errorReason = detail.optString("reason").takeIf { it.isNotBlank() }
                        }
                    }
                }
            } catch (_: Exception) {
                // Keep raw text when response body isn't JSON
            }
        }

        if (retryAfterSeconds == null && !retryAfterHeader.isNullOrBlank()) {
            retryAfterSeconds = parseRetryDelaySeconds(retryAfterHeader)
        }
        if (retryAfterSeconds == null && upstreamMessage.isNotBlank()) {
            retryAfterSeconds = parseRetryDelaySeconds(upstreamMessage)
        }
        if (!hasZeroQuotaLimit &&
            Regex("\\blimit\\s*:\\s*0\\b|\\bquota\\s+limit\\s+of\\s+0\\b|\\blimit\\s+is\\s+0\\b", RegexOption.IGNORE_CASE)
                .containsMatchIn(upstreamMessage)
        ) {
            hasZeroQuotaLimit = true
        }

        return GeminiUpstreamError(
            httpStatus = resolvedCode,
            grpcStatus = grpcStatus,
            upstreamMessage = upstreamMessage,
            retryAfterSeconds = retryAfterSeconds,
            quotaMetrics = quotaMetrics,
            quotaIds = quotaIds,
            hasZeroQuotaLimit = hasZeroQuotaLimit,
            errorReason = errorReason
        )
    }

    private fun buildDisplayMessage(
        httpStatus: Int?,
        label: String,
        upstreamMessage: String,
        retryAfterSeconds: Double?,
        extraNote: String = ""
    ): String {
        val statusPrefix = if (httpStatus != null) "HTTP $httpStatus • " else ""
        val cleanUpstream = upstreamMessage.trim()
        val hasRetryInText = cleanUpstream.isNotEmpty() &&
            Regex("retry\\s+(?:in|after)\\s+\\d", RegexOption.IGNORE_CASE).containsMatchIn(cleanUpstream)
        val retryNote = if (!hasRetryInText && retryAfterSeconds != null && retryAfterSeconds > 0.0) {
            " (Retry after ${ceil(retryAfterSeconds).toInt()}s)"
        } else {
            ""
        }
        val body = cleanUpstream.ifBlank { extraNote.ifBlank { label } }
        val suffix = if (extraNote.isNotBlank() && cleanUpstream.isNotBlank() && !cleanUpstream.contains(extraNote)) {
            " $extraNote"
        } else {
            ""
        }
        return "[$statusPrefix$label] $body$retryNote$suffix".trim()
    }

    fun classifyGeminiErrorDetailed(
        rawMessage: String,
        httpCode: Int? = null,
        errorBody: String? = null,
        retryAfterHeader: String? = null
    ): GeminiErrorClassification {
        val parsed = if (!errorBody.isNullOrBlank()) {
            parseUpstreamError(errorBody, httpCode, retryAfterHeader)
        } else {
            parseUpstreamError(rawMessage, httpCode, retryAfterHeader)
        }

        val msg = parsed.upstreamMessage.ifBlank { rawMessage.trim() }
        val effectiveStatus = parsed.httpStatus ?: httpCode
        val grpcStatus = parsed.grpcStatus.orEmpty().uppercase()
        val reason = parsed.errorReason.orEmpty().uppercase()
        val retryAfter = parsed.retryAfterSeconds ?: parseRetryDelaySeconds(msg)

        val combinedLower = buildList {
            add(msg)
            add(grpcStatus)
            add(reason)
            addAll(parsed.quotaMetrics)
            addAll(parsed.quotaIds)
        }.joinToString(" ").lowercase()

        val isQuotaOrRateSignal =
            effectiveStatus == 429 ||
                effectiveStatus == 402 ||
                grpcStatus == "RESOURCE_EXHAUSTED" ||
                parsed.quotaMetrics.isNotEmpty() ||
                parsed.quotaIds.isNotEmpty() ||
                Regex("\\b(quota|rate[_ -]?limit|resource[_ ]exhausted|too many requests|spend[_ -]?cap|spending limit|monthly spend|budget exceeded|requests per minute|tokens per minute|requests per day|rpm|tpm|rpd)\\b")
                    .containsMatchIn(combinedLower)

        // 1. Spend cap / budget limit (non-retryable)
        val isSpendCap = Regex(
            "\\b(spend[_ -]?cap|spending[_ -]?cap|spend[_ -]?limit|spending[_ -]?limit|monthly[_ ]?spend|budget[_ ]?(?:cap|limit|exceeded)|cost[_ ]?limit|spend_limit_exceeded|monthly_spend_cap)\\b"
        ).containsMatchIn(combinedLower)
        if (isSpendCap) {
            val status = effectiveStatus ?: 429
            return GeminiErrorClassification(
                code = "GEMINI_QUOTA_SPEND_CAP",
                quotaCategory = GeminiQuotaCategory.SPEND_CAP,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { "RESOURCE_EXHAUSTED" },
                upstreamMessage = msg,
                retryable = false,
                retryAfterSeconds = retryAfter,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    GeminiQuotaCategory.SPEND_CAP.label,
                    msg,
                    retryAfter,
                    "(Check Google AI Studio Usage & limits and project spend cap settings.)"
                )
            )
        }

        // 2. Billing / zero quota limit / free tier unavailable (non-retryable)
        val isExplicitBilling =
            effectiveStatus == 402 ||
                parsed.hasZeroQuotaLimit ||
                reason in setOf("BILLING_DISABLED", "CLOUD_BILLING_NOT_ENABLED", "FREE_TIER_NOT_AVAILABLE", "ACCOUNT_STATE_INVALID") ||
                Regex(
                    "\\b(billing[_ ]?(?:disabled|not enabled|required|account)|enable billing|free tier is not available|not available on (?:the )?free tier|upgrade to (?:a )?paid|paid tier required|payment required|delinquent|billing_disabled)\\b"
                ).containsMatchIn(combinedLower)
        if (isExplicitBilling) {
            val status = effectiveStatus ?: 429
            return GeminiErrorClassification(
                code = "GEMINI_QUOTA_BILLING",
                quotaCategory = GeminiQuotaCategory.BILLING,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { if (status == 403) "PERMISSION_DENIED" else "RESOURCE_EXHAUSTED" },
                upstreamMessage = msg,
                retryable = false,
                retryAfterSeconds = retryAfter,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    GeminiQuotaCategory.BILLING.label,
                    msg,
                    retryAfter,
                    "(Check Google AI Studio Usage & limits, project selection, and billing tier.)"
                )
            )
        }

        // 3. Authentication / Permission errors (401 / 403 non-billing)
        val lower = msg.lowercase()
        if (
            effectiveStatus == 401 ||
            effectiveStatus == 403 ||
            reason == "API_KEY_INVALID" ||
            Regex("api[_ ]?key.*invalid|permission denied|unauthorized").containsMatchIn(lower)
        ) {
            val status = effectiveStatus ?: 401
            return GeminiErrorClassification(
                code = "GEMINI_AUTH_ERROR",
                quotaCategory = GeminiQuotaCategory.NONE,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { if (status == 403) "PERMISSION_DENIED" else "UNAUTHENTICATED" },
                upstreamMessage = msg,
                retryable = false,
                retryAfterSeconds = null,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    "Gemini Auth Error",
                    msg.ifBlank { "Verify GEMINI_API_KEY in AI Studio Secrets or BACKEND_URL access token." },
                    null
                )
            )
        }

        // 4. Model not found / retired (404)
        if (
            effectiveStatus == 404 ||
            lower.contains("no longer available") ||
            lower.contains("not found for api version") ||
            (lower.contains("model") && lower.contains("not found"))
        ) {
            val status = effectiveStatus ?: 404
            return GeminiErrorClassification(
                code = "GEMINI_MODEL_NOT_FOUND",
                quotaCategory = GeminiQuotaCategory.NONE,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { "NOT_FOUND" },
                upstreamMessage = msg,
                retryable = false,
                retryAfterSeconds = null,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    "Model Not Found",
                    msg.ifBlank { "Configured Gemini model was not found." },
                    null,
                    "(JARVIS defaults to gemini-3.8-flash; update GEMINI_MODEL if overridden.)"
                )
            )
        }

        // 5. Quota / Rate Limit — distinguish RPD vs TPM vs RPM vs temporary 429
        if (isQuotaOrRateSignal) {
            val status = effectiveStatus ?: 429
            val isRpd = Regex(
                "per[_ ]?day|requestsperday|requests_per_day|daily[_ ]?(?:quota|limit|request)|\\brpd\\b|generate_requests_per_day"
            ).containsMatchIn(combinedLower)
            if (isRpd) {
                return GeminiErrorClassification(
                    code = "GEMINI_QUOTA_RPD",
                    quotaCategory = GeminiQuotaCategory.RPD,
                    httpStatus = status,
                    grpcStatus = grpcStatus.ifBlank { "RESOURCE_EXHAUSTED" },
                    upstreamMessage = msg,
                    retryable = false,
                    retryAfterSeconds = retryAfter,
                    quotaMetrics = parsed.quotaMetrics,
                    displayMessage = buildDisplayMessage(
                        status,
                        GeminiQuotaCategory.RPD.label,
                        msg,
                        retryAfter,
                        "(Check Google AI Studio Usage & limits or wait for daily quota reset.)"
                    )
                )
            }

            val isTpm = Regex(
                "tokens?[_ ]?per[_ ]?minute|tokensperminute|input_token_count|output_token_count|token_count|\\btpm\\b"
            ).containsMatchIn(combinedLower)
            if (isTpm) {
                return GeminiErrorClassification(
                    code = "GEMINI_QUOTA_TPM",
                    quotaCategory = GeminiQuotaCategory.TPM,
                    httpStatus = status,
                    grpcStatus = grpcStatus.ifBlank { "RESOURCE_EXHAUSTED" },
                    upstreamMessage = msg,
                    retryable = true,
                    retryAfterSeconds = retryAfter,
                    quotaMetrics = parsed.quotaMetrics,
                    displayMessage = buildDisplayMessage(status, GeminiQuotaCategory.TPM.label, msg, retryAfter)
                )
            }

            val isRpm = Regex(
                "requests?[_ ]?per[_ ]?minute|requestsperminute|per[_ ]?minute|\\brpm\\b"
            ).containsMatchIn(combinedLower)
            if (isRpm) {
                return GeminiErrorClassification(
                    code = "GEMINI_QUOTA_RPM",
                    quotaCategory = GeminiQuotaCategory.RPM,
                    httpStatus = status,
                    grpcStatus = grpcStatus.ifBlank { "RESOURCE_EXHAUSTED" },
                    upstreamMessage = msg,
                    retryable = true,
                    retryAfterSeconds = retryAfter,
                    quotaMetrics = parsed.quotaMetrics,
                    displayMessage = buildDisplayMessage(status, GeminiQuotaCategory.RPM.label, msg, retryAfter)
                )
            }

            return GeminiErrorClassification(
                code = "GEMINI_RATE_LIMIT",
                quotaCategory = GeminiQuotaCategory.GENERIC_RATE_LIMIT,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { "RESOURCE_EXHAUSTED" },
                upstreamMessage = msg,
                retryable = true,
                retryAfterSeconds = retryAfter,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    GeminiQuotaCategory.GENERIC_RATE_LIMIT.label,
                    msg.ifBlank { "Upstream HTTP 429 Too Many Requests returned without a detailed Google message." },
                    retryAfter
                )
            )
        }

        // 6. Temporary upstream overload / 503
        if (effectiveStatus == 503 || Regex("unavailable|overloaded|high demand").containsMatchIn(lower)) {
            val status = effectiveStatus ?: 503
            return GeminiErrorClassification(
                code = "GEMINI_UNAVAILABLE",
                quotaCategory = GeminiQuotaCategory.NONE,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { "UNAVAILABLE" },
                upstreamMessage = msg,
                retryable = true,
                retryAfterSeconds = retryAfter,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    "Gemini Temporarily Unavailable",
                    msg.ifBlank { "Upstream Gemini service is temporarily unavailable." },
                    retryAfter
                )
            )
        }

        // 7. Network / Timeout
        if (
            effectiveStatus == 504 ||
            lower.contains("timeout") ||
            lower.contains("timed out") ||
            lower.contains("unable to resolve host") ||
            lower.contains("failed to connect")
        ) {
            val status = effectiveStatus ?: 504
            return GeminiErrorClassification(
                code = "GEMINI_TIMEOUT",
                quotaCategory = GeminiQuotaCategory.NONE,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { "DEADLINE_EXCEEDED" },
                upstreamMessage = msg,
                retryable = false,
                retryAfterSeconds = null,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    "Network / Timeout",
                    msg.ifBlank { "The network link to Gemini timed out or is offline." },
                    null
                )
            )
        }

        // 8. Bad request (400)
        if (effectiveStatus == 400 || lower.contains("invalid argument")) {
            val status = effectiveStatus ?: 400
            return GeminiErrorClassification(
                code = "GEMINI_BAD_REQUEST",
                quotaCategory = GeminiQuotaCategory.NONE,
                httpStatus = status,
                grpcStatus = grpcStatus.ifBlank { "INVALID_ARGUMENT" },
                upstreamMessage = msg,
                retryable = false,
                retryAfterSeconds = null,
                quotaMetrics = parsed.quotaMetrics,
                displayMessage = buildDisplayMessage(
                    status,
                    "Invalid Request",
                    msg.ifBlank { "Gemini rejected the request payload." },
                    null
                )
            )
        }

        val status = effectiveStatus ?: 500
        return GeminiErrorClassification(
            code = "GEMINI_ERROR",
            quotaCategory = GeminiQuotaCategory.NONE,
            httpStatus = status,
            grpcStatus = grpcStatus.ifBlank { "INTERNAL" },
            upstreamMessage = msg,
            retryable = false,
            retryAfterSeconds = null,
            quotaMetrics = parsed.quotaMetrics,
            displayMessage = buildDisplayMessage(
                status,
                "Gemini API Error",
                msg.ifBlank { "HTTP $status" },
                null
            )
        )
    }

    fun classifyGeminiError(rawMessage: String, httpCode: Int? = null): String {
        return classifyGeminiErrorDetailed(rawMessage = rawMessage, httpCode = httpCode).displayMessage
    }
}
