package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "tasks")
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
    val createdAt: Long = System.currentTimeMillis()
)
