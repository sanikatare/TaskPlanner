import { Schema, model, Document, Types } from 'mongoose';
import { wrapModelWithFallback } from '../utils/database';

export type Priority       = 'high' | 'medium' | 'low';
export type TaskStatus     = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type SubjectCategory =
  | 'study'
  | 'work'
  | 'personal'
  | 'math'
  | 'science'
  | 'programming'
  | 'theory'
  | 'lab'
  | 'project'
  | 'other';

export interface ITask extends Document {
  userId: string;            // Firebase UID
  title: string;
  subject: string;
  category: SubjectCategory;
  description?: string;
  deadline: Date;
  estimatedHours: number;
  actualHours?: number;
  priority: Priority;
  status: TaskStatus;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  completedAt?: Date;
  isArchived?: boolean;
  archivedAt?: Date;
  googleCalendarEventId?: string;
  aiPredictedHours?: number;  // from ML model
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    userId:       { type: String, required: true, index: true },
    title:        { type: String, required: true, trim: true, maxlength: 200 },
    subject:      { type: String, required: true, trim: true },
    category:     { type: String, required: true, enum: ['study','work','personal','math','science','programming','theory','lab','project','other'], default: 'study' },
    description:  { type: String, maxlength: 2000 },
    deadline:     { type: Date, required: true, index: true },
    estimatedHours: { type: Number, required: true, min: 0.5, max: 200 },
    actualHours:    Number,
    priority:     { type: String, required: true, enum: ['high','medium','low'], default: 'medium' },
    status:       { type: String, required: true, enum: ['pending','in_progress','completed','skipped'], default: 'pending', index: true },
    difficulty:   { type: Number, required: true, enum: [1,2,3,4,5], default: 3 },
    tags:         { type: [String], default: [] },
    completedAt:  Date,
    isArchived:   { type: Boolean, default: false, index: true },
    archivedAt:   Date,
    googleCalendarEventId: String,
    aiPredictedHours:      Number,
    order:                 { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index for efficient user+status queries
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, deadline: 1 });

export const Task = wrapModelWithFallback<ITask>('Task', model<ITask>('Task', taskSchema), {
  category: 'other',
  priority: 'medium',
  status: 'pending',
  difficulty: 3,
  tags: [],
});
