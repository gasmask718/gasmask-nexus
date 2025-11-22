import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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
  Home
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
    { to: '/batch-import', icon: Upload, label: 'Batch Import', roles: ['admin', 'csr'] },
    { to: '/routes', icon: Map, label: 'Routes', roles: ['admin', 'driver', 'biker'] },
    { to: '/routes/optimizer', icon: Navigation, label: 'Route Optimizer', roles: ['admin', 'csr'] },
    { to: '/routes/my-route', icon: MapPin, label: 'My Active Route', roles: ['driver', 'biker'] },
    { to: '/map', icon: MapPin, label: 'Map View', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/wholesale', icon: Building2, label: 'Wholesale', roles: ['admin', 'csr'] },
    { to: '/influencers', icon: MessageCircle, label: 'Influencers', roles: ['admin', 'csr'] },
    { to: '/influencers/campaigns', icon: TrendingUp, label: 'Campaigns', roles: ['admin', 'csr'] },
    { to: '/reports/executive', icon: LayoutDashboard, label: 'Executive Reports', roles: ['admin'] },
    { to: '/missions/today', icon: Target, label: 'Missions', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/missions', icon: Trophy, label: 'Missions HQ', roles: ['admin', 'csr'] },
    { to: '/communications', icon: MessageCircle, label: 'Communications', roles: ['admin', 'csr'] },
    { to: '/communications/insights', icon: BarChart3, label: 'Insights Dashboard', roles: ['admin', 'csr'] },
    { to: '/communications/ai-insights', icon: Brain, label: 'AI Insights', roles: ['admin', 'csr'] },
    { to: '/communications/reminders', icon: MessageCircle, label: 'Reminders', roles: ['admin', 'csr'] },
    { to: '/templates', icon: FileText, label: 'Templates', roles: ['admin'] },
    { to: '/territories', icon: Map, label: 'Territories', roles: ['admin', 'csr'] },
    { to: '/analytics/revenue-brain', icon: Brain, label: 'Revenue Brain', roles: ['admin'] },
    { to: '/ops/opportunity-radar', icon: Radar, label: 'Opportunity Radar', roles: ['admin', 'csr'] },
    { to: '/ai/meta', icon: Brain, label: 'Meta-AI Supervisor', roles: ['admin'] },
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

  const filteredNavItems = navigationItems.filter(
    item => !item.roles || !userRole || item.roles.includes(userRole)
  );

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
    </div>
  );
};

export default Layout;
