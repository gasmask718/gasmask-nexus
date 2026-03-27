import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, Target, Phone, ClipboardCheck, Store, Package, Bot, TrendingUp,
  PartyPopper, Users, CalendarDays, DollarSign, FileText, MapPin
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const PINK = '#E91E8C';

const utNavSections = [
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
    ],
  },
  {
    title: '📞 Outreach',
    items: [
      { path: '/os/unforgettable/outreach', label: 'Floor 2 — Outreach Command', icon: Phone },
      { path: '/os/unforgettable/communications', label: 'Communications', icon: Phone },
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
    title: '📦 Products',
    items: [
      { path: '/os/unforgettable/products', label: 'Floor 5 — Product Engine', icon: Package },
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
];

export default function UTHubLayout() {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/os/unforgettable') return location.pathname === '/os/unforgettable';
    return location.pathname.startsWith(path);
  };

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
                      {item.label}
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
