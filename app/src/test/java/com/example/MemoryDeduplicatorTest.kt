package com.example

import com.example.data.db.ExtractedMemoryCandidate
import com.example.data.db.MemoryDeduplicator
import com.example.data.db.MemoryEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MemoryDeduplicatorTest {

    @Test
    fun normalize_stripsPunctuationAndLowercases() {
        assertEquals(
            "primary stack kotlin jetpack compose",
            MemoryDeduplicator.normalize("  Primary Stack: Kotlin, Jetpack Compose! ")
        )
    }

    @Test
    fun isNearDuplicate_detectsExactAndSemanticOverlap() {
        val existing = listOf(
            MemoryEntity(
                key = "Language",
                category = "PREFERENCE",
                content = "User prefers Hinglish explanations for technical topics",
                importance = 4
            )
        )

        assertTrue(
            MemoryDeduplicator.isNearDuplicate(
                "Language",
                "User prefers Hinglish explanations for technical topics",
                existing
            )
        )

        assertFalse(
            MemoryDeduplicator.isNearDuplicate(
                "Deployment",
                "Backend runs on Express and Google Cloud Run",
                existing
            )
        )
    }

    @Test
    fun filterUniqueCandidates_deduplicatesWithinBatchAndCapsAtThree() {
        val existing = listOf(
            MemoryEntity(
                key = "Editor",
                category = "PREFERENCE",
                content = "Uses Android Studio for Kotlin work",
                importance = 3
            )
        )
        val candidates = listOf(
            ExtractedMemoryCandidate("Editor", "PREFERENCE", "Uses Android Studio for Kotlin work", 3),
            ExtractedMemoryCandidate("Backend", "PROJECT", "Deploys Express backend to Google Cloud Run", 5),
            ExtractedMemoryCandidate("Backend", "PROJECT", "Deploys Express backend to Google Cloud Run", 5),
            ExtractedMemoryCandidate("Goal", "FACT", "Building JARVIS AI voice assistant", 4),
            ExtractedMemoryCandidate("Timezone", "FACT", "Operates in Asia Kolkata timezone", 3),
            ExtractedMemoryCandidate("Extra", "UNKNOWN", "Fourth item should not exceed max of 3", 99)
        )

        val accepted = MemoryDeduplicator.filterUniqueCandidates(candidates, existing)
        assertEquals(3, accepted.size)
        assertEquals("Backend", accepted[0].key)
        assertEquals("Goal", accepted[1].key)
        assertEquals("Timezone", accepted[2].key)
    }
}
