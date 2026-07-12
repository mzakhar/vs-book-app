# In-App Feedback → GitHub Issue

Date: 2026-07-12
Status: approved design

## Summary

Logged-in users file feedback (bug / feature / other + free text) from a floating
button available on every page. The backend stores the feedback in SQLite, then
synchronously creates a GitHub issue in `mzakhar/vs-book-app`. GitHub is a hard
dependency: if issue creation fails, the submit fails and the user retries.

Decisions made during design:

| Question | Decision |
|---|---|
| Audience | All logged-in users |
| Flow | DB row first, then relay to GitHub |
| Fields | Type (`bug`/`feature`/`other`) + required description; no auto context, no screenshots |
| Attribution | Screen name only in issue body; full identity stays in DB |
| GitHub failure | Fail the submit (502), user retries; failed rows kept as audit |
| UI entry | Floating button, bottom-right, all pages |
| Rate limiting | None for now (small trusted user base) |

## Data flow

1. User clicks floating feedback button → `Modal` opens with type select + description textarea.
2. Frontend `POST /api/feedback` `{ type, description }` — session cookie auth via existing middleware (`backend/src/middleware/auth.ts`).
3. Backend validates: description non-empty (trimmed), type in enum.
4. Insert row into `feedback` table with `status = 'pending'`.
5. Call GitHub `POST /repos/{GITHUB_REPO}/issues`:
   - `title`: `[Feedback] ` + first ~80 chars of description
   - `body`: full description + `\n\n_Reported by <screen_name> via in-app feedback_`
   - `labels`: `feedback` plus `bug` / `enhancement` (nothing extra for `other`)
6. Success → update row (`issue_number`, `issue_url`, `status = 'synced'`), return `201 { issueNumber, issueUrl }`. Toast: "Filed as issue #N".
7. GitHub failure → update row `status = 'failed'`, return `502`. Error toast; retry creates a new row.

Screen name resolved server-side: `COALESCE(screen_name, username)` from `users`
(same convention as `backend/src/routes/users.ts`).

## Backend

### Schema (via existing migrations array in `database.ts`)

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  issue_number INTEGER,
  issue_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Files

- `backend/src/github.ts` — pure `buildIssuePayload(feedback, screenName)` returning
  `{ title, body, labels }`, plus thin `createIssue(payload)` using built-in `fetch`
  (Node 18+, no new deps). Reads `GITHUB_TOKEN` / `GITHUB_REPO` at call time.
- `backend/src/routes/feedback.ts` — `POST /` only, wrapped in `asyncHandler`,
  behind auth middleware. Validation → insert → sync → update → respond.
- `backend/src/index.ts` — mount `/api/feedback`.

### Config

| Env var | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained PAT, Issues: read+write, scoped to `mzakhar/vs-book-app` only |
| `GITHUB_REPO` | `mzakhar/vs-book-app` |

Token missing at request time → `503 { error: 'Feedback is not configured' }`;
rest of app unaffected. Token never reaches the frontend.

### Errors

- `400` — empty description or bad type
- `401` — no session (existing middleware)
- `502` — GitHub call failed (network, 4xx/5xx from GitHub); row kept with `status='failed'`
- `503` — `GITHUB_TOKEN` / `GITHUB_REPO` unset

## Frontend

- `frontend/src/components/FeedbackButton.tsx` — floating action button, bottom-right,
  rendered once in `Layout.tsx` so it appears on every page. Opens `FeedbackModal`.
- `frontend/src/components/FeedbackModal.tsx` — existing `Modal` wrapper; type select
  (default `bug`), description textarea, submit disabled while empty/in-flight.
  Success: close + `Toast` "Filed as issue #N". Failure: inline error, form kept.
- `frontend/src/api/index.ts` — `submitFeedback(type, description)` on the existing
  axios instance.
- `frontend/src/types/index.ts` — `FeedbackType = 'bug' | 'feature' | 'other'`.
- Styling: SASS with existing theme variables (`_themes.scss`); FAB respects all
  three themes.

## Testing

No test infrastructure in repo. Verify manually:

1. Submit each type → issue appears in repo with correct labels + screen-name footer.
2. Empty description → 400, inline error.
3. Unset `GITHUB_TOKEN` → 503, error toast.
4. Bad token → 502, row `status='failed'` in DB, error toast.
5. Logged-out request to `POST /api/feedback` → 401.

`buildIssuePayload` is pure — if tests ever land, it's the first unit-test target.

## Out of scope (deliberate)

- Screenshots / image upload
- Auto-captured context (page URL, app version)
- Rate limiting
- Background retry of failed rows
- Admin UI over the feedback table (SQLite + GitHub issues suffice)
