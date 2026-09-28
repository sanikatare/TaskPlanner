import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { AppError } from '../middleware/errorHandler';
import { isDevAuthEnabled } from '../utils/firebaseAdmin';
import { isJwtConfigured, signAccessToken } from '../utils/jwt';

const router = Router();

function authResponse(user: InstanceType<typeof User>) {
  const token = signAccessToken({ uid: user.uid, email: user.email });
  return { user: user.toJSON(), token };
}

// POST /api/auth/signup — MongoDB email/password registration
router.post('/signup', async (req, res: Response, next) => {
  try {
    if (!isJwtConfigured()) throw new AppError('JWT auth is not configured on the server', 503);

    const { email, password, displayName, studyHoursPerDay } = req.body;
    if (!email || !password || !displayName) throw new AppError('Email, password, and display name are required');
    if (String(password).length < 6) throw new AppError('Password must be at least 6 characters');

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) throw new AppError('An account with this email already exists', 409);

    const passwordHash = await bcrypt.hash(String(password), 10);
    const uid = `local_${crypto.randomUUID()}`;

    const user = await User.create({
      uid,
      email: normalizedEmail,
      displayName: String(displayName).trim(),
      passwordHash,
      authProvider: 'local',
      studyHoursPerDay: studyHoursPerDay ?? 6,
    });

    res.status(201).json({ success: true, data: authResponse(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/login — MongoDB email/password login
router.post('/login', async (req, res: Response, next) => {
  try {
    if (!isJwtConfigured()) throw new AppError('JWT auth is not configured on the server', 503);

    const { email, password } = req.body;
    if (!email || !password) throw new AppError('Email and password are required');

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
    if (!user?.passwordHash) throw new AppError('Invalid email or password', 401);

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    res.json({ success: true, data: authResponse(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/register  — called after Firebase creates the account
router.post('/register', async (req, res: Response, next) => {
  try {
    const { email, displayName, studyHoursPerDay, uid } = req.body;
    if (!email || !displayName || !uid) throw new AppError('Missing required fields');

    const existing = await User.findOne({ uid });
    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    const user = await User.create({
      uid,
      email,
      displayName,
      authProvider: 'firebase',
      studyHoursPerDay: studyHoursPerDay ?? 6,
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
});

// POST /api/auth/dev-login  — local development login without Firebase
router.post('/dev-login', async (req, res: Response, next) => {
  try {
    if (!isDevAuthEnabled()) throw new AppError('Dev auth is disabled', 404);

    const uid = String(req.body.uid ?? `dev-${Date.now()}`);
    const email = String(req.body.email ?? 'dev@local.test');
    const displayName = String(req.body.displayName ?? 'Dev User');

    const user = await User.findOneAndUpdate(
      { uid },
      {
        $setOnInsert: {
          uid,
          email,
          displayName,
          authProvider: 'local',
          studyHoursPerDay: req.body.studyHoursPerDay ?? 6,
        },
      },
      { upsert: true, new: true },
    );

    const token = isJwtConfigured()
      ? signAccessToken({ uid: user.uid, email: user.email })
      : `dev:${uid}`;

    res.json({ success: true, data: { user, token } });
  } catch (err) { next(err); }
});

// POST /api/auth/google  — upsert user on Google sign-in
router.post('/google', async (req, res: Response, next) => {
  try {
    const { email, displayName, photoURL, uid } = req.body;
    if (!uid || !email) throw new AppError('Missing required fields');

    const user = await User.findOneAndUpdate(
      { uid },
      { $setOnInsert: { uid, email, displayName, photoURL, authProvider: 'firebase' } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await User.findOne({ uid: req.uid });
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// PATCH /api/auth/me
router.patch('/me', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const allowed = ['displayName','studyHoursPerDay','preferredStudyTimes','subjects','currentSemester','notificationsEnabled','fcmToken'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const user = await User.findOneAndUpdate({ uid: req.uid }, updates, { new: true });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

export default router;
