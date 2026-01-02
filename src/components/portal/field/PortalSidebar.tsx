import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  ClipboardCheck, 
  Truck, 
  FileText, 
  History, 
  MessageSquare, 
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface PortalSidebarProps {
  portalType: 'driver' | 'biker';
}

export function PortalSidebar({ portalType }: PortalSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const basePath = portalType === 'driver' ? '/portal/driver' : '/portal/biker';

  const navItems: NavItem[] = [
    { label: 'My Day', path: basePath, icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Stores / Stops', path: `${basePath}/stores`, icon: <Store className="h-5 w-5" /> },
    { label: 'Start Visit', path: `${basePath}/visit`, icon: <ClipboardCheck className="h-5 w-5" /> },
    ...(portalType === 'driver' ? [
      { label: 'Make Delivery', path: `${basePath}/delivery`, icon: <Truck className="h-5 w-5" /> },
    ] : []),
    { label: 'Change Lists', path: `${basePath}/changes`, icon: <FileText className="h-5 w-5" /> },
    { label: 'History', path: `${basePath}/history`, icon: <History className="h-5 w-5" /> },
    { label: 'Messages', path: `${basePath}/messages`, icon: <MessageSquare className="h-5 w-5" /> },
    { label: 'Profile', path: `${basePath}/profile`, icon: <User className="h-5 w-5" /> },
  ];

  return (
    <aside 
      className={cn(
        'h-screen sticky top-0 border-r bg-card/50 backdrop-blur-sm transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo / Header */}
      <div className="p-4 border-b flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                {portalType === 'driver' ? 'D' : 'B'}
              </span>
            </div>
            <span className="font-semibold text-sm">
              {portalType === 'driver' ? 'Driver' : 'Biker'} Portal
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== basePath && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                'hover:bg-muted/50',
                isActive && 'bg-primary/10 text-primary font-medium',
                collapsed && 'justify-center px-2'
              )}
            >
              {item.icon}
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        {!collapsed && (
          <p className="text-xs text-muted-foreground text-center">
            Dynasty OS v2.0
          </p>
        )}
      </div>
    </aside>
  );
}
