import { format, formatDistanceToNow, differenceInDays, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import type { Task } from '@/types';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isTaskArchived(task: Task): boolean {
  if (task.status !== 'completed') return false;
  if (task.isArchived === true) return true;
  const rawCompleted = task.completedAt || task.updatedAt;
  if (!rawCompleted) return false;
  const completedMs = new Date(rawCompleted).getTime();
  if (Number.isNaN(completedMs)) return false;
  return Date.now() - completedMs >= TWENTY_FOUR_HOURS_MS;
}

export function hoursUntilArchive(task: Task): number | null {
  if (task.status !== 'completed' || isTaskArchived(task)) return null;
  const rawCompleted = task.completedAt || task.updatedAt;
  if (!rawCompleted) return 24;
  const completedMs = new Date(rawCompleted).getTime();
  if (Number.isNaN(completedMs)) return 24;
  const elapsedMs = Math.max(0, Date.now() - completedMs);
  const remainingHours = Math.ceil((TWENTY_FOUR_HOURS_MS - elapsedMs) / (60 * 60 * 1000));
  return Math.max(1, remainingHours);
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'h:mm a');
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function daysUntilDeadline(deadline: string): number {
  return differenceInDays(parseISO(deadline), new Date());
}

export function deadlineLabel(deadline: string): string {
  const d = parseISO(deadline);
  if (isPast(d))       return 'Overdue';
  if (isToday(d))      return 'Due today';
  if (isTomorrow(d))   return 'Due tomorrow';
  const days = daysUntilDeadline(deadline);
  return `${days} days left`;
}

export function deadlineUrgency(deadline: string): 'critical' | 'warning' | 'safe' {
  const days = daysUntilDeadline(deadline);
  if (days <= 1)  return 'critical';
  if (days <= 3)  return 'warning';
  return 'safe';
}

export function hoursToReadable(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getCurrentWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - day + i);
    dates.push(format(d, 'yyyy-MM-dd'));
  }
  return dates;
}
