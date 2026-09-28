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
  Calendar,
  ArrowRight,
  Plus,
  GripVertical,
  ExternalLink,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import apiClient from '@/utils/apiClient';
import { useTasks } from '@/hooks/useTasks';
import TaskCheckButton from '@/components/ui/TaskCheckButton';
import CategoryLabel from '@/components/ui/CategoryLabel';
import { triggerTaskCompletionEffect } from '@/utils/celebration';
import { buildGoogleCalendarTemplateUrl } from '@/config/firebase';
import type { ScheduleBlock, Task, TaskStatus, AIRecommendation } from '@/types';
import { deadlineLabel, hoursToReadable, formatDate } from '@/utils/dateUtils';
import { PRIORITY_CONFIG } from '@/config/constants';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const BOARD_COLUMNS: Array<{
  id: TaskStatus;
  droppableId: string;
  title: string;
  dotClass: string;
  padTint: string;
  emptyText: string;
}> = [
  {
    id: 'pending',
    droppableId: 'column-pending',
    title: 'To Do',
    dotClass: 'bg-[#E779C1]',
    padTint: 'bg-[#FDF4F9] border-[#F2C7E5]',
    emptyText: 'Drop tasks here to queue',
  },
  {
    id: 'in_progress',
    droppableId: 'column-in_progress',
    title: 'In Progress',
    dotClass: 'bg-[#A855F7]',
    padTint: 'bg-[#F8F2FF] border-[#DFC7FA]',
    emptyText: 'Drag active tasks here',
  },
  {
    id: 'completed',
    droppableId: 'column-completed',
    title: 'Completed',
    dotClass: 'bg-[#34D399]',
    padTint: 'bg-[#F0FDF4] border-[#BBF7D0]',
    emptyText: 'Drop tasks here to complete',
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
  const { activeTasks, isLoading: tasksLoading, completeTask, reorderTasks } = useTasks();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: scheduleBlocks } = useQuery<ScheduleBlock[]>({
    queryKey: ['schedule'],
    queryFn: async () => (await apiClient.get('/schedule')).data.data,
  });

  const { data: recommendation } = useQuery<AIRecommendation | null>({
    queryKey: ['recommendation'],
    queryFn: async () => (await apiClient.get('/ai/recommend')).data.data,
  });

  const completeBlockMutation = useMutation({
    mutationFn: async (blockId: string) =>
      (await apiClient.patch(`/schedule/${blockId}/complete`)).data.data,
    onMutate: () => {
      triggerTaskCompletionEffect();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
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

  const upcomingList = useMemo(() => pendingTasks.slice(0, 6), [pendingTasks]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === 'TODAY_BLOCKS') {
      const nextBlocks = Array.from(todayBlocks);
      const [moved] = nextBlocks.splice(source.index, 1);
      nextBlocks.splice(destination.index, 0, moved);
      reorderBlocksMutation.mutate(
        nextBlocks.map((b, idx) => ({ id: b._id, order: idx }))
      );
      return;
    }

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

  const now = new Date();

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="page-shell space-y-7">
        {/* Editorial Diary Spread Header */}
        <div className="card-accent p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5B8E0] flex flex-col items-center justify-center shrink-0 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-[#B8328A]">
                {format(now, 'MMM')}
              </span>
              <span className="text-xl text-[#2A1029] tabular-nums leading-none mt-0.5">
                {format(now, 'dd')}
              </span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl text-[#2A1029] tracking-tight">
                {format(now, 'EEEE')}’s Journal Spread
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {pendingTasks.length} open task{pendingTasks.length !== 1 ? 's' : ''} ·{' '}
                {todayBlocks.length} study block{todayBlocks.length !== 1 ? 's' : ''} scheduled today
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/schedule')}
              className="btn-secondary"
            >
              <Calendar className="w-4 h-4" />
              <span>Google Calendar Sync</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/tasks?new=1')}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Next Best Task Recommendation Banner */}
        {recommendation?.nextTask && (
          <div className="card bg-[#FFFCFE] p-4 sm:p-5 border-l-[3px] border-l-[#B8328A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FDF4F9] border border-[#E8CEE6] flex items-center justify-center text-[#B8328A] shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wider text-[#B8328A] font-semibold">
                    Recommended Next Focus
                  </span>
                  <span className="text-[11px] tabular-nums px-2 py-0.5 rounded-lg bg-[#FDF4F9] text-[#781D59] border border-[#F0C6E4]">
                    Urgency {recommendation.urgencyScore}/10
                  </span>
                  <CategoryLabel category={recommendation.nextTask.category} />
                </div>
                <div className="text-sm sm:text-base text-[#2A1029] font-medium mt-1 truncate">
                  {recommendation.nextTask.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {recommendation.reason} · Est.{' '}
                  <span className="tabular-nums">
                    {hoursToReadable(
                      recommendation.nextTask.aiPredictedHours ??
                        recommendation.nextTask.estimatedHours
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/plan?taskId=${recommendation.nextTask._id}`)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Study Plan</span>
              </button>
              <button
                type="button"
                onClick={() => completeTask(recommendation.nextTask._id)}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                <span>Complete</span>
              </button>
            </div>
          </div>
        )}

        {/* Two-Column Plain Diary Sheets: Upcoming Tasks & Today's Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Diary Page: Upcoming Tasks on Plain Surface */}
          <div className="card bg-[#FFFCFE] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8CEE6] bg-[#FFF9FD]">
              <div>
                <h2 className="text-base text-[#2A1029]">Upcoming Tasks</h2>
                <p className="text-xs text-slate-500">Priority checklist</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="text-xs text-[#B8328A] hover:text-[#96246F] inline-flex items-center gap-1"
              >
                <span>All tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {tasksLoading ? (
              <div className="p-5 space-y-3 bg-[#FFFCFE]">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-12" />
                ))}
              </div>
            ) : upcomingList.length === 0 ? (
              <div className="p-12 text-center flex-1 flex flex-col items-center justify-center bg-[#FFFCFE]">
                <div className="text-sm text-slate-700 bg-[#FFFCFE]">Your diary page is clear</div>
                <button
                  type="button"
                  onClick={() => navigate('/tasks?new=1')}
                  className="btn-primary mt-3"
                >
                  <Plus className="w-4 h-4" />
                  <span>Write First Task</span>
                </button>
              </div>
            ) : (
              <Droppable droppableId="upcoming-deadlines" type="UPCOMING_TASKS">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="divide-y divide-[#EAD4E8]/75 flex-1 bg-[#FFFCFE]"
                  >
                    {upcomingList.map((task, index) => (
                      <Draggable
                        key={task._id}
                        draggableId={`upcoming-${task._id}`}
                        index={index}
                      >
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className="flex items-center gap-3 px-4 py-3 bg-[#FFFCFE] hover:bg-[#FDF4F9] transition-colors group"
                          >
                            {/* Left Margin Date Column */}
                            <div className="w-10 text-[11px] text-[#B8328A] tabular-nums shrink-0 text-right pr-1">
                              {formatDate(task.deadline, 'MMM d')}
                            </div>

                            <div
                              {...dragProvided.dragHandleProps}
                              className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 rounded shrink-0"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>

                            <TaskCheckButton
                              size="sm"
                              checked={task.status === 'completed'}
                              onToggle={() => completeTask(task._id)}
                              label={`Mark ${task.title} complete`}
                            />

                            <button
                              type="button"
                              onClick={() => navigate(`/tasks?edit=${task._id}`)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="text-sm text-[#2A1029] truncate group-hover:text-[#B8328A] transition-colors">
                                {task.title}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                <span>{task.subject}</span>
                                <span aria-hidden="true">·</span>
                                <span>{PRIORITY_CONFIG[task.priority].label}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {hoursToReadable(task.estimatedHours)}
                                </span>
                              </div>
                            </button>

                            <span className="text-xs text-slate-500 tabular-nums shrink-0">
                              {deadlineLabel(task.deadline)}
                            </span>
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

          {/* Right Diary Page: Today's Schedule & Google Calendar Quick Add */}
          <div className="card bg-[#FFFCFE] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8CEE6] bg-[#FFF9FD]">
              <div>
                <h2 className="text-base text-[#2A1029]">Today&apos;s Diary Timeline</h2>
                <p className="text-xs text-slate-500">Synced study blocks & Google Calendar</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/schedule')}
                className="text-xs text-[#B8328A] hover:text-[#96246F] inline-flex items-center gap-1"
              >
                <span>Open Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayBlocks.length === 0 ? (
              <div className="p-12 text-center flex-1 flex flex-col items-center justify-center bg-[#FFFCFE]">
                <Calendar className="w-5 h-5 text-[#C83E8B] mx-auto mb-2" />
                <div className="text-sm text-slate-700 bg-[#FFFCFE]">No study blocks planned for today</div>
                <button
                  type="button"
                  onClick={() => navigate('/schedule')}
                  className="btn-primary mt-3"
                >
                  <span>Plan & Sync Calendar</span>
                </button>
              </div>
            ) : (
              <Droppable droppableId="today-blocks" type="TODAY_BLOCKS">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="divide-y divide-[#EAD4E8]/75 flex-1 bg-[#FFFCFE]"
                  >
                    {todayBlocks.map((block, index) => {
                      const gcalUrl = buildGoogleCalendarTemplateUrl({
                        title: block.task?.title ?? 'Study Session',
                        description: block.task?.subject
                          ? `Subject: ${block.task.subject}`
                          : 'Scheduled in TaskTracker Diary',
                        date: block.date,
                        startTime: block.startTime,
                        endTime: block.endTime,
                      });

                      return (
                        <Draggable
                          key={block._id}
                          draggableId={`block-${block._id}`}
                          index={index}
                        >
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className="flex items-center justify-between gap-3 px-4 py-3 bg-[#FFFCFE] hover:bg-[#FDF4F9] transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Left Margin Time Stamp */}
                                <div className="w-10 text-[11px] text-[#86198F] tabular-nums shrink-0 text-right pr-1">
                                  {block.startTime}
                                </div>

                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 rounded"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>

                                <TaskCheckButton
                                  checked={block.isCompleted}
                                  disabled={block.isCompleted || completeBlockMutation.isPending}
                                  onToggle={() => completeBlockMutation.mutate(block._id)}
                                  label="Mark study block complete"
                                />

                                <div className="min-w-0">
                                  <div
                                    className={clsx(
                                      'text-sm truncate',
                                      block.isCompleted
                                        ? 'line-through text-slate-400'
                                        : 'text-[#2A1029]'
                                    )}
                                  >
                                    {block.task?.title ?? 'Study Session'}
                                  </div>
                                  <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                                    {block.startTime} – {block.endTime} · {block.durationMinutes}m
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={gcalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded-lg text-[11px] bg-[#FDF4F9] hover:bg-[#FCE8F4] text-[#96246F] border border-[#F0C6E4] inline-flex items-center gap-1 transition-colors"
                                  title="Add to Google Calendar"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span className="hidden sm:inline">GCal</span>
                                </a>
                                {!block.isCompleted && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      triggerTaskCompletionEffect(e);
                                      completeBlockMutation.mutate(block._id);
                                    }}
                                    className="btn-primary py-1 px-2.5 text-xs"
                                  >
                                    Done
                                  </button>
                                )}
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

        {/* Pastel Stationery 3-Column Task Board */}
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-[#EAD4E8]">
            <div>
              <h2 className="text-base text-[#2A1029]">Stationery Task Board</h2>
              <p className="text-xs text-slate-500">
                Drag notes across Blush, Lavender, and Mint stages
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks?new=1')}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Note</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {BOARD_COLUMNS.map((col) => {
              const colTasks = orderedTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={clsx(
                    'flex flex-col rounded-2xl border p-3.5 min-h-[240px]',
                    col.padTint
                  )}
                >
                  <div className="flex items-center justify-between px-1.5 pb-2.5 mb-2.5 border-b border-[#EAD4E8]/80">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx('w-2.5 h-2.5 rounded-full shrink-0', col.dotClass)}
                        aria-hidden="true"
                      />
                      <h3 className="text-xs text-[#2A1029]">{col.title}</h3>
                    </div>
                    <span className="text-xs tabular-nums text-slate-500">
                      {colTasks.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.droppableId} type="BOARD_TASK">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={clsx(
                          'flex-1 space-y-2.5 rounded-xl p-1 transition-colors min-h-[180px]',
                          snapshot.isDraggingOver && 'bg-white/60'
                        )}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="h-40 flex items-center justify-center text-center px-4">
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
                                  'rounded-xl bg-white/95 p-3.5 border transition-all group',
                                  dragSnapshot.isDragging
                                    ? 'shadow-lg border-[#D44FA6] rotate-[0.5deg] z-30'
                                    : 'border-[#EAD4E8] hover:border-[#D4A4D1] shadow-xs'
                                )}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 -ml-1 mt-0.5 rounded transition-colors shrink-0"
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
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/tasks?edit=${task._id}`)}
                                      className={clsx(
                                        'text-xs sm:text-sm text-left leading-snug hover:text-[#B8328A] transition-colors line-clamp-2',
                                        task.status === 'completed'
                                          ? 'line-through text-slate-400'
                                          : 'text-[#2A1029]'
                                      )}
                                    >
                                      {task.title}
                                    </button>

                                    <div className="mt-2 pt-2 border-t border-[#F5E8F3] flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                      <CategoryLabel category={task.category} />
                                      <span className="tabular-nums shrink-0">
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}
