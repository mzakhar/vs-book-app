import axios from 'axios';
import type { Book, BookStats, Note, Series } from '../types';

const api = axios.create({ baseURL: '/api' });

// Books
export const getBooks = (q?: string) =>
  api.get<Book[]>('/books', { params: q ? { q } : {} }).then(r => r.data);
export const getBook = (id: number) =>
  api.get<Book>(`/books/${id}`).then(r => r.data);
export const createBook = (data: Partial<Book> & { series_name?: string }) =>
  api.post<Book>('/books', data).then(r => r.data);
export const updateBook = (id: number, data: Partial<Book> & { series_name?: string }) =>
  api.put<Book>(`/books/${id}`, data).then(r => r.data);
export const deleteBook = (id: number) =>
  api.delete(`/books/${id}`);
export const getStats = () =>
  api.get<BookStats>('/books/stats').then(r => r.data);

// Notes
export const getNotes = (bookId: number) =>
  api.get<Note[]>(`/notes/${bookId}`).then(r => r.data);
export const createNote = (bookId: number, content: string) =>
  api.post<Note>(`/notes/${bookId}`, { content }).then(r => r.data);
export const updateNote = (noteId: number, content: string) =>
  api.put<Note>(`/notes/${noteId}`, { content }).then(r => r.data);
export const deleteNote = (noteId: number) =>
  api.delete(`/notes/${noteId}`);

// Series
export const getSeries = () =>
  api.get<Series[]>('/series').then(r => r.data);
export const getSeriesById = (id: number) =>
  api.get<Series>(`/series/${id}`).then(r => r.data);
export const createSeries = (data: { name: string; total_books?: number }) =>
  api.post<Series>('/series', data).then(r => r.data);
export const updateSeries = (id: number, data: { name?: string; total_books?: number }) =>
  api.put<Series>(`/series/${id}`, data).then(r => r.data);
export const deleteSeries = (id: number) =>
  api.delete(`/series/${id}`);
