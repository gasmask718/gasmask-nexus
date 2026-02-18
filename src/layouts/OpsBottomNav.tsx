import { NavLink } from 'react-router-dom';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getOpsNavItems } from '@/config/opsNavigation';
import { cn } from '@/lib/utils';

export default function OpsBottomNav() {
  const { data, isLoading } = useCurrentUserProfile();

  if (isLoading || !data?.profile) return null;

  const role = data.profile.primary_role;
  const items = getOpsNavItems(role);

  if (items.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/portal/driver' || item.path === '/portal/biker' || item.path === '/portal/store' || item.path === '/portal/wholesaler' || item.path === '/portal/customer' || item.path === '/portal/production' || item.path === '/ambassador/dashboard' || item.path === '/portal/influencer'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[48px] min-w-[48px] flex-1 text-xs transition-colors',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate max-w-[64px]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
