package com.example.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.util.UUID

object NoteSyncStatus {
    const val PENDING_UPSERT = "PENDING_UPSERT"
    const val PENDING_DELETE = "PENDING_DELETE"
    const val SYNCED = "SYNCED"
}

fun generateNoteSyncId(): String =
    "note_${UUID.randomUUID().toString().replace("-", "")}"

@Entity(
    tableName = "notes",
    indices = [Index(value = ["syncId"], unique = true)]
)
data class NoteEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val syncId: String = generateNoteSyncId(),
    val title: String,
    val content: String,
    val category: String = "GENERAL",
    val pinned: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = createdAt,
    val isDeleted: Boolean = false,
    val syncStatus: String = NoteSyncStatus.PENDING_UPSERT
)
