import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const users = await db.all(
    `SELECT id, username, role, is_active, created_at FROM users ORDER BY id ASC`
  );
  res.json(users);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { username, password, role } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const roleToUse = role === 'admin' ? 'admin' : 'user';

  const db = await getDb();
  const existing = await db.get(`SELECT id FROM users WHERE username = ?`, username.trim());
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const hash = await bcrypt.hash(password, 12);
  const result = await db.run(
    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
    username.trim(), hash, roleToUse
  );

  const user = await db.get(
    `SELECT id, username, role, is_active, created_at FROM users WHERE id = ?`,
    result.lastID
  );
  res.status(201).json(user);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT * FROM users WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { password, is_active, role } = req.body;

  // Lockout guard: an admin cannot deactivate or demote their own account.
  const isSelf = Number(req.params.id) === req.user!.id;
  if (isSelf && (is_active !== undefined || role !== undefined)) {
    return res.status(400).json({ error: 'Cannot change your own active status or role' });
  }

  if (password !== undefined) {
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(password, 12);
    await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, hash, req.params.id);
    await db.run(`DELETE FROM sessions WHERE user_id = ?`, req.params.id);
  }

  if (is_active !== undefined) {
    await db.run(`UPDATE users SET is_active = ? WHERE id = ?`, is_active ? 1 : 0, req.params.id);
  }

  if (role !== undefined) {
    if (role !== 'admin' && role !== 'user') return res.status(400).json({ error: 'Invalid role' });
    await db.run(`UPDATE users SET role = ? WHERE id = ?`, role, req.params.id);
  }

  const user = await db.get(
    `SELECT id, username, role, is_active, created_at FROM users WHERE id = ?`,
    req.params.id
  );
  res.json(user);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (Number(req.params.id) === req.user!.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const db = await getDb();
  const existing = await db.get(`SELECT id FROM users WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  await db.run(`DELETE FROM users WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

export default router;
