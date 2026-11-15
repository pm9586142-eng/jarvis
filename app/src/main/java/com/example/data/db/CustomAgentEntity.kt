package com.example.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "custom_agents")
data class CustomAgentEntity(
    @PrimaryKey val id: String,
    val name: String,
    val codename: String,
    val systemPrompt: String,
    val colorHex: Long,
    val keywords: String, // Comma-separated auto-routing triggers
    val createdAt: Long = System.currentTimeMillis()
)
