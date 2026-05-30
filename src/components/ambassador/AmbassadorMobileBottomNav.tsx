/**
 * AmbassadorMobileBottomNav — fixed bottom tab bar for ambassador portal on mobile.
 *
 * The global sidebar isn't optimized for phones, and ambassadors live on their
 * phones in the field. This bar surfaces the 5 most-used tabs always, with the
 * full nav reachable via the AmbassadorPortalNav scroll bar above.
 *
 * Hidden ≥ md (sidebar/scroll-nav handles desktop).
 */
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, Target, DollarSign, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'dashboard', label: 'Home', path: '/ambassador/dashboard', icon: LayoutDashboard },
  { id: 'stores', label: 'Stores', path: '/ambassador/stores', icon: Store },
  { id: 'leads', label: 'Leads', path: '/ambassador/leads', icon: Target },
  { id: 'commissions', label: 'Earnings', path: '/ambassador/commissions', icon: DollarSign },
  { id: 'communications', label: 'Inbox', path: '/ambassador/communications', icon: MessageSquare },
] as const;

export function AmbassadorMobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      role="navigation"
      aria-label="Ambassador mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.path === '/ambassador/dashboard'
              ? location.pathname === '/ambassador/dashboard'
              : location.pathname.startsWith(tab.path);

          return (
            <li key={tab.id}>
              <Link
                to={tab.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default AmbassadorMobileBottomNav;
