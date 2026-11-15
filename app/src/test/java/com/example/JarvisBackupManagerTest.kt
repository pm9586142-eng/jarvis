package com.example

import com.example.data.backup.JarvisBackupManager
import com.example.data.db.ChatSessionEntity
import com.example.data.db.ConversationEntity
import com.example.data.db.MemoryEntity
import com.example.data.db.TaskEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class JarvisBackupManagerTest {

    @Test
    fun buildJsonBackup_roundTripsThroughParseAndValidateBackup() {
        val sessions = listOf(
            ChatSessionEntity(id = "sess_1", title = "Architecture", agentName = "ALPHA", createdAt = 1000L, updatedAt = 2000L)
        )
        val messages = listOf(
            ConversationEntity(id = 1L, sessionId = "sess_1", role = "user", text = "Hello", agentName = "Sir", timestamp = 1100L),
            ConversationEntity(id = 2L, sessionId = "sess_1", role = "jarvis", text = "Online, Sir.", agentName = "ALPHA", timestamp = 1200L)
        )
        val memories = listOf(
            MemoryEntity(id = 1L, key = "Stack", category = "PROJECT", content = "Kotlin and React 19", importance = 5)
        )
        val tasks = listOf(
            TaskEntity(id = 1L, title = "Verify build", description = "Run gradle", dueTime = "Today 5:00 PM", priority = "HIGH", category = "TASK")
        )

        val json = JarvisBackupManager.buildJsonBackup(sessions, messages, memories, tasks)
        val preview = JarvisBackupManager.parseAndValidateBackup(
            rawJson = json,
            filename = "jarvis_backup.json",
            existingMemories = emptyList(),
            existingSessions = emptyList(),
            existingTasks = emptyList()
        )

        assertTrue(preview.isValid)
        assertEquals(1, preview.sessionsToImport.size)
        assertEquals(2, preview.sessionsToImport.first().messages.size)
        assertEquals(1, preview.memoriesToImport.size)
        assertEquals(1, preview.tasksToImport.size)
    }

    @Test
    fun parseAndValidateBackup_skipsDuplicatesAndRejectsMalformedJson() {
        val bad = JarvisBackupManager.parseAndValidateBackup(
            rawJson = "{broken json",
            filename = "bad.json",
            existingMemories = emptyList(),
            existingSessions = emptyList(),
            existingTasks = emptyList()
        )
        assertFalse(bad.isValid)
        assertTrue(bad.errors.isNotEmpty())

        val existingSessions = listOf(ChatSessionEntity(id = "sess_1", title = "Existing"))
        val existingMemories = listOf(MemoryEntity(key = "Stack", category = "PROJECT", content = "Kotlin and React 19"))
        val existingTasks = listOf(TaskEntity(title = "Verify build", dueTime = "Today 5:00 PM"))

        val json = JarvisBackupManager.buildJsonBackup(existingSessions, emptyList(), existingMemories, existingTasks)
        val deduped = JarvisBackupManager.parseAndValidateBackup(
            rawJson = json,
            filename = "dup.json",
            existingMemories = existingMemories,
            existingSessions = existingSessions,
            existingTasks = existingTasks
        )

        assertTrue(deduped.isValid)
        assertEquals(0, deduped.totalImportableCount)
        assertEquals(1, deduped.skippedSessionsCount)
        assertEquals(1, deduped.duplicateMemoriesSkipped)
        assertEquals(1, deduped.skippedTasksCount)
    }

    @Test
    fun buildMarkdownBackup_containsAllSections() {
        val md = JarvisBackupManager.buildMarkdownBackup(
            sessions = listOf(ChatSessionEntity(id = "s1", title = "Briefing")),
            messages = listOf(ConversationEntity(sessionId = "s1", role = "jarvis", text = "All systems nominal.")),
            memories = listOf(MemoryEntity(key = "Role", category = "FACT", content = "Lead Engineer")),
            tasks = listOf(TaskEntity(title = "Ship 3.0", dueTime = "Tomorrow", isCompleted = true))
        )
        assertTrue(md.contains("# J.A.R.V.I.S. Neural Vault Backup"))
        assertTrue(md.contains("Lead Engineer"))
        assertTrue(md.contains("- [x] **Ship 3.0**"))
        assertTrue(md.contains("All systems nominal."))
    }
}
