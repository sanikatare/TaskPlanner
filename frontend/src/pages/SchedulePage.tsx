import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  RefreshCw,
  ExternalLink,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import apiClient from '@/utils/apiClient';
import Modal from '@/components/ui/Modal';
import TaskCheckButton from '@/components/ui/TaskCheckButton';
import CategoryLabel from '@/components/ui/CategoryLabel';
import { triggerTaskCompletionEffect } from '@/utils/celebration';
import {
  initAuth,
  googleSignIn,
  logout as googleLogout,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  buildGoogleCalendarTemplateUrl,
  type GoogleCalendarEventItem,
} from '@/config/firebase';
import type { ScheduleBlock, AIScheduleResult } from '@/types';
import { DAYS_OF_WEEK, PRIORITY_CONFIG } from '@/config/constants';
import { formatDate, hoursToReadable } from '@/utils/dateUtils';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function getWeekDatesWithOffset(weekOffset: number): string[] {
  const now = new Date();
  now.setDate(now.getDate() + weekOffset * 7);
  const day = now.getDay();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - day + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

export default function SchedulePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split('T')[0];

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => getWeekDatesWithOffset(weekOffset), [weekOffset]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  // Google Calendar Client-Side Auth State
  const [needsAuth, setNeedsAuth] = useState(true);
  const [gcalUser, setGcalUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GoogleCalendarEventItem[]>([]);
  const [loadingGcal, setLoadingGcal] = useState(false);

  // Mandatory User Confirmation Modals for mutating Google Calendar operations
  const [confirmSyncModalOpen, setConfirmSyncModalOpen] = useState(false);
  const [isSyncingGcal, setIsSyncingGcal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<GoogleCalendarEventItem | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const loadGoogleCalendarEvents = useCallback(async () => {
    try {
      setLoadingGcal(true);
      const startIso = new Date(`${weekDates[0]}T00:00:00`).toISOString();
      const endIso = new Date(`${weekDates[6]}T23:59:59`).toISOString();
      const items = await fetchGoogleCalendarEvents(startIso, endIso);
      setGcalEvents(items);
    } catch {
      // If token expired, prompt re-auth
    } finally {
      setLoadingGcal(false);
    }
  }, [weekDates]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGcalUser(user);
        setNeedsAuth(false);
      },
      () => {
        setGcalUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!needsAuth) {
      loadGoogleCalendarEvents();
    }
  }, [needsAuth, loadGoogleCalendarEvents]);

  async function handleGoogleLogin() {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGcalUser(result.user);
        setNeedsAuth(false);
        toast.success('Connected to Google Calendar');
      }
    } catch {
      toast.error('Google Sign-In could not be completed in this browser window');
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleGoogleDisconnect() {
    await googleLogout();
    setGcalUser(null);
    setGcalEvents([]);
    setNeedsAuth(true);
    toast.success('Disconnected Google Calendar');
  }

  const { data: schedule, isLoading } = useQuery<ScheduleBlock[]>({
    queryKey: ['schedule'],
    queryFn: async () => (await apiClient.get('/schedule')).data.data,
  });

  const generateMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ data: AIScheduleResult }>('/schedule/generate')).data.data,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      toast.success(`Schedule optimized — ${result.schedule.length} blocks scheduled`);
    },
    onError: () => toast.error('Failed to generate schedule'),
  });

  const completeBlockMutation = useMutation({
    mutationFn: async (blockId: string) =>
      (await apiClient.patch(`/schedule/${blockId}/complete`)).data.data,
    onMutate: () => {
      triggerTaskCompletionEffect();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Study block marked complete');
    },
    onError: () => toast.error('Could not update block'),
  });

  const allBlocks = schedule ?? [];
  const selectedBlocks = allBlocks
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalDayMinutes = selectedBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const completedDayBlocks = selectedBlocks.filter((b) => b.isCompleted).length;

  async function handleConfirmSyncToGoogleCalendar() {
    setIsSyncingGcal(true);
    try {
      const blocksToSync = selectedBlocks.filter((b) => !b.isCompleted);
      for (const b of blocksToSync) {
        await createGoogleCalendarEvent({
          title: b.task?.title ?? 'Focused Study Session',
          description: b.task?.subject
            ? `Subject: ${b.task.subject}`
            : 'Scheduled via TaskTracker Diary',
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
        });
      }
      toast.success(`Synced ${blocksToSync.length} block(s) to Google Calendar`);
      setConfirmSyncModalOpen(false);
      await loadGoogleCalendarEvents();
    } catch {
      toast.error('Could not sync events to Google Calendar');
    } finally {
      setIsSyncingGcal(false);
    }
  }

  async function handleConfirmDeleteGcalEvent() {
    if (!eventToDelete) return;
    setIsDeletingEvent(true);
    try {
      await deleteGoogleCalendarEvent(eventToDelete.id);
      toast.success('Removed event from Google Calendar');
      setEventToDelete(null);
      await loadGoogleCalendarEvents();
    } catch {
      toast.error('Failed to delete Google Calendar event');
    } finally {
      setIsDeletingEvent(false);
    }
  }

  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Diary Schedule &amp; Google Calendar</h1>
          <p className="page-subtitle">
            Ruled study timeline ·{' '}
            <span className="tabular-nums text-slate-700">{allBlocks.length}</span>{' '}
            scheduled blocks
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-[#F7ECF5] border border-[#E8CEE6] rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs transition-colors',
                viewMode === 'day'
                  ? 'bg-white text-[#2A1029] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Day Page
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs transition-colors',
                viewMode === 'week'
                  ? 'bg-white text-[#2A1029] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Week Spread
            </button>
          </div>

          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primary"
          >
            <RefreshCw
              className={clsx('w-3.5 h-3.5', generateMutation.isPending && 'animate-spin')}
            />
            <span>
              {generateMutation.isPending ? 'Optimizing...' : 'Optimize Schedule'}
            </span>
          </button>
        </div>
      </div>

      {/* Google Calendar Integration Card */}
      <div className="card-accent p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#E5B8E0] flex items-center justify-center text-[#B8328A] shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm text-[#2A1029]">Google Calendar Integration</div>
            <p className="text-xs text-slate-600 mt-0.5">
              {needsAuth
                ? 'Sign in with Google to view your live Google Calendar events and sync study blocks, or click "Add to Google Calendar" on any block below.'
                : `Connected as ${gcalUser?.email ?? 'Google Account'} · ${gcalEvents.length} event(s) loaded this week`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {needsAuth ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmSyncModalOpen(true)}
                disabled={selectedBlocks.filter((b) => !b.isCompleted).length === 0}
                className="btn-primary"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Sync Day to Google Calendar</span>
              </button>
              <button
                type="button"
                onClick={handleGoogleDisconnect}
                className="btn-ghost text-xs"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Week Navigation & 7-Day Selector Strip */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#EAD4E8] bg-[#FFF9FD]/90">
          <div className="text-xs text-[#2A1029]">
            {formatDate(weekDates[0], 'MMM d')} – {formatDate(weekDates[6], 'MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const nextOffset = weekOffset - 1;
                setWeekOffset(nextOffset);
                setSelectedDate(getWeekDatesWithOffset(nextOffset)[0]);
              }}
              className="p-1.5 rounded-lg border border-[#E8CEE6] bg-white text-slate-600 hover:bg-[#FDF4F9]"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setSelectedDate(todayStr);
              }}
              className="px-2.5 py-1 rounded-lg border border-[#E8CEE6] bg-white text-xs text-slate-700 hover:bg-[#FDF4F9]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const nextOffset = weekOffset + 1;
                setWeekOffset(nextOffset);
                setSelectedDate(getWeekDatesWithOffset(nextOffset)[0]);
              }}
              className="p-1.5 rounded-lg border border-[#E8CEE6] bg-white text-slate-600 hover:bg-[#FDF4F9]"
              aria-label="Next week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 divide-x divide-[#EAD4E8]">
          {weekDates.map((date, i) => {
            const dayBlocks = allBlocks.filter((b) => b.date === date);
            const dayHours =
              dayBlocks.reduce((sum, b) => sum + b.durationMinutes, 0) / 60;
            const isToday = date === todayStr;
            const isSelected = date === selectedDate;

            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setSelectedDate(date);
                  if (viewMode === 'week') setViewMode('day');
                }}
                className={clsx(
                  'flex flex-col items-center py-3.5 px-2 transition-colors text-center relative',
                  isSelected
                    ? 'bg-[#FDF4F9] text-[#96246F]'
                    : 'hover:bg-[#FCF8FB] text-slate-700'
                )}
              >
                <span
                  className={clsx(
                    'text-[11px]',
                    isSelected ? 'text-[#B8328A]' : 'text-slate-500'
                  )}
                >
                  {DAYS_OF_WEEK[i]}
                </span>
                <span
                  className={clsx(
                    'mt-1 w-7 h-7 rounded-full flex items-center justify-center text-sm tabular-nums',
                    isSelected
                      ? 'bg-[#C83E8B] text-white'
                      : isToday
                      ? 'bg-[#BBF7D0] text-[#14532D]'
                      : 'text-slate-900'
                  )}
                >
                  {Number(date.split('-')[2])}
                </span>
                <span className="mt-1.5 text-[11px] tabular-nums text-slate-500">
                  {dayBlocks.length > 0 ? hoursToReadable(dayHours) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Ruled Diary Schedule Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : viewMode === 'day' ? (
        <div className="card bg-[#FFFCFE] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-[#EAD4E8] bg-[#FFF9FD]">
            <div>
              <h2 className="text-base text-[#2A1029]">
                {formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h2>
              <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {selectedBlocks.length} block{selectedBlocks.length !== 1 ? 's' : ''} ·{' '}
                {hoursToReadable(totalDayMinutes / 60)} planned · {completedDayBlocks} completed
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks?new=1')}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          {selectedBlocks.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Calendar className="w-6 h-6 text-[#C83E8B] mx-auto mb-2.5" />
              <div className="text-sm text-[#2A1029]">
                No study blocks written on this diary page
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click &quot;Optimize Schedule&quot; to automatically allocate your pending tasks onto your diary timeline.
              </p>
              <button
                type="button"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="btn-primary mt-4"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Optimize Schedule</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EAD4E8]/75">
              {selectedBlocks.map((block) => {
                const gcalUrl = buildGoogleCalendarTemplateUrl({
                  title: block.task?.title ?? 'Focused Study Session',
                  description: block.task?.subject
                    ? `Subject: ${block.task.subject}`
                    : 'Scheduled via TaskTracker Diary',
                  date: block.date,
                  startTime: block.startTime,
                  endTime: block.endTime,
                });

                return (
                  <div
                    key={block._id}
                    className={clsx(
                      'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#FDF4F9]/60 transition-colors',
                      block.isCompleted && 'opacity-65'
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Left Margin Time Column */}
                      <div className="w-11 text-xs text-[#86198F] tabular-nums shrink-0 text-right pr-1.5 pt-0.5">
                        {block.startTime}
                      </div>

                      <TaskCheckButton
                        checked={block.isCompleted}
                        disabled={block.isCompleted || completeBlockMutation.isPending}
                        onToggle={() => completeBlockMutation.mutate(block._id)}
                        label="Complete study block"
                        className="mt-0.5"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={clsx(
                              'text-sm',
                              block.isCompleted
                                ? 'line-through text-slate-400'
                                : 'text-[#2A1029]'
                            )}
                          >
                            {block.task?.title ?? 'Focused Study Session'}
                          </span>
                          {block.task?.category && (
                            <CategoryLabel category={block.task.category} />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <span className="tabular-nums text-slate-700">
                            {block.startTime} – {block.endTime}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {block.durationMinutes} min
                          </span>
                          {block.task?.subject && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{block.task.subject}</span>
                            </>
                          )}
                          {block.task?.priority && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {PRIORITY_CONFIG[block.task.priority].label} Priority
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pl-14 sm:pl-0">
                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary py-1.5 px-3 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Add to Google Calendar</span>
                      </a>

                      {!block.isCompleted ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            triggerTaskCompletionEffect(e);
                            completeBlockMutation.mutate(block._id);
                          }}
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#0F4C2A] px-2">Completed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Week Overview Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weekDates.map((date, idx) => {
            const dayBlocks = allBlocks
              .filter((b) => b.date === date)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={date} className="card bg-[#FFFCFE] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAD4E8] bg-[#FFF9FD]">
                  <span className="text-xs text-[#2A1029]">
                    {DAYS_OF_WEEK[idx]}, {formatDate(date, 'MMM d')}
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {dayBlocks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex-1 flex items-center justify-center">
                    No study blocks scheduled
                  </div>
                ) : (
                  <div className="divide-y divide-[#EAD4E8]/75">
                    {dayBlocks.map((b) => (
                      <div key={b._id} className="px-4 py-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={clsx(
                              'text-xs truncate',
                              b.isCompleted ? 'line-through text-slate-400' : 'text-[#2A1029]'
                            )}
                          >
                            {b.task?.title ?? 'Study Session'}
                          </div>
                          <div className="text-[11px] tabular-nums text-slate-500 mt-0.5">
                            {b.startTime} – {b.endTime} · {b.durationMinutes}m
                          </div>
                        </div>
                        {b.isCompleted && (
                          <Check className="w-3.5 h-3.5 text-[#0F4C2A] shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Live Google Calendar Events Feed (when signed in) */}
      {!needsAuth && (
        <div className="card bg-[#FFFCFE] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#EAD4E8] bg-[#FFF9FD]">
            <div>
              <h2 className="text-base text-[#2A1029]">Google Calendar Events (This Week)</h2>
              <p className="text-xs text-slate-500">
                Live events from your primary Google Calendar
              </p>
            </div>
            <button
              type="button"
              onClick={loadGoogleCalendarEvents}
              disabled={loadingGcal}
              className="btn-ghost text-xs"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', loadingGcal && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>

          {gcalEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No Google Calendar events found for this week.
            </div>
          ) : (
            <div className="divide-y divide-[#EAD4E8]/75">
              {gcalEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#FDF4F9]/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-[#2A1029] truncate">
                      {ev.summary || 'Untitled Event'}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {ev.start?.dateTime
                        ? formatDate(ev.start.dateTime, 'EEE, MMM d · h:mm a')
                        : ev.start?.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ev.htmlLink && (
                      <a
                        href={ev.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost py-1 px-2.5 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEventToDelete(ev)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete event from Google Calendar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mandatory User Confirmation Modal: Syncing Events to Google Calendar */}
      <Modal
        isOpen={confirmSyncModalOpen}
        onClose={() => setConfirmSyncModalOpen(false)}
        title="Confirm Google Calendar Sync"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Create{' '}
            <span className="tabular-nums text-[#2A1029]">
              {selectedBlocks.filter((b) => !b.isCompleted).length}
            </span>{' '}
            study block event(s) for{' '}
            <span>{formatDate(selectedDate, 'MMMM d, yyyy')}</span> on your primary Google Calendar?
          </p>
          <div className="rounded-xl bg-[#FDF4F9] border border-[#EAD4E8] p-3 space-y-1.5 max-h-44 overflow-y-auto">
            {selectedBlocks
              .filter((b) => !b.isCompleted)
              .map((b) => (
                <div key={b._id} className="text-xs text-slate-700 flex justify-between gap-2">
                  <span className="truncate">{b.task?.title ?? 'Focused Study Session'}</span>
                  <span className="tabular-nums text-slate-500 shrink-0">
                    {b.startTime} – {b.endTime}
                  </span>
                </div>
              ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAD4E8]">
            <button
              type="button"
              onClick={() => setConfirmSyncModalOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSyncToGoogleCalendar}
              disabled={isSyncingGcal}
              className="btn-primary"
            >
              {isSyncingGcal ? 'Syncing...' : 'Confirm & Create Events'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Mandatory User Confirmation Modal: Deleting Event from Google Calendar */}
      <Modal
        isOpen={Boolean(eventToDelete)}
        onClose={() => setEventToDelete(null)}
        title="Delete Event from Google Calendar?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to permanently delete{' '}
            <span className="text-[#2A1029]">
              &ldquo;{eventToDelete?.summary || 'Untitled Event'}&rdquo;
            </span>{' '}
            from your Google Calendar? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAD4E8]">
            <button
              type="button"
              onClick={() => setEventToDelete(null)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteGcalEvent}
              disabled={isDeletingEvent}
              className="btn-primary"
            >
              {isDeletingEvent ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
