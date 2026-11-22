package com.example.ai

data class AndroidRoutingDecision(
    val target: String, // "cloud" | "local_litert" | "offline_guidance"
    val attribution: String,
    val reason: String,
    val allowFallbackToLocal: Boolean
)

enum class AndroidAiRoutingMode {
    HYBRID,
    ONLINE_ONLY,
    LOCAL_ONLY,
    OFFLINE_COMMAND
}

object AndroidHybridAiRouter {
    fun resolve(
        mode: AndroidAiRoutingMode,
        browserOnline: Boolean,
        backendReachable: Boolean,
        cloudAiConfigured: Boolean,
        localModelInstalled: Boolean
    ): AndroidRoutingDecision {
        val cloudReady = browserOnline && backendReachable && cloudAiConfigured

        if (mode == AndroidAiRoutingMode.OFFLINE_COMMAND) {
            return AndroidRoutingDecision(
                target = "offline_guidance",
                attribution = "Offline Command Engine",
                reason = "Offline Command mode is active — executing deterministic commands only.",
                allowFallbackToLocal = false
            )
        }

        if (mode == AndroidAiRoutingMode.LOCAL_ONLY) {
            if (localModelInstalled) {
                return AndroidRoutingDecision(
                    target = "local_litert",
                    attribution = "LiteRT On-Device AI",
                    reason = "Local-Only mode using installed LiteRT model.",
                    allowFallbackToLocal = false
                )
            }
            return AndroidRoutingDecision(
                target = "offline_guidance",
                attribution = "Offline Command Engine",
                reason = "No local LiteRT model is installed yet. Open Settings > Local Models to download one.",
                allowFallbackToLocal = false
            )
        }

        if (mode == AndroidAiRoutingMode.ONLINE_ONLY) {
            if (cloudReady) {
                return AndroidRoutingDecision(
                    target = "cloud",
                    attribution = "Cloud AI",
                    reason = "Online-Only mode via free Cloud AI backend.",
                    allowFallbackToLocal = false
                )
            }
            return AndroidRoutingDecision(
                target = "offline_guidance",
                attribution = "Offline Command Engine",
                reason = if (!browserOnline) "Device is offline and Online-Only mode is selected." else "Cloud AI backend is unavailable or unconfigured.",
                allowFallbackToLocal = false
            )
        }

        // Default: Hybrid (Cloud first with local fallback)
        if (cloudReady) {
            return AndroidRoutingDecision(
                target = "cloud",
                attribution = "Cloud AI",
                reason = "Hybrid mode: using Cloud AI with local LiteRT fallback ready.",
                allowFallbackToLocal = localModelInstalled
            )
        }

        if (localModelInstalled) {
            return AndroidRoutingDecision(
                target = "local_litert",
                attribution = "LiteRT On-Device AI",
                reason = "Cloud unavailable — automatically routed to on-device LiteRT AI.",
                allowFallbackToLocal = false
            )
        }

        return AndroidRoutingDecision(
            target = "offline_guidance",
            attribution = "Offline Command Engine",
            reason = if (!browserOnline) "You are offline and no local model is installed. Offline commands, tasks, notes, and memory still work." else "Cloud AI is currently unreachable and no local model is installed yet.",
            allowFallbackToLocal = false
        )
    }
}
