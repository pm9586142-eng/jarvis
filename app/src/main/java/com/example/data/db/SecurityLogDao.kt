package com.example.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SecurityLogDao {
    @Query("SELECT * FROM security_logs ORDER BY timestamp DESC")
    fun getAll(): Flow<List<SecurityLogEntity>>

    @Insert
    suspend fun insert(log: SecurityLogEntity): Long

    @Query("DELETE FROM security_logs")
    suspend fun clearAll()
}
