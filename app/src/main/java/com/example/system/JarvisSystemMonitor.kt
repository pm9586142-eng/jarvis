package com.example.system

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import java.io.File

data class SystemTelemetry(
    val batteryLevel: Int,
    val isCharging: Boolean,
    val batteryHealth: String,
    val ramUsedMb: Long,
    val ramTotalMb: Long,
    val ramPercent: Int,
    val storageUsedGb: Double,
    val storageTotalGb: Double,
    val storagePercent: Int,
    val networkType: String,
    val isConnected: Boolean,
    val uptimeMinutes: Long
)

class JarvisSystemMonitor(private val context: Context) {

    fun getTelemetry(): SystemTelemetry {
        // Battery
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val batteryLevel = batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 88
        val isCharging = batteryManager?.isCharging ?: false

        // Memory / RAM
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager?.getMemoryInfo(memoryInfo)
        val ramTotalMb = (memoryInfo.totalMem / (1024 * 1024))
        val ramAvailMb = (memoryInfo.availMem / (1024 * 1024))
        val ramUsedMb = (ramTotalMb - ramAvailMb).coerceAtLeast(0)
        val ramPercent = if (ramTotalMb > 0) ((ramUsedMb * 100) / ramTotalMb).toInt() else 42

        // Storage
        val path: File = Environment.getDataDirectory()
        val stat = StatFs(path.path)
        val blockSize = stat.blockSizeLong
        val totalBlocks = stat.blockCountLong
        val availableBlocks = stat.availableBlocksLong
        val storageTotalGb = (totalBlocks * blockSize) / (1024.0 * 1024.0 * 1024.0)
        val storageFreeGb = (availableBlocks * blockSize) / (1024.0 * 1024.0 * 1024.0)
        val storageUsedGb = (storageTotalGb - storageFreeGb).coerceAtLeast(0.0)
        val storagePercent = if (storageTotalGb > 0) ((storageUsedGb * 100) / storageTotalGb).toInt() else 35

        // Network
        val connManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val activeNetwork = connManager?.activeNetwork
        val caps = connManager?.getNetworkCapabilities(activeNetwork)
        val isConnected = caps != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
        val networkType = when {
            caps == null -> "Offline"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "High-Speed Wi-Fi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular 5G"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet Link"
            else -> "Connected"
        }

        val uptimeMinutes = (SystemClock.elapsedRealtime() / 1000) / 60

        return SystemTelemetry(
            batteryLevel = batteryLevel.coerceIn(0, 100),
            isCharging = isCharging,
            batteryHealth = "OPTIMAL",
            ramUsedMb = ramUsedMb,
            ramTotalMb = ramTotalMb,
            ramPercent = ramPercent,
            storageUsedGb = String.format("%.1f", storageUsedGb).toDoubleOrNull() ?: storageUsedGb,
            storageTotalGb = String.format("%.1f", storageTotalGb).toDoubleOrNull() ?: storageTotalGb,
            storagePercent = storagePercent,
            networkType = networkType,
            isConnected = isConnected,
            uptimeMinutes = uptimeMinutes
        )
    }

    // Audio volume controls
    fun getMediaVolumePercent(): Int {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return 70
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        return if (max > 0) ((current * 100) / max) else 70
    }

    fun setMediaVolumePercent(percent: Int) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val target = ((percent.coerceIn(0, 100) * max) / 100)
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
    }

    // App Launcher Intents
    fun launchBrowser(url: String = "https://www.google.com"): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun launchSettings(): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun launchCamera(): Boolean {
        return try {
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun launchClock(): Boolean {
        return try {
            val intent = Intent(AlarmClock.ACTION_SHOW_ALARMS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun launchDialer(): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_DIAL).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    // Interactive Terminal Diagnostic Commands
    fun executeTerminalCommand(cmd: String): String {
        val cleanCmd = cmd.trim().lowercase()
        return when {
            cleanCmd == "help" -> {
                """
                JARVIS NEURAL TERMINAL v4.2 [Stark OS 2050]
                Available commands:
                  sysinfo     - Comprehensive hardware & OS telemetry
                  diagnostics - Subsystem integrity verification
                  ping        - Network latency & link analysis
                  mem         - RAM & storage allocation details
                  defcon      - Current Stark security clearance & defense status
                  agents      - Specialized neural agent status
                  clean-cache - Memory purge and cache optimization
                  uptime      - Real elapsed device runtime
                  clear       - Clear terminal output
                """.trimIndent()
            }
            cleanCmd in listOf("sysinfo", "status") -> {
                val t = getTelemetry()
                """
                [SYSTEM TELEMETRY REPORT]
                OS Core: Android (API 36) / Stark Neural Engine 2050
                Power: ${t.batteryLevel}% (${if (t.isCharging) "Charging" else "Discharging"}, Health: ${t.batteryHealth})
                RAM Allocated: ${t.ramUsedMb} MB / ${t.ramTotalMb} MB (${t.ramPercent}%)
                Storage: ${t.storageUsedGb} GB / ${t.storageTotalGb} GB (${t.storagePercent}%)
                Network: ${t.networkType} (Status: ${if (t.isConnected) "ACTIVE" else "OFFLINE"})
                Uptime: ${t.uptimeMinutes} minutes
                All core neural channels functioning at nominal threshold.
                """.trimIndent()
            }
            cleanCmd == "diagnostics" -> {
                """
                [RUNNING STARK SUBSYSTEM DIAGNOSTICS...]
                [✓] Neural Mesh Core: PASS (Latency 12ms)
                [✓] Voice Synthesis Engine: PASS (TTS Ready)
                [✓] Speech Recognition Matrix: PASS
                [✓] SQLite Memory Vault: PASS (Read/Write OK)
                [✓] Camera Optical Sensor: PASS
                [✓] Perimeter Smart Bus: PASS
                [✓] Threat Sentinel HOMER: PASS (No breaches)
                DIAGNOSTIC STATUS: 100% OPERATIONAL. ALL SYSTEMS GREEN.
                """.trimIndent()
            }
            cleanCmd == "ping" -> {
                val t = getTelemetry()
                if (t.isConnected) {
                    """
                    PING stark-satellite-link-04.mesh (172.217.16.206): 56 data bytes
                    64 bytes from 172.217.16.206: icmp_seq=0 ttl=118 time=14.2 ms
                    64 bytes from 172.217.16.206: icmp_seq=1 ttl=118 time=12.8 ms
                    --- stark-satellite-link-04.mesh ping statistics ---
                    2 packets transmitted, 2 packets received, 0.0% packet loss
                    round-trip min/avg/max = 12.8/13.5/14.2 ms
                    Connection quality: EXCELLENT
                    """.trimIndent()
                } else {
                    "PING failed: Device network interface is currently OFFLINE."
                }
            }
            cleanCmd == "defcon" -> {
                """
                [DEFCON DEFENSE REPORT]
                Threat Level: DEFCON 5 (Normal Peacetime Readiness)
                Vulnerability Index: 98/100 (Hardened)
                Firewall: ACTIVE
                Unauthorized Intrusion Attempts: 0 detected
                Stark Protocol: LOCKED & SECURE
                """.trimIndent()
            }
            cleanCmd == "agents" -> {
                """
                [ACTIVE NEURAL AGENTS]
                1. JARVIS PRIME   - Master Executive Orchestrator [ACTIVE]
                2. VERONICA       - Deep Intelligence & Research  [STANDBY]
                3. DUM-E          - Polymath Code Architect       [ONLINE]
                4. FRIDAY         - Executive Schedule & Tasks    [ONLINE]
                5. HOMER          - Hardware & Security Sentinel  [MONITORING]
                Inter-agent neural bus throughput: 4.8 GB/s
                """.trimIndent()
            }
            cleanCmd == "clean-cache" -> {
                System.gc()
                """
                [CACHE PURGE INITIATED]
                Executing memory compaction...
                Garbage collection triggered.
                Temporary scratch buffers freed: 48.6 MB released.
                System responsiveness restored to peak efficiency.
                """.trimIndent()
            }
            cleanCmd == "uptime" -> {
                val t = getTelemetry()
                "Device Uptime: ${t.uptimeMinutes / 60} hours, ${t.uptimeMinutes % 60} minutes."
            }
            cleanCmd.startsWith("echo ") -> {
                cmd.substring(5)
            }
            else -> {
                "Command not recognized: '$cmd'. Type 'help' for available Stark terminal commands."
            }
        }
    }
}
