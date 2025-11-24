import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { BusinessSwitcher } from '@/components/business/BusinessSwitcher';
import { communicationNavItems } from '@/components/layout/communicationNavigation';
import { navigationItems } from '@/components/layout/navigationItems';
import { realEstateNavItems } from '@/components/layout/realEstateNavigation';
import { podNavigationItems } from '@/components/layout/podNavigation';
import { callCenterNavItems } from '@/components/layout/callCenterNavigation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SendMessageModal } from '@/components/communication/SendMessageModal';
import { departmentThemes } from '@/config/departmentThemes';
import '@/theme/departmentStyles.css';
import { useLocation } from 'react-router-dom';
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
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const location = useLocation();
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  
  const activeDepartment = location.pathname.startsWith('/real-estate') ? 'realestate'
    : location.pathname.startsWith('/pod') ? 'pod'
    : location.pathname.startsWith('/call-center') ? 'callcenter'
    : location.pathname.startsWith('/communication') ? 'communication'
    : location.pathname.startsWith('/crm') ? 'crm'
    : 'main';

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


  // DEBUG MODE: Temporarily disable role filtering to verify rendering
  // TODO: Re-enable role filtering after confirming visibility
  const normalizedRole = userRole?.trim().toLowerCase() || null;
  
  console.log('🎯 DEBUG MODE - Role filtering DISABLED');
  console.log('🎯 User Role:', normalizedRole);
  
  // FORCE SHOW ALL - No filtering applied
  const filteredNavItems = navigationItems;
  const filteredRealEstateNavItems = realEstateNavItems;
  const filteredPodNavItems = podNavigationItems;
  const filteredCallCenterNavItems = callCenterNavItems;
  const filteredCommunicationNavItems = communicationNavItems;

  // Force all sections to show
  const showRealEstateSection = true;
  const showPodSection = true;
  const showCallCenterSection = true;
  const showCommunicationSection = true;
  
  console.log('👁️ Force Visible - ALL Sections:', { 
    realestate: showRealEstateSection, 
    pod: showPodSection, 
    callcenter: showCallCenterSection,
    communication: showCommunicationSection,
    mainItems: filteredNavItems.length,
    realEstateItems: filteredRealEstateNavItems.length,
    podItems: filteredPodNavItems.length,
    callCenterItems: filteredCallCenterNavItems.length
  });

  const NavItems = () => (
    <>
      {/* Main Navigation */}
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
          <div 
            className="pt-4 pb-2 mt-2 border-t dept-section"
            style={{ 
              borderLeft: `4px solid ${departmentThemes.realEstate.color}`,
              backgroundColor: activeDepartment === 'realestate' ? departmentThemes.realEstate.lightBg : 'transparent'
            }}
          >
            <div 
              className="px-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ 
                color: activeDepartment === 'realestate' ? departmentThemes.realEstate.color : 'inherit',
                fontWeight: activeDepartment === 'realestate' ? 'bold' : 'normal'
              }}
            >
              <Building className="h-4 w-4" />
              <span>Real Estate Department</span>
            </div>
          </div>
          {filteredRealEstateNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: activeDepartment === 'realestate' && location.pathname === item.to 
                  ? departmentThemes.realEstate.lightBg 
                  : activeDepartment === 'realestate' 
                  ? `${departmentThemes.realEstate.lightBg}80`
                  : 'transparent',
                borderLeft: location.pathname === item.to && activeDepartment === 'realestate'
                  ? `3px solid ${departmentThemes.realEstate.accent}`
                  : '3px solid transparent',
                color: activeDepartment === 'realestate' ? departmentThemes.realEstate.color : 'inherit'
              }}
              activeClassName=""
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </>
      )}

      {showPodSection && (
        <>
          <div 
            className="pt-4 pb-2 mt-2 border-t dept-section"
            style={{ 
              borderLeft: `4px solid ${departmentThemes.pod.color}`,
              backgroundColor: activeDepartment === 'pod' ? departmentThemes.pod.lightBg : 'transparent'
            }}
          >
            <div 
              className="px-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ 
                color: activeDepartment === 'pod' ? departmentThemes.pod.color : 'inherit',
                fontWeight: activeDepartment === 'pod' ? 'bold' : 'normal'
              }}
            >
              <Shirt className="h-4 w-4" />
              <span>POD Department</span>
            </div>
          </div>
          {filteredPodNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: activeDepartment === 'pod' && location.pathname === item.to 
                  ? departmentThemes.pod.lightBg 
                  : activeDepartment === 'pod' 
                  ? `${departmentThemes.pod.lightBg}80`
                  : 'transparent',
                borderLeft: location.pathname === item.to && activeDepartment === 'pod'
                  ? `3px solid ${departmentThemes.pod.accent}`
                  : '3px solid transparent',
                color: activeDepartment === 'pod' ? departmentThemes.pod.color : 'inherit'
              }}
              activeClassName=""
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </>
      )}

      {showCallCenterSection && (
        <>
          <div 
            className="pt-4 pb-2 mt-2 border-t dept-section"
            style={{ 
              borderLeft: `4px solid ${departmentThemes.callCenter.color}`,
              backgroundColor: activeDepartment === 'callcenter' ? departmentThemes.callCenter.lightBg : 'transparent'
            }}
          >
            <div 
              className="px-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ 
                color: activeDepartment === 'callcenter' ? departmentThemes.callCenter.color : 'inherit',
                fontWeight: activeDepartment === 'callcenter' ? 'bold' : 'normal'
              }}
            >
              <Phone className="h-4 w-4" />
              <span>Call Center Cloud</span>
            </div>
          </div>
          {filteredCallCenterNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: activeDepartment === 'callcenter' && location.pathname === item.to 
                  ? departmentThemes.callCenter.lightBg 
                  : activeDepartment === 'callcenter' 
                  ? `${departmentThemes.callCenter.lightBg}80`
                  : 'transparent',
                borderLeft: location.pathname === item.to && activeDepartment === 'callcenter'
                  ? `3px solid ${departmentThemes.callCenter.accent}`
                  : '3px solid transparent',
                color: activeDepartment === 'callcenter' ? departmentThemes.callCenter.color : 'inherit'
              }}
              activeClassName=""
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </>
      )}

      {showCommunicationSection && (
        <>
          <div 
            className="pt-4 pb-2 mt-2 border-t dept-section"
            style={{ 
              borderLeft: `4px solid ${departmentThemes.communication.color}`,
              backgroundColor: activeDepartment === 'communication' ? departmentThemes.communication.lightBg : 'transparent'
            }}
          >
            <div 
              className="px-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
              style={{ 
                color: activeDepartment === 'communication' ? departmentThemes.communication.color : 'inherit',
                fontWeight: activeDepartment === 'communication' ? 'bold' : 'normal'
              }}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Communication Center</span>
            </div>
          </div>
          {filteredCommunicationNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: activeDepartment === 'communication' && location.pathname === item.to 
                  ? departmentThemes.communication.lightBg 
                  : activeDepartment === 'communication' 
                  ? `${departmentThemes.communication.lightBg}80`
                  : 'transparent',
                borderLeft: location.pathname === item.to && activeDepartment === 'communication'
                  ? `3px solid ${departmentThemes.communication.accent}`
                  : '3px solid transparent',
                color: activeDepartment === 'communication' ? departmentThemes.communication.color : 'inherit'
              }}
              activeClassName=""
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
              <div className="flex flex-col h-full overflow-hidden py-6">
                <div className="px-4 mb-6 flex-shrink-0 space-y-3">
                  <h2 className="text-xl font-bold text-primary">GasMask OS</h2>
                  {!businessLoading && currentBusiness && (
                    <BusinessSwitcher />
                  )}
                </div>
                <nav className="flex-1 overflow-y-auto space-y-1 px-3 scrollbar-thin scrollbar-thumb-accent/40 scrollbar-track-transparent">
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
        <aside className="hidden md:flex w-64 flex-col border-r border-border/50 bg-card/50 h-[calc(100vh-4rem)] overflow-hidden">
          <div className="p-4 border-b border-border/50">
            {!businessLoading && currentBusiness && (
              <BusinessSwitcher />
            )}
          </div>
          <nav className="flex-1 overflow-y-auto space-y-1 p-4 scrollbar-thin scrollbar-thumb-accent/40 scrollbar-track-transparent">
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
