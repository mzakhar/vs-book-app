import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const q = req.query.q as string | undefined;
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    res.json(await db.all(
      `SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY created_at DESC`,
      like, like
    ));
  } else {
    res.json(await db.all(`SELECT * FROM books ORDER BY created_at DESC`));
  }
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, author, genre, status, rating, cover_url } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const db = await getDb();
  const result = await db.run(
    `INSERT INTO books (title, author, genre, status, rating, cover_url) VALUES (?, ?, ?, ?, ?, ?)`,
    title.trim(),
    author?.trim() || null,
    genre?.trim() || null,
    status || 'unread',
    rating ? Number(rating) : null,
    cover_url?.trim() || null
  );
  res.status(201).json(await db.get(`SELECT * FROM books WHERE id = ?`, result.lastID));
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const book = await db.get(`SELECT * FROM books WHERE id = ?`, req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT * FROM books WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Book not found' });

  const { title, author, genre, status, rating, cover_url } = req.body;
  await db.run(
    `UPDATE books SET title=?, author=?, genre=?, status=?, rating=?, cover_url=? WHERE id=?`,
    title !== undefined ? title.trim() || existing.title : existing.title,
    author !== undefined ? author?.trim() || null : existing.author,
    genre !== undefined ? genre?.trim() || null : existing.genre,
    status !== undefined ? status : existing.status,
    rating !== undefined ? (rating ? Number(rating) : null) : existing.rating,
    cover_url !== undefined ? cover_url?.trim() || null : existing.cover_url,
    req.params.id
  );
  res.json(await db.get(`SELECT * FROM books WHERE id = ?`, req.params.id));
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT id FROM books WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Book not found' });
  await db.run(`DELETE FROM books WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

export default router;
