import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
];

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return /your[-_]|placeholder|AIzaSy\.\.\.|123456789|abcdef/i.test(value);
}

export function isFirebaseConfigured(): boolean {
  return !isPlaceholder(firebaseConfig.apiKey)
    && !isPlaceholder(firebaseConfig.projectId)
    && !isPlaceholder(firebaseConfig.authDomain);
}

let firebaseApp: FirebaseApp | undefined;
let auth: Auth | undefined;

if (isFirebaseConfigured()) {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
}

export const googleProvider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  googleProvider.addScope(scope);
}

// In-memory cache for Google OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) {
    throw new Error('Firebase Auth is not configured in this environment');
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};

export interface GoogleCalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export async function fetchGoogleCalendarEvents(
  timeMinIso: string,
  timeMaxIso: string
): Promise<GoogleCalendarEventItem[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated with Google Calendar');

  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error('Failed to fetch Google Calendar events');
  }
  const data = await res.json();
  return data.items ?? [];
}

export async function createGoogleCalendarEvent(params: {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<GoogleCalendarEventItem> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated with Google Calendar');

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const startDateTime = new Date(`${params.date}T${params.startTime}:00`).toISOString();
  const endDateTime = new Date(`${params.date}T${params.endTime}:00`).toISOString();

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `[TaskTracker] ${params.title}`,
        description: params.description ?? 'Scheduled via TaskTracker',
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
      }),
    }
  );

  if (!res.ok) {
    throw new Error('Failed to create Google Calendar event');
  }
  return res.json();
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated with Google Calendar');

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error('Failed to delete Google Calendar event');
  }
}

export function buildGoogleCalendarTemplateUrl(params: {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
}): string {
  const cleanDate = params.date.replace(/-/g, '');
  const cleanStart = params.startTime.replace(/:/g, '') + '00';
  const cleanEnd = params.endTime.replace(/:/g, '') + '00';
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `[TaskTracker] ${params.title}`);
  url.searchParams.set('dates', `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`);
  if (params.description) {
    url.searchParams.set('details', params.description);
  }
  return url.toString();
}

export { firebaseApp, auth };

export async function requestNotificationPermission(): Promise<string | null> {
  if (!firebaseApp || !isFirebaseConfigured() || typeof Notification === 'undefined') return null;
  try {
    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging(firebaseApp);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    return await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
  } catch (err) {
    console.error('Notification permission error:', err);
    return null;
  }
}

export async function onForegroundMessage(callback: (payload: unknown) => void) {
  if (!firebaseApp || !isFirebaseConfigured()) return () => {};
  const { getMessaging, onMessage } = await import('firebase/messaging');
  return onMessage(getMessaging(firebaseApp), callback);
}
