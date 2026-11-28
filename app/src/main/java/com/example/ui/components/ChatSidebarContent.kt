package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.agents.JarvisAgent
import com.example.data.db.ChatSessionEntity
import com.example.data.db.CustomAgentEntity
import com.example.ui.ScreenDestination
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.AtmosphericViolet
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverLight
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.ObsidianSurface
import com.example.ui.theme.QuantumGold
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ChatSidebarContent(
    sessions: List<ChatSessionEntity>,
    activeSessionId: String,
    sessionSearchQuery: String,
    onSessionSearchChange: (String) -> Unit,
    selectedAgent: JarvisAgent,
    customAgents: List<CustomAgentEntity>,
    selectedCustomAgent: CustomAgentEntity?,
    showCollapseButton: Boolean,
    onCollapse: () -> Unit,
    onNewChat: () -> Unit,
    onSelectSession: (String) -> Unit,
    onToggleSaveSession: (String) -> Unit,
    onRenameSession: (ChatSessionEntity) -> Unit,
    onDeleteSession: (String) -> Unit,
    onSelectAgent: (JarvisAgent) -> Unit,
    onSelectCustomAgent: (CustomAgentEntity) -> Unit,
    onNavigate: (ScreenDestination) -> Unit,
    onClearHistory: () -> Unit,
    hasMessagesInActiveSession: Boolean,
    modifier: Modifier = Modifier
) {
    val filteredSessions = remember(sessions, sessionSearchQuery) {
        val q = sessionSearchQuery.trim()
        if (q.isEmpty()) sessions
        else sessions.filter {
            it.title.contains(q, ignoreCase = true) ||
                it.agentName.contains(q, ignoreCase = true)
        }
    }
    val savedSessions = remember(filteredSessions) {
        filteredSessions.filter { it.isSaved }
    }
    val recentSessions = remember(filteredSessions) {
        filteredSessions.filterNot { it.isSaved }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ObsidianSurface)
            .padding(horizontal = 12.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Brand + Collapse / New Chat
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(IceBlue.copy(alpha = 0.16f))
                        .border(1.dp, IceBlueBright.copy(alpha = 0.6f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "AM",
                        color = IceBlueBright,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Column {
                    Text(
                        text = "AM AI WORKSPACE",
                        color = IceBlueBright,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "${sessions.size} conversations",
                        color = MetallicSilverMuted,
                        fontSize = 10.sp
                    )
                }
            }
            if (showCollapseButton) {
                IconButton(
                    onClick = onCollapse,
                    modifier = Modifier
                        .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                        .testTag("collapse_sidebar_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = "Collapse sidebar",
                        tint = IceBlueBright
                    )
                }
            }
        }

        Button(
            onClick = onNewChat,
            colors = ButtonDefaults.buttonColors(
                containerColor = IceBlue,
                contentColor = ObsidianBlack
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 48.dp)
                .testTag("drawer_new_chat_button")
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text("New Chat", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }

        OutlinedTextField(
            value = sessionSearchQuery,
            onValueChange = onSessionSearchChange,
            placeholder = {
                Text("Search chats...", color = MetallicSilverMuted, fontSize = 12.sp)
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search chats",
                    tint = IceBlue,
                    modifier = Modifier.size(18.dp)
                )
            },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("session_search_input"),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = MetallicSilverLight,
                unfocusedTextColor = MetallicSilverLight,
                focusedBorderColor = IceBlue,
                unfocusedBorderColor = ObsidianGlassBorder,
                focusedContainerColor = ObsidianGlass,
                unfocusedContainerColor = ObsidianGlass
            ),
            shape = RoundedCornerShape(12.dp)
        )

        // Independently scrollable Saved + Recent + Agents + Modules list
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .testTag("chat_sidebar_scroll"),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (savedSessions.isNotEmpty()) {
                item(key = "header_saved") {
                    SidebarSectionHeader("SAVED CONVERSATIONS (${savedSessions.size})", QuantumGold)
                }
                items(savedSessions, key = { "saved_${it.id}" }) { session ->
                    SidebarSessionRow(
                        session = session,
                        isSelected = session.id == activeSessionId,
                        onSelect = { onSelectSession(session.id) },
                        onToggleSave = { onToggleSaveSession(session.id) },
                        onRename = { onRenameSession(session) },
                        onDelete = { onDeleteSession(session.id) }
                    )
                }
            }

            item(key = "header_recent") {
                SidebarSectionHeader(
                    if (savedSessions.isNotEmpty()) "RECENT CONVERSATIONS" else "CHAT HISTORY",
                    IceBlueBright
                )
            }

            if (recentSessions.isEmpty() && savedSessions.isEmpty()) {
                item(key = "empty_sessions") {
                    Text(
                        text = "No matching conversations found.",
                        color = MetallicSilverMuted,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                    )
                }
            } else {
                items(recentSessions, key = { it.id }) { session ->
                    SidebarSessionRow(
                        session = session,
                        isSelected = session.id == activeSessionId,
                        onSelect = { onSelectSession(session.id) },
                        onToggleSave = { onToggleSaveSession(session.id) },
                        onRename = { onRenameSession(session) },
                        onDelete = { onDeleteSession(session.id) }
                    )
                }
            }

            item(key = "divider_agents") {
                Spacer(modifier = Modifier.height(4.dp))
                HorizontalDivider(color = ObsidianGlassBorder)
                Spacer(modifier = Modifier.height(4.dp))
                SidebarSectionHeader("AI AGENTS", AtmosphericViolet)
            }

            val featuredAgents = listOf(
                JarvisAgent.JARVIS_PRIME,
                JarvisAgent.VERONICA_RESEARCH,
                JarvisAgent.DUM_E_ENGINEER,
                JarvisAgent.FRIDAY_COORDINATOR,
                JarvisAgent.HOMER_DIAGNOSTICS
            )
            items(featuredAgents, key = { "agent_${it.name}" }) { agent ->
                val isSelected = selectedCustomAgent == null && selectedAgent == agent
                val label = when (agent) {
                    JarvisAgent.JARVIS_PRIME -> "JARVIS Agent"
                    JarvisAgent.VERONICA_RESEARCH -> "VERONICA Agent"
                    JarvisAgent.DUM_E_ENGINEER -> "DUM-E Agent"
                    JarvisAgent.FRIDAY_COORDINATOR -> "FRIDAY Agent"
                    JarvisAgent.HOMER_DIAGNOSTICS -> "HOMER Agent"
                }
                SidebarNavButton(
                    icon = agent.icon,
                    label = label,
                    subtitle = agent.designation,
                    accent = agent.accentColor,
                    isSelected = isSelected,
                    tag = "sidebar_agent_${agent.codename.lowercase()}",
                    onClick = { onSelectAgent(agent) }
                )
            }

            items(customAgents, key = { "custom_${it.id}" }) { custom ->
                val isSelected = selectedCustomAgent?.id == custom.id
                SidebarNavButton(
                    icon = Icons.Default.SmartToy,
                    label = custom.name,
                    subtitle = custom.codename,
                    accent = Color(custom.colorHex),
                    isSelected = isSelected,
                    tag = "sidebar_custom_agent_${custom.id}",
                    onClick = { onSelectCustomAgent(custom) }
                )
            }

            item(key = "divider_modules") {
                Spacer(modifier = Modifier.height(4.dp))
                HorizontalDivider(color = ObsidianGlassBorder)
                Spacer(modifier = Modifier.height(4.dp))
                SidebarSectionHeader("WORKSPACE", IceBlueBright)
            }

            item(key = "nav_home") {
                SidebarNavButton(
                    icon = Icons.Default.Home,
                    label = "Home Dashboard",
                    subtitle = "Cockpit & Telemetry",
                    accent = IceBlueBright,
                    isSelected = false,
                    tag = "sidebar_home_btn",
                    onClick = { onNavigate(ScreenDestination.DASHBOARD) }
                )
            }
            item(key = "nav_am_player") {
                SidebarNavButton(
                    icon = Icons.Default.PlayCircle,
                    label = "AM Player",
                    subtitle = "YouTube & Media Deck",
                    accent = IceBlue,
                    isSelected = false,
                    tag = "sidebar_am_player_btn",
                    onClick = { onNavigate(ScreenDestination.YOUTUBE_MEDIA) }
                )
            }
            item(key = "nav_voice") {
                SidebarNavButton(
                    icon = Icons.Default.GraphicEq,
                    label = "Voice Mode",
                    subtitle = "Conversational Audio HUD",
                    accent = AtmosphericViolet,
                    isSelected = false,
                    tag = "sidebar_voice_btn",
                    onClick = { onNavigate(ScreenDestination.VOICE_HUD) }
                )
            }
            item(key = "nav_brain") {
                SidebarNavButton(
                    icon = Icons.Default.Psychology,
                    label = "Multi-AI Brain",
                    subtitle = "Provider Mesh & Routing",
                    accent = QuantumGold,
                    isSelected = false,
                    tag = "sidebar_brain_btn",
                    onClick = { onNavigate(ScreenDestination.MULTI_AI_CENTER) }
                )
            }
        }

        // Bottom Clear History & Settings Footer
        HorizontalDivider(color = ObsidianGlassBorder)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (hasMessagesInActiveSession) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(AlertCrimson.copy(alpha = 0.12f))
                        .border(1.dp, AlertCrimson.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onClearHistory)
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                        .testTag("sidebar_clear_history_btn"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteSweep,
                        contentDescription = "Clear History",
                        tint = AlertCrimson,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Clear History",
                        color = AlertCrimson,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            Row(
                modifier = Modifier
                    .weight(1f)
                    .defaultMinSize(minHeight = 48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(ObsidianGlass)
                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                    .clickable { onNavigate(ScreenDestination.SETTINGS) }
                    .padding(horizontal = 10.dp, vertical = 8.dp)
                    .testTag("sidebar_settings_btn"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Settings",
                    tint = IceBlueBright,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Settings",
                    color = MetallicSilverLight,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
            }
        }
    }
}

@Composable
private fun SidebarSectionHeader(title: String, color: Color) {
    Text(
        text = title,
        color = color.copy(alpha = 0.9f),
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = FontFamily.Monospace,
        modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
    )
}

@Composable
private fun SidebarSessionRow(
    session: ChatSessionEntity,
    isSelected: Boolean,
    onSelect: () -> Unit,
    onToggleSave: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit
) {
    val timeLabel = remember(session.updatedAt) {
        SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()).format(Date(session.updatedAt))
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (isSelected) IceBlue.copy(alpha = 0.16f) else ObsidianGlass)
            .border(
                1.dp,
                if (isSelected) IceBlue else ObsidianGlassBorder,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onSelect)
            .padding(start = 10.dp, end = 4.dp, top = 6.dp, bottom = 6.dp)
            .testTag("session_item_${session.id}"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.ChatBubbleOutline,
            contentDescription = null,
            tint = if (isSelected) IceBlueBright else MetallicSilverMuted,
            modifier = Modifier.size(15.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = session.title,
                color = if (isSelected) IceBlueBright else MetallicSilverLight,
                fontSize = 12.5.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${session.agentName} • $timeLabel",
                color = MetallicSilverMuted,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        IconButton(
            onClick = onToggleSave,
            modifier = Modifier
                .defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
                .testTag("bookmark_session_${session.id}")
        ) {
            Icon(
                imageVector = if (session.isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                contentDescription = if (session.isSaved) "Remove from Saved" else "Save conversation",
                tint = if (session.isSaved) QuantumGold else MetallicSilverMuted,
                modifier = Modifier.size(16.dp)
            )
        }
        IconButton(
            onClick = onRename,
            modifier = Modifier.defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = "Rename session",
                tint = IceBlue,
                modifier = Modifier.size(15.dp)
            )
        }
        IconButton(
            onClick = onDelete,
            modifier = Modifier.defaultMinSize(minWidth = 40.dp, minHeight = 40.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Delete session",
                tint = AlertCrimson.copy(alpha = 0.85f),
                modifier = Modifier.size(15.dp)
            )
        }
    }
}

@Composable
private fun SidebarNavButton(
    icon: ImageVector,
    label: String,
    subtitle: String,
    accent: Color,
    isSelected: Boolean,
    tag: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (isSelected) accent.copy(alpha = 0.16f) else ObsidianGlass.copy(alpha = 0.65f))
            .border(
                1.dp,
                if (isSelected) accent.copy(alpha = 0.7f) else ObsidianGlassBorder.copy(alpha = 0.6f),
                RoundedCornerShape(10.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = accent,
            modifier = Modifier.size(18.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                color = if (isSelected) Color.White else MetallicSilverLight,
                fontSize = 12.5.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                color = MetallicSilverMuted,
                fontSize = 10.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
