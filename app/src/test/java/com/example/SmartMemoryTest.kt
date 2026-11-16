package com.example

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.example.data.db.ChatSessionEntity
import com.example.data.db.ConversationEntity
import com.example.data.db.JarvisDatabase
import com.example.data.db.MemoryCommandEngine
import com.example.data.db.MemoryDeduplicator
import com.example.data.db.MemoryEntity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Calendar

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class SmartMemoryTest {

    private lateinit var db: JarvisDatabase

    @Before
    fun setUp() {
        val context: Context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, JarvisDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun memoryCommands_saveUpdateRecallClarifyRejectSecretsAndForget() = runBlocking {
        val t1 = 1_700_000_000_000L

        // 1. Secret blocked before write
        val secretResult = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "Remember my api_key=AIzaSyD1234567890ABCDEFGHIJKLMNOPQRS",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_now",
            nowMillis = t1
        )
        assertTrue(secretResult.handled)
        assertTrue(secretResult.replyText.contains("never store"))
        assertEquals(0, db.memoryDao().count())

        // 2. Vague instruction asks for clarification
        val vagueResult = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "Remember my project details.",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_now",
            nowMillis = t1
        )
        assertTrue(vagueResult.handled)
        assertTrue(vagueResult.replyText.contains("exact details"))
        assertEquals(0, db.memoryDao().count())

        // 3. Explicit save persists and confirms
        val saveResult = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "Remember that I prefer Hindi.",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_now",
            nowMillis = t1
        )
        assertTrue(saveResult.handled)
        assertTrue(saveResult.replyText.contains("Saved to Memory Vault"))
        assertEquals(1, db.memoryDao().count())

        // 4. Conflicting update replaces existing memory without creating duplicate
        val updateResult = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "Update my saved preference to prefer Hinglish replies",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_now",
            nowMillis = t1 + 5000L
        )
        assertTrue(updateResult.handled)
        assertTrue(updateResult.replyText.contains("Updated"))
        assertEquals(1, db.memoryDao().count())
        val updatedRow = db.memoryDao().getAll().first().first()
        assertTrue(updatedRow.content.contains("Hinglish"))
        assertEquals(t1 + 5000L, updatedRow.updatedAt)

        // 5. Recall saved memories
        val recallResult = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "What do you remember about me?",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_now",
            nowMillis = t1 + 6000L
        )
        assertTrue(recallResult.handled)
        assertTrue(recallResult.replyText.contains("Hinglish"))

        // 6. Forget specific memory and confirm DB deletion
        val forgetResult = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "Forget my saved Hinglish preference",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_now",
            nowMillis = t1 + 7000L
        )
        assertTrue(forgetResult.handled)
        assertTrue(forgetResult.replyText.contains("Deleted memory"))
        assertEquals(0, db.memoryDao().count())
    }

    @Test
    fun recallYesterdayConversation_retrievesMessagesFromYesterdaySession() = runBlocking {
        val cal = Calendar.getInstance().apply {
            set(2026, Calendar.MAY, 15, 14, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val now = cal.timeInMillis
        val yesterday = now - 86_400_000L

        db.chatSessionDao().insert(
            ChatSessionEntity(
                id = "s_yesterday",
                title = "Room Migration Strategy",
                agentName = "DUM-E",
                createdAt = yesterday,
                updatedAt = yesterday
            )
        )
        db.conversationDao().insert(
            ConversationEntity(
                sessionId = "s_yesterday",
                role = "user",
                text = "Let us add MIGRATION_5_6 to backfill updatedAt cleanly",
                agentName = "Sir",
                timestamp = yesterday
            )
        )

        val res = MemoryCommandEngine.executeIfMemoryCommand(
            prompt = "What did we discuss yesterday?",
            memoryDao = db.memoryDao(),
            chatSessionDao = db.chatSessionDao(),
            conversationDao = db.conversationDao(),
            activeSessionId = "s_today",
            nowMillis = now
        )
        assertTrue(res.handled)
        assertTrue(res.replyText.contains("Room Migration Strategy"))
        assertTrue(res.replyText.contains("MIGRATION_5_6"))
    }

    @Test
    fun retrieveRelevantMemories_ranksQueryRelevanceAndCoreCategoriesAboveGenericFacts() {
        val now = 1_700_200_000_000L
        val pool = listOf(
            MemoryEntity(id = 1, key = "Beverage", category = "FACT", content = "Enjoys espresso", importance = 2, createdAt = now, updatedAt = now),
            MemoryEntity(id = 2, key = "JARVIS Project", category = "PROJECT", content = "Android Kotlin Compose + Node Express backend", importance = 5, createdAt = now, updatedAt = now),
            MemoryEntity(id = 3, key = "Coding Rule", category = "INSTRUCTION", content = "Always include unit tests after code edits", importance = 5, createdAt = now, updatedAt = now)
        )
        val hits = MemoryDeduplicator.retrieveRelevantMemories(
            query = "How should we organize unit tests in our Kotlin Compose project?",
            memories = pool,
            limit = 2,
            nowMillis = now
        )
        assertEquals(2, hits.size)
        val topIds = hits.map { it.id }.toSet()
        assertFalse(topIds.contains(1L))
        assertTrue(topIds.contains(2L) && topIds.contains(3L))
    }
}
