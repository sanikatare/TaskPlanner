import { Check, Sparkles } from 'lucide-react';
import { subDays, format } from 'date-fns';
import type { Task, WeeklyProgress } from '@/types';
import clsx from 'clsx';

interface FocusStreakBadgeProps {
  streakDays: number;
  completedToday?: boolean;
  weeklyProgress?: WeeklyProgress[];
  tasks?: Task[];
  variant?: 'badge' | 'banner';
  className?: string;
}

export function computeConsecutiveTaskStreak(
  tasks: Task[],
  backendStreakDays = 0,
  weeklyProgress: WeeklyProgress[] = []
): {
  streakDays: number;
  completedToday: boolean;
  last7Days: Array<{ dateStr: string; dayShort: string; isToday: boolean; active: boolean }>;
} {
  const activeDates = new Set<string>();

  for (const t of tasks) {
    if (t.status === 'completed') {
      const rawDate = t.completedAt || t.updatedAt;
      if (rawDate) {
        try {
          activeDates.add(format(new Date(rawDate), 'yyyy-MM-dd'));
        } catch {
          // ignore invalid date
        }
      }
    }
  }

  for (const wp of weeklyProgress) {
    if (wp.completed > 0 || wp.studyHours > 0) {
      activeDates.add(wp.date);
    }
  }

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

  let localConsecutive = 0;
  const startOffset = activeDates.has(todayStr)
    ? 0
    : activeDates.has(yesterdayStr)
    ? 1
    : -1;

  if (startOffset >= 0) {
    for (let i = startOffset; i < 365; i++) {
      const d = format(subDays(now, i), 'yyyy-MM-dd');
      if (activeDates.has(d)) {
        localConsecutive++;
      } else {
        break;
      }
    }
  }

  const effectiveStreak = Math.max(backendStreakDays, localConsecutive);
  const completedToday = activeDates.has(todayStr) || effectiveStreak > 0;

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const dt = subDays(now, i);
    const dateStr = format(dt, 'yyyy-MM-dd');
    const isWithinStreakChain = effectiveStreak > 0 && i < effectiveStreak;
    last7Days.push({
      dateStr,
      dayShort: format(dt, 'EEE'),
      isToday: i === 0,
      active: activeDates.has(dateStr) || isWithinStreakChain,
    });
  }

  return {
    streakDays: effectiveStreak,
    completedToday,
    last7Days,
  };
}

export default function FocusStreakBadge({
  streakDays,
  completedToday: completedTodayProp,
  weeklyProgress = [],
  tasks = [],
  variant = 'badge',
  className,
}: FocusStreakBadgeProps) {
  const {
    streakDays: effectiveStreak,
    completedToday,
    last7Days,
  } = computeConsecutiveTaskStreak(tasks, streakDays, weeklyProgress);

  const isActive = effectiveStreak > 0;

  if (variant === 'badge') {
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs select-none',
          isActive ? 'text-[#B8328A]' : 'text-slate-500',
          className
        )}
      >
        <Sparkles className="w-3.5 h-3.5 text-[#C83E8B] shrink-0" />
        <span className="tabular-nums text-slate-900">{effectiveStreak}d streak</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        className
      )}
    >
      {/* Left: Simple Streak Summary */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#FDF4F9] border border-[#F3CBE6] text-[#C83E8B]">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
            <circle cx="9" cy="10" r="1.3" fill="currentColor" />
            <circle cx="15" cy="10" r="1.3" fill="currentColor" />
            <path
              d="M8.5 14.2C9.5 15.6 11 16.2 12 16.2C13 16.2 14.5 15.6 15.5 14.2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div>
          <div className="text-base text-slate-900 tabular-nums">
            {effectiveStreak} {effectiveStreak === 1 ? 'Day Streak' : 'Days Streak'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {completedTodayProp ?? completedToday
              ? 'Today’s focus check-in is complete'
              : 'Complete a task today to keep your streak going'}
          </p>
        </div>
      </div>

      {/* Right: Clean 7-Day Pastel Circles */}
      <div className="flex items-center gap-2 self-start sm:self-center">
        {last7Days.map((day) => (
          <div
            key={day.dateStr}
            className="flex flex-col items-center gap-1"
            title={`${day.dayShort} (${day.dateStr})`}
          >
            <div
              className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs border transition-all',
                day.active
                  ? 'bg-[#FCE7F3] border-[#F3A9D8] text-[#B8328A]'
                  : day.isToday
                  ? 'bg-white border-dashed border-[#E779C1] text-[#B8328A]'
                  : 'bg-[#FCF8FB] border-[#F0DFEE] text-slate-300'
              )}
            >
              {day.active ? (
                <Check className="w-3.5 h-3.5 stroke-[2]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </div>
            <span
              className={clsx(
                'text-[10px] tabular-nums',
                day.isToday ? 'text-[#B8328A]' : 'text-slate-400'
              )}
            >
              {day.dayShort}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
