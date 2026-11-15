package com.example.productivity

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.MainActivity
import com.example.R
import com.example.data.db.JarvisDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ReminderBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val taskId = intent.getLongExtra(ReminderScheduler.EXTRA_TASK_ID, -1L)
        if (taskId <= 0L) return

        when (action) {
            ReminderScheduler.ACTION_SHOW_REMINDER -> {
                val title = intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "JARVIS Reminder"
                val dueTime = intent.getStringExtra(ReminderScheduler.EXTRA_DUE_TIME) ?: "Now"
                val description = intent.getStringExtra(ReminderScheduler.EXTRA_DESCRIPTION) ?: ""
                showReminderNotification(context, taskId, title, dueTime, description)
            }

            ReminderScheduler.ACTION_SNOOZE -> {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                nm?.cancel(ReminderScheduler.notificationIdFor(taskId))

                val pendingResult = goAsync()
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val db = JarvisDatabase.getDatabase(context)
                        val task = db.taskDao().getById(taskId)
                        val nextTrigger = System.currentTimeMillis() + 15 * 60_000L
                        val nextLabel = ReminderParser.formatDueLabel(nextTrigger)
                        db.taskDao().updateTriggerTime(taskId, "Snoozed ($nextLabel)", nextTrigger)
                        ReminderScheduler.scheduleReminder(
                            context = context,
                            taskId = taskId,
                            title = task?.title ?: (intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "JARVIS Reminder"),
                            dueTime = nextLabel,
                            description = task?.description ?: "",
                            triggerAtMillis = nextTrigger
                        )
                    } finally {
                        pendingResult.finish()
                    }
                }
            }

            ReminderScheduler.ACTION_MARK_DONE -> {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                nm?.cancel(ReminderScheduler.notificationIdFor(taskId))
                ReminderScheduler.cancelReminder(context, taskId)

                val pendingResult = goAsync()
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val db = JarvisDatabase.getDatabase(context)
                        db.taskDao().setCompleted(taskId, true)
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
        }
    }

    private fun showReminderNotification(
        context: Context,
        taskId: Long,
        title: String,
        dueTime: String,
        description: String
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        ReminderScheduler.ensureNotificationChannel(context)

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openAppPi = PendingIntent.getActivity(
            context,
            taskId.toInt(),
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val snoozeIntent = Intent(context, ReminderBroadcastReceiver::class.java).apply {
            action = ReminderScheduler.ACTION_SNOOZE
            putExtra(ReminderScheduler.EXTRA_TASK_ID, taskId)
            putExtra(ReminderScheduler.EXTRA_TITLE, title)
        }
        val snoozePi = PendingIntent.getBroadcast(
            context,
            (taskId.toInt() * 31) + 1,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val doneIntent = Intent(context, ReminderBroadcastReceiver::class.java).apply {
            action = ReminderScheduler.ACTION_MARK_DONE
            putExtra(ReminderScheduler.EXTRA_TASK_ID, taskId)
        }
        val donePi = PendingIntent.getBroadcast(
            context,
            (taskId.toInt() * 31) + 2,
            doneIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bodyText = if (description.isNotBlank() && description != title) {
            "$dueTime — $description"
        } else {
            "Scheduled for $dueTime"
        }

        val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("JARVIS Reminder: $title")
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openAppPi)
            .addAction(0, "Snooze 15m", snoozePi)
            .addAction(0, "Mark Done", donePi)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.notify(ReminderScheduler.notificationIdFor(taskId), notification)
    }
}
