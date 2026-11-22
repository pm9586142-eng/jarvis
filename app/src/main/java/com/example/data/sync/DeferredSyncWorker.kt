package com.example.data.sync

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.example.BuildConfig
import com.example.data.db.JarvisDatabase
import com.example.data.db.NoteSyncStatus
import com.example.data.db.TaskSyncStatus
import kotlinx.coroutines.flow.first
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DeferredSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val backendUrl = try {
            BuildConfig.BACKEND_URL.trim().takeUnless {
                it.isBlank() || it.equals("UNSET", true) || it.equals("NONE", true)
            }.orEmpty().trimEnd('/')
        } catch (_: Exception) {
            ""
        }
        if (backendUrl.isBlank()) {
            return Result.success()
        }

        val db = JarvisDatabase.getDatabase(applicationContext)
        val taskDao = db.taskDao()
        val noteDao = db.noteDao()
        val memoryDao = db.memoryDao()

        val pendingTasks = taskDao.getPendingSyncTasks()
        val pendingNotes = noteDao.getPendingSync()
        val allMemories = memoryDao.getAll().first()

        val payload = JSONObject().apply {
            put("tasks", JSONArray().apply {
                pendingTasks.forEach { t ->
                    put(JSONObject().apply {
                        put("id", t.syncId)
                        put("title", t.title)
                        put("description", t.description)
                        put("dueTime", t.dueTime)
                        put("isCompleted", t.isCompleted)
                        put("priority", t.priority)
                        put("category", t.category)
                        put("createdAt", t.createdAt)
                        put("updatedAt", t.updatedAt)
                        put("isDeleted", t.isDeleted)
                    })
                }
            })
            put("notes", JSONArray().apply {
                pendingNotes.forEach { n ->
                    put(JSONObject().apply {
                        put("id", n.syncId)
                        put("title", n.title)
                        put("content", n.content)
                        put("category", n.category)
                        put("pinned", n.pinned)
                        put("createdAt", n.createdAt)
                        put("updatedAt", n.updatedAt)
                        put("isDeleted", n.isDeleted)
                    })
                }
            })
            put("memories", JSONArray().apply {
                allMemories.take(50).forEach { m ->
                    put(JSONObject().apply {
                        put("key", m.key)
                        put("category", m.category)
                        put("content", m.content)
                        put("importance", m.importance)
                        put("createdAt", m.createdAt)
                        put("updatedAt", m.updatedAt)
                    })
                }
            })
        }

        val token = try {
            BuildConfig.APP_ACCESS_TOKEN.trim().takeUnless {
                it.isBlank() || it.equals("UNSET", true) || it.equals("NONE", true)
            }.orEmpty()
        } catch (_: Exception) {
            ""
        }

        val req = Request.Builder()
            .url("$backendUrl/api/sync")
            .apply {
                if (token.isNotBlank()) addHeader("Authorization", "Bearer $token")
            }
            .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()

        return try {
            client.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    Log.w("DeferredSyncWorker", "Sync returned HTTP ${resp.code}; retrying later.")
                    return Result.retry()
                }
                for (task in pendingTasks) {
                    if (task.isDeleted) {
                        taskDao.deleteById(task.id)
                    } else {
                        taskDao.update(task.copy(syncStatus = TaskSyncStatus.SYNCED))
                    }
                }
                for (note in pendingNotes) {
                    if (note.isDeleted) {
                        noteDao.delete(note)
                    } else {
                        noteDao.update(note.copy(syncStatus = NoteSyncStatus.SYNCED))
                    }
                }
                Result.success()
            }
        } catch (e: Exception) {
            Log.w("DeferredSyncWorker", "Deferred sync deferred again: ${e.message}")
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "am_ai_deferred_sync"

        fun enqueueWhenConnected(context: Context) {
            try {
                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
                val work = OneTimeWorkRequestBuilder<DeferredSyncWorker>()
                    .setConstraints(constraints)
                    .build()
                WorkManager.getInstance(context.applicationContext)
                    .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.REPLACE, work)
            } catch (_: Exception) {
                // Unit test environments without initialized WorkManager skip cleanly
            }
        }
    }
}
