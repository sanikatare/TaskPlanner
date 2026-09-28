import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

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
