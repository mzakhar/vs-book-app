import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { getUserProfiles } from '../api';
import type { UserSummary } from '../types';
import { useToast } from '../components/Toast';

export default function ReadersPage() {
  const { toast } = useToast();
  const [readers, setReaders] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getUserProfiles()
      .then(setReaders)
      .catch(() => toast('error', 'Failed to load readers.'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Readers</h1>
          <p className="page-subtitle">{readers.length} reader{readers.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton skeleton--row" />
          ))}
        </div>
      ) : readers.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <p>No other readers yet.</p>
        </div>
      ) : (
        <div className="reader-grid">
          {readers.map(r => (
            <Link key={r.id} to={`/users/${r.id}`} className="reader-card">
              {r.avatar_url ? (
                <img className="avatar avatar--lg" src={r.avatar_url} alt="" />
              ) : (
                <span className="avatar avatar--lg avatar--fallback">{r.screen_name.charAt(0).toUpperCase()}</span>
              )}
              <span className="reader-card__name">{r.screen_name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
