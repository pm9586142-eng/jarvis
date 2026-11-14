package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "memories")
data class MemoryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val key: String,
    val category: String, // "PREFERENCE", "PROJECT", "INSTRUCTION", "COMMAND", "FACT"
    val content: String,
    val importance: Int = 3, // 1 to 5
    val createdAt: Long = System.currentTimeMillis()
)
