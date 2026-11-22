package com.example

import com.example.data.db.NoteEntity
import com.example.data.db.NoteSyncStatus
import com.example.data.db.TaskEntity
import com.example.data.db.TaskSyncStatus
import com.example.data.sync.SyncConflictResolver
import org.junit.Assert.assertEquals
import org.junit.Test

class SyncConflictResolverTest {

    @Test
    fun mergeTasks_usesLastWriteWinsByUpdatedAt() {
        val local = listOf(
            TaskEntity(id = 1, syncId = "t1", title = "Local Older", updatedAt = 100L),
            TaskEntity(id = 2, syncId = "t2", title = "Local Newer", updatedAt = 300L)
        )
        val remote = listOf(
            TaskEntity(id = 99, syncId = "t1", title = "Remote Newer", updatedAt = 200L),
            TaskEntity(id = 88, syncId = "t2", title = "Remote Older", updatedAt = 150L)
        )

        val merged = SyncConflictResolver.mergeTasks(local, remote)
        val t1 = merged.first { it.syncId == "t1" }
        val t2 = merged.first { it.syncId == "t2" }

        assertEquals("Remote Newer", t1.title)
        assertEquals(TaskSyncStatus.SYNCED, t1.syncStatus)
        assertEquals("Local Newer", t2.title)
    }

    @Test
    fun mergeNotes_preservesNewerEditsAndMarksRemoteSynced() {
        val local = listOf(
            NoteEntity(id = 5, syncId = "n1", title = "V1", content = "Old", updatedAt = 100L)
        )
        val remote = listOf(
            NoteEntity(id = 0, syncId = "n1", title = "V2", content = "Updated", updatedAt = 250L),
            NoteEntity(id = 0, syncId = "n2", title = "Cloud Note", content = "Body", updatedAt = 260L)
        )

        val merged = SyncConflictResolver.mergeNotes(local, remote)
        assertEquals(2, merged.size)
        val n1 = merged.first { it.syncId == "n1" }
        assertEquals(5L, n1.id)
        assertEquals("V2", n1.title)
        assertEquals(NoteSyncStatus.SYNCED, n1.syncStatus)
    }
}
