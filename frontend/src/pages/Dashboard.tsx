import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStats } from '../api';
import type { BookStats } from '../types';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<BookStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: 160, marginBottom: 24 }} />
        <div className="stats-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const maxGenre = Math.max(...stats.by_genre.map(g => g.count), 1);
  const maxRating = Math.max(...stats.by_rating.map(r => r.count), 1);

  const allRatings = [1, 2, 3, 4, 5].map(r => {
    const found = stats.by_rating.find(b => b.rating === r);
    return { rating: r, count: found?.count ?? 0 };
  });

  return (
    <div className="page">
      <h1 style={{ marginBottom: '24px' }}>Dashboard</h1>

      <div className="stats-grid">
        <StatCard label="Total Books" value={stats.total_books} />
        <StatCard label="Unread" value={stats.unread} />
        <StatCard label="Reading" value={stats.reading} />
        <StatCard label="Read" value={stats.read} />
        <StatCard
          label="Avg Rating"
          value={stats.avg_rating != null ? `${stats.avg_rating} ★` : '—'}
        />
        <StatCard label="Notes" value={stats.total_notes} />
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <p className="chart-card__title">By Genre</p>
          {stats.by_genre.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>No data yet</p>
          ) : (
            stats.by_genre.map(g => (
              <div key={g.genre} className="bar-row">
                <span className="bar-row__label">{g.genre}</span>
                <div className="bar-row__track">
                  <div
                    className="bar-row__fill"
                    style={{ width: `${(g.count / maxGenre) * 100}%` }}
                  />
                </div>
                <span className="bar-row__count">{g.count}</span>
              </div>
            ))
          )}
        </div>

        <div className="chart-card">
          <p className="chart-card__title">By Rating</p>
          <div className="rating-bars">
            {allRatings.map(r => (
              <div key={r.rating} className="rating-bars__col">
                <div
                  className="rating-bars__bar"
                  style={{ height: `${(r.count / maxRating) * 80}px` }}
                />
                <span className="rating-bars__label">{r.rating}★</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>Recently Added</h2>
      {stats.recent.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-3)' }}>No books yet.</p>
      ) : (
        <div className="recent-list">
          {stats.recent.map(book => (
            <Link key={book.id} to={`/books/${book.id}`} className="recent-item">
              <div className="recent-item__info">
                <p className="recent-item__title">{book.title}</p>
                {book.author && <p className="recent-item__author">{book.author}</p>}
              </div>
              <span className={`status-badge status-badge--${book.status}`}>
                {book.status === 'unread' ? 'Unread' : book.status === 'reading' ? 'Reading' : 'Read'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
