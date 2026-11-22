package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface LocalModelDao {
    @Query("SELECT * FROM local_models ORDER BY lastUsedAt DESC")
    fun getAll(): Flow<List<LocalModelEntity>>

    @Query("SELECT * FROM local_models WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): LocalModelEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(model: LocalModelEntity)

    @Query("DELETE FROM local_models WHERE id = :id")
    suspend fun deleteById(id: String)
}
