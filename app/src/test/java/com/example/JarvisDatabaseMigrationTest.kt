package com.example

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.example.data.db.ChatSessionEntity
import com.example.data.db.CommandHistoryEntity
import com.example.data.db.ConversationEntity
import com.example.data.db.CustomAgentEntity
import com.example.data.db.JarvisDatabase
import com.example.data.db.LocalModelEntity
import com.example.data.db.MemoryEntity
import com.example.data.db.NoteEntity
import com.example.data.db.TaskEntity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class JarvisDatabaseMigrationTest {

    private lateinit var context: Context
    private var db: JarvisDatabase? = null

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
    }

    @After
    fun tearDown() {
        db?.close()
    }

    @Test
    fun inMemoryDatabase_readsAndWritesAllDaosIncludingCustomAgents() = runBlocking {
        val memDb = Room.inMemoryDatabaseBuilder(context, JarvisDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        db = memDb

        memDb.chatSessionDao().insert(ChatSessionEntity(id = "s_test", title = "Test Session", agentName = "JARVIS"))
        memDb.conversationDao().insert(
            ConversationEntity(
                sessionId = "s_test",
                role = "jarvis",
                text = "Attachment analyzed",
                attachmentName = "spec.pdf",
                attachmentMimeType = "application/pdf"
            )
        )
        memDb.memoryDao().insert(MemoryEntity(key = "Device", category = "FACT", content = "Pixel 9 Pro"))
        memDb.taskDao().insert(TaskEntity(title = "Run checks", triggerAtMillis = 1_800_000_000_000L))
        memDb.customAgentDao().upsert(
            CustomAgentEntity(
                id = "ca_devops",
                name = "DevOps Sentinel",
                codename = "DEVOPS",
                systemPrompt = "Focus on Cloud Run & CI/CD.",
                colorHex = 0xFF38BDF8L,
                keywords = "docker,cloud run,deploy"
            )
        )

        assertEquals(1, memDb.chatSessionDao().getAll().first().size)
        assertEquals("spec.pdf", memDb.conversationDao().getAll().first().first().attachmentName)
        assertEquals(1, memDb.memoryDao().getAll().first().size)
        assertEquals(1, memDb.taskDao().getAll().first().size)
        val agents = memDb.customAgentDao().getAll().first()
        assertEquals(1, agents.size)
        assertEquals("DEVOPS", agents.first().codename)
    }

    @Test
    fun explicitMigrations_upgradeV1SchemaThroughV5PreservingData() = runBlocking {
        val dbName = "jarvis_migration_test.db"
        context.deleteDatabase(dbName)
        val dbFile = context.getDatabasePath(dbName)
        dbFile.parentFile?.mkdirs()

        // Create authentic Room v1 schema tables and seed sample rows
        val sqlite = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
        sqlite.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `memories` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                `key` TEXT NOT NULL,
                `category` TEXT NOT NULL,
                `content` TEXT NOT NULL,
                `importance` INTEGER NOT NULL,
                `createdAt` INTEGER NOT NULL
            )
            """.trimIndent()
        )
        sqlite.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `conversations` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                `sessionId` TEXT NOT NULL,
                `role` TEXT NOT NULL,
                `text` TEXT NOT NULL,
                `agentName` TEXT NOT NULL,
                `timestamp` INTEGER NOT NULL,
                `isVoice` INTEGER NOT NULL
            )
            """.trimIndent()
        )
        sqlite.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `tasks` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                `title` TEXT NOT NULL,
                `description` TEXT NOT NULL,
                `dueTime` TEXT NOT NULL,
                `isCompleted` INTEGER NOT NULL,
                `priority` TEXT NOT NULL,
                `category` TEXT NOT NULL,
                `createdAt` INTEGER NOT NULL
            )
            """.trimIndent()
        )
        sqlite.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `security_logs` (
                `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                `timestamp` INTEGER NOT NULL,
                `eventType` TEXT NOT NULL,
                `description` TEXT NOT NULL,
                `severity` TEXT NOT NULL,
                `sourceAgent` TEXT NOT NULL
            )
            """.trimIndent()
        )
        sqlite.execSQL(
            "INSERT INTO `memories` (`key`, `category`, `content`, `importance`, `createdAt`) VALUES ('Preferred Stack', 'PROJECT', 'Kotlin Compose & Express', 5, 123456)"
        )
        sqlite.execSQL(
            "INSERT INTO `conversations` (`sessionId`, `role`, `text`, `agentName`, `timestamp`, `isVoice`) VALUES ('default_session', 'user', 'Legacy boot ping', 'Sir', 1000, 0)"
        )
        sqlite.execSQL(
            "INSERT INTO `tasks` (`title`, `description`, `dueTime`, `isCompleted`, `priority`, `category`, `createdAt`) VALUES ('Legacy task', 'Keep me', 'Today', 0, 'HIGH', 'TASK', 1000)"
        )
        sqlite.version = 1
        sqlite.close()

        val migratedDb = Room.databaseBuilder(context, JarvisDatabase::class.java, dbName)
            .addMigrations(
                JarvisDatabase.MIGRATION_1_2,
                JarvisDatabase.MIGRATION_2_3,
                JarvisDatabase.MIGRATION_3_4,
                JarvisDatabase.MIGRATION_4_5,
                JarvisDatabase.MIGRATION_5_6,
                JarvisDatabase.MIGRATION_6_7,
                JarvisDatabase.MIGRATION_7_8,
                JarvisDatabase.MIGRATION_8_9,
                JarvisDatabase.MIGRATION_9_10,
                JarvisDatabase.MIGRATION_10_11
            )
            .allowMainThreadQueries()
            .build()
        db = migratedDb

        val sessions = migratedDb.chatSessionDao().getAll().first()
        assertTrue(sessions.any { it.id == "default_session" && !it.isSaved })

        migratedDb.chatSessionDao().setSaved("default_session", true, System.currentTimeMillis())
        assertTrue(migratedDb.chatSessionDao().getById("default_session")?.isSaved == true)

        val migratedMemories = migratedDb.memoryDao().getRecentlyUpdated().first()
        assertEquals(1, migratedMemories.size)
        assertEquals("Preferred Stack", migratedMemories.first().key)
        assertEquals(123456L, migratedMemories.first().createdAt)
        assertEquals(123456L, migratedMemories.first().updatedAt)

        migratedDb.conversationDao().insert(
            ConversationEntity(
                sessionId = "default_session",
                role = "jarvis",
                text = "Playing media inline",
                mediaVideoId = "dQw4w9WgXcQ",
                mediaTitle = "Sample Cosmic Track",
                mediaChannel = "AM Studio"
            )
        )
        val msgs = migratedDb.conversationDao().getAll().first()
        assertEquals(2, msgs.size)
        assertEquals("Legacy boot ping", msgs.first().text)
        assertEquals(false, msgs.first().isError)
        assertEquals(null, msgs.first().providerName)
        assertEquals("dQw4w9WgXcQ", msgs.last().mediaVideoId)

        val tasks = migratedDb.taskDao().getAll().first()
        assertEquals(1, tasks.size)
        assertEquals("Legacy task", tasks.first().title)

        migratedDb.customAgentDao().upsert(
            CustomAgentEntity("id_1", "Researcher", "RESEARCH", "Cite sources", 0xFF10B981L, "study")
        )
        assertEquals(1, migratedDb.customAgentDao().getAll().first().size)

        migratedDb.noteDao().insert(NoteEntity(title = "AM Brief", content = "Verify v8 vault"))
        assertEquals(1, migratedDb.noteDao().getAll().first().size)

        migratedDb.localModelDao().upsert(LocalModelEntity(id = "gemma2_2b_q4", name = "Gemma 2 2B Q4", filePath = "/tmp/m.bin"))
        assertEquals("Gemma 2 2B Q4", migratedDb.localModelDao().getById("gemma2_2b_q4")?.name)

        migratedDb.commandHistoryDao().insert(CommandHistoryEntity(rawText = "open notes", intent = "OPEN_SCREEN", engine = "Offline Command Engine", resultSummary = "Opened"))
        assertEquals(1, migratedDb.commandHistoryDao().getRecent().first().size)

        migratedDb.mediaItemDao().insert(
            com.example.data.db.MediaItemEntity(
                videoId = "test_vid_123",
                title = "AM Player Cosmic Test",
                channelTitle = "AM AI",
                itemType = "FAVORITE"
            )
        )
        assertEquals(1, migratedDb.mediaItemDao().getFavorites().first().size)
    }
}
