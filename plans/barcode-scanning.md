# Barcode scanning — add books by camera

## Decisions (locked)

| Question | Answer |
|---|---|
| Capture | Live camera scan, continuous decode |
| Flow | Bulk queue — scanner stays open, review + batch save at end |
| Metadata | Open Library first, Google Books fallback on 404 |
| Miss | Drop into `BookForm` prefilled with the ISBN |
| Duplicate | Warn in the queue, offer to open the existing book |

## Hard constraints

1. **HTTPS only.** `getUserMedia` requires a secure context. `http://192.168.1.3/books/` will
   never get camera access on iPad. The feature is usable only via
   `https://books.zakharhome.org/books/`. Nav entry should detect
   `!window.isSecureContext` and show why it's disabled rather than failing silently at tap.
2. **No `BarcodeDetector` on iOS Safari.** Chromium-only API. Requires a WASM decoder —
   `zxing-wasm`. This is the first new frontend dependency in the project. Dynamic-import it
   so it stays out of the main bundle.
3. **Books often carry two barcodes.** The EAN-13 (ISBN) plus a UPC-5 price add-on, and some
   have a separate UPC-A. Decoder must accept only EAN-13 with a `978`/`979` prefix and a
   valid checksum. Without that gate, the price barcode produces junk lookups.
4. **iPad Safari video quirks:** `<video>` needs `playsInline` + `muted` or it forces
   fullscreen playback. No torch/flash control available in Safari. Camera start needs a user
   gesture.
5. **Books are per-user** (`books.user_id`). Dedupe is per-user, never global.

## What already exists and gets reused

- `frontend/src/api/openLibrary.ts` — `fetchWorkDetails`, `fetchEditions`, `normalizeAutoFill`.
  The whole series-detection heuristic stays untouched.
- `frontend/src/components/BookForm.tsx` — the miss path opens this, unchanged except for one
  new optional prop.
- `POST /api/books` — batch save is just this in a loop from the client. No batch endpoint.
- `backend/src/database.ts` migrations array (`database.ts:132`) — the established pattern for
  adding a column.

**Key integration insight:** the existing OL pipeline is *work*-based
(`/works/OL…W` → editions → normalize). An ISBN lookup returns an *edition*. So the new lookup
is a thin adapter: ISBN → edition JSON → `works[0].key` → hand to the existing pipeline. No
duplication of the series logic.

## Files

### Backend (3 small edits)

| File | Change |
|---|---|
| `backend/src/database.ts:143` | Append `` `ALTER TABLE books ADD COLUMN isbn TEXT` `` to the migrations array |
| `backend/src/routes/books.ts:48,60` | Destructure `isbn` in POST, add to the INSERT column list + values |
| `backend/src/routes/books.ts` | Add `b.isbn` to `SELECT_BOOK`; accept `isbn` in PUT |

No new route. No index yet — see the ponytail note under Dedupe.

### Frontend

**`frontend/src/lib/isbn.ts`** — pure, no IO. The functional core of this feature.

```ts
export function isBookEan(raw: string): boolean      // EAN-13, 978/979 prefix, checksum valid
export function normalizeIsbn(raw: string): string | null  // ISBN-10 → 13, strip hyphens/spaces
export function ean13Checksum(digits: string): boolean
```

**`frontend/src/lib/isbn.check.ts`** — the one runnable check. Plain `assert` calls, no
framework. Run: `npx tsx frontend/src/lib/isbn.check.ts`. Cases: valid ISBN-13, bad checksum,
UPC price add-on rejected, `979` accepted, ISBN-10 with `X` check digit converts correctly.

**`frontend/src/api/openLibrary.ts`** — add:

```ts
export async function lookupByIsbn(isbn: string): Promise<OLAutoFill | null>
```
Fetches `https://openlibrary.org/isbn/{isbn}.json`, pulls `works[0].key`, then reuses
`fetchWorkDetails` + `fetchEditions` + `normalizeAutoFill`. Prefers the *edition's* own
`number_of_pages` and `covers[0]` over the work-level medians — the scanned edition is the one
in hand. Returns `null` on 404.

**`frontend/src/api/googleBooks.ts`** — new, ~40 lines. Hits
`https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}` (no API key needed for this),
maps `volumeInfo` → the same `OLAutoFill` shape. No series data — Google Books has none, so
those two fields come back empty and the user fills them in the review step.

**`frontend/src/components/BarcodeScanner.tsx`** — the imperative shell.
- `getUserMedia({ video: { facingMode: 'environment' } })`
- `requestAnimationFrame` loop, throttled to ~5 decodes/sec, draws to an offscreen canvas
- `await import('zxing-wasm')` on mount
- Filters every decode through `isBookEan`
- Debounces repeat hits of the same ISBN for 3s (the barcode stays in frame after a hit)
- Beep + flash on accept; `onScan(isbn)` callback
- Cleans up the `MediaStream` on unmount — a leaked camera light on the iPad is the bug
  everyone ships first

**`frontend/src/pages/ScanPage.tsx`** — bulk queue.
- Renders `<BarcodeScanner>` above a growing queue list
- Each hit: `lookupByIsbn` → on `null`, Google Books → on `null`, queue as `unresolved`
- Queue row shows cover, title, author, status dropdown, and a remove button
- Duplicate rows render a warning badge with a link to the existing book
- "Save all" posts each resolved row via the existing `createBook`, sequentially
- Unresolved rows get a "Fill manually" button that opens `BookForm` with `initialIsbn` set

**`frontend/src/components/BookForm.tsx`** — one new optional prop `initialIsbn?: string`,
seeded into form state, submitted as `isbn`. Nothing else changes.

**`frontend/src/App.tsx` + `Layout.tsx`** — route `/scan`, nav entry with a `ScanLine` icon
(already in `lucide-react`, no new dep). Hide or disable the entry when
`!window.isSecureContext`.

### Dedupe

`ScanPage` calls the existing `getBooks()` once on mount and matches ISBNs in memory.

```ts
// ponytail: in-memory dupe check against the full book list. Fine at personal-library
// scale; add an idx_books_user_isbn index and a /api/books/by-isbn route if it ever gets slow.
```

Existing books have no ISBN, so early scans of already-owned books won't be caught. Acceptable
— it backfills naturally as books are rescanned.

## Phases

1. **Pure core + schema** — `isbn.ts`, `isbn.check.ts`, the DB migration, backend passthrough,
   `Book.isbn` type. Verify: check script passes, `npm run build` clean in both workspaces,
   POST a book with an ISBN via curl and read it back.
2. **Lookup layer** — `lookupByIsbn`, `googleBooks.ts`. Verify: a scratch script resolving five
   real ISBNs off your shelf, including one deliberately obscure one to prove the fallback
   fires.
3. **Scanner component** — camera + decode, standalone, dumping results to the console.
   Verify on the actual iPad against `https://books.zakharhome.org/books/`. **This is the phase
   most likely to surprise us** — everything before it is testable on the desktop, this is not.
4. **ScanPage** — queue, dedupe, review, batch save.
5. **Wire-up** — route, nav, `BookForm` prop.

## Open risks

- `zxing-wasm` bundle size and whether Vite's WASM handling needs config for the k8s subpath
  deploy (`/books/` base). Worth a 10-minute spike in phase 3 before building the queue UI.
- Decode reliability on glossy covers under household lighting. If it's poor, the mitigation is
  a manual "enter ISBN" field in the scanner, not a better decoder.
- Open Library's `/isbn/` endpoint returns 302s to the edition key; `fetch` follows by default,
  but confirm the JSON shape matches what phase 2 expects.
