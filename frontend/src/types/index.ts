// ─── Core Domain Types ────────────────────────────────────────────────────────

export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
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

export interface Task {
  _id: string;
  userId: string;
  title: string;
  subject: string;
  category: SubjectCategory;
  description?: string;
  deadline: string; // ISO date string
  estimatedHours: number;
  actualHours?: number;
  priority: Priority;
  status: TaskStatus;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  completedAt?: string;
  isArchived?: boolean;
  archivedAt?: string;
  googleCalendarEventId?: string;
  aiPredictedHours?: number;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleBlock {
  _id: string;
  userId: string;
  taskId: string;
  task?: Task;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  isCompleted: boolean;
  isSkipped: boolean;
  googleCalendarEventId?: string;
  order?: number;
}

export interface StudySession {
  _id: string;
  userId: string;
  taskId: string;
  task?: Task;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  productivityScore: number; // 1–10
  notes?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  studyHoursPerDay: number;
  preferredStudyTimes: ('morning' | 'afternoon' | 'evening' | 'night')[];
  subjects: string[];
  currentSemester: number;
  googleCalendarConnected: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
}

export interface Analytics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  skippedTasks: number;
  completionRate: number;
  totalStudyHours: number;
  avgProductivityScore: number;
  tasksBySubject: Record<string, number>;
  weeklyProgress: WeeklyProgress[];
  upcomingDeadlines: Task[];
  streakDays: number;
  completedToday?: boolean;
}

export interface WeeklyProgress {
  date: string;
  completed: number;
  planned: number;
  studyHours: number;
}

// ─── AI Service Types ─────────────────────────────────────────────────────────

export interface AIPrediction {
  taskId: string;
  predictedHours: number;
  confidence: number;
  factors: string[];
}

export interface AIRecommendation {
  nextTask: Task;
  reason: string;
  urgencyScore: number;
  alternativeTasks: Task[];
}

export interface AIScheduleResult {
  schedule: ScheduleBlock[];
  totalHours: number;
  feasibilityScore: number;
  warnings: string[];
  optimizationNotes: string;
}

export interface AIStudyPlan {
  taskId: string;
  planText: string;
  breakdown: StudyPlanSection[];
  estimatedDays: number;
  dailyGoals: string[];
  resources: string[];
  generatedAt: string;
}

export interface StudyPlanSection {
  title: string;
  duration: string;
  topics: string[];
  activities: string[];
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface CreateTaskForm {
  title: string;
  subject: string;
  category: SubjectCategory;
  description?: string;
  deadline: string;
  estimatedHours: number;
  priority: Priority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
}

export interface UpdateTaskForm extends Partial<CreateTaskForm> {
  status?: TaskStatus;
  actualHours?: number;
  order?: number;
  isArchived?: boolean;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm extends LoginForm {
  displayName: string;
  studyHoursPerDay: number;
}

// ─── Component Prop Types ─────────────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
