import { useEffect, useState } from 'react';
import { getMyProfile, updateMyProfile, getBooks } from '../api';
import { parseGenres } from '../types';
import type { Book } from '../types';
import Modal from './Modal';
import ImagePicker from './ImagePicker';
import { useToast } from './Toast';

const MAX_GENRES = 10;

function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.onload = () => {
      const MAX_W = 256, MAX_H = 256;
      const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  });
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileEditModal({ onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [screenName, setScreenName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [genreChoices, setGenreChoices] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [favoriteBookId, setFavoriteBookId] = useState<number | ''>('');

  useEffect(() => {
    Promise.all([getMyProfile(), getBooks()])
      .then(([profile, myBooks]) => {
        setScreenName(profile.screen_name || '');
        setAvatarUrl(profile.avatar_url || '');
        setSelectedGenres(profile.favorite_genres || []);
        setFavoriteBookId(profile.favorite_book?.id ?? '');
        setBooks(myBooks);
        const fromBooks = myBooks.flatMap(b => parseGenres(b));
        const union = Array.from(new Set([...fromBooks, ...(profile.favorite_genres || [])])).sort();
        setGenreChoices(union);
      })
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleGenre = (g: string) => {
    setSelectedGenres(list => {
      if (list.includes(g)) return list.filter(x => x !== g);
      if (list.length >= MAX_GENRES) return list;
      return [...list, g];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateMyProfile({
        screen_name: screenName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        favorite_genres: selectedGenres,
        favorite_book_id: favoriteBookId === '' ? null : Number(favoriteBookId),
      });
      toast('success', 'Profile updated.');
      onSaved();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update profile.';
      setError(msg);
      toast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit profile"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="skeleton skeleton--row" />
      ) : (
        <div>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label className="form-label">Screen name</label>
            <input
              className="form-input"
              value={screenName}
              onChange={e => setScreenName(e.target.value.slice(0, 40))}
              placeholder="Shown to other readers"
              maxLength={40}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Avatar</label>
            <ImagePicker
              value={avatarUrl}
              onChange={setAvatarUrl}
              compress={compressAvatar}
              variant="avatar"
              alt="Avatar preview"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Favorite genres</label>
            <div className="chip-picker">
              {genreChoices.length === 0 && <span className="page-subtitle">Add genres to your books to pick favorites.</span>}
              {genreChoices.map(g => (
                <button
                  type="button"
                  key={g}
                  className={`chip-picker__chip${selectedGenres.includes(g) ? ' chip-picker__chip--active' : ''}`}
                  onClick={() => toggleGenre(g)}
                  disabled={!selectedGenres.includes(g) && selectedGenres.length >= MAX_GENRES}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Favorite book</label>
            <select
              className="form-select"
              value={favoriteBookId}
              onChange={e => setFavoriteBookId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">None</option>
              {books.map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}
