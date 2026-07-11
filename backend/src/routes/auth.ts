import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';
import { createSession, destroySession, requireAuth } from '../middleware/auth';

const router = Router();

// Fixed dummy hash so login timing is uniform whether or not the username exists.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeOa8i1V6dGmuVs.dRnO2XM.pP3Bq2mkci';

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const db = await getDb();
  const user: any = await db.get(
    `SELECT * FROM users WHERE username = ? AND is_active = 1`,
    username
  );

  const hashToCompare = user ? user.password_hash : DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  await createSession(db, user.id, res);
  res.json({ id: user.id, username: user.username, role: user.role });
}));

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  await destroySession(db, req, res);
  res.status(204).end();
}));

router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json({ id: req.user!.id, username: req.user!.username, role: req.user!.role });
}));

export default router;
