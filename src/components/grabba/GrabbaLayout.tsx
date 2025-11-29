import { ReactNode, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { GrabbaBrandProvider, useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { GRABBA_PENTHOUSE, GRABBA_FLOORS, getFloorByRoute } from '@/config/grabbaSkyscraper';
import { useFloorPermissions } from '@/hooks/useFloorPermissions';
import { useReadOnly } from '@/components/security/RequireRole';
import { cn } from '@/lib/utils';
import { Crown, ChevronRight, Building, Lock, Eye, Activity } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { LiveTicker } from '@/components/activity/LiveTicker';
import { ActivityTray } from '@/components/activity/ActivityTray';
import { ActivityFeedPanel } from '@/components/activity/ActivityFeedPanel';

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA LAYOUT WRAPPER
// Wraps all Grabba pages with unified brand context + floor breadcrumb
// Now includes role-based permission indicators
// ═══════════════════════════════════════════════════════════════════════════════

interface GrabbaLayoutProps {
  children: ReactNode;
}

// Floor indicator breadcrumb component with permission awareness
function FloorBreadcrumb() {
  const location = useLocation();
  const currentFloor = getFloorByRoute(location.pathname);
  const { getFloorAccess, loading } = useFloorPermissions();
  const isReadOnly = useReadOnly();
  
  if (!currentFloor || loading) return null;
  
  const isPenthouse = currentFloor.id === 'penthouse';
  const floorIndex = GRABBA_FLOORS.findIndex(f => f.id === currentFloor.id);
  const FloorIcon = currentFloor.icon;
  const access = getFloorAccess(currentFloor.id);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/10 rounded-lg">
        {/* Grabba Empire Label */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              to="/grabba/command-penthouse"
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
            >
              <Building className="h-3 w-3" />
              GRABBA EMPIRE
            </Link>
          </TooltipTrigger>
          <TooltipContent>Go to Command Penthouse</TooltipContent>
        </Tooltip>
        
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        
        {/* Current Floor */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-2 px-2 py-1 rounded text-xs font-medium cursor-default",
              isPenthouse 
                ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-700"
                : "bg-red-500/10 text-red-600"
            )}>
              {isPenthouse ? (
                <Crown className="h-3 w-3" />
              ) : (
                <FloorIcon className="h-3 w-3" />
              )}
              <span>
                {isPenthouse ? '👑 Penthouse' : `F${floorIndex + 1}: ${currentFloor.name}`}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm font-medium">{currentFloor.emoji} {currentFloor.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{currentFloor.description}</p>
          </TooltipContent>
        </Tooltip>

        {/* Permission indicator */}
        {(isReadOnly || access.permission === 'read') && (
          <Badge variant="outline" className="ml-auto text-xs flex items-center gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
            <Eye className="h-3 w-3" />
            Read Only
          </Badge>
        )}
        
        {!access.canCreate && !isReadOnly && access.permission === 'full' && (
          <Badge variant="outline" className="ml-auto text-xs flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Limited Access
          </Badge>
        )}
      </div>
    </TooltipProvider>
  );
}

function GrabbaLayoutContent({ children }: GrabbaLayoutProps) {
  const [feedOpen, setFeedOpen] = useState(false);
  const location = useLocation();
  const currentFloor = getFloorByRoute(location.pathname);
  const { selectedBrand } = useGrabbaBrand();

  return (
    <div className="min-h-full">
      {/* Live Activity Ticker */}
      <LiveTicker
        brand={selectedBrand}
        floorId={currentFloor?.id}
        onOpenFeed={() => setFeedOpen(true)}
      />
      
      <FloorBreadcrumb />
      {children}
      
      {/* Floating Activity Tray */}
      <ActivityTray
        floorId={currentFloor?.id}
        brand={selectedBrand}
      />
      
      {/* Full Activity Panel */}
      <ActivityFeedPanel
        isOpen={feedOpen}
        onClose={() => setFeedOpen(false)}
        defaultFloor={currentFloor?.id}
        defaultBrand={selectedBrand}
      />
    </div>
  );
}

export function GrabbaLayout({ children }: GrabbaLayoutProps) {
  return (
    <GrabbaBrandProvider>
      <GrabbaLayoutContent>{children}</GrabbaLayoutContent>
    </GrabbaBrandProvider>
  );
}

export default GrabbaLayout;
