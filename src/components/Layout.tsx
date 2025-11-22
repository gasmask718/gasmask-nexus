import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  Warehouse
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

  const navigationItems = [
    { to: '/', icon: LayoutDashboard, label: 'Command Center', roles: ['admin', 'csr'] },
    { to: '/driver', icon: MapPin, label: 'My Route', roles: ['driver', 'biker'] },
    { to: '/stores', icon: Store, label: 'Stores', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/stores/performance', icon: TrendingUp, label: 'Store Performance', roles: ['admin'] },
    { to: '/batch-import', icon: Upload, label: 'Batch Import', roles: ['admin', 'csr'] },
    { to: '/routes', icon: Map, label: 'Routes', roles: ['admin', 'driver', 'biker'] },
    { to: '/routes/optimizer', icon: Navigation, label: 'Route Optimizer', roles: ['admin', 'csr'] },
    { to: '/routes/ops-center', icon: BarChart3, label: 'Route Ops', roles: ['admin'] },
    { to: '/routes/my-route', icon: MapPin, label: 'My Active Route', roles: ['driver', 'biker'] },
    { to: '/map', icon: MapPin, label: 'Map View', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/wholesale', icon: Building2, label: 'Wholesale', roles: ['admin', 'csr'] },
    { to: '/influencers', icon: MessageCircle, label: 'Influencers', roles: ['admin', 'csr'] },
    { to: '/influencers/campaigns', icon: TrendingUp, label: 'Campaigns', roles: ['admin', 'csr'] },
    { to: '/reports/executive', icon: LayoutDashboard, label: 'Executive Reports', roles: ['admin'] },
    { to: '/missions/today', icon: Target, label: 'Missions', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/missions', icon: Trophy, label: 'Missions HQ', roles: ['admin', 'csr'] },
    { to: '/communications', icon: MessageCircle, label: 'Communications', roles: ['admin', 'csr'] },
    { to: '/crm', icon: Users, label: 'CRM', roles: ['admin', 'csr'] },
    { to: '/crm/customers', icon: Users, label: 'Customer CRM', roles: ['admin', 'csr'] },
    { to: '/communication/ai-center', icon: Brain, label: 'AI Command Center', roles: ['admin', 'csr'] },
    { to: '/communication/calls', icon: Phone, label: 'Call Center', roles: ['admin', 'csr'] },
    { to: '/communication/texts', icon: MessageCircle, label: 'Text Center', roles: ['admin', 'csr'] },
    { to: '/communication/email', icon: Mail, label: 'Email Center', roles: ['admin', 'csr'] },
    { to: '/communications/insights', icon: BarChart3, label: 'Insights Dashboard', roles: ['admin', 'csr'] },
    { to: '/communications/reminders', icon: MessageCircle, label: 'Reminders', roles: ['admin', 'csr'] },
    { to: '/templates', icon: FileText, label: 'Templates', roles: ['admin'] },
    { to: '/territories', icon: Map, label: 'Territories', roles: ['admin', 'csr'] },
    { to: '/analytics/revenue-brain', icon: Brain, label: 'Revenue Brain', roles: ['admin'] },
    { to: '/ops/opportunity-radar', icon: Radar, label: 'Opportunity Radar', roles: ['admin', 'csr'] },
    { to: '/ai/meta', icon: Brain, label: 'Meta-AI Supervisor', roles: ['admin'] },
    { to: '/expansion/regions', icon: MapPin, label: 'Territory Regions', roles: ['admin'] },
    { to: '/expansion/heatmap', icon: Map, label: 'Expansion Heatmap', roles: ['admin'] },
    { to: '/ambassadors/regions', icon: Users, label: 'Regional Ambassadors', roles: ['admin'] },
    { to: '/stores/order', icon: Package, label: 'Place Order', roles: ['admin', 'csr'] },
    { to: '/wholesale/fulfillment', icon: Package, label: 'Fulfillment', roles: ['admin', 'csr'] },
    { to: '/billing', icon: DollarSign, label: 'Billing', roles: ['admin'] },
    { to: '/analytics/economics', icon: TrendingUp, label: 'Economic Analytics', roles: ['admin'] },
    { to: '/payouts/ambassadors', icon: Users, label: 'Ambassador Payouts', roles: ['admin'] },
    { to: '/payouts/bikers', icon: Package, label: 'Biker Payouts', roles: ['admin'] },
    { to: '/sales', icon: Target, label: 'Sales Dashboard', roles: ['admin', 'csr'] },
    { to: '/sales/prospects', icon: Users, label: 'Prospects', roles: ['admin', 'csr'] },
    { to: '/sales/report', icon: BarChart3, label: 'Sales Report', roles: ['admin', 'csr'] },
    { to: '/me/home', icon: MapPin, label: 'Worker Home', roles: ['driver', 'biker', 'ambassador'] },
    { to: '/me/driver', icon: Home, label: 'Driver Dashboard', roles: ['driver', 'biker'] },
    { to: '/drivers/leaderboard', icon: Trophy, label: 'Leaderboard', roles: ['driver', 'biker', 'admin'] },
    { to: '/rewards', icon: Gift, label: 'Rewards', roles: ['driver', 'biker'] },
    { to: '/drivers/payroll', icon: DollarSign, label: 'Payroll', roles: ['admin'] },
    { to: '/team', icon: Users, label: 'Team', roles: ['admin'] },
    { to: '/products', icon: Package, label: 'Products', roles: ['admin'] },
    { to: '/analytics', icon: TrendingUp, label: 'Analytics', roles: ['admin', 'accountant'] },
    { to: '/training', icon: Package, label: 'Training', roles: ['admin', 'csr', 'driver', 'biker', 'ambassador'] },
    { to: '/settings/automation', icon: Settings, label: 'Automation', roles: ['admin'] },
  ];

  const realEstateNavItems = [
    { to: '/realestate', icon: Building, label: 'Real Estate HQ', roles: ['admin', 'realestate_worker'] },
    { to: '/realestate/leads', icon: FileSearch, label: 'Lead Intelligence', roles: ['admin', 'realestate_worker'] },
    { to: '/realestate/pipeline', icon: Target, label: 'Acquisition Pipeline', roles: ['admin', 'realestate_worker'] },
    { to: '/realestate/investors', icon: Users, label: 'Investor Marketplace', roles: ['admin', 'realestate_worker'] },
    { to: '/realestate/closings', icon: FileSignature, label: 'Deal Closings & Payments', roles: ['admin', 'realestate_worker'] },
    { to: '/realestate/expansion', icon: MapPin, label: 'Expansion Engine', roles: ['admin', 'realestate_worker'] },
  ];

  const podNavigationItems = [
    { to: '/pod', icon: Shirt, label: 'POD Overview', roles: ['admin', 'pod_worker'] },
    { to: '/pod/designs', icon: Package, label: 'Design Library', roles: ['admin', 'pod_worker'] },
    { to: '/pod/generator', icon: Brain, label: 'AI Generator', roles: ['admin', 'pod_worker'] },
    { to: '/pod/mockups', icon: Package, label: 'Mockups', roles: ['admin', 'pod_worker'] },
    { to: '/pod/uploads', icon: Upload, label: 'Marketplace Uploads', roles: ['admin', 'pod_worker'] },
    { to: '/pod/videos', icon: Package, label: 'AI Promo Videos', roles: ['admin', 'pod_worker'] },
    { to: '/pod/scheduler', icon: Target, label: 'Content Scheduler', roles: ['admin', 'pod_worker'] },
    { to: '/pod/winners', icon: Trophy, label: 'Winner Scaling', roles: ['admin', 'pod_worker'] },
    { to: '/pod/analytics', icon: BarChart3, label: 'Sales Analytics', roles: ['admin', 'pod_worker'] },
    { to: '/pod/va', icon: Users, label: 'VA Control Panel', roles: ['admin', 'pod_worker'] },
    { to: '/pod/settings', icon: Settings, label: 'Settings', roles: ['admin', 'pod_worker'] },
  ];

  // Trim and normalize role
  const normalizedRole = userRole?.trim().toLowerCase() || null;
  
  console.log('Sidebar normalizedRole:', normalizedRole);
  
  const filteredNavItems = navigationItems.filter(
    item => !item.roles || (normalizedRole && item.roles.includes(normalizedRole))
  );

  const filteredRealEstateNavItems = realEstateNavItems.filter(
    item => !item.roles || (normalizedRole && item.roles.includes(normalizedRole))
  );

  const filteredPodNavItems = podNavigationItems.filter(
    item => !item.roles || (normalizedRole && item.roles.includes(normalizedRole))
  );

  const showRealEstateSection = filteredRealEstateNavItems.length > 0;
  const showPodSection = filteredPodNavItems.length > 0;
  
  console.log('Sidebar RealEstate items:', filteredRealEstateNavItems);
  console.log('Sidebar POD items:', filteredPodNavItems);

  const NavItems = () => (
    <>
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
