package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MediaItemDao {
    @Query("SELECT * FROM media_items WHERE itemType = 'FAVORITE' ORDER BY addedAt DESC")
    fun getFavorites(): Flow<List<MediaItemEntity>>

    @Query("SELECT * FROM media_items WHERE itemType = 'HISTORY' ORDER BY addedAt DESC LIMIT 50")
    fun getHistory(): Flow<List<MediaItemEntity>>

    @Query("SELECT * FROM media_items WHERE itemType = 'PLAYLIST' ORDER BY playlistName ASC, addedAt DESC")
    fun getPlaylistItems(): Flow<List<MediaItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: MediaItemEntity): Long

    @Query("DELETE FROM media_items WHERE videoId = :videoId AND itemType = 'FAVORITE'")
    suspend fun removeFavorite(videoId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM media_items WHERE videoId = :videoId AND itemType = 'FAVORITE')")
    suspend fun isFavorite(videoId: String): Boolean

    @Query("DELETE FROM media_items WHERE itemType = 'HISTORY'")
    suspend fun clearHistory()

    @Query("DELETE FROM media_items WHERE playlistName = :name")
    suspend fun deletePlaylist(name: String)

    @Query("DELETE FROM media_items WHERE playlistName = :name AND videoId = :videoId")
    suspend fun removeFromPlaylist(name: String, videoId: String)
}
