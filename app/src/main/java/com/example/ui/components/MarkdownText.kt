package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.ObsidianSurface
import com.example.ui.theme.SentinelEmerald
import kotlinx.coroutines.delay

private sealed class MdBlock {
    data class Code(val language: String, val code: String) : MdBlock()
    data class Heading(val level: Int, val text: String) : MdBlock()
    data class Blockquote(val lines: List<String>) : MdBlock()
    data class UnorderedList(val items: List<String>) : MdBlock()
    data class OrderedList(val items: List<String>) : MdBlock()
    data class Table(val headers: List<String>, val rows: List<List<String>>) : MdBlock()
    data object HorizontalRule : MdBlock()
    data class Paragraph(val text: String) : MdBlock()
}

private val TABLE_SEP_CELL_REGEX = Regex("^:?-{2,}:?$")
private val HEADING_REGEX = Regex("^(#{1,4})\\s+(.+)$")
private val HR_REGEX = Regex("^(-{3,}|\\*{3,}|_{3,})$")
private val UL_LINE_REGEX = Regex("^\\s*[-*+]\\s+.*")
private val UL_PREFIX_REGEX = Regex("^\\s*[-*+]\\s+")
private val OL_LINE_REGEX = Regex("^\\s*\\d+\\.\\s+.*")
private val OL_PREFIX_REGEX = Regex("^\\s*\\d+\\.\\s+")

private fun isTableSeparatorLine(line: String): Boolean {
    val trimmed = line.trim()
    if (!trimmed.contains("|") && !trimmed.contains("-")) return false
    val cells = trimmed
        .removePrefix("|")
        .removeSuffix("|")
        .split("|")
        .map { it.trim() }
    return cells.isNotEmpty() && cells.all { TABLE_SEP_CELL_REGEX.matches(it) }
}

private fun splitTableCells(line: String): List<String> {
    return line.trim()
        .removePrefix("|")
        .removeSuffix("|")
        .split("|")
        .map { it.trim() }
}

private fun parseMarkdownBlocks(raw: String): List<MdBlock> {
    val lines = raw.replace("\r\n", "\n").split("\n")
    val blocks = mutableListOf<MdBlock>()
    var i = 0

    while (i < lines.size) {
        val line = lines[i]
        val trimmed = line.trim()

        if (trimmed.isEmpty()) {
            i++
            continue
        }

        if (trimmed.startsWith("```")) {
            val lang = trimmed.removePrefix("```").trim().ifBlank { "code" }
            val codeLines = mutableListOf<String>()
            i++
            while (i < lines.size && !lines[i].trim().startsWith("```")) {
                codeLines.add(lines[i])
                i++
            }
            if (i < lines.size && lines[i].trim().startsWith("```")) {
                i++
            }
            blocks.add(MdBlock.Code(lang, codeLines.joinToString("\n")))
            continue
        }

        if (HR_REGEX.matches(trimmed)) {
            blocks.add(MdBlock.HorizontalRule)
            i++
            continue
        }

        val headingMatch = HEADING_REGEX.matchEntire(trimmed)
        if (headingMatch != null) {
            blocks.add(
                MdBlock.Heading(
                    level = headingMatch.groupValues[1].length,
                    text = headingMatch.groupValues[2]
                )
            )
            i++
            continue
        }

        if (trimmed.contains("|") && i + 1 < lines.size && isTableSeparatorLine(lines[i + 1])) {
            val headers = splitTableCells(trimmed)
            i += 2
            val rows = mutableListOf<List<String>>()
            while (i < lines.size && lines[i].trim().contains("|") && lines[i].trim().isNotEmpty()) {
                rows.add(splitTableCells(lines[i]))
                i++
            }
            blocks.add(MdBlock.Table(headers, rows))
            continue
        }

        if (trimmed.startsWith(">")) {
            val quoteLines = mutableListOf<String>()
            while (i < lines.size && lines[i].trim().startsWith(">")) {
                quoteLines.add(lines[i].trim().removePrefix(">").trimStart())
                i++
            }
            blocks.add(MdBlock.Blockquote(quoteLines))
            continue
        }

        if (UL_LINE_REGEX.matches(line)) {
            val items = mutableListOf<String>()
            while (i < lines.size && UL_LINE_REGEX.matches(lines[i])) {
                items.add(lines[i].replaceFirst(UL_PREFIX_REGEX, ""))
                i++
            }
            blocks.add(MdBlock.UnorderedList(items))
            continue
        }

        if (OL_LINE_REGEX.matches(line)) {
            val items = mutableListOf<String>()
            while (i < lines.size && OL_LINE_REGEX.matches(lines[i])) {
                items.add(lines[i].replaceFirst(OL_PREFIX_REGEX, ""))
                i++
            }
            blocks.add(MdBlock.OrderedList(items))
            continue
        }

        val paraLines = mutableListOf(line)
        i++
        while (i < lines.size) {
            val next = lines[i]
            val nextTrimmed = next.trim()
            if (nextTrimmed.isEmpty() ||
                nextTrimmed.startsWith("```") ||
                HEADING_REGEX.matches(nextTrimmed) ||
                HR_REGEX.matches(nextTrimmed) ||
                nextTrimmed.startsWith(">") ||
                UL_LINE_REGEX.matches(next) ||
                OL_LINE_REGEX.matches(next) ||
                (nextTrimmed.contains("|") && i + 1 < lines.size && isTableSeparatorLine(lines[i + 1]))
            ) {
                break
            }
            paraLines.add(next)
            i++
        }
        blocks.add(MdBlock.Paragraph(paraLines.joinToString("\n")))
    }

    return blocks
}

private val INLINE_TOKEN_REGEX = Regex(
    "(`[^`]+`|\\[[^\\]]+\\]\\([^)]+\\)|\\*\\*[^*]+\\*\\*|__[^_]+__|\\*[^*\\n]+\\*|_[^_\\n]+_)"
)
private val LINK_REGEX = Regex("^\\[([^\\]]+)\\]\\(([^)]+)\\)$")

private fun isSafeExternalUrl(url: String): Boolean {
    val lower = url.trim().lowercase()
    return lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("mailto:")
}

private fun buildInlineAnnotatedString(text: String): AnnotatedString {
    return buildAnnotatedString {
        var cursor = 0
        for (match in INLINE_TOKEN_REGEX.findAll(text)) {
            if (match.range.first > cursor) {
                append(text.substring(cursor, match.range.first))
            }
            val token = match.value
            when {
                token.startsWith("`") && token.endsWith("`") && token.length >= 2 -> {
                    withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color(0xFF071324),
                            color = IceBlueBright,
                            fontSize = 12.5.sp
                        )
                    ) {
                        append(" ${token.substring(1, token.length - 1)} ")
                    }
                }
                LINK_REGEX.matches(token) -> {
                    val m = LINK_REGEX.matchEntire(token)!!
                    val label = m.groupValues[1]
                    val url = m.groupValues[2].trim()
                    if (isSafeExternalUrl(url)) {
                        withLink(
                            LinkAnnotation.Url(
                                url = url,
                                styles = TextLinkStyles(
                                    style = SpanStyle(
                                        color = IceBlueBright,
                                        textDecoration = TextDecoration.Underline,
                                        fontWeight = FontWeight.Medium
                                    )
                                )
                            )
                        ) {
                            append(label)
                        }
                    } else {
                        append(label)
                    }
                }
                (token.startsWith("**") && token.endsWith("**") && token.length > 4) ||
                    (token.startsWith("__") && token.endsWith("__") && token.length > 4) -> {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Color.White)) {
                        append(token.substring(2, token.length - 2))
                    }
                }
                (token.startsWith("*") && token.endsWith("*") && token.length > 2) ||
                    (token.startsWith("_") && token.endsWith("_") && token.length > 2) -> {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = MetallicSilver)) {
                        append(token.substring(1, token.length - 1))
                    }
                }
                else -> append(token)
            }
            cursor = match.range.last + 1
        }
        if (cursor < text.length) {
            append(text.substring(cursor))
        }
    }
}

@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier
) {
    val blocks = remember(markdown) { parseMarkdownBlocks(markdown) }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        blocks.forEach { block ->
            when (block) {
                is MdBlock.Code -> MarkdownCodeBlock(language = block.language, code = block.code)

                is MdBlock.Heading -> {
                    val size = when (block.level) {
                        1 -> 16.sp
                        2 -> 15.sp
                        else -> 14.sp
                    }
                    Text(
                        text = buildInlineAnnotatedString(block.text),
                        color = IceBlueBright,
                        fontSize = size,
                        fontWeight = FontWeight.Bold,
                        lineHeight = (size.value + 5).sp
                    )
                }

                is MdBlock.HorizontalRule -> {
                    HorizontalDivider(color = ObsidianGlassBorder, thickness = 1.dp)
                }

                is MdBlock.Blockquote -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(IntrinsicSize.Min)
                            .clip(RoundedCornerShape(8.dp))
                            .background(IceBlue.copy(alpha = 0.08f))
                    ) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .fillMaxHeight()
                                .background(IceBlue)
                        )
                        Column(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            block.lines.forEach { qLine ->
                                Text(
                                    text = buildInlineAnnotatedString(qLine),
                                    color = MetallicSilver,
                                    fontSize = 13.sp,
                                    lineHeight = 19.sp
                                )
                            }
                        }
                    }
                }

                is MdBlock.UnorderedList -> {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        block.items.forEach { item ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(
                                    text = "•",
                                    color = IceBlueBright,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                                Text(
                                    text = buildInlineAnnotatedString(item),
                                    color = MetallicSilverLight,
                                    fontSize = 13.5.sp,
                                    lineHeight = 20.sp,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                is MdBlock.OrderedList -> {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        block.items.forEachIndexed { idx, item ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(
                                    text = "${idx + 1}.",
                                    color = IceBlueBright,
                                    fontSize = 12.5.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(end = 8.dp, top = 1.dp)
                                )
                                Text(
                                    text = buildInlineAnnotatedString(item),
                                    color = MetallicSilverLight,
                                    fontSize = 13.5.sp,
                                    lineHeight = 20.sp,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                is MdBlock.Table -> MarkdownTableBlock(headers = block.headers, rows = block.rows)

                is MdBlock.Paragraph -> {
                    Text(
                        text = buildInlineAnnotatedString(block.text),
                        color = MetallicSilverLight,
                        fontSize = 13.5.sp,
                        lineHeight = 20.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun MarkdownCodeBlock(language: String, code: String) {
    val clipboard = LocalClipboardManager.current
    var copied by remember(code) { mutableStateOf(false) }

    LaunchedEffect(copied) {
        if (copied) {
            delay(1800)
            copied = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(ObsidianBlack)
            .border(1.dp, IceBlue.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ObsidianSurface)
                .padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = language.uppercase(),
                color = IceBlueBright,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(ObsidianGlass)
                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(6.dp))
                    .clickable {
                        clipboard.setText(AnnotatedString(code))
                        copied = true
                    }
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                    contentDescription = "Copy code",
                    tint = if (copied) SentinelEmerald else IceBlue,
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (copied) "COPIED" else "COPY",
                    color = if (copied) SentinelEmerald else MetallicSilver,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(10.dp)
        ) {
            Text(
                text = code,
                color = IceBlueBright,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                lineHeight = 17.sp
            )
        }
    }
}

@Composable
private fun MarkdownTableBlock(headers: List<String>, rows: List<List<String>>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(ObsidianBlack)
            .border(1.dp, IceBlue.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
            .horizontalScroll(rememberScrollState())
    ) {
        Row(
            modifier = Modifier
                .background(ObsidianSurface)
                .padding(vertical = 7.dp)
        ) {
            headers.forEach { header ->
                Text(
                    text = buildInlineAnnotatedString(header),
                    color = IceBlueBright,
                    fontSize = 11.5.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .width(130.dp)
                        .padding(horizontal = 10.dp)
                )
            }
        }
        HorizontalDivider(color = ObsidianGlassBorder, thickness = 1.dp)
        rows.forEachIndexed { rowIdx, row ->
            Row(modifier = Modifier.padding(vertical = 6.dp)) {
                headers.indices.forEach { colIdx ->
                    Text(
                        text = buildInlineAnnotatedString(row.getOrNull(colIdx).orEmpty()),
                        color = MetallicSilverLight,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier
                            .width(130.dp)
                            .padding(horizontal = 10.dp)
                    )
                }
            }
            if (rowIdx < rows.lastIndex) {
                HorizontalDivider(color = ObsidianGlassBorder.copy(alpha = 0.5f), thickness = 1.dp)
            }
        }
    }
}
