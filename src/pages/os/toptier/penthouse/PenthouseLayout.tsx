import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, ShoppingBag, DollarSign,
  Shield, Settings2, BarChart3, FileText, Bell, RefreshCw, Crown,
  Car, ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const penthouseNav = [
  { path: '/os/toptier/penthouse', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/os/toptier/penthouse/partners', label: 'Partners', icon: Users },
  { path: '/os/toptier/penthouse/affiliates', label: 'Affiliates', icon: UserCheck },
  { path: '/os/toptier/penthouse/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { path: '/os/toptier/penthouse/drivers', label: 'Drivers', icon: Car },
  { path: '/os/toptier/penthouse/confirmations', label: 'Confirmations', icon: ClipboardCheck },
  { path: '/os/toptier/penthouse/finance', label: 'Finance', icon: DollarSign },
  { path: '/os/toptier/penthouse/roles', label: 'Roles & Permissions', icon: Shield },
  { path: '/os/toptier/penthouse/system', label: 'System Controls', icon: Settings2 },
  { path: '/os/toptier/penthouse/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/os/toptier/penthouse/audit', label: 'Audit Logs', icon: FileText },
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

export default function PenthouseLayout() {
  const location = useLocation();
  const [spinning, setSpinning] = useState(false);

  const currentPage = penthouseNav.find(n =>
    n.end ? location.pathname === n.path : location.pathname.startsWith(n.path)
  );

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#050505] border-r border-[#C9A84C]/15 flex flex-col">
        <div className="p-5 border-b border-[#C9A84C]/10">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#C9A84C]" />
            <span className="text-lg font-serif font-bold text-[#C9A84C]">Penthouse</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-1">Control System</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.15em] text-[#C9A84C]/50 font-semibold">
            Modules
          </p>
          {penthouseNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                'hover:bg-[#C9A84C]/5 hover:text-[#C9A84C]',
                isActive
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-l-2 border-[#C9A84C]'
                  : 'text-white/50'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <NavLink
            to="/os/toptier"
            className="flex items-center gap-2 text-xs text-white/30 hover:text-[#C9A84C] transition-colors"
          >
            ← Back to TopTier Hub
          </NavLink>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-2 w-2 rounded-full bg-[#C9A84C] animate-pulse" />
            <span className="text-[10px] text-white/30">Penthouse Active</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex-shrink-0 bg-[#0D0D0D] border-b border-[#C9A84C]/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-white/30 text-sm">Penthouse</span>
            <span className="text-white/20">/</span>
            <span className="text-[#C9A84C] text-sm font-medium">{currentPage?.label || 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-4">
            <LiveClock />
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-white/40 hover:text-[#C9A84C]"
              onClick={() => { setSpinning(true); setTimeout(() => setSpinning(false), 1000); }}
            >
              <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin')} />
            </Button>
            <Badge className="bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/30 text-[10px]">
              ADMIN
            </Badge>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
