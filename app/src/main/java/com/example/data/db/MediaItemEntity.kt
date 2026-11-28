package com.example.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "media_items",
    indices = [
        Index(value = ["itemType", "playlistName"]),
        Index(value = ["videoId", "itemType"], unique = true)
    ]
)
data class MediaItemEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val videoId: String,
    val title: String,
    val channelTitle: String,
    val thumbnailUrl: String = "",
    val durationText: String = "",
    val durationSeconds: Int = 0,
    val itemType: String, // "FAVORITE", "HISTORY", "PLAYLIST"
    val playlistName: String = "",
    val addedAt: Long = System.currentTimeMillis()
)
