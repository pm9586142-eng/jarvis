package com.example.ai

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID
import kotlin.math.ceil

data class AiRequestTelemetry(
    val id: String = UUID.randomUUID().toString(),
    val timestampMs: Long = System.currentTimeMillis(),
    val promptPreview: String,
    val promptChars: Int,
    val estimatedPromptTokens: Int,
    val localRoutingMs: Long,
    val backendConnectMs: Long,
    val ttftMs: Long,
    val totalMs: Long,
    val provider: String,
    val model: String,
    val retries: Int,
    val routePath: String,
    val success: Boolean,
    val errorCode: String? = null
)

data class RequestTelemetrySummary(
    val entries: List<AiRequestTelemetry> = emptyList(),
    val p50TtftMs: Long = 0L,
    val p95TtftMs: Long = 0L,
    val p50TotalMs: Long = 0L,
    val p95TotalMs: Long = 0L,
    val avgLocalRoutingMs: Long = 0L,
    val avgBackendConnectMs: Long = 0L,
    val avgPromptTokens: Int = 0,
    val totalRequests: Int = 0,
    val bottleneckDiagnosis: String = "No requests measured yet. Send a message to capture real latency."
)

/**
 * Measures per-request AI pipeline timings (last 20 requests) and computes p50/p95 latency +
 * automated bottleneck attribution for Ecosystem Diagnostics.
 */
class RequestTelemetryTracker {
    private val lock = Any()
    private val buffer = ArrayDeque<AiRequestTelemetry>(MAX_ENTRIES)

    private val _summary = MutableStateFlow(RequestTelemetrySummary())
    val summary: StateFlow<RequestTelemetrySummary> = _summary.asStateFlow()

    fun record(entry: AiRequestTelemetry) {
        synchronized(lock) {
            if (buffer.size >= MAX_ENTRIES) {
                buffer.removeLast()
            }
            buffer.addFirst(entry)
            _summary.value = computeSummaryLocked()
        }
    }

    fun clear() {
        synchronized(lock) {
            buffer.clear()
            _summary.value = RequestTelemetrySummary()
        }
    }

    fun getSnapshot(): RequestTelemetrySummary = synchronized(lock) {
        computeSummaryLocked()
    }

    private fun computeSummaryLocked(): RequestTelemetrySummary {
        val list = buffer.toList()
        if (list.isEmpty()) return RequestTelemetrySummary()

        val validTtft = list.map { it.ttftMs }.filter { it > 0L }.sorted()
        val validTotal = list.map { it.totalMs }.filter { it > 0L }.sorted()

        val p50Ttft = percentile(validTtft, 0.50)
        val p95Ttft = percentile(validTtft, 0.95)
        val p50Total = percentile(validTotal, 0.50)
        val p95Total = percentile(validTotal, 0.95)
        val avgLocal = list.map { it.localRoutingMs }.average().toLong()
        val avgBackend = list.filter { it.backendConnectMs > 0L }.map { it.backendConnectMs }.let {
            if (it.isEmpty()) 0L else it.average().toLong()
        }
        val avgTokens = list.map { it.estimatedPromptTokens }.average().toInt()

        val diagnosis = diagnoseBottleneck(
            entries = list,
            p50Ttft = p50Ttft,
            p95Ttft = p95Ttft,
            avgBackendConnect = avgBackend,
            avgLocalRouting = avgLocal,
            avgPromptTokens = avgTokens
        )

        return RequestTelemetrySummary(
            entries = list,
            p50TtftMs = p50Ttft,
            p95TtftMs = p95Ttft,
            p50TotalMs = p50Total,
            p95TotalMs = p95Total,
            avgLocalRoutingMs = avgLocal,
            avgBackendConnectMs = avgBackend,
            avgPromptTokens = avgTokens,
            totalRequests = list.size,
            bottleneckDiagnosis = diagnosis
        )
    }

    companion object {
        const val MAX_ENTRIES = 20

        fun estimateTokens(charCount: Int): Int {
            return if (charCount <= 0) 0 else ((charCount + 3) / 4).coerceAtLeast(1)
        }

        fun percentile(sortedValues: List<Long>, ratio: Double): Long {
            if (sortedValues.isEmpty()) return 0L
            val index = (ceil(sortedValues.size * ratio).toInt() - 1)
                .coerceIn(0, sortedValues.lastIndex)
            return sortedValues[index]
        }

        fun diagnoseBottleneck(
            entries: List<AiRequestTelemetry>,
            p50Ttft: Long,
            p95Ttft: Long,
            avgBackendConnect: Long,
            avgLocalRouting: Long,
            avgPromptTokens: Int
        ): String {
            val totalRetries = entries.sumOf { it.retries }
            val failures = entries.count { !it.success }
            return when {
                avgBackendConnect >= 2500L && avgBackendConnect >= (p50Ttft * 0.45).toLong() ->
                    "Biggest bottleneck: Backend cold-start / proxy connect (${avgBackendConnect}ms avg). Circuit breaker & fast-tier direct failover active."
                totalRetries >= 3 || failures >= 3 ->
                    "Biggest bottleneck: Upstream retry/failover overhead ($totalRetries retries across ${entries.size} calls). Model cooldown & fast-skip engaged."
                avgLocalRouting >= 250L ->
                    "Biggest bottleneck: Pre-stream local routing / DB assembly (${avgLocalRouting}ms avg)."
                p95Ttft >= 3500L || p50Ttft >= 2200L ->
                    "Biggest bottleneck: Upstream model TTFT (p50 ${p50Ttft}ms, p95 ${p95Ttft}ms, ~$avgPromptTokens prompt tokens)."
                else ->
                    "Pipeline healthy & fast: p50 TTFT ${p50Ttft}ms (p95 ${p95Ttft}ms), local routing ${avgLocalRouting}ms."
            }
        }
    }
}
