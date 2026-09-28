import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  BarChart3,
  LogOut,
  Bell,
  Menu,
  X,
  BookOpen,
  GraduationCap,
  Search,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import Modal from '@/components/ui/Modal';
import CategoryLabel, { CategoryPicker } from '@/components/ui/CategoryLabel';
import apiClient from '@/utils/apiClient';
import type { ScheduleBlock, SubjectCategory } from '@/types';
import { CATEGORY_CONFIG } from '@/config/constants';
import { deadlineLabel, deadlineUrgency, hoursToReadable } from '@/utils/dateUtils';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/tasks',     label: 'Tasks',      icon: CheckSquare },
  { to: '/schedule',  label: 'Schedule',   icon: Calendar },
  { to: '/plan',      label: 'Study Plan', icon: BookOpen },
  { to: '/analytics', label: 'Analytics',  icon: BarChart3 },
] as const;

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/schedule': 'Schedule',
  '/analytics': 'Analytics',
  '/plan': 'Study Plan',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { tasks, createTask } = useTasks();
  const navigate = useNavigate();
  const location = useLocation();

  const defaultTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(user?.notificationsEnabled ?? true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<SubjectCategory>('study');
  const [quickDeadline, setQuickDeadline] = useState(defaultTomorrow);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  async function handleQuickAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim() || !quickDeadline) return;
    setQuickSubmitting(true);
    try {
      await createTask({
        title: quickTitle.trim(),
        deadline: quickDeadline,
        subject: CATEGORY_CONFIG[quickCategory]?.label ?? 'General',
        category: quickCategory,
        estimatedHours: 1,
        priority: 'medium',
        difficulty: 3,
        tags: [],
      });
      setQuickTitle('');
      setQuickCategory('study');
      setQuickDeadline(defaultTomorrow());
      setQuickAddOpen(false);
    } finally {
      setQuickSubmitting(false);
    }
  }

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Workspace';

  const { data: scheduleBlocks } = useQuery<ScheduleBlock[]>({
    queryKey: ['schedule'],
    queryFn: async () => (await apiClient.get('/schedule')).data.data,
  });

  // Keyboard shortcut Cmd/Ctrl + K for quick search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close notification popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [notifOpen]);

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const urgentTasks = pendingTasks.filter((t) => {
    const u = deadlineUrgency(t.deadline);
    return u === 'critical' || u === 'warning';
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBlocks = (scheduleBlocks ?? []).filter(
    (b) => b.date === todayStr && !b.isCompleted
  );

  // Build live notifications & reminders
  const notifications = [
    ...urgentTasks.map((t) => ({
      id: `deadline-${t._id}`,
      type: deadlineUrgency(t.deadline) === 'critical' ? ('critical' as const) : ('warning' as const),
      title: t.title,
      meta: `${t.subject} · ${deadlineLabel(t.deadline)}`,
      href: '/tasks',
    })),
    ...todayBlocks.map((b) => ({
      id: `block-${b._id}`,
      type: 'reminder' as const,
      title: b.task?.title ?? 'Scheduled Study Block',
      meta: `Today ${b.startTime}–${b.endTime} · ${b.durationMinutes}m`,
      href: '/schedule',
    })),
  ];

  const unreadCount = notifications.filter((n) => !readNotifIds.includes(n.id)).length;

  async function toggleReminders() {
    const nextState = !remindersEnabled;
    setRemindersEnabled(nextState);
    try {
      await apiClient.patch('/auth/me', { notificationsEnabled: nextState });
      toast.success(nextState ? 'Study reminders enabled' : 'Study reminders paused');
    } catch {
      toast.success(nextState ? 'Study reminders enabled' : 'Study reminders paused');
    }
  }

  const filteredSearchTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-slate-200/90 transition-transform duration-150 ease-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200/80 shrink-0">
          <NavLink to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand-600 text-white">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-base font-semibold text-slate-900 tracking-tight">StudyAI</span>
          </NavLink>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Add Task CTA */}
        <div className="px-3 pt-4 pb-2">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setQuickAddOpen(true);
            }}
            className="btn-primary w-full justify-between px-3.5 py-2"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Quick Add</span>
            </span>
            <span className="text-[11px] font-mono text-blue-100">+</span>
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive =
              location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
            const badgeCount =
              to === '/tasks'
                ? pendingTasks.length
                : to === '/schedule'
                ? todayBlocks.length
                : null;

            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={clsx(
                      'w-4 h-4 shrink-0',
                      isActive ? 'text-brand-600' : 'text-slate-400'
                    )}
                  />
                  <span className="truncate">{label}</span>
                </span>
                {badgeCount !== null && badgeCount > 0 && (
                  <span
                    className={clsx(
                      'text-xs font-mono tabular-nums',
                      isActive ? 'text-brand-600 font-semibold' : 'text-slate-400'
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Daily Study Target Summary */}
        <div className="px-4 py-3 mx-3 mb-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span className="font-medium">Daily Target</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {user?.studyHoursPerDay ?? 6}h / day
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            {pendingTasks.length} active · {urgentTasks.length} due soon
          </div>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200/80 shrink-0">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-slate-900 shrink-0">
                {user?.displayName?.charAt(0).toUpperCase() ?? 'S'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {user?.displayName ?? 'Student'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar Contract: 3 Zones (Breadcrumb — Search — Actions) */}
        <header className="flex items-center justify-between gap-4 px-5 sm:px-8 h-14 bg-white border-b border-slate-200/90 shrink-0 z-20">
          {/* Zone 1: Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{pageTitle}</span>
            </div>
          </div>

          {/* Zone 2: Quick Search Trigger */}
          <div className="flex-1 max-w-md hidden md:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 text-xs text-slate-500 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Search tasks, subjects, or navigate...</span>
              <kbd className="ml-auto text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Zone 3: Notifications & Primary Action */}
          <div className="flex items-center gap-2.5" ref={notifRef}>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                aria-label="Notifications and reminders"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-mono tabular-nums font-semibold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden animate-scale-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Notifications & Reminders
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setReadNotifIds(notifications.map((n) => n.id))}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-10 px-4 text-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
                        <div className="text-xs font-medium text-slate-700">
                          All caught up for today
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          No urgent deadlines or pending study block alerts.
                        </div>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        const isRead = readNotifIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setReadNotifIds((prev) =>
                                prev.includes(item.id) ? prev : [...prev, item.id]
                              );
                              setNotifOpen(false);
                              navigate(item.href);
                            }}
                            className={clsx(
                              'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors',
                              !isRead && 'bg-brand-50/30'
                            )}
                          >
                            <div className="mt-0.5 shrink-0">
                              {item.type === 'critical' ? (
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                              ) : item.type === 'warning' ? (
                                <Clock className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Calendar className="w-4 h-4 text-brand-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.meta}</div>
                            </div>
                            {!isRead && (
                              <span className="w-2 h-2 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs text-slate-600">Study block reminders</span>
                    <button
                      type="button"
                      onClick={toggleReminders}
                      className={clsx(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        remindersEnabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200/70 text-slate-600'
                      )}
                    >
                      {remindersEnabled ? 'Active' : 'Paused'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/plan')}
              className="btn-ghost hidden sm:inline-flex"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              <span>Study Plan</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Add</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Quick Add Task Modal (Title + Due Date) */}
      <Modal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Quick Add Task"
      >
        <form onSubmit={handleQuickAddSubmit} className="space-y-4">
          <div>
            <label className="label">Task Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Finish Linear Algebra Problem Set 4"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Category</label>
            <CategoryPicker
              compact
              value={quickCategory}
              onChange={setQuickCategory}
            />
          </div>

          <div>
            <label className="label">Due Date</label>
            <input
              type="date"
              className="input font-mono tabular-nums"
              value={quickDeadline}
              onChange={(e) => setQuickDeadline(e.target.value)}
              required
            />
            <div className="flex items-center gap-1.5 mt-2">
              {[
                { label: 'Today', offset: 0 },
                { label: 'Tomorrow', offset: 1 },
                { label: 'In 3 days', offset: 3 },
                { label: 'Next week', offset: 7 },
              ].map((preset) => {
                const d = new Date();
                d.setDate(d.getDate() + preset.offset);
                const iso = d.toISOString().split('T')[0];
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setQuickDeadline(iso)}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                      quickDeadline === iso
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                navigate('/tasks?new=1');
              }}
              className="text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors"
            >
              More options...
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickSubmitting || !quickTitle.trim() || !quickDeadline}
                className="btn-primary"
              >
                {quickSubmitting ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Command / Quick Search Modal (Cmd+K) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px]" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden z-10 animate-scale-in">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks by title, subject, or category..."
                className="w-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {/* Quick Navigation Links */}
              <div className="p-2">
                <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Quick Navigation</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
                  {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate(to);
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors text-left"
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      navigate('/tasks?new=1');
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors text-left"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Task</span>
                  </button>
                </div>
              </div>

              {/* Matching Tasks */}
              <div className="p-2">
                <div className="px-2 py-1 text-[11px] font-medium text-slate-400">
                  Tasks ({filteredSearchTasks.length})
                </div>
                {filteredSearchTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No matching tasks found.
                  </div>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {filteredSearchTasks.slice(0, 6).map((task) => (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate(`/tasks?edit=${task._id}`);
                        }}
                        className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-900 truncate">
                              {task.title}
                            </span>
                            <CategoryLabel category={task.category} />
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {task.subject} · {deadlineLabel(task.deadline)} · {hoursToReadable(task.estimatedHours)}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
