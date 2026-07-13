import { Router, Request, Response } from 'express';
import { Database } from 'sqlite';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';

const router = Router();

const SOURCE_TYPES = new Set(['book', 'review', 'wishlist', 'text']);
const MAX_BODY_LENGTH = 5000;

function asInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeBody(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_BODY_LENGTH) return null;
  return trimmed;
}

function normalizeSourceType(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && SOURCE_TYPES.has(value) ? value : '__invalid__';
}

function threadPair(a: number, b: number): { userOneId: number; userTwoId: number } {
  return a < b ? { userOneId: a, userTwoId: b } : { userOneId: b, userTwoId: a };
}

async function getActiveUser(db: Database, userId: number) {
  return db.get(
    `SELECT id, username, screen_name, avatar_url FROM users WHERE id = ? AND is_active = 1`,
    userId
  );
}

async function findOrCreateThread(db: Database, userId: number, recipientId: number): Promise<number> {
  const { userOneId, userTwoId } = threadPair(userId, recipientId);
  await db.run(
    `INSERT OR IGNORE INTO message_threads (user_one_id, user_two_id) VALUES (?, ?)`,
    userOneId,
    userTwoId
  );
  const existing: any = await db.get(
    `SELECT id FROM message_threads WHERE user_one_id = ? AND user_two_id = ?`,
    userOneId,
    userTwoId
  );
  return existing.id;
}

async function runInTransaction<T>(db: Database, work: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN TRANSACTION');
  try {
    const result = await work();
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

async function buildSource(db: Database, userId: number, sourceType: string | null, raw: any) {
  if (!sourceType || sourceType === 'text') {
    return { sourceType, sourceBookId: null, sourceNoteId: null, snapshot: null };
  }

  if (sourceType === 'book') {
    const sourceBookId = asInt(raw.source_book_id);
    if (!sourceBookId) throw Object.assign(new Error('Invalid source_book_id'), { status: 400 });
    const book: any = await db.get(
      `SELECT id, title, author, status, rating, cover_url, description
       FROM books WHERE id = ? AND user_id = ?`,
      sourceBookId,
      userId
    );
    if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
    return {
      sourceType,
      sourceBookId,
      sourceNoteId: null,
      snapshot: JSON.stringify({ type: 'book', book }),
    };
  }

  if (sourceType === 'review') {
    const sourceNoteId = asInt(raw.source_note_id);
    if (!sourceNoteId) throw Object.assign(new Error('Invalid source_note_id'), { status: 400 });
    const review: any = await db.get(
      `SELECT n.id, n.content, n.created_at, n.updated_at,
              b.id as book_id, b.title, b.author, b.cover_url
       FROM notes n JOIN books b ON b.id = n.book_id
       WHERE n.id = ? AND b.user_id = ?`,
      sourceNoteId,
      userId
    );
    if (!review) throw Object.assign(new Error('Review not found'), { status: 404 });
    return {
      sourceType,
      sourceBookId: review.book_id,
      sourceNoteId,
      snapshot: JSON.stringify({ type: 'review', review }),
    };
  }

  const wishlist = await db.all(
    `SELECT id, title, author, cover_url
     FROM books WHERE user_id = ? AND status = 'wishlist'
     ORDER BY created_at DESC`,
    userId
  );
  return {
    sourceType,
    sourceBookId: null,
    sourceNoteId: null,
    snapshot: JSON.stringify({ type: 'wishlist', books: wishlist }),
  };
}

function publicUser(row: any) {
  return {
    id: row.id,
    screen_name: row.screen_name || row.username,
    avatar_url: row.avatar_url ?? null,
  };
}

async function fetchThreadSummary(db: Database, threadId: number, userId: number) {
  const row: any = await db.get(
    `SELECT t.id as thread_id, t.updated_at,
            o.id as other_user_id, o.username, o.screen_name, o.avatar_url,
            (
              SELECT body FROM messages m
              WHERE m.thread_id = t.id
              ORDER BY datetime(m.created_at) DESC, m.id DESC
              LIMIT 1
            ) as last_body,
            (
              SELECT created_at FROM messages m
              WHERE m.thread_id = t.id
              ORDER BY datetime(m.created_at) DESC, m.id DESC
              LIMIT 1
            ) as last_message_at,
            (
              SELECT COUNT(*) FROM messages m
              WHERE m.thread_id = t.id AND m.recipient_id = ? AND m.read_at IS NULL
            ) as unread_count,
            (
              SELECT COUNT(*) FROM messages m
              WHERE m.thread_id = t.id AND m.sender_id = ?
            ) as sent_count,
            (
              SELECT COUNT(*) FROM message_drafts d
              WHERE d.thread_id = t.id AND d.sender_id = ?
            ) as draft_count
     FROM message_threads t
     JOIN users o ON o.id = CASE WHEN t.user_one_id = ? THEN t.user_two_id ELSE t.user_one_id END
     WHERE t.id = ? AND (t.user_one_id = ? OR t.user_two_id = ?)`,
    userId,
    userId,
    userId,
    userId,
    threadId,
    userId,
    userId
  );
  if (!row) return null;
  return {
    id: row.thread_id,
    updated_at: row.updated_at,
    other_user: publicUser({ id: row.other_user_id, username: row.username, screen_name: row.screen_name, avatar_url: row.avatar_url }),
    last_body: row.last_body ?? null,
    last_message_at: row.last_message_at ?? null,
    unread_count: row.unread_count ?? 0,
    sent_count: row.sent_count ?? 0,
    draft_count: row.draft_count ?? 0,
  };
}

async function listDrafts(db: Database, userId: number, threadId?: number) {
  const params: any[] = [userId];
  let where = `d.sender_id = ?`;
  if (threadId) {
    where += ` AND d.thread_id = ?`;
    params.push(threadId);
  }
  return db.all(
    `SELECT d.*, u.username, u.screen_name, u.avatar_url
     FROM message_drafts d
     JOIN users u ON u.id = d.recipient_id
     WHERE ${where}
     ORDER BY datetime(d.updated_at) DESC, d.id DESC`,
    ...params
  );
}

router.get('/threads', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const rows = await db.all(
    `SELECT t.id
     FROM message_threads t
     WHERE t.user_one_id = ? OR t.user_two_id = ?
     ORDER BY datetime(t.updated_at) DESC, t.id DESC`,
    req.user!.id,
    req.user!.id
  );
  const threads = [];
  for (const row of rows) {
    const summary = await fetchThreadSummary(db, row.id, req.user!.id);
    if (summary) threads.push(summary);
  }
  res.json(threads);
}));

router.get('/drafts', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const rows = await listDrafts(db, req.user!.id);
  res.json(rows.map((row: any) => ({
    ...row,
    recipient: publicUser({ id: row.recipient_id, username: row.username, screen_name: row.screen_name, avatar_url: row.avatar_url }),
  })));
}));

router.get('/threads/:id', asyncHandler(async (req: Request, res: Response) => {
  const threadId = asInt(req.params.id);
  if (!threadId) return res.status(400).json({ error: 'Invalid thread id' });

  const db = await getDb();
  const thread = await fetchThreadSummary(db, threadId, req.user!.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const messages = await db.all(
    `SELECT m.*,
            s.username as sender_username, s.screen_name as sender_screen_name, s.avatar_url as sender_avatar_url,
            r.username as recipient_username, r.screen_name as recipient_screen_name, r.avatar_url as recipient_avatar_url
     FROM messages m
     JOIN users s ON s.id = m.sender_id
     JOIN users r ON r.id = m.recipient_id
     WHERE m.thread_id = ?
     ORDER BY datetime(m.created_at) ASC, m.id ASC`,
    threadId
  );
  const drafts = await listDrafts(db, req.user!.id, threadId);
  res.json({
    thread,
    messages: messages.map((row: any) => ({
      ...row,
      sender: publicUser({ id: row.sender_id, username: row.sender_username, screen_name: row.sender_screen_name, avatar_url: row.sender_avatar_url }),
      recipient: publicUser({ id: row.recipient_id, username: row.recipient_username, screen_name: row.recipient_screen_name, avatar_url: row.recipient_avatar_url }),
    })),
    drafts: drafts.map((row: any) => ({
      ...row,
      recipient: publicUser({ id: row.recipient_id, username: row.username, screen_name: row.screen_name, avatar_url: row.avatar_url }),
    })),
  });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const recipientId = asInt(req.body.recipient_id);
  const body = normalizeBody(req.body.body);
  const sourceType = normalizeSourceType(req.body.source_type);

  if (!recipientId) return res.status(400).json({ error: 'Recipient is required' });
  if (recipientId === req.user!.id) return res.status(400).json({ error: 'Cannot message yourself' });
  if (!body) return res.status(400).json({ error: 'Message body is required and must be under 5000 characters' });
  if (sourceType === '__invalid__') return res.status(400).json({ error: 'Invalid source_type' });

  const recipient = await getActiveUser(db, recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const source = await buildSource(db, req.user!.id, sourceType, req.body);
  const threadId = await findOrCreateThread(db, req.user!.id, recipientId);

  const result = await db.run(
    `INSERT INTO messages (thread_id, sender_id, recipient_id, body, source_type, source_book_id, source_note_id, source_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    threadId,
    req.user!.id,
    recipientId,
    body,
    source.sourceType,
    source.sourceBookId,
    source.sourceNoteId,
    source.snapshot
  );
  await db.run(`UPDATE message_threads SET updated_at = datetime('now') WHERE id = ?`, threadId);
  res.status(201).json(await db.get(`SELECT * FROM messages WHERE id = ?`, result.lastID));
}));

router.post('/drafts', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const recipientId = asInt(req.body.recipient_id);
  const body = normalizeBody(req.body.body);
  const sourceType = normalizeSourceType(req.body.source_type);

  if (!recipientId) return res.status(400).json({ error: 'Recipient is required' });
  if (recipientId === req.user!.id) return res.status(400).json({ error: 'Cannot message yourself' });
  if (!body) return res.status(400).json({ error: 'Draft body is required and must be under 5000 characters' });
  if (sourceType === '__invalid__') return res.status(400).json({ error: 'Invalid source_type' });

  const recipient = await getActiveUser(db, recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const source = await buildSource(db, req.user!.id, sourceType, req.body);
  const threadId = await findOrCreateThread(db, req.user!.id, recipientId);
  const result = await db.run(
    `INSERT INTO message_drafts (sender_id, recipient_id, thread_id, body, source_type, source_book_id, source_note_id, source_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user!.id,
    recipientId,
    threadId,
    body,
    source.sourceType,
    source.sourceBookId,
    source.sourceNoteId,
    source.snapshot
  );
  await db.run(`UPDATE message_threads SET updated_at = datetime('now') WHERE id = ?`, threadId);
  res.status(201).json(await db.get(`SELECT * FROM message_drafts WHERE id = ?`, result.lastID));
}));

router.put('/drafts/:id', asyncHandler(async (req: Request, res: Response) => {
  const draftId = asInt(req.params.id);
  if (!draftId) return res.status(400).json({ error: 'Invalid draft id' });

  const db = await getDb();
  const draft: any = await db.get(`SELECT * FROM message_drafts WHERE id = ? AND sender_id = ?`, draftId, req.user!.id);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  const recipientId = asInt(req.body.recipient_id) || draft.recipient_id;
  const body = normalizeBody(req.body.body);
  const sourceType = normalizeSourceType(req.body.source_type ?? draft.source_type);
  if (recipientId === req.user!.id) return res.status(400).json({ error: 'Cannot message yourself' });
  if (!body) return res.status(400).json({ error: 'Draft body is required and must be under 5000 characters' });
  if (sourceType === '__invalid__') return res.status(400).json({ error: 'Invalid source_type' });
  if (!(await getActiveUser(db, recipientId))) return res.status(404).json({ error: 'Recipient not found' });

  const source = await buildSource(db, req.user!.id, sourceType, req.body);
  const threadId = await findOrCreateThread(db, req.user!.id, recipientId);
  await db.run(
    `UPDATE message_drafts
     SET recipient_id = ?, thread_id = ?, body = ?, source_type = ?, source_book_id = ?, source_note_id = ?,
         source_snapshot = ?, updated_at = datetime('now')
     WHERE id = ? AND sender_id = ?`,
    recipientId,
    threadId,
    body,
    source.sourceType,
    source.sourceBookId,
    source.sourceNoteId,
    source.snapshot,
    draftId,
    req.user!.id
  );
  await db.run(`UPDATE message_threads SET updated_at = datetime('now') WHERE id = ?`, threadId);
  res.json(await db.get(`SELECT * FROM message_drafts WHERE id = ?`, draftId));
}));

router.delete('/drafts/:id', asyncHandler(async (req: Request, res: Response) => {
  const draftId = asInt(req.params.id);
  if (!draftId) return res.status(400).json({ error: 'Invalid draft id' });
  const db = await getDb();
  const result = await db.run(`DELETE FROM message_drafts WHERE id = ? AND sender_id = ?`, draftId, req.user!.id);
  if (!result.changes) return res.status(404).json({ error: 'Draft not found' });
  res.status(204).end();
}));

router.post('/drafts/:id/send', asyncHandler(async (req: Request, res: Response) => {
  const draftId = asInt(req.params.id);
  if (!draftId) return res.status(400).json({ error: 'Invalid draft id' });

  const db = await getDb();
  const draft: any = await db.get(`SELECT * FROM message_drafts WHERE id = ? AND sender_id = ?`, draftId, req.user!.id);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!(await getActiveUser(db, draft.recipient_id))) return res.status(404).json({ error: 'Recipient not found' });

  const result = await runInTransaction(db, async () => {
    const inserted = await db.run(
      `INSERT INTO messages (thread_id, sender_id, recipient_id, body, source_type, source_book_id, source_note_id, source_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      draft.thread_id,
      draft.sender_id,
      draft.recipient_id,
      draft.body,
      draft.source_type,
      draft.source_book_id,
      draft.source_note_id,
      draft.source_snapshot
    );
    await db.run(`DELETE FROM message_drafts WHERE id = ? AND sender_id = ?`, draftId, req.user!.id);
    await db.run(`UPDATE message_threads SET updated_at = datetime('now') WHERE id = ?`, draft.thread_id);
    return inserted;
  });
  res.status(201).json(await db.get(`SELECT * FROM messages WHERE id = ?`, result.lastID));
}));

router.post('/:id/read', asyncHandler(async (req: Request, res: Response) => {
  const messageId = asInt(req.params.id);
  if (!messageId) return res.status(400).json({ error: 'Invalid message id' });
  const db = await getDb();
  const result = await db.run(
    `UPDATE messages SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND recipient_id = ?`,
    messageId,
    req.user!.id
  );
  if (!result.changes) return res.status(404).json({ error: 'Message not found' });
  res.json(await db.get(`SELECT * FROM messages WHERE id = ?`, messageId));
}));

export default router;
