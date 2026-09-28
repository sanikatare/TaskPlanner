import { Schema, model, Document, Types } from 'mongoose';
import { wrapModelWithFallback } from '../utils/database';

export interface IStudySession extends Document {
  userId: string;
  taskId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  productivityScore: number;  // 1–10 (user-rated or AI-inferred)
  notes?: string;
  createdAt: Date;
}

const studySessionSchema = new Schema<IStudySession>(
  {
    userId:            { type: String, required: true, index: true },
    taskId:            { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    startTime:         { type: Date, required: true },
    endTime:           { type: Date, required: true },
    durationMinutes:   { type: Number, required: true, min: 1 },
    productivityScore: { type: Number, required: true, min: 1, max: 10, default: 7 },
    notes:             String,
  },
  { timestamps: true }
);

studySessionSchema.index({ userId: 1, createdAt: -1 });

export const StudySession = wrapModelWithFallback<IStudySession>(
  'StudySession',
  model<IStudySession>('StudySession', studySessionSchema),
  { productivityScore: 7 }
);
