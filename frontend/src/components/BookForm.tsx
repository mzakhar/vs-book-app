import { useState, FormEvent, useRef, useEffect } from 'react';
import { ImageIcon, X, Search, Loader } from 'lucide-react';
import { createBook, updateBook } from '../api';
import type { Book, BookStatus } from '../types';
import { searchOpenLibrary, fetchWorkDetails, normalizeAutoFill } from '../api/openLibrary';
import type { OLSearchResult } from '../api/openLibrary';

const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
];

function compressImage(file: File): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 300, MAX_H = 420;
      const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.naturalWidth  * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  });
}

interface Props {
  existing?: Book;
  onSave: (book: Book) => void;
  onCancel: () => void;
}

export default function BookForm({ existing, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title:           existing?.title           ?? '',
    author:          existing?.author          ?? '',
    genre:           existing?.genre           ?? '',
    status:          existing?.status          ?? 'unread' as BookStatus,
    rating:          existing?.rating          ? String(existing.rating) : '',
    cover_url:       existing?.cover_url       ?? '',
    series_name:     existing?.series_name     ?? '',
    series_position: existing?.series_position != null ? String(existing.series_position) : '',
    page_count:      existing?.page_count      != null ? String(existing.page_count) : '',
    description:     existing?.description     ?? '',
  });

  // OL search state
  const [olQuery, setOlQuery] = useState('');
  const [olResults, setOlResults] = useState<OLSearchResult[]>([]);
  const [olLoading, setOlLoading] = useState(false);
  const [olDropdownOpen, setOlDropdownOpen] = useState(false);
  const olSearchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (olSearchRef.current && !olSearchRef.current.contains(e.target as Node)) {
        setOlDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOlQueryChange = (value: string) => {
    setOlQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setOlResults([]);
      setOlDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setOlLoading(true);
      try {
        const results = await searchOpenLibrary(value);
        setOlResults(results);
        setOlDropdownOpen(results.length > 0);
      } catch {
        setOlResults([]);
      } finally {
        setOlLoading(false);
      }
    }, 400);
  };

  const handleOlSelect = async (result: OLSearchResult) => {
    setOlDropdownOpen(false);
    setOlLoading(true);
    try {
      let workDetails: any = null;
      if (result.key) {
        workDetails = await fetchWorkDetails(result.key);
      }
      const filled = normalizeAutoFill(result, workDetails);
      setForm(f => ({
        ...f,
        title:           filled.title     || f.title,
        author:          filled.author    || f.author,
        cover_url:       filled.cover_url || f.cover_url,
        page_count:      filled.page_count     !== '' ? filled.page_count     : f.page_count,
        description:     filled.description    !== '' ? filled.description    : f.description,
        series_name:     filled.series_name    !== '' ? filled.series_name    : f.series_name,
        series_position: filled.series_position !== '' ? filled.series_position : f.series_position,
      }));
    } catch {
      // best effort
    } finally {
      setOlLoading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLFormElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const dataUrl = await compressImage(file);
        set('cover_url', dataUrl);
        return;
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:           form.title.trim(),
        author:          form.author.trim() || undefined,
        genre:           form.genre.trim() || undefined,
        status:          form.status,
        rating:          form.rating ? Number(form.rating) : undefined,
        cover_url:       form.cover_url.trim() || undefined,
        series_name:     form.series_name.trim() || '',
        series_position: form.series_position !== '' ? Number(form.series_position) : undefined,
        page_count:      form.page_count !== '' ? Number(form.page_count) : undefined,
        description:     form.description.trim() || undefined,
      };
      const book = existing
        ? await updateBook(existing.id, payload)
        : await createBook(payload);
      onSave(book);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save book.');
      setSaving(false);
    }
  };

  const hasCover = form.cover_url.trim() !== '';

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste}>
      {error && <p className="form-error">{error}</p>}

      {/* OL Search */}
      <div className="ol-search" ref={olSearchRef} style={{ marginBottom: '16px' }}>
        <div className="ol-search__input-row">
          <Search size={14} className="ol-search__icon" />
          <input
            className="form-input ol-search__input"
            value={olQuery}
            onChange={e => handleOlQueryChange(e.target.value)}
            placeholder="Search OpenLibrary to auto-fill…"
          />
          {olLoading && <Loader size={14} className="ol-search__spinner" />}
        </div>
        {olDropdownOpen && olResults.length > 0 && (
          <div className="ol-dropdown">
            {olResults.map(r => (
              <button
                key={r.key}
                type="button"
                className="ol-result"
                onClick={() => handleOlSelect(r)}
              >
                {r.cover_i ? (
                  <img
                    src={`https://covers.openlibrary.org/b/id/${r.cover_i}-S.jpg`}
                    alt=""
                    className="ol-result__cover"
                  />
                ) : (
                  <div className="ol-result__cover ol-result__cover--empty">
                    <ImageIcon size={12} />
                  </div>
                )}
                <div className="ol-result__info">
                  <span className="ol-result__title">{r.title}</span>
                  {r.author_name?.[0] && (
                    <span className="ol-result__author">{r.author_name[0]}</span>
                  )}
                  {r.series?.[0] && (
                    <span className="ol-result__series">{r.series[0]}{r.series_number?.[0] ? ` #${r.series_number[0]}` : ''}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="form-grid">
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Title *</label>
          <input
            className="form-input"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Book title"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Author</label>
          <input
            className="form-input"
            value={form.author}
            onChange={e => set('author', e.target.value)}
            placeholder="Author name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Genre</label>
          <input
            className="form-input"
            value={form.genre}
            onChange={e => set('genre', e.target.value)}
            placeholder="e.g. Fiction, Mystery"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Rating (1–5)</label>
          <select className="form-select" value={form.rating} onChange={e => set('rating', e.target.value)}>
            <option value="">No rating</option>
            {[1,2,3,4,5].map(n => (
              <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        {/* Cover picker */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Cover Image</label>
          <div className="cover-picker">
            <div className="cover-picker__zone">
              {hasCover ? (
                <>
                  <img
                    className="cover-picker__img"
                    src={form.cover_url}
                    alt="Cover preview"
                    onError={() => set('cover_url', '')}
                  />
                  <button
                    type="button"
                    className="cover-picker__clear"
                    onClick={() => set('cover_url', '')}
                    title="Remove cover"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <div className="cover-picker__placeholder">
                  <ImageIcon size={28} />
                  <span>Ctrl+V to paste image</span>
                </div>
              )}
            </div>
            <input
              className="form-input cover-picker__url"
              value={hasCover && form.cover_url.startsWith('data:') ? '' : form.cover_url}
              onChange={e => set('cover_url', e.target.value)}
              placeholder="…or paste / type an image URL"
            />
          </div>
        </div>

        {/* Series fields */}
        <div className="form-group">
          <label className="form-label">Series Name</label>
          <input
            className="form-input"
            value={form.series_name}
            onChange={e => set('series_name', e.target.value)}
            placeholder="e.g. Dune, The Witcher"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Position in Series</label>
          <input
            className="form-input"
            type="number"
            step="0.5"
            min="0"
            value={form.series_position}
            onChange={e => set('series_position', e.target.value)}
            placeholder="e.g. 1, 1.5"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Page Count</label>
          <input
            className="form-input"
            type="number"
            min="1"
            value={form.page_count}
            onChange={e => set('page_count', e.target.value)}
            placeholder="e.g. 412"
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Brief description or synopsis"
            rows={3}
          />
        </div>
      </div>

      <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: '8px' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Book'}
        </button>
      </div>
    </form>
  );
}
