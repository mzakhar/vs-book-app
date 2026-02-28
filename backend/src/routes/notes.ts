import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';

const router = Router();

router.get('/:bookId', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  res.json(await db.all(
    `SELECT * FROM notes WHERE book_id = ? ORDER BY created_at DESC`,
    req.params.bookId
  ));
}));

router.post('/:bookId', asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

  const db = await getDb();
  const book = await db.get(`SELECT id FROM books WHERE id = ?`, req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const result = await db.run(
    `INSERT INTO notes (book_id, content) VALUES (?, ?)`,
    req.params.bookId, content.trim()
  );
  res.status(201).json(await db.get(`SELECT * FROM notes WHERE id = ?`, result.lastID));
}));

router.put('/:noteId', asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

  const db = await getDb();
  const existing = await db.get(`SELECT id FROM notes WHERE id = ?`, req.params.noteId);
  if (!existing) return res.status(404).json({ error: 'Note not found' });

  await db.run(
    `UPDATE notes SET content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    content.trim(), req.params.noteId
  );
  res.json(await db.get(`SELECT * FROM notes WHERE id = ?`, req.params.noteId));
}));

router.delete('/:noteId', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = await db.get(`SELECT id FROM notes WHERE id = ?`, req.params.noteId);
  if (!existing) return res.status(404).json({ error: 'Note not found' });
  await db.run(`DELETE FROM notes WHERE id = ?`, req.params.noteId);
  res.status(204).end();
}));

export default router;
