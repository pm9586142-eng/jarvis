package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CommandHistoryDao {
    @Query("SELECT * FROM command_history ORDER BY createdAt DESC LIMIT :limit")
    fun getRecent(limit: Int = 50): Flow<List<CommandHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: CommandHistoryEntity): Long

    @Query("DELETE FROM command_history")
    suspend fun clearAll()
}
