import { useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/config/firebase';
import { useAuthStore } from './useAuthStore';
import apiClient, { clearAuthToken, getAuthToken, setAuthToken } from '@/utils/apiClient';
import toast from 'react-hot-toast';

const DEV_AUTH_ENABLED = import.meta.env.VITE_ALLOW_DEV_AUTH !== 'false';
const MONGO_AUTH_ENABLED = import.meta.env.VITE_USE_MONGO_AUTH !== 'false';
const LOGGED_OUT_KEY = 'studyai-logged-out';

async function restoreMongoSession() {
  const token = getAuthToken();
  if (!token) return null;
  const { data } = await apiClient.get('/auth/me');
  return data.data;
}

async function initDemoSession() {
  const { data } = await apiClient.post('/auth/dev-login', {
    uid: 'student-demo',
    displayName: 'Student Workspace',
    email: 'student@university.edu',
  });
  setAuthToken(data.data.token);
  return data.data.user;
}

async function syncUserProfile(firebaseUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) {
  try {
    const { data } = await apiClient.get('/auth/me');
    return data.data;
  } catch {
    await apiClient.post('/auth/google', {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email,
      displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Student',
      photoURL:    firebaseUser.photoURL,
    });
    const { data } = await apiClient.get('/auth/me');
    return data.data;
  }
}

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();
  const useMongoAuth = MONGO_AUTH_ENABLED && !isFirebaseConfigured();

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const token = getAuthToken();
      if (token) {
        try {
          const profile = await restoreMongoSession();
          if (!cancelled) setUser(profile);
          return;
        } catch {
          clearAuthToken();
        }
      }

      if (!auth || !isFirebaseConfigured()) {
        if (DEV_AUTH_ENABLED && sessionStorage.getItem(LOGGED_OUT_KEY) !== 'true') {
          try {
            const demoUser = await initDemoSession();
            if (!cancelled) setUser(demoUser);
            return;
          } catch {
            // Fall through to unauthenticated state
          }
        }
        if (!cancelled) setLoading(false);
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const profile = await syncUserProfile(firebaseUser);
            if (!cancelled) setUser(profile);
          } catch {
            if (!cancelled) setLoading(false);
          }
        } else if (!cancelled) {
          setUser(null);
        }
      });

      return unsubscribe;
    }

    const cleanupPromise = initAuth();
    return () => {
      cancelled = true;
      cleanupPromise.then(unsub => unsub?.());
    };
  }, [setUser, setLoading]);

  async function loginWithEmail(email: string, password: string) {
    if (useMongoAuth) {
      try {
        sessionStorage.removeItem(LOGGED_OUT_KEY);
        const { data } = await apiClient.post('/auth/login', { email, password });
        setAuthToken(data.data.token);
        setUser(data.data.user);
        toast.success('Welcome back');
        return;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? 'Login failed — check your credentials';
        toast.error(msg);
        throw err;
      }
    }

    if (!auth || !isFirebaseConfigured()) {
      toast.error('Firebase is not configured. Sign in uses MongoDB when Firebase is disabled.');
      throw new Error('Firebase not configured');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      toast.error(msg);
      throw err;
    }
  }

  async function registerWithEmail(email: string, password: string, displayName: string, studyHoursPerDay: number) {
    if (useMongoAuth) {
      try {
        sessionStorage.removeItem(LOGGED_OUT_KEY);
        const { data } = await apiClient.post('/auth/signup', { email, password, displayName, studyHoursPerDay });
        setAuthToken(data.data.token);
        setUser(data.data.user);
        toast.success('Account created');
        return;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? 'Registration failed';
        toast.error(msg);
        throw err;
      }
    }

    if (!auth || !isFirebaseConfigured()) {
      toast.error('Firebase is not configured. Registration uses MongoDB when Firebase is disabled.');
      throw new Error('Firebase not configured');
    }
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(fbUser, { displayName });
      await apiClient.post('/auth/register', { uid: fbUser.uid, email, displayName, studyHoursPerDay });
      toast.success('Account created');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      toast.error(msg);
      throw err;
    }
  }

  async function loginWithGoogle() {
    if (!auth || !isFirebaseConfigured()) {
      toast.error('Google sign-in requires Firebase configuration');
      throw new Error('Firebase not configured');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await apiClient.post('/auth/google', {
        uid:         result.user.uid,
        email:       result.user.email,
        displayName: result.user.displayName,
        photoURL:    result.user.photoURL,
      });
    } catch (err: unknown) {
      toast.error('Google sign-in failed');
      throw err;
    }
  }

  async function loginWithDev() {
    if (!DEV_AUTH_ENABLED) {
      toast.error('Dev login is disabled. Set VITE_ALLOW_DEV_AUTH=true');
      throw new Error('Dev auth disabled');
    }
    try {
      clearAuthToken();
      sessionStorage.removeItem(LOGGED_OUT_KEY);
      const { data } = await apiClient.post('/auth/dev-login', {
        uid: 'student-demo',
        displayName: 'Student Workspace',
        email: 'student@university.edu',
      });
      setAuthToken(data.data.token);
      setUser(data.data.user);
      toast.success('Signed in to workspace');
    } catch (err: unknown) {
      toast.error('Quick login failed — is the backend running?');
      throw err;
    }
  }

  async function logoutUser() {
    sessionStorage.setItem(LOGGED_OUT_KEY, 'true');
    clearAuthToken();
    if (auth && isFirebaseConfigured()) {
      await signOut(auth);
    }
    logout();
    toast.success('Signed out');
  }

  return {
    user, isAuthenticated, isLoading,
    useMongoAuth,
    devAuthEnabled: DEV_AUTH_ENABLED,
    firebaseConfigured: isFirebaseConfigured(),
    loginWithEmail, registerWithEmail, loginWithGoogle, loginWithDev, logout: logoutUser,
  };
}
