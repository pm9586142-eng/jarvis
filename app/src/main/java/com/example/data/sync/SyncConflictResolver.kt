package com.example.data.sync

import com.example.data.db.MemoryEntity
import com.example.data.db.NoteEntity
import com.example.data.db.NoteSyncStatus
import com.example.data.db.TaskEntity
import com.example.data.db.TaskSyncStatus

object SyncConflictResolver {

    fun mergeTasks(local: List<TaskEntity>, remote: List<TaskEntity>): List<TaskEntity> {
        val bySyncId = LinkedHashMap<String, TaskEntity>()
        for (item in local) {
            bySyncId[item.syncId] = item
        }
        for (remoteItem in remote) {
            val existing = bySyncId[remoteItem.syncId]
            if (existing == null) {
                bySyncId[remoteItem.syncId] = remoteItem.copy(syncStatus = TaskSyncStatus.SYNCED)
            } else if (remoteItem.updatedAt >= existing.updatedAt) {
                bySyncId[remoteItem.syncId] = remoteItem.copy(
                    id = existing.id,
                    syncStatus = TaskSyncStatus.SYNCED
                )
            }
        }
        return bySyncId.values.toList()
    }

    fun mergeNotes(local: List<NoteEntity>, remote: List<NoteEntity>): List<NoteEntity> {
        val bySyncId = LinkedHashMap<String, NoteEntity>()
        for (item in local) {
            bySyncId[item.syncId] = item
        }
        for (remoteItem in remote) {
            val existing = bySyncId[remoteItem.syncId]
            if (existing == null) {
                bySyncId[remoteItem.syncId] = remoteItem.copy(syncStatus = NoteSyncStatus.SYNCED)
            } else if (remoteItem.updatedAt >= existing.updatedAt) {
                bySyncId[remoteItem.syncId] = remoteItem.copy(
                    id = existing.id,
                    syncStatus = NoteSyncStatus.SYNCED
                )
            }
        }
        return bySyncId.values.toList()
    }

    fun mergeMemories(local: List<MemoryEntity>, remote: List<MemoryEntity>): List<MemoryEntity> {
        val byKey = LinkedHashMap<String, MemoryEntity>()
        fun normKey(m: MemoryEntity) = "${m.category.uppercase()}::${m.key.trim().lowercase()}"

        for (item in local) {
            byKey[normKey(item)] = item
        }
        for (remoteItem in remote) {
            val k = normKey(remoteItem)
            val existing = byKey[k]
            if (existing == null) {
                byKey[k] = remoteItem
            } else if (remoteItem.updatedAt >= existing.updatedAt) {
                byKey[k] = remoteItem.copy(id = existing.id)
            }
        }
        return byKey.values.toList()
    }
}
