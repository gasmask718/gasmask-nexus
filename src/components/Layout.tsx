import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { BusinessSwitcher } from '@/components/business/BusinessSwitcher';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SendMessageModal } from '@/components/communication/SendMessageModal';
import { departmentThemes } from '@/config/departmentThemes';
import '@/theme/departmentStyles.css';
import { useLocation } from 'react-router-dom';
import { dynastyFloors } from '@/config/dynastyBrands';
import { GRABBA_PENTHOUSE, GRABBA_FLOORS, getGrabbaNavItems } from '@/config/grabbaSkyscraper';
import { 
  LogOut,
  Menu,
  MessageSquarePlus,
  Package,
  ChevronDown,
  ChevronRight,
  Crown,
  Building
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, userRole } = useAuth();
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const location = useLocation();
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [expandedFloors, setExpandedFloors] = useState<string[]>(['grabba-companies', 'systems-engine']);
  
  const currentPath = location.pathname;

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (userRole === 'admin') {
      const fetchUnreadCount = async () => {
        const { count } = await supabase
          .from('executive_reports')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);
        
        setUnreadReportsCount(count || 0);
      };

      fetchUnreadCount();

      // Subscribe to real-time updates
      const channel = supabase
        .channel('executive-reports-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'executive_reports'
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole]);

  // Show loading state while business context initializes
  if (businessLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }


  const toggleFloor = (floorId: string) => {
    setExpandedFloors(prev =>
      prev.includes(floorId)
        ? prev.filter(id => id !== floorId)
        : [...prev, floorId]
    );
  };

  const FloorNavigation = () => {
    const isGrabbaExpanded = expandedFloors.includes('grabba-companies');
    const grabbaNavItems = getGrabbaNavItems();

    return (
      <div className="space-y-2">
        {/* Dynasty OS Title */}
        <div className="px-3 py-2 mb-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dynasty OS
          </h2>
        </div>

        {/* CEO Command Center - Premium Top-Level Link */}
        <div className="mb-4 px-1">
          <NavLink
            to="/system-operations/ai-ceo-control-room"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold",
              "bg-gradient-to-r from-[#FFD700] via-[#B8860B] to-[#000000]",
              "text-white shadow-lg hover:shadow-xl hover:shadow-yellow-500/60",
              "hover:scale-[1.02] active:scale-[0.98]",
              "border border-yellow-600/30"
            )}
          >
            <Crown className="h-5 w-5" />
            <span className="tracking-wide">CEO Command Center</span>
          </NavLink>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* 🏢 GRABBA COMPANIES — Unified Skyscraper Navigation                        */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-1">
          <button
            onClick={() => toggleFloor('grabba-companies')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-foreground hover:bg-muted/50 rounded-md transition-colors bg-gradient-to-r from-red-500/10 to-yellow-500/10 border border-red-500/20"
          >
            {isGrabbaExpanded ? (
              <ChevronDown className="h-4 w-4 text-red-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-red-500" />
            )}
            <Building className="h-4 w-4 text-red-500" />
            <span className="flex-1 text-left text-red-600">GRABBA COMPANIES</span>
          </button>

          {isGrabbaExpanded && (
            <div className="ml-2 space-y-0.5 border-l-2 border-red-500/30 pl-2">
              {/* 👑 Penthouse - Always First */}
              <NavLink
                to={GRABBA_PENTHOUSE.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-all",
                  currentPath === GRABBA_PENTHOUSE.path
                    ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-600 font-semibold border-l-2 border-yellow-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="flex-1">{GRABBA_PENTHOUSE.emoji} {GRABBA_PENTHOUSE.name}</span>
              </NavLink>

              {/* 🏢 8 Floors */}
              {GRABBA_FLOORS.map((floor, index) => {
                const isActive = currentPath === floor.path || currentPath.startsWith(floor.path + '/');
                const FloorIcon = floor.icon;

                return (
                  <NavLink
                    key={floor.id}
                    to={floor.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                      isActive
                        ? "bg-red-500/10 text-red-600 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    title={floor.description}
                  >
                    <FloorIcon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-red-500")} />
                    <span className="flex-1">F{index + 1}: {floor.name}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* OTHER DYNASTY FLOORS (Service, Finance, etc.)                              */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {dynastyFloors.filter(floor => floor.id !== 'product-companies').map((floor) => {
          const isExpanded = expandedFloors.includes(floor.id);
          return (
            <div key={floor.id} className="space-y-1">
              {/* Floor Header */}
              <button
                onClick={() => toggleFloor(floor.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded-md transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <floor.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{floor.name}</span>
              </button>

              {/* Floor Brands */}
              {isExpanded && (
                <div className="ml-4 space-y-3 border-l-2 border-border pl-3">
                  {floor.brands.map((brand) => (
                    <div key={brand.id} className="space-y-1">
                      {/* Brand Header with Color */}
                      <div
                        className="px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${brand.colors.primary}15`,
                          color: brand.colors.primary,
                          borderLeft: `3px solid ${brand.colors.primary}`
                        }}
                      >
                        {brand.name}
                      </div>

                      {/* Brand Routes */}
                      <div className="space-y-0.5">
                        {brand.routes.map((route) => {
                          const isActive = currentPath === route.path || currentPath.startsWith(route.path + '/');
                          const Icon = route.icon;

                          return (
                            <NavLink
                              key={route.path}
                              to={route.path}
                              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                                isActive
                                  ? 'font-medium'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              }`}
                              style={
                                isActive
                                  ? {
                                      backgroundColor: `${brand.colors.primary}20`,
                                      color: brand.colors.primary
                                    }
                                  : undefined
                              }
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="flex-1">{route.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center px-4 gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full overflow-hidden py-6">
                <div className="px-4 mb-6 flex-shrink-0 space-y-3">
                  <h2 className="text-xl font-bold text-primary">Dynasty OS</h2>
                  {!businessLoading && currentBusiness && (
                    <BusinessSwitcher />
                  )}
                </div>
                <nav className="flex-1 overflow-y-auto space-y-1 px-3 scrollbar-thin scrollbar-thumb-accent/40 scrollbar-track-transparent">
            <FloorNavigation />
                </nav>
                <div className="px-3 pt-4 border-t border-border/50">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                    onClick={signOut}
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold hidden sm:block">Dynasty OS</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendMessageOpen(true)}
              className="border-primary/50"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              New Message
            </Button>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hidden md:flex"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card/50 h-[calc(100vh-4rem)] overflow-hidden">
          <div className="p-4 border-b border-border/50">
            {!businessLoading && currentBusiness && (
              <BusinessSwitcher />
            )}
          </div>
          <nav className="flex-1 overflow-y-auto space-y-1 p-4 scrollbar-thin scrollbar-thumb-accent/40 scrollbar-track-transparent">
            <FloorNavigation />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      <SendMessageModal open={sendMessageOpen} onOpenChange={setSendMessageOpen} />
    </div>
  );
};

export default Layout;
