import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronRight, Menu, X, LogOut, User, Globe } from 'lucide-react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { 
  OS_FLOORS, 
  PORTALS, 
  DYNASTY_BRANDS,
  getNavForRole, 
  type OSRole, 
  type OSFloor 
} from '@/config/osNavigation';

interface AppSidebarProps {
  className?: string;
}

export default function AppSidebar({ className }: AppSidebarProps) {
  const location = useLocation();
  const { data: profileData } = useCurrentUserProfile();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [openFloors, setOpenFloors] = useState<string[]>(['penthouse']);

  // Get user role from profile
  const userRole = (profileData?.profile?.primary_role as OSRole) || 'admin';
  const isAdmin = userRole === 'admin' || userRole === 'ceo' || userRole === 'va';

  // Get navigation items for the user's role
  const navFloors = isAdmin ? OS_FLOORS : getNavForRole(userRole);

  const toggleFloor = (floorId: string) => {
    setOpenFloors(prev => 
      prev.includes(floorId) 
        ? prev.filter(id => id !== floorId)
        : [...prev, floorId]
    );
  };

  const isPathActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">OS</span>
            </div>
            <div>
              <h1 className="font-bold text-sidebar-foreground">Dynasty OS</h1>
              <p className="text-xs text-sidebar-foreground/60">Fortune 500 Command</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Brand Badges */}
      {!collapsed && isAdmin && (
        <div className="p-3 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60 mb-2">Active Brands</p>
          <div className="flex gap-1 flex-wrap">
            {Object.values(DYNASTY_BRANDS).map(brand => (
              <Badge 
                key={brand.id}
                variant="outline"
                className="text-xs"
                style={{ borderColor: brand.color, color: brand.color }}
              >
                {brand.icon} {brand.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {navFloors.map((floor) => (
            <FloorNavSection
              key={floor.id}
              floor={floor}
              collapsed={collapsed}
              isOpen={openFloors.includes(floor.id)}
              onToggle={() => toggleFloor(floor.id)}
              isPathActive={isPathActive}
            />
          ))}

          {/* Portals Section for Admin */}
          {isAdmin && !collapsed && (
            <>
              <Separator className="my-4" />
              <div className="px-2 py-1">
                <p className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                  Role Portals
                </p>
              </div>
              <div className="space-y-1">
                {PORTALS.filter(p => !['admin', 'ceo'].includes(p.role)).map(portal => (
                  <NavLink
                    key={portal.id}
                    to={portal.path}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <portal.icon className="h-4 w-4" style={{ color: portal.color }} />
                    <span>{portal.label}</span>
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profileData?.profile?.full_name || user?.email || 'User'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="flex-1 text-xs">
                <Globe className="h-3 w-3 mr-1" />
                EN
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex-1 text-xs text-destructive hover:text-destructive"
                onClick={() => signOut()}
              >
                <LogOut className="h-3 w-3 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-full text-destructive hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}

// Floor Navigation Section Component
interface FloorNavSectionProps {
  floor: OSFloor;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isPathActive: (path: string) => boolean;
}

function FloorNavSection({ floor, collapsed, isOpen, onToggle, isPathActive }: FloorNavSectionProps) {
  const hasActiveChild = floor.items.some(item => isPathActive(item.path));

  if (collapsed) {
    // Collapsed view - just show icon for first item
    const firstItem = floor.items[0];
    if (!firstItem) return null;

    return (
      <NavLink
        to={firstItem.path}
        className={cn(
          "flex items-center justify-center p-2 rounded-md transition-colors",
          isPathActive(firstItem.path) 
            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
        )}
        title={floor.name}
      >
        <floor.icon className="h-5 w-5" />
      </NavLink>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-between px-3 py-2 h-auto",
            hasActiveChild && "bg-sidebar-accent/30"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{floor.emoji}</span>
            <span className="text-sm font-medium">{floor.name}</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" />
          ) : (
            <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-0.5 mt-1">
        {floor.items.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
              isActive 
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
