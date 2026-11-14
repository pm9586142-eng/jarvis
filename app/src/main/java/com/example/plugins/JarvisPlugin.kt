package com.example.plugins

data class PluginTool(
    val id: String,
    val name: String,
    val description: String,
    val requiredParameters: List<String>
)

data class PluginExecutionResult(
    val success: Boolean,
    val summary: String,
    val payload: Map<String, String> = emptyMap()
)

interface JarvisPlugin {
    val id: String
    val name: String
    val version: String
    val author: String
    val description: String
    val category: String
    var isEnabled: Boolean

    fun getDeclaredTools(): List<PluginTool>
    suspend fun executeTool(toolId: String, parameters: Map<String, String>): PluginExecutionResult
}
