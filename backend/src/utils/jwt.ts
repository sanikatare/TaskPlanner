import jwt from 'jsonwebtoken';

export interface JwtPayload {
  uid: string;
  email: string;
}

const DEFAULT_DEV_SECRET = 'studyai-default-dev-jwt-secret-key';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 8) return secret;
  return DEFAULT_DEV_SECRET;
}

export function isJwtConfigured(): boolean {
  return Boolean(getSecret());
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  if (!isJwtConfigured()) return null;
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}
