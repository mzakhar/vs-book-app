import { Router, Request, Response } from 'express';
import { Database } from 'sqlite';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';

const router = Router();

export async function findOrCreateSeries(db: Database, name: string): Promise<number> {
  const existing = await db.get(
    `SELECT id FROM series WHERE name = ? COLLATE NOCASE`,
    name.trim()
  );
  if (existing) return existing.id;
  try {
    const result = await db.run(`INSERT INTO series (name) VALUES (?)`, name.trim());
    return result.lastID!;
  } catch {
    // UNIQUE race — fetch it
    const row = await db.get(`SELECT id FROM series WHERE name = ? COLLATE NOCASE`, name.trim());
    return row.id;
  }
}

async function seriesWithBooks(db: Database, id: number) {
  const series = await db.get(`SELECT * FROM series WHERE id = ?`, id);
  if (!series) return null;
  const books = await db.all(
    `SELECT id, title, author, status, series_position, cover_url, rating
     FROM books WHERE series_id = ? ORDER BY series_position ASC NULLS LAST, id ASC`,
    id
  );
  const read_count = books.filter((b: any) => b.status === 'read').length;
  return { ...series, books, book_count: books.length, read_count };
}

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const all = await db.all(`SELECT * FROM series ORDER BY name ASC`);
  const result = await Promise.all(all.map((s: any) => seriesWithBooks(db, s.id)));
  res.json(result);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const s = await seriesWithBooks(db, Number(req.params.id));
  if (!s) return res.status(404).json({ error: 'Series not found' });
  res.json(s);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, total_books } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const db = await getDb();
  try {
    const result = await db.run(
      `INSERT INTO series (name, total_books) VALUES (?, ?)`,
      name.trim(), total_books ? Number(total_books) : null
    );
    const s = await seriesWithBooks(db, result.lastID!);
    res.status(201).json(s);
  } catch {
    res.status(409).json({ error: 'Series name already exists' });
  }
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT * FROM series WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Series not found' });
  const { name, total_books } = req.body;
  await db.run(
    `UPDATE series SET name=?, total_books=? WHERE id=?`,
    name !== undefined ? name.trim() || existing.name : existing.name,
    total_books !== undefined ? (total_books ? Number(total_books) : null) : existing.total_books,
    req.params.id
  );
  res.json(await seriesWithBooks(db, Number(req.params.id)));
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT id FROM series WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Series not found' });
  await db.run(`DELETE FROM series WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

export default router;
