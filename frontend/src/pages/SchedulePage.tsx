import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  RefreshCw,
  ExternalLink,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Plus,
} from 'lucide-react';
import apiClient from '@/utils/apiClient';
import TaskCheckButton from '@/components/ui/TaskCheckButton';
import CategoryLabel from '@/components/ui/CategoryLabel';
import { triggerTaskCompletionEffect } from '@/utils/celebration';
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
      qc.invalidateQueries({ queryKey: ['analytics'] });
      toast.success('Study block marked complete');
    },
    onError: () => toast.error('Could not update block'),
  });

  const syncMutation = useMutation({
    mutationFn: async () => apiClient.post('/schedule/sync-calendar'),
    onSuccess: () => toast.success('Synced with Google Calendar'),
    onError: () => toast.error('Connect Google Calendar in settings first'),
  });

  const allBlocks = schedule ?? [];
  const selectedBlocks = allBlocks
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalDayMinutes = selectedBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const completedDayBlocks = selectedBlocks.filter((b) => b.isCompleted).length;

  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Schedule</h1>
          <p className="page-subtitle">
            Earliest-Deadline-First study timeline ·{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">
              {allBlocks.length}
            </span>{' '}
            total blocks
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Day View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Week Overview
            </button>
          </div>

          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="btn-ghost"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{syncMutation.isPending ? 'Syncing...' : 'Sync Calendar'}</span>
          </button>

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

      {/* Week Navigation & 7-Day Selector Strip */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-slate-50/50">
          <div className="text-xs font-semibold text-slate-800">
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
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
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
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Next week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 divide-x divide-slate-200/80">
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
                    ? 'bg-brand-50/70 text-brand-700'
                    : 'hover:bg-slate-50 text-slate-700'
                )}
              >
                <span
                  className={clsx(
                    'text-[11px] font-medium',
                    isSelected ? 'text-brand-600 font-semibold' : 'text-slate-500'
                  )}
                >
                  {DAYS_OF_WEEK[i]}
                </span>
                <span
                  className={clsx(
                    'mt-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-mono tabular-nums font-semibold',
                    isSelected
                      ? 'bg-brand-600 text-white'
                      : isToday
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-900'
                  )}
                >
                  {Number(date.split('-')[2])}
                </span>
                <span className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500">
                  {dayBlocks.length > 0 ? hoursToReadable(dayHours) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Schedule Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : viewMode === 'day' ? (
        <div className="card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-slate-200/80">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h2>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                {selectedBlocks.length} block{selectedBlocks.length !== 1 ? 's' : ''} ·{' '}
                {hoursToReadable(totalDayMinutes / 60)} planned · {completedDayBlocks} completed
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks?new=1')}
              className="btn-ghost text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          {selectedBlocks.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Calendar className="w-6 h-6 text-slate-400 mx-auto mb-2.5" />
              <div className="text-sm font-semibold text-slate-800">
                No study blocks scheduled for this day
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click &quot;Optimize Schedule&quot; to automatically allocate your pending tasks across your available daily study windows.
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
            <div className="divide-y divide-slate-200/80">
              {selectedBlocks.map((block) => (
                <div
                  key={block._id}
                  className={clsx(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors',
                    block.isCompleted && 'opacity-65 bg-slate-50/40'
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
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
                            'text-sm font-semibold',
                            block.isCompleted
                              ? 'line-through text-slate-500'
                              : 'text-slate-900'
                          )}
                        >
                          {block.task?.title ?? 'Focused Study Session'}
                        </span>
                        {block.task?.category && (
                          <CategoryLabel category={block.task.category} />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <span className="font-mono tabular-nums font-medium text-slate-700">
                          {block.startTime} – {block.endTime}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
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
                            <span
                              className={clsx(
                                'font-medium',
                                block.task.priority === 'high'
                                  ? 'text-red-600'
                                  : block.task.priority === 'medium'
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              )}
                            >
                              {PRIORITY_CONFIG[block.task.priority].label} Priority
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
                    {block.taskId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/plan?taskId=${block.taskId}`)}
                        className="btn-ghost py-1.5 px-2.5 text-xs"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                        <span>Study Plan</span>
                      </button>
                    )}
                    {!block.isCompleted ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          triggerTaskCompletionEffect(e);
                          completeBlockMutation.mutate(block._id);
                        }}
                        className="btn-secondary py-1.5 px-3 text-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-emerald-600 px-2">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
              <div key={date} className="card overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-slate-50/50">
                  <span className="text-xs font-semibold text-slate-900">
                    {DAYS_OF_WEEK[idx]}, {formatDate(date, 'MMM d')}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {dayBlocks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex-1 flex items-center justify-center">
                    No study blocks scheduled
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dayBlocks.map((b) => (
                      <div key={b._id} className="px-4 py-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={clsx(
                              'text-xs font-medium truncate',
                              b.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                            )}
                          >
                            {b.task?.title ?? 'Study Session'}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                            {b.startTime} – {b.endTime} · {b.durationMinutes}m
                          </div>
                        </div>
                        {b.isCompleted && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
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

      {/* Optimization Notes & Warnings */}
      {generateMutation.data?.optimizationNotes && (
        <div className="card-accent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Optimizer Summary: </span>
            {generateMutation.data.optimizationNotes}
          </div>
          {generateMutation.data.warnings?.length > 0 && (
            <div className="text-xs text-amber-700 font-medium">
              {generateMutation.data.warnings.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
