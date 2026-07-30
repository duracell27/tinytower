import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/auth';
import { cn } from '../lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { to: '/players', label: 'Players' },
    { to: '/commands', label: 'Command Logs' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-800">TinyTower Admin</span>
        <div className="flex gap-4">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                'text-sm hover:text-blue-600',
                location.pathname.startsWith(l.to) ? 'text-blue-600 font-medium' : 'text-gray-600',
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <button
          onClick={() => { clearToken(); navigate('/login'); }}
          className="ml-auto text-sm text-gray-500 hover:text-red-600"
        >
          Logout
        </button>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
