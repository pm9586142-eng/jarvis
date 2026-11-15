package com.example.data.db

data class ExtractedMemoryCandidate(
    val key: String,
    val category: String,
    val content: String,
    val importance: Int
)

object MemoryDeduplicator {
    private val ALLOWED_CATEGORIES = setOf("PREFERENCE", "PROJECT", "INSTRUCTION", "FACT")
    private val NON_ALNUM_REGEX = Regex("[^a-z0-9\\s]")
    private val WHITESPACE_REGEX = Regex("\\s+")

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

    fun sanitizeCandidate(candidate: ExtractedMemoryCandidate): ExtractedMemoryCandidate? {
        val cleanKey = candidate.key.trim().take(64)
        val cleanContent = candidate.content.trim().take(260)
        if (cleanKey.isEmpty() || cleanContent.isEmpty()) return null
        val cat = candidate.category.trim().uppercase()
        val safeCat = if (cat in ALLOWED_CATEGORIES) cat else "FACT"
        val safeImp = candidate.importance.coerceIn(1, 5)
        return ExtractedMemoryCandidate(
            key = cleanKey,
            category = safeCat,
            content = cleanContent,
            importance = safeImp
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
}
