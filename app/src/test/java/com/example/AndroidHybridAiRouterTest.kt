package com.example

import com.example.ai.AndroidAiRoutingMode
import com.example.ai.AndroidHybridAiRouter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidHybridAiRouterTest {

    @Test
    fun resolve_prefersCloudInHybridWhenOnlineAndConfigured() {
        val decision = AndroidHybridAiRouter.resolve(
            mode = AndroidAiRoutingMode.HYBRID,
            browserOnline = true,
            backendReachable = true,
            cloudAiConfigured = true,
            localModelInstalled = true
        )
        assertEquals("cloud", decision.target)
        assertTrue(decision.allowFallbackToLocal)
    }

    @Test
    fun resolve_fallsBackToLocalOrGuidanceWhenOffline() {
        val withLocal = AndroidHybridAiRouter.resolve(
            mode = AndroidAiRoutingMode.HYBRID,
            browserOnline = false,
            backendReachable = false,
            cloudAiConfigured = true,
            localModelInstalled = true
        )
        assertEquals("local_litert", withLocal.target)
        assertFalse(withLocal.allowFallbackToLocal)

        val withoutLocal = AndroidHybridAiRouter.resolve(
            mode = AndroidAiRoutingMode.HYBRID,
            browserOnline = false,
            backendReachable = false,
            cloudAiConfigured = true,
            localModelInstalled = false
        )
        assertEquals("offline_guidance", withoutLocal.target)
    }

    @Test
    fun resolve_honorsExplicitLocalAndOfflineModes() {
        assertEquals(
            "local_litert",
            AndroidHybridAiRouter.resolve(
                mode = AndroidAiRoutingMode.LOCAL_ONLY,
                browserOnline = true,
                backendReachable = true,
                cloudAiConfigured = true,
                localModelInstalled = true
            ).target
        )
        assertEquals(
            "offline_guidance",
            AndroidHybridAiRouter.resolve(
                mode = AndroidAiRoutingMode.OFFLINE_COMMAND,
                browserOnline = true,
                backendReachable = true,
                cloudAiConfigured = true,
                localModelInstalled = true
            ).target
        )
    }
}
