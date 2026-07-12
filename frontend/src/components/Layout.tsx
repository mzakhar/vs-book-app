import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutDashboard, BookMarked, Star, Palette, Users, LogOut, UserCircle2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../api';
import type { UserProfile } from '../types';
import ProfileEditModal from './ProfileEditModal';

type Theme = 'dark' | 'light' | 'purple' | 'rainbow' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'glass-light' | 'glass-rich';

interface ThemeOption {
  id: Theme;
  label: string;
}

const THEMES: ThemeOption[] = [
  { id: 'dark',        label: 'Dark Default' },
  { id: 'light',       label: 'Light' },
  { id: 'glass-light', label: 'Glass Light' },
  { id: 'glass-rich',  label: 'Glass Rich' },
  { id: 'purple',      label: 'Deep Purple' },
  { id: 'rainbow',     label: 'Rainbow' },
  { id: 'blue',        label: 'Blue' },
  { id: 'indigo',      label: 'Indigo' },
  { id: 'green',       label: 'Green' },
  { id: 'yellow',      label: 'Yellow' },
  { id: 'orange',      label: 'Orange' },
  { id: 'red',         label: 'Red' },
];

const SPARKLES = [
  { id:  1, x:  5, y: 10, char: '✦', size: 0.65, color: '#ff6eb4', dur: 2.2, delay: 0.0, anim: 'sp-twinkle' },
  { id:  2, x: 15, y: 25, char: '✶', size: 0.50, color: '#ff9944', dur: 1.9, delay: 0.7, anim: 'sp-float'   },
  { id:  3, x: 28, y:  5, char: '✸', size: 0.70, color: '#ffdd44', dur: 2.5, delay: 0.3, anim: 'sp-drift'   },
  { id:  4, x: 42, y: 18, char: '★', size: 0.40, color: '#44ffaa', dur: 2.0, delay: 1.1, anim: 'sp-twinkle' },
  { id:  5, x: 55, y:  8, char: '✦', size: 0.60, color: '#44ccff', dur: 2.8, delay: 0.5, anim: 'sp-float'   },
  { id:  6, x: 68, y: 22, char: '✶', size: 0.50, color: '#aa66ff', dur: 1.7, delay: 0.2, anim: 'sp-twinkle' },
  { id:  7, x: 82, y: 12, char: '✸', size: 0.80, color: '#ff6eb4', dur: 2.3, delay: 0.9, anim: 'sp-drift'   },
  { id:  8, x: 92, y: 30, char: '✦', size: 0.40, color: '#ffdd44', dur: 2.1, delay: 0.4, anim: 'sp-twinkle' },
  { id:  9, x:  8, y: 45, char: '✺', size: 0.60, color: '#44ccff', dur: 2.6, delay: 1.3, anim: 'sp-float'   },
  { id: 10, x: 22, y: 55, char: '✶', size: 0.50, color: '#aa66ff', dur: 1.8, delay: 0.6, anim: 'sp-drift'   },
  { id: 11, x: 35, y: 38, char: '★', size: 0.70, color: '#ff9944', dur: 2.4, delay: 0.1, anim: 'sp-twinkle' },
  { id: 12, x: 48, y: 60, char: '✦', size: 0.40, color: '#44ffaa', dur: 2.0, delay: 1.5, anim: 'sp-float'   },
  { id: 13, x: 62, y: 42, char: '✸', size: 0.60, color: '#ff6eb4', dur: 2.7, delay: 0.8, anim: 'sp-drift'   },
  { id: 14, x: 75, y: 55, char: '✶', size: 0.50, color: '#ffdd44', dur: 1.9, delay: 0.3, anim: 'sp-twinkle' },
  { id: 15, x: 88, y: 48, char: '✺', size: 0.70, color: '#44ccff', dur: 2.2, delay: 1.0, anim: 'sp-float'   },
  { id: 16, x:  3, y: 70, char: '✦', size: 0.50, color: '#aa66ff', dur: 2.5, delay: 0.5, anim: 'sp-twinkle' },
  { id: 17, x: 18, y: 78, char: '★', size: 0.60, color: '#ff9944', dur: 1.8, delay: 1.2, anim: 'sp-drift'   },
  { id: 18, x: 32, y: 85, char: '✶', size: 0.40, color: '#44ffaa', dur: 2.3, delay: 0.7, anim: 'sp-float'   },
  { id: 19, x: 45, y: 72, char: '✸', size: 0.70, color: '#ff6eb4', dur: 2.0, delay: 0.2, anim: 'sp-twinkle' },
  { id: 20, x: 58, y: 88, char: '✦', size: 0.50, color: '#ffdd44', dur: 2.6, delay: 1.4, anim: 'sp-drift'   },
  { id: 21, x: 72, y: 75, char: '✺', size: 0.60, color: '#44ccff', dur: 1.7, delay: 0.6, anim: 'sp-float'   },
  { id: 22, x: 85, y: 90, char: '★', size: 0.40, color: '#aa66ff', dur: 2.4, delay: 0.9, anim: 'sp-twinkle' },
  { id: 23, x: 95, y: 65, char: '✶', size: 0.70, color: '#ff9944', dur: 2.1, delay: 0.4, anim: 'sp-drift'   },
  { id: 24, x: 10, y: 92, char: '✦', size: 0.50, color: '#44ffaa', dur: 2.8, delay: 1.1, anim: 'sp-float'   },
  { id: 25, x: 25, y: 65, char: '✸', size: 0.60, color: '#ff6eb4', dur: 2.0, delay: 0.3, anim: 'sp-twinkle' },
  { id: 26, x: 38, y: 48, char: '✶', size: 0.40, color: '#ffdd44', dur: 2.3, delay: 1.6, anim: 'sp-drift'   },
  { id: 27, x: 52, y: 32, char: '★', size: 0.70, color: '#44ccff', dur: 1.9, delay: 0.7, anim: 'sp-float'   },
  { id: 28, x: 65, y: 18, char: '✺', size: 0.50, color: '#aa66ff', dur: 2.5, delay: 0.2, anim: 'sp-twinkle' },
  { id: 29, x: 79, y: 35, char: '✦', size: 0.60, color: '#ff9944', dur: 2.2, delay: 1.3, anim: 'sp-drift'   },
  { id: 30, x: 90, y: 20, char: '✶', size: 0.40, color: '#44ffaa', dur: 2.7, delay: 0.5, anim: 'sp-float'   },
] as const;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('book_app_theme') as Theme) || 'dark'
  );
  const isGlassTheme = theme === 'glass-light' || theme === 'glass-rich';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(() => {
    getMyProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('book_app_theme', theme);
  }, [theme]);

  const displayName = profile?.screen_name || user?.username || '';

  return (
    <div className="layout">
      {isGlassTheme && (
        <div className="glass-scene" aria-hidden="true">
          <div className="glass-bg" />
          <svg className="glass-filter-defs" focusable="false" aria-hidden="true">
            <defs>
              <filter id="books-glass-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 22 -9
                  "
                  result="goo"
                />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
          </svg>
          <div className="glass-goo">
            <div className="glass-circle glass-circle--a glass-circle--1" />
            <div className="glass-circle glass-circle--a glass-circle--2" />
            <div className="glass-circle glass-circle--a glass-circle--3" />
            <div className="glass-circle glass-circle--a glass-circle--4" />
            <div className="glass-circle glass-circle--b glass-circle--5" />
            <div className="glass-circle glass-circle--b glass-circle--6" />
            <div className="glass-circle glass-circle--b glass-circle--7" />
            <div className="glass-circle glass-circle--b glass-circle--8" />
            <div className="glass-circle glass-circle--c glass-circle--9" />
            <div className="glass-circle glass-circle--c glass-circle--10" />
            <div className="glass-circle glass-circle--c glass-circle--11" />
            <div className="glass-circle glass-circle--c glass-circle--12" />
            <div className="glass-circle glass-circle--a glass-circle--13" />
            <div className="glass-circle glass-circle--b glass-circle--14" />
            <div className="glass-circle glass-circle--c glass-circle--15" />
            <div className="glass-circle glass-circle--a glass-circle--16" />
            <div className="glass-circle glass-circle--b glass-circle--17" />
            <div className="glass-circle glass-circle--c glass-circle--18" />
            <div className="glass-circle glass-circle--a glass-circle--19" />
            <div className="glass-circle glass-circle--b glass-circle--20" />
            <div className="glass-circle glass-circle--c glass-circle--21" />
            <div className="glass-circle glass-circle--a glass-circle--22" />
          </div>
        </div>
      )}
      {theme === 'rainbow' && (
        <div className="rainbow-sparkles" aria-hidden="true">
          {SPARKLES.map(s => (
            <span
              key={s.id}
              className={s.anim}
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                fontSize: `${s.size}rem`,
                color: s.color,
                '--sp-dur': `${s.dur}s`,
                '--sp-delay': `${s.delay}s`,
              } as React.CSSProperties}
            >
              {s.char}
            </span>
          ))}
        </div>
      )}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 141" width="32" height="32">
              <defs>
                <linearGradient id="sb_rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff0000" />
                  <stop offset="16%" stopColor="#ff8800" />
                  <stop offset="33%" stopColor="#ffee00" />
                  <stop offset="50%" stopColor="#00cc44" />
                  <stop offset="66%" stopColor="#0088ff" />
                  <stop offset="83%" stopColor="#6600ff" />
                  <stop offset="100%" stopColor="#cc00ff" />
                </linearGradient>
              </defs>
              <path fill="url(#sb_rainbow)" fillRule="evenodd" d="M 134.20,132.30 L 133.40,132.10 L 132.50,131.00 L 132.30,125.60 L 132.50,123.00 L 133.30,120.40 L 132.70,118.20 L 131.90,116.60 L 131.00,115.70 L 129.40,114.90 L 126.60,115.10 L 124.90,116.40 L 123.60,119.10 L 122.90,118.80 L 122.70,116.60 L 121.40,115.10 L 120.20,115.30 L 119.10,116.40 L 118.50,117.60 L 117.20,118.50 L 116.20,118.30 L 115.10,117.40 L 114.70,115.60 L 113.90,114.20 L 113.70,109.80 L 113.30,108.80 L 113.30,105.80 L 112.90,104.20 L 112.90,87.60 L 112.60,87.10 L 111.80,87.10 L 111.50,87.40 L 110.10,90.00 L 109.90,97.20 L 108.90,102.20 L 108.10,102.20 L 107.10,100.20 L 106.90,99.00 L 106.40,98.50 L 105.80,98.70 L 105.30,100.20 L 105.90,101.40 L 106.10,103.40 L 105.20,103.70 L 104.30,102.20 L 104.10,100.80 L 103.60,100.30 L 103.00,100.30 L 102.50,100.80 L 102.50,103.60 L 103.10,105.20 L 102.60,105.90 L 101.80,105.90 L 101.30,105.40 L 101.50,104.00 L 101.10,103.40 L 101.10,101.60 L 100.40,100.70 L 100.00,100.70 L 99.30,101.40 L 99.30,104.40 L 99.70,105.40 L 99.70,107.20 L 99.40,107.50 L 98.60,107.50 L 98.30,107.20 L 97.90,103.80 L 97.00,102.50 L 96.20,102.50 L 95.50,103.40 L 95.50,105.40 L 96.10,107.20 L 95.60,107.90 L 95.00,107.90 L 94.50,107.40 L 94.30,103.20 L 93.40,102.30 L 92.40,102.50 L 91.50,103.60 L 91.70,107.40 L 91.20,107.90 L 90.10,107.20 L 89.70,103.80 L 89.30,103.00 L 88.60,102.50 L 88.00,102.50 L 87.30,103.00 L 87.50,107.40 L 87.20,107.70 L 86.80,107.90 L 85.70,107.40 L 85.70,104.40 L 85.50,103.40 L 84.80,102.30 L 83.50,102.60 L 83.10,103.40 L 82.90,106.40 L 82.00,106.70 L 81.50,106.00 L 81.90,102.00 L 81.20,100.90 L 80.10,101.20 L 79.70,102.20 L 79.70,105.00 L 79.00,106.10 L 78.20,106.10 L 77.70,105.40 L 77.70,104.20 L 78.70,101.80 L 78.70,100.40 L 78.20,99.90 L 77.40,99.90 L 77.10,100.20 L 77.10,102.40 L 76.40,103.50 L 75.70,102.80 L 76.10,100.20 L 76.10,99.00 L 75.80,98.50 L 75.00,98.50 L 74.70,99.00 L 74.70,101.20 L 74.40,101.50 L 74.00,101.50 L 73.10,100.60 L 71.90,97.80 L 71.70,94.20 L 71.30,93.20 L 70.90,89.60 L 69.90,87.80 L 69.20,87.50 L 68.70,88.00 L 68.90,89.60 L 68.50,95.80 L 68.10,97.60 L 67.90,104.40 L 67.10,108.00 L 66.90,112.00 L 65.50,117.20 L 64.60,118.50 L 64.00,118.50 L 63.10,117.80 L 62.90,116.80 L 62.20,115.90 L 60.60,115.30 L 59.10,116.40 L 58.70,117.80 L 57.80,118.50 L 57.10,118.00 L 56.30,116.20 L 54.00,114.30 L 52.20,114.10 L 50.00,115.10 L 48.10,117.60 L 47.90,119.40 L 47.90,123.00 L 48.90,126.20 L 48.70,129.60 L 47.40,131.90 L 46.60,132.10 L 45.50,131.40 L 44.50,128.60 L 44.50,126.00 L 47.70,114.00 L 47.90,108.60 L 46.40,106.90 L 45.00,105.90 L 42.00,105.90 L 41.70,105.60 L 42.30,102.40 L 42.10,96.80 L 40.60,95.50 L 39.00,95.50 L 37.60,95.90 L 36.90,95.40 L 37.90,93.60 L 38.10,92.00 L 36.20,90.30 L 34.80,89.90 L 34.10,89.20 L 34.10,88.20 L 36.10,84.00 L 38.70,81.00 L 41.60,78.30 L 46.40,75.10 L 52.00,72.70 L 52.70,72.20 L 52.90,71.00 L 52.40,70.70 L 49.80,70.90 L 45.60,71.90 L 45.50,71.60 L 46.40,70.90 L 50.80,69.30 L 51.30,68.80 L 51.30,68.20 L 50.80,67.90 L 44.20,68.10 L 43.20,68.50 L 42.30,69.40 L 42.10,71.20 L 42.50,72.20 L 43.30,73.00 L 42.20,73.50 L 40.20,72.70 L 38.40,71.30 L 37.30,70.00 L 36.70,68.20 L 36.70,66.00 L 33.70,59.60 L 31.70,52.60 L 29.50,49.40 L 29.50,47.40 L 30.90,44.60 L 30.70,41.40 L 29.50,39.20 L 28.60,38.90 L 26.90,37.00 L 26.90,31.40 L 26.30,29.60 L 25.10,28.20 L 24.90,25.60 L 22.40,23.50 L 19.40,21.70 L 18.30,20.60 L 16.90,18.40 L 16.70,15.60 L 17.60,14.10 L 21.40,12.70 L 23.80,12.70 L 25.20,12.30 L 32.80,12.30 L 37.00,12.90 L 44.80,15.10 L 45.60,15.70 L 46.60,15.90 L 51.60,18.30 L 55.60,21.10 L 58.70,23.80 L 64.50,30.60 L 64.20,31.10 L 63.80,31.10 L 62.80,30.30 L 61.60,29.90 L 61.00,29.10 L 59.20,28.10 L 57.40,26.50 L 51.40,23.30 L 47.20,21.70 L 44.80,21.50 L 44.00,21.10 L 43.30,20.20 L 42.90,18.20 L 41.80,17.10 L 40.20,16.50 L 37.00,16.50 L 35.90,17.40 L 35.70,18.00 L 38.60,21.10 L 39.60,21.30 L 41.40,22.30 L 42.20,22.30 L 44.20,23.10 L 47.20,23.50 L 50.40,24.50 L 56.20,27.50 L 58.20,28.70 L 59.20,29.70 L 60.70,30.40 L 60.40,31.30 L 59.00,31.10 L 58.70,31.40 L 59.50,32.20 L 59.50,32.60 L 58.60,33.50 L 57.20,34.10 L 56.60,35.10 L 53.00,35.10 L 51.90,34.00 L 51.90,33.00 L 52.30,32.20 L 53.40,31.30 L 57.20,30.90 L 56.80,30.30 L 51.60,29.50 L 48.80,28.30 L 39.80,22.70 L 38.20,21.30 L 37.20,21.10 L 32.40,18.50 L 31.00,18.30 L 29.80,18.50 L 28.80,19.10 L 27.90,20.00 L 27.50,21.20 L 27.50,23.00 L 28.10,24.40 L 31.90,28.20 L 34.10,31.60 L 35.80,32.90 L 38.00,33.90 L 39.20,35.90 L 53.80,35.90 L 54.30,36.20 L 53.40,36.70 L 51.40,36.90 L 45.20,37.10 L 43.40,37.90 L 41.20,38.30 L 39.30,39.60 L 39.30,40.60 L 40.40,41.90 L 47.60,42.70 L 49.80,43.70 L 50.80,44.70 L 52.30,45.40 L 52.20,45.70 L 50.80,45.70 L 47.20,44.30 L 44.20,43.90 L 43.20,44.10 L 41.70,45.40 L 41.70,46.20 L 42.20,47.10 L 43.60,48.10 L 45.40,48.70 L 46.60,48.70 L 51.40,47.30 L 52.20,46.90 L 53.00,45.90 L 56.40,45.70 L 57.60,44.90 L 60.90,41.60 L 62.50,38.80 L 63.30,38.00 L 63.80,36.70 L 64.40,36.50 L 65.20,35.50 L 66.60,35.70 L 67.80,34.90 L 68.50,35.00 L 68.50,35.80 L 66.90,38.00 L 66.70,40.00 L 66.10,41.60 L 65.90,45.20 L 64.90,48.00 L 64.90,48.80 L 63.90,50.60 L 61.50,53.20 L 60.10,55.80 L 59.90,57.60 L 60.60,59.30 L 61.60,59.30 L 62.40,57.50 L 63.40,57.50 L 63.70,57.80 L 63.70,58.40 L 61.90,60.20 L 61.70,60.80 L 61.70,63.80 L 61.10,64.00 L 60.10,62.60 L 59.70,61.00 L 58.90,60.20 L 58.90,55.00 L 60.70,52.40 L 60.70,51.80 L 60.20,51.70 L 59.40,52.50 L 58.70,54.00 L 57.90,54.60 L 57.70,59.40 L 59.10,62.80 L 59.70,63.20 L 59.90,64.40 L 60.90,65.80 L 61.90,68.80 L 62.90,70.40 L 62.70,72.00 L 59.70,74.60 L 58.90,76.20 L 58.90,77.80 L 59.10,78.40 L 60.90,80.00 L 61.90,82.60 L 63.40,84.10 L 65.60,84.70 L 66.40,84.30 L 68.40,84.10 L 72.90,88.20 L 74.50,91.20 L 74.70,96.20 L 75.20,96.90 L 76.10,96.40 L 76.30,93.80 L 76.30,93.80 L 134.20,132.30 Z" />
            </svg>
          </span>
          <span className="sidebar__brand-title">V&apos;s Books</span>
        </div>
        <nav className="sidebar__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <LayoutDashboard />
            Dashboard
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <BookOpen />
            My Library
          </NavLink>
          <NavLink
            to="/wishlist"
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <Star />
            Wishlist
          </NavLink>
          <NavLink
            to="/series"
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <BookMarked />
            Series
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <UserCircle2 />
            Readers
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            >
              <Users />
              Users
            </NavLink>
          )}
        </nav>
        <div className="sidebar__account" ref={accountRef}>
          <button
            type="button"
            className="account-menu__trigger"
            onClick={() => setAccountOpen(o => !o)}
          >
            {profile?.avatar_url ? (
              <img className="avatar avatar--sm" src={profile.avatar_url} alt="" />
            ) : (
              <span className="avatar avatar--sm avatar--fallback">{displayName.charAt(0).toUpperCase() || '?'}</span>
            )}
            <span className="sidebar__account-username">{displayName}</span>
            {accountOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {accountOpen && (
            <div className="account-menu">
              <button
                type="button"
                className="account-menu__item"
                onClick={() => { setAccountOpen(false); setShowEditProfile(true); }}
              >
                <Pencil size={14} />
                Edit profile
              </button>
              <button type="button" className="account-menu__item" onClick={handleLogout}>
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
        <div className="sidebar__theme">
          <div className="form-group" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-3)', marginBottom: '4px' }}>
              <Palette size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme</span>
            </div>
            <select
              className="form-select"
              value={theme}
              onChange={e => setTheme(e.target.value as Theme)}
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
            >
              {THEMES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
      {showEditProfile && (
        <ProfileEditModal
          onClose={() => setShowEditProfile(false)}
          onSaved={() => { setShowEditProfile(false); loadProfile(); }}
        />
      )}
    </div>
  );
}
