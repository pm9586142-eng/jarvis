package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "command_history")
data class CommandHistoryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val rawText: String,
    val intent: String,
    val engine: String,
    val resultSummary: String,
    val createdAt: Long = System.currentTimeMillis()
)
