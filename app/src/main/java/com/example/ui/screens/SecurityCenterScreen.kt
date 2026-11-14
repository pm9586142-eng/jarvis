package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.JarvisViewModel
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

@Composable
fun SecurityCenterScreen(viewModel: JarvisViewModel) {
    val telemetry by viewModel.telemetry.collectAsState()
    val language by viewModel.selectedLanguage.collectAsState()
    val securityReport by viewModel.securityReport.collectAsState()
    val securityLogs by viewModel.securityLogs.collectAsState()
    val isLockdownActive by viewModel.securityModule.isLockdownActive.collectAsState()
    val isPinProtected by viewModel.securityModule.isPinProtected.collectAsState()

    var showPinDialog by remember { mutableStateOf(false) }
    var newPinText by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ObsidianBlack)
    ) {
        JarvisHeader(
            title = "STARK SECURITY AUDIT",
            subtitle = "HOMER Sentinel & Vulnerability Engine",
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // DEFCON Threat Status Card
            NeuralGlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = if (securityReport.defconLevel == 1) AlertCrimson else SentinelEmerald
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .background(
                                        if (securityReport.defconLevel == 1) AlertCrimson else SentinelEmerald,
                                        CircleShape
                                    )
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "READINESS POSTURE",
                                color = MetallicSilverMuted,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Text(
                            text = "INDEX: ${securityReport.score}/100",
                            color = if (securityReport.score > 85) SentinelEmerald else QuantumGold,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Text(
                        text = securityReport.threatStatus,
                        color = if (securityReport.defconLevel == 1) AlertCrimson else IceBlueBright,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )

                    Button(
                        onClick = { viewModel.triggerSecurityScan() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .testTag("run_security_scan_btn"),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = IceBlue,
                            contentColor = ObsidianBlack
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Shield, contentDescription = "Scan", modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "RUN COMPREHENSIVE VULNERABILITY SCAN",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Emergency Lockdown & PIN Controls
            NeuralGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Emergency Defense Lockdown",
                                color = MetallicSilver,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Forces DEFCON 1, seals armor bays, restricts external tools",
                                color = MetallicSilverMuted,
                                fontSize = 11.sp
                            )
                        }
                        Switch(
                            checked = isLockdownActive,
                            onCheckedChange = { viewModel.toggleLockdown() },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = AlertCrimson,
                                checkedTrackColor = AlertCrimson.copy(alpha = 0.35f)
                            ),
                            modifier = Modifier.testTag("emergency_lockdown_switch")
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Master Stark PIN Gate",
                                color = MetallicSilver,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Requires security authentication for sensitive directives",
                                color = MetallicSilverMuted,
                                fontSize = 11.sp
                            )
                        }
                        Switch(
                            checked = isPinProtected,
                            onCheckedChange = { viewModel.securityModule.setPinProtection(it) },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = IceBlue,
                                checkedTrackColor = IceBlue.copy(alpha = 0.35f)
                            )
                        )
                    }
                }
            }

            // Vulnerability Scan Results Checklist
            Text(
                text = "SUBSYSTEM INTEGRITY AUDIT",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                securityReport.checks.forEach { check ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(ObsidianGlass, RoundedCornerShape(10.dp))
                            .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(
                                imageVector = if (check.isSecure) Icons.Default.CheckCircle else Icons.Default.Warning,
                                contentDescription = if (check.isSecure) "Secure" else "Warning",
                                tint = if (check.isSecure) SentinelEmerald else QuantumGold,
                                modifier = Modifier
                                    .size(20.dp)
                                    .padding(top = 2.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = check.title,
                                    color = MetallicSilver,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = check.description,
                                    color = MetallicSilverMuted,
                                    fontSize = 11.5.sp,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                                Text(
                                    text = "Status: ${check.recommendation}",
                                    color = if (check.isSecure) SentinelEmerald else QuantumGold,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Real-Time Audit Log Trail
            Text(
                text = "RECORDED SECURITY AUDIT EVENTS",
                color = MetallicSilverMuted,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (securityLogs.isEmpty()) {
                    Text(
                        text = "No anomalous security events recorded.",
                        color = MetallicSilverMuted,
                        fontSize = 12.sp
                    )
                } else {
                    securityLogs.take(12).forEach { log ->
                        val sdf = SimpleDateFormat("MMM d, HH:mm:ss", Locale.getDefault())
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(ObsidianGlass, RoundedCornerShape(10.dp))
                                .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(10.dp))
                                .padding(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "[${log.eventType}]",
                                            color = when (log.severity) {
                                                "CRITICAL" -> AlertCrimson
                                                "WARNING" -> QuantumGold
                                                else -> IceBlueBright
                                            },
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = log.sourceAgent,
                                            color = MetallicSilverMuted,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                    Text(
                                        text = log.description,
                                        color = MetallicSilver,
                                        fontSize = 11.5.sp,
                                        modifier = Modifier.padding(top = 2.dp)
                                    )
                                }
                                Text(
                                    text = sdf.format(Date(log.timestamp)),
                                    color = MetallicSilverMuted,
                                    fontSize = 9.5.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
