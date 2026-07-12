import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Database } from 'sqlite';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';
import { requireAdmin } from '../middleware/auth';

const router = Router();

type ValidationResult<T> = { ok: true; value: T } | { ok: false };

// --- Pure validators (profile PUT) ---

function validateScreenName(input: unknown): ValidationResult<string | null> {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false };
  const trimmed = input.trim();
  if (trimmed.length > 40) return { ok: false };
  return { ok: true, value: trimmed === '' ? null : trimmed };
}

function validateAvatarUrl(input: unknown): ValidationResult<string | null> {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false };
  if (!input.startsWith('data:image/')) return { ok: false };
  if (input.length > 500000) return { ok: false };
  return { ok: true, value: input };
}

function validateFavoriteGenres(input: unknown): ValidationResult<string[]> {
  if (input === null || input === undefined) return { ok: true, value: [] };
  if (!Array.isArray(input)) return { ok: false };
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') return { ok: false };
    const trimmed = item.trim();
    if (trimmed === '') continue;
    if (trimmed.length > 40) return { ok: false };
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  if (result.length > 10) return { ok: false };
  return { ok: true, value: result };
}

function parseGenres(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((g): g is string => typeof g === 'string');
  } catch { /* malformed json — treat as empty */ }
  return [];
}

// --- Shell helpers (need db) ---

async function resolveFavoriteBookId(db: Database, input: unknown, userId: number): Promise<ValidationResult<number | null>> {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (!Number.isInteger(input)) return { ok: false };
  const book = await db.get(`SELECT id FROM books WHERE id = ? AND user_id = ?`, input, userId);
  if (!book) return { ok: false };
  return { ok: true, value: input as number };
}

async function buildProfileResponse(db: Database, row: any, coalesceScreenName: boolean) {
  let favoriteBook = null;
  if (row.favorite_book_id) {
    favoriteBook = (await db.get(
      `SELECT id, title, author, cover_url FROM books WHERE id = ?`,
      row.favorite_book_id
    )) || null;
  }
  return {
    id: row.id,
    username: row.username,
    screen_name: coalesceScreenName ? (row.screen_name || row.username) : (row.screen_name ?? null),
    avatar_url: row.avatar_url ?? null,
    favorite_genres: parseGenres(row.favorite_genres),
    favorite_book: favoriteBook,
  };
}

const PROFILE_COLUMNS = `id, username, screen_name, avatar_url, favorite_genres, favorite_book_id`;

// --- Routes ---

// Public directory — same shape for every caller so the Readers page
// works for admins too; the management list lives at /admin.
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const users = await db.all(
    `SELECT id, COALESCE(screen_name, username) as screen_name, avatar_url
     FROM users WHERE is_active = 1 ORDER BY id ASC`
  );
  res.json(users);
}));

router.get('/admin', requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const users = await db.all(
    `SELECT id, username, role, is_active, created_at FROM users ORDER BY id ASC`
  );
  res.json(users);
}));

router.post('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
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

// Registered before /:id/profile so "me" is never captured by the :id param.
router.get('/me/profile', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const row = await db.get(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, req.user!.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(await buildProfileResponse(db, row, false));
}));

router.put('/me/profile', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const { screen_name, avatar_url, favorite_genres, favorite_book_id } = req.body;

  const screenNameResult = validateScreenName(screen_name);
  if (!screenNameResult.ok) return res.status(400).json({ error: 'Invalid screen_name' });

  const avatarResult = validateAvatarUrl(avatar_url);
  if (!avatarResult.ok) return res.status(400).json({ error: 'Invalid avatar_url' });

  const genresResult = validateFavoriteGenres(favorite_genres);
  if (!genresResult.ok) return res.status(400).json({ error: 'Invalid favorite_genres' });

  const favoriteBookResult = await resolveFavoriteBookId(db, favorite_book_id, req.user!.id);
  if (!favoriteBookResult.ok) return res.status(400).json({ error: 'Invalid favorite_book_id' });

  await db.run(
    `UPDATE users SET screen_name = ?, avatar_url = ?, favorite_genres = ?, favorite_book_id = ? WHERE id = ?`,
    screenNameResult.value,
    avatarResult.value,
    JSON.stringify(genresResult.value),
    favoriteBookResult.value,
    req.user!.id
  );

  const row = await db.get(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, req.user!.id);
  res.json(await buildProfileResponse(db, row, false));
}));

router.get('/:id/profile', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const row = await db.get(
    `SELECT ${PROFILE_COLUMNS}, is_active FROM users WHERE id = ?`,
    req.params.id
  );
  if (!row || !row.is_active) return res.status(404).json({ error: 'User not found' });
  res.json(await buildProfileResponse(db, row, true));
}));

router.put('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
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

router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
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
