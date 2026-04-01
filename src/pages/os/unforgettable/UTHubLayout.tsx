import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, Target, Phone, ClipboardCheck, Store, Package, Bot, TrendingUp,
  PartyPopper, Users, CalendarDays, DollarSign, FileText, MapPin, Brain, Send, Zap, Star, Calculator,
  Palette, Factory, FileCheck, Rocket, HelpCircle, PhoneCall, ShoppingBag, Trophy, Megaphone,
  ShoppingCart, Mail, Wallet, CreditCard, Sparkles, LayoutDashboard
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
    title: '📊 Command Center',
    items: [
      { path: '/os/unforgettable', label: 'Command Center', icon: PartyPopper },
      { path: '/os/unforgettable/hall-dashboard', label: 'Hall Dashboard', icon: Store },
      { path: '/os/unforgettable/daily-summary', label: 'Daily Summary Feed', icon: LayoutDashboard },
      { path: '/os/unforgettable/platform-stats', label: 'Platform Stats', icon: BarChart3 },
    ],
  },
  {
    title: '🎉 Event Operations',
    items: [
      { path: '/os/unforgettable/event-bookings', label: 'Event Bookings', icon: CalendarDays },
      { path: '/os/unforgettable/event-calendar', label: 'Event Calendar', icon: CalendarDays },
      { path: '/os/unforgettable/venues', label: 'Venues Admin', icon: MapPin },
      { path: '/os/unforgettable/staff-management', label: 'Staff Admin', icon: Users },
      { path: '/os/unforgettable/vendor-payments', label: 'Vendor Payment Tracker', icon: CreditCard },
    ],
  },
  {
    title: '🤝 Ambassador Engine',
    items: [
      { path: '/os/unforgettable/ambassadors', label: 'Ambassador Management', icon: Users, hasBadge: true },
      { path: '/os/unforgettable/ambassador-finder', label: 'Ambassador Finder', icon: Star },
      { path: '/os/unforgettable/ambassador-leaderboard', label: 'Ambassador Leaderboard', icon: Trophy },
    ],
  },
  {
    title: '📣 Growth Engine',
    items: [
      { path: '/os/unforgettable/leads', label: 'Lead Intelligence', icon: Brain },
      { path: '/os/unforgettable/intelligence', label: 'Intelligence Hub', icon: Target },
      { path: '/os/unforgettable/outreach', label: 'Outreach Command', icon: Phone },
      { path: '/os/unforgettable/outreach-engine', label: 'Outreach Engine', icon: Send },
      { path: '/os/unforgettable/growth-engine', label: 'Growth Engine', icon: Zap },
      { path: '/os/unforgettable/automation-runs', label: 'Automation Runs', icon: Zap },
      { path: '/os/unforgettable/campaign-performance', label: 'Campaign Performance', icon: Megaphone },
    ],
  },
  {
    title: '🚀 Business Owner',
    items: [
      { path: '/os/unforgettable/biz-owner-dashboard', label: 'Biz Owner Dashboard', icon: Rocket },
      { path: '/os/unforgettable/quiz-results', label: 'Quiz Results', icon: HelpCircle },
      { path: '/os/unforgettable/consultations', label: 'Consultations', icon: PhoneCall },
      { path: '/os/unforgettable/kit-orders', label: 'Kit Orders', icon: ShoppingBag },
    ],
  },
  {
    title: '🎨 Brand & Supply',
    items: [
      { path: '/os/unforgettable/brand-kit', label: 'Brand Kit Manager', icon: Palette },
      { path: '/os/unforgettable/supplier-manager', label: 'Supplier Manager', icon: Factory },
      { path: '/os/unforgettable/branding-pipeline', label: 'Branding Pipeline', icon: FileCheck },
      { path: '/os/unforgettable/rfq-engine', label: 'RFQ Engine', icon: Send },
      { path: '/os/unforgettable/supplier-finder', label: 'Supplier Finder', icon: Target },
      { path: '/os/unforgettable/shipping-tracker', label: 'Shipping Tracker', icon: Package },
      { path: '/os/unforgettable/supplier-inbox', label: 'Supplier Inbox', icon: Store },
      { path: '/os/unforgettable/supplier-decision', label: 'Decision Engine', icon: Trophy },
      { path: '/os/unforgettable/supplier-command', label: 'Supplier Command', icon: BarChart3 },
    ],
  },
  {
    title: '🛍️ Shop Control',
    items: [
      { path: '/os/unforgettable/shop-dashboard', label: 'Shop Dashboard', icon: ShoppingCart },
      { path: '/os/unforgettable/product-organizer', label: 'Product Organizer', icon: Package },
      { path: '/os/unforgettable/email-subscribers', label: 'Email Subscribers', icon: Mail },
    ],
  },
  {
    title: '💰 Financial',
    items: [
      { path: '/os/unforgettable/revenue-dashboard', label: 'Revenue Dashboard', icon: DollarSign },
      { path: '/os/unforgettable/pricing-engine', label: 'Pricing Engine', icon: Calculator },
      { path: '/os/unforgettable/growth-simulator', label: 'Growth Simulator', icon: TrendingUp },
      { path: '/os/unforgettable/payout-manager', label: 'Payout Manager', icon: Wallet },
    ],
  },
  {
    title: '🧠 AI Operations',
    items: [
      { path: '/os/unforgettable/ai-brain', label: 'AI Command Brain', icon: Brain },
      { path: '/os/unforgettable/performance-insights', label: 'Performance Insights', icon: Sparkles },
    ],
  },
  {
    title: '⚙️ Operations',
    items: [
      { path: '/os/unforgettable/staff', label: 'Staff Management', icon: Users },
      { path: '/os/unforgettable/scheduling', label: 'Scheduling', icon: CalendarDays },
      { path: '/os/unforgettable/payroll', label: 'Payroll', icon: DollarSign },
      { path: '/os/unforgettable/documents', label: 'Documents', icon: FileText },
      { path: '/os/unforgettable/staff-dashboard', label: 'Staff Dashboard', icon: Users },
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
