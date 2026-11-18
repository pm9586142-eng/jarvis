package com.example.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        MemoryEntity::class,
        ConversationEntity::class,
        ChatSessionEntity::class,
        TaskEntity::class,
        SecurityLogEntity::class,
        CustomAgentEntity::class
    ],
    version = 7,
    exportSchema = false
)
abstract class JarvisDatabase : RoomDatabase() {
    abstract fun memoryDao(): MemoryDao
    abstract fun conversationDao(): ConversationDao
    abstract fun chatSessionDao(): ChatSessionDao
    abstract fun taskDao(): TaskDao
    abstract fun securityLogDao(): SecurityLogDao
    abstract fun customAgentDao(): CustomAgentDao

    companion object {
        @Volatile
        private var INSTANCE: JarvisDatabase? = null

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `chat_sessions` (
                        `id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `agentName` TEXT NOT NULL,
                        `createdAt` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    "ALTER TABLE `conversations` ADD COLUMN `isError` INTEGER NOT NULL DEFAULT 0"
                )
                db.execSQL(
                    """
                    INSERT OR IGNORE INTO `chat_sessions` (`id`, `title`, `agentName`, `createdAt`, `updatedAt`)
                    SELECT 'default_session', 'Primary Neural Link', 'JARVIS',
                           COALESCE(MIN(timestamp), 0), COALESCE(MAX(timestamp), 0)
                    FROM `conversations` WHERE `sessionId` = 'default_session'
                    """.trimIndent()
                )
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE `tasks` ADD COLUMN `triggerAtMillis` INTEGER"
                )
            }
        }

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `conversations` ADD COLUMN `attachmentName` TEXT")
                db.execSQL("ALTER TABLE `conversations` ADD COLUMN `attachmentMimeType` TEXT")
                db.execSQL("ALTER TABLE `conversations` ADD COLUMN `attachmentUri` TEXT")
            }
        }

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `custom_agents` (
                        `id` TEXT NOT NULL,
                        `name` TEXT NOT NULL,
                        `codename` TEXT NOT NULL,
                        `systemPrompt` TEXT NOT NULL,
                        `colorHex` INTEGER NOT NULL,
                        `keywords` TEXT NOT NULL,
                        `createdAt` INTEGER NOT NULL,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent()
                )
            }
        }

        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE `memories` ADD COLUMN `updatedAt` INTEGER NOT NULL DEFAULT 0"
                )
                db.execSQL(
                    "UPDATE `memories` SET `updatedAt` = `createdAt` WHERE `updatedAt` = 0"
                )
            }
        }

        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE `tasks` ADD COLUMN `syncId` TEXT NOT NULL DEFAULT ''"
                )
                db.execSQL(
                    "ALTER TABLE `tasks` ADD COLUMN `ownerUid` TEXT NOT NULL DEFAULT ''"
                )
                db.execSQL(
                    "ALTER TABLE `tasks` ADD COLUMN `updatedAt` INTEGER NOT NULL DEFAULT 0"
                )
                db.execSQL(
                    "ALTER TABLE `tasks` ADD COLUMN `isDeleted` INTEGER NOT NULL DEFAULT 0"
                )
                db.execSQL(
                    "ALTER TABLE `tasks` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'PENDING_UPSERT'"
                )
                db.execSQL(
                    "UPDATE `tasks` SET `syncId` = 'task_legacy_' || `id` || '_' || `createdAt` WHERE `syncId` = ''"
                )
                db.execSQL(
                    "UPDATE `tasks` SET `updatedAt` = `createdAt` WHERE `updatedAt` = 0"
                )
                db.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS `index_tasks_syncId` ON `tasks` (`syncId`)"
                )
            }
        }

        fun getDatabase(context: Context): JarvisDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    JarvisDatabase::class.java,
                    "jarvis_core.db"
                )
                    .addMigrations(
                        MIGRATION_1_2,
                        MIGRATION_2_3,
                        MIGRATION_3_4,
                        MIGRATION_4_5,
                        MIGRATION_5_6,
                        MIGRATION_6_7
                    )
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
