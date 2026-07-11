import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Database } from 'sqlite';
import { getDb } from '../database';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string; role: 'admin' | 'user' };
    }
  }
}

export const SESSION_COOKIE = 'book_app_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RENEWAL_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

export async function createSession(db: Database, userId: number, res: Response): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();

  await db.run(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
    tokenHash, userId, expiresAt
  );

  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export async function destroySession(db: Database, req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await db.run(`DELETE FROM sessions WHERE token_hash = ?`, hashToken(token));
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const db = await getDb();
  const tokenHash = hashToken(token);

  const row: any = await db.get(
    `SELECT s.token_hash, s.expires_at, u.id as user_id, u.username, u.role, u.is_active
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    tokenHash
  );

  if (!row || !row.is_active) {
    if (row) await db.run(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt < Date.now()) {
    await db.run(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  req.user = { id: row.user_id, username: row.username, role: row.role };

  // Sliding renewal: extend if within 15 days of expiry
  if (expiresAt - Date.now() < RENEWAL_THRESHOLD_MS) {
    const newExpiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
    await db.run(`UPDATE sessions SET expires_at = ? WHERE token_hash = ?`, newExpiresAt, tokenHash);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}
