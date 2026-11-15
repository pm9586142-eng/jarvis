package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ConversationDao {
    @Query("SELECT * FROM conversations ORDER BY timestamp ASC")
    fun getAll(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE sessionId = :sessionId ORDER BY timestamp ASC")
    fun getBySession(sessionId: String): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): ConversationEntity?

    @Query("SELECT COUNT(*) FROM conversations WHERE sessionId = :sessionId")
    suspend fun countBySession(sessionId: String): Int

    @Insert
    suspend fun insert(message: ConversationEntity): Long

    @Update
    suspend fun update(message: ConversationEntity)

    @Query("DELETE FROM conversations WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM conversations WHERE sessionId = :sessionId AND id >= :fromId")
    suspend fun deleteSessionFromId(sessionId: String, fromId: Long)

    @Query("DELETE FROM conversations WHERE sessionId = :sessionId AND id > :afterId")
    suspend fun deleteSessionAfterId(sessionId: String, afterId: Long)

    @Query("DELETE FROM conversations WHERE sessionId = :sessionId")
    suspend fun clearSession(sessionId: String)

    @Query("DELETE FROM conversations")
    suspend fun clearAll()
}
