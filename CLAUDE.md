# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

From the repo root:

```bash
npm run install:all   # install all deps (backend + frontend)
npm run dev           # start both backend (port 3000) and frontend (port 5173) concurrently
npm run dev:backend   # backend only
npm run dev:frontend  # frontend only
npm run deploy:pin-image # after main image publish, pin k8s deployment to latest GHCR digest
```

From `backend/`:
```bash
npm run dev    # nodemon + ts-node (hot reload)
npm run build  # tsc → dist/
npm run start  # run compiled dist/index.js
```

From `frontend/`:
```bash
npm run dev     # vite dev server
npm run build   # tsc + vite build
```

There are no tests.

## Deployment

Merging to `main` triggers `.github/workflows/container-publish.yml`, which builds and pushes `ghcr.io/mzakhar/vs-book-app:main`. That image publish alone does not guarantee a cluster rollout because Flux reconciles Git state and the Kubernetes deployment is pinned by image digest.

After a PR merges and the GitHub Actions container publish completes, update the deployment digest from `main` and push that manifest change:

```powershell
npm run deploy:pin-image -- -Commit -Push
```

This runs `scripts/update-deploy-image.ps1`, resolves the current GHCR digest, rewrites `k8s/base/deployment.yaml`, and commits the digest pin. Flux reconciles `k8s/base` from Git on its normal interval.

**`main` is branch-protected (PR-only).** Direct `git push` to `main` is rejected (`GH013: Changes must be made through a pull request`). The `-Push` flag on the pin script will therefore fail — instead move the pin commit onto a branch and merge it via PR, same as any change:

```bash
git branch mzakhar/deploy-pin <pin-commit>   # after running the script without -Push, or salvage the local commit
git reset --hard origin/main
git push -u origin mzakhar/deploy-pin
gh pr create --base main --fill && gh pr merge --squash --delete-branch
```

### Deployment target — `themachine` (home lab)

- **Host**: `themachine`, Ubuntu, LAN IP `192.168.1.3` (static). SSH: `ssh mzakhar@192.168.1.3`.
- **Orchestration**: k3s (v1.35.x) + Flux CD (GitOps). Flux runs on `themachine`, watches the separate `mzakhar/homelab-fleet` repo (`clusters/themachine/`) for the `GitRepository` + `Kustomization` that point back at this repo's `k8s/base`. So a merged digest pin in `main` is what actually triggers a rollout — a fresh `:main` image alone does not.
- **Routing**: Traefik serves the app on the `/books/` subpath (StripPrefix middleware). Single replica; SQLite is node-local (local-path), so the workload is effectively node-pinned and cannot scale past one writer.
- **URLs**: LAN `http://192.168.1.3/books/`; external `https://books.zakharhome.org/books/` (Cloudflare Tunnel). Backend health is `/api/health` *inside the pod*; through Traefik it is `/books/api/health` — `localhost/api/health` returns `404 page not found`.
- **Namespace**: the workload lives in the `vs-book-app` namespace, not `default`. `kubectl` without `-n vs-book-app` reports `deployments.apps "vs-book-app" not found`.
- **Verify a rollout** (from `themachine` over SSH):

  ```bash
  kubectl -n vs-book-app rollout status deploy/vs-book-app   # rollout progress
  kubectl -n vs-book-app get pods -l app=vs-book-app -o wide # running pod + node
  kubectl -n vs-book-app get deploy vs-book-app -o jsonpath='{.spec.template.spec.containers[0].image}'  # live pinned digest
  flux get kustomizations -A                                 # Flux reconcile state
  curl -s localhost/books/api/health                         # app health through Traefik
  ```

  Compare the live digest against `k8s/base/deployment.yaml` on `main` to confirm Flux has caught up.

  Flux reconciles on its own interval, so a freshly merged pin may not be live yet. To apply
  it immediately rather than waiting:

  ```bash
  flux reconcile source git vs-book-app
  flux reconcile kustomization vs-book-app
  ```

## Handling `[Feedback]` issues

The in-app feedback widget files GitHub issues in `mzakhar/vs-book-app` via `backend/src/github.ts` — titled `[Feedback] <first 80 chars of what the user typed>`, labeled `feedback`, body being the user's raw words plus `_Reported by <name> via in-app feedback_`. **These are raw user reports, not actionable specs.**

When asked to work on any issue whose title starts with `[Feedback]` (or carries the `feedback` label), the **first step is always to turn it into a well-formed issue before touching code** — do not implement straight from the raw report. That means:

1. Read the raw report and infer intent; if it's ambiguous, note the assumptions rather than guessing silently.
2. Rewrite into a clear issue: a precise title (drop the `[Feedback]` prefix), a problem statement, reproduction steps or the concrete user goal, expected vs. actual behavior, and acceptance criteria.
3. Classify it — bug vs. feature vs. question — and relabel accordingly (keep a trace back to the original, e.g. via a comment or `triaged-from` note).
4. Only then plan and implement against the well-formed version.

One raw `[Feedback]` item may split into several concrete issues, or may be a duplicate of an existing one — say so instead of forcing a 1:1 mapping.

## Architecture

**Monorepo** with `backend/` and `frontend/` as independent npm workspaces; the root `package.json` holds orchestration scripts.

### Backend (`backend/src/`)

- **`index.ts`** — Express entry point; mounts `/api/books`, `/api/notes`, `/api/series`; error handler; calls `getDb()` before listening on port 3000
- **`database.ts`** — Singleton SQLite connection (`books.db` at repo root). Schema defined inline with `CREATE TABLE IF NOT EXISTS`. New columns are added via a migrations array that silently ignores "duplicate column" errors — this is the pattern for all future schema changes.
- **`routes/books.ts`**, **`routes/notes.ts`**, **`routes/series.ts`** — Route handlers; use `asyncHandler` wrapper for error propagation
- **`asyncHandler.ts`** — Wraps async route handlers so thrown errors reach the Express error middleware

### Frontend (`frontend/src/`)

- **`api/index.ts`** — All backend calls via a single axios instance with `baseURL: '/api'`. Vite proxies `/api` → `http://localhost:3000`, so no CORS issues in dev.
- **`api/openLibrary.ts`** — Calls the Open Library public API to auto-fill book metadata (title, author, cover, page count, series, description) when adding/editing a book.
- **`types/index.ts`** — Single source of truth for shared types: `Book`, `Note`, `Series`, `SeriesBook`, `BookStats`, `BookStatus`.
- **Pages**: `Dashboard` (stats), `BookList` (library grid + search), `BookDetail` (book + notes), `SeriesPage`
- **Components**: `BookForm` (add/edit, includes OL search + clipboard image paste for covers), `NoteForm`, `Modal`, `Toast`, `Layout`

### Routing

React Router v6 nested layout — `Layout` wraps all routes via `<Outlet />`:

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/library` | BookList |
| `/scan` | ScanPage (barcode add; HTTPS only) |
| `/books/:id` | BookDetail |
| `/series` | SeriesPage |

### Theming

Three CSS themes (`dark`, `light`, `purple`) defined as CSS custom properties in `frontend/src/styles/_themes.scss`. Active theme stored in `localStorage` under key `book_app_theme` and applied via `data-theme` on `<html>`. All styling uses SASS with the theme variables; no CSS-in-JS.

### Database schema

- `series(id, name, total_books, created_at)`
- `books(id, title, author, genre, status, rating, cover_url, created_at, series_id, series_position, page_count, description, isbn)` — `status` is constrained to `'unread' | 'reading' | 'read'`; `isbn` is a normalized 13-digit string set by barcode scanning
- `notes(id, book_id, content, created_at, updated_at)` — cascades delete from books

WAL mode and foreign keys are enabled on every connection.

## Authentication — Google OIDC + allowlist

There are no passwords. Identity comes from Google; authorization comes from a row
in `users` with a matching `email`. An unrecognised Google account is rejected —
nothing is created, nothing is queued for approval.

- **Flow** (`backend/src/oidc.ts`, `backend/src/routes/auth.ts`): `GET /api/auth/login`
  mints state + PKCE into a 10-minute `book_app_oidc` cookie and 302s to Google;
  `GET /api/auth/callback` verifies state, exchanges the code, validates the
  `id_token` claims, looks the email up in `users`, then creates the *existing*
  session-cookie session. The `sessions` table, `requireAuth`, and the 30-day
  sliding cookie are unchanged from the password era — only the proof of identity
  is different.
- **The `id_token` signature is not verified.** It arrives on our own TLS
  connection to Google's token endpoint in response to a code we minted, which is
  the case OIDC Core 3.1.3.7 exempts. Never extend `decodeIdToken` to tokens that
  came from a browser.
- **`APP_BASE_URL` drives the redirect URI** (`<APP_BASE_URL>/api/auth/callback`).
  It must byte-match an authorized redirect URI on the Google OAuth client, so
  changing the base path means editing the GCP client too. Secrets:
  `k8s/base/oidc-secret.example.yaml`.
- **`password_hash` is a dead column.** It stays `NOT NULL` and gets `''` because
  dropping it means rebuilding a table six foreign keys reference. Nothing reads it.
- **`email` is the allowlist key** with a unique index; NULLs stay distinct, so
  pre-OIDC users simply cannot sign in until an admin sets their address on the
  Users page. `ADMIN_EMAIL` is the bootstrap: it seeds the first admin on an empty
  DB, or backfills the first admin's NULL email on an existing one. It never
  overwrites an address that is already set.
- **Local dev never talks to Google** (no public HTTPS callback). Set
  `DEV_LOGIN_EMAIL` to an active user's address and use the "Dev sign in" button;
  `POST /api/auth/dev-login` 404s when `NODE_ENV=production` or the var is unset.
- **The LAN URL can no longer sign anyone in.** `http://192.168.1.3/books/` drops the
  `secure` state cookie and then hands off to the public host, so the callback fails
  with `?error=state`. Sign in at `https://books.zakharhome.org/books/`; the LAN
  address still works for an already-authenticated browser.
- Deep links are not preserved through sign-in — every successful callback lands
  on `/books/`.
- Self-check for the pure half: `cd backend && npx ts-node src/oidc.check.ts`.

## Barcode scanning

`/scan` (`pages/ScanPage.tsx`) adds books by camera. Bulk flow: the scanner stays open,
each accepted barcode appends a queue row, you review and batch-save.

- **Camera requires a secure context.** `http://192.168.1.3/books/` can never get camera
  access — only `https://books.zakharhome.org/books/` works. The nav entry disables itself
  when `!window.isSecureContext`.
- iOS Safari has no `BarcodeDetector`, so decoding uses `zxing-wasm` (reader-only build,
  dynamically imported). The `.wasm` is self-hosted, not CDN-loaded: `?url` import plus a
  `locateFile` override resolves it to `/books/assets/zxing_reader-*.wasm` under the
  `base: '/books/'` config. Changing `base` or the import style breaks it in production
  while leaving dev working.
- `lib/isbn.ts` is the pure core (EAN-13 checksum, 978/979 gate, ISBN-10→13). The prefix
  gate is what rejects the UPC-5 price barcode printed beside the ISBN on most books —
  without it, scans resolve to garbage. Self-check: `npx tsx frontend/src/lib/isbn.check.ts`.
- Lookup is Open Library first (`lookupByIsbn` reuses the existing work-based pipeline),
  Google Books on a miss (`api/googleBooks.ts`, no series data).
- Duplicate detection matches in memory against `getBooks()`. Books added before this
  feature have no ISBN, so they won't be caught until rescanned.

## OpenTelemetry

Service name: `vs-book-app` (via `VS_BOOK_APP_SERVICE_NAME`).

Local OTel env vars: `.env.otel` -> OTLP HTTP collector at `localhost:4318`.
Production env vars live in `k8s/base/deployment.yaml` and point to the
in-cluster collector. Telemetry stays off unless `VS_BOOK_APP_SERVICE_NAME` or
`OTEL_SERVICE_NAME` is set.

`backend/src/otel-init.ts` uses the project-specific service name, an always-on
sampler, and temporarily removes ambient `OTEL_SDK_DISABLED`,
`OTEL_SERVICE_NAME`, and `OTEL_TRACES_SAMPLER` values during SDK startup. This
prevents agent runtime telemetry settings from changing app identity or
silently disabling telemetry.
