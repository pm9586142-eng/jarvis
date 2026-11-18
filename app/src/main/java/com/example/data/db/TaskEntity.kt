package com.example.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

object TaskSyncStatus {
    const val PENDING_UPSERT = "PENDING_UPSERT"
    const val PENDING_DELETE = "PENDING_DELETE"
    const val SYNCED = "SYNCED"
}

fun generateTaskSyncId(): String =
    "task_${UUID.randomUUID().toString().replace("-", "")}"

@Entity(
    tableName = "tasks",
    indices = [Index(value = ["syncId"], unique = true)]
)
data class TaskEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val dueTime: String = "",
    val triggerAtMillis: Long? = null,
    val isCompleted: Boolean = false,
    val priority: String = "MEDIUM", // "HIGH", "MEDIUM", "LOW"
    val category: String = "TASK", // "REMINDER", "TASK", "SCHEDULE", "NOTE"
    val createdAt: Long = System.currentTimeMillis(),
    val syncId: String = generateTaskSyncId(),
    val ownerUid: String = "",
    val updatedAt: Long = createdAt,
    val isDeleted: Boolean = false,
    val syncStatus: String = TaskSyncStatus.PENDING_UPSERT
)
