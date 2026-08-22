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
  MapPin, DollarSign, Package, MessageSquare, BarChart3, UserPlus, Users, Wallet, TrendingUp, MessageSquareWarning, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { isDispatchWired, DISPATCH_TOOLTIP } from '@/config/dispatchRegistry';
import { useTranslation } from '@/hooks/useTranslation';

const AMBASSADOR_NAV_ITEMS = [
  { id: 'dashboard', i18n: 'ambassador.nav.dashboard', label: 'Dashboard', path: '/ambassador/dashboard', icon: LayoutDashboard },
  { id: 'stores', i18n: 'ambassador.nav.stores', label: 'My Stores', path: '/ambassador/stores', icon: Store },
  { id: 'sell-through', i18n: 'ambassador.nav.sell_through', label: 'Sell-Through', path: '/ambassador/sell-through', icon: BarChart3 },
  { id: 'leads', i18n: 'ambassador.nav.leads', label: 'Leads', path: '/ambassador/leads', icon: Target },
  { id: 'catalog', i18n: 'ambassador.nav.catalog', label: 'Product Pricing', path: '/ambassador/catalog', icon: Package },
  { id: 'dd-order', i18n: 'ambassador.nav.dd_order', label: '🛒 DD Catalog', path: '/ambassador/dd-order', icon: ShoppingBag },
  { id: 'purchases', i18n: 'ambassador.nav.purchases', label: 'My Purchases', path: '/ambassador/purchases', icon: ShoppingBag },
  { id: 'commissions', i18n: 'ambassador.nav.commissions', label: 'Commissions', path: '/ambassador/commissions', icon: DollarSign },
  { id: 'orders', i18n: 'ambassador.nav.orders', label: 'Orders', path: '/ambassador/orders', icon: Package },
  { id: 'routes', i18n: 'ambassador.nav.routes', label: 'Routes', path: '/ambassador/routes', icon: MapPin },
  { id: 'tasks', i18n: 'ambassador.nav.tasks', label: 'Tasks', path: '/ambassador/tasks', icon: ClipboardList },
  { id: 'communications', i18n: 'ambassador.nav.messages', label: 'Messages', path: '/ambassador/communications', icon: MessageSquare },
  { id: 'recruitment', i18n: 'ambassador.nav.recruitment', label: 'Recruitment', path: '/ambassador/recruitment', icon: Users },
  { id: 'request-ambassador', i18n: 'ambassador.nav.team_expansion', label: 'Team Expansion', path: '/ambassador/request-ambassador', icon: UserPlus },
  { id: 'payouts', i18n: 'ambassador.nav.payouts', label: 'Payouts', path: '/ambassador/payouts', icon: Wallet },
  { id: 'earnings', i18n: 'ambassador.nav.earnings', label: 'Earnings', path: '/ambassador/reports/earnings', icon: TrendingUp },
  { id: 'feedback', i18n: 'ambassador.nav.feedback', label: 'Feedback', path: '/ambassador/feedback', icon: MessageSquareWarning },
  { id: 'end-of-day', i18n: 'ambassador.nav.end_of_day', label: 'End-of-Day', path: '/ambassador/end-of-day', icon: ClipboardList },
] as const;

export function AmbassadorPortalNav() {
  const location = useLocation();
  const { t, language } = useTranslation();

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
            const wired = isDispatchWired(item.path);

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
                <span className="hidden sm:inline">
                  {t(item.i18n)}
                  {language !== 'en' && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {item.label}
                    </span>
                  )}
                </span>
                {wired && (
                  <span
                    title={DISPATCH_TOOLTIP}
                    aria-label={DISPATCH_TOOLTIP}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] shrink-0"
                  />
                )}
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
