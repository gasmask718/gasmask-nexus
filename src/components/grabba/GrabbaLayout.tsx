import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { GrabbaBrandProvider } from '@/contexts/GrabbaBrandContext';
import { GRABBA_PENTHOUSE, GRABBA_FLOORS, getFloorByRoute } from '@/config/grabbaSkyscraper';
import { cn } from '@/lib/utils';
import { Crown, ChevronRight, Building } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA LAYOUT WRAPPER
// Wraps all Grabba pages with unified brand context + floor breadcrumb
// ═══════════════════════════════════════════════════════════════════════════════

interface GrabbaLayoutProps {
  children: ReactNode;
}

// Floor indicator breadcrumb component
function FloorBreadcrumb() {
  const location = useLocation();
  const currentFloor = getFloorByRoute(location.pathname);
  
  if (!currentFloor) return null;
  
  const isPenthouse = currentFloor.id === 'penthouse';
  const floorIndex = GRABBA_FLOORS.findIndex(f => f.id === currentFloor.id);
  const FloorIcon = currentFloor.icon;

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
      </div>
    </TooltipProvider>
  );
}

export function GrabbaLayout({ children }: GrabbaLayoutProps) {
  return (
    <GrabbaBrandProvider>
      <div className="min-h-full">
        <FloorBreadcrumb />
        {children}
      </div>
    </GrabbaBrandProvider>
  );
}

export default GrabbaLayout;
