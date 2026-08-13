/**
 * Self-check for the pure half of the OIDC flow.
 * Run: npx ts-node backend/src/oidc.check.ts
 */
import assert from 'assert';
import {
  buildAuthUrl,
  decodeIdToken,
  newPkce,
  normalizeEmail,
  validateClaims,
  OidcConfig,
} from './oidc';

const cfg: OidcConfig = {
  clientId: 'cid.apps.googleusercontent.com',
  clientSecret: 'secret',
  baseUrl: 'https://books.example.org/books',
  redirectUri: 'https://books.example.org/books/api/auth/callback',
};

const NOW = 1_700_000_000_000;
const FUTURE = Math.floor(NOW / 1000) + 600;
const PAST = Math.floor(NOW / 1000) - 600;

function idTokenFor(payload: object): string {
  const seg = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `header.${seg}.signature`;
}

const goodClaims = {
  iss: 'https://accounts.google.com',
  aud: cfg.clientId,
  exp: FUTURE,
  sub: '110123',
  email: '  Reader@Gmail.com ',
  email_verified: true,
};

// --- auth url ---
{
  const url = new URL(buildAuthUrl(cfg, 'st4te', 'ch4llenge'));
  assert.strictEqual(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.strictEqual(url.searchParams.get('client_id'), cfg.clientId);
  assert.strictEqual(url.searchParams.get('redirect_uri'), cfg.redirectUri);
  assert.strictEqual(url.searchParams.get('response_type'), 'code');
  assert.strictEqual(url.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(url.searchParams.get('state'), 'st4te');
}

// --- pkce ---
{
  const a = newPkce();
  const b = newPkce();
  assert.notStrictEqual(a.verifier, b.verifier, 'verifier must not repeat');
  assert.ok(!/[+/=]/.test(a.verifier + a.challenge), 'must be base64url, not base64');
}

// --- decode ---
assert.strictEqual(decodeIdToken('not-a-jwt'), null);
assert.strictEqual(decodeIdToken('a.!!!not-base64-json!!!.c'), null);
assert.deepStrictEqual(decodeIdToken(idTokenFor({ sub: 'x' })), { sub: 'x' });

// --- claim validation ---
{
  const ok = validateClaims(decodeIdToken(idTokenFor(goodClaims)), cfg.clientId, NOW);
  assert.ok(ok.ok);
  assert.strictEqual(ok.email, 'reader@gmail.com', 'email normalised to lowercase');
  assert.strictEqual(ok.sub, '110123');
}

const rejects: Array<[string, object | null]> = [
  ['malformed', null],
  ['bad issuer', { ...goodClaims, iss: 'https://evil.example' }],
  ['bad audience', { ...goodClaims, aud: 'someone-elses-client-id' }],
  ['expired', { ...goodClaims, exp: PAST }],
  ['no exp', { ...goodClaims, exp: undefined }],
  ['no sub', { ...goodClaims, sub: undefined }],
  ['unverified email', { ...goodClaims, email_verified: false }],
  ['missing email_verified', { ...goodClaims, email_verified: undefined }],
  ['no email', { ...goodClaims, email: undefined }],
];
for (const [label, claims] of rejects) {
  const result = validateClaims(claims as any, cfg.clientId, NOW);
  assert.strictEqual(result.ok, false, `expected rejection: ${label}`);
}

// --- email normalisation (also the admin allowlist input path) ---
assert.strictEqual(normalizeEmail('  A.B@Gmail.COM '), 'a.b@gmail.com');
assert.strictEqual(normalizeEmail('nope'), null);
assert.strictEqual(normalizeEmail('no@domain'), null);
assert.strictEqual(normalizeEmail('two @spaces.com'), null);
assert.strictEqual(normalizeEmail(42), null);
assert.strictEqual(normalizeEmail('x'.repeat(250) + '@gmail.com'), null);

console.log('oidc.check: all assertions passed');
