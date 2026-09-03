import { NavLink, useLocation } from 'react-router-dom';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getOpsNavItems } from '@/config/opsNavigation';
import { useOpsUnreadCount } from '@/hooks/useOpsInbox';
import { cn } from '@/lib/utils';

export default function OpsBottomNav() {
  const { data, isLoading } = useCurrentUserProfile();
  const { data: unreadCount = 0 } = useOpsUnreadCount();
  const { pathname } = useLocation();

  if (isLoading || !data?.profile) return null;

  const role = data.profile.primary_role;
  // Inside the Dynasty Direct wholesaler portal the nav follows the portal,
  // not the user's primary role (an owner/admin visiting it still needs the
  // wholesaler tabs, never the GasMask ops tabs).
  const items = pathname.startsWith('/portal/wholesaler')
    ? getOpsNavItems('wholesaler')
    : getOpsNavItems(role);


  if (items.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/portal/driver' || item.path === '/portal/biker' || item.path === '/portal/store' || item.path === '/portal/wholesaler' || item.path === '/portal/customer' || item.path === '/portal/production' || item.path === '/ambassador/dashboard' || item.path === '/portal/influencer' || item.path === '/portal/inbox'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[56px] min-w-[48px] flex-1 text-[11px] sm:text-xs transition-colors relative touch-manipulation',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate max-w-[56px] sm:max-w-[64px]">{item.label}</span>
            {item.path === '/portal/inbox' && unreadCount > 0 && (
              <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
