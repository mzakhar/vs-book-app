import { useState } from 'react';
import { useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// BASE_URL is '/books/', so this resolves to the path Traefik strips before the
// request reaches Express. Full navigation, not fetch — Google's 302 needs the browser.
const GOOGLE_LOGIN_URL = `${import.meta.env.BASE_URL}api/auth/login`;

const ERROR_COPY: Record<string, string> = {
  not_authorized: "That Google account isn't on the list. Ask an admin to add it.",
  denied: 'Sign-in was cancelled.',
  state: 'Sign-in took too long. Try again.',
  exchange: "Couldn't reach Google. Try again.",
  token: "Google's response was rejected. Try again.",
};

export default function LoginPage() {
  const { user, loading, devLogin } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [devError, setDevError] = useState('');

  if (!loading && user) {
    const from = (location.state as { from?: { pathname: string; search: string } })?.from;
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />;
  }

  const errorCode = searchParams.get('error');
  const error = devError || (errorCode ? ERROR_COPY[errorCode] || 'Sign-in failed. Try again.' : '');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <BookOpen size={28} />
          <span>V&apos;s Books</span>
        </div>
        <h1 className="auth-card__title">Sign in</h1>
        {error && <p className="form-error">{error}</p>}
        <a className="btn btn--primary auth-card__submit" href={GOOGLE_LOGIN_URL}>
          <GoogleMark />
          Continue with Google
        </a>
        {import.meta.env.DEV && (
          <button
            className="btn btn--secondary auth-card__submit"
            style={{ marginTop: 8 }}
            onClick={async () => setDevError((await devLogin()) || '')}
          >
            Dev sign in
          </button>
        )}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8a10 10 0 0 1-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7A22 22 0 0 0 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.2a13.2 13.2 0 0 1 0-8.4v-5.7H4.3a22 22 0 0 0 0 19.8l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2A22 22 0 0 0 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9 12.4-9z" />
    </svg>
  );
}
