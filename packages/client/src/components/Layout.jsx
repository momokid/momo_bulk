import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate         = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top Navigation ───────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">

          {/* Logo → Dashboard */}
          <NavLink to="/" className="font-bold text-brand-700 text-lg tracking-tight">
            MoMo<span className="text-gray-400 font-normal">Bulk</span>
          </NavLink>

          {/* Nav links */}
          <div className="flex items-center gap-6">
            <NavLink to="/transfer" className={linkClass}>Transfer</NavLink>
            <NavLink to="/history"  className={linkClass}>History</NavLink>
            <NavLink to="/settings" className={linkClass}>Settings</NavLink>

            {/* Divider */}
            <span className="h-4 w-px bg-gray-200" />

            {/* User + logout */}
            <span className="text-xs text-gray-400 hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>

        </div>
      </nav>

      {/* ── Page Content ─────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>

    </div>
  );
}