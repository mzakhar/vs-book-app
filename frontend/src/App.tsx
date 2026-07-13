import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BookList from './pages/BookList';
import BookDetail from './pages/BookDetail';
import SeriesPage from './pages/SeriesPage';
import Wishlist from './pages/Wishlist';
import UsersPage from './pages/UsersPage';
import ReadersPage from './pages/ReadersPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-page"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/books">
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="library" element={<BookList />} />
              <Route path="wishlist" element={<Wishlist />} />
              <Route path="books/:id" element={<BookDetail />} />
              <Route path="series" element={<SeriesPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="users" element={<ReadersPage />} />
              <Route path="users/:id" element={<ProfilePage />} />
              <Route path="admin/users" element={<UsersPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
