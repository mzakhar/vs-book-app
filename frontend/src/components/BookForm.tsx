import { useState, FormEvent } from 'react';
import { createBook, updateBook } from '../api';
import type { Book, BookStatus } from '../types';

const STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
];

interface Props {
  existing?: Book;
  onSave: (book: Book) => void;
  onCancel: () => void;
}

export default function BookForm({ existing, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title:     existing?.title     ?? '',
    author:    existing?.author    ?? '',
    genre:     existing?.genre     ?? '',
    status:    existing?.status    ?? 'unread' as BookStatus,
    rating:    existing?.rating    ? String(existing.rating) : '',
    cover_url: existing?.cover_url ?? '',
  });

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<Book> = {
        title:     form.title.trim(),
        author:    form.author.trim() || undefined,
        genre:     form.genre.trim() || undefined,
        status:    form.status,
        rating:    form.rating ? Number(form.rating) : undefined,
        cover_url: form.cover_url.trim() || undefined,
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

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

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
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Cover URL</label>
          <input
            className="form-input"
            value={form.cover_url}
            onChange={e => set('cover_url', e.target.value)}
            placeholder="https://..."
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
