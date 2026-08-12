import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, Loader, X } from 'lucide-react';
import { getBooks, createBook } from '../api';
import type { Book, BookStatus } from '../types';
import { normalizeIsbn } from '../lib/isbn';
import { lookupByIsbn } from '../api/openLibrary';
import type { OLAutoFill } from '../api/openLibrary';
import { lookupIsbnGoogleBooks } from '../api/googleBooks';
import BarcodeScanner from '../components/BarcodeScanner';
import Modal from '../components/Modal';
import BookForm from '../components/BookForm';
import { useToast } from '../components/Toast';

// Mirrors BookForm.tsx:9-14 — not exported from there, so kept in sync by hand.
const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
  { value: 'wishlist', label: 'Wishlist' },
];

type LookupState = 'looking-up' | 'resolved' | 'unresolved';
type SaveState = 'idle' | 'saving' | 'failed';

interface Row {
  ean: string;
  state: LookupState;
  data?: OLAutoFill;
  status: BookStatus;
  duplicateOf?: Book;
  include: boolean;
  saveState: SaveState;
  saveError?: string;
}

function toPayload(row: Row) {
  const d = row.data!;
  return {
    title: d.title.trim() || row.ean,
    author: d.author.trim() || undefined,
    genres: d.genre.split(',').map(g => g.trim()).filter(g => g !== ''),
    status: row.status,
    cover_url: d.cover_url.trim() || undefined,
    series_name: d.series_name.trim() || '',
    series_position: d.series_position !== '' ? Number(d.series_position) : undefined,
    page_count: d.page_count !== '' ? Number(d.page_count) : undefined,
    description: d.description.trim() || undefined,
    isbn: row.ean,
  };
}

export default function ScanPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [manualEan, setManualEan] = useState<string | null>(null);
  // Books already owned, keyed by isbn — checked against on scan and updated after every save.
  const bookByIsbnRef = useRef<Map<string, Book>>(new Map());

  useEffect(() => {
    getBooks().then(books => {
      // ponytail: in-memory dupe check against the full book list. Fine at personal-library
      // scale; add an idx_books_user_isbn index and a /api/books/by-isbn route if it ever gets slow.
      const map = new Map<string, Book>();
      for (const b of books) {
        if (b.isbn) map.set(b.isbn, b);
      }
      bookByIsbnRef.current = map;
    }).catch(() => {});
  }, []);

  const resolveRow = async (ean: string) => {
    let data = await lookupByIsbn(ean);
    if (!data) data = await lookupIsbnGoogleBooks(ean);
    setRows(prev => prev.map(r => r.ean === ean ? { ...r, state: data ? 'resolved' : 'unresolved', data: data ?? undefined } : r));
  };

  const handleScan = (raw: string) => {
    const ean = normalizeIsbn(raw);
    if (!ean) return;
    let added = false;
    setRows(prev => {
      if (prev.some(r => r.ean === ean)) return prev;
      added = true;
      const duplicateOf = bookByIsbnRef.current.get(ean);
      return [...prev, {
        ean,
        state: 'looking-up',
        status: 'unread',
        include: !duplicateOf,
        saveState: 'idle',
        duplicateOf,
      }];
    });
    if (added) resolveRow(ean);
  };

  const removeRow = (ean: string) => setRows(prev => prev.filter(r => r.ean !== ean));

  const setRowStatus = (ean: string, status: BookStatus) =>
    setRows(prev => prev.map(r => r.ean === ean ? { ...r, status } : r));

  const setRowInclude = (ean: string, include: boolean) =>
    setRows(prev => prev.map(r => r.ean === ean ? { ...r, include } : r));

  const resolvedIncludedCount = rows.filter(r => r.state === 'resolved' && r.include).length;

  const handleSaveAll = async () => {
    const toSave = rows.filter(r => r.state === 'resolved' && r.include);
    if (toSave.length === 0) return;
    setSavingAll(true);
    let savedCount = 0;
    // Sequential, not Promise.all — SQLite single writer, and findOrCreateSeries races on
    // concurrent inserts for the same series name.
    for (const row of toSave) {
      setRows(prev => prev.map(r => r.ean === row.ean ? { ...r, saveState: 'saving' } : r));
      try {
        const book = await createBook(toPayload(row));
        bookByIsbnRef.current.set(row.ean, book);
        savedCount++;
        setRows(prev => prev.filter(r => r.ean !== row.ean));
      } catch (err: any) {
        setRows(prev => prev.map(r => r.ean === row.ean
          ? { ...r, saveState: 'failed', saveError: err?.response?.data?.error || 'Save failed.' }
          : r));
      }
    }
    setSavingAll(false);
    if (savedCount > 0) toast('success', `Saved ${savedCount} book${savedCount !== 1 ? 's' : ''}.`);
  };

  const handleManualSave = (book: Book) => {
    if (book.isbn) bookByIsbnRef.current.set(book.isbn, book);
    if (manualEan) removeRow(manualEan);
    setManualEan(null);
    toast('success', 'Book added.');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Scan Books</h1>
          <p className="page-subtitle">{rows.length} in queue</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSaveAll}
            disabled={savingAll || resolvedIncludedCount === 0}
          >
            {savingAll ? 'Saving…' : `Save all (${resolvedIncludedCount})`}
          </button>
        </div>
      </div>

      <BarcodeScanner onScan={handleScan} />

      <div className="scan-queue">
        {rows.length === 0 && (
          <p className="scan-queue__empty">Scan a barcode, or enter an ISBN above, to add it to the queue.</p>
        )}
        {rows.map(row => (
          <div key={row.ean} className={`scan-row${row.duplicateOf ? ' scan-row--duplicate' : ''}`}>
            <div className="scan-row__cover">
              {row.data?.cover_url ? <img src={row.data.cover_url} alt="" /> : <BookOpen size={22} />}
            </div>
            <div className="scan-row__info">
              <div className="scan-row__title">{row.data?.title || row.ean}</div>
              {row.data?.author && <div className="scan-row__author">{row.data.author}</div>}
              <div className="scan-row__ean">{row.ean}</div>
              {row.state === 'looking-up' && (
                <span className="scan-row__note">
                  <Loader size={13} className="scan-row__spinner" /> Looking up…
                </span>
              )}
              {row.state === 'unresolved' && (
                <span className="scan-row__note scan-row__note--warn">No match found — fill in manually.</span>
              )}
              {row.duplicateOf && (
                <span className="scan-row__note scan-row__note--warn">
                  <AlertTriangle size={13} /> Already in your library —{' '}
                  <Link to={`/books/${row.duplicateOf.id}`}>view existing</Link>
                </span>
              )}
              {row.saveState === 'failed' && (
                <span className="scan-row__note scan-row__note--warn">{row.saveError}</span>
              )}
            </div>
            <div className="scan-row__actions">
              {row.state === 'resolved' && (
                <>
                  <label className="scan-row__include">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={e => setRowInclude(row.ean, e.target.checked)}
                    />
                    Save
                  </label>
                  <select
                    className="form-select"
                    value={row.status}
                    onChange={e => setRowStatus(row.ean, e.target.value as BookStatus)}
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </>
              )}
              {row.state === 'unresolved' && (
                <button type="button" className="btn btn--secondary" onClick={() => setManualEan(row.ean)}>
                  Fill manually
                </button>
              )}
              {row.saveState === 'saving' ? (
                <Loader size={16} className="scan-row__spinner" />
              ) : (
                <button
                  type="button"
                  className="btn btn--icon btn--ghost"
                  onClick={() => removeRow(row.ean)}
                  title="Remove from queue"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {manualEan && (
        <Modal title="Add Book" onClose={() => setManualEan(null)} size="md">
          <BookForm
            initialIsbn={manualEan}
            onSave={handleManualSave}
            onCancel={() => setManualEan(null)}
          />
        </Modal>
      )}
    </div>
  );
}
