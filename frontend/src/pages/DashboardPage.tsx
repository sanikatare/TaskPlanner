import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Check,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  BookOpen,
  RefreshCw,
  GripVertical,
} from 'lucide-react';
import apiClient from '@/utils/apiClient';
import { useTasks } from '@/hooks/useTasks';
import TaskCheckButton from '@/components/ui/TaskCheckButton';
import CategoryLabel from '@/components/ui/CategoryLabel';
import FocusStreakBadge from '@/components/ui/FocusStreakBadge';
import { triggerTaskCompletionEffect } from '@/utils/celebration';
import type { Analytics, AIRecommendation, ScheduleBlock, Task, TaskStatus } from '@/types';
import { deadlineLabel, deadlineUrgency, hoursToReadable, formatDate } from '@/utils/dateUtils';
import { PRIORITY_CONFIG } from '@/config/constants';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const BOARD_COLUMNS: Array<{
  id: TaskStatus;
  droppableId: string;
  title: string;
  dotClass: string;
  emptyText: string;
}> = [
  {
    id: 'pending',
    droppableId: 'column-pending',
    title: 'To Do',
    dotClass: 'bg-slate-400',
    emptyText: 'Drop tasks here to queue for study',
  },
  {
    id: 'in_progress',
    droppableId: 'column-in_progress',
    title: 'In Progress',
    dotClass: 'bg-blue-600',
    emptyText: 'Drag active tasks here while working',
  },
  {
    id: 'completed',
    droppableId: 'column-completed',
    title: 'Completed',
    dotClass: 'bg-emerald-500',
    emptyText: 'Drop tasks here to mark complete',
  },
];

function sortTasksByOrder(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const orderDiff = (a.order ?? 9999) - (b.order ?? 9999);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

export default function DashboardPage() {
  const { tasks, activeTasks, archivedTasks, isLoading: tasksLoading, completeTask, reorderTasks } = useTasks();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ['analytics'],
    queryFn: async () => (await apiClient.get('/analytics')).data.data,
  });

  const { data: recommendation } = useQuery<AIRecommendation | null>({
    queryKey: ['recommendation'],
    queryFn: async () => (await apiClient.get('/ai/recommend')).data.data,
  });

  const { data: scheduleBlocks } = useQuery<ScheduleBlock[]>({
    queryKey: ['schedule'],
    queryFn: async () => (await apiClient.get('/schedule')).data.data,
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
      toast.success('Study block completed');
    },
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; order: number }>) =>
      apiClient.patch('/schedule/reorder', { items }),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ['schedule'] });
      const previous = qc.getQueryData<ScheduleBlock[]>(['schedule']);
      if (previous) {
        const orderMap = new Map(items.map((item) => [item.id, item.order]));
        const next = previous.map((b) =>
          orderMap.has(b._id) ? { ...b, order: orderMap.get(b._id) } : b
        );
        qc.setQueryData(['schedule'], next);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['schedule'], context.previous);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const orderedTasks = useMemo(() => sortTasksByOrder(activeTasks), [activeTasks]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBlocks = useMemo(
    () =>
      (scheduleBlocks ?? [])
        .filter((b) => b.date === todayStr)
        .sort((a, b) => {
          const orderDiff = (a.order ?? 0) - (b.order ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return a.startTime.localeCompare(b.startTime);
        }),
    [scheduleBlocks, todayStr]
  );

  const pendingTasks = useMemo(
    () => orderedTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [orderedTasks]
  );

  const upcomingList = useMemo(() => pendingTasks.slice(0, 8), [pendingTasks]);

  const completionRate = analytics?.completionRate ?? 0;
  const streakDays = analytics?.streakDays ?? 0;
  const completedCount =
    analytics?.completedTasks ?? tasks.filter((t) => t.status === 'completed').length;
  const totalCount = analytics?.totalTasks ?? tasks.length;

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // 1. Reordering within Today's Study Blocks column
    if (type === 'TODAY_BLOCKS') {
      const nextBlocks = Array.from(todayBlocks);
      const [moved] = nextBlocks.splice(source.index, 1);
      nextBlocks.splice(destination.index, 0, moved);
      reorderBlocksMutation.mutate(
        nextBlocks.map((b, idx) => ({ id: b._id, order: idx }))
      );
      return;
    }

    // 2. Reordering within Upcoming Deadlines column
    if (type === 'UPCOMING_TASKS') {
      const nextUpcoming = Array.from(upcomingList);
      const [moved] = nextUpcoming.splice(source.index, 1);
      nextUpcoming.splice(destination.index, 0, moved);

      const upcomingIds = new Set(nextUpcoming.map((t) => t._id));
      const restTasks = orderedTasks.filter((t) => !upcomingIds.has(t._id));
      const combined = [...nextUpcoming, ...restTasks];

      reorderTasks(
        combined.map((t, idx) => ({
          id: t._id,
          order: idx,
          status: t.status,
        }))
      );
      return;
    }

    // 3. Reordering within or across Dashboard Task Columns (To Do / In Progress / Completed)
    if (type === 'BOARD_TASK') {
      const sourceStatus = source.droppableId.replace('column-', '') as TaskStatus;
      const destStatus = destination.droppableId.replace('column-', '') as TaskStatus;

      const columnsMap: Record<TaskStatus, Task[]> = {
        pending: orderedTasks.filter((t) => t.status === 'pending'),
        in_progress: orderedTasks.filter((t) => t.status === 'in_progress'),
        completed: orderedTasks.filter((t) => t.status === 'completed'),
        skipped: orderedTasks.filter((t) => t.status === 'skipped'),
      };

      const sourceCol = Array.from(columnsMap[sourceStatus] ?? []);
      const [movedTask] = sourceCol.splice(source.index, 1);
      if (!movedTask) return;

      if (sourceStatus === destStatus) {
        sourceCol.splice(destination.index, 0, movedTask);
        columnsMap[sourceStatus] = sourceCol;
      } else {
        const destCol = Array.from(columnsMap[destStatus] ?? []);
        const updatedTask: Task = { ...movedTask, status: destStatus };
        destCol.splice(destination.index, 0, updatedTask);
        columnsMap[sourceStatus] = sourceCol;
        columnsMap[destStatus] = destCol;

        if (destStatus === 'completed') {
          triggerTaskCompletionEffect();
          toast.success('Task marked complete');
        }
      }

      const flattened: Task[] = [
        ...columnsMap.in_progress,
        ...columnsMap.pending,
        ...columnsMap.completed,
        ...columnsMap.skipped,
      ];

      reorderTasks(
        flattened.map((t, idx) => ({
          id: t._id,
          order: idx,
          status: t.status,
        }))
      );
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="page-shell space-y-6">
        {/* Focus Streak Counter & Visual Badge */}
        <FocusStreakBadge
          variant="banner"
          streakDays={streakDays}
          completedToday={analytics?.completedToday}
          weeklyProgress={analytics?.weeklyProgress}
          tasks={tasks}
        />

        {/* Key Metrics Strip (Single-Elevation, Tabular Numerals) */}
        {analyticsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : (
          <div className="card grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">Completion Rate</div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="stat-number">{completionRate.toFixed(0)}%</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {completedCount}/{totalCount} done
                </span>
              </div>
              <div className="progress-bar mt-3">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, completionRate)}%` }}
                />
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">Study Time Logged</div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="stat-number">
                  {hoursToReadable(analytics?.totalStudyHours ?? 0)}
                </span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Target 6h/d
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2.5">
                Tracked across completed sessions
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">Active Workload</div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="stat-number">{pendingTasks.length}</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {hoursToReadable(
                    pendingTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
                  )}{' '}
                  est.
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2.5">
                Pending and in-progress tasks
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs font-medium text-slate-500">Focus Score</div>
              <div className="mt-2 flex items-baseline justify-between gap-2 flex-wrap">
                <span className="stat-number">
                  {(analytics?.avgProductivityScore ?? 0).toFixed(1)}
                  <span className="text-sm font-normal text-slate-400">/10</span>
                </span>
                <FocusStreakBadge
                  variant="badge"
                  streakDays={streakDays}
                  completedToday={analytics?.completedToday}
                  weeklyProgress={analytics?.weeklyProgress}
                  tasks={tasks}
                />
              </div>
              <div className="text-xs text-slate-500 mt-2.5">
                Average session productivity
              </div>
            </div>
          </div>
        )}

        {/* Main Two-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column: Next Priority Focus + Today's Timeline */}
          <div className="lg:col-span-3 space-y-6">
            {/* Next Recommended Task */}
            <div className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-xs font-semibold text-brand-600">
                  Recommended Focus
                </div>
                {recommendation && (
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Urgency {recommendation.urgencyScore}/10
                  </div>
                )}
              </div>

              {recommendation?.nextTask ? (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                      {recommendation.nextTask.title}
                    </h2>
                    <CategoryLabel category={recommendation.nextTask.category} />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    {recommendation.reason}
                  </p>

                  {/* Clean unboxed metadata with typographic separators */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                    <span className="font-medium text-slate-700">
                      {recommendation.nextTask.subject}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={clsx(
                        'font-medium',
                        recommendation.nextTask.priority === 'high'
                          ? 'text-red-600'
                          : recommendation.nextTask.priority === 'medium'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      )}
                    >
                      {PRIORITY_CONFIG[recommendation.nextTask.priority].label} Priority
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {deadlineLabel(recommendation.nextTask.deadline)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {hoursToReadable(recommendation.nextTask.estimatedHours)} est.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 mt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        triggerTaskCompletionEffect(e);
                        completeTask(recommendation.nextTask._id);
                      }}
                      className="btn-primary"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark Complete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/plan?taskId=${recommendation.nextTask._id}`)
                      }
                      className="btn-secondary"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Open Study Plan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/tasks?edit=${recommendation.nextTask._id}`)
                      }
                      className="btn-ghost"
                    >
                      <span>Edit Task</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="text-sm font-medium text-slate-700">
                    No pending tasks to recommend
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Create a task with a deadline and priority to get smart scheduling suggestions.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/tasks?new=1')}
                    className="btn-primary mt-3"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Task</span>
                  </button>
                </div>
              )}
            </div>

            {/* Today's Study Schedule (Draggable Reorderable Column) */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Today&apos;s Study Blocks
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    {todayBlocks.filter((b) => b.isCompleted).length} of {todayBlocks.length} blocks completed · Drag to reorder
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/schedule')}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                >
                  <span>Full schedule</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {todayBlocks.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-slate-700">
                    No blocks scheduled for today
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Generate an optimized weekly timeline from your pending tasks.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    className="btn-ghost mt-3"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Go to Schedule Optimizer</span>
                  </button>
                </div>
              ) : (
                <Droppable droppableId="today-blocks" type="TODAY_BLOCKS">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={clsx(
                        'divide-y divide-slate-100 transition-colors',
                        snapshot.isDraggingOver && 'bg-brand-50/25'
                      )}
                    >
                      {todayBlocks.map((block, index) => (
                        <Draggable
                          key={block._id}
                          draggableId={`block-${block._id}`}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={clsx(
                                'flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 transition-colors group',
                                dragSnapshot.isDragging
                                  ? 'bg-white shadow-lg ring-1 ring-brand-500/30 rounded-lg z-20'
                                  : 'hover:bg-slate-50/70'
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded transition-colors"
                                  title="Drag to reorder study block"
                                  aria-label="Drag to reorder study block"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <TaskCheckButton
                                  checked={block.isCompleted}
                                  disabled={
                                    block.isCompleted || completeBlockMutation.isPending
                                  }
                                  onToggle={() => completeBlockMutation.mutate(block._id)}
                                  label="Mark study block complete"
                                />

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={clsx(
                                        'text-sm font-medium truncate',
                                        block.isCompleted
                                          ? 'line-through text-slate-400'
                                          : 'text-slate-900'
                                      )}
                                    >
                                      {block.task?.title ?? 'Focused Study Session'}
                                    </span>
                                    {block.task?.category && (
                                      <CategoryLabel category={block.task.category} />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                    <span className="font-mono tabular-nums text-slate-700">
                                      {block.startTime} – {block.endTime}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">
                                      {block.durationMinutes}m
                                    </span>
                                    {block.task?.subject && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span>{block.task.subject}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-xs font-medium shrink-0">
                                {block.isCompleted ? (
                                  <span className="text-emerald-600">Done</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      triggerTaskCompletionEffect(e);
                                      completeBlockMutation.mutate(block._id);
                                    }}
                                    className="text-slate-500 hover:text-brand-600 transition-colors"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          </div>

          {/* Right Column: Upcoming Deadlines (Draggable Reorderable Column) */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden h-full flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Upcoming Deadlines
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Drag tasks to prioritize your queue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                >
                  <span>All tasks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {tasksLoading ? (
                <div className="p-5 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton h-14" />
                  ))}
                </div>
              ) : upcomingList.length === 0 ? (
                <div className="p-10 text-center flex-1 flex flex-col items-center justify-center">
                  <div className="text-sm font-medium text-slate-700">
                    No upcoming deadlines
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    You&apos;re all caught up on your coursework.
                  </p>
                </div>
              ) : (
                <Droppable droppableId="upcoming-deadlines" type="UPCOMING_TASKS">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={clsx(
                        'divide-y divide-slate-100 flex-1 transition-colors',
                        snapshot.isDraggingOver && 'bg-brand-50/25'
                      )}
                    >
                      {upcomingList.map((task, index) => {
                        const urgency = deadlineUrgency(task.deadline);
                        return (
                          <Draggable
                            key={task._id}
                            draggableId={`upcoming-${task._id}`}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={clsx(
                                  'flex items-start gap-2.5 px-4 sm:px-5 py-3.5 transition-colors group',
                                  dragSnapshot.isDragging
                                    ? 'bg-white shadow-lg ring-1 ring-brand-500/30 rounded-lg z-20'
                                    : 'hover:bg-slate-50/70'
                                )}
                              >
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 -ml-1 mt-0.5 rounded transition-colors shrink-0"
                                  title="Drag to reorder task"
                                  aria-label={`Drag to reorder ${task.title}`}
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <TaskCheckButton
                                  size="sm"
                                  checked={task.status === 'completed'}
                                  onToggle={() => completeTask(task._id)}
                                  label={`Mark ${task.title} complete`}
                                  title="Complete task"
                                  className="mt-0.5"
                                />
                                <button
                                  type="button"
                                  onClick={() => navigate(`/tasks?edit=${task._id}`)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                                      {task.title}
                                    </span>
                                    <CategoryLabel category={task.category} />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                                    <span>{task.subject}</span>
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className={clsx(
                                        'font-medium',
                                        task.priority === 'high'
                                          ? 'text-red-600'
                                          : task.priority === 'medium'
                                          ? 'text-amber-600'
                                          : 'text-slate-600'
                                      )}
                                    >
                                      {PRIORITY_CONFIG[task.priority].label}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">
                                      {hoursToReadable(task.estimatedHours)}
                                    </span>
                                  </div>
                                </button>

                                <div className="text-right shrink-0">
                                  <div
                                    className={clsx(
                                      'text-xs font-medium font-mono tabular-nums inline-flex items-center gap-1',
                                      urgency === 'critical'
                                        ? 'text-red-600'
                                        : urgency === 'warning'
                                        ? 'text-amber-600'
                                        : 'text-slate-600'
                                    )}
                                  >
                                    {urgency === 'critical' && (
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                    )}
                                    <span>{deadlineLabel(task.deadline)}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                    {formatDate(task.deadline, 'MMM d')}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Drag-and-Drop Task Workflow Columns */}
        <div className="card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200/80">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Task Workflow Board
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Drag and drop tasks to reorder within columns or move tasks across stages
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks?new=1')}
              className="btn-ghost text-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BOARD_COLUMNS.map((col) => {
              const colTasks = orderedTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className="flex flex-col rounded-xl bg-slate-50/80 border border-slate-200/80 p-3 min-h-[260px]"
                >
                  <div className="flex items-center justify-between px-1.5 pb-2.5 mb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx('w-2 h-2 rounded-full shrink-0', col.dotClass)}
                        aria-hidden="true"
                      />
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                        {col.title}
                      </h3>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {colTasks.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.droppableId} type="BOARD_TASK">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={clsx(
                          'flex-1 space-y-2.5 rounded-lg p-1 transition-colors min-h-[200px]',
                          snapshot.isDraggingOver &&
                            'bg-brand-50/50 ring-1 ring-brand-500/20'
                        )}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="h-44 flex items-center justify-center text-center px-4">
                            <p className="text-xs text-slate-400">{col.emptyText}</p>
                          </div>
                        )}

                        {colTasks.map((task, index) => (
                          <Draggable
                            key={task._id}
                            draggableId={`board-${task._id}`}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={clsx(
                                  'rounded-lg bg-white p-3.5 border transition-all group',
                                  dragSnapshot.isDragging
                                    ? 'shadow-lg ring-2 ring-brand-500/30 border-brand-300 rotate-[0.5deg] z-30'
                                    : 'border-slate-200/90 shadow-xs hover:border-slate-300'
                                )}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 -ml-1 mt-0.5 rounded transition-colors shrink-0"
                                    title="Drag to reorder"
                                    aria-label={`Drag ${task.title}`}
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>

                                  <TaskCheckButton
                                    size="sm"
                                    checked={task.status === 'completed'}
                                    onToggle={() => completeTask(task._id)}
                                    label={`Mark ${task.title} complete`}
                                    className="mt-0.5"
                                  />

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/tasks?edit=${task._id}`)}
                                        className={clsx(
                                          'text-xs sm:text-sm font-medium text-left leading-snug hover:text-brand-600 transition-colors line-clamp-2',
                                          task.status === 'completed'
                                            ? 'line-through text-slate-400'
                                            : 'text-slate-900'
                                        )}
                                      >
                                        {task.title}
                                      </button>
                                    </div>

                                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                      <CategoryLabel category={task.category} />
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                                        <span className="truncate">{task.subject}</span>
                                        <span aria-hidden="true">·</span>
                                        <span
                                          className={clsx(
                                            'font-medium shrink-0',
                                            task.priority === 'high'
                                              ? 'text-red-600'
                                              : task.priority === 'medium'
                                              ? 'text-amber-600'
                                              : 'text-slate-600'
                                          )}
                                        >
                                          {PRIORITY_CONFIG[task.priority].label}
                                        </span>
                                      </div>
                                      <span className="font-mono tabular-nums shrink-0">
                                        {formatDate(task.deadline, 'MMM d')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {col.id === 'completed' && archivedTasks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between px-1.5 text-[11px] text-slate-500">
                      <span>
                        +{archivedTasks.length} auto-archived (&gt;24h)
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate('/tasks?view=archive')}
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        Archive →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}
