import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { 
  OS_FLOORS, 
  ADDITIONAL_SECTIONS, 
  PORTALS, 
  type OSFloor, 
  type PortalConfig 
} from '@/config/osNavigation';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AppSidebar() {
  const location = useLocation();
  
  // FORCE ALL GROUPS OPEN - No role restrictions
  const [openFloors, setOpenFloors] = useState<string[]>([
    ...OS_FLOORS.map(f => f.id),
    ...ADDITIONAL_SECTIONS.map(s => s.id),
    'role-portals'
  ]);

  const isPathActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleFloor = (id: string) => {
    setOpenFloors(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const renderFloorSection = (floor: OSFloor) => {
    const isOpen = openFloors.includes(floor.id);
    
    return (
      <div key={floor.id} className="mb-2">
        <button
          onClick={() => toggleFloor(floor.id)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent/30 rounded-md transition-colors"
        >
          <span className="text-base">{floor.emoji}</span>
          <span className="flex-1 text-left truncate">{floor.name}</span>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        
        {isOpen && (
          <div className="ml-4 mt-1 space-y-0.5">
            {floor.items.map(item => (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isPathActive(item.path)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
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
      className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
        isPathActive(portal.path)
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
      }`}
    >
      <portal.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{portal.label}</span>
    </Link>
  );

  return (
    <div className="w-72 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border h-screen">
      {/* Header */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <h1 className="text-lg font-bold">Dynasty OS</h1>
        <p className="text-xs text-sidebar-foreground/60">Fortune 500 Navigation</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* OS FLOORS - All 10 floors */}
          <div className="mb-4">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              OS Floors ({OS_FLOORS.length})
            </div>
            {OS_FLOORS.map(renderFloorSection)}
          </div>

          {/* ADMIN SECTIONS - All 5 sections */}
          <div className="mb-4 pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Admin Systems ({ADDITIONAL_SECTIONS.length})
            </div>
            {ADDITIONAL_SECTIONS.map(renderFloorSection)}
          </div>

          {/* ROLE PORTALS - All 10 portals */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Role Portals ({PORTALS.length})
            </div>
            <div className="ml-4 space-y-0.5">
              {PORTALS.map(renderPortal)}
            </div>
          </div>

          {/* DETECTED SYSTEMS - Call Center */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Call Center OS
            </div>
            <div className="ml-4 space-y-0.5">
              <Link to="/callcenter" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/callcenter') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Dashboard
              </Link>
              <Link to="/callcenter/dialer" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/callcenter/dialer') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Dialer
              </Link>
              <Link to="/callcenter/logs" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/callcenter/logs') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Call Logs
              </Link>
              <Link to="/callcenter/ai-agents" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/callcenter/ai-agents') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                AI Agents
              </Link>
              <Link to="/callcenter/analytics" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/callcenter/analytics') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Analytics
              </Link>
            </div>
          </div>

          {/* DETECTED SYSTEMS - Communication Hub */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Communication Hub
            </div>
            <div className="ml-4 space-y-0.5">
              <Link to="/communication" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/communication') && location.pathname === '/communication' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Overview
              </Link>
              <Link to="/communication/sms" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/communication/sms') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                SMS Center
              </Link>
              <Link to="/communication/email" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/communication/email') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Email Center
              </Link>
              <Link to="/communication/calls" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/communication/calls') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Calls
              </Link>
              <Link to="/communication/campaigns" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/communication/campaigns') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Campaigns
              </Link>
              <Link to="/communication/analytics" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/communication/analytics') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Analytics
              </Link>
            </div>
          </div>

          {/* DETECTED SYSTEMS - Grabba OS */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Grabba OS
            </div>
            <div className="ml-4 space-y-0.5">
              <Link to="/grabba/command-penthouse" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/grabba/command-penthouse') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Command Penthouse
              </Link>
              <Link to="/grabba/cluster-dashboard" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/grabba/cluster-dashboard') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Cluster Dashboard
              </Link>
              <Link to="/grabba/ai-operations" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/grabba/ai-operations') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                AI Operations
              </Link>
              <Link to="/grabba/autopilot" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/grabba/autopilot') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Autopilot Console
              </Link>
              <Link to="/grabba/unified-upload" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/grabba/unified-upload') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Unified Upload
              </Link>
              <Link to="/grabba/multi-brand-delivery" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/grabba/multi-brand-delivery') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Multi-Brand Delivery
              </Link>
            </div>
          </div>

          {/* DETECTED SYSTEMS - Warehouse & Procurement */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Warehouse & Procurement
            </div>
            <div className="ml-4 space-y-0.5">
              <Link to="/os/warehouse" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/os/warehouse') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Warehouse Dashboard
              </Link>
              <Link to="/os/procurement" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/os/procurement') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Procurement Dashboard
              </Link>
              <Link to="/os/procurement/suppliers" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/os/procurement/suppliers') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Suppliers
              </Link>
              <Link to="/os/procurement/orders" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/os/procurement/orders') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Purchase Orders
              </Link>
            </div>
          </div>

          {/* DETECTED SYSTEMS - Store Portal */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Store Portal Pages
            </div>
            <div className="ml-4 space-y-0.5">
              <Link to="/portal/store" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/store') && location.pathname === '/portal/store' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Store Dashboard
              </Link>
              <Link to="/portal/store/products" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/store/products') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Products
              </Link>
              <Link to="/portal/store/orders" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/store/orders') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Orders
              </Link>
              <Link to="/portal/store/invoices" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/store/invoices') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Invoices
              </Link>
              <Link to="/portal/store/team" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/store/team') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Team
              </Link>
            </div>
          </div>

          {/* DETECTED SYSTEMS - Wholesaler Portal */}
          <div className="pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              Wholesaler Portal Pages
            </div>
            <div className="ml-4 space-y-0.5">
              <Link to="/portal/wholesaler" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/wholesaler') && location.pathname === '/portal/wholesaler' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Dashboard
              </Link>
              <Link to="/portal/wholesaler/products" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/wholesaler/products') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Products
              </Link>
              <Link to="/portal/wholesaler/orders" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/wholesaler/orders') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Orders
              </Link>
              <Link to="/portal/wholesaler/finance" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/wholesaler/finance') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Finance
              </Link>
              <Link to="/portal/wholesaler/team" className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${isPathActive('/portal/wholesaler/team') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40'}`}>
                Team
              </Link>
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
