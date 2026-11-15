package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.backup.BackupImportPreview
import com.example.ui.theme.AlertCrimson
import com.example.ui.theme.IceBlue
import com.example.ui.theme.MetallicSilver
import com.example.ui.theme.MetallicSilverMuted
import com.example.ui.theme.ObsidianBlack
import com.example.ui.theme.ObsidianGlass
import com.example.ui.theme.ObsidianGlassBorder
import com.example.ui.theme.QuantumGold
import com.example.ui.theme.SentinelEmerald

@Composable
fun BackupImportPreviewDialog(
    preview: BackupImportPreview,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = ObsidianGlass,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "BACKUP IMPORT PREVIEW",
                    color = MetallicSilver,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = preview.filename,
                    color = MetallicSilverMuted,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                val statusColor = if (preview.isValid) SentinelEmerald else AlertCrimson
                Text(
                    text = if (preview.isValid) {
                        if (preview.totalImportableCount > 0) "Validated JSON backup ready to import."
                        else "Backup valid, but all items already exist on this device."
                    } else {
                        "Validation failed. Fix errors before importing."
                    },
                    color = statusColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )

                if (preview.isValid) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ObsidianBlack, RoundedCornerShape(10.dp))
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        PreviewCountRow(
                            label = "Chat Sessions",
                            value = "+${preview.sessionsToImport.size} (${preview.skippedSessionsCount} skipped)",
                            color = IceBlue
                        )
                        PreviewCountRow(
                            label = "Memories",
                            value = "+${preview.memoriesToImport.size} (${preview.duplicateMemoriesSkipped} dupes)",
                            color = SentinelEmerald
                        )
                        PreviewCountRow(
                            label = "Tasks",
                            value = "+${preview.tasksToImport.size} (${preview.skippedTasksCount} skipped)",
                            color = QuantumGold
                        )
                    }
                }

                if (preview.errors.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(AlertCrimson.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
                            .border(1.dp, AlertCrimson.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        preview.errors.forEach { err ->
                            Text("• $err", color = AlertCrimson, fontSize = 11.sp)
                        }
                    }
                }

                if (preview.warnings.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(QuantumGold.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                            .border(1.dp, QuantumGold.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("WARNINGS", color = QuantumGold, fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        preview.warnings.take(5).forEach { w ->
                            Text("• $w", color = QuantumGold, fontSize = 11.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = preview.isValid && preview.totalImportableCount > 0,
                colors = ButtonDefaults.buttonColors(
                    containerColor = IceBlue,
                    contentColor = ObsidianBlack
                ),
                modifier = Modifier.testTag("confirm_backup_import_btn")
            ) {
                Text("IMPORT (${preview.totalImportableCount})", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("CANCEL", color = MetallicSilverMuted)
            }
        }
    )
}

@Composable
private fun PreviewCountRow(
    label: String,
    value: String,
    color: androidx.compose.ui.graphics.Color
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = MetallicSilverMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
        Text(value, color = color, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
    }
}
