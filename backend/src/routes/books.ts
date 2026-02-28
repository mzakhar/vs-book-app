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

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const [counters, notesCount, byGenre, byRating, recent] = await Promise.all([
    db.get(`
      SELECT
        COUNT(*) as total_books,
        SUM(CASE WHEN status='unread'  THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN status='reading' THEN 1 ELSE 0 END) as reading,
        SUM(CASE WHEN status='read'    THEN 1 ELSE 0 END) as read,
        ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END), 1) as avg_rating
      FROM books
    `),
    db.get(`SELECT COUNT(*) as count FROM notes`),
    db.all(`
      SELECT COALESCE(NULLIF(TRIM(genre),''),'Untagged') as genre, COUNT(*) as count
      FROM books GROUP BY genre ORDER BY count DESC LIMIT 10
    `),
    db.all(`
      SELECT rating, COUNT(*) as count FROM books
      WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating
    `),
    db.all(`SELECT * FROM books ORDER BY created_at DESC LIMIT 5`),
  ]);
  res.json({
    total_books: counters.total_books ?? 0,
    unread:      counters.unread ?? 0,
    reading:     counters.reading ?? 0,
    read:        counters.read ?? 0,
    avg_rating:  counters.avg_rating ?? null,
    total_notes: notesCount.count ?? 0,
    by_genre:    byGenre,
    by_rating:   byRating,
    recent,
  });
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
