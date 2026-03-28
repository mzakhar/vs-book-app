import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Trash2, BookOpen, Star, ArrowUpDown, Archive } from 'lucide-react';
import { getBooks, deleteBook, updateBook } from '../api';
import type { Book, BookStatus } from '../types';
import Modal from '../components/Modal';
import BookForm from '../components/BookForm';
import { useToast } from '../components/Toast';

type SortKey = 'date' | 'title' | 'author' | 'series' | 'genre';
type ViewMode = 'list' | 'gallery';

function sortBooks(books: Book[], sort: SortKey): Book[] {
  if (sort === 'date') return books;
  return [...books].sort((a, b) => {
    let av: string, bv: string;
    if (sort === 'title')  { av = a.title;             bv = b.title; }
    else if (sort === 'author') { av = a.author ?? '';      bv = b.author ?? ''; }
    else if (sort === 'series') { av = a.series_name ?? ''; bv = b.series_name ?? ''; }
    else                        { av = a.genre ?? '';        bv = b.genre ?? ''; }
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return av.localeCompare(bv);
  });
}

const STATUS_LABEL: Record<BookStatus, string> = {
  unread: 'Unread',
  reading: 'Reading',
  read: 'Read',
  wishlist: 'Wishlist',
};

function StatusBadge({ status }: { status: BookStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

export default function Wishlist() {
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [view, setView] = useState<ViewMode>('list');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      setBooks(await getBooks(q, 'wishlist'));
    } catch {
      toast('error', 'Failed to load wishlist.');
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
    if (!confirm(`Remove "${book.title}" from wishlist?`)) return;
    try {
      await deleteBook(book.id);
      setBooks(bs => bs.filter(b => b.id !== book.id));
      toast('success', 'Removed from wishlist.');
    } catch {
      toast('error', 'Failed to remove book.');
    }
  };

  const handleMoveToLibrary = async (e: React.MouseEvent, book: Book) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateBook(book.id, { status: 'unread' });
      setBooks(bs => bs.filter(b => b.id !== book.id));
      toast('success', 'Moved to library.');
    } catch {
      toast('error', 'Failed to move book.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Wishlist</h1>
          <p className="page-subtitle">{books.length} book{books.length !== 1 ? 's' : ''} I want to read</p>
        </div>
        <div className="page-header__actions">
          <div className="view-toggle">
            <button
              className={`view-toggle__btn${view === 'list' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => setView('list')}
            >☰ List</button>
            <button
              className={`view-toggle__btn${view === 'gallery' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => setView('gallery')}
            >⊞ Gallery</button>
          </div>
          <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add to Wishlist
          </button>
        </div>
      </div>

      <div className="library-controls">
        <div className="search-bar">
          <Search />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search wishlist…"
          />
        </div>
        <div className="sort-control">
          <ArrowUpDown size={14} className="sort-control__icon" />
          <select
            className="form-select sort-control__select"
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
          >
            <option value="date">Date Added</option>
            <option value="title">Title A–Z</option>
            <option value="author">Author A–Z</option>
            <option value="series">Series A–Z</option>
            <option value="genre">Genre A–Z</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <Star size={40} />
          <p>{search ? 'No books match your search.' : 'Your wishlist is empty.'}</p>
          {!search && (
            <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add to Wishlist
            </button>
          )}
        </div>
      ) : view === 'gallery' ? (
        <div className="book-gallery">
          {sortBooks(books, sort).map(book => (
            <div key={book.id} className="book-gallery__item book-gallery__item--wishlist">
               <Link to={`/books/${book.id}`} className="book-gallery__cover-link">
                <div className="book-gallery__cover-wrap">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="book-gallery__cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).src = '/placeholder-cover.png'; }}
                    />
                  ) : (
                    <div className="book-gallery__placeholder">
                      <BookOpen size={28} />
                      <span>{book.title}</span>
                    </div>
                  )}
                </div>
              </Link>
              <div className="book-gallery__title">{book.title}</div>
              <div className="book-gallery__actions">
                 <button 
                  className="btn btn--icon btn--ghost" 
                  onClick={e => handleMoveToLibrary(e, book)}
                  title="Move to Library"
                >
                  <Archive size={14} />
                </button>
                <button 
                  className="btn btn--icon btn--ghost" 
                  onClick={e => handleDelete(e, book)}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="book-grid">
          {sortBooks(books, sort).map(book => (
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
                  {(book.genres || book.genre)?.split(',').map(g => g.trim()).filter(Boolean).map(g => (
                    <span key={g} className="tag">{g}</span>
                  ))}
                </div>
              </div>
              <div className="book-card__actions" style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn--icon btn--ghost"
                  onClick={e => handleMoveToLibrary(e, book)}
                  title="Move to Library"
                >
                  <Archive size={14} />
                </button>
                <button
                  className="btn btn--icon btn--ghost"
                  onClick={e => handleDelete(e, book)}
                  title="Remove from wishlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add to Wishlist" onClose={() => setShowAdd(false)} size="md">
          <BookForm
            existing={({ status: 'wishlist' } as any)}
            onSave={book => {
              if (book.status === 'wishlist') {
                setBooks(bs => [book, ...bs]);
              }
              setShowAdd(false);
              toast('success', book.status === 'wishlist' ? 'Added to wishlist.' : 'Added to library.');
            }}
            onCancel={() => setShowAdd(false)}
          />
        </Modal>
      )}
    </div>
  );
}
