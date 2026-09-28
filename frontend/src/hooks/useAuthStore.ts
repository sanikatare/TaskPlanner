import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

const DEFAULT_WORKSPACE_USER: UserProfile = {
  uid: 'student-demo',
  email: 'workspace@tasktracker.app',
  displayName: 'TaskTracker Workspace',
  studyHoursPerDay: 6,
  preferredStudyTimes: ['morning', 'afternoon'],
  subjects: ['Computer Science', 'Mathematics', 'Physics', 'Literature'],
  currentSemester: 4,
  googleCalendarConnected: false,
  notificationsEnabled: true,
  createdAt: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            DEFAULT_WORKSPACE_USER,
      isAuthenticated: true,
      isLoading:       false,
      setUser: (user) =>
        set({
          user: user ?? DEFAULT_WORKSPACE_USER,
          isAuthenticated: true,
          isLoading: false,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () =>
        set({
          user: DEFAULT_WORKSPACE_USER,
          isAuthenticated: true,
          isLoading: false,
        }),
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user }) },
  ),
);
