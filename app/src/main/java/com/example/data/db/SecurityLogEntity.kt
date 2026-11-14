package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "security_logs")
data class SecurityLogEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val timestamp: Long = System.currentTimeMillis(),
    val eventType: String, // "AUTH", "TOOL_EXEC", "NETWORK", "ANOMALY", "SCAN"
    val description: String,
    val severity: String = "INFO", // "INFO", "WARNING", "CRITICAL"
    val sourceAgent: String = "JARVIS_SECURITY"
)
