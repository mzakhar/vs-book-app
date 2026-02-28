import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Moon, Sun, Sparkles, BookMarked } from 'lucide-react';

type Theme = 'dark' | 'light' | 'purple';

export default function Layout() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('book_app_theme') as Theme) || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('book_app_theme', theme);
  }, [theme]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-icon">📚</span>
          <span className="sidebar__brand-title">Books</span>
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
            to="/series"
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <BookMarked />
            Series
          </NavLink>
        </nav>
        <div className="sidebar__theme">
          <button
            className={`btn btn--icon btn--ghost${theme === 'dark' ? ' nav-item--active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark theme"
          >
            <Moon size={16} />
          </button>
          <button
            className={`btn btn--icon btn--ghost${theme === 'light' ? ' nav-item--active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light theme"
          >
            <Sun size={16} />
          </button>
          <button
            className={`btn btn--icon btn--ghost${theme === 'purple' ? ' nav-item--active' : ''}`}
            onClick={() => setTheme('purple')}
            title="Purple theme"
          >
            <Sparkles size={16} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
