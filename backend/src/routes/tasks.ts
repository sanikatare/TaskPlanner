import { Router, Response } from 'express';
import { Task } from '../models/Task';
import { StudySession } from '../models/StudySession';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import { predictTaskTime, updatePredictionModel } from '../services/aiEngine';
import axios from 'axios';

const router = Router();
router.use(authenticate); // all task routes require auth

const externalAiServiceUrl = () => process.env.AI_SERVICE_URL?.trim() || null;

async function recordDailyTaskStreak(uid: string): Promise<void> {
  try {
    const user = await User.findOne({ uid });
    if (!user) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastStr = user.lastActiveDate
      ? new Date(user.lastActiveDate).toISOString().split('T')[0]
      : null;

    if (lastStr === todayStr) {
      return; // already counted today
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let nextStreak = (user.streakDays ?? 0) + 1;
    if (lastStr && lastStr !== yesterdayStr && (user.streakDays ?? 0) === 0) {
      nextStreak = 1;
    }

    await User.findOneAndUpdate(
      { uid },
      { streakDays: nextStreak, lastActiveDate: now },
      { new: true }
    );
  } catch {
    // non-blocking
  }
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function autoArchiveExpiredCompletedTasks(uid: string): Promise<void> {
  try {
    const userTasks = await Task.find({ userId: uid, status: 'completed' }).lean();
    const now = Date.now();
    const expired = userTasks.filter((t) => {
      if (t.isArchived) return false;
      const completedTime = t.completedAt
        ? new Date(t.completedAt).getTime()
        : t.updatedAt
        ? new Date(t.updatedAt).getTime()
        : now;
      return now - completedTime >= TWENTY_FOUR_HOURS_MS;
    });

    if (expired.length > 0) {
      await Promise.all(
        expired.map((t) =>
          Task.findOneAndUpdate(
            { _id: t._id, userId: uid },
            { isArchived: true, archivedAt: new Date() },
            { new: true }
          )
        )
      );
    }
  } catch {
    // non-blocking
  }
}

// GET /api/tasks  — list all tasks for current user (auto-archives completed tasks > 24h old)
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.uid) {
      await autoArchiveExpiredCompletedTasks(req.uid);
    }
    const { status, priority, subject } = req.query;
    const filter: Record<string, unknown> = { userId: req.uid };
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (subject)  filter.subject  = new RegExp(String(subject), 'i');

    const tasks = await Task.find(filter).sort({ order: 1, deadline: 1, priority: -1 }).lean();
    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
});

// PATCH /api/tasks/reorder  — persist drag-and-drop task ordering & optional column status updates
router.patch('/reorder', async (req: AuthRequest, res: Response, next) => {
  try {
    const { items } = req.body as {
      items?: Array<{ id: string; order: number; status?: string }>;
    };
    if (!Array.isArray(items)) {
      throw new AppError('items array is required', 400);
    }

    let anyCompleted = false;
    await Promise.all(
      items.map((item, idx) => {
        const update: Record<string, unknown> = {
          order: typeof item.order === 'number' ? item.order : idx,
        };
        if (item.status && ['pending', 'in_progress', 'completed', 'skipped'].includes(item.status)) {
          update.status = item.status;
          if (item.status === 'completed') {
            update.completedAt = new Date();
            anyCompleted = true;
          }
        }
        return Task.findOneAndUpdate(
          { _id: item.id, userId: req.uid },
          update,
          { new: true }
        );
      })
    );

    if (anyCompleted && req.uid) {
      await recordDailyTaskStreak(req.uid);
    }

    const tasks = await Task.find({ userId: req.uid }).sort({ order: 1, deadline: 1, priority: -1 }).lean();
    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
});

// POST /api/tasks  — create a new task
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { title, subject, category, description, deadline, estimatedHours, priority, difficulty, tags } = req.body;
    if (!title || !deadline) throw new AppError('Task title and due date are required');

    const resolvedSubject = subject?.trim() || 'General';
    const resolvedCategory = category ?? 'other';
    const resolvedHours = Number(estimatedHours) || 1;
    const resolvedDifficulty = Number(difficulty ?? 3);

    // Get AI time prediction (native engine by default, optional external service)
    let aiPredictedHours = predictTaskTime({
      subject: resolvedSubject,
      category: resolvedCategory,
      difficulty: resolvedDifficulty,
      estimatedHours: resolvedHours,
    }).predicted_hours;

    const extUrl = externalAiServiceUrl();
    if (extUrl) {
      try {
        const aiResp = await axios.post(`${extUrl}/predict-time`, {
          subject: resolvedSubject, category: resolvedCategory, difficulty: resolvedDifficulty, estimatedHours: resolvedHours,
        }, { timeout: 1500 });
        if (typeof aiResp.data?.predicted_hours === 'number') {
          aiPredictedHours = aiResp.data.predicted_hours;
        }
      } catch {
        // Keep native prediction
      }
    }

    const task = await Task.create({
      userId: req.uid,
      title: String(title).trim(),
      subject: resolvedSubject,
      category: resolvedCategory,
      description,
      deadline: new Date(deadline as string),
      estimatedHours: resolvedHours,
      priority: priority ?? 'medium',
      difficulty: resolvedDifficulty,
      tags: tags ?? [],
      aiPredictedHours,
    });

    res.status(201).json({ success: true, data: task });
  } catch (err) { next(err); }
});

// GET /api/tasks/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.uid });
    if (!task) throw new AppError('Task not found', 404);
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id  — update task
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const allowed = ['title','subject','category','description','deadline','estimatedHours','priority','status','difficulty','tags','actualHours','order','isArchived'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if (updates.deadline) updates.deadline = new Date(updates.deadline as string);
    if (updates.status && updates.status !== 'completed') {
      updates.isArchived = false;
      updates.archivedAt = undefined;
    } else if (updates.status === 'completed' && !('isArchived' in req.body)) {
      updates.completedAt = new Date();
      updates.isArchived = false;
    }

    const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.uid }, updates, { new: true });
    if (!task) throw new AppError('Task not found', 404);
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
});

// PATCH /api/tasks/:id/archive  — manually archive or restore a task from archive
router.patch('/:id/archive', async (req: AuthRequest, res: Response, next) => {
  try {
    const { isArchived = true, reopen = false } = req.body as {
      isArchived?: boolean;
      reopen?: boolean;
    };

    const update: Record<string, unknown> = {
      isArchived: Boolean(isArchived),
      archivedAt: isArchived ? new Date() : undefined,
    };

    if (!isArchived) {
      if (reopen) {
        update.status = 'pending';
      } else {
        // Refresh completedAt so restored completed task stays in active view for 24h
        update.completedAt = new Date();
      }
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.uid },
      update,
      { new: true }
    );
    if (!task) throw new AppError('Task not found', 404);
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.uid });
    if (!task) throw new AppError('Task not found', 404);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { next(err); }
});

// PATCH /api/tasks/:id/complete  — mark a task done
router.patch('/:id/complete', async (req: AuthRequest, res: Response, next) => {
  try {
    const { actualHours, productivityScore } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.uid },
      { status: 'completed', completedAt: new Date(), isArchived: false, archivedAt: undefined, actualHours },
      { new: true }
    );
    if (!task) throw new AppError('Task not found', 404);

    if (req.uid) {
      await recordDailyTaskStreak(req.uid);
    }

    const hoursSpent = Number(actualHours ?? task.estimatedHours ?? 1);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursSpent * 3600000);
    try {
      await StudySession.create({
        userId: req.uid,
        taskId: task._id,
        startTime,
        endTime,
        durationMinutes: Math.max(15, Math.round(hoursSpent * 60)),
        productivityScore: Number(productivityScore ?? 8),
      });
    } catch { /* non-blocking */ }

    // Update online prediction model (native engine + optional external service)
    updatePredictionModel({
      category: task.category,
      difficulty: task.difficulty,
      estimatedHours: task.estimatedHours,
      actualHours: hoursSpent,
    });

    const extUrl = externalAiServiceUrl();
    if (extUrl) {
      try {
        await axios.post(`${extUrl}/update-model`, {
          subject: task.subject, category: task.category,
          difficulty: task.difficulty, estimatedHours: task.estimatedHours,
          actualHours: hoursSpent, productivityScore: productivityScore ?? 8,
        }, { timeout: 1500 });
      } catch { /* non-blocking */ }
    }

    res.json({ success: true, data: task });
  } catch (err) { next(err); }
});

// PATCH /api/tasks/:id/skip  — mark task as skipped and reschedule
router.patch('/:id/skip', async (req: AuthRequest, res: Response, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.uid },
      { status: 'skipped' },
      { new: true }
    );
    if (!task) throw new AppError('Task not found', 404);
    res.json({ success: true, data: task, message: 'Task skipped — regenerate your schedule to reschedule' });
  } catch (err) { next(err); }
});

export default router;
