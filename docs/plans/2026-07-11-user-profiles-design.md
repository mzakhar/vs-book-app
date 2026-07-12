# User Profiles — Design

**Date:** 2026-07-11
**Builds on:** user accounts (PR #17 — `users` table, session auth, per-user libraries)

## Scope

Each user gets a public profile: screen name, favorite genres, current favorite
book, profile picture. Visible to all logged-in users; editable only by the
owner.

Out of scope (YAGNI): bios, reading stats on public profiles, visibility of
other users' libraries, admin profile moderation, avatar cropping UI.

## Data model

New columns on `users` via the existing migrations array in
`backend/src/database.ts`:

```sql
ALTER TABLE users ADD COLUMN screen_name      TEXT
ALTER TABLE users ADD COLUMN avatar_url       TEXT      -- data URL
ALTER TABLE users ADD COLUMN favorite_genres  TEXT      -- JSON array
ALTER TABLE users ADD COLUMN favorite_book_id INTEGER REFERENCES books(id) ON DELETE SET NULL
```

- `screen_name` optional; display falls back to `username`. Not unique —
  username already carries uniqueness.
- `favorite_genres` stored as JSON text. Small list, never queried per-genre;
  a join table is overkill.
- `favorite_book_id` FK with `ON DELETE SET NULL` — deleting the book clears
  the favorite. Backend validates the picked book belongs to the caller.
- Avatar stored as data URL, same pattern as book covers. Client downscales
  to 256×256 (canvas, JPEG) before save; backend rejects payloads > 500KB.

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/users/me/profile` | self | Own profile for the edit form |
| `PUT /api/users/me/profile` | self | Update screen name, genres, avatar, favorite book |
| `GET /api/users` | any logged-in | Directory: id, screen name, avatar. Existing admin variant keeps full fields; non-admin callers get public fields only |
| `GET /api/users/:id/profile` | any logged-in | Public profile; joins `books` for favorite book (id, title, author, cover_url) |

Public payloads never include `password_hash`, `role`, or `is_active`.
Backend serializes `favorite_genres` to a real array at the API edge.

### Validation (`PUT /api/users/me/profile`)

- `screen_name`: trim, max 40 chars; empty string stored as NULL
- `avatar_url`: must start `data:image/`, reject > 500KB (bump body limit on
  this route only if the Express default blocks it)
- `favorite_genres`: array of strings, trimmed, deduped, max 10
- `favorite_book_id`: must exist and be owned by the caller, else 400

## Frontend

Types (`frontend/src/types/index.ts`):

```ts
UserProfile = { id, username, screen_name, avatar_url,
                favorite_genres: string[],
                favorite_book: { id, title, author, cover_url } | null }
UserSummary = { id, screen_name, avatar_url }
```

Routes (inside `Layout`):

| Path | Page |
|---|---|
| `/users` | ReadersPage — grid of avatar + screen-name cards |
| `/users/:id` | ProfilePage — avatar, screen name, genre chips, favorite book card; Edit button on own profile |

Edit form is a modal (existing `Modal`, BookForm patterns):

- Screen name text input
- Genre multi-select — chips built from distinct genres in the user's own
  library, unioned with currently-saved genres so a saved genre whose books
  were deleted doesn't silently disappear
- Favorite book — searchable select over own books with cover thumbnails
- Avatar — clipboard paste zone (same handler pattern as BookForm cover
  paste), canvas downscale, preview + remove

Layout header: avatar (or initial-letter fallback circle) + screen name on the
right with a dropdown (Edit profile, Logout); "Readers" nav link alongside
Library/Series.

API client (`frontend/src/api/index.ts`): `getMyProfile`, `updateMyProfile`,
`getUsers`, `getUserProfile(id)`.

Styling: SASS with existing theme variables; all three themes (dark, light,
purple) covered.

## Edge cases

- Favorite book deleted → FK sets NULL; profile renders without the card
- No avatar → initial-letter circle, theme-colored
- Deactivated users (`is_active = 0`) excluded from the directory; direct
  profile fetch 404s
- Pre-migration users: all new columns NULL; every surface has a fallback

## Testing

Repo has no test suite; keeping that. Route-handler validation stays small —
extract pure validators if it grows.
