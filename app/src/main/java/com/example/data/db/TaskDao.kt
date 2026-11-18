package com.example.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks WHERE isDeleted = 0 ORDER BY isCompleted ASC, createdAt DESC")
    fun getAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE category = :category AND isDeleted = 0 ORDER BY isCompleted ASC, createdAt DESC")
    fun getByCategory(category: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): TaskEntity?

    @Query("SELECT * FROM tasks WHERE syncId = :syncId LIMIT 1")
    suspend fun getBySyncId(syncId: String): TaskEntity?

    @Query("SELECT * FROM tasks")
    suspend fun getAllIncludingDeleted(): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE syncStatus != 'SYNCED' ORDER BY updatedAt ASC")
    suspend fun getPendingSyncTasks(): List<TaskEntity>

    @Query("SELECT COUNT(*) FROM tasks WHERE syncStatus != 'SYNCED'")
    fun observePendingSyncCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(task: TaskEntity): Long

    @Update
    suspend fun update(task: TaskEntity)

    @Delete
    suspend fun delete(task: TaskEntity)

    @Query(
        "UPDATE tasks SET isCompleted = :completed, updatedAt = :updatedAt, syncStatus = 'PENDING_UPSERT' WHERE id = :id"
    )
    suspend fun setCompleted(
        id: Long,
        completed: Boolean,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query(
        "UPDATE tasks SET dueTime = :dueTime, triggerAtMillis = :triggerAtMillis, isCompleted = 0, updatedAt = :updatedAt, syncStatus = 'PENDING_UPSERT' WHERE id = :id"
    )
    suspend fun updateTriggerTime(
        id: Long,
        dueTime: String,
        triggerAtMillis: Long,
        updatedAt: Long = System.currentTimeMillis()
    )

    @Query(
        "UPDATE tasks SET isDeleted = 1, updatedAt = :updatedAt, syncStatus = 'PENDING_DELETE' WHERE id = :id"
    )
    suspend fun markSoftDeleted(id: Long, updatedAt: Long = System.currentTimeMillis())

    @Query(
        "UPDATE tasks SET ownerUid = :ownerUid, updatedAt = :updatedAt, syncStatus = 'SYNCED' WHERE syncId = :syncId"
    )
    suspend fun markSynced(syncId: String, ownerUid: String, updatedAt: Long)

    @Query(
        "UPDATE tasks SET ownerUid = :ownerUid, syncStatus = 'PENDING_UPSERT' WHERE ownerUid = ''"
    )
    suspend fun adoptUnownedTasks(ownerUid: String)

    @Query(
        "DELETE FROM tasks WHERE ownerUid != '' AND ownerUid != :activeOwnerUid"
    )
    suspend fun deleteTasksForOtherOwners(activeOwnerUid: String)

    @Query(
        "DELETE FROM tasks WHERE isDeleted = 1 AND syncStatus = 'SYNCED' AND updatedAt < :cutoffMillis"
    )
    suspend fun purgeOldSyncedTombstones(cutoffMillis: Long)

    @Query("SELECT COUNT(*) FROM tasks WHERE isDeleted = 0")
    suspend fun count(): Int

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun deleteById(id: Long)
}
