import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Menu, X, LogOut, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  getPortalConfig, 
  isElevatedRole,
  PortalConfig,
  PortalSection,
  type PortalRole 
} from '@/config/portalSidebars';

/**
 * PORTAL SIDEBAR — ROLE-BASED NAVIGATION
 * 
 * Renders a role-specific sidebar based on the user's primary role.
 * Implements strict navigation isolation per MASTER PROMPT #4.
 */

export function PortalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { role, roles, loading, isAdmin } = useUserRole();
  
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);

  // Get portal config based on user's role
  const portalConfig = useMemo((): PortalConfig | null => {
    if (!role) return null;
    return getPortalConfig(role as PortalRole);
  }, [role]);

  // Open sections that contain the current path
  useMemo(() => {
    if (!portalConfig) return;
    
    const sectionsToOpen: string[] = [];
    for (const section of portalConfig.sections) {
      for (const item of section.items) {
        if (location.pathname === item.path || location.pathname.startsWith(item.path + '/')) {
          sectionsToOpen.push(section.id);
          break;
        }
      }
    }
    
    if (sectionsToOpen.length > 0) {
      setOpenSections(prev => [...new Set([...prev, ...sectionsToOpen])]);
    }
  }, [location.pathname, portalConfig]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isPathActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border h-screen",
        "w-72"
      )}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // No config = show minimal sidebar
  if (!portalConfig) {
    return (
      <div className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border h-screen",
        "w-72"
      )}>
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-lg font-bold">Dynasty OS</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No portal access</p>
        </div>
      </div>
    );
  }

  const elevated = isElevatedRole(role as PortalRole);

  // Render section
  const renderSection = (section: PortalSection) => {
    const isOpen = openSections.includes(section.id);
    
    return (
      <div key={section.id} className="mb-1">
        <button
          onClick={() => toggleSection(section.id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors",
            section.titleClass || "text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
          )}
        >
          <span className="text-base">{section.emoji}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{section.title}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
        {isOpen && !collapsed && (
          <div className="ml-4 mt-1 space-y-0.5">
            {section.items.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                  isPathActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                )}
              >
                {item.emoji && <span>{item.emoji}</span>}
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border h-screen transition-all duration-300",
      collapsed ? "w-16" : "w-72"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-4 border-b border-sidebar-border flex items-center justify-between",
        elevated 
          ? "bg-gradient-to-r from-purple-900/20 to-transparent"
          : "bg-gradient-to-r from-slate-800/20 to-transparent"
      )}>
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              {elevated && <span>🏛️</span>}
              {portalConfig.name}
            </h1>
            <p className="text-xs text-sidebar-foreground/60">{portalConfig.description}</p>
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

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                elevated ? "border-amber-500 text-amber-400" : "border-slate-500 text-slate-400"
              )}
            >
              {elevated && <Shield className="h-3 w-3 mr-1" />}
              {role?.toUpperCase()}
            </Badge>
            {roles.length > 1 && (
              <span className="text-xs text-muted-foreground">
                +{roles.length - 1} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {portalConfig.sections.map(renderSection)}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-sidebar-foreground/70">
              <User className="h-4 w-4" />
              <span className="truncate">{user?.email || 'User'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="w-full text-sidebar-foreground/70 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default PortalSidebar;
