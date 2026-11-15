package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sessionId: String = "default_session",
    val role: String, // "user" or "jarvis"
    val text: String,
    val agentName: String = "JARVIS",
    val timestamp: Long = System.currentTimeMillis(),
    val isVoice: Boolean = false,
    val isError: Boolean = false,
    val attachmentName: String? = null,
    val attachmentMimeType: String? = null,
    val attachmentUri: String? = null
)
