package com.example.agents

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AgentCollaborationLog(
    val id: String = "collab_${System.currentTimeMillis()}",
    val fromAgent: JarvisAgent,
    val toAgent: JarvisAgent,
    val action: String,
    val detail: String,
    val timestamp: Long = System.currentTimeMillis()
)

class MultiAgentSystem {
    private val _logs = MutableStateFlow<List<AgentCollaborationLog>>(
        listOf(
            AgentCollaborationLog(
                fromAgent = JarvisAgent.JARVIS_PRIME,
                toAgent = JarvisAgent.HOMER_DIAGNOSTICS,
                action = "Subsystem Health Check",
                detail = "Telemetry polling executed. Nominal memory and power levels verified."
            ),
            AgentCollaborationLog(
                fromAgent = JarvisAgent.JARVIS_PRIME,
                toAgent = JarvisAgent.FRIDAY_COORDINATOR,
                action = "Agenda Synchronization",
                detail = "Daily briefing and pending reminders aligned with owner priorities."
            ),
            AgentCollaborationLog(
                fromAgent = JarvisAgent.JARVIS_PRIME,
                toAgent = JarvisAgent.VERONICA_RESEARCH,
                action = "Satellite Uplink Handshake",
                detail = "Live global intelligence channels standing by."
            )
        )
    )
    val logs: StateFlow<List<AgentCollaborationLog>> = _logs.asStateFlow()

    fun routeIntent(prompt: String): JarvisAgent {
        val p = prompt.lowercase()
        return when {
            p.contains("code") || p.contains("program") || p.contains("script") ||
            p.contains("python") || p.contains("kotlin") || p.contains("javascript") ||
            p.contains("bug") || p.contains("debug") || p.contains("algorithm") ||
            p.contains("function") || p.contains("api") || p.contains("developer") -> {
                JarvisAgent.DUM_E_ENGINEER
            }

            p.contains("search") || p.contains("weather") || p.contains("news") ||
            p.contains("fact") || p.contains("research") || p.contains("who is") ||
            p.contains("what is") || p.contains("wikipedia") || p.contains("latest") -> {
                JarvisAgent.VERONICA_RESEARCH
            }

            p.contains("task") || p.contains("schedule") || p.contains("reminder") ||
            p.contains("calendar") || p.contains("meeting") || p.contains("to-do") ||
            p.contains("todo") || p.contains("briefing") || p.contains("plan") -> {
                JarvisAgent.FRIDAY_COORDINATOR
            }

            p.contains("ram") || p.contains("storage") || p.contains("battery") ||
            p.contains("terminal") || p.contains("security") || p.contains("defcon") ||
            p.contains("cpu") || p.contains("system") || p.contains("hardware") ||
            p.contains("lockdown") || p.contains("audit") -> {
                JarvisAgent.HOMER_DIAGNOSTICS
            }

            else -> JarvisAgent.JARVIS_PRIME
        }
    }

    fun recordCollaboration(from: JarvisAgent, to: JarvisAgent, action: String, detail: String) {
        val entry = AgentCollaborationLog(
            fromAgent = from,
            toAgent = to,
            action = action,
            detail = detail
        )
        val updated = ArrayList(_logs.value)
        updated.add(0, entry)
        if (updated.size > 20) {
            updated.removeAt(updated.size - 1)
        }
        _logs.value = updated
    }
}
