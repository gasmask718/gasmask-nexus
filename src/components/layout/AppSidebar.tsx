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
        <p className="text-xs text-sidebar-foreground/60">Full System Recovery Mode</p>
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

        </div>
      </ScrollArea>
    </div>
  );
}
