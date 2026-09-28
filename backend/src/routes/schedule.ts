import { Router, Response } from 'express';
import axios from 'axios';
import { Task } from '../models/Task';
import { ScheduleBlock } from '../models/ScheduleBlock';
import { StudySession } from '../models/StudySession';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import { createCalendarEvents } from '../services/googleCalendar';
import { optimizeStudySchedule } from '../services/aiEngine';

const router = Router();
router.use(authenticate);

const externalAiServiceUrl = () => process.env.AI_SERVICE_URL?.trim() || null;

// GET /api/schedule  — fetch all schedule blocks (populate task info)
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter: Record<string, unknown> = { userId: req.uid };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, string>).$gte = String(startDate);
      if (endDate)   (filter.date as Record<string, string>).$lte = String(endDate);
    }

    const blocks = await ScheduleBlock.find(filter)
      .populate('taskId', 'title subject category priority deadline estimatedHours status')
      .sort({ date: 1, order: 1, startTime: 1 })
      .lean();

    // Rename populated taskId → task for clean frontend
    const result = blocks.map(b => {
      const populated =
        b.taskId && typeof b.taskId === 'object' && 'title' in b.taskId
          ? (b.taskId as unknown as { _id: string; title?: string })
          : null;
      const taskId = populated?._id?.toString?.() ?? String(b.taskId);
      return { ...b, task: populated, taskId };
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// PATCH /api/schedule/reorder  — persist drag-and-drop order of schedule blocks
router.patch('/reorder', async (req: AuthRequest, res: Response, next) => {
  try {
    const { items } = req.body as { items?: Array<{ id: string; order: number }> };
    if (!Array.isArray(items)) {
      throw new AppError('items array is required', 400);
    }

    await Promise.all(
      items.map((item, idx) =>
        ScheduleBlock.findOneAndUpdate(
          { _id: item.id, userId: req.uid },
          { order: typeof item.order === 'number' ? item.order : idx },
          { new: true }
        )
      )
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/schedule/generate  — build optimized schedule using AI/EDF engine
router.post('/generate', async (req: AuthRequest, res: Response, next) => {
  try {
    const uid = req.uid ?? 'student-demo';
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.findOneAndUpdate(
        { uid },
        {
          $setOnInsert: {
            uid,
            email: req.email ?? `${uid}@university.edu`,
            displayName: uid === 'student-demo' ? 'Student Workspace' : 'Student',
            authProvider: 'local',
            studyHoursPerDay: 6,
            preferredStudyTimes: ['morning', 'evening'],
          },
        },
        { upsert: true, new: true }
      );
    }

    // Fetch all non-completed tasks
    const tasks = await Task.find({
      userId: uid,
      status: { $in: ['pending', 'in_progress', 'skipped'] },
    })
      .sort({ deadline: 1 })
      .lean();

    if (tasks.length === 0) {
      res.json({
        success: true,
        data: { schedule: [], feasibilityScore: 1, warnings: ['No pending tasks to schedule'], optimizationNotes: 'No pending tasks to schedule.' },
      });
      return;
    }

    const aiPayload = {
      tasks: tasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        subject: t.subject,
        deadline: new Date(t.deadline).toISOString(),
        estimated_hours: t.aiPredictedHours ?? t.estimatedHours,
        priority: t.priority,
        difficulty: t.difficulty,
        status: t.status,
      })),
      study_hours_per_day: user?.studyHoursPerDay ?? 6,
      preferred_times: user?.preferredStudyTimes ?? ['morning', 'evening'],
      start_date: new Date().toISOString().split('T')[0],
    };

    let aiResult = optimizeStudySchedule(aiPayload);

    const extUrl = externalAiServiceUrl();
    if (extUrl) {
      try {
        const aiResp = await axios.post(`${extUrl}/optimize-schedule`, aiPayload, { timeout: 3500 });
        if (Array.isArray(aiResp.data?.schedule)) {
          aiResult = {
            schedule: aiResp.data.schedule,
            total_hours: aiResp.data.total_hours ?? aiResult.total_hours,
            feasibility_score: aiResp.data.feasibility_score ?? aiResult.feasibility_score,
            warnings: aiResp.data.warnings ?? [],
            optimization_notes: aiResp.data.optimization_notes ?? aiResult.optimization_notes,
          };
        }
      } catch {
        // Fall back to in-process optimizer result
      }
    }

    // Persist new schedule blocks (replace existing future uncompleted ones)
    const today = new Date().toISOString().split('T')[0];
    await ScheduleBlock.deleteMany({ userId: uid, date: { $gte: today }, isCompleted: false });

    const blocksToInsert = aiResult.schedule.map((b, idx) => ({
      userId: uid,
      taskId: b.task_id,
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      durationMinutes: b.duration_minutes,
      order: idx,
    }));

    const saved = await ScheduleBlock.insertMany(blocksToInsert);
    const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));
    const populatedSaved = saved.map((b: any) => {
      const plain = typeof b.toJSON === 'function' ? b.toJSON() : b;
      const tid = String(plain.taskId);
      return {
        ...plain,
        taskId: tid,
        task: taskMap.get(tid) ?? null,
      };
    });

    res.json({
      success: true,
      data: {
        schedule: populatedSaved,
        feasibilityScore: aiResult.feasibility_score,
        warnings: aiResult.warnings,
        optimizationNotes: aiResult.optimization_notes,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/schedule/sync-calendar  — push blocks to Google Calendar
router.post('/sync-calendar', async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await User.findOne({ uid: req.uid });
    if (!user?.googleCalendarConnected) throw new AppError('Google Calendar not connected', 400);

    const today = new Date().toISOString().split('T')[0];
    const blocks = await ScheduleBlock.find({
      userId: req.uid, date: { $gte: today }, isCompleted: false,
    }).populate('taskId').lean();

    const results = await createCalendarEvents(user, blocks as never);
    res.json({ success: true, data: { synced: results.length } });
  } catch (err) { next(err); }
});

// PATCH /api/schedule/:id/complete
router.patch('/:id/complete', async (req: AuthRequest, res: Response, next) => {
  try {
    const block = await ScheduleBlock.findOneAndUpdate(
      { _id: req.params.id, userId: req.uid },
      { isCompleted: true },
      { new: true }
    );
    if (!block) throw new AppError('Schedule block not found', 404);

    // Record a StudySession so analytics reflect completed study blocks immediately
    try {
      const endTime = new Date();
      const durationMinutes = Math.max(15, Number(block.durationMinutes ?? 60));
      const startTime = new Date(endTime.getTime() - durationMinutes * 60000);
      await StudySession.create({
        userId: req.uid,
        taskId: block.taskId,
        startTime,
        endTime,
        durationMinutes,
        productivityScore: 9,
      });
    } catch {
      // non-blocking
    }

    res.json({ success: true, data: block });
  } catch (err) { next(err); }
});

export default router;
