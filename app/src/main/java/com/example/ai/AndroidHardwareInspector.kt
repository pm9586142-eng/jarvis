package com.example.ai

import android.app.ActivityManager
import android.content.Context
import android.os.StatFs
import java.io.File

data class AndroidHardwareSpecs(
    val totalRamMb: Long,
    val availableRamMb: Long,
    val availableStorageMb: Long,
    val hasSufficientRamForLocalAi: Boolean,
    val hasSufficientStorageForLocalAi: Boolean,
    val recommendedBackend: String
)

object AndroidHardwareInspector {
    fun inspect(context: Context): AndroidHardwareSpecs {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am?.getMemoryInfo(memInfo)

        val totalRamMb = memInfo.totalMem / (1024 * 1024)
        val availableRamMb = memInfo.availMem / (1024 * 1024)

        val dataDir: File = context.filesDir
        val stat = StatFs(dataDir.absolutePath)
        val availableStorageMb = (stat.availableBlocksLong * stat.blockSizeLong) / (1024 * 1024)

        // Gated thresholds for on-device quantized LLM (e.g. 2GB+ available RAM, 1.5GB free storage)
        val hasSufficientRam = totalRamMb >= 3072 || availableRamMb >= 1200
        val hasSufficientStorage = availableStorageMb >= 1024

        val backend = if (hasSufficientRam) "GPU/CPU Accelerated (LiteRT-LM)" else "CPU Fallback"

        return AndroidHardwareSpecs(
            totalRamMb = totalRamMb,
            availableRamMb = availableRamMb,
            availableStorageMb = availableStorageMb,
            hasSufficientRamForLocalAi = hasSufficientRam,
            hasSufficientStorageForLocalAi = hasSufficientStorage,
            recommendedBackend = backend
        )
    }
}
