package com.example.data.backup

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.example.data.db.ChatSessionEntity
import com.example.data.db.ConversationEntity
import com.example.data.db.MemoryDeduplicator
import com.example.data.db.MemoryEntity
import com.example.data.db.TaskEntity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

data class ImportedSessionBundle(
    val session: ChatSessionEntity,
    val messages: List<ConversationEntity>
)

data class BackupImportPreview(
    val isValid: Boolean,
    val filename: String,
    val exportedAt: String?,
    val errors: List<String>,
    val warnings: List<String>,
    val sessionsToImport: List<ImportedSessionBundle>,
    val skippedSessionsCount: Int,
    val memoriesToImport: List<MemoryEntity>,
    val duplicateMemoriesSkipped: Int,
    val tasksToImport: List<TaskEntity>,
    val skippedTasksCount: Int
) {
    val totalImportableCount: Int
        get() = sessionsToImport.size + memoriesToImport.size + tasksToImport.size
}

object JarvisBackupManager {

    const val BACKUP_SCHEMA = "jarvis_backup_v1"
    private val ALLOWED_MEMORY_CATEGORIES = setOf("PREFERENCE", "PROJECT", "INSTRUCTION", "TOPIC", "DECISION", "COMMAND", "FACT")
    private val ALLOWED_PRIORITIES = setOf("HIGH", "MEDIUM", "LOW")
    private val ALLOWED_TASK_CATEGORIES = setOf("TASK", "REMINDER", "SCHEDULE")

    fun buildTimestampSlug(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd_HHmmss", Locale.US)
        return sdf.format(Date())
    }

    fun buildJsonBackup(
        sessions: List<ChatSessionEntity>,
        messages: List<ConversationEntity>,
        memories: List<MemoryEntity>,
        tasks: List<TaskEntity>
    ): String {
        val root = JSONObject()
        root.put("schema", BACKUP_SCHEMA)
        root.put("app", "JARVIS AI")
        val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        root.put("exportedAt", iso.format(Date()))

        val messagesBySession = messages.groupBy { it.sessionId }
        val sessionsArr = JSONArray()
        for (session in sessions) {
            val sObj = JSONObject()
            sObj.put("id", session.id)
            sObj.put("title", session.title)
            sObj.put("agentName", session.agentName)
            sObj.put("createdAt", session.createdAt)
            sObj.put("updatedAt", session.updatedAt)

            val msgsArr = JSONArray()
            val sessionMsgs = messagesBySession[session.id].orEmpty().sortedBy { it.timestamp }
            for (msg in sessionMsgs) {
                val mObj = JSONObject()
                mObj.put("id", msg.id)
                mObj.put("sessionId", msg.sessionId)
                mObj.put("role", msg.role)
                mObj.put("text", msg.text)
                mObj.put("agentName", msg.agentName)
                mObj.put("agentCodename", msg.agentName)
                mObj.put("timestamp", msg.timestamp)
                mObj.put("isVoice", msg.isVoice)
                mObj.put("isError", msg.isError)
                msgsArr.put(mObj)
            }
            sObj.put("messages", msgsArr)
            sessionsArr.put(sObj)
        }
        root.put("sessions", sessionsArr)

        val memoriesArr = JSONArray()
        for (mem in memories) {
            val memObj = JSONObject()
            memObj.put("id", mem.id)
            memObj.put("key", mem.key)
            memObj.put("category", mem.category)
            memObj.put("content", mem.content)
            memObj.put("importance", mem.importance)
            memObj.put("createdAt", mem.createdAt)
            memObj.put("updatedAt", mem.updatedAt)
            memoriesArr.put(memObj)
        }
        root.put("memories", memoriesArr)

        val tasksArr = JSONArray()
        for (task in tasks) {
            val tObj = JSONObject()
            tObj.put("id", task.id)
            tObj.put("title", task.title)
            tObj.put("description", task.description)
            tObj.put("dueTime", task.dueTime)
            if (task.triggerAtMillis != null) {
                tObj.put("triggerAtMillis", task.triggerAtMillis)
            }
            tObj.put("isCompleted", task.isCompleted)
            tObj.put("priority", task.priority)
            tObj.put("category", task.category)
            tObj.put("createdAt", task.createdAt)
            tasksArr.put(tObj)
        }
        root.put("tasks", tasksArr)

        return root.toString(2)
    }

    fun buildMarkdownBackup(
        sessions: List<ChatSessionEntity>,
        messages: List<ConversationEntity>,
        memories: List<MemoryEntity>,
        tasks: List<TaskEntity>
    ): String {
        val sb = StringBuilder()
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        sb.append("# J.A.R.V.I.S. Neural Vault Backup\n\n")
        sb.append("- **Exported**: ${sdf.format(Date())}\n")
        sb.append("- **Chat Sessions**: ${sessions.size}\n")
        sb.append("- **Memory Vault Facts**: ${memories.size}\n")
        sb.append("- **Tasks & Reminders**: ${tasks.size}\n\n")
        sb.append("---\n\n## Memory Vault\n\n")

        if (memories.isEmpty()) {
            sb.append("_No stored memories._\n\n")
        } else {
            for (mem in memories) {
                sb.append("- **[${mem.category}] ${mem.key}** (Importance ${mem.importance}/5): ${mem.content}\n")
            }
            sb.append("\n")
        }

        sb.append("---\n\n## Tasks & Reminders\n\n")
        if (tasks.isEmpty()) {
            sb.append("_No tasks or reminders._\n\n")
        } else {
            for (task in tasks) {
                val mark = if (task.isCompleted) "x" else " "
                sb.append("- [$mark] **${task.title}** (${task.priority} • ${task.category} • ${task.dueTime})")
                if (task.description.isNotBlank()) sb.append(" — ${task.description}")
                sb.append("\n")
            }
            sb.append("\n")
        }

        sb.append("---\n\n## Chat Sessions\n\n")
        val grouped = messages.groupBy { it.sessionId }
        if (sessions.isEmpty()) {
            sb.append("_No chat sessions._\n\n")
        } else {
            for (session in sessions) {
                val msgs = grouped[session.id].orEmpty().sortedBy { it.timestamp }
                sb.append("### ${session.title} (${msgs.size} messages)\n\n")
                for (msg in msgs) {
                    val speaker = if (msg.role == "user") "Sir" else msg.agentName
                    sb.append("#### $speaker · ${sdf.format(Date(msg.timestamp))}\n\n")
                    sb.append("${msg.text}\n\n")
                }
                sb.append("---\n\n")
            }
        }
        return sb.toString()
    }

    fun writeAndShareBackup(
        context: Context,
        content: String,
        filename: String,
        mimeType: String
    ): Result<Unit> {
        return try {
            val backupDir = File(context.cacheDir, "backups").apply { mkdirs() }
            val outFile = File(backupDir, filename)
            outFile.writeText(content, Charsets.UTF_8)

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                outFile
            )
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, filename)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(sendIntent, "Export JARVIS Backup").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun parseAndValidateBackup(
        rawJson: String,
        filename: String,
        existingMemories: List<MemoryEntity>,
        existingSessions: List<ChatSessionEntity>,
        existingTasks: List<TaskEntity>
    ): BackupImportPreview {
        val errors = mutableListOf<String>()
        val warnings = mutableListOf<String>()

        if (rawJson.isBlank()) {
            return BackupImportPreview(
                isValid = false,
                filename = filename,
                exportedAt = null,
                errors = listOf("Selected backup file is empty."),
                warnings = warnings,
                sessionsToImport = emptyList(),
                skippedSessionsCount = 0,
                memoriesToImport = emptyList(),
                duplicateMemoriesSkipped = 0,
                tasksToImport = emptyList(),
                skippedTasksCount = 0
            )
        }

        val root = try {
            JSONObject(rawJson.trim())
        } catch (e: Exception) {
            return BackupImportPreview(
                isValid = false,
                filename = filename,
                exportedAt = null,
                errors = listOf("Invalid JSON syntax: ${e.localizedMessage ?: "Parse error"}"),
                warnings = warnings,
                sessionsToImport = emptyList(),
                skippedSessionsCount = 0,
                memoriesToImport = emptyList(),
                duplicateMemoriesSkipped = 0,
                tasksToImport = emptyList(),
                skippedTasksCount = 0
            )
        }

        val exportedAt = root.optString("exportedAt", "").takeIf { it.isNotBlank() }
        val schema = root.optString("schema", "")
        if (schema.isNotBlank() && schema != BACKUP_SCHEMA) {
            warnings.add("Unknown backup schema '$schema'. Attempting compatible import.")
        }

        val hasSessions = root.has("sessions")
        val hasMessages = root.has("messages")
        val hasMemories = root.has("memories")
        val hasTasks = root.has("tasks")
        if (!hasSessions && !hasMessages && !hasMemories && !hasTasks) {
            return BackupImportPreview(
                isValid = false,
                filename = filename,
                exportedAt = exportedAt,
                errors = listOf("JSON does not contain sessions, messages, memories, or tasks arrays."),
                warnings = warnings,
                sessionsToImport = emptyList(),
                skippedSessionsCount = 0,
                memoriesToImport = emptyList(),
                duplicateMemoriesSkipped = 0,
                tasksToImport = emptyList(),
                skippedTasksCount = 0
            )
        }

        // Parse sessions (also supports web transcript export { messages: [...] })
        val existingSessionIds = existingSessions.map { it.id }.toMutableSet()
        val sessionsToImport = mutableListOf<ImportedSessionBundle>()
        var skippedSessions = 0

        val rawSessionsArray: JSONArray? = when {
            hasSessions -> root.optJSONArray("sessions")
            hasMessages -> {
                val synthetic = JSONObject().apply {
                    put("id", "imp_transcript_${System.currentTimeMillis()}")
                    put("title", "Imported Transcript")
                    put("createdAt", System.currentTimeMillis())
                    put("updatedAt", System.currentTimeMillis())
                    put("messages", root.optJSONArray("messages") ?: JSONArray())
                }
                JSONArray().apply { put(synthetic) }
            }
            else -> null
        }

        if (rawSessionsArray != null) {
            for (i in 0 until rawSessionsArray.length()) {
                val sObj = rawSessionsArray.optJSONObject(i)
                if (sObj == null) {
                    warnings.add("Skipped malformed session object at index $i.")
                    continue
                }
                val rawId = sObj.optString("id", "").trim()
                val baseId = if (rawId.isNotEmpty()) rawId else "imp_sess_${UUID.randomUUID()}"
                val msgArr = sObj.optJSONArray("messages") ?: JSONArray()

                if (existingSessionIds.contains(baseId)) {
                    skippedSessions++
                    continue
                }

                val now = System.currentTimeMillis()
                val title = sObj.optString("title", "").trim().take(64)
                    .ifBlank { "Imported Session ${i + 1}" }
                val agentName = sObj.optString("agentName", "JARVIS").trim().ifBlank { "JARVIS" }
                val createdAt = sObj.optLong("createdAt", now).takeIf { it > 0 } ?: now
                val updatedAt = sObj.optLong("updatedAt", now).takeIf { it > 0 } ?: now

                val parsedMessages = mutableListOf<ConversationEntity>()
                for (mIdx in 0 until msgArr.length()) {
                    val mObj = msgArr.optJSONObject(mIdx) ?: continue
                    val text = mObj.optString("text", "").trim()
                    if (text.isEmpty()) continue
                    val rawRole = mObj.optString("role", "jarvis").lowercase(Locale.US)
                    val role = if (rawRole == "user") "user" else "jarvis"
                    val speaker = mObj.optString("agentName", "")
                        .ifBlank { mObj.optString("agentCodename", "") }
                        .ifBlank { if (role == "user") "Sir" else "JARVIS" }
                    val ts = mObj.optLong("timestamp", now + mIdx).takeIf { it > 0 } ?: (now + mIdx)
                    parsedMessages.add(
                        ConversationEntity(
                            sessionId = baseId,
                            role = role,
                            text = text,
                            agentName = speaker,
                            timestamp = ts,
                            isVoice = mObj.optBoolean("isVoice", false),
                            isError = mObj.optBoolean("isError", false)
                        )
                    )
                }

                sessionsToImport.add(
                    ImportedSessionBundle(
                        session = ChatSessionEntity(
                            id = baseId,
                            title = title,
                            agentName = agentName,
                            createdAt = createdAt,
                            updatedAt = updatedAt
                        ),
                        messages = parsedMessages
                    )
                )
                existingSessionIds.add(baseId)
            }
        }

        // Parse & deduplicate memories
        val memoryPool = existingMemories.toMutableList()
        val memoriesToImport = mutableListOf<MemoryEntity>()
        var duplicateMemories = 0
        val memoriesArr = root.optJSONArray("memories")
        if (memoriesArr != null) {
            for (i in 0 until memoriesArr.length()) {
                val mObj = memoriesArr.optJSONObject(i)
                if (mObj == null) {
                    warnings.add("Skipped malformed memory entry at index $i.")
                    continue
                }
                val key = mObj.optString("key", "").trim().take(64)
                val content = mObj.optString("content", "").trim().take(400)
                if (key.isEmpty() || content.isEmpty()) {
                    warnings.add("Skipped memory #${i + 1} missing key or content.")
                    continue
                }
                if (MemoryDeduplicator.isNearDuplicate(key, content, memoryPool)) {
                    duplicateMemories++
                    continue
                }
                val rawCat = mObj.optString("category", "FACT").trim().uppercase(Locale.US)
                val cat = if (rawCat in ALLOWED_MEMORY_CATEGORIES) rawCat else "FACT"
                val imp = mObj.optInt("importance", 3).coerceIn(1, 5)
                val createdAt = mObj.optLong("createdAt", System.currentTimeMillis())
                    .takeIf { it > 0 } ?: System.currentTimeMillis()
                val updatedAt = mObj.optLong("updatedAt", createdAt)
                    .takeIf { it > 0 } ?: createdAt
                val entity = MemoryEntity(
                    key = key,
                    category = cat,
                    content = content,
                    importance = imp,
                    createdAt = createdAt,
                    updatedAt = updatedAt
                )
                memoriesToImport.add(entity)
                memoryPool.add(entity)
            }
        }

        // Parse tasks
        val existingTaskSigs = existingTasks
            .map { "${it.title.trim().lowercase(Locale.US)}::${it.dueTime.trim().lowercase(Locale.US)}" }
            .toMutableSet()
        val tasksToImport = mutableListOf<TaskEntity>()
        var skippedTasks = 0
        val tasksArr = root.optJSONArray("tasks")
        if (tasksArr != null) {
            for (i in 0 until tasksArr.length()) {
                val tObj = tasksArr.optJSONObject(i)
                if (tObj == null) {
                    warnings.add("Skipped malformed task entry at index $i.")
                    continue
                }
                val title = tObj.optString("title", "").trim().take(140)
                if (title.isEmpty()) {
                    warnings.add("Skipped task #${i + 1} missing title.")
                    continue
                }
                val dueTime = tObj.optString("dueTime", "Unscheduled").trim().ifBlank { "Unscheduled" }
                val sig = "${title.lowercase(Locale.US)}::${dueTime.lowercase(Locale.US)}"
                if (sig in existingTaskSigs) {
                    skippedTasks++
                    continue
                }
                val prio = tObj.optString("priority", "MEDIUM").trim().uppercase(Locale.US)
                    .let { if (it in ALLOWED_PRIORITIES) it else "MEDIUM" }
                val cat = tObj.optString("category", "TASK").trim().uppercase(Locale.US)
                    .let { if (it in ALLOWED_TASK_CATEGORIES) it else "TASK" }
                val triggerAt = if (tObj.has("triggerAtMillis") && !tObj.isNull("triggerAtMillis")) {
                    tObj.optLong("triggerAtMillis", -1L).takeIf { it > 0 }
                } else null
                val createdAt = tObj.optLong("createdAt", System.currentTimeMillis())
                    .takeIf { it > 0 } ?: System.currentTimeMillis()

                tasksToImport.add(
                    TaskEntity(
                        title = title,
                        description = tObj.optString("description", "").trim(),
                        dueTime = dueTime,
                        triggerAtMillis = triggerAt,
                        isCompleted = tObj.optBoolean("isCompleted", false),
                        priority = prio,
                        category = cat,
                        createdAt = createdAt
                    )
                )
                existingTaskSigs.add(sig)
            }
        }

        val totalImportable = sessionsToImport.size + memoriesToImport.size + tasksToImport.size
        val totalSkipped = skippedSessions + duplicateMemories + skippedTasks
        if (totalImportable == 0 && totalSkipped == 0) {
            errors.add("No valid chat sessions, memories, or tasks were found in this JSON file.")
        }

        return BackupImportPreview(
            isValid = errors.isEmpty(),
            filename = filename,
            exportedAt = exportedAt,
            errors = errors,
            warnings = warnings,
            sessionsToImport = sessionsToImport,
            skippedSessionsCount = skippedSessions,
            memoriesToImport = memoriesToImport,
            duplicateMemoriesSkipped = duplicateMemories,
            tasksToImport = tasksToImport,
            skippedTasksCount = skippedTasks
        )
    }
}
