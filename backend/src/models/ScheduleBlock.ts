import { Schema, model, Document, Types } from 'mongoose';
import { wrapModelWithFallback } from '../utils/database';

export interface IScheduleBlock extends Document {
  userId: string;
  taskId: Types.ObjectId;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm  (24h)
  endTime: string;       // HH:mm
  durationMinutes: number;
  isCompleted: boolean;
  isSkipped: boolean;
  googleCalendarEventId?: string;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleBlockSchema = new Schema<IScheduleBlock>(
  {
    userId:       { type: String, required: true, index: true },
    taskId:       { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    date:         { type: String, required: true },   // YYYY-MM-DD
    startTime:    { type: String, required: true },
    endTime:      { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 5 },
    isCompleted:  { type: Boolean, default: false },
    isSkipped:    { type: Boolean, default: false },
    googleCalendarEventId: String,
    order:        { type: Number, default: 0 },
  },
  { timestamps: true }
);

scheduleBlockSchema.index({ userId: 1, date: 1 });

export const ScheduleBlock = wrapModelWithFallback<IScheduleBlock>(
  'ScheduleBlock',
  model<IScheduleBlock>('ScheduleBlock', scheduleBlockSchema),
  { isCompleted: false, isSkipped: false },
  { field: 'taskId', targetStore: 'Task' }
);
