import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function Layout() {
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
            <BookOpen />
            My Library
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
