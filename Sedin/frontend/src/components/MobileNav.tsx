import { NavLink } from 'react-router-dom';
import { LayoutGrid, Send, Clock3, PenSquare } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/compose', label: 'Compose', icon: PenSquare, end: false },
  { to: '/scheduled', label: 'Scheduled', icon: Clock3, end: false },
  { to: '/sent', label: 'Sent', icon: Send, end: false },
];

export const MobileNav = () => (
  <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line flex z-20">
    {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
            isActive ? 'text-brand-600' : 'text-ink-faint'
          }`
        }
      >
        <Icon className="w-5 h-5" />
        {label}
      </NavLink>
    ))}
  </nav>
);
