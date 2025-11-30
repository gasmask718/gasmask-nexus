import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Menu, X, LogOut, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useAuth } from '@/contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// ORIGINAL GRABBA SKYSCRAPER NAVIGATION
// Penthouse + Floors 1-8 Architecture (RESTORED)
// ═══════════════════════════════════════════════════════════════════════════════
import {
  GRABBA_PENTHOUSE,
  GRABBA_FLOORS,
  GRABBA_BRAND_CONFIG,
  type GrabbaFloor,
} from '@/config/grabbaSkyscraper';

// Additional navigation sections (existing separate systems)
import { navigationItems } from '@/components/layout/navigationItems';
import { realEstateNavItems } from '@/components/layout/realEstateNavigation';
import { podNavigationItems } from '@/components/layout/podNavigation';
import { callCenterNavItems } from '@/components/layout/callCenterNavigation';
import { communicationNavItems } from '@/components/layout/communicationNavigation';

export default function AppSidebar() {
  const location = useLocation();
  const { data: profileData } = useCurrentUserProfile();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  
  // All floors open by default
  const [openSections, setOpenSections] = useState<string[]>([
    'penthouse',
    ...GRABBA_FLOORS.map(f => f.id),
    'external-brands',
    'departments',
    'portals',
  ]);

  const userRole = profileData?.profile?.primary_role || 'admin';
  const isAdmin = ['admin', 'ceo', 'va'].includes(userRole);

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

  // Render a single floor section
  const renderFloorSection = (floor: GrabbaFloor, isPenthouse = false) => {
    const isOpen = openSections.includes(floor.id);
    const FloorIcon = floor.icon;

    return (
      <div key={floor.id} className="mb-1">
        <button
          onClick={() => toggleSection(floor.id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors",
            isPenthouse
              ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 hover:from-amber-500/30"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
          )}
        >
          <span className="text-base">{floor.emoji}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{floor.name}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>

        {isOpen && !collapsed && (
          <div className="ml-4 mt-1 space-y-0.5">
            <Link
              to={floor.path}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                isPathActive(floor.path)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              )}
            >
              <FloorIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">Overview</span>
            </Link>
          </div>
        )}
      </div>
    );
  };

  // Render additional nav items section
  const renderNavSection = (title: string, sectionId: string, items: any[], emoji: string) => {
    const isOpen = openSections.includes(sectionId);

    return (
      <div key={sectionId} className="mb-1">
        <button
          onClick={() => toggleSection(sectionId)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent/30 rounded-md transition-colors"
        >
          <span className="text-base">{emoji}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{title}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>

        {isOpen && !collapsed && (
          <div className="ml-4 mt-1 space-y-0.5">
            {items
              .filter(item => !item.roles || item.roles.includes(userRole) || isAdmin)
              .map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.to || idx}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                      isPathActive(item.to)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                    )}
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
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
      <div className="px-4 py-4 border-b border-sidebar-border bg-gradient-to-r from-purple-900/20 to-transparent flex items-center justify-between">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold">🔥 Grabba OS</h1>
            <p className="text-xs text-sidebar-foreground/60">Dynasty Command Center</p>
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

      {/* Brand Pills */}
      {!collapsed && isAdmin && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex gap-1 flex-wrap">
            {Object.values(GRABBA_BRAND_CONFIG).map(brand => (
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

      <ScrollArea className="flex-1">
        <div className="p-2">
          
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 👑 PENTHOUSE — Command Center */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-4">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-amber-400/80 tracking-wider">
              👑 Command Penthouse
            </div>
            {renderFloorSection(GRABBA_PENTHOUSE, true)}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🏢 FLOORS 1-8 — Grabba Empire */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-4 pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              🏢 Floors 1-8
            </div>
            {GRABBA_FLOORS.map(floor => renderFloorSection(floor))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🏭 DEPARTMENTS — Call Center, Communication, POD, Real Estate */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🏭 Departments
              </div>
              {renderNavSection('Communication Hub', 'comm-hub', communicationNavItems, '📞')}
              {renderNavSection('Call Center Cloud', 'call-center', callCenterNavItems, '☎️')}
              {renderNavSection('Real Estate', 'real-estate', realEstateNavItems, '🏠')}
              {renderNavSection('POD Department', 'pod', podNavigationItems, '🎨')}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🌐 EXTERNAL BRANDS — GasMask, HotMama, Playboxxx, TopTier, iClean */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🌐 External Brands
              </div>
              
              {/* GasMask OS */}
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('gasmask-os')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <span>🔴</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">GasMask OS</span>
                      {openSections.includes('gasmask-os') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
                {openSections.includes('gasmask-os') && !collapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    <Link to="/grabba/brand/gasmask" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/grabba/brand/gasmask') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* HotMama / Scalati */}
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('hotmama-os')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                >
                  <span>🟣</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">HotMama / Scalati</span>
                      {openSections.includes('hotmama-os') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
                {openSections.includes('hotmama-os') && !collapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    <Link to="/grabba/brand/hotmama" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/grabba/brand/hotmama') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>HotMama Dashboard</span>
                    </Link>
                    <Link to="/grabba/brand/scalati" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/grabba/brand/scalati') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>Scalati Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Playboxxx */}
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('playboxxx-os')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-pink-400 hover:bg-pink-500/10 rounded-md transition-colors"
                >
                  <span>🎀</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Playboxxx OS</span>
                      {openSections.includes('playboxxx-os') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
                {openSections.includes('playboxxx-os') && !collapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    <Link to="/playboxxx" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/playboxxx') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* TopTier */}
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('toptier-os')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                >
                  <span>💎</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">TopTier OS</span>
                      {openSections.includes('toptier-os') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
                {openSections.includes('toptier-os') && !collapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    <Link to="/toptier" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/toptier') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* iClean */}
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('iclean-os')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/10 rounded-md transition-colors"
                >
                  <span>🧹</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">iClean WeClean</span>
                      {openSections.includes('iclean-os') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
                {openSections.includes('iclean-os') && !collapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    <Link to="/iclean" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/iclean') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Unforgettable Times */}
              <div className="mb-1">
                <button
                  onClick={() => toggleSection('unforgettable-os')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10 rounded-md transition-colors"
                >
                  <span>⭐</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Unforgettable Times</span>
                      {openSections.includes('unforgettable-os') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
                {openSections.includes('unforgettable-os') && !collapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    <Link to="/unforgettable" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/unforgettable') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                      <span>Dashboard</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 📊 MAIN TOOLS — General navigation */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                📊 Main Tools
              </div>
              {renderNavSection('General', 'main-nav', navigationItems.slice(0, 20), '🧰')}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🚪 ROLE PORTALS — Driver, Biker, Ambassador, Store, etc. */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-4 pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              🚪 Role Portals
            </div>
            <div className="space-y-0.5 ml-2">
              <Link to="/portal/home" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/home') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🏠 Portal Home</span>
              </Link>
              <Link to="/portal/driver" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/driver') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🚗 Driver Portal</span>
              </Link>
              <Link to="/portal/biker" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/biker') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🚴 Biker Portal</span>
              </Link>
              <Link to="/portal/ambassador" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/ambassador') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🤝 Ambassador Portal</span>
              </Link>
              <Link to="/portal/store" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/store') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🏪 Store Portal</span>
              </Link>
              <Link to="/portal/wholesaler" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/wholesaler') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>📦 Wholesaler Portal</span>
              </Link>
              <Link to="/portal/production" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/production') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🏭 Production Portal</span>
              </Link>
              <Link to="/portal/va" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/va') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>👩‍💼 VA Portal</span>
              </Link>
              {isAdmin && (
                <>
                  <Link to="/ai/workforce" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/ai/workforce') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                    <span>🤖 AI Workforce</span>
                  </Link>
                  <Link to="/portal/marketplace-admin" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/marketplace-admin') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                    <span>🛒 Marketplace Admin</span>
                  </Link>
                </>
              )}
            </div>
          </div>

        </div>
      </ScrollArea>

      {/* User Footer */}
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
              <Link to="/settings" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Settings
                </Button>
              </Link>
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
    </div>
  );
}
