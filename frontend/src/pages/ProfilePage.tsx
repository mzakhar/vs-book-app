import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, MessageSquare, Pencil, UserX } from 'lucide-react';
import { getUserProfile } from '../api';
import type { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import ProfileEditModal from '../components/ProfileEditModal';
import ComposeMessageModal from '../components/ComposeMessageModal';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    getUserProfile(Number(id))
      .then(setProfile)
      .catch((err: any) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton skeleton--row" style={{ height: 140 }} />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="page">
        <div className="empty-state">
          <UserX size={40} />
          <p>This reader could not be found.</p>
        </div>
      </div>
    );
  }

  const displayName = profile.screen_name || profile.username;
  const isSelf = me?.id === profile.id;

  return (
    <div className="page">
      <div className="page-header">
        <div className="profile-header">
          {profile.avatar_url ? (
            <img className="avatar avatar--xl" src={profile.avatar_url} alt="" />
          ) : (
            <span className="avatar avatar--xl avatar--fallback">{displayName.charAt(0).toUpperCase()}</span>
          )}
          <div>
            <h1>{displayName}</h1>
          </div>
        </div>
        <div className="page-header__actions">
          {isSelf ? (
            <button className="btn btn--secondary" onClick={() => setShowEdit(true)}>
              <Pencil size={14} />
              Edit profile
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => setShowMessage(true)}>
              <MessageSquare size={14} />
              Message
            </button>
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Favorite genres</label>
        {profile.favorite_genres.length === 0 ? (
          <p className="page-subtitle">No favorite genres yet.</p>
        ) : (
          <div className="chip-picker">
            {profile.favorite_genres.map(g => (
              <span key={g} className="tag">{g}</span>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Favorite book</label>
        {profile.favorite_book ? (
          <Link to={`/books/${profile.favorite_book.id}`} className="book-card" style={{ maxWidth: 220 }}>
            <div className="book-card__cover">
              {profile.favorite_book.cover_url ? (
                <img src={profile.favorite_book.cover_url} alt={profile.favorite_book.title} />
              ) : (
                <BookOpen size={32} />
              )}
            </div>
            <div className="book-card__body">
              <div className="book-card__title">{profile.favorite_book.title}</div>
              {profile.favorite_book.author && <div className="book-card__author">{profile.favorite_book.author}</div>}
            </div>
          </Link>
        ) : (
          <p className="page-subtitle">No favorite book set.</p>
        )}
      </div>

      {showEdit && (
        <ProfileEditModal
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
      {showMessage && (
        <ComposeMessageModal
          initialRecipientId={profile.id}
          onClose={() => setShowMessage(false)}
          onSent={() => setShowMessage(false)}
          onDraftSaved={() => setShowMessage(false)}
        />
      )}
    </div>
  );
}
