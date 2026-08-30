import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

export const Header = () => {
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

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    // Desktop now shows the profile menu inside Sidebar (matches the Figma nav
    // layout); this bar is kept for mobile, where Sidebar is hidden, so logout
    // stays reachable everywhere.
    <header className="md:hidden h-16 border-b border-line bg-white flex items-center justify-end px-6 shrink-0">
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded pl-1 pr-2 py-1 hover:bg-paper focus-ring"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          )}
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-ink leading-tight">{user.name}</p>
            <p className="text-xs text-ink-faint leading-tight">{user.email}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-ink-faint" />
        </button>
        {open && (
          <div className="absolute right-0 mt-1.5 w-44 bg-white border border-line rounded-md shadow-popover py-1 z-30">
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
    </header>
  );
};
