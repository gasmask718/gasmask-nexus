import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    <div className="flex flex-col min-h-full bg-[#0A0A0A] text-white">
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
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
