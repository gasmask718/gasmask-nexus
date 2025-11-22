import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  Building2
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut, userRole } = useAuth();

  const navigationItems = [
    { to: '/', icon: LayoutDashboard, label: 'Command Center', roles: ['admin', 'csr'] },
    { to: '/driver', icon: MapPin, label: 'My Route', roles: ['driver', 'biker'] },
    { to: '/stores', icon: Store, label: 'Stores', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/batch-import', icon: Upload, label: 'Batch Import', roles: ['admin', 'csr'] },
    { to: '/routes', icon: Map, label: 'Routes', roles: ['admin', 'driver', 'biker'] },
    { to: '/map', icon: MapPin, label: 'Map View', roles: ['admin', 'csr', 'driver', 'biker'] },
    { to: '/wholesale', icon: Building2, label: 'Wholesale', roles: ['admin', 'csr'] },
    { to: '/team', icon: Users, label: 'Team', roles: ['admin'] },
    { to: '/products', icon: Package, label: 'Products', roles: ['admin'] },
    { to: '/analytics', icon: TrendingUp, label: 'Analytics', roles: ['admin', 'accountant'] },
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
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          activeClassName="bg-primary/10 text-primary hover:bg-primary/20"
        >
          <item.icon className="h-5 w-5" />
          <span className="font-medium">{item.label}</span>
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
