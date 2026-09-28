import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { getAuthUrl, handleOAuthCallback } from '../services/googleCalendar';
import { User } from '../models/User';

const router = Router();

// GET /api/calendar/auth  — redirect user to Google consent screen
router.get('/auth', authenticate, (req: AuthRequest, res: Response, next) => {
  try {
    const state = Buffer.from(JSON.stringify({ uid: req.uid })).toString('base64');
    const url   = getAuthUrl();
    res.redirect(`${url}&state=${encodeURIComponent(state)}`);
  } catch (err) { next(err); }
});

// GET /api/calendar/callback  — handle OAuth2 code exchange
router.get('/callback', async (req, res: Response) => {
  const { code, state } = req.query;
  if (!code || !state) { res.status(400).send('Missing code or state'); return; }

  try {
    const { uid } = JSON.parse(Buffer.from(String(state), 'base64').toString());
    await handleOAuthCallback(String(code), uid);
    // Redirect back to frontend
    res.redirect(`${process.env.FRONTEND_URL}?calendarConnected=1`);
  } catch (err) {
    res.status(500).send('OAuth callback failed');
  }
});

// DELETE /api/calendar/disconnect
router.delete('/disconnect', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    await User.findOneAndUpdate(
      { uid: req.uid },
      { googleCalendarConnected: false, googleAccessToken: null, googleRefreshToken: null }
    );
    res.json({ success: true, message: 'Google Calendar disconnected' });
  } catch (err) { next(err); }
});

export default router;
