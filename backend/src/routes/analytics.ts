import { Router, Response } from 'express';
import { Task } from '../models/Task';
import { StudySession } from '../models/StudySession';
import { ScheduleBlock } from '../models/ScheduleBlock';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { subDays, format } from 'date-fns';

const router = Router();
router.use(authenticate);

// GET /api/analytics  — full analytics summary
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const uid = req.uid!;

    const [tasks, sessions, user] = await Promise.all([
      Task.find({ userId: uid }).lean(),
      StudySession.find({ userId: uid }).lean(),
      User.findOne({ uid }).lean(),
    ]);

    const totalTasks     = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks   = tasks.filter(t => t.status === 'pending').length;
    const skippedTasks   = tasks.filter(t => t.status === 'skipped').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const totalStudyHours = sessions.reduce((s, sess) => s + sess.durationMinutes / 60, 0);
    const avgProductivityScore = sessions.length > 0
      ? sessions.reduce((s, sess) => s + sess.productivityScore, 0) / sessions.length
      : 0;

    // Tasks by subject
    const tasksBySubject: Record<string, number> = {};
    for (const t of tasks) {
      tasksBySubject[t.subject] = (tasksBySubject[t.subject] ?? 0) + 1;
    }

    // Weekly progress — single aggregation query instead of N+1
    const sevenDaysAgo = subDays(new Date(), 6);
    const dateStrStart = format(sevenDaysAgo, 'yyyy-MM-dd');
    const dateStrEnd = format(new Date(), 'yyyy-MM-dd');

    const [weekBlocks, weekSessions] = await Promise.all([
      ScheduleBlock.find({ userId: uid, date: { $gte: dateStrStart, $lte: dateStrEnd } }).lean(),
      StudySession.find({
        userId: uid,
        startTime: { $gte: sevenDaysAgo, $lte: new Date() },
      }).lean(),
    ]);

    const weeklyProgress = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayBlocks = weekBlocks.filter(b => b.date === dateStr);
      const dayCompleted = dayBlocks.filter(b => b.isCompleted).length;
      const dayHours = weekSessions
        .filter(s => format(new Date(s.startTime), 'yyyy-MM-dd') === dateStr)
        .reduce((acc, s) => acc + s.durationMinutes / 60, 0);
      weeklyProgress.push({
        date: dateStr,
        completed: dayCompleted,
        planned:   dayBlocks.length,
        studyHours: Math.round(dayHours * 10) / 10,
      });
    }

    // Upcoming deadlines — next 7 days, not completed
    const upcomingDeadlines = tasks
      .filter(t => t.status !== 'completed' && new Date(t.deadline) > new Date())
      .sort((a, b) => {
        const orderDiff = (a.order ?? 9999) - (b.order ?? 9999);
        if (orderDiff !== 0) return orderDiff;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      })
      .slice(0, 8);

    // Consecutive days of task / study completion
    const completionDates = new Set<string>();
    for (const t of tasks) {
      if (t.status === 'completed') {
        const dt = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
        completionDates.add(format(dt, 'yyyy-MM-dd'));
      }
    }
    for (const b of weekBlocks) {
      if (b.isCompleted) {
        completionDates.add(b.date);
      }
    }
    for (const s of sessions) {
      if (s.startTime) {
        completionDates.add(format(new Date(s.startTime), 'yyyy-MM-dd'));
      }
    }

    let computedConsecutive = 0;
    const todayFormatted = format(new Date(), 'yyyy-MM-dd');
    const yesterdayFormatted = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const startOffset = completionDates.has(todayFormatted)
      ? 0
      : completionDates.has(yesterdayFormatted)
      ? 1
      : -1;

    if (startOffset >= 0) {
      for (let offset = startOffset; offset < 365; offset++) {
        const dStr = format(subDays(new Date(), offset), 'yyyy-MM-dd');
        if (completionDates.has(dStr)) {
          computedConsecutive++;
        } else {
          break;
        }
      }
    }

    const streakDays = Math.max(user?.streakDays ?? 0, computedConsecutive);
    const completedToday =
      completionDates.has(todayFormatted) ||
      tasks.some(
        t =>
          t.status === 'completed' &&
          t.completedAt &&
          format(new Date(t.completedAt), 'yyyy-MM-dd') === todayFormatted
      );

    res.json({
      success: true,
      data: {
        totalTasks, completedTasks, pendingTasks, skippedTasks,
        completionRate: Math.round(completionRate * 10) / 10,
        totalStudyHours: Math.round(totalStudyHours * 10) / 10,
        avgProductivityScore: Math.round(avgProductivityScore * 10) / 10,
        tasksBySubject, weeklyProgress, upcomingDeadlines, streakDays, completedToday,
      },
    });
  } catch (err) { next(err); }
});

export default router;
