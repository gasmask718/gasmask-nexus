import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, CalendarCheck, Users, Map, TrendingUp, 
  Star, Settings2, Brain, Bell, RefreshCw, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { path: '/os/toptier', label: 'Overview', icon: LayoutDashboard, end: true },
  { path: '/os/toptier/bookings', label: 'Bookings', icon: CalendarCheck },
  { path: '/os/toptier/partners', label: 'Partners', icon: Users },
  { path: '/os/toptier/itinerary', label: 'Itinerary Monitor', icon: Map },
  { path: '/os/toptier/revenue', label: 'Revenue', icon: TrendingUp },
  { path: '/os/toptier/ambassadors', label: 'Ambassadors', icon: Star },
  { path: '/os/toptier/operations', label: 'Operations', icon: Settings2 },
  { path: '/os/toptier/ai', label: 'AI Brain', icon: Brain },
];

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-sm font-mono text-[#C9A84C]">
      {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const pageMap: Record<string, string> = {
    os: 'Dynasty OS', toptier: 'TopTier Hub', bookings: 'Bookings',
    partners: 'Partners', itinerary: 'Itinerary Monitor', revenue: 'Revenue',
    ambassadors: 'Ambassadors', operations: 'Operations', ai: 'AI Brain',
    settings: 'Settings',
  };
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-white/20">/</span>}
          <span className={i === segments.length - 1 ? 'text-[#C9A84C]' : 'text-white/50'}>
            {pageMap[seg] || seg}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function TopTierHubLayout() {
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 1000);
    window.dispatchEvent(new Event('toptier-refresh'));
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-[#0A0A0A] border-r border-[#C9A84C]/10 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-serif font-bold text-[#C9A84C]">Dynasty</span>
            <span className="text-xl font-bold text-white">OS</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-0.5">Command Center</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.15em] text-[#C9A84C]/60 font-semibold">
            TopTier Hub
          </p>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all',
                'hover:bg-white/5 hover:text-[#C9A84C]',
                isActive 
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-l-2 border-[#C9A84C] -ml-px' 
                  : 'text-white/60'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <NavLink
            to="/os/toptier/settings"
            className={({ isActive }) => cn(
              'flex items-center gap-2 text-sm',
              isActive ? 'text-[#C9A84C]' : 'text-white/40 hover:text-white/60'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-white/40">TopTier Experience</span>
          </div>
          <p className="text-[10px] text-white/20">
            Last synced: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 flex-shrink-0 bg-[#111111] border-b border-white/5 flex items-center justify-between px-5">
          <Breadcrumb />
          <div className="flex items-center gap-4">
            <LiveClock />
            <Button 
              variant="ghost" size="icon" 
              className="h-8 w-8 text-white/40 hover:text-white"
              onClick={handleRefresh}
            >
              <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-red-500 rounded-full text-[9px] flex items-center justify-center">3</span>
            </Button>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] animate-pulse">
              LIVE
            </Badge>
            <div className="h-8 w-8 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center text-xs font-bold text-[#C9A84C]">
              DO
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
