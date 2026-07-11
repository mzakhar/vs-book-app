# User Accounts Design

Date: 2026-07-11
Status: approved

## Goal

Multi-user support: each user has their own book library, series, and notes. Users are created by an admin (no self-registration). Secure sign-in required before the app is published to the wider internet (Cloudflare → homelab Traefik → service).

## Decisions

| Question | Decision |
|---|---|
| Data model | Fully separate libraries per user (`user_id` ownership on books and series; notes inherit via book cascade) |
| Auth | Server-side sessions, httpOnly cookies; bcryptjs password hashes |
| User creation | Admin page in app; first admin seeded from env vars |
| Existing data | Backfilled to the first (seeded) admin user |

## Schema

New tables:

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,          -- SHA-256 of the raw cookie token
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Ownership columns via the existing migrations-array pattern (`backend/src/database.ts`):

```sql
ALTER TABLE books  ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE series ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
```

Structural migration (the only table rebuild): `series.name` is globally UNIQUE today; it must become UNIQUE per `(user_id, name)`. SQLite cannot alter constraints, so: create `series_new` with the composite unique constraint, copy rows, drop `series`, rename. Guard so it runs once (check via `PRAGMA index_list` / sentinel).

Startup order: create tables → run migrations → seed admin if `users` is empty (from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env) → backfill `UPDATE books/series SET user_id = <admin id> WHERE user_id IS NULL`.

## Auth mechanics

- Passwords: bcryptjs (pure JS — no native build in `node:20-bookworm-slim`), cost 12.
- Login: verify password → generate 32 random bytes (`crypto.randomBytes`), store SHA-256 hex in `sessions`, set raw token as cookie `book_app_session`: `httpOnly`, `SameSite=Lax`, `Secure` when `NODE_ENV=production`, `maxAge` 30 days. Sliding renewal: extend `expires_at` when a request arrives past half-life.
- Logout: delete session row, clear cookie.
- Rate limit `POST /api/auth/login` with `express-rate-limit` (e.g. 10/15min per IP). Requires `app.set('trust proxy', true)` so the limiter keys on the real client IP behind Cloudflare/Traefik.
- Inactive users (`is_active = 0`): login refused, existing sessions rejected.
- Expired sessions purged opportunistically on lookup.

## Backend routes

- `backend/src/middleware/auth.ts` — `requireAuth` (cookie → session lookup → attach `req.user`, 401 otherwise), `requireAdmin` (403 unless `role === 'admin'`).
- `backend/src/routes/auth.ts` — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- `backend/src/routes/users.ts` (admin only) — `GET /api/users`, `POST /api/users` (username, password, role), `PUT /api/users/:id` (reset password, toggle active, role), `DELETE /api/users/:id` (refuse self-delete; cascade wipes their library).
- Existing `books.ts`, `notes.ts`, `series.ts`: mounted behind `requireAuth`; every query scoped by `req.user.id` (notes scope via join to `books.user_id`). Cross-user IDs return 404, not 403.
- `/api/health` stays public (k8s probes).

New deps: `bcryptjs`, `cookie-parser`, `express-rate-limit` (+ types).

## Frontend

- `AuthContext` — `GET /api/auth/me` on mount; `user | null | loading`. Provides `login`, `logout`.
- `LoginPage` at `/login`, outside `Layout`.
- Route guard: unauthenticated → redirect `/login`. Axios response interceptor: 401 → clear context → `/login` (skip for the `/auth/me` probe itself).
- `UsersPage` at `/users` — nav link rendered only for `role === 'admin'`; create user, reset password, activate/deactivate.
- Logout button + current username in `Layout` sidebar.
- Theme preference stays device-local (`book_app_theme`), unchanged.

## Deployment notes / handoff to infra agent

- `ADMIN_USERNAME` / `ADMIN_PASSWORD` as a k8s Secret referenced in `k8s/base/deployment.yaml`. Seed only runs when `users` is empty — rotating the env var later does NOT change the password (use the admin UI).
- Cloudflare terminates TLS; `Secure` cookie works from day one.
- **Handoff item:** restrict origin so only Cloudflare IPs reach Traefik for this host, otherwise the app is reachable plain-HTTP around Cloudflare.
- CSRF: state-changing endpoints are non-GET, CORS is locked to dev origins, cookie is `SameSite=Lax` — adequate for this API shape.

## Build phases

1. Backend: schema, migrations, seed, auth middleware, auth/users routes, scoping of existing routes.
2. Frontend: AuthContext, LoginPage, route guard, interceptor, UsersPage, Layout changes.
3. k8s: Secret wiring in deployment manifest (coordinate with infra agent).

Phases implemented by `cavecrew-implementer` agents from written briefs; main session orchestrates, verifies, and commits.
