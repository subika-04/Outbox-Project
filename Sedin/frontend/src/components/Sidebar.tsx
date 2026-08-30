import { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutGrid, Send, Clock3, PenSquare, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

const NAV_ITEMS = [{ to: '/', label: 'Dashboard', icon: LayoutGrid, end: true }];

const CORE_ITEMS = [
  { to: '/scheduled', label: 'Scheduled', icon: Clock3, end: false },
  { to: '/sent', label: 'Sent', icon: Send, end: false },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
    isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-soft hover:bg-paper hover:text-ink'
  }`;

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = user?.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-line bg-white shrink-0">
      <div className="px-5 h-16 flex items-center border-b border-line">
        <span className="font-display font-bold text-lg text-ink tracking-tight">ReachInbox</span>
      </div>

      {user && (
        <div ref={menuRef} className="relative px-3 pt-4">
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 rounded-lg p-2 hover:bg-paper focus-ring"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
            )}
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm font-medium text-ink leading-tight truncate">{user.name}</p>
              <p className="text-xs text-ink-faint leading-tight truncate">{user.email}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-ink-faint shrink-0" />
          </button>
          {open && (
            <div className="absolute left-3 right-3 mt-1 bg-white border border-line rounded-lg shadow-popover py-1 z-30">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:bg-paper hover:text-manifest-failed"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      )}

      <div className="px-3 pt-3">
        <Link
          to="/compose"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-500 bg-white text-brand-600 hover:bg-brand-50 active:bg-brand-100 text-sm font-medium px-4 py-2.5 transition-colors focus-ring"
        >
          <PenSquare className="w-4 h-4" />
          Compose
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div>
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">Core</p>
          <div className="space-y-0.5">
            {CORE_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
};
