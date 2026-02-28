import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Trash2, BookOpen, Star } from 'lucide-react';
import { getBooks, deleteBook } from '../api';
import type { Book, BookStatus } from '../types';
import Modal from '../components/Modal';
import BookForm from '../components/BookForm';
import { useToast } from '../components/Toast';

const STATUS_LABEL: Record<BookStatus, string> = {
  unread: 'Unread',
  reading: 'Reading',
  read: 'Read',
};

function StatusBadge({ status }: { status: BookStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="star-rating">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} fill={i < rating ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

export default function BookList() {
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      setBooks(await getBooks(q));
    } catch {
      toast('error', 'Failed to load books.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleDelete = async (e: React.MouseEvent, book: Book) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    try {
      await deleteBook(book.id);
      setBooks(bs => bs.filter(b => b.id !== book.id));
      toast('success', 'Book deleted.');
    } catch {
      toast('error', 'Failed to delete book.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Library</h1>
          <p className="page-subtitle">{books.length} book{books.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Book
          </button>
        </div>
      </div>

      <div className="search-bar">
        <Search />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or author…"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={40} />
          <p>{search ? 'No books match your search.' : 'No books yet. Add your first book!'}</p>
          {!search && (
            <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Book
            </button>
          )}
        </div>
      ) : (
        <div className="book-grid">
          {books.map(book => (
            <Link key={book.id} to={`/books/${book.id}`} className="book-card">
              <div className="book-card__cover">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} />
                ) : (
                  <BookOpen size={32} />
                )}
              </div>
              <div className="book-card__body">
                <div className="book-card__title">{book.title}</div>
                {book.author && <div className="book-card__author">{book.author}</div>}
                <div className="book-card__meta">
                  <StatusBadge status={book.status} />
                  {book.genre && <span className="tag">{book.genre}</span>}
                </div>
                <StarRating rating={book.rating} />
              </div>
              <button
                className="book-card__delete btn btn--icon btn--ghost"
                onClick={e => handleDelete(e, book)}
                title="Delete book"
              >
                <Trash2 size={14} />
              </button>
            </Link>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Book" onClose={() => setShowAdd(false)} size="md">
          <BookForm
            onSave={book => {
              setBooks(bs => [book, ...bs]);
              setShowAdd(false);
              toast('success', 'Book added.');
            }}
            onCancel={() => setShowAdd(false)}
          />
        </Modal>
      )}
    </div>
  );
}
