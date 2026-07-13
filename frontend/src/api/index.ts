import axios from 'axios';
import type {
  AuthUser,
  Book,
  BookStats,
  FeedbackType,
  ManagedUser,
  Message,
  MessageDraft,
  MessagePayload,
  MessageThread,
  MessageThreadDetail,
  Note,
  Series,
  UserRole,
  UserProfile,
  UserSummary,
} from '../types';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api' });

// 401 handling: AuthContext registers a callback on mount so this module
// never has to import context code (would create a circular import).
let onUnauthorized: (() => void) | null = null;
export const registerUnauthorizedHandler = (cb: (() => void) | null) => {
  onUnauthorized = cb;
};
// Guards against React 18 Strict Mode double-mount: unregister only clears
// the handler it registered, so a stale cleanup can't clobber a newer one.
export const unregisterUnauthorizedHandler = (cb: () => void) => {
  if (onUnauthorized === cb) onUnauthorized = null;
};

api.interceptors.response.use(
  r => r,
  err => {
    const url: string = err?.config?.url || '';
    if (err?.response?.status === 401 && !url.startsWith('/auth/')) {
      onUnauthorized?.();
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (username: string, password: string) =>
  api.post<AuthUser>('/auth/login', { username, password }).then(r => r.data);
export const logout = () =>
  api.post('/auth/logout');
export const getMe = () =>
  api.get<AuthUser>('/auth/me').then(r => r.data);

// Users (admin)
export const getUsers = () =>
  api.get<ManagedUser[]>('/users/admin').then(r => r.data);
export const createUser = (data: { username: string; password: string; role?: UserRole }) =>
  api.post<ManagedUser>('/users', data).then(r => r.data);
export const updateUser = (id: number, data: Partial<{ password: string; is_active: number; role: UserRole }>) =>
  api.put<ManagedUser>(`/users/${id}`, data).then(r => r.data);
export const deleteUser = (id: number) =>
  api.delete(`/users/${id}`);

// Profiles
export const getUserProfiles = () =>
  api.get<UserSummary[]>('/users').then(r => r.data);
export const getUserProfile = (id: number) =>
  api.get<UserProfile>(`/users/${id}/profile`).then(r => r.data);
export const getMyProfile = () =>
  api.get<UserProfile>('/users/me/profile').then(r => r.data);
export const updateMyProfile = (data: { screen_name: string | null; avatar_url: string | null; favorite_genres: string[]; favorite_book_id: number | null }) =>
  api.put<UserProfile>('/users/me/profile', data).then(r => r.data);

// Books
export const getBooks = (q?: string, status?: string) =>
  api.get<Book[]>('/books', { params: { q, status } }).then(r => r.data);
export const getBook = (id: number) =>
  api.get<Book>(`/books/${id}`).then(r => r.data);
export const createBook = (data: Partial<Book> & { series_name?: string }) =>
  api.post<Book>('/books', data).then(r => r.data);
export const updateBook = (id: number, data: Partial<Book> & { series_name?: string }) =>
  api.put<Book>(`/books/${id}`, data).then(r => r.data);
export const deleteBook = (id: number) =>
  api.delete(`/books/${id}`);
export const toggleFavorite = (id: number, is_favorite: number) =>
  api.patch<Book>(`/books/${id}/favorite`, { is_favorite }).then(r => r.data);
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

// Feedback
export const submitFeedback = (type: FeedbackType, description: string) =>
  api.post<{ issueNumber: number; issueUrl: string }>('/feedback', { type, description }).then(r => r.data);

// Messages
export const getMessageThreads = () =>
  api.get<MessageThread[]>('/messages/threads').then(r => r.data);
export const getMessageThread = (id: number) =>
  api.get<MessageThreadDetail>(`/messages/threads/${id}`).then(r => r.data);
export const sendMessage = (data: MessagePayload) =>
  api.post<Message>('/messages', data).then(r => r.data);
export const getMessageDrafts = () =>
  api.get<MessageDraft[]>('/messages/drafts').then(r => r.data);
export const createMessageDraft = (data: MessagePayload) =>
  api.post<MessageDraft>('/messages/drafts', data).then(r => r.data);
export const updateMessageDraft = (id: number, data: MessagePayload) =>
  api.put<MessageDraft>(`/messages/drafts/${id}`, data).then(r => r.data);
export const deleteMessageDraft = (id: number) =>
  api.delete(`/messages/drafts/${id}`);
export const sendMessageDraft = (id: number) =>
  api.post<Message>(`/messages/drafts/${id}/send`).then(r => r.data);
export const markMessageRead = (id: number) =>
  api.post<Message>(`/messages/${id}/read`).then(r => r.data);
