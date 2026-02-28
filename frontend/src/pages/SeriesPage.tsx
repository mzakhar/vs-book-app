import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, BookMarked } from 'lucide-react';
import { getSeries } from '../api';
import type { Series } from '../types';

export default function SeriesPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    getSeries()
      .then(data => { setSeriesList(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 24 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton skeleton--row" style={{ marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Series</h1>
      </div>

      {seriesList.length === 0 ? (
        <div className="empty-state">
          <BookMarked size={36} />
          <p>No series yet. Add a book with a series name to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {seriesList.map(series => {
            const isOpen = expanded.has(series.id);
            const total = series.total_books ?? series.book_count;
            const pct = total > 0 ? Math.round((series.read_count / total) * 100) : 0;

            return (
              <div key={series.id} className="series-card">
                <button
                  className="series-card__header"
                  onClick={() => toggle(series.id)}
                >
                  <span className="series-card__chevron">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="series-card__name">{series.name}</span>
                  <div className="series-card__progress">
                    <div className="series-card__bar-track">
                      <div
                        className="series-card__bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="series-card__count">
                      {series.read_count} / {total} read
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="series-card__books">
                    {series.books.length === 0 ? (
                      <p style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-3)' }}>
                        No books in this series yet.
                      </p>
                    ) : (
                      series.books.map(book => (
                        <Link
                          key={book.id}
                          to={`/books/${book.id}`}
                          className="series-book"
                        >
                          {book.cover_url ? (
                            <img src={book.cover_url} alt="" className="series-book__cover" />
                          ) : (
                            <div className="series-book__cover series-book__cover--empty" />
                          )}
                          <div className="series-book__info">
                            {book.series_position != null && (
                              <span className="series-book__pos">#{book.series_position}</span>
                            )}
                            <span className="series-book__title">{book.title}</span>
                          </div>
                          <span className={`status-badge status-badge--${book.status}`}>
                            {book.status === 'unread' ? 'Unread' : book.status === 'reading' ? 'Reading' : 'Read'}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
