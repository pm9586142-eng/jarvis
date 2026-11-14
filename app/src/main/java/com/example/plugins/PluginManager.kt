package com.example.plugins

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// 1. Trello / Asana Kanban Project Management Plugin
class TrelloKanbanPlugin : JarvisPlugin {
    override val id = "plugin_trello_asana"
    override val name = "Trello & Asana Project Kanban"
    override val version = "2.4.0"
    override val author = "Stark Industries Automation"
    override val description = "Syncs with Agile boards, creates cards, tracks sprint velocity, and moves tasks across workflow columns."
    override val category = "Project Management"
    override var isEnabled: Boolean = true

    // In-memory demo board state
    val boardCards = mutableListOf(
        Triple("PROJ-101", "Initialize Arc Reactor telemetry streaming", "In Progress"),
        Triple("PROJ-102", "Deploy neural voice pipeline to mobile edge", "To Do"),
        Triple("PROJ-103", "Audit satellite uplink latency with VERONICA", "Done"),
        Triple("PROJ-104", "Integrate Asana sprint milestone webhook", "In Progress")
    )

    override fun getDeclaredTools(): List<PluginTool> = listOf(
        PluginTool("list_board", "List Kanban Board", "Fetches current cards across sprint columns", emptyList()),
        PluginTool("create_card", "Create Card", "Adds a new task card to the board", listOf("title", "column")),
        PluginTool("move_card", "Move Card", "Moves a card to To Do, In Progress, or Done", listOf("card_id", "column"))
    )

    override suspend fun executeTool(toolId: String, parameters: Map<String, String>): PluginExecutionResult {
        return when (toolId) {
            "list_board" -> {
                val formatted = boardCards.joinToString("\n") { (id, title, col) ->
                    "• [$id] $title -> [$col]"
                }
                PluginExecutionResult(
                    success = true,
                    summary = "Fetched ${boardCards.size} cards from Stark Project Board:\n$formatted",
                    payload = mapOf("total_cards" to boardCards.size.toString())
                )
            }
            "create_card" -> {
                val title = parameters["title"] ?: "Untitled Task"
                val column = parameters["column"] ?: "To Do"
                val cardId = "PROJ-${boardCards.size + 105}"
                boardCards.add(Triple(cardId, title, column))
                PluginExecutionResult(
                    success = true,
                    summary = "Created card [$cardId] '$title' in column [$column].",
                    payload = mapOf("card_id" to cardId, "title" to title, "column" to column)
                )
            }
            "move_card" -> {
                val cardId = parameters["card_id"] ?: ""
                val targetCol = parameters["column"] ?: "Done"
                val index = boardCards.indexOfFirst { it.first.equals(cardId, ignoreCase = true) }
                if (index != -1) {
                    val current = boardCards[index]
                    boardCards[index] = Triple(current.first, current.second, targetCol)
                    PluginExecutionResult(
                        success = true,
                        summary = "Card [${current.first}] '${current.second}' updated to [$targetCol].",
                        payload = mapOf("card_id" to current.first, "new_column" to targetCol)
                    )
                } else {
                    PluginExecutionResult(false, "Card with ID '$cardId' was not found on board.")
                }
            }
            else -> PluginExecutionResult(false, "Unknown tool: $toolId")
        }
    }
}

// 2. GitHub DevOps & CI/CD Plugin
class GitHubDevOpsPlugin : JarvisPlugin {
    override val id = "plugin_github_devops"
    override val name = "GitHub & CI/CD Sentinel"
    override val version = "1.8.2"
    override val author = "Stark Labs DevOps"
    override val description = "Monitors repositories, checks pull requests, and dispatches automated integration testing workflows."
    override val category = "Developer Tools"
    override var isEnabled: Boolean = true

    override fun getDeclaredTools(): List<PluginTool> = listOf(
        PluginTool("repo_status", "Repository Status", "Returns branch and active pull requests", emptyList()),
        PluginTool("run_workflow", "Trigger CI/CD Workflow", "Dispatches automated build test suite", listOf("workflow_name"))
    )

    override suspend fun executeTool(toolId: String, parameters: Map<String, String>): PluginExecutionResult {
        return when (toolId) {
            "repo_status" -> {
                PluginExecutionResult(
                    success = true,
                    summary = """
                        Repo: stark-industries/jarvis-neural-core
                        Branch: main (Clean, up to date with origin)
                        Commit: 8f4a9b2 (Awakening of Intelligence v2050)
                        Open PRs: 2 active (PR #42: Quantum Audio DSP, PR #43: Neural Mesh)
                        CI Status: ALL 14 JOBS PASSING (Green)
                    """.trimIndent(),
                    payload = mapOf("status" to "healthy", "branch" to "main")
                )
            }
            "run_workflow" -> {
                val wf = parameters["workflow_name"] ?: "smoke-tests"
                PluginExecutionResult(
                    success = true,
                    summary = "Workflow '$wf' dispatched to GitHub Actions runner. Build #108 running...",
                    payload = mapOf("workflow" to wf, "build_id" to "108")
                )
            }
            else -> PluginExecutionResult(false, "Unknown tool: $toolId")
        }
    }
}

// 3. Home Assistant Smart Home Plugin
class HomeAssistantPlugin : JarvisPlugin {
    override val id = "plugin_home_assistant"
    override val name = "Home Assistant Bridge"
    override val version = "3.1.0"
    override val author = "Home Assistant Community"
    override val description = "Full bidirectional control of Zigbee, Matter, and Wi-Fi smart devices with custom automation routines."
    override val category = "Smart Home"
    override var isEnabled: Boolean = true

    override fun getDeclaredTools(): List<PluginTool> = listOf(
        PluginTool("activate_scene", "Activate Scene", "Triggers predefined lighting and climate scenes", listOf("scene_name")),
        PluginTool("get_climate", "Climate Telemetry", "Fetches environmental temperature and air quality", emptyList())
    )

    override suspend fun executeTool(toolId: String, parameters: Map<String, String>): PluginExecutionResult {
        return when (toolId) {
            "activate_scene" -> {
                val scene = parameters["scene_name"] ?: "Stark Lab Focus"
                PluginExecutionResult(
                    success = true,
                    summary = "Scene '$scene' activated. Lights set to Ice-Blue 4000K, climate set to 21.5°C.",
                    payload = mapOf("scene" to scene)
                )
            }
            "get_climate" -> {
                PluginExecutionResult(
                    success = true,
                    summary = "Indoor Climate: 21.8°C | Humidity: 46% | Air Quality: 99 (Pristine) | HVAC: Eco Mode",
                    payload = mapOf("temp" to "21.8C", "aqi" to "99")
                )
            }
            else -> PluginExecutionResult(false, "Unknown tool: $toolId")
        }
    }
}

class PluginManager {
    private val plugins = listOf(
        TrelloKanbanPlugin(),
        GitHubDevOpsPlugin(),
        HomeAssistantPlugin()
    )

    private val _pluginList = MutableStateFlow(plugins)
    val pluginList: StateFlow<List<JarvisPlugin>> = _pluginList.asStateFlow()

    fun togglePlugin(id: String) {
        val current = _pluginList.value
        val target = current.find { it.id == id }
        if (target != null) {
            target.isEnabled = !target.isEnabled
            // Trigger state emission
            _pluginList.value = ArrayList(current)
        }
    }

    fun getActivePlugins(): List<JarvisPlugin> {
        return _pluginList.value.filter { it.isEnabled }
    }

    suspend fun executePluginTool(pluginId: String, toolId: String, params: Map<String, String>): PluginExecutionResult {
        val plugin = _pluginList.value.find { it.id == pluginId }
            ?: return PluginExecutionResult(false, "Plugin not found: $pluginId")
        if (!plugin.isEnabled) {
            return PluginExecutionResult(false, "Plugin '${plugin.name}' is currently disabled.")
        }
        return plugin.executeTool(toolId, params)
    }
}
