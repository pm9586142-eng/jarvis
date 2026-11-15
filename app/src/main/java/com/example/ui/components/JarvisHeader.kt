package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.agents.JarvisLanguage
import com.example.system.SystemTelemetry
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
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun JarvisHeader(
    title: String,
    subtitle: String = "Neural AI System 2050",
    telemetry: SystemTelemetry?,
    currentLanguage: JarvisLanguage,
    onLanguageSelected: (JarvisLanguage) -> Unit,
    showBackButton: Boolean = false,
    onBack: () -> Unit = {},
    onOpenSettings: (() -> Unit)? = null,
    onOpenDrawer: (() -> Unit)? = null,
    statusLabel: String? = null,
    statusIsHealthy: Boolean = true,
    showLiveClock: Boolean = false,
    onOpenSearch: (() -> Unit)? = null,
    unreadNotificationCount: Int = 0,
    onOpenNotifications: (() -> Unit)? = null,
    onOpenProfile: (() -> Unit)? = null
) {
    var showLangMenu by remember { mutableStateOf(false) }
    var nowMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(showLiveClock) {
        if (!showLiveClock) return@LaunchedEffect
        while (true) {
            nowMillis = System.currentTimeMillis()
            delay(1000L)
        }
    }

    val clockLabel = remember(nowMillis) {
        SimpleDateFormat("EEE dd MMM • HH:mm:ss", Locale.getDefault()).format(Date(nowMillis))
    }

    val accent = MaterialTheme.colorScheme.primary
    val accentBright = MaterialTheme.colorScheme.onPrimaryContainer

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .background(ObsidianBlack.copy(alpha = 0.96f))
            .border(1.dp, ObsidianGlassBorder)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        val isWide = maxWidth >= 600.dp

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (showBackButton) {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("header_back_button")
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = accent
                            )
                        }
                    } else if (onOpenDrawer != null) {
                        IconButton(
                            onClick = onOpenDrawer,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("header_menu_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Menu,
                                contentDescription = "Open Command Navigation",
                                tint = IceBlueBright
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .background(accent, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                    }

                    Column(modifier = Modifier.padding(end = 6.dp)) {
                        Text(
                            text = title,
                            color = MetallicSilver,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = subtitle,
                            color = accentBright,
                            fontSize = 10.5.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    if (isWide && statusLabel != null) {
                        StatusBadgePill(label = statusLabel, isHealthy = statusIsHealthy)
                    }

                    if (onOpenSearch != null) {
                        IconButton(
                            onClick = onOpenSearch,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("header_search_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Search Command Center",
                                tint = IceBlueBright,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    if (onOpenNotifications != null) {
                        Box(contentAlignment = Alignment.Center) {
                            IconButton(
                                onClick = onOpenNotifications,
                                modifier = Modifier
                                    .size(48.dp)
                                    .testTag("header_notifications_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Notifications,
                                    contentDescription = "Notifications",
                                    tint = if (unreadNotificationCount > 0) QuantumGold else MetallicSilver,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            if (unreadNotificationCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(top = 8.dp, end = 8.dp)
                                        .background(AlertCrimson, CircleShape)
                                        .padding(horizontal = 4.dp, vertical = 1.dp)
                                ) {
                                    Text(
                                        text = unreadNotificationCount.coerceAtMost(9).toString(),
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    // Language Selector Dropdown
                    Box {
                        Row(
                            modifier = Modifier
                                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                .clickable { showLangMenu = true }
                                .padding(horizontal = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .background(ObsidianGlass, RoundedCornerShape(8.dp))
                                    .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 7.dp, vertical = 5.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Language,
                                        contentDescription = "Language",
                                        tint = IceBlue,
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = currentLanguage.name.take(2),
                                        color = IceBlueBright,
                                        fontSize = 10.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }

                        DropdownMenu(
                            expanded = showLangMenu,
                            onDismissRequest = { showLangMenu = false },
                            modifier = Modifier.background(ObsidianGlass)
                        ) {
                            JarvisLanguage.entries.forEach { lang ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            text = lang.displayName,
                                            color = if (lang == currentLanguage) accent else MetallicSilver,
                                            fontSize = 13.sp
                                        )
                                    },
                                    onClick = {
                                        onLanguageSelected(lang)
                                        showLangMenu = false
                                    }
                                )
                            }
                        }
                    }

                    if (onOpenSettings != null) {
                        IconButton(
                            onClick = onOpenSettings,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("header_settings_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "System Settings",
                                tint = accentBright,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }

            if (showLiveClock || statusLabel != null || onOpenProfile != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (!isWide && statusLabel != null) {
                            StatusBadgePill(label = statusLabel, isHealthy = statusIsHealthy)
                        }
                        if (showLiveClock) {
                            Text(
                                text = clockLabel,
                                color = IceBlueBright,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                maxLines = 1
                            )
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Battery pill
                        Row(
                            modifier = Modifier
                                .background(ObsidianGlass, RoundedCornerShape(8.dp))
                                .border(1.dp, ObsidianGlassBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 7.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.BatteryChargingFull,
                                contentDescription = "Battery",
                                tint = if ((telemetry?.batteryLevel ?: 90) > 20) SentinelEmerald else AlertCrimson,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = "${telemetry?.batteryLevel ?: 88}%",
                                color = MetallicSilver,
                                fontSize = 10.5.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        if (onOpenProfile != null) {
                            Row(
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clickable { onOpenProfile() }
                                    .padding(vertical = 4.dp)
                                    .testTag("header_profile_button"),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    modifier = Modifier
                                        .background(IceBlue.copy(alpha = 0.14f), RoundedCornerShape(8.dp))
                                        .border(1.dp, IceBlue.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Person,
                                        contentDescription = "Operator Profile",
                                        tint = IceBlueBright,
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "SIR",
                                        color = IceBlueBright,
                                        fontSize = 10.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusBadgePill(label: String, isHealthy: Boolean) {
    val badgeColor = if (isHealthy) SentinelEmerald else QuantumGold
    Row(
        modifier = Modifier
            .background(badgeColor.copy(alpha = 0.14f), RoundedCornerShape(8.dp))
            .border(1.dp, badgeColor.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .background(badgeColor, CircleShape)
        )
        Spacer(modifier = Modifier.width(5.dp))
        Text(
            text = "SYSTEM: $label",
            color = badgeColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            maxLines = 1
        )
    }
}
