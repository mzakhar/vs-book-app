import { useState, FormEvent } from 'react';
import { createNote, updateNote } from '../api';
import type { Note } from '../types';

interface Props {
  bookId: number;
  existing?: Note;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

export default function NoteForm({ bookId, existing, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState(existing?.content ?? '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { setError('Note cannot be empty.'); return; }
    setSaving(true);
    setError('');
    try {
      const note = existing
        ? await updateNote(existing.id, content)
        : await createNote(bookId, content);
      onSave(note);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save note.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label className="form-label">Note</label>
        <textarea
          className="form-textarea"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your note here…"
          rows={5}
          autoFocus
        />
      </div>
      <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: '8px' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Note'}
        </button>
      </div>
    </form>
  );
}
