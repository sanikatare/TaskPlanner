// ─── API Endpoints ────────────────────────────────────────────────────────────

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const AI_BASE_URL  = import.meta.env.VITE_AI_BASE_URL  || 'http://localhost:8000';

export const ENDPOINTS = {
  // Auth
  AUTH_LOGIN:     '/auth/login',
  AUTH_REGISTER:  '/auth/register',
  AUTH_ME:        '/auth/me',
  AUTH_LOGOUT:    '/auth/logout',

  // Tasks
  TASKS:          '/tasks',
  TASK_BY_ID:     (id: string) => `/tasks/${id}`,
  TASK_COMPLETE:  (id: string) => `/tasks/${id}/complete`,
  TASK_SKIP:      (id: string) => `/tasks/${id}/skip`,

  // Schedule
  SCHEDULE:         '/schedule',
  SCHEDULE_GENERATE:'/schedule/generate',
  SCHEDULE_SYNC:    '/schedule/sync-calendar',

  // Analytics
  ANALYTICS:        '/analytics',
  ANALYTICS_WEEKLY: '/analytics/weekly',

  // AI Service
  AI_PREDICT:       '/predict-time',
  AI_RECOMMEND:     '/recommend',
  AI_SCHEDULE:      '/optimize-schedule',
  AI_PLAN:          '/generate-plan',

  // Google Calendar
  CALENDAR_AUTH:    '/calendar/auth',
  CALENDAR_SYNC:    '/calendar/sync',
} as const;

// ─── Priority Config ──────────────────────────────────────────────────────────

export const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#ef4444', bg: 'badge-high',   weight: 3 },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'badge-medium', weight: 2 },
  low:    { label: 'Low',    color: '#22c55e', bg: 'badge-low',    weight: 1 },
} as const;

export const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: '#64748b' },
  in_progress: { label: 'In Progress', color: '#2563eb' },
  completed:   { label: 'Completed',   color: '#10b981' },
  skipped:     { label: 'Skipped',     color: '#f59e0b' },
} as const;

export const CATEGORY_CONFIG = {
  study: {
    label: 'Study',
    icon: 'book-open',
    color: '#2563eb',
    dotClass: 'bg-blue-600',
    textClass: 'text-blue-700',
    bgClass: 'bg-blue-50/90',
    borderClass: 'border-blue-200/80',
    activeClass: 'bg-blue-600 text-white border-blue-600',
  },
  work: {
    label: 'Work',
    icon: 'briefcase',
    color: '#7c3aed',
    dotClass: 'bg-violet-600',
    textClass: 'text-violet-700',
    bgClass: 'bg-violet-50/90',
    borderClass: 'border-violet-200/80',
    activeClass: 'bg-violet-600 text-white border-violet-600',
  },
  personal: {
    label: 'Personal',
    icon: 'user',
    color: '#059669',
    dotClass: 'bg-emerald-600',
    textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50/90',
    borderClass: 'border-emerald-200/80',
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  programming: {
    label: 'Programming',
    icon: 'code-2',
    color: '#0284c7',
    dotClass: 'bg-sky-600',
    textClass: 'text-sky-700',
    bgClass: 'bg-sky-50/90',
    borderClass: 'border-sky-200/80',
    activeClass: 'bg-sky-600 text-white border-sky-600',
  },
  math: {
    label: 'Mathematics',
    icon: 'calculator',
    color: '#4f46e5',
    dotClass: 'bg-indigo-600',
    textClass: 'text-indigo-700',
    bgClass: 'bg-indigo-50/90',
    borderClass: 'border-indigo-200/80',
    activeClass: 'bg-indigo-600 text-white border-indigo-600',
  },
  science: {
    label: 'Science',
    icon: 'flask',
    color: '#0d9488',
    dotClass: 'bg-teal-600',
    textClass: 'text-teal-700',
    bgClass: 'bg-teal-50/90',
    borderClass: 'border-teal-200/80',
    activeClass: 'bg-teal-600 text-white border-teal-600',
  },
  lab: {
    label: 'Lab Work',
    icon: 'microscope',
    color: '#d97706',
    dotClass: 'bg-amber-600',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50/90',
    borderClass: 'border-amber-200/80',
    activeClass: 'bg-amber-600 text-white border-amber-600',
  },
  theory: {
    label: 'Theory',
    icon: 'book-open',
    color: '#db2777',
    dotClass: 'bg-rose-600',
    textClass: 'text-rose-700',
    bgClass: 'bg-rose-50/90',
    borderClass: 'border-rose-200/80',
    activeClass: 'bg-rose-600 text-white border-rose-600',
  },
  project: {
    label: 'Project',
    icon: 'folder-kanban',
    color: '#ea580c',
    dotClass: 'bg-orange-600',
    textClass: 'text-orange-700',
    bgClass: 'bg-orange-50/90',
    borderClass: 'border-orange-200/80',
    activeClass: 'bg-orange-600 text-white border-orange-600',
  },
  other: {
    label: 'Other',
    icon: 'more-horizontal',
    color: '#475569',
    dotClass: 'bg-slate-500',
    textClass: 'text-slate-700',
    bgClass: 'bg-slate-100/90',
    borderClass: 'border-slate-200',
    activeClass: 'bg-slate-700 text-white border-slate-700',
  },
} as const;

// ─── Chart Colors ─────────────────────────────────────────────────────────────

export const CHART_COLORS = {
  primary: '#2563eb',
  light:   '#60a5fa',
  navy:    '#1e40af',
  silver:  '#94a3b8',
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#ef4444',
};

export const CHART_GRADIENT_BLUE  = ['rgba(28,57,187,0.8)', 'rgba(28,57,187,0.1)'];
export const CHART_GRADIENT_GOLD  = ['rgba(200,169,81,0.8)', 'rgba(200,169,81,0.1)'];

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Very Hard',
};
