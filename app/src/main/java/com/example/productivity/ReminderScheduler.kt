package com.example.productivity

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object ReminderScheduler {
    const val CHANNEL_ID = "jarvis_smart_reminders"
    const val CHANNEL_NAME = "JARVIS Smart Reminders"

    const val ACTION_SHOW_REMINDER = "com.example.jarvis.ACTION_SHOW_REMINDER"
    const val ACTION_SNOOZE = "com.example.jarvis.ACTION_SNOOZE_REMINDER"
    const val ACTION_MARK_DONE = "com.example.jarvis.ACTION_MARK_DONE_REMINDER"

    const val EXTRA_TASK_ID = "extra_task_id"
    const val EXTRA_TITLE = "extra_title"
    const val EXTRA_DUE_TIME = "extra_due_time"
    const val EXTRA_DESCRIPTION = "extra_description"

    fun ensureNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Scheduled natural-language reminders and executive alerts from JARVIS."
                    enableVibration(true)
                }
                nm.createNotificationChannel(channel)
            }
        }
    }

    fun scheduleReminder(
        context: Context,
        taskId: Long,
        title: String,
        dueTime: String,
        description: String,
        triggerAtMillis: Long
    ) {
        if (taskId <= 0L) return
        ensureNotificationChannel(context)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, ReminderBroadcastReceiver::class.java).apply {
            action = ACTION_SHOW_REMINDER
            putExtra(EXTRA_TASK_ID, taskId)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_DUE_TIME, dueTime)
            putExtra(EXTRA_DESCRIPTION, description)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            taskId.toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val safeTrigger = triggerAtMillis.coerceAtLeast(System.currentTimeMillis() + 2_000L)
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, safeTrigger, pi)
    }

    fun cancelReminder(context: Context, taskId: Long) {
        if (taskId <= 0L) return
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        val intent = Intent(context, ReminderBroadcastReceiver::class.java).apply {
            action = ACTION_SHOW_REMINDER
        }
        val pi = PendingIntent.getBroadcast(
            context,
            taskId.toInt(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pi != null) {
            alarmManager?.cancel(pi)
            pi.cancel()
        }
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.cancel(notificationIdFor(taskId))
    }

    fun notificationIdFor(taskId: Long): Int = 40000 + (taskId.toInt() and 0x7FFF)
}
