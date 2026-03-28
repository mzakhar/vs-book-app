import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';
import { findOrCreateSeries } from './series';

const router = Router();

const SELECT_BOOK = `
  SELECT b.*, s.name as series_name, GROUP_CONCAT(bg.genre) as genres
  FROM books b
  LEFT JOIN series s ON s.id = b.series_id
  LEFT JOIN book_genres bg ON bg.book_id = b.id
`;

const GROUP_BY_BOOK = `GROUP BY b.id`;

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const q = req.query.q as string | undefined;
  const status = req.query.status as string | undefined;
  
  let query = SELECT_BOOK;
  const params: any[] = [];
  const where: string[] = [];

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    where.push(`(b.title LIKE ? OR b.author LIKE ?)`);
    params.push(like, like);
  }

  if (status) {
    where.push(`b.status = ?`);
    params.push(status);
  } else {
    // Default: exclude wishlist from main list if no status specified
    where.push(`b.status != 'wishlist'`);
  }

  if (where.length > 0) {
    query += ` WHERE ` + where.join(' AND ');
  }

  query += ` ${GROUP_BY_BOOK} ORDER BY b.created_at DESC`;
  res.json(await db.all(query, ...params));
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { title, author, genre, genres, status, rating, cover_url,
          series_name, series_position, page_count, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const db = await getDb();

  let series_id: number | null = null;
  if (series_name && series_name.trim()) {
    series_id = await findOrCreateSeries(db, series_name.trim());
  }

  const result = await db.run(
    `INSERT INTO books (title, author, status, rating, cover_url, series_id, series_position, page_count, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    title.trim(),
    author?.trim() || null,
    status || 'unread',
    rating ? Number(rating) : null,
    cover_url?.trim() || null,
    series_id,
    series_position != null ? Number(series_position) : null,
    page_count ? Number(page_count) : null,
    description?.trim() || null
  );

  const bookId = result.lastID;
  const genresToSave = Array.isArray(genres) ? genres : (genre ? genre.split(',').map((g: string) => g.trim()) : []);
  for (const g of genresToSave) {
    if (g && g.trim()) {
      await db.run("INSERT OR IGNORE INTO book_genres (book_id, genre) VALUES (?, ?)", bookId, g.trim());
    }
  }

  res.status(201).json(await db.get(`${SELECT_BOOK} WHERE b.id = ? ${GROUP_BY_BOOK}`, bookId));
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
      SELECT genre, COUNT(*) as count
      FROM book_genres GROUP BY genre ORDER BY count DESC LIMIT 10
    `),
    db.all(`
      SELECT rating, COUNT(*) as count FROM books
      WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating
    `),
    db.all(`${SELECT_BOOK} ORDER BY b.created_at DESC LIMIT 5`),
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
  const book = await db.get(`${SELECT_BOOK} WHERE b.id = ? ${GROUP_BY_BOOK}`, req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT * FROM books WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Book not found' });

  const { title, author, genre, genres, status, rating, cover_url,
          series_name, series_position, page_count, description } = req.body;

  let series_id: number | null = existing.series_id;
  if (series_name !== undefined) {
    if (series_name === '' || series_name === null) {
      series_id = null;
    } else {
      series_id = await findOrCreateSeries(db, series_name.trim());
    }
  }

  await db.run(
    `UPDATE books SET title=?, author=?, status=?, rating=?, cover_url=?,
     series_id=?, series_position=?, page_count=?, description=? WHERE id=?`,
    title !== undefined ? title.trim() || existing.title : existing.title,
    author !== undefined ? author?.trim() || null : existing.author,
    status !== undefined ? status : existing.status,
    rating !== undefined ? (rating ? Number(rating) : null) : existing.rating,
    cover_url !== undefined ? cover_url?.trim() || null : existing.cover_url,
    series_id,
    series_position !== undefined ? (series_position != null ? Number(series_position) : null) : existing.series_position,
    page_count !== undefined ? (page_count ? Number(page_count) : null) : existing.page_count,
    description !== undefined ? description?.trim() || null : existing.description,
    req.params.id
  );

  if (genres !== undefined || genre !== undefined) {
    await db.run("DELETE FROM book_genres WHERE book_id = ?", req.params.id);
    const genresToSave = Array.isArray(genres) ? genres : (genre ? genre.split(',').map((g: string) => g.trim()) : []);
    for (const g of genresToSave) {
      if (g && g.trim()) {
        await db.run("INSERT OR IGNORE INTO book_genres (book_id, genre) VALUES (?, ?)", req.params.id, g.trim());
      }
    }
  }

  res.json(await db.get(`${SELECT_BOOK} WHERE b.id = ? ${GROUP_BY_BOOK}`, req.params.id));
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT id FROM books WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Book not found' });
  await db.run(`DELETE FROM books WHERE id = ?`, req.params.id);
  res.status(204).end();
}));

export default router;
