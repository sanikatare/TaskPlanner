import { admin } from '../utils/firebaseAdmin';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { Task } from '../models/Task';
import cron from 'node-cron';

// Send push notification to a specific user
export async function sendPushNotification(
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const user = await User.findOne({ uid, notificationsEnabled: true });
  if (!user?.fcmToken) return;

  try {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } },
    });
    logger.info(`Push notification sent to ${uid}: ${title}`);
  } catch (err) {
    logger.warn(`Failed to send push to ${uid}:`, err);
  }
}

// Scheduled job — runs every day at 8 AM
export function startNotificationScheduler(): void {
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily deadline notification check...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dueSoon = await Task.find({
        status: { $in: ['pending', 'in_progress'] },
        deadline: { $lte: tomorrow, $gte: new Date() },
      }).lean();

      for (const task of dueSoon) {
        await sendPushNotification(
          task.userId,
          'Deadline Alert',
          `"${task.title}" is due tomorrow. Get started!`,
          { taskId: task._id.toString(), type: 'deadline_warning' }
        );
      }
    } catch (err) {
      logger.error('Notification scheduler error:', err);
    }
  });

  // Reminder 30 min before each study block (runs every 15 min)
  cron.schedule('*/15 * * * *', async () => {
    const now   = new Date();
    const soon  = new Date(now.getTime() + 30 * 60 * 1000);
    const dateStr    = now.toISOString().split('T')[0];
    const timeStr    = soon.toTimeString().slice(0, 5);

    const { ScheduleBlock } = await import('../models/ScheduleBlock');
    const blocks = await ScheduleBlock.find({
      date: dateStr, startTime: timeStr, isCompleted: false,
    }).populate('taskId').lean();

    for (const block of blocks) {
      const task = block.taskId as unknown as { title: string; userId?: string } | null;
      if (!task) continue;
      await sendPushNotification(
        block.userId,
        'Study Reminder',
        `Your study block for "${task.title}" starts in 30 minutes`,
        { type: 'study_reminder', blockId: block._id.toString() }
      );
    }
  });

  logger.info('Notification scheduler started');
}
