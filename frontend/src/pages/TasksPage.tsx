import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  BookOpen,
  SkipForward,
  AlertTriangle,
  X,
  Archive,
  ArchiveRestore,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import Modal from '@/components/ui/Modal';
import TaskCheckButton from '@/components/ui/TaskCheckButton';
import CategoryLabel, { CategoryPicker } from '@/components/ui/CategoryLabel';
import type {
  Task,
  CreateTaskForm,
  UpdateTaskForm,
  Priority,
  SubjectCategory,
  TaskStatus,
} from '@/types';
import {
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  CATEGORY_CONFIG,
  DIFFICULTY_LABELS,
} from '@/config/constants';
import {
  deadlineLabel,
  deadlineUrgency,
  hoursToReadable,
  formatDate,
  timeAgo,
  hoursUntilArchive,
} from '@/utils/dateUtils';
import clsx from 'clsx';

type SortField = 'deadline' | 'priority' | 'estimatedHours' | 'difficulty';

const PRIORITY_ORDER: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

function TaskForm({
  initial,
  isEdit,
  onSubmit,
  onClose,
}: {
  initial?: Partial<Task>;
  isEdit?: boolean;
  onSubmit: (f: CreateTaskForm & { status?: TaskStatus }) => Promise<void>;
  onClose: () => void;
}) {
  const defaultDeadline = useMemo(() => {
    if (initial?.deadline) {
      return initial.deadline.split('T')[0];
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    return tomorrow.toISOString().split('T')[0];
  }, [initial?.deadline]);

  const [form, setForm] = useState<CreateTaskForm & { status: TaskStatus }>({
    title: initial?.title ?? '',
    subject: initial?.subject ?? '',
    category: initial?.category ?? 'study',
    description: initial?.description ?? '',
    deadline: defaultDeadline,
    estimatedHours: initial?.estimatedHours ?? 2,
    priority: initial?.priority ?? 'medium',
    difficulty: initial?.difficulty ?? 3,
    tags: initial?.tags ?? [],
    status: initial?.status ?? 'pending',
  });

  const [tagInput, setTagInput] = useState((initial?.tags ?? []).join(', '));
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.subject.trim() || !form.deadline) return;
    setSubmitting(true);
    try {
      const parsedTags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSubmit({ ...form, tags: parsedTags });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div>
        <label className="label">Task Title</label>
        <input
          className="input"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="e.g. Implement B+ Tree Range Scans"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="label">Subject / Course</label>
        <input
          className="input"
          value={form.subject}
          onChange={(e) => update('subject', e.target.value)}
          placeholder="e.g. Database Systems, Internship Prep, Personal"
          required
        />
      </div>

      <div>
        <label className="label">Category Label</label>
        <CategoryPicker
          value={form.category}
          onChange={(c) => update('category', c)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Due Date</label>
          <input
            type="date"
            className="input font-mono tabular-nums"
            value={form.deadline}
            onChange={(e) => update('deadline', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Estimated Effort (hours)</label>
          <input
            type="number"
            className="input font-mono tabular-nums"
            value={form.estimatedHours}
            onChange={(e) => update('estimatedHours', Number(e.target.value))}
            min={0.5}
            max={100}
            step={0.5}
            required
          />
        </div>
      </div>

      {/* Priority Segmented Selector */}
      <div>
        <label className="label">Priority</label>
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
          {(['low', 'medium', 'high'] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => update('priority', p)}
              className={clsx(
                'py-1.5 px-3 rounded-md text-xs font-medium transition-colors',
                form.priority === p
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Difficulty (1–5)</label>
          <select
            className="input"
            value={form.difficulty}
            onChange={(e) =>
              update('difficulty', Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
            }
          >
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d} — {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>

        {isEdit ? (
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => update('status', e.target.value as TaskStatus)}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input
              className="input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. lab-2, midterm, group"
            />
          </div>
        )}
      </div>

      {isEdit && (
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input
            className="input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="e.g. lab-2, midterm, group"
          />
        </div>
      )}

      <div>
        <label className="label">Notes & Deliverables (optional)</label>
        <textarea
          className="input resize-none h-20"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Key requirements, chapters, or submission instructions..."
        />
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80">
        <button className="btn-ghost" onClick={onClose} type="button">
          Cancel
        </button>
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}

function TaskRow({
  task,
  isArchiveView,
  onToggleComplete,
  onStatusChange,
  onCategoryClick,
  onEdit,
  onSkip,
  onArchive,
  onRestore,
  onReopen,
  onDelete,
  onOpenPlan,
}: {
  task: Task;
  isArchiveView?: boolean;
  onToggleComplete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onCategoryClick: (category: SubjectCategory) => void;
  onEdit: () => void;
  onSkip: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onOpenPlan: () => void;
}) {
  const urgency = deadlineUrgency(task.deadline);
  const isCompleted = task.status === 'completed';
  const remainingArchiveHours = hoursUntilArchive(task);

  return (
    <div
      className={clsx(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/80 transition-colors group',
        isCompleted && 'opacity-75 bg-slate-50/40'
      )}
    >
      {/* Left: Checkbox + Title + Unboxed Metadata */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <TaskCheckButton
          checked={isCompleted}
          onToggle={isArchiveView ? onReopen : onToggleComplete}
          label={`Mark ${task.title} complete`}
          title={isArchiveView ? 'Reopen task as pending' : isCompleted ? 'Completed' : 'Mark complete'}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onEdit}
              className={clsx(
                'text-sm font-semibold text-left hover:text-brand-600 transition-colors',
                isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
              )}
            >
              {task.title}
            </button>
            <CategoryLabel
              category={task.category}
              onClick={() => onCategoryClick(task.category)}
            />
          </div>

          {task.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}

          {/* Unboxed Metadata Line */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1.5">
            <span className="font-medium text-slate-700">{task.subject}</span>
            <span aria-hidden="true">·</span>
            <span
              className={clsx(
                'font-medium',
                task.priority === 'high'
                  ? 'text-red-600'
                  : task.priority === 'medium'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              )}
            >
              {PRIORITY_CONFIG[task.priority].label} Priority
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={clsx(
                'font-mono tabular-nums inline-flex items-center gap-1',
                !isCompleted && urgency === 'critical'
                  ? 'text-red-600 font-medium'
                  : !isCompleted && urgency === 'warning'
                  ? 'text-amber-600 font-medium'
                  : 'text-slate-500'
              )}
            >
              {!isCompleted && urgency === 'critical' && (
                <AlertTriangle className="w-3 h-3 shrink-0" />
              )}
              {isCompleted
                ? `Completed ${
                    task.completedAt
                      ? timeAgo(task.completedAt)
                      : formatDate(task.deadline, 'MMM d')
                  }`
                : `${deadlineLabel(task.deadline)} (${formatDate(task.deadline, 'MMM d')})`}
            </span>

            {!isArchiveView && isCompleted && remainingArchiveHours !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="inline-flex items-center gap-1 text-slate-400 font-mono tabular-nums"
                  title="Completed tasks automatically move to Archive after 24 hours"
                >
                  <Clock className="w-3 h-3" />
                  <span>Auto-archives in {remainingArchiveHours}h</span>
                </span>
              </>
            )}

            {isArchiveView && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400 font-mono tabular-nums">
                  Archived after 24h
                </span>
              </>
            )}

            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Est. {hoursToReadable(task.estimatedHours)}
            </span>
            {task.aiPredictedHours && task.aiPredictedHours !== task.estimatedHours && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-brand-600">
                  AI Pred. {hoursToReadable(task.aiPredictedHours)}
                </span>
              </>
            )}
            {task.tags?.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">
                  {task.tags.slice(0, 3).join(' / ')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Interactive Status Control & Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-8 sm:pl-0">
        {isArchiveView ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRestore}
              className="btn-secondary py-1 px-2.5 text-xs"
              title="Restore task to active Completed list for 24h"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={onReopen}
              className="btn-ghost py-1 px-2.5 text-xs"
              title="Reopen task as Pending"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reopen</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete task permanently"
              aria-label="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <select
              value={task.status}
              onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
              aria-label="Task status"
              className={clsx(
                'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                task.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : task.status === 'in_progress'
                  ? 'bg-brand-50 text-brand-700 border-brand-200'
                  : task.status === 'skipped'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              )}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenPlan}
                className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                title="AI Study Plan"
                aria-label="Open AI Study Plan"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Edit task"
                aria-label="Edit task"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {isCompleted && (
                <button
                  type="button"
                  onClick={onArchive}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Move to Archive now"
                  aria-label="Archive task"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {task.status !== 'completed' && task.status !== 'skipped' && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  title="Skip & reschedule"
                  aria-label="Skip task"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const {
    tasks,
    activeTasks,
    archivedTasks,
    isLoading,
    createTask,
    updateTask,
    completeTask,
    skipTask,
    archiveTask,
    deleteTask,
  } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<SubjectCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortField>('deadline');

  // Sync URL query params (?new=1, ?edit=<id>, or ?view=archive)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get('view') === 'archive') {
      setShowArchive(true);
      searchParams.delete('view');
      setSearchParams(searchParams, { replace: true });
    }
    const editId = searchParams.get('edit');
    if (editId && tasks.length > 0) {
      const target = tasks.find((t) => t._id === editId);
      if (target) {
        setEditingTask(target);
      }
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, tasks]);

  const statusCounts = useMemo(() => {
    return {
      all: activeTasks.length,
      pending: activeTasks.filter((t) => t.status === 'pending').length,
      in_progress: activeTasks.filter((t) => t.status === 'in_progress').length,
      completed: activeTasks.filter((t) => t.status === 'completed').length,
      skipped: activeTasks.filter((t) => t.status === 'skipped').length,
    };
  }, [activeTasks]);

  const baseSourceList = showArchive ? archivedTasks : activeTasks;

  const filtered = useMemo(() => {
    const list = baseSourceList.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchStatus =
        showArchive || filterStatus === 'all' || t.status === filterStatus;
      const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
      const matchCategory = filterCategory === 'all' || t.category === filterCategory;
      return matchSearch && matchStatus && matchPriority && matchCategory;
    });

    return list.sort((a, b) => {
      if (showArchive) {
        const aTime = new Date(a.completedAt ?? a.updatedAt).getTime();
        const bTime = new Date(b.completedAt ?? b.updatedAt).getTime();
        return bTime - aTime;
      }
      if (sortBy === 'deadline') {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'priority') {
        return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      }
      if (sortBy === 'estimatedHours') {
        return b.estimatedHours - a.estimatedHours;
      }
      if (sortBy === 'difficulty') {
        return b.difficulty - a.difficulty;
      }
      return 0;
    });
  }, [
    baseSourceList,
    showArchive,
    search,
    filterStatus,
    filterPriority,
    filterCategory,
    sortBy,
  ]);

  const activeCount = activeTasks.filter((t) => t.status !== 'completed').length;
  const totalEstimatedHours = filtered
    .filter((t) => t.status !== 'completed')
    .reduce((acc, t) => acc + t.estimatedHours, 0);

  async function handleStatusChange(task: Task, newStatus: TaskStatus) {
    if (newStatus === 'completed') {
      await completeTask(task._id);
    } else if (newStatus === 'skipped') {
      await skipTask(task._id);
    } else {
      await updateTask(task._id, { status: newStatus });
    }
  }

  return (
    <div className="page-shell space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">{showArchive ? 'Archived Tasks' : 'Tasks'}</h1>
          <p className="page-subtitle">
            {showArchive ? (
              <>
                <span className="font-mono tabular-nums font-medium text-slate-700">
                  {archivedTasks.length}
                </span>{' '}
                archived task{archivedTasks.length !== 1 ? 's' : ''} · Automatically moved 24 hours after completion
              </>
            ) : (
              <>
                <span className="font-mono tabular-nums font-medium text-slate-700">
                  {activeCount}
                </span>{' '}
                active task{activeCount !== 1 ? 's' : ''} ·{' '}
                <span className="font-mono tabular-nums font-medium text-slate-700">
                  {hoursToReadable(totalEstimatedHours)}
                </span>{' '}
                remaining workload
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowArchive((prev) => !prev)}
            className={clsx(
              'btn-secondary',
              showArchive && 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Archive className="w-4 h-4" />
            <span>{showArchive ? 'Back to Active Tasks' : 'Archive'}</span>
            <span
              className={clsx(
                'font-mono tabular-nums text-xs px-1.5 py-0.5 rounded',
                showArchive
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              {archivedTasks.length}
            </span>
          </button>

          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Interactive Status Segmented Tabs (shown in main active task view) */}
      {!showArchive ? (
        <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg overflow-x-auto w-full sm:w-fit">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'completed', label: 'Completed (<24h)' },
              { id: 'skipped', label: 'Skipped' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5',
                filterStatus === tab.id
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  'font-mono tabular-nums text-[11px]',
                  filterStatus === tab.id ? 'text-brand-600' : 'text-slate-400'
                )}
              >
                {statusCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card px-4 py-3 bg-slate-50/90 border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-600">
            <Archive className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Completed tasks are automatically moved to this hidden Archive list after{' '}
              <strong className="font-semibold text-slate-800">24 hours</strong> to keep your main task view clean.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowArchive(false)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0 self-start sm:self-auto"
          >
            Return to main view →
          </button>
        </div>
      )}

      {/* Search, Priority, Category & Sort Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 pr-8"
            placeholder={
              showArchive
                ? 'Search archived tasks...'
                : 'Filter by title, subject, tag, or description...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Priority Interactive Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
            {(['all', 'high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPriority(p)}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  filterPriority === p
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {p === 'all' ? 'All Priority' : PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>

          {!showArchive && (
            <select
              className="input w-auto py-1.5 text-xs"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              aria-label="Sort tasks"
            >
              <option value="deadline">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="estimatedHours">Sort: Effort (Hours)</option>
              <option value="difficulty">Sort: Difficulty</option>
            </select>
          )}
        </div>
      </div>

      {/* Color-Coded Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilterCategory('all')}
          className={clsx(
            'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0',
            filterCategory === 'all'
              ? 'bg-slate-900 text-white border-slate-900 font-semibold'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          )}
        >
          All Categories
        </button>
        {(Object.keys(CATEGORY_CONFIG) as SubjectCategory[]).map((cat) => {
          const count = baseSourceList.filter((t) => t.category === cat).length;
          const isPrimary = cat === 'study' || cat === 'work' || cat === 'personal';
          if (!isPrimary && count === 0 && filterCategory !== cat) return null;
          return (
            <CategoryLabel
              key={cat}
              category={cat}
              size="sm"
              active={filterCategory === cat}
              onClick={() =>
                setFilterCategory((prev) => (prev === cat ? 'all' : cat))
              }
            />
          );
        })}
      </div>

      {/* Task List Container */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="text-sm font-semibold text-slate-800">
            {showArchive ? 'No archived tasks' : 'No matching tasks'}
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {showArchive
              ? 'Tasks that have been completed for more than 24 hours will automatically appear here.'
              : search ||
                filterStatus !== 'all' ||
                filterPriority !== 'all' ||
                filterCategory !== 'all'
              ? 'No tasks match your current filters. Reset filters or check the Archive.'
              : 'Add your first assignment, lab report, or exam prep task to build your schedule.'}
          </p>
          <div className="flex items-center gap-2.5 mt-4">
            {(search ||
              filterStatus !== 'all' ||
              filterPriority !== 'all' ||
              filterCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterStatus('all');
                  setFilterPriority('all');
                  setFilterCategory('all');
                }}
                className="btn-ghost"
              >
                Reset Filters
              </button>
            )}
            {showArchive ? (
              <button
                type="button"
                onClick={() => setShowArchive(false)}
                className="btn-secondary"
              >
                Back to Active Tasks
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="card divide-y divide-slate-200/80 overflow-hidden">
            {filtered.map((task) => (
              <TaskRow
                key={task._id}
                task={task}
                isArchiveView={showArchive}
                onToggleComplete={() =>
                  task.status === 'completed'
                    ? updateTask(task._id, { status: 'pending' })
                    : completeTask(task._id)
                }
                onStatusChange={(status) => handleStatusChange(task, status)}
                onCategoryClick={(cat) =>
                  setFilterCategory((prev) => (prev === cat ? 'all' : cat))
                }
                onEdit={() => setEditingTask(task)}
                onSkip={() => skipTask(task._id)}
                onArchive={() => archiveTask(task._id, true)}
                onRestore={() => archiveTask(task._id, false, false)}
                onReopen={() => archiveTask(task._id, false, true)}
                onDelete={() => deleteTask(task._id)}
                onOpenPlan={() => navigate(`/plan?taskId=${task._id}`)}
              />
            ))}
          </div>

          {/* Subtle Archive Footer Indicator when in Main Task View */}
          {!showArchive && archivedTasks.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-100/80 border border-slate-200/70 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  <strong className="font-semibold text-slate-700 font-mono tabular-nums">
                    {archivedTasks.length}
                  </strong>{' '}
                  completed task{archivedTasks.length !== 1 ? 's' : ''} (&gt;24h old) automatically moved to Archive
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowArchive(true)}
                className="font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                View Archive →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Task"
      >
        <TaskForm
          onSubmit={async (f) => {
            await createTask(f);
            setShowCreate(false);
          }}
          onClose={() => setShowCreate(false)}
        />
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        title="Edit Task"
      >
        {editingTask && (
          <TaskForm
            initial={editingTask}
            isEdit
            onSubmit={async (f) => {
              const updates: UpdateTaskForm = {
                title: f.title,
                subject: f.subject,
                category: f.category,
                description: f.description,
                deadline: f.deadline,
                estimatedHours: f.estimatedHours,
                priority: f.priority,
                difficulty: f.difficulty,
                tags: f.tags,
                status: f.status,
              };
              await updateTask(editingTask._id, updates);
              if (f.status === 'completed' && editingTask.status !== 'completed') {
                await completeTask(editingTask._id);
              }
              setEditingTask(null);
            }}
            onClose={() => setEditingTask(null)}
          />
        )}
      </Modal>
    </div>
  );
}
