import { Router, Response } from 'express';
import axios from 'axios';
import { Task } from '../models/Task';
import { ScheduleBlock } from '../models/ScheduleBlock';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import { createCalendarEvents } from '../services/googleCalendar';

const router = Router();
router.use(authenticate);

const AI_SERVICE_URL = () => process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

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
      const populated = b.taskId as unknown as { _id: string; title?: string } | null;
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

// POST /api/schedule/generate  — call AI service to build optimized schedule
router.post('/generate', async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await User.findOne({ uid: req.uid });
    if (!user) throw new AppError('User not found', 404);

    // Fetch all non-completed tasks
    const tasks = await Task.find({ userId: req.uid, status: { $in: ['pending','in_progress','skipped'] } })
      .sort({ deadline: 1 }).lean();

    if (tasks.length === 0) {
      res.json({ success: true, data: { schedule: [], warnings: ['No pending tasks to schedule'] } });
      return;
    }

    // Call FastAPI AI service
    const aiPayload = {
      tasks: tasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        subject: t.subject,
        deadline: t.deadline.toISOString(),
        estimated_hours: t.aiPredictedHours ?? t.estimatedHours,
        priority: t.priority,
        difficulty: t.difficulty,
        status: t.status,
      })),
      study_hours_per_day: user.studyHoursPerDay,
      preferred_times: user.preferredStudyTimes,
      start_date: new Date().toISOString().split('T')[0],
    };

    let aiBlocks: Array<{
      task_id: string; date: string; start_time: string;
      end_time: string; duration_minutes: number;
    }> = [];
    let feasibility_score = 1.0;
    let warnings: string[] = [];
    let optimization_notes = '';

    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL()}/optimize-schedule`, aiPayload, { timeout: 5000 });
      aiBlocks = aiResp.data.schedule;
      feasibility_score = aiResp.data.feasibility_score;
      warnings = aiResp.data.warnings ?? [];
      optimization_notes = aiResp.data.optimization_notes ?? '';
    } catch {
      // Fallback EDF scheduler when Python AI service is offline
      const slots = ['08:30', '14:00', '18:30'];
      const baseDate = new Date();
      let dayOffset = 0;
      let slotIdx = 0;
      for (const t of aiPayload.tasks) {
        let remHours = Number(t.estimated_hours) || 2;
        while (remHours > 0 && dayOffset < 14) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + dayOffset);
          const dateStr = d.toISOString().split('T')[0];
          const chunkHours = Math.min(remHours, 2);
          const mins = Math.round(chunkHours * 60);
          const start = slots[slotIdx % slots.length];
          const [sh, sm] = start.split(':').map(Number);
          const totalEndMins = sh * 60 + sm + mins;
          const end = `${String(Math.floor(totalEndMins / 60)).padStart(2, '0')}:${String(totalEndMins % 60).padStart(2, '0')}`;
          aiBlocks.push({
            task_id: t.id,
            date: dateStr,
            start_time: start,
            end_time: end,
            duration_minutes: mins,
          });
          remHours -= chunkHours;
          slotIdx++;
          if (slotIdx % 2 === 0) {
            dayOffset = (dayOffset + 1) % 7;
          }
        }
      }
      optimization_notes = `Scheduled ${aiBlocks.length} study blocks across your upcoming week using Earliest-Deadline-First optimization.`;
    }

    // Persist new schedule blocks (replace existing future ones)
    const today = new Date().toISOString().split('T')[0];
    await ScheduleBlock.deleteMany({ userId: req.uid, date: { $gte: today }, isCompleted: false });

    const blocksToInsert = aiBlocks.map((b: {
      task_id: string; date: string; start_time: string;
      end_time: string; duration_minutes: number;
    }) => ({
      userId: req.uid,
      taskId: b.task_id,
      date:   b.date,
      startTime: b.start_time,
      endTime:   b.end_time,
      durationMinutes: b.duration_minutes,
    }));

    const saved = await ScheduleBlock.insertMany(blocksToInsert);

    res.json({
      success: true,
      data: {
        schedule: saved,
        feasibilityScore: feasibility_score,
        warnings,
        optimizationNotes: optimization_notes,
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
    res.json({ success: true, data: block });
  } catch (err) { next(err); }
});

export default router;
