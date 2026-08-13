import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../database';
import { asyncHandler } from '../asyncHandler';
import { createSession, destroySession, requireAuth } from '../middleware/auth';
import {
  buildAuthUrl,
  decodeIdToken,
  exchangeCode,
  newPkce,
  oidcConfig,
  validateClaims,
} from '../oidc';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production';
const OIDC_COOKIE = 'book_app_oidc';
const OIDC_TTL_MS = 10 * 60 * 1000;

// GET, not POST: this is a top-level browser navigation to Google.
router.get('/login', asyncHandler(async (_req: Request, res: Response) => {
  const cfg = oidcConfig();
  if (!cfg) return res.status(503).send('Google sign-in is not configured.');

  const state = crypto.randomBytes(32).toString('hex');
  const { verifier, challenge } = newPkce();

  // sameSite 'lax' is required — the callback arrives as a cross-site top-level
  // navigation from accounts.google.com, and 'strict' would drop this cookie.
  res.cookie(OIDC_COOKIE, JSON.stringify({ state, verifier }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: OIDC_TTL_MS,
    path: '/',
  });

  res.redirect(buildAuthUrl(cfg, state, challenge));
}));

router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const cfg = oidcConfig();
  if (!cfg) return res.status(503).send('Google sign-in is not configured.');

  const raw = req.cookies?.[OIDC_COOKIE];
  res.clearCookie(OIDC_COOKIE, { path: '/' });

  // Every failure lands back on the login page with a code the SPA turns into copy.
  const fail = (reason: string) => res.redirect(`${cfg.baseUrl}/login?error=${reason}`);

  if (req.query.error) return fail('denied');

  let stored: { state?: string; verifier?: string } = {};
  try { stored = JSON.parse(raw || '{}'); } catch { /* malformed cookie — treated as missing */ }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!stored.state || !stored.verifier || !code || req.query.state !== stored.state) {
    return fail('state');
  }

  const idToken = await exchangeCode(cfg, code, stored.verifier);
  if (!idToken) return fail('exchange');

  const claims = validateClaims(decodeIdToken(idToken), cfg.clientId, Date.now());
  if (!claims.ok) {
    console.warn('rejected google id_token:', claims.reason);
    return fail('token');
  }

  // The allowlist: an admin must have already created a user with this address.
  const db = await getDb();
  const user: any = await db.get(
    `SELECT id, google_sub FROM users WHERE email = ? AND is_active = 1`,
    claims.email
  );
  if (!user) return fail('not_authorized');

  if (!user.google_sub) {
    await db.run(`UPDATE users SET google_sub = ? WHERE id = ?`, claims.sub, user.id);
  }

  await createSession(db, user.id, res);
  res.redirect(`${cfg.baseUrl}/`);
}));

// Dev-only shortcut so `npm run dev` doesn't need a public HTTPS callback.
// 404s in production and whenever DEV_LOGIN_EMAIL is unset.
router.post('/dev-login', asyncHandler(async (_req: Request, res: Response) => {
  const email = (process.env.DEV_LOGIN_EMAIL || '').trim().toLowerCase();
  if (IS_PROD || !email) return res.status(404).json({ error: 'not found' });

  const db = await getDb();
  const user: any = await db.get(
    `SELECT id, username, email, role FROM users WHERE email = ? AND is_active = 1`,
    email
  );
  if (!user) return res.status(401).json({ error: 'DEV_LOGIN_EMAIL matches no active user' });

  await createSession(db, user.id, res);
  res.json(user);
}));

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  await destroySession(db, req, res);
  res.status(204).end();
}));

router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    id: req.user!.id,
    username: req.user!.username,
    email: req.user!.email,
    role: req.user!.role,
  });
}));

export default router;
