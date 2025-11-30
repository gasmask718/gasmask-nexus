import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { BusinessSwitcher } from '@/components/business/BusinessSwitcher';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SendMessageModal } from '@/components/communication/SendMessageModal';
import '@/theme/departmentStyles.css';
import { useLocation, Link } from 'react-router-dom';
import { OS_FLOORS, ADDITIONAL_SECTIONS, PORTALS, type OSFloor, type PortalConfig } from '@/config/osNavigation';
import { 
  LogOut,
  Menu,
  MessageSquarePlus,
  Package,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, userRole } = useAuth();
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const location = useLocation();
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  
  // Force all floors open by default for full visibility
  const [openFloors, setOpenFloors] = useState<string[]>([
    ...OS_FLOORS.map(f => f.id),
    ...ADDITIONAL_SECTIONS.map(s => s.id),
  ]);
  
  const currentPath = location.pathname;

  const isPathActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  const toggleFloor = (id: string) => {
    setOpenFloors(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

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

  const renderFloorSection = (floor: OSFloor) => {
    const isOpen = openFloors.includes(floor.id);
    
    return (
      <div key={floor.id} className="mb-1">
        <button
          onClick={() => toggleFloor(floor.id)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted/50 rounded-md transition-colors"
        >
          <span className="text-base">{floor.emoji}</span>
          <span className="flex-1 text-left truncate text-xs">{floor.name}</span>
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        
        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            {floor.items.map(item => (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors",
                  isPathActive(item.path)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPortal = (portal: PortalConfig) => (
    <Link
      key={portal.id}
      to={portal.path}
      className={cn(
        "flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors",
        isPathActive(portal.path)
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <portal.icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{portal.label}</span>
    </Link>
  );

  const NavigationContent = () => (
    <div className="space-y-2">
      {/* OS FLOORS */}
      <div>
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground/60 tracking-wider">
          OS Floors
        </div>
        {OS_FLOORS.map(renderFloorSection)}
      </div>

      {/* ADMIN SECTIONS */}
      <div className="pt-2 border-t border-border/50">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground/60 tracking-wider">
          Admin Systems
        </div>
        {ADDITIONAL_SECTIONS.map(renderFloorSection)}
      </div>

      {/* ROLE PORTALS */}
      <div className="pt-2 border-t border-border/50">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground/60 tracking-wider">
          Role Portals
        </div>
        <div className="ml-4 space-y-0.5">
          {PORTALS.map(renderPortal)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-14 items-center px-4 gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex flex-col h-full overflow-hidden py-4">
                <div className="px-4 mb-4 flex-shrink-0 space-y-2">
                  <h2 className="text-lg font-bold text-primary">Dynasty OS</h2>
                  <p className="text-xs text-muted-foreground">Fortune 500 Navigation</p>
                  {!businessLoading && currentBusiness && (
                    <BusinessSwitcher />
                  )}
                </div>
                <ScrollArea className="flex-1 px-2">
                  <NavigationContent />
                </ScrollArea>
                <div className="px-3 pt-3 border-t border-border/50">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground text-sm"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
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
            <h1 className="text-lg font-bold hidden sm:block">Dynasty OS</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendMessageOpen(true)}
              className="border-primary/50"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Message</span>
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
        <aside className="hidden md:flex w-72 flex-col border-r border-border/50 bg-card/50 h-[calc(100vh-3.5rem)] overflow-hidden">
          <div className="p-3 border-b border-border/50">
            <h2 className="text-sm font-bold mb-1">Dynasty OS</h2>
            <p className="text-xs text-muted-foreground mb-2">Fortune 500 Navigation</p>
            {!businessLoading && currentBusiness && (
              <BusinessSwitcher />
            )}
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2">
              <NavigationContent />
            </nav>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>

      <SendMessageModal open={sendMessageOpen} onOpenChange={setSendMessageOpen} />
    </div>
  );
};

export default Layout;
