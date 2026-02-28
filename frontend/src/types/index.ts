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
  series_id?: number | null;
  series_position?: number | null;
  series_name?: string | null;
  page_count?: number | null;
  description?: string | null;
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
