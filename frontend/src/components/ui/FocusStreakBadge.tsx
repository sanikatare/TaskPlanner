import { Flame, Check, Zap } from 'lucide-react';
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

  // Ensure the last N days up to effectiveStreak (capped at 7) reflect the active streak visually
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

  const tierLabel =
    effectiveStreak >= 14
      ? 'Unstoppable'
      : effectiveStreak >= 7
      ? 'Week Warrior'
      : effectiveStreak >= 3
      ? 'On Fire'
      : effectiveStreak >= 1
      ? 'Building Momentum'
      : 'Start Streak';

  if (variant === 'badge') {
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all select-none',
          isActive
            ? 'bg-amber-50/90 text-amber-800 border-amber-200/90 shadow-2xs'
            : 'bg-slate-100 text-slate-600 border-slate-200',
          className
        )}
        title={`${effectiveStreak} consecutive ${
          effectiveStreak === 1 ? 'day' : 'days'
        } of task completion`}
      >
        <span
          className={clsx(
            'inline-flex items-center justify-center w-4 h-4 rounded-full',
            isActive ? 'bg-amber-500/15 text-amber-600' : 'text-slate-400'
          )}
        >
          <Flame
            className={clsx(
              'w-3.5 h-3.5',
              isActive && 'fill-amber-500 text-amber-600'
            )}
          />
        </span>
        <span className="font-mono tabular-nums font-bold text-amber-900">
          {effectiveStreak}
        </span>
        <span>{effectiveStreak === 1 ? 'Day Streak' : 'Day Focus Streak'}</span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'card px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-amber-200/70 bg-gradient-to-r from-amber-50/50 via-white to-white',
        className
      )}
    >
      {/* Left: Visual Focus Streak Counter Badge + Status */}
      <div className="flex items-center gap-3.5">
        <div
          className={clsx(
            'relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform',
            isActive
              ? 'bg-amber-500/10 border-amber-300/80 text-amber-600 shadow-xs'
              : 'bg-slate-100 border-slate-200 text-slate-400'
          )}
        >
          <Flame
            className={clsx(
              'w-6 h-6 transition-transform',
              isActive && 'fill-amber-500 text-amber-600 scale-105'
            )}
          />
          {isActive && (
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"
              title="Streak active"
            />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {effectiveStreak}
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {effectiveStreak === 1 ? 'Day Focus Streak' : 'Days Focus Streak'}
              </span>
            </div>

            {/* Visual Badge Pill */}
            <span
              className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                isActive
                  ? 'bg-amber-100/80 text-amber-800 border-amber-300/70'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              )}
            >
              <Zap className="w-3 h-3 fill-amber-500 text-amber-600" />
              <span>{tierLabel}</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-0.5">
            {isActive
              ? `${effectiveStreak} consecutive ${
                  effectiveStreak === 1 ? 'day' : 'days'
                } of task completion${
                  completedTodayProp ?? completedToday
                    ? ' · Today’s goal completed'
                    : ' · Complete a task today to extend your streak'
                }`
              : 'Complete a task today to ignite your daily focus streak'}
          </p>
        </div>
      </div>

      {/* Right: 7-Day Consecutive Completion Chain */}
      <div className="flex items-center gap-2 sm:gap-2.5 self-start md:self-center">
        {last7Days.map((day) => (
          <div
            key={day.dateStr}
            className="flex flex-col items-center gap-1"
            title={`${day.dayShort} (${day.dateStr}): ${
              day.active ? 'Completed' : 'No completions'
            }`}
          >
            <div
              className={clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium border transition-all',
                day.active
                  ? 'bg-amber-500 border-amber-600 text-white shadow-2xs'
                  : day.isToday
                  ? 'bg-white border-dashed border-amber-400 text-amber-700'
                  : 'bg-slate-50 border-slate-200/80 text-slate-300'
              )}
            >
              {day.active ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </div>
            <span
              className={clsx(
                'text-[10px] font-mono tabular-nums',
                day.isToday
                  ? 'font-bold text-amber-700'
                  : day.active
                  ? 'font-medium text-slate-700'
                  : 'text-slate-400'
              )}
            >
              {day.isToday ? 'Today' : day.dayShort.slice(0, 2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
