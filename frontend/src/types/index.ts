export type BookStatus = 'unread' | 'reading' | 'read' | 'wishlist';

export type FeedbackType = 'bug' | 'feature' | 'other';

export type UserRole = 'admin' | 'user';

export type MessageSourceType = 'book' | 'review' | 'wishlist' | 'text';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface ManagedUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: number;
  created_at: string;
}

export interface UserSummary {
  id: number;
  screen_name: string;
  avatar_url: string | null;
}

export interface MessageUser extends UserSummary {}

export interface FavoriteBook {
  id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
}

export interface UserProfile {
  id: number;
  username: string;
  screen_name: string | null;
  avatar_url: string | null;
  favorite_genres: string[];
  favorite_book: FavoriteBook | null;
}

export interface Book {
  id: number;
  title: string;
  author?: string;
  genre?: string;
  genres?: string | string[] | null;
  status: BookStatus;
  rating?: number;
  cover_url?: string;
  created_at: string;
  series_id?: number | null;
  series_position?: number | null;
  series_name?: string | null;
  page_count?: number | null;
  description?: string | null;
  is_favorite?: number;
}

export interface BookStats {
  total_books: number;
  unread: number;
  reading: number;
  read: number;
  avg_rating: number | null;
  total_notes: number;
  by_genre: { genre: string; count: number }[];
  by_rating: { rating: number; count: number }[];
  recent: Book[];
}

export interface Note {
  id: number;
  book_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface MessageThread {
  id: number;
  updated_at: string;
  other_user: MessageUser;
  last_body: string | null;
  last_message_at: string | null;
  unread_count: number;
  sent_count: number;
  draft_count: number;
}

export interface Message {
  id: number;
  thread_id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  source_type: MessageSourceType | null;
  source_book_id: number | null;
  source_note_id: number | null;
  source_snapshot: string | null;
  read_at: string | null;
  created_at: string;
  sender?: MessageUser;
  recipient?: MessageUser;
}

export interface MessageDraft {
  id: number;
  sender_id: number;
  recipient_id: number;
  thread_id: number | null;
  body: string;
  source_type: MessageSourceType | null;
  source_book_id: number | null;
  source_note_id: number | null;
  source_snapshot: string | null;
  created_at: string;
  updated_at: string;
  recipient?: MessageUser;
}

export interface MessageThreadDetail {
  thread: MessageThread;
  messages: Message[];
  drafts: MessageDraft[];
}

export interface MessagePayload {
  recipient_id: number;
  body: string;
  source_type?: MessageSourceType | null;
  source_book_id?: number | null;
  source_note_id?: number | null;
}

export interface SeriesBook {
  id: number;
  title: string;
  author: string | null;
  status: BookStatus;
  series_position: number | null;
  cover_url: string | null;
  rating: number | null;
}

export interface Series {
  id: number;
  name: string;
  total_books: number | null;
  created_at: string;
  book_count: number;
  read_count: number;
  books: SeriesBook[];
}

export function parseGenres(book: Book): string[] {
  const g = book.genres || book.genre || '';
  if (Array.isArray(g)) return g;
  return g.split(',').map(s => s.trim()).filter(Boolean);
}
