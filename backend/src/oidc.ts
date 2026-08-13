import crypto from 'crypto';

// Google's OIDC endpoints are stable and documented; discovery adds a network
// round trip per login for values that have not changed in a decade.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export interface OidcConfig {
  clientId: string;
  clientSecret: string;
  /** Public origin + base path, no trailing slash — e.g. https://books.example.org/books */
  baseUrl: string;
  redirectUri: string;
}

/** Null when the app has not been given Google credentials — callers return 503. */
export function oidcConfig(): OidcConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  if (!clientId || !clientSecret || !baseUrl) return null;
  return { clientId, clientSecret, baseUrl, redirectUri: `${baseUrl}/api/auth/callback` };
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthUrl(cfg: OidcConfig, state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * Reads the id_token payload without verifying its signature. Safe here and only
 * here: the token came back on our own TLS connection to Google's token endpoint,
 * in response to a code we minted (OIDC Core 3.1.3.7, clause 6). Never call this
 * on a token that arrived from a browser.
 */
export function decodeIdToken(idToken: string): IdTokenClaims | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export type ClaimCheck =
  | { ok: true; email: string; sub: string }
  | { ok: false; reason: string };

export function validateClaims(
  claims: IdTokenClaims | null,
  clientId: string,
  nowMs: number
): ClaimCheck {
  if (!claims) return { ok: false, reason: 'malformed id_token' };
  if (!claims.iss || !VALID_ISSUERS.has(claims.iss)) return { ok: false, reason: 'bad issuer' };
  if (claims.aud !== clientId) return { ok: false, reason: 'bad audience' };
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return { ok: false, reason: 'expired' };
  if (!claims.sub) return { ok: false, reason: 'missing sub' };
  if (claims.email_verified !== true) return { ok: false, reason: 'email not verified' };
  const email = normalizeEmail(claims.email);
  if (!email) return { ok: false, reason: 'missing or invalid email' };
  return { ok: true, email, sub: claims.sub };
}

/** Lowercased + trimmed, or null if it isn't shaped like an address. */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Returns the id_token, or null if the exchange failed. */
export async function exchangeCode(
  cfg: OidcConfig,
  code: string,
  verifier: string
): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    console.error('google token exchange failed', res.status, await res.text());
    return null;
  }

  const body: any = await res.json();
  return typeof body.id_token === 'string' ? body.id_token : null;
}
