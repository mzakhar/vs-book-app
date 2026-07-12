import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';
import { buildIssuePayload, createIssue, isGithubConfigured, FeedbackType } from '../github';

const router = Router();

const VALID_TYPES: FeedbackType[] = ['bug', 'feature', 'other'];

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (!isGithubConfigured()) {
    return res.status(503).json({ error: 'Feedback is not configured' });
  }

  const { type, description } = req.body;
  if (typeof type !== 'string' || !VALID_TYPES.includes(type as FeedbackType)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  if (!trimmedDescription) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const db = await getDb();
  const result = await db.run(
    `INSERT INTO feedback (user_id, type, description) VALUES (?, ?, ?)`,
    req.user!.id, type, trimmedDescription
  );
  const feedbackId = result.lastID;

  const user = await db.get(
    `SELECT COALESCE(screen_name, username) as screen_name FROM users WHERE id = ?`,
    req.user!.id
  );
  const screenName = user?.screen_name || req.user!.username;

  const payload = buildIssuePayload({ type: type as FeedbackType, description: trimmedDescription }, screenName);
  const issueResult = await createIssue(payload);

  if (!issueResult.ok) {
    await db.run(`UPDATE feedback SET status = 'failed' WHERE id = ?`, feedbackId);
    return res.status(502).json({ error: 'Failed to create GitHub issue' });
  }

  await db.run(
    `UPDATE feedback SET status = 'synced', issue_number = ?, issue_url = ? WHERE id = ?`,
    issueResult.issueNumber, issueResult.issueUrl, feedbackId
  );

  res.status(201).json({ issueNumber: issueResult.issueNumber, issueUrl: issueResult.issueUrl });
}));

export default router;
