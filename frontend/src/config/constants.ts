export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const AI_BASE_URL  = import.meta.env.VITE_AI_BASE_URL  || 'http://localhost:8000';

export const ENDPOINTS = {
  AUTH_LOGIN:     '/auth/login',
  AUTH_REGISTER:  '/auth/register',
  AUTH_ME:        '/auth/me',
  AUTH_LOGOUT:    '/auth/logout',
  TASKS:          '/tasks',
  TASK_BY_ID:     (id: string) => `/tasks/${id}`,
  TASK_COMPLETE:  (id: string) => `/tasks/${id}/complete`,
  TASK_SKIP:      (id: string) => `/tasks/${id}/skip`,
  SCHEDULE:         '/schedule',
  SCHEDULE_GENERATE:'/schedule/generate',
  SCHEDULE_SYNC:    '/schedule/sync-calendar',
  ANALYTICS:        '/analytics',
  ANALYTICS_WEEKLY: '/analytics/weekly',
  AI_PREDICT:       '/predict-time',
  AI_RECOMMEND:     '/recommend',
  AI_SCHEDULE:      '/optimize-schedule',
  AI_PLAN:          '/generate-plan',
  CALENDAR_AUTH:    '/calendar/auth',
  CALENDAR_SYNC:    '/calendar/sync',
} as const;

export const PRIORITY_CONFIG = {
  high: {
    label: 'High',
    color: '#E11D48',
    bg: 'badge-high',
    weight: 3,
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/90',
    activeBadgeClass: 'bg-rose-600 text-white border-rose-600',
    accentBorderClass: 'border-l-rose-500',
  },
  medium: {
    label: 'Medium',
    color: '#D97706',
    bg: 'badge-medium',
    weight: 2,
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/90',
    activeBadgeClass: 'bg-amber-600 text-white border-amber-600',
    accentBorderClass: 'border-l-amber-400',
  },
  low: {
    label: 'Low',
    color: '#059669',
    bg: 'badge-low',
    weight: 1,
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
    activeBadgeClass: 'bg-emerald-600 text-white border-emerald-600',
    accentBorderClass: 'border-l-emerald-400',
  },
} as const;

export const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: '#7D547B' },
  in_progress: { label: 'In Progress', color: '#B8328A' },
  completed:   { label: 'Completed',   color: '#9333EA' },
  skipped:     { label: 'Skipped',     color: '#AE84AC' },
} as const;

export const CATEGORY_CONFIG = {
  study: {
    label: 'Study',
    icon: 'book-open',
    color: '#B8328A',
    dotClass: 'bg-[#D44FA6]',
    textClass: 'text-[#96246F]',
    bgClass: 'bg-[#FDF4F9]',
    borderClass: 'border-[#F3BFE0]',
    activeClass: 'bg-[#B8328A] text-white border-[#B8328A]',
  },
  work: {
    label: 'Work',
    icon: 'briefcase',
    color: '#9333EA',
    dotClass: 'bg-[#9333EA]',
    textClass: 'text-[#6B21A8]',
    bgClass: 'bg-[#FAF5FF]',
    borderClass: 'border-[#E9D5FF]',
    activeClass: 'bg-[#9333EA] text-white border-[#9333EA]',
  },
  personal: {
    label: 'Personal',
    icon: 'user',
    color: '#C83E82',
    dotClass: 'bg-[#E779C1]',
    textClass: 'text-[#96246F]',
    bgClass: 'bg-[#FDF4F9]',
    borderClass: 'border-[#F9D0EA]',
    activeClass: 'bg-[#D44FA6] text-white border-[#D44FA6]',
  },
  programming: {
    label: 'Programming',
    icon: 'code-2',
    color: '#7E22CE',
    dotClass: 'bg-[#A855F7]',
    textClass: 'text-[#6B21A8]',
    bgClass: 'bg-[#F3E8FF]/70',
    borderClass: 'border-[#D8B4FE]',
    activeClass: 'bg-[#7E22CE] text-white border-[#7E22CE]',
  },
  math: {
    label: 'Mathematics',
    icon: 'calculator',
    color: '#96246F',
    dotClass: 'bg-[#B8328A]',
    textClass: 'text-[#781D59]',
    bgClass: 'bg-[#FCE8F4]/70',
    borderClass: 'border-[#F3A9D8]',
    activeClass: 'bg-[#96246F] text-white border-[#96246F]',
  },
  science: {
    label: 'Science',
    icon: 'flask',
    color: '#86198F',
    dotClass: 'bg-[#C084FC]',
    textClass: 'text-[#701A75]',
    bgClass: 'bg-[#FAF5FF]',
    borderClass: 'border-[#E9D5FF]',
    activeClass: 'bg-[#86198F] text-white border-[#86198F]',
  },
  lab: {
    label: 'Lab Work',
    icon: 'microscope',
    color: '#B8328A',
    dotClass: 'bg-[#E779C1]',
    textClass: 'text-[#96246F]',
    bgClass: 'bg-[#FDF4F9]',
    borderClass: 'border-[#F3BFE0]',
    activeClass: 'bg-[#B8328A] text-white border-[#B8328A]',
  },
  theory: {
    label: 'Theory',
    icon: 'book-open',
    color: '#9333EA',
    dotClass: 'bg-[#A855F7]',
    textClass: 'text-[#6B21A8]',
    bgClass: 'bg-[#FAF5FF]',
    borderClass: 'border-[#E9D5FF]',
    activeClass: 'bg-[#9333EA] text-white border-[#9333EA]',
  },
  project: {
    label: 'Project',
    icon: 'folder-kanban',
    color: '#781D59',
    dotClass: 'bg-[#D44FA6]',
    textClass: 'text-[#781D59]',
    bgClass: 'bg-[#FCE8F4]/60',
    borderClass: 'border-[#F3BFE0]',
    activeClass: 'bg-[#781D59] text-white border-[#781D59]',
  },
  other: {
    label: 'Other',
    icon: 'more-horizontal',
    color: '#5E3A5D',
    dotClass: 'bg-[#AE84AC]',
    textClass: 'text-[#5E3A5D]',
    bgClass: 'bg-[#F8EEF7]',
    borderClass: 'border-[#EDD8EB]',
    activeClass: 'bg-[#5E3A5D] text-white border-[#5E3A5D]',
  },
} as const;

export const CHART_COLORS = {
  primary: '#B8328A',
  light:   '#E779C1',
  navy:    '#6B21A8',
  silver:  '#AE84AC',
  success: '#D44FA6',
  warning: '#9333EA',
  danger:  '#C83E82',
};

export const CHART_GRADIENT_BLUE  = ['rgba(184,50,138,0.8)', 'rgba(184,50,138,0.1)'];
export const CHART_GRADIENT_GOLD  = ['rgba(147,51,234,0.8)', 'rgba(147,51,234,0.1)'];

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Very Hard',
};
