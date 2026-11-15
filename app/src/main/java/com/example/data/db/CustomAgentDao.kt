package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomAgentDao {
    @Query("SELECT * FROM custom_agents ORDER BY createdAt DESC")
    fun getAll(): Flow<List<CustomAgentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(agent: CustomAgentEntity)

    @Query("DELETE FROM custom_agents WHERE id = :id")
    suspend fun deleteById(id: String)
}
