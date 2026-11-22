package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "local_models")
data class LocalModelEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val version: String = "1.0",
    val filePath: String,
    val sizeBytes: Long = 0L,
    val status: String = "READY", // "DOWNLOADING", "READY", "ERROR"
    val backend: String = "CPU",
    val installedAt: Long = System.currentTimeMillis(),
    val lastUsedAt: Long = System.currentTimeMillis()
)
