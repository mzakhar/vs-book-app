export type BookStatus = 'unread' | 'reading' | 'read';

export interface Book {
  id: number;
  title: string;
  author?: string;
  genre?: string;
  status: BookStatus;
  rating?: number;
  cover_url?: string;
  created_at: string;
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
