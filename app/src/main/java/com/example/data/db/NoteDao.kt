package com.example.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes WHERE isDeleted = 0 ORDER BY pinned DESC, updatedAt DESC")
    fun getAll(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE syncStatus != 'SYNCED'")
    suspend fun getPendingSync(): List<NoteEntity>

    @Query("SELECT * FROM notes WHERE syncId = :syncId LIMIT 1")
    suspend fun getBySyncId(syncId: String): NoteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(note: NoteEntity): Long

    @Update
    suspend fun update(note: NoteEntity)

    @Delete
    suspend fun delete(note: NoteEntity)

    @Query("UPDATE notes SET isDeleted = 1, syncStatus = 'PENDING_DELETE', updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDelete(id: Long, updatedAt: Long = System.currentTimeMillis())

    @Query("SELECT COUNT(*) FROM notes WHERE isDeleted = 0")
    suspend fun count(): Int
}
