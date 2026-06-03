import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, ArrowLeftRight, BarChart2,
  Receipt, Star, Settings, TrendingUp, Newspaper, ChevronLeft, ChevronRight,
  MessageSquare, LogIn, LogOut, UserCircle, CalendarDays,
  LineChart, Sparkles, Bell, Target, FlaskConical,
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/charts', icon: LineChart, label: 'Charts' },
  { to: '/news', icon: Newspaper, label: 'News & Research' },
  { to: '/tax', icon: Receipt, label: 'Tax Summary' },
  { to: '/watchlist', icon: Star, label: 'Watchlist' },
  { to: '/alerts', icon: Bell, label: 'Price Alerts' },
  { to: '/suggestions', icon: Sparkles, label: 'AI Suggestions' },
  { to: '/targets', icon: Target, label: 'Financial Goals' },
  { to: '/simulator', icon: FlaskConical, label: 'Simulator' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/chat', icon: MessageSquare, label: 'AI Assistant' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface Props {
  children: React.ReactNode;
  user: { id: string; email: string } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function Layout({ children, user, onSignIn, onSignOut }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo row */}
        <div className={`flex items-center border-b border-gray-800 h-14 ${collapsed ? 'justify-center px-0' : 'px-4 gap-2'}`}>
          {!collapsed && (
            <>
              <TrendingUp className="text-green-400 shrink-0" size={20} />
              <span className="font-bold text-white text-sm truncate">Finance Tracker</span>
            </>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`text-gray-500 hover:text-white transition-colors ${collapsed ? '' : 'ml-auto'}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-0.5 px-1.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg text-sm transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-green-500/10 text-green-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Auth section */}
        <div className={`border-t border-gray-800 p-2 ${collapsed ? '' : 'px-2'}`}>
          {user ? (
            <div className={`space-y-1`}>
              {!collapsed && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <UserCircle size={15} className="text-green-400 shrink-0" />
                  <span className="text-xs text-gray-400 truncate">{user.email}</span>
                </div>
              )}
              <button
                onClick={onSignOut}
                title={collapsed ? 'Sign out' : undefined}
                className={`w-full flex items-center rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                }`}
              >
                <LogOut size={17} className="shrink-0" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              title={collapsed ? 'Sign in' : undefined}
              className={`w-full flex items-center rounded-lg text-sm text-green-400 hover:bg-green-500/10 transition-colors ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              }`}
            >
              <LogIn size={17} className="shrink-0" />
              {!collapsed && <span className="font-medium">Sign in / Sign up</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
