import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, Target, Phone, ClipboardCheck, Store, Package, Bot, TrendingUp,
  PartyPopper, Users, CalendarDays, DollarSign, FileText, MapPin, Brain, Send, Zap, Star
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

const PINK = '#E91E8C';

const normalizeAmbassadorStatus = (status?: string | null) => {
  const normalized = (status || '').trim().toLowerCase();

  if (!normalized || normalized === 'new' || normalized === 'pending_review') {
    return 'pending';
  }

  if (normalized === 'approved') {
    return 'active';
  }

  if (normalized === 'inactive') {
    return 'suspended';
  }

  return normalized;
};

interface NavItem {
  path: string;
  label: string;
  icon: any;
  hasBadge?: boolean;
}

const utNavSections: { title: string; items: NavItem[] }[] = [
  {
    title: '🎉 Penthouse',
    items: [
      { path: '/os/unforgettable', label: 'Command Center', icon: PartyPopper },
    ],
  },
  {
    title: '🧠 Intelligence',
    items: [
      { path: '/os/unforgettable/intelligence', label: 'Floor 1 — Lead Intelligence', icon: Target },
      { path: '/os/unforgettable/territory', label: 'Territory Map', icon: MapPin },
      { path: '/os/unforgettable/places', label: 'Places Lead Finder', icon: Target },
      { path: '/os/unforgettable/leads', label: 'Lead Intelligence', icon: Brain },
      { path: '/os/unforgettable/outreach-engine', label: 'Outreach Engine', icon: Send },
      { path: '/os/unforgettable/automation-runs', label: 'Automation Runs', icon: Zap },
      { path: '/os/unforgettable/ambassador-finder', label: 'Ambassador Finder', icon: Star },
    ],
  },
  {
    title: '📞 Outreach',
    items: [
      { path: '/os/unforgettable/outreach', label: 'Floor 2 — Outreach Command', icon: Phone },
      { path: '/os/unforgettable/communications', label: 'Communications', icon: Phone },
      { path: '/os/unforgettable/growth-engine', label: 'Growth Engine', icon: Zap },
      { path: '/os/unforgettable/biz-owner-outreach', label: 'Biz Owner Outreach', icon: Users },
      { path: '/os/unforgettable/customer-acquisition', label: 'Customer Acquisition', icon: Target },
    ],
  },
  {
    title: '📋 Onboarding',
    items: [
      { path: '/os/unforgettable/onboarding', label: 'Floor 3 — Partner Onboarding', icon: ClipboardCheck },
      { path: '/os/unforgettable/partners', label: 'Partner Dashboard', icon: Users },
    ],
  },
  {
    title: '🏪 Marketplace',
    items: [
      { path: '/os/unforgettable/marketplace', label: 'Floor 4 — Marketplace Control', icon: Store },
      { path: '/os/unforgettable/events', label: 'Event Builder', icon: CalendarDays },
    ],
  },
  {
    title: '📦 Floor 5 — Business Builder',
    items: [
      { path: '/os/unforgettable/business-requests', label: 'Business Requests', icon: ClipboardCheck },
      { path: '/os/unforgettable/business-quotes', label: 'Quotes Manager', icon: FileText },
      { path: '/os/unforgettable/business-products', label: 'Products', icon: Package },
      { path: '/os/unforgettable/business-packages', label: 'Packages', icon: Package },
      { path: '/os/unforgettable/products', label: 'Product Engine', icon: Package },
      { path: '/os/unforgettable/suppliers', label: 'Supplier Console', icon: Package },
    ],
  },
  {
    title: '🤖 AI & Ops',
    items: [
      { path: '/os/unforgettable/automation', label: 'Floor 6 — AI & Automation', icon: Bot },
      { path: '/os/unforgettable/staff', label: 'Staff Management', icon: Users },
      { path: '/os/unforgettable/scheduling', label: 'Scheduling', icon: CalendarDays },
      { path: '/os/unforgettable/payroll', label: 'Payroll', icon: DollarSign },
      { path: '/os/unforgettable/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    title: '📊 Analytics',
    items: [
      { path: '/os/unforgettable/analytics', label: 'Floor 7 — Analytics', icon: TrendingUp },
      { path: '/os/unforgettable/performance', label: 'Performance', icon: BarChart3 },
    ],
  },
  {
    title: '🏢 Management',
    items: [
      { path: '/os/unforgettable/ambassadors', label: 'Ambassadors', icon: Users, hasBadge: true },
      { path: '/os/unforgettable/hall-dashboard', label: 'Hall Owner Dashboard', icon: Store },
      { path: '/os/unforgettable/staff-dashboard', label: 'Staff Dashboard', icon: Users },
      { path: '/os/unforgettable/venues', label: 'Venues Management', icon: MapPin },
      { path: '/os/unforgettable/event-bookings', label: 'Event Bookings', icon: CalendarDays },
      { path: '/os/unforgettable/staff-management', label: 'Staff Management', icon: Users },
      { path: '/os/unforgettable/platform-stats', label: 'Platform Stats', icon: BarChart3 },
    ],
  },
];

export default function UTHubLayout() {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  const isActive = (path: string) => {
    if (path === '/os/unforgettable') return location.pathname === '/os/unforgettable';
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from('unforgettable_ambassadors')
        .select('id, status');

      const count = (data || []).filter((row) => normalizeAmbassadorStatus(row.status) === 'pending').length;
      setPendingCount(count);
    };

    fetchPending();

    const channel = supabase
      .channel('ut-ambassador-pending-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unforgettable_ambassadors' }, () => {
        fetchPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex h-full min-h-screen">
      <aside className="w-64 border-r border-border bg-card/50 flex-shrink-0 hidden lg:block">
        <ScrollArea className="h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <PartyPopper className="h-6 w-6" style={{ color: PINK }} />
              <div>
                <h2 className="font-bold text-lg" style={{ color: PINK }}>Unforgettable Times</h2>
                <p className="text-xs text-muted-foreground">Event Marketplace Engine</p>
              </div>
            </div>

            {utNavSections.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                        isActive(item.path)
                          ? "font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      style={isActive(item.path) ? { backgroundColor: 'rgba(233,30,140,0.1)', color: PINK } : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.hasBadge && pendingCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
