package com.example.ui.screens

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sort
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.db.MemoryEntity
import com.example.ui.JarvisViewModel
import com.example.ui.components.BackupImportPreviewDialog
import com.example.ui.components.JarvisHeader
import com.example.ui.components.NeuralGlassCard
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.IceBlue
import com.example.ui.theme.IceBlueBright
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val MEMORY_CATEGORIES = listOf(
    "PREFERENCE",
    "PROJECT",
    "INSTRUCTION",
    "TOPIC",
    "DECISION",
    "COMMAND",
    "FACT"
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MemoryVaultScreen(viewModel: JarvisViewModel) {
    val context = LocalContext.current
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val memories by viewModel.memories.collectAsState()
    val recentMemories by viewModel.recentlyUpdatedMemories.collectAsState()
    val importPreview by viewModel.backupImportPreview.collectAsState()
    val backupStatus by viewModel.backupStatusMessage.collectAsState()
    val memoryActionError by viewModel.memoryActionError.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("ALL") }
    var sortByRecent by remember { mutableStateOf(false) }

    var showAddDialog by remember { mutableStateOf(false) }
    var editTarget by remember { mutableStateOf<MemoryEntity?>(null) }
    var showClearConfirmDialog by remember { mutableStateOf(false) }

    var draftKey by remember { mutableStateOf("") }
    var draftCategory by remember { mutableStateOf("PREFERENCE") }
    var draftContent by remember { mutableStateOf("") }
    var draftImportance by remember { mutableIntStateOf(4) }

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        val displayName = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        } ?: "backup.json"
        val rawText = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: ""
        viewModel.inspectBackupJson(rawText, displayName)
    }

    val sourceList = if (sortByRecent) recentMemories else memories
    val filteredMemories = remember(sourceList, searchQuery, selectedCategory) {
        sourceList.filter { mem ->
            val catMatch = selectedCategory == "ALL" || mem.category.equals(selectedCategory, ignoreCase = true)
            val q = searchQuery.trim()
            val queryMatch = q.isEmpty() ||
                mem.key.contains(q, ignoreCase = true) ||
                mem.content.contains(q, ignoreCase = true) ||
                mem.category.contains(q, ignoreCase = true)
            catMatch && queryMatch
        }
    }

    val dateFormatter = remember { SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "SMART MEMORY DASHBOARD",
            subtitle = "SQLite Long-Term Knowledge • ${memories.size} Stored Facts",
            telemetry = telemetry,
            currentLanguage = language,
            onLanguageSelected = { viewModel.selectLanguage(it) },
            showBackButton = true,
            onBack = { viewModel.navigateBack() }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Privacy & Local Persistence Status Shield
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SentinelEmerald.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                    .border(1.dp, SentinelEmerald.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Lock, contentDescription = "Privacy Guard", tint = SentinelEmerald, modifier = Modifier.size(16.dp))
                Text(
                    text = "Local Room Vault Active • Conflict auto-merge on • Secrets & passwords blocked",
                    color = SentinelEmerald,
                    fontSize = 10.5.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            memoryActionError?.let { err ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AlertCrimson.copy(alpha = 0.16f), RoundedCornerShape(10.dp))
                        .border(1.dp, AlertCrimson.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                        .testTag("memory_error_banner"),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(err, color = AlertCrimson, fontSize = 11.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { viewModel.clearMemoryActionError() }) {
                        Text("OK", color = MetallicSilver, fontSize = 11.sp)
                    }
                }
            }

            // Search & Add Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search memories, preferences, projects...", color = MetallicSilverMuted, fontSize = 12.sp) },
                    leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = "Search", tint = IceBlue) },
                    modifier = Modifier
                        .weight(1f)
                        .testTag("memory_search_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = MetallicSilver,
                        unfocusedTextColor = MetallicSilver,
                        focusedBorderColor = IceBlue,
                        unfocusedBorderColor = ObsidianGlassBorder,
                        focusedContainerColor = ObsidianGlass,
                        unfocusedContainerColor = ObsidianGlass
                    ),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    onClick = {
                        draftKey = ""
                        draftCategory = "PREFERENCE"
                        draftContent = ""
                        draftImportance = 4
                        showAddDialog = true
                    },
                    modifier = Modifier
                        .height(50.dp)
                        .testTag("add_memory_btn"),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = IceBlue,
                        contentColor = ObsidianBlack
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(imageVector = Icons.Default.Add, contentDescription = "Add Memory")
                }
            }

            // Category Filter Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                (listOf("ALL") + MEMORY_CATEGORIES).forEach { cat ->
                    val selected = selectedCategory == cat
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (selected) IceBlue.copy(alpha = 0.22f) else ObsidianGlass)
                            .border(
                                1.dp,
                                if (selected) IceBlueBright else ObsidianGlassBorder,
                                RoundedCornerShape(999.dp)
                            )
                            .clickable { selectedCategory = cat }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                            .testTag("memory_filter_${cat.lowercase()}")
                    ) {
                        Text(
                            text = cat,
                            color = if (selected) IceBlueBright else MetallicSilverMuted,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }

            // Sort Toggle & Clear All Action Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(ObsidianGlass)
                        .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                        .clickable { sortByRecent = !sortByRecent }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                        .testTag("memory_sort_recent_btn"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Sort, contentDescription = "Toggle Sort", tint = IceBlue, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (sortByRecent) "SORT: RECENTLY UPDATED" else "SORT: PRIORITY",
                        color = IceBlueBright,
                        fontSize = 10.5.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (memories.isNotEmpty()) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(AlertCrimson.copy(alpha = 0.14f))
                            .border(1.dp, AlertCrimson.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                            .clickable { showClearConfirmDialog = true }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                            .testTag("memory_clear_all_btn"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Clear All Memories", tint = AlertCrimson, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "CLEAR ALL",
                            color = AlertCrimson,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Quick Backup Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { viewModel.exportBackup("json") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = IceBlue.copy(alpha = 0.16f),
                        contentColor = IceBlueBright
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).testTag("memory_export_json_btn")
                ) {
                    Icon(Icons.Default.Download, contentDescription = "Export JSON", modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("JSON", fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { viewModel.exportBackup("md") },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ObsidianGlass,
                        contentColor = MetallicSilver
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).testTag("memory_export_md_btn")
                ) {
                    Icon(Icons.Default.Download, contentDescription = "Export MD", modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("MD", fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { importLauncher.launch(arrayOf("application/json", "text/*")) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SentinelEmerald.copy(alpha = 0.16f),
                        contentColor = SentinelEmerald
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.weight(1f).testTag("memory_import_json_btn")
                ) {
                    Icon(Icons.Default.UploadFile, contentDescription = "Import", modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("IMPORT", fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }
            }

            backupStatus?.let { notice ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SentinelEmerald.copy(alpha = 0.16f), RoundedCornerShape(10.dp))
                        .border(1.dp, SentinelEmerald.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(notice, color = SentinelEmerald, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                    TextButton(onClick = { viewModel.clearBackupStatusMessage() }) {
                        Text("OK", color = MetallicSilver, fontSize = 11.sp)
                    }
                }
            }

            // Memories List
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (filteredMemories.isEmpty()) {
                    item {
                        NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "No matching memories found in the vault.",
                                color = MetallicSilverMuted,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
                items(filteredMemories, key = { it.id }) { mem ->
                    NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Top
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "[${mem.category}]",
                                            color = QuantumGold,
                                            fontSize = 10.5.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "P${mem.importance}",
                                            color = IceBlueBright,
                                            fontSize = 9.5.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = mem.key,
                                            color = MetallicSilver,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    Text(
                                        text = mem.content,
                                        color = MetallicSilverMuted,
                                        fontSize = 12.5.sp,
                                        modifier = Modifier.padding(top = 4.dp),
                                        lineHeight = 18.sp
                                    )
                                }

                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    IconButton(
                                        onClick = {
                                            draftKey = mem.key
                                            draftCategory = mem.category
                                            draftContent = mem.content
                                            draftImportance = mem.importance
                                            editTarget = mem
                                        },
                                        modifier = Modifier
                                            .size(32.dp)
                                            .testTag("edit_memory_${mem.id}")
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Edit,
                                            contentDescription = "Edit Memory",
                                            tint = IceBlue,
                                            modifier = Modifier.size(17.dp)
                                        )
                                    }
                                    IconButton(
                                        onClick = { viewModel.deleteMemory(mem) },
                                        modifier = Modifier
                                            .size(32.dp)
                                            .testTag("delete_memory_${mem.id}")
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Delete,
                                            contentDescription = "Delete Memory",
                                            tint = AlertCrimson.copy(alpha = 0.85f),
                                            modifier = Modifier.size(17.dp)
                                        )
                                    }
                                }
                            }

                            Text(
                                text = "Stored ${dateFormatter.format(Date(mem.createdAt))} • Updated ${dateFormatter.format(Date(mem.updatedAt))}",
                                color = MetallicSilverMuted.copy(alpha = 0.8f),
                                fontSize = 9.5.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }
        }
    }

    // Add or Edit Memory Dialog
    val isEditing = editTarget != null
    if (showAddDialog || editTarget != null) {
        AlertDialog(
            onDismissRequest = {
                showAddDialog = false
                editTarget = null
            },
            title = {
                Text(
                    text = if (isEditing) "Update Long-Term Memory" else "Record Long-Term Memory",
                    color = MetallicSilver
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = draftKey,
                        onValueChange = { draftKey = it },
                        label = { Text("Memory Key/Title", color = MetallicSilverMuted) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("memory_dialog_key_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder
                        )
                    )
                    Text("Category", color = MetallicSilverMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        MEMORY_CATEGORIES.forEach { cat ->
                            val selected = draftCategory == cat
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) IceBlue.copy(alpha = 0.22f) else ObsidianBlack)
                                    .border(1.dp, if (selected) IceBlueBright else ObsidianGlassBorder, RoundedCornerShape(8.dp))
                                    .clickable { draftCategory = cat }
                                    .padding(horizontal = 8.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = cat,
                                    color = if (selected) IceBlueBright else MetallicSilverMuted,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Priority", color = MetallicSilverMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            (1..5).forEach { level ->
                                val selected = draftImportance == level
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (selected) QuantumGold.copy(alpha = 0.24f) else ObsidianBlack)
                                        .border(1.dp, if (selected) QuantumGold else ObsidianGlassBorder, RoundedCornerShape(6.dp))
                                        .clickable { draftImportance = level }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "$level",
                                        color = if (selected) QuantumGold else MetallicSilverMuted,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        value = draftContent,
                        onValueChange = { draftContent = it },
                        label = { Text("Memory Content / Details", color = MetallicSilverMuted) },
                        modifier = Modifier.fillMaxWidth().testTag("memory_dialog_content_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = MetallicSilver,
                            unfocusedTextColor = MetallicSilver,
                            focusedBorderColor = IceBlue,
                            unfocusedBorderColor = ObsidianGlassBorder
                        ),
                        maxLines = 4
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (draftKey.isNotBlank() && draftContent.isNotBlank()) {
                            val currentEdit = editTarget
                            if (currentEdit != null) {
                                viewModel.updateMemory(currentEdit, draftKey, draftCategory, draftContent, draftImportance)
                            } else {
                                viewModel.addMemory(draftKey, draftCategory, draftContent, draftImportance)
                            }
                            showAddDialog = false
                            editTarget = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IceBlue, contentColor = ObsidianBlack),
                    modifier = Modifier.testTag("memory_dialog_save_btn")
                ) {
                    Text(if (isEditing) "UPDATE MEMORY" else "SAVE TO VAULT")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showAddDialog = false
                    editTarget = null
                }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            },
            containerColor = ObsidianGlass
        )
    }

    if (showClearConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showClearConfirmDialog = false },
            containerColor = ObsidianGlass,
            title = { Text("Clear All Stored Memories?", color = MetallicSilver) },
            text = {
                Text(
                    text = "This will permanently delete all ${memories.size} long-term memories from your local vault.",
                    color = MetallicSilverMuted,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.clearAllMemories()
                        showClearConfirmDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AlertCrimson, contentColor = MetallicSilver),
                    modifier = Modifier.testTag("memory_confirm_clear_all_btn")
                ) {
                    Text("CONFIRM CLEAR ALL")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirmDialog = false }) {
                    Text("CANCEL", color = MetallicSilverMuted)
                }
            }
        )
    }

    importPreview?.let { preview ->
        BackupImportPreviewDialog(
            preview = preview,
            onConfirm = { viewModel.confirmImportBackup() },
            onDismiss = { viewModel.dismissBackupImportPreview() }
        )
    }
}
