import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, ArrowLeftRight, BarChart2,
  Receipt, Star, Settings, TrendingUp, Newspaper,
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/news', icon: Newspaper, label: 'News & Research' },
  { to: '/tax', icon: Receipt, label: 'Tax Summary' },
  { to: '/watchlist', icon: Star, label: 'Watchlist' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-800">
          <TrendingUp className="text-green-400" size={22} />
          <span className="font-bold text-white text-base">Finance Tracker</span>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-500/10 text-green-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
