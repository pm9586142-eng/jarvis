package com.example.data.db

import kotlinx.coroutines.flow.first
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class MemoryCommandResult(
    val handled: Boolean,
    val replyText: String = "",
    val savedBannerSummary: String? = null,
    val savedIds: List<Long> = emptyList()
)

object MemoryCommandEngine {

    private enum class IntentType {
        RECALL_CONVERSATION,
        RECALL_MEMORIES,
        FORGET,
        UPDATE,
        SAVE
    }

    private fun detectIntent(prompt: String): IntentType? {
        val p = prompt.trim().lowercase(Locale.US)
        if (p.isEmpty()) return null

        // Yesterday / past conversation recall
        if (
            Regex("\\b(what did we (talk|discuss|chat)|yesterday|last time we spoke|earlier discussion)\\b").containsMatchIn(p) ||
            Regex("\\b(kal kya baat|pichli chat|kal humne)\\b").containsMatchIn(p)
        ) {
            return IntentType.RECALL_CONVERSATION
        }

        // Recall memories
        if (
            Regex("\\b(what do you remember|what memories|show (my )?(important )?memories|list memories|tell me what you know about me)\\b").containsMatchIn(p) ||
            Regex("\\b(kya yaad hai|meri memories|mere baare mein kya)\\b").containsMatchIn(p)
        ) {
            return IntentType.RECALL_MEMORIES
        }

        // Forget / delete memory
        if (
            Regex("^(please )?(forget|delete|remove|erase)\\b").containsMatchIn(p) ||
            Regex("\\b(bhool ja|bhul ja|hata do|delete my memory)\\b").containsMatchIn(p)
        ) {
            return IntentType.FORGET
        }

        // Update memory
        if (
            Regex("^(please )?(update|change|modify|replace) (my )?(saved )?(memory|preference|project|instruction)\\b").containsMatchIn(p) ||
            Regex("\\b(preference update|memory update|change my preferred)\\b").containsMatchIn(p)
        ) {
            return IntentType.UPDATE
        }

        // Save memory
        if (
            Regex("^(please )?(remember( that)?|save (this )?to memory|note that|keep in mind)\\b").containsMatchIn(p) ||
            Regex("\\b(yaad rakhna|yaad rakh|save kar lo)\\b").containsMatchIn(p)
        ) {
            return IntentType.SAVE
        }

        return null
    }

    private fun extractSavePayload(prompt: String): String {
        return prompt.trim()
            .replace(Regex("^(please\\s+)?(remember(\\s+that)?|save(\\s+this)?\\s+to\\s+memory|note\\s+that|keep\\s+in\\s+mind|yaad\\s+rakhna|yaad\\s+rakh)\\s*[:,-]?\\s*", RegexOption.IGNORE_CASE), "")
            .trim()
    }

    private fun inferCategoryAndKey(content: String): Pair<String, String> {
        val lower = content.lowercase(Locale.US)
        return when {
            lower.contains("prefer") || lower.contains("favorite") || lower.contains("hindi") ||
                lower.contains("english") || lower.contains("hinglish") || lower.contains("language") -> {
                val key = if (lower.contains("hindi") || lower.contains("english") || lower.contains("hinglish") || lower.contains("language")) {
                    "Preferred Language"
                } else {
                    buildShortKey(content, "User Preference")
                }
                "PREFERENCE" to key
            }
            lower.contains("project") || lower.contains("app") || lower.contains("build") -> {
                "PROJECT" to buildShortKey(content, "Active Project")
            }
            lower.contains("always") || lower.contains("never") || lower.contains("rule") || lower.contains("must") -> {
                "INSTRUCTION" to buildShortKey(content, "Standing Instruction")
            }
            lower.contains("decided") || lower.contains("decision") || lower.contains("choose") -> {
                "DECISION" to buildShortKey(content, "Key Decision")
            }
            else -> {
                "FACT" to buildShortKey(content, "Personal Fact")
            }
        }
    }

    private fun buildShortKey(content: String, fallback: String): String {
        val words = content.replace(Regex("[^a-zA-Z0-9\\u0900-\\u097F\\s]"), " ")
            .trim()
            .split(Regex("\\s+"))
            .filter { it.length > 1 }
            .take(4)
        return if (words.isEmpty()) fallback else words.joinToString(" ") { w ->
            w.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
        }.take(48)
    }

    suspend fun executeIfMemoryCommand(
        prompt: String,
        memoryDao: MemoryDao,
        chatSessionDao: ChatSessionDao,
        conversationDao: ConversationDao,
        activeSessionId: String,
        nowMillis: Long = System.currentTimeMillis()
    ): MemoryCommandResult {
        val intent = detectIntent(prompt) ?: return MemoryCommandResult(handled = false)

        if (MemoryDeduplicator.containsSensitiveSecret(prompt)) {
            return MemoryCommandResult(
                handled = true,
                replyText = "For your security, Sir, I never store passwords, PINs, API keys, tokens, private keys, or payment card numbers in Long-Term Memory."
            )
        }

        return when (intent) {
            IntentType.RECALL_CONVERSATION -> {
                val sessions = chatSessionDao.getAll().first()
                val allMessages = conversationDao.getAll().first()
                val hits = MemoryDeduplicator.retrieveRelevantConversations(
                    query = prompt,
                    activeSessionId = activeSessionId,
                    sessions = sessions,
                    allMessages = allMessages,
                    nowMillis = nowMillis,
                    limit = 6
                )
                val reply = if (hits.isEmpty()) {
                    "I checked your stored conversation history, Sir, and found no matching messages from yesterday or earlier discussions on that topic."
                } else {
                    "Here is what I found in your stored conversation history, Sir:\n\n" +
                        hits.joinToString("\n") { "- $it" }
                }
                MemoryCommandResult(handled = true, replyText = reply)
            }

            IntentType.RECALL_MEMORIES -> {
                val all = memoryDao.getAll().first()
                if (all.isEmpty()) {
                    return MemoryCommandResult(
                        handled = true,
                        replyText = "Your Memory Vault currently has no saved memories, Sir."
                    )
                }
                val wantsImportant = prompt.lowercase(Locale.US).contains("important")
                val filtered = (if (wantsImportant) all.filter { it.importance >= 4 }.ifEmpty { all } else all).take(12)
                val fmt = SimpleDateFormat("MMM d", Locale.getDefault())
                val lines = filtered.joinToString("\n") { m ->
                    "- **[${m.category}] ${m.key}** (${m.importance}/5, updated ${fmt.format(Date(m.updatedAt))}): ${m.content}"
                }
                MemoryCommandResult(
                    handled = true,
                    replyText = "Here are ${filtered.size} stored memories from your vault, Sir:\n\n$lines"
                )
            }

            IntentType.SAVE -> {
                val payload = extractSavePayload(prompt)
                val vague = payload.length < 4 || Regex("^(my |this |that )?(project details|details|it|this|that|preference|preferences)\\.?$", RegexOption.IGNORE_CASE).matches(payload)
                if (vague) {
                    return MemoryCommandResult(
                        handled = true,
                        replyText = "Could you please share the exact details you'd like me to remember, Sir? For example: \"Remember that my project uses Kotlin Compose and Gemini 2.5 Flash.\""
                    )
                }

                val (category, key) = inferCategoryAndKey(payload)
                val existing = memoryDao.getAll().first()
                val conflict = MemoryDeduplicator.findConflictingMemory(key, category, payload, existing)

                return if (conflict != null) {
                    val updated = MemoryDeduplicator.mergeMemoryCandidate(
                        existing = conflict,
                        newKey = conflict.key,
                        newCategory = category,
                        newContent = payload,
                        newImportance = 4,
                        nowMillis = nowMillis
                    )
                    memoryDao.update(updated)
                    val verified = memoryDao.getById(updated.id)
                    if (verified != null && verified.content == updated.content) {
                        MemoryCommandResult(
                            handled = true,
                            replyText = "Updated existing memory **[${verified.category}] ${verified.key}** to: \"${verified.content}\", Sir.",
                            savedBannerSummary = "Updated: ${verified.key}",
                            savedIds = listOf(verified.id)
                        )
                    } else {
                        MemoryCommandResult(
                            handled = true,
                            replyText = "Sir, I attempted to update \"${conflict.key}\", but database verification did not confirm the write."
                        )
                    }
                } else {
                    val newMem = MemoryEntity(
                        key = key,
                        category = category,
                        content = payload.take(260),
                        importance = 4,
                        createdAt = nowMillis,
                        updatedAt = nowMillis
                    )
                    val rowId = memoryDao.insert(newMem)
                    val verified = memoryDao.getById(rowId)
                    if (verified != null) {
                        MemoryCommandResult(
                            handled = true,
                            replyText = "Saved to Memory Vault under **[${verified.category}] ${verified.key}**: \"${verified.content}\", Sir.",
                            savedBannerSummary = verified.key,
                            savedIds = listOf(verified.id)
                        )
                    } else {
                        MemoryCommandResult(
                            handled = true,
                            replyText = "Sir, I could not confirm saving that memory into SQLite storage."
                        )
                    }
                }
            }

            IntentType.UPDATE -> {
                val targetContent = prompt.trim()
                    .replace(Regex("^(please\\s+)?(update|change|modify|replace)\\s+(my\\s+)?(saved\\s+)?(memory|preference|project|instruction)\\s*(to|with|as|:)?\\s*", RegexOption.IGNORE_CASE), "")
                    .trim()
                if (targetContent.length < 4 || targetContent.equals("my saved preference", true)) {
                    return MemoryCommandResult(
                        handled = true,
                        replyText = "Which saved memory or preference should I update, and to what new value, Sir? For example: \"Update my saved preference to Hinglish.\""
                    )
                }

                val existing = memoryDao.getAll().first()
                val (cat, key) = inferCategoryAndKey(targetContent)
                val conflict = MemoryDeduplicator.findConflictingMemory(key, cat, targetContent, existing)
                    ?: existing.firstOrNull { it.category == cat && MemoryDeduplicator.jaccardSimilarity("${it.key} ${it.content}", targetContent) >= 0.25 }

                if (conflict == null) {
                    val matchesByCat = existing.filter { it.category == cat }
                    return if (matchesByCat.size > 1) {
                        val list = matchesByCat.take(4).joinToString("\n") { "- ${it.key}: ${it.content}" }
                        MemoryCommandResult(
                            handled = true,
                            replyText = "Multiple $cat memories match, Sir. Please clarify which one to update:\n\n$list"
                        )
                    } else {
                        MemoryCommandResult(
                            handled = true,
                            replyText = "I couldn't find an existing matching memory to update, Sir. Say \"Remember that $targetContent\" if you want to save it as a new memory."
                        )
                    }
                }

                val updated = MemoryDeduplicator.mergeMemoryCandidate(
                    existing = conflict,
                    newKey = conflict.key,
                    newCategory = conflict.category,
                    newContent = targetContent,
                    newImportance = conflict.importance,
                    nowMillis = nowMillis
                )
                memoryDao.update(updated)
                val verified = memoryDao.getById(conflict.id)
                if (verified != null && verified.content == updated.content) {
                    MemoryCommandResult(
                        handled = true,
                        replyText = "Updated **[${verified.category}] ${verified.key}** to: \"${verified.content}\", Sir.",
                        savedBannerSummary = "Updated: ${verified.key}",
                        savedIds = listOf(verified.id)
                    )
                } else {
                    MemoryCommandResult(
                        handled = true,
                        replyText = "Sir, database verification failed while updating \"${conflict.key}\"."
                    )
                }
            }

            IntentType.FORGET -> {
                val query = prompt.trim()
                    .replace(Regex("^(please\\s+)?(forget|delete|remove|erase|bhool\\s+ja|bhul\\s+ja)\\s*(my|previous|saved|the|about)?\\s*", RegexOption.IGNORE_CASE), "")
                    .trim()
                if (query.length < 3 || query.equals("everything", true) || query.equals("all memories", true)) {
                    return MemoryCommandResult(
                        handled = true,
                        replyText = "For safety, bulk memory deletion requires confirmation in the Memory Vault or Settings screen, Sir. Or specify the exact memory to forget."
                    )
                }

                val all = memoryDao.getAll().first()
                val queryTokens = MemoryDeduplicator.tokenize(query)
                val ranked = all.map { m ->
                    val memTokens = MemoryDeduplicator.tokenize("${m.key} ${m.content} ${m.category}")
                    val score = queryTokens.count { it in memTokens }
                    m to score
                }.filter { it.second > 0 }.sortedByDescending { it.second }

                if (ranked.isEmpty()) {
                    return MemoryCommandResult(
                        handled = true,
                        replyText = "I found no stored memory matching \"$query\", Sir."
                    )
                }

                val topScore = ranked.first().second
                val tied = ranked.filter { it.second == topScore }
                if (tied.size > 1) {
                    val options = tied.take(4).joinToString("\n") { "- **[${it.first.category}] ${it.first.key}**: ${it.first.content}" }
                    return MemoryCommandResult(
                        handled = true,
                        replyText = "I found ${tied.size} matching memories, Sir. Which one would you like me to forget?\n\n$options"
                    )
                }

                val target = tied.first().first
                memoryDao.deleteById(target.id)
                val stillExists = memoryDao.getById(target.id) != null
                if (!stillExists) {
                    MemoryCommandResult(
                        handled = true,
                        replyText = "Deleted memory **[${target.category}] ${target.key}** from your vault, Sir."
                    )
                } else {
                    MemoryCommandResult(
                        handled = true,
                        replyText = "Sir, I could not confirm removal of \"${target.key}\" from the vault."
                    )
                }
            }
        }
    }
}
