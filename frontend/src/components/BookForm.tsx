import { useState, FormEvent } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { createBook, updateBook } from '../api';
import type { Book, BookStatus } from '../types';

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
    title:     existing?.title     ?? '',
    author:    existing?.author    ?? '',
    genre:     existing?.genre     ?? '',
    status:    existing?.status    ?? 'unread' as BookStatus,
    rating:    existing?.rating    ? String(existing.rating) : '',
    cover_url: existing?.cover_url ?? '',
  });

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

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

  const hasCover = form.cover_url.trim() !== '';

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste}>
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
