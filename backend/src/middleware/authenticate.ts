import { Request, Response, NextFunction } from 'express';
import { admin, isFirebaseInitialized, isDevAuthEnabled } from '../utils/firebaseAdmin';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  uid?: string;
  email?: string;
}

export async function authenticate(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.split('Bearer ')[1];

  // Dev bypass token
  if (isDevAuthEnabled() && token.startsWith('dev:')) {
    req.uid = token.slice(4);
    next();
    return;
  }

  // MongoDB / JWT auth (email + password users)
  const jwtPayload = verifyAccessToken(token);
  if (jwtPayload) {
    req.uid   = jwtPayload.uid;
    req.email = jwtPayload.email;
    next();
    return;
  }

  // Firebase ID token
  if (isFirebaseInitialized()) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.uid   = decoded.uid;
      req.email = decoded.email;
      next();
      return;
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }
  }

  res.status(401).json({
    success: false,
    error: 'Invalid or expired token. Sign in with email/password or configure Firebase.',
  });
}
