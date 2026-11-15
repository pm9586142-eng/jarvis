package com.example.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.SynapticSpark
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun InsightsScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val allConversations by viewModel.allConversations.collectAsState()
    val sessions by viewModel.chatSessions.collectAsState()
    val memories by viewModel.memories.collectAsState()
    val tasks by viewModel.tasks.collectAsState()

    val stats = remember(allConversations, sessions, memories, tasks) {
        val totalMsgs = allConversations.size
        val voiceMsgs = allConversations.count { it.isVoice }
        val textMsgs = (totalMsgs - voiceMsgs).coerceAtLeast(0)

        val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val labelFmt = SimpleDateFormat("EEE", Locale.getDefault())
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)

        val buckets = (6 downTo 0).map { offset ->
            val dayCal = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -offset) }
            Triple(dayFmt.format(dayCal.time), labelFmt.format(dayCal.time), 0)
        }.toMutableList()

        val indexByKey = buckets.mapIndexed { idx, triple -> triple.first to idx }.toMap()
        for (msg in allConversations) {
            val key = dayFmt.format(Date(msg.timestamp))
            val idx = indexByKey[key]
            if (idx != null) {
                val cur = buckets[idx]
                buckets[idx] = cur.copy(third = cur.third + 1)
            }
        }

        val agentCounts = allConversations
            .filter { it.role == "jarvis" }
            .groupingBy { it.agentName.ifBlank { "JARVIS" } }
            .eachCount()
            .entries
            .sortedByDescending { it.value }
            .take(6)

        val completedTasks = tasks.count { it.isCompleted }
        val totalTasks = tasks.size
        val completionPct = if (totalTasks > 0) (completedTasks * 100) / totalTasks else 0

        InsightsStats(
            totalMessages = totalMsgs,
            voiceMessages = voiceMsgs,
            textMessages = textMsgs,
            dailyCounts = buckets.map { it.second to it.third },
            agentBreakdown = agentCounts.map { it.key to it.value },
            completedTasks = completedTasks,
            totalTasks = totalTasks,
            completionPct = completionPct
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "USAGE & INSIGHTS",
            subtitle = "Neural Activity & Task Telemetry",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .testTag("insights_scroll"),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // KPI Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                InsightKpiTile(
                    label = "MESSAGES",
                    value = stats.totalMessages.toString(),
                    accent = IceBlueBright,
                    modifier = Modifier.weight(1f)
                )
                InsightKpiTile(
                    label = "SESSIONS",
                    value = sessions.size.toString(),
                    accent = SynapticSpark,
                    modifier = Modifier.weight(1f)
                )
                InsightKpiTile(
                    label = "MEMORIES",
                    value = memories.size.toString(),
                    accent = SentinelEmerald,
                    modifier = Modifier.weight(1f)
                )
            }

            // 7-Day Messages/Day Bar Chart (Compose Canvas)
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "7-DAY MESSAGE ACTIVITY",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    val maxCount = (stats.dailyCounts.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(140.dp)
                    ) {
                        val slotW = size.width / stats.dailyCounts.size.coerceAtLeast(1)
                        val barW = slotW * 0.52f
                        val chartH = size.height - 16f
                        drawLine(
                            color = ObsidianGlassBorder,
                            start = Offset(0f, chartH),
                            end = Offset(size.width, chartH),
                            strokeWidth = 2f
                        )
                        stats.dailyCounts.forEachIndexed { idx, (_, count) ->
                            val ratio = count.toFloat() / maxCount.toFloat()
                            val barH = if (count > 0) (chartH * 0.85f * ratio).coerceAtLeast(14f) else 4f
                            val x = idx * slotW + (slotW - barW) / 2f
                            drawRoundRect(
                                color = if (count > 0) IceBlue else ObsidianGlassBorder,
                                topLeft = Offset(x, chartH - barH),
                                size = Size(barW, barH),
                                cornerRadius = CornerRadius(10f, 10f)
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        stats.dailyCounts.forEach { (dayLabel, count) ->
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = count.toString(),
                                    color = MetallicSilver,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = dayLabel,
                                    color = MetallicSilverMuted,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }

            // Agent Distribution Chart (Compose Canvas bars)
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "AGENT DISTRIBUTION",
                        color = SynapticSpark,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    if (stats.agentBreakdown.isEmpty()) {
                        Text(
                            text = "No AI replies recorded yet. Start a Neural Chat to generate analytics.",
                            color = MetallicSilverMuted,
                            fontSize = 12.sp
                        )
                    } else {
                        val maxAgent = (stats.agentBreakdown.maxOfOrNull { it.second } ?: 1).coerceAtLeast(1)
                        stats.agentBreakdown.forEach { (codename, count) ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = codename.take(11),
                                    color = MetallicSilver,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.width(92.dp)
                                )
                                Canvas(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(14.dp)
                                ) {
                                    drawRoundRect(
                                        color = ObsidianGlassBorder,
                                        size = size,
                                        cornerRadius = CornerRadius(12f, 12f)
                                    )
                                    val fillW = (size.width * (count.toFloat() / maxAgent.toFloat())).coerceAtLeast(14f)
                                    drawRoundRect(
                                        color = IceBlueBright,
                                        size = Size(fillW, size.height),
                                        cornerRadius = CornerRadius(12f, 12f)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = count.toString(),
                                    color = IceBlueBright,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            // Task Completion Donut & Voice/Text Split
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Box(
                        modifier = Modifier.size(86.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            drawArc(
                                color = ObsidianGlassBorder,
                                startAngle = 0f,
                                sweepAngle = 360f,
                                useCenter = false,
                                style = Stroke(width = 12f, cap = StrokeCap.Round)
                            )
                            drawArc(
                                color = SentinelEmerald,
                                startAngle = -90f,
                                sweepAngle = (stats.completionPct / 100f) * 360f,
                                useCenter = false,
                                style = Stroke(width = 12f, cap = StrokeCap.Round)
                            )
                        }
                        Text(
                            text = "${stats.completionPct}%",
                            color = MetallicSilver,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "TASK EFFICIENCY & MODALITY SPLIT",
                            color = SentinelEmerald,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "${stats.completedTasks}/${stats.totalTasks} tasks complete",
                            color = MetallicSilver,
                            fontSize = 12.5.sp
                        )
                        val voicePct = if (stats.totalMessages > 0) (stats.voiceMessages * 100) / stats.totalMessages else 0
                        Canvas(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(10.dp)
                        ) {
                            drawRoundRect(
                                color = ObsidianGlassBorder,
                                size = size,
                                cornerRadius = CornerRadius(10f, 10f)
                            )
                            if (voicePct > 0) {
                                drawRoundRect(
                                    color = QuantumGold,
                                    size = Size(size.width * (voicePct / 100f), size.height),
                                    cornerRadius = CornerRadius(10f, 10f)
                                )
                            }
                        }
                        Text(
                            text = "Voice: ${stats.voiceMessages} ($voicePct%) • Text: ${stats.textMessages}",
                            color = MetallicSilverMuted,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InsightKpiTile(
    label: String,
    value: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    NeuralGlassCard(modifier = modifier, borderColor = accent.copy(alpha = 0.35f)) {
        Column {
            Text(
                text = label,
                color = MetallicSilverMuted,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Text(
                text = value,
                color = accent,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

private data class InsightsStats(
    val totalMessages: Int,
    val voiceMessages: Int,
    val textMessages: Int,
    val dailyCounts: List<Pair<String, Int>>,
    val agentBreakdown: List<Pair<String, Int>>,
    val completedTasks: Int,
    val totalTasks: Int,
    val completionPct: Int
)
