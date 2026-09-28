# Smart Study Scheduler — Fix Report

**Date:** 2026-06-07  
**Platform:** Windows 10/11  
**Status:** All services compile and start successfully after fixes.

---

## Validation Checklist

| Check | Result |
|-------|--------|
| Root `npm install` | ✅ Pass |
| Backend `npm run dev` | ✅ Starts on `http://localhost:5000` (MongoDB required) |
| Backend `npm run build` | ✅ Pass |
| Frontend `npm install` (via workspaces) | ✅ Pass |
| Frontend `npm run dev` | ✅ Starts on `http://localhost:3000` |
| Frontend `npm run build` | ✅ Pass |
| AI `pip install -r requirements.txt` | ✅ Pass (Python 3.13 + prebuilt wheels) |
| AI `uvicorn main:app --reload` | ✅ Starts on `http://localhost:8000` |
| Backend health `GET /health` | ✅ `{ "status": "ok" }` |
| AI health `GET /health` | ✅ `{ "status": "ok" }` |
| AI predict `POST /predict-time` | ✅ Returns prediction JSON |
| MongoDB connection | ✅ Connects when MongoDB is running locally |
| Firebase auth | ⚠️ Optional — use **Dev Login** when placeholders are set |
| Dev auth (`POST /api/auth/dev-login`) | ✅ Works with `ALLOW_DEV_AUTH=true` |
| Full API flow without Firebase | ✅ Task create/read via dev token verified |

---

## Continuation Fixes (Round 2)

### Dev auth mode — run without Firebase

The app now works end-to-end on Windows **without** configuring Firebase:

| Component | Change |
|-----------|--------|
| Backend | `ALLOW_DEV_AUTH=true` accepts `Bearer dev:<uid>` tokens |
| Backend | `POST /api/auth/dev-login` creates a local dev user + token |
| Backend | Placeholder Firebase credentials are detected and skipped (no crash) |
| Backend | Optional `FIREBASE_SERVICE_ACCOUNT_PATH` loads credentials from JSON file |
| Frontend | **Dev Login (no Firebase)** button on login page when `VITE_ALLOW_DEV_AUTH=true` |
| Frontend | Firebase only initializes when real `VITE_FIREBASE_*` values are set |
| Frontend | `.env.local` uses `VITE_API_BASE_URL=/api` (Vite proxy) |
| Tailwind | Extended opacity scale (`2`, `3`, `6`, `8`, `12`, `15`) for design tokens |
| PostCSS/Tailwind | Switched configs to CommonJS (`module.exports`) — removes Node warnings |

### Quick start without Firebase

1. Ensure MongoDB is running
2. Set in `backend/.env`: `ALLOW_DEV_AUTH=true` (already set)
3. Set in `frontend/.env.local`: `VITE_ALLOW_DEV_AUTH=true` (already set)
4. Start all services, open `http://localhost:3000/login`
5. Click **Dev Login (no Firebase)**

---

## Detected Issues & Fixes

### 1. Backend — TypeScript compilation errors

| Issue | File(s) | Fix |
|-------|---------|-----|
| Duplicate `AppError` interface + class merge conflict | `backend/src/middleware/errorHandler.ts` | Removed conflicting interface; kept exported class only |
| Missing `@anthropic-ai/sdk` dependency | `backend/package.json`, `backend/src/routes/ai.ts` | Added package; lazy-init client only when `ANTHROPIC_API_KEY` is set |
| Missing `date-fns` dependency | `backend/package.json`, `backend/src/routes/analytics.ts` | Added `date-fns`; removed unused imports |
| Mongoose `.lean()` type incompatibility in AI route | `backend/src/routes/ai.ts`, `backend/src/services/claudePrompts.ts` | Pass plain task/user objects; introduced `StudyPlanUser` type |
| Invalid `ObjectId` casts after `.populate()` | `backend/src/routes/schedule.ts`, `backend/src/services/notifications.ts` | Cast via `unknown` with safe fallbacks |
| Server crash on invalid Firebase private key | `backend/src/utils/firebaseAdmin.ts` | Wrap init in try/catch; log warning instead of exiting |
| Missing `uid` in frontend auth requests | `frontend/src/hooks/useAuth.ts` | Send Firebase `uid` on register/google; auto-sync profile on auth state change |
| No default AI service URL | `backend/src/routes/tasks.ts`, `schedule.ts`, `ai.ts` | Default to `http://localhost:8000` |
| Task create missing category fallback | `backend/src/routes/tasks.ts` | Default category to `'other'` |
| Google Calendar OAuth crash when unconfigured | `backend/src/services/googleCalendar.ts`, `backend/src/routes/calendar.ts` | Validate env vars; route error handling via `next(err)` |
| Unused date-fns imports | `backend/src/routes/analytics.ts` | Removed unused symbols |

### 2. Frontend — TypeScript & Vite errors

| Issue | File(s) | Fix |
|-------|---------|-----|
| Missing `import.meta.env` types | **Created** `frontend/src/vite-env.d.ts` | Added Vite client reference + env interface |
| Unused imports (`noUnusedLocals`) | `AppLayout.tsx`, `TasksPage.tsx`, `SchedulePage.tsx` | Removed unused Lucide icons/utilities |
| API base URL bypassed Vite proxy | `frontend/src/config/constants.ts`, `frontend/.env.example` | Default to `/api` for dev proxy |
| Tailwind invalid opacity utilities in `@apply` (`/8`, `/4`, `/6`) | `frontend/src/styles/globals.css` | Replaced with raw CSS rgba values |

### 3. AI Service — Python startup errors

| Issue | File(s) | Fix |
|-------|---------|-----|
| Missing Python package `__init__.py` files | **Created** `ai-service/routers/__init__.py`, `models/__init__.py`, `services/__init__.py` | Made directories importable packages |
| `scikit-learn==1.5.1` failed to build on Windows/Python 3.13 | `ai-service/requirements.txt` | Upgraded to versions with prebuilt wheels: `scikit-learn==1.6.1`, `numpy==2.2.1`, `pydantic==2.10.4`, etc. |
| `pydantic==2.7.4` required Rust/MSVC linker on Python 3.13 | `ai-service/requirements.txt` | Upgraded pydantic stack |

### 4. Docker & monorepo scripts

| Issue | File(s) | Fix |
|-------|---------|-----|
| Backend Dockerfile ran `npm ci --only=production` before build (missing devDeps) | `backend/Dockerfile` | Multi-stage build: builder with full deps, runtime with production deps only |
| Root npm scripts used `&&` and `cd` (fragile on Windows) | `package.json` | Switched to npm workspaces (`npm run dev -w frontend`, etc.) |
| AI dev script path issues on Windows | `package.json` | `python -m uvicorn main:app --app-dir ai-service` |

### 5. Integration alignment verified

| Frontend call | Backend route | Status |
|---------------|---------------|--------|
| `GET /auth/me` | `GET /api/auth/me` | ✅ |
| `POST /auth/register` | `POST /api/auth/register` | ✅ (now includes `uid`) |
| `POST /auth/google` | `POST /api/auth/google` | ✅ (now includes `uid`) |
| `GET/POST/PUT/DELETE /tasks` | `/api/tasks/*` | ✅ |
| `GET /schedule`, `POST /schedule/generate` | `/api/schedule/*` | ✅ |
| `GET /analytics` | `GET /api/analytics` | ✅ |
| `GET /ai/recommend`, `POST /ai/generate-plan` | `/api/ai/*` | ✅ |
| Backend → AI `POST /predict-time` | AI service | ✅ |
| Backend → AI `POST /recommend` | AI service | ✅ |
| Backend → AI `POST /optimize-schedule` | AI service | ✅ |
| Backend → AI `POST /update-model` | AI service | ✅ |
| Google Calendar OAuth | `/api/calendar/auth`, `/callback` | ✅ (needs Google OAuth env) |

---

## Files Modified

### Backend
- `backend/package.json`
- `backend/Dockerfile`
- `backend/.env` *(ALLOW_DEV_AUTH=true)*
- `backend/.env.example`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/middleware/authenticate.ts`
- `backend/src/utils/firebaseAdmin.ts`
- `backend/src/routes/ai.ts`
- `backend/src/routes/tasks.ts`
- `backend/src/routes/schedule.ts`
- `backend/src/routes/analytics.ts`
- `backend/src/routes/calendar.ts`
- `backend/src/services/claudePrompts.ts`
- `backend/src/services/googleCalendar.ts`
- `backend/src/services/notifications.ts`

### Frontend
- `frontend/src/vite-env.d.ts` *(new)*
- `frontend/src/config/constants.ts`
- `frontend/src/config/firebase.ts`
- `frontend/src/utils/apiClient.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/pages/SchedulePage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/.env.example`
- `frontend/.env.local` *(dev auth + /api proxy)*

### AI Service
- `ai-service/requirements.txt`
- `ai-service/routers/__init__.py` *(new)*
- `ai-service/models/__init__.py` *(new)*
- `ai-service/services/__init__.py` *(new)*

### Root
- `package.json`

---

## How to Run on Windows

### Prerequisites
1. **Node.js 20+** and npm
2. **Python 3.11+** (tested on 3.13 with updated requirements)
3. **MongoDB** running on `mongodb://localhost:27017`
4. **Firebase** project (Auth enabled: Email/Password + Google)
5. **Optional:** Anthropic API key, Google Calendar OAuth credentials

### Install
```powershell
cd c:\Users\DELL\Downloads\smart-study-scheduler
npm install
pip install -r ai-service\requirements.txt
```

### Configure environment

**Backend** — copy and edit `backend\.env.example` → `backend\.env`:
- `MONGODB_URI`
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
- `AI_SERVICE_URL=http://localhost:8000`
- `ANTHROPIC_API_KEY` (for Claude study plans)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `FRONTEND_URL=http://localhost:3000`

**Frontend** — copy `frontend\.env.example` → `frontend\.env.local`:
- `VITE_API_BASE_URL=/api` (uses Vite proxy in dev)
- All `VITE_FIREBASE_*` variables from Firebase console

### Start services (3 terminals)
```powershell
# Terminal 1 — AI Service
npm run dev:ai

# Terminal 2 — Backend
npm run dev:backend

# Terminal 3 — Frontend
npm run dev:frontend
```

Or with Docker (requires configured `backend/.env`):
```powershell
docker compose up --build
```

---

## Remaining Manual Configuration Steps

1. **Firebase Admin SDK (backend)** — *optional if using Dev Login*
   Download service account JSON from Firebase Console → Project Settings → Service Accounts. Either:
   - Set `FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/service-account.json`, **or**
   - Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

2. **Firebase Web SDK (frontend)** — *optional if using Dev Login*
   Create a web app in Firebase Console and copy config into `frontend/.env.local` as `VITE_FIREBASE_*`.

3. **Anthropic Claude API**  
   Set `ANTHROPIC_API_KEY` in `backend/.env` for `/api/ai/generate-plan`. Without it, the endpoint returns 503 with a clear message; other features work.

4. **Google Calendar OAuth**  
   Create OAuth 2.0 credentials in Google Cloud Console with redirect URI:
   `http://localhost:5000/api/calendar/callback`  
   Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

5. **MongoDB**  
   Install MongoDB Community Edition or run via Docker:
   ```powershell
   docker run -d -p 27017:27017 --name studyai-mongo mongo:7
   ```

6. **Push notifications (optional)**  
   Configure FCM VAPID key (`VITE_FIREBASE_VAPID_KEY`) and enable Cloud Messaging in Firebase.

---

## Notes

- Backend logs a **warning** (not a crash) if Firebase credentials are missing, malformed, or placeholders; use **Dev Login** or configure real credentials.
- AI service trains a bootstrap regression model on first run; model file saved to `ai-service/models/time_predictor.pkl`.
- Frontend production build requires valid Tailwind classes; non-standard opacity values like `white/6` in JSX are ignored by Tailwind but do not break the build.
- Python dependencies were upgraded only where necessary for **Windows + Python 3.13** wheel availability.

---

## Quick Smoke Test

```powershell
curl http://localhost:5000/health
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict-time -H "Content-Type: application/json" -d "{\"subject\":\"Math\",\"category\":\"math\",\"difficulty\":3,\"estimated_hours\":2}"
```

Expected: both health endpoints return `"status":"ok"`; predict returns `predicted_hours`, `confidence`, and `factors`.
