import { Schema, model, Document } from 'mongoose';
import { wrapModelWithFallback } from '../utils/database';

export type AuthProvider = 'firebase' | 'local';

export interface IUser extends Document {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  passwordHash?: string;
  authProvider: AuthProvider;
  studyHoursPerDay: number;
  preferredStudyTimes: ('morning' | 'afternoon' | 'evening' | 'night')[];
  subjects: string[];
  currentSemester: number;
  googleCalendarConnected: boolean;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  notificationsEnabled: boolean;
  fcmToken?: string;
  streakDays: number;
  lastActiveDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    uid:                     { type: String, required: true, unique: true, index: true },
    email:                   { type: String, required: true, unique: true, lowercase: true },
    displayName:             { type: String, required: true },
    photoURL:                String,
    passwordHash:            { type: String, select: false },
    authProvider:            { type: String, enum: ['firebase', 'local'], default: 'firebase' },
    studyHoursPerDay:        { type: Number, default: 6, min: 1, max: 16 },
    preferredStudyTimes:     { type: [String], default: ['morning', 'evening'] },
    subjects:                { type: [String], default: [] },
    currentSemester:         { type: Number, default: 1 },
    googleCalendarConnected: { type: Boolean, default: false },
    googleAccessToken:       String,
    googleRefreshToken:      String,
    notificationsEnabled:    { type: Boolean, default: true },
    fcmToken:                String,
    streakDays:              { type: Number, default: 0 },
    lastActiveDate:          Date,
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

export const User = wrapModelWithFallback<IUser>('User', model<IUser>('User', userSchema), {
  authProvider: 'firebase',
  studyHoursPerDay: 6,
  preferredStudyTimes: ['morning', 'evening'],
  subjects: [],
  currentSemester: 1,
  googleCalendarConnected: false,
  notificationsEnabled: true,
  streakDays: 0,
});
