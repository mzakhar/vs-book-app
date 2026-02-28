import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Star, BookOpen } from 'lucide-react';
import { getBook, getNotes, deleteBook, deleteNote } from '../api';
import type { Book, Note } from '../types';
import Modal from '../components/Modal';
import BookForm from '../components/BookForm';
import NoteForm from '../components/NoteForm';
import { useToast } from '../components/Toast';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="star-rating star-rating--lg">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={16} fill={i < rating ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

type BookStatus = 'unread' | 'reading' | 'read';
const STATUS_LABEL: Record<BookStatus, string> = {
  unread: 'Unread', reading: 'Reading', read: 'Read',
};

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const bookId = Number(id);

  const [book, setBook] = useState<Book | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'edit' | 'add-note' | 'edit-note' | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [b, n] = await Promise.all([getBook(bookId), getNotes(bookId)]);
      setBook(b);
      setNotes(n);
    } catch {
      toast('error', 'Failed to load book.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [bookId, navigate, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDeleteBook = async () => {
    if (!confirm(`Delete "${book?.title}"? All notes will be removed.`)) return;
    try {
      await deleteBook(bookId);
      navigate('/');
    } catch {
      toast('error', 'Failed to delete book.');
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNote(note.id);
      setNotes(ns => ns.filter(n => n.id !== note.id));
      toast('success', 'Note deleted.');
    } catch {
      toast('error', 'Failed to delete note.');
    }
  };

  const closeModal = () => { setModal(null); setEditingNote(null); };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 20, width: 140, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 32, width: 300, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 18, width: 180, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 96, borderRadius: 12 }} />
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className="page">
      <Link to="/" className="btn btn--ghost btn--sm" style={{ marginBottom: '16px' }}>
        <ArrowLeft size={14} /> Back to Library
      </Link>

      {/* Book header */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', alignItems: 'flex-start' }}>
        {book.cover_url && (
          <img
            src={book.cover_url}
            alt={book.title}
            className="book-detail__cover"
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '8px' }}>
            <div>
              <h1>{book.title}</h1>
              {book.author && (
                <p style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '8px' }}>{book.author}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setModal('edit')}>
                <Pencil size={13} /> Edit
              </button>
              <button className="btn btn--danger btn--sm" onClick={handleDeleteBook}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
            <span className={`status-badge status-badge--${book.status}`}>
              {STATUS_LABEL[book.status]}
            </span>
            {book.genre && <span className="tag">{book.genre}</span>}
            <StarRating rating={book.rating} />
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
            Added {fmtDate(book.created_at)}
          </p>
        </div>
      </div>

      {/* Notes section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1rem' }}>Notes ({notes.length})</h2>
        <button className="btn btn--primary btn--sm" onClick={() => setModal('add-note')}>
          <Plus size={13} /> Add Note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={36} />
          <p>No notes yet. Start writing!</p>
          <button className="btn btn--primary" onClick={() => setModal('add-note')}>
            <Plus size={14} /> Add Note
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notes.map(note => (
            <div key={note.id} className="note-card">
              <div className="note-card__header">
                <span className="note-card__date">{fmtDateTime(note.created_at)}</span>
                {note.updated_at !== note.created_at && (
                  <span className="note-card__edited">edited {fmtDateTime(note.updated_at)}</span>
                )}
                <div className="note-card__actions">
                  <button
                    className="btn btn--icon btn--ghost"
                    onClick={() => { setEditingNote(note); setModal('edit-note'); }}
                    title="Edit note"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="btn btn--icon btn--ghost"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => handleDeleteNote(note)}
                    title="Delete note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="note-card__content">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {modal === 'edit' && (
        <Modal title="Edit Book" onClose={closeModal} size="md">
          <BookForm
            existing={book}
            onSave={updated => { setBook(updated); closeModal(); toast('success', 'Book updated.'); }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {(modal === 'add-note' || modal === 'edit-note') && (
        <Modal title={editingNote ? 'Edit Note' : 'Add Note'} onClose={closeModal} size="md">
          <NoteForm
            bookId={bookId}
            existing={editingNote ?? undefined}
            onSave={note => {
              if (editingNote) {
                setNotes(ns => ns.map(n => n.id === note.id ? note : n));
                toast('success', 'Note updated.');
              } else {
                setNotes(ns => [note, ...ns]);
                toast('success', 'Note added.');
              }
              closeModal();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}
