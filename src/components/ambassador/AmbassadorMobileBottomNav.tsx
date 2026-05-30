/**
 * AmbassadorMobileBottomNav — fixed bottom tab bar for ambassador portal on mobile.
 *
 * The global sidebar isn't optimized for phones, and ambassadors live on their
 * phones in the field. This bar surfaces the 5 most-used tabs always, with the
 * full nav reachable via the AmbassadorPortalNav scroll bar above. Labels are
 * bilingual: when language=ES the Spanish label appears with a small EN
 * subtitle, letting the ambassador learn English while working.
 *
 * Hidden ≥ md (sidebar/scroll-nav handles desktop).
 */
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Store, Target, DollarSign, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

const TABS = [
  { id: 'dashboard', i18n: 'ambassador.nav.home',        en: 'Home',     path: '/ambassador/dashboard', icon: LayoutDashboard },
  { id: 'stores',    i18n: 'ambassador.nav.stores',      en: 'Stores',   path: '/ambassador/stores',    icon: Store },
  { id: 'leads',     i18n: 'ambassador.nav.leads',       en: 'Leads',    path: '/ambassador/leads',     icon: Target },
  { id: 'earnings',  i18n: 'ambassador.nav.commissions', en: 'Earnings', path: '/ambassador/commissions', icon: DollarSign },
  { id: 'inbox',     i18n: 'ambassador.nav.inbox',       en: 'Inbox',    path: '/ambassador/communications', icon: MessageSquare },
] as const;

export function AmbassadorMobileBottomNav() {
  const location = useLocation();
  const { t, language } = useTranslation();

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
          const label = t(tab.i18n);

          return (
            <li key={tab.id}>
              <Link
                to={tab.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors leading-tight',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className="text-center">
                  {label}
                  {language !== 'en' && (
                    <span className="block text-[8px] uppercase tracking-wide opacity-60">
                      {tab.en}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default AmbassadorMobileBottomNav;
