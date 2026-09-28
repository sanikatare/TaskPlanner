import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  BookOpen,
  BarChart3,
  SlidersHorizontal,
  Menu,
  X,
  Search,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/utils/apiClient';
import { useTasks } from '@/hooks/useTasks';
import Modal from '@/components/ui/Modal';
import CategoryLabel, { CategoryPicker } from '@/components/ui/CategoryLabel';
import type { SubjectCategory, UserProfile } from '@/types';
import { CATEGORY_CONFIG } from '@/config/constants';
import { deadlineLabel, hoursToReadable } from '@/utils/dateUtils';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Journal Spread', icon: LayoutDashboard },
  { to: '/tasks',     label: 'Tasks',          icon: CheckSquare },
  { to: '/schedule',  label: 'Calendar & Sync', icon: Calendar },
  { to: '/plan',      label: 'Study Plans',    icon: BookOpen },
  { to: '/analytics', label: 'Analytics',      icon: BarChart3 },
] as const;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Journal Spread',
  '/tasks': 'Tasks Ledger',
  '/schedule': 'Schedule & Google Calendar',
  '/plan': 'Study Plans & Roadmaps',
  '/analytics': 'Study Analytics',
};

const TIME_SLOTS: Array<{ id: 'morning' | 'afternoon' | 'evening' | 'night'; label: string; window: string }> = [
  { id: 'morning', label: 'Morning', window: '08:00 – 12:00' },
  { id: 'afternoon', label: 'Afternoon', window: '13:30 – 17:30' },
  { id: 'evening', label: 'Evening', window: '18:30 – 21:30' },
  { id: 'night', label: 'Night', window: '21:30 – 23:30' },
];

export default function AppLayout() {
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<SubjectCategory>('study');
  const [quickDeadline, setQuickDeadline] = useState(defaultTomorrow);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const qc = useQueryClient();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['user-profile'],
    queryFn: async () => (await apiClient.get('/auth/me')).data.data,
  });

  const [studyHoursPerDay, setStudyHoursPerDay] = useState<number>(6);
  const [preferredTimes, setPreferredTimes] = useState<Array<'morning' | 'afternoon' | 'evening' | 'night'>>(['morning', 'evening']);
  const [currentSemester, setCurrentSemester] = useState<number>(6);

  useEffect(() => {
    if (profile) {
      setStudyHoursPerDay(profile.studyHoursPerDay ?? 6);
      setPreferredTimes(
        profile.preferredStudyTimes?.length
          ? profile.preferredStudyTimes
          : ['morning', 'evening']
      );
      setCurrentSemester(profile.currentSemester ?? 6);
    }
  }, [profile]);

  const savePrefsMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.patch('/auth/me', {
          studyHoursPerDay,
          preferredStudyTimes: preferredTimes,
          currentSemester,
        })
      ).data.data,
    onSuccess: (updated) => {
      qc.setQueryData(['user-profile'], updated);
      toast.success('Study preferences saved');
      setPrefsOpen(false);
    },
    onError: () => toast.error('Could not save preferences'),
  });

  function togglePreferredTime(slot: 'morning' | 'afternoon' | 'evening' | 'night') {
    setPreferredTimes((prev) => {
      if (prev.includes(slot)) {
        return prev.length > 1 ? prev.filter((s) => s !== slot) : prev;
      }
      return [...prev, slot];
    });
  }

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

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'TaskTracker';

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  const filteredSearchTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayFormatted = format(new Date(), 'EEEE, MMMM d');

  return (
    <div className="flex h-screen overflow-hidden diary-page-surface">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Stationery Spine & Index Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-[#FFFBFD]/95 backdrop-blur-md border-r border-[#E6C6E4] transition-transform duration-150 ease-out lg:static lg:translate-x-0 relative',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Decorative Notebook Ring-Binder Loops on Right Spine Edge */}
        <div
          aria-hidden="true"
          className="hidden lg:flex flex-col justify-between pointer-events-none absolute -right-2 top-20 bottom-20 z-30"
        >
          {[...Array(7)].map((_, idx) => (
            <div
              key={idx}
              className="w-3.5 h-2 rounded-full bg-gradient-to-r from-[#DFB8DC] via-[#FFF8FD] to-[#D4A4D1] border border-[#C993C6] shadow-sm"
            />
          ))}
        </div>

        {/* Brand Folio Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-[#EAD4E8] shrink-0">
          <NavLink to="/" className="flex flex-col">
            <span className="text-xl text-[#2A1029] tracking-tight leading-none">
              TaskTracker
            </span>
            <span className="text-[11px] text-[#96246F] mt-1">
              Personal Study Diary
            </span>
          </NavLink>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Light Green New Task Button */}
        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setQuickAddOpen(true);
            }}
            className="btn-primary w-full justify-center py-2.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>

        {/* Diary Index Tabs Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive =
              location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
            const badgeCount = to === '/tasks' ? pendingTasks.length : null;

            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm border transition-all duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-[#FCE7F3] to-[#F3E8FF] text-[#781D59] border-[#E5B8E0] shadow-sm'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-[#FDF4F9]/70'
                )}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={clsx(
                      'w-4 h-4 shrink-0',
                      isActive ? 'text-[#B8328A]' : 'text-slate-400'
                    )}
                  />
                  <span className="truncate">{label}</span>
                </span>
                {badgeCount !== null && badgeCount > 0 && (
                  <span
                    className={clsx(
                      'text-xs tabular-nums',
                      isActive ? 'text-[#96246F]' : 'text-slate-400'
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Subtle Bottom Date Stamp & Preferences */}
        <div className="px-4 py-3.5 border-t border-[#EAD4E8] bg-[#FDF7FC]/80 text-xs text-slate-500 space-y-2">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setPrefsOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/80 hover:bg-white border border-[#E8CEE6] text-xs text-[#781D59] transition-colors"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#B8328A]" />
              <span>Study Capacity</span>
            </span>
            <span className="tabular-nums text-[11px] text-slate-500">
              {profile?.studyHoursPerDay ?? studyHoursPerDay}h/day
            </span>
          </button>
          <div className="px-1 flex items-center justify-between">
            <span className="text-[#781D59] truncate">{todayFormatted}</span>
            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
              {pendingTasks.length} open
            </span>
          </div>
        </div>
      </aside>

      {/* Main Open-Diary Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div
          aria-hidden="true"
          className="hidden sm:block pointer-events-none absolute top-0 right-10 w-5 h-12 bg-gradient-to-b from-[#D44FA6] to-[#9333EA] z-30 shadow-sm"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
          }}
        />

        <header className="flex items-center justify-between gap-4 px-6 sm:px-10 h-16 bg-[#FFFBFD]/85 backdrop-blur-md border-b border-[#EAD4E8] shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-base text-slate-900 truncate">{pageTitle}</span>
            <span aria-hidden="true" className="hidden md:inline text-[#D9AED5]">·</span>
            <span className="hidden md:inline text-xs text-slate-500 truncate">
              {todayFormatted}
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:pr-8">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-[#FDF4F9] border border-[#E8CEE6] text-xs text-slate-500 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[#C83E8B] shrink-0" />
              <span className="hidden sm:inline">Search entries...</span>
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

        <main className="flex-1 overflow-y-auto diary-page-surface">
          <Outlet />
        </main>
      </div>

      {/* Quick Add Task Modal */}
      <Modal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="New Diary Task"
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
              className="input tabular-nums"
              value={quickDeadline}
              onChange={(e) => setQuickDeadline(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0DFEE]">
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
        </form>
      </Modal>

      {/* Study Capacity & Schedule Preferences Modal */}
      <Modal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Study Capacity & Schedule Preferences"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Available Study Hours per Day</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={14}
                step={0.5}
                value={studyHoursPerDay}
                onChange={(e) => setStudyHoursPerDay(Number(e.target.value))}
                className="flex-1 accent-[#B8328A]"
              />
              <span className="w-16 text-right text-sm tabular-nums text-[#2A1029] px-2.5 py-1 rounded-lg bg-[#FDF4F9] border border-[#E8CEE6]">
                {studyHoursPerDay}h / day
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Used by the Earliest-Deadline-First Schedule Optimizer to allocate daily study blocks.
            </p>
          </div>

          <div>
            <label className="label">Preferred Study Windows</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => {
                const active = preferredTimes.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => togglePreferredTime(slot.id)}
                    className={clsx(
                      'p-2.5 rounded-xl border text-left transition-all',
                      active
                        ? 'bg-[#FDF4F9] border-[#C83E8B] text-[#781D59]'
                        : 'bg-white border-[#EAD4E8] text-slate-600 hover:bg-[#FCF8FB]'
                    )}
                  >
                    <div className="text-xs font-medium">{slot.label}</div>
                    <div className="text-[11px] tabular-nums text-slate-500 mt-0.5">
                      {slot.window}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Current Semester</label>
            <input
              type="number"
              min={1}
              max={12}
              value={currentSemester}
              onChange={(e) => setCurrentSemester(Number(e.target.value))}
              className="input tabular-nums"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0DFEE]">
            <button
              type="button"
              onClick={() => setPrefsOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => savePrefsMutation.mutate()}
              disabled={savePrefsMutation.isPending}
              className="btn-primary"
            >
              {savePrefsMutation.isPending ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl bg-white border border-[#EAD4E8] shadow-xl overflow-hidden z-10 animate-scale-in">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EAD4E8]">
              <Search className="w-4 h-4 text-[#C83E8B] shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks by title, subject, or category..."
                className="w-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {filteredSearchTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No matching entries found.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredSearchTasks.slice(0, 6).map((task) => (
                    <button
                      key={task._id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate(`/tasks?edit=${task._id}`);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-[#FCF8FB] transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-900 truncate">
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
      )}
    </div>
  );
}
