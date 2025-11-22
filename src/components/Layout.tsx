import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { navigationItems } from '@/components/layout/navigationItems';
import { realEstateNavItems } from '@/components/layout/realEstateNavigation';
import { podNavigationItems } from '@/components/layout/podNavigation';
import { callCenterNavItems } from '@/components/layout/callCenterNavigation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SendMessageModal } from '@/components/communication/SendMessageModal';
import { 
  LayoutDashboard,
  Store, 
  Map, 
  MapPin,
  Upload,
  Users, 
  Package, 
  TrendingUp, 
  LogOut,
  Menu,
  Building2,
  MessageCircle,
  MessageSquarePlus,
  Target,
  Brain,
  Radar,
  Trophy,
  Settings,
  FileText,
  BarChart3,
  Navigation,
  Gift,
  DollarSign,
  Home,
  Phone,
  Mail,
  Shirt,
  Building,
  FileSearch,
  FileSignature,
  CreditCard,
  Warehouse,
  Mic,
  MessageSquare,
  PhoneCall,
  CheckSquare
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, userRole } = useAuth();
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);

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


  // Normalize role to lowercase
  const normalizedRole = userRole?.trim().toLowerCase() || null;
  
  console.log('🎯 FINAL ROLE:', normalizedRole);
  
  // Filter function: show if no roles defined OR role matches
  const filterByRole = (items: typeof navigationItems) => 
    items.filter(item => item.roles.length === 0 || (normalizedRole && item.roles.includes(normalizedRole)));
  
  const filteredNavItems = filterByRole(navigationItems);
  const filteredRealEstateNavItems = filterByRole(realEstateNavItems);
  const filteredPodNavItems = filterByRole(podNavigationItems);
  const filteredCallCenterNavItems = filterByRole(callCenterNavItems);

  const showRealEstateSection = filteredRealEstateNavItems.length > 0;
  const showPodSection = filteredPodNavItems.length > 0;
  const showCallCenterSection = filteredCallCenterNavItems.length > 0;
  
  console.log('👁️ Visible Sections:', { 
    realestate: showRealEstateSection, 
    pod: showPodSection, 
    callcenter: showCallCenterSection 
  });

  const NavItems = () => (
    <>
      {/* DEBUG BOX */}
      <div style={{
        background: '#111',
        color: 'white',
        padding: '12px',
        fontSize: '11px',
        border: '2px solid red',
        marginBottom: '12px',
        borderRadius: '4px'
      }}>
        <strong>🔍 SIDEBAR DEBUG</strong><br/>
        <strong>Role:</strong> {normalizedRole ? normalizedRole : 'NULL'}<br/>
        <strong>Raw Role:</strong> {userRole ? userRole : 'NULL'}<br/>
        <strong>RealEstate:</strong> {filteredRealEstateNavItems?.length || 0}/{realEstateNavItems?.length || 0}<br/>
        <strong>POD:</strong> {filteredPodNavItems?.length || 0}/{podNavigationItems?.length || 0}<br/>
        <strong>CallCenter:</strong> {filteredCallCenterNavItems?.length || 0}/{callCenterNavItems?.length || 0}<br/>
        <strong style={{color: showRealEstateSection ? 'lime' : 'red'}}>RE Visible: {showRealEstateSection ? 'YES' : 'NO'}</strong><br/>
        <strong style={{color: showPodSection ? 'lime' : 'red'}}>POD Visible: {showPodSection ? 'YES' : 'NO'}</strong><br/>
        <strong style={{color: showCallCenterSection ? 'lime' : 'red'}}>CC Visible: {showCallCenterSection ? 'YES' : 'NO'}</strong>
      </div>

      {filteredNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors relative"
          activeClassName="bg-primary/10 text-primary hover:bg-primary/20"
        >
          <item.icon className="h-5 w-5" />
          <span className="font-medium">{item.label}</span>
          {item.to === '/reports/executive' && unreadReportsCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {unreadReportsCount}
            </span>
          )}
        </NavLink>
      ))}
      
      {showRealEstateSection && (
        <>
          <div className="pt-4 pb-2 mt-2 border-t border-border/50">
            <div className="px-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Building className="h-4 w-4" />
              <span>Real Estate Department</span>
            </div>
          </div>
          {filteredRealEstateNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              activeClassName="bg-primary/10 text-primary hover:bg-primary/20"
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </>
      )}

      {showPodSection && (
        <>
          <div className="pt-4 pb-2 mt-2 border-t border-border/50">
            <div className="px-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Shirt className="h-4 w-4" />
              <span>POD Department</span>
            </div>
          </div>
          {filteredPodNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              activeClassName="bg-primary/10 text-primary hover:bg-primary/20"
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </>
      )}

      {showCallCenterSection && (
        <>
          <div className="pt-4 pb-2 mt-2 border-t border-border/50">
            <div className="px-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Phone className="h-4 w-4" />
              <span>📞 Call Center Cloud</span>
            </div>
          </div>
          {filteredCallCenterNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              activeClassName="bg-primary/10 text-primary hover:bg-primary/20"
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </>
      )}
    </>
  );

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
              <div className="flex flex-col h-full py-6">
                <div className="px-4 mb-6">
                  <h2 className="text-xl font-bold text-primary">GasMask OS</h2>
                </div>
                <nav className="flex-1 space-y-1 px-3">
                  <NavItems />
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
            <h1 className="text-xl font-bold hidden sm:block">GasMask Universe OS</h1>
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
        <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card/50 min-h-[calc(100vh-4rem)]">
          <nav className="flex-1 space-y-1 p-4">
            <NavItems />
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
