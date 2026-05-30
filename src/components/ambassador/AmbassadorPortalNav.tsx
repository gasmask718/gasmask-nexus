/**
 * AmbassadorPortalNav — Constitutional navigation bar for ALL Ambassador portal pages
 * 
 * ARCHITECTURAL RULE: This component MUST appear on every Ambassador portal page.
 * It guarantees that "My Purchases" and all other sections are always reachable,
 * regardless of how the user entered the portal.
 * 
 * Navigation items are hard-mounted — no conditional rendering based on
 * purchase count, feature flags, onboarding state, or account age.
 */
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Store, Target, ShoppingBag,
  MapPin, DollarSign, Package, MessageSquare, BarChart3, UserPlus, Users, Wallet, TrendingUp, MessageSquareWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const AMBASSADOR_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/ambassador/dashboard', icon: LayoutDashboard },
  { id: 'stores', label: 'My Stores', path: '/ambassador/stores', icon: Store },
  { id: 'sell-through', label: 'Sell-Through', path: '/ambassador/sell-through', icon: BarChart3 },
  { id: 'leads', label: 'Leads', path: '/ambassador/leads', icon: Target },
  { id: 'catalog', label: 'Product Pricing', path: '/ambassador/catalog', icon: Package },
  { id: 'purchases', label: 'My Purchases', path: '/ambassador/purchases', icon: ShoppingBag },
  { id: 'commissions', label: 'Commissions', path: '/ambassador/commissions', icon: DollarSign },
  { id: 'orders', label: 'Orders', path: '/ambassador/orders', icon: Package },
  { id: 'routes', label: 'Routes', path: '/ambassador/routes', icon: MapPin },
  { id: 'communications', label: 'Messages', path: '/ambassador/communications', icon: MessageSquare },
  { id: 'recruitment', label: 'Recruitment', path: '/ambassador/recruitment', icon: Users },
  { id: 'request-ambassador', label: 'Team Expansion', path: '/ambassador/request-ambassador', icon: UserPlus },
  { id: 'payouts', label: 'Payouts', path: '/ambassador/payouts', icon: Wallet },
  { id: 'earnings', label: 'Earnings', path: '/ambassador/reports/earnings', icon: TrendingUp },
] as const;

export function AmbassadorPortalNav() {
  const location = useLocation();

  // Regression guard: log warning if this component renders without expected route context
  if (import.meta.env.DEV && !location.pathname.startsWith('/ambassador')) {
    console.warn(
      '⚠️ AmbassadorPortalNav rendered outside /ambassador/* route context:',
      location.pathname
    );
  }

  return (
    <div className="border-b bg-card/50 backdrop-blur-sm -mx-4 px-4 mb-6">
      <ScrollArea className="w-full">
        <nav className="flex items-center gap-1 py-1" role="navigation" aria-label="Ambassador portal navigation">
          {AMBASSADOR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/ambassador/dashboard'
                ? location.pathname === '/ambassador/dashboard'
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default AmbassadorPortalNav;
