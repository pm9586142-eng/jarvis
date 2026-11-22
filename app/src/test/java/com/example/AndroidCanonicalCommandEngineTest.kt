package com.example

import com.example.ai.AndroidCanonicalCommandEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidCanonicalCommandEngineTest {

    @Test
    fun parse_handlesTimeDateTasksNotesMemoryNavigationAndProtocols() {
        assertEquals("QUERY_TIME", AndroidCanonicalCommandEngine.parse("AM, what time is it?")?.intent)
        assertEquals("QUERY_DATE", AndroidCanonicalCommandEngine.parse("Hey AM AI current date")?.intent)

        val taskCmd = AndroidCanonicalCommandEngine.parse("AM add task: Deploy backend fix")
        assertNotNull(taskCmd)
        assertEquals("CREATE_TASK", taskCmd?.intent)
        assertEquals("Deploy backend fix", taskCmd?.title)

        val noteCmd = AndroidCanonicalCommandEngine.parse("save note Architecture sync. Use free tiers only")
        assertNotNull(noteCmd)
        assertEquals("CREATE_NOTE", noteCmd?.intent)
        assertEquals("Architecture sync", noteCmd?.title)

        val navCmd = AndroidCanonicalCommandEngine.parse("open notes")
        assertEquals("OPEN_SCREEN", navCmd?.intent)
        assertEquals("productivity", navCmd?.screen)
        assertEquals("notes", navCmd?.tab)

        val diagCmd = AndroidCanonicalCommandEngine.parse("run diagnostics")
        assertEquals("RUN_PROTOCOL", diagCmd?.intent)
        assertEquals("DIAGNOSTICS", diagCmd?.protocol)
    }

    @Test
    fun parse_returnsNullForGeneralConversation() {
        assertNull(AndroidCanonicalCommandEngine.parse("Explain how transformers use self-attention"))
        assertNull(AndroidCanonicalCommandEngine.parse("   "))
    }
}
