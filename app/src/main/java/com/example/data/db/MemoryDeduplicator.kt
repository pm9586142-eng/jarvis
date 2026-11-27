package com.example.data.db

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class ExtractedMemoryCandidate(
    val key: String,
    val category: String,
    val content: String,
    val importance: Int
)

object MemoryDeduplicator {
    val ALLOWED_CATEGORIES = setOf(
        "PREFERENCE",
        "PROJECT",
        "INSTRUCTION",
        "TOPIC",
        "DECISION",
        "COMMAND",
        "FACT"
    )

    private val NON_ALNUM_REGEX = Regex("[^a-z0-9\\u0900-\\u097F\\u0A80-\\u0AFF\\s]")
    private val WHITESPACE_REGEX = Regex("\\s+")

    private val SECRET_PATTERNS = listOf(
        Regex("\\bAIza[0-9A-Za-z_-]{20,}\\b"),
        Regex("\\bsk-[0-9A-Za-z]{16,}\\b"),
        Regex("\\bgh[pousr]_[0-9A-Za-z]{20,}\\b"),
        Regex("\\bxox[baprs]-[0-9A-Za-z-]{10,}\\b"),
        Regex("-----BEGIN [A-Z ]*PRIVATE KEY-----"),
        Regex("\\bBearer\\s+[A-Za-z0-9._-]{20,}\\b", RegexOption.IGNORE_CASE),
        Regex("\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b"),
        Regex("\\b(?:password|passwd|passcode|pin|secret_key|api_key|private_key)\\s*(?:is|=|:)\\s*\\S{3,}", RegexOption.IGNORE_CASE),
        Regex("\\b(?:\\d[ -]*?){13,19}\\b")
    )

    fun containsSensitiveSecret(text: String): Boolean {
        val sample = text.trim()
        if (sample.isEmpty()) return false
        return SECRET_PATTERNS.any { it.containsMatchIn(sample) }
    }

    fun normalize(text: String): String {
        return text.lowercase()
            .replace(NON_ALNUM_REGEX, " ")
            .replace(WHITESPACE_REGEX, " ")
            .trim()
    }

    fun tokenize(text: String): Set<String> {
        val norm = normalize(text)
        if (norm.isEmpty()) return emptySet()
        return norm.split(" ").filter { it.length > 1 }.toSet()
    }

    fun jaccardSimilarity(a: String, b: String): Double {
        val setA = tokenize(a)
        val setB = tokenize(b)
        if (setA.isEmpty() || setB.isEmpty()) return 0.0
        val intersection = setA.count { it in setB }
        val union = setA.size + setB.size - intersection
        return if (union == 0) 0.0 else intersection.toDouble() / union.toDouble()
    }

    fun normalizeCategory(rawCategory: String): String {
        val upper = rawCategory.trim().uppercase(Locale.US)
        return if (upper in ALLOWED_CATEGORIES) upper else "FACT"
    }

    fun sanitizeCandidate(candidate: ExtractedMemoryCandidate): ExtractedMemoryCandidate? {
        val cleanKey = candidate.key.trim().take(64)
        val cleanContent = candidate.content.trim().take(260)
        if (cleanKey.isEmpty() || cleanContent.isEmpty()) return null
        if (containsSensitiveSecret("$cleanKey $cleanContent")) return null
        return ExtractedMemoryCandidate(
            key = cleanKey,
            category = normalizeCategory(candidate.category),
            content = cleanContent,
            importance = candidate.importance.coerceIn(1, 5)
        )
    }

    fun isNearDuplicate(
        candidateKey: String,
        candidateContent: String,
        existingMemories: List<MemoryEntity>
    ): Boolean {
        val candContent = normalize(candidateContent)
        val candKey = normalize(candidateKey)
        if (candContent.isEmpty()) return true
        val candCombined = "$candKey $candContent".trim()

        for (existing in existingMemories) {
            val exContent = normalize(existing.content)
            val exKey = normalize(existing.key)
            if (exContent.isEmpty()) continue

            if (candContent == exContent) return true
            if (candContent.length >= 12 &&
                exContent.length >= 12 &&
                (candContent.contains(exContent) || exContent.contains(candContent))
            ) {
                return true
            }

            if (jaccardSimilarity(candCombined, "$exKey $exContent".trim()) >= 0.62) {
                return true
            }

            if (candKey.isNotEmpty() && exKey.isNotEmpty() && candKey == exKey) {
                if (jaccardSimilarity(candContent, exContent) >= 0.45) {
                    return true
                }
            }
        }
        return false
    }

    fun findConflictingMemory(
        candidateKey: String,
        candidateCategory: String,
        candidateContent: String,
        existingMemories: List<MemoryEntity>
    ): MemoryEntity? {
        val normKey = normalize(candidateKey)
        val normCat = normalizeCategory(candidateCategory)
        val normContent = normalize(candidateContent)
        if (normKey.isEmpty() || normContent.isEmpty()) return null

        // 1. Exact key match (same key with updated value)
        existingMemories.firstOrNull { normalize(it.key) == normKey }?.let { return it }

        // 2. Semantic slot conflict within PREFERENCE / DECISION / PROJECT
        val isLangSlot = (normKey.contains("language") || normContent.contains("hindi") ||
            normContent.contains("english") || normContent.contains("hinglish") ||
            normContent.contains("gujarati") || normContent.contains("prefer "))
        if (normCat == "PREFERENCE" && isLangSlot) {
            existingMemories.firstOrNull { ex ->
                val exKey = normalize(ex.key)
                ex.category == "PREFERENCE" &&
                    (exKey.contains("language") || exKey.contains("preferred")) &&
                    (normalize(ex.content).contains("language") ||
                        normalize(ex.content).contains("hindi") ||
                        normalize(ex.content).contains("english") ||
                        normalize(ex.content).contains("hinglish") ||
                        normalize(ex.content).contains("gujarati"))
            }?.let { return it }
        }

        // 3. Same category + high key similarity
        return existingMemories.firstOrNull { ex ->
            ex.category == normCat && jaccardSimilarity(normKey, normalize(ex.key)) >= 0.72
        }
    }

    fun mergeMemoryCandidate(
        existing: MemoryEntity,
        newKey: String,
        newCategory: String,
        newContent: String,
        newImportance: Int,
        nowMillis: Long = System.currentTimeMillis()
    ): MemoryEntity {
        val cleanKey = newKey.trim().take(64).ifBlank { existing.key }
        val cleanContent = newContent.trim().take(260)
        return existing.copy(
            key = cleanKey,
            category = normalizeCategory(newCategory),
            content = cleanContent,
            importance = maxOf(existing.importance, newImportance.coerceIn(1, 5)),
            updatedAt = nowMillis
        )
    }

    fun filterUniqueCandidates(
        candidates: List<ExtractedMemoryCandidate>,
        existingMemories: List<MemoryEntity>
    ): List<ExtractedMemoryCandidate> {
        val pool = existingMemories.toMutableList()
        val accepted = mutableListOf<ExtractedMemoryCandidate>()
        for (raw in candidates) {
            val clean = sanitizeCandidate(raw) ?: continue
            if (!isNearDuplicate(clean.key, clean.content, pool)) {
                accepted.add(clean)
                pool.add(
                    MemoryEntity(
                        key = clean.key,
                        category = clean.category,
                        content = clean.content,
                        importance = clean.importance
                    )
                )
            }
            if (accepted.size >= 3) break
        }
        return accepted
    }

    fun retrieveRelevantMemories(
        query: String,
        memories: List<MemoryEntity>,
        limit: Int = 4,
        nowMillis: Long = System.currentTimeMillis(),
        minScoreThreshold: Double = 4.2
    ): List<MemoryEntity> {
        if (memories.isEmpty()) return emptyList()
        val queryTokens = tokenize(query)
        val normQuery = normalize(query)
        val dayMs = 86_400_000.0

        val scored = memories.mapNotNull { mem ->
            val textTokens = tokenize("${mem.key} ${mem.content} ${mem.category}")
            val overlap = if (queryTokens.isEmpty()) 0 else queryTokens.count { it in textTokens }
            val overlapScore = overlap * 3.2
            val exactBoost = if (normQuery.length >= 3 && normalize(mem.key).contains(normQuery)) 4.0 else 0.0
            val isCore = mem.category == "INSTRUCTION" || mem.category == "PREFERENCE"
            val alwaysCoreBoost = if (isCore) 1.8 else 0.6
            val importanceScore = mem.importance * 1.15
            val ageDays = ((nowMillis - maxOf(mem.updatedAt, mem.createdAt)).coerceAtLeast(0L)) / dayMs
            val recencyBoost = (1.5 - (ageDays / 30.0)).coerceIn(0.0, 1.5)
            val totalScore = overlapScore + exactBoost + alwaysCoreBoost + importanceScore + recencyBoost
            val passesThreshold = overlap > 0 ||
                exactBoost > 0.0 ||
                (isCore && mem.importance >= 4) ||
                totalScore >= minScoreThreshold + 2.8
            if (passesThreshold && totalScore >= minScoreThreshold) {
                mem to totalScore
            } else {
                null
            }
        }

        return scored
            .sortedWith(compareByDescending<Pair<MemoryEntity, Double>> { it.second }.thenByDescending { it.first.updatedAt })
            .take(limit)
            .map { it.first }
    }

    fun retrieveRelevantConversations(
        query: String,
        activeSessionId: String,
        sessions: List<ChatSessionEntity>,
        allMessages: List<ConversationEntity>,
        nowMillis: Long = System.currentTimeMillis(),
        limit: Int = 5
    ): List<String> {
        val lower = query.lowercase(Locale.US)
        val asksYesterday = lower.contains("yesterday") || lower.contains("kal ") || lower.endsWith(" kal") ||
            lower.contains("last session") || lower.contains("earlier") || lower.contains("previous chat")
        val queryTokens = tokenize(query)

        val cal = Calendar.getInstance().apply { timeInMillis = nowMillis }
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val todayStart = cal.timeInMillis
        val yesterdayStart = todayStart - 86_400_000L

        val sessionTitleMap = sessions.associate { it.id to it.title }
        val timeFmt = SimpleDateFormat("MMM d, HH:mm", Locale.getDefault())

        val candidates = allMessages.filter { msg ->
            msg.text.isNotBlank() &&
                !msg.isError &&
                (msg.sessionId != activeSessionId || asksYesterday)
        }

        val scored = candidates.mapNotNull { msg ->
            val inYesterdayWindow = msg.timestamp in yesterdayStart until todayStart
            if (asksYesterday && (lower.contains("yesterday") || lower.contains("kal"))) {
                val overlap = if (queryTokens.isEmpty()) 0 else queryTokens.count { it in tokenize(msg.text) }
                if (!inYesterdayWindow && overlap == 0) return@mapNotNull null
                val score = (if (inYesterdayWindow) 8.0 else 0.0) + overlap * 2.0 + (msg.timestamp / 1e13)
                msg to score
            } else {
                val msgTokens = tokenize(msg.text)
                val overlap = queryTokens.count { it in msgTokens }
                if (overlap == 0) return@mapNotNull null
                msg to (overlap * 3.0 + (if (inYesterdayWindow) 1.5 else 0.0))
            }
        }

        return scored
            .sortedByDescending { it.second }
            .take(limit)
            .map { (msg, _) ->
                val sessionTitle = sessionTitleMap[msg.sessionId] ?: "Session"
                val speaker = if (msg.role == "user") "Sir" else msg.agentName
                val dateLabel = timeFmt.format(Date(msg.timestamp))
                "[$sessionTitle • $dateLabel] $speaker: ${msg.text.replace(Regex("\\s+"), " ").trim().take(180)}"
            }
    }
}
