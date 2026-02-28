# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

From the repo root:

```bash
npm run install:all   # install all deps (backend + frontend)
npm run dev           # start both backend (port 3000) and frontend (port 5173) concurrently
npm run dev:backend   # backend only
npm run dev:frontend  # frontend only
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

## Architecture

**Monorepo** with `backend/` and `frontend/` as independent npm workspaces; the root `package.json` only holds concurrency scripts.

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
| `/books/:id` | BookDetail |
| `/series` | SeriesPage |

### Theming

Three CSS themes (`dark`, `light`, `purple`) defined as CSS custom properties in `frontend/src/styles/_themes.scss`. Active theme stored in `localStorage` under key `book_app_theme` and applied via `data-theme` on `<html>`. All styling uses SASS with the theme variables; no CSS-in-JS.

### Database schema

- `series(id, name, total_books, created_at)`
- `books(id, title, author, genre, status, rating, cover_url, created_at, series_id, series_position, page_count, description)` — `status` is constrained to `'unread' | 'reading' | 'read'`
- `notes(id, book_id, content, created_at, updated_at)` — cascades delete from books

WAL mode and foreign keys are enabled on every connection.
