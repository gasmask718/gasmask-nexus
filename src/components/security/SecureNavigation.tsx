import { ReactNode, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFloorPermissions } from '@/hooks/useFloorPermissions';
import { GRABBA_PENTHOUSE, GRABBA_FLOORS, GrabbaFloor } from '@/config/grabbaSkyscraper';
import { cn } from '@/lib/utils';
import { Crown, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * SecureNavigation - Role-aware navigation for Grabba floors
 * Only shows floors the user has permission to access
 */
export function SecureNavigation() {
  const location = useLocation();
  const { getAllowedFloors, getFloorAccess, loading } = useFloorPermissions();

  const allowedFloors = useMemo(() => getAllowedFloors(), [getAllowedFloors]);

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const penthouseAccess = getFloorAccess('penthouse');

  return (
    <TooltipProvider>
      <nav className="space-y-1">
        {/* Penthouse - if accessible */}
        {penthouseAccess.canAccess && (
          <FloorNavItem 
            floor={GRABBA_PENTHOUSE}
            isActive={location.pathname === GRABBA_PENTHOUSE.path}
            isPenthouse
            isReadOnly={penthouseAccess.permission === 'read'}
          />
        )}

        {/* Floors */}
        {GRABBA_FLOORS.map((floor, index) => {
          const access = getFloorAccess(floor.id);
          if (!access.canAccess) return null;

          return (
            <FloorNavItem
              key={floor.id}
              floor={floor}
              floorNumber={index + 1}
              isActive={location.pathname.startsWith(floor.path)}
              isReadOnly={access.permission === 'read'}
            />
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

interface FloorNavItemProps {
  floor: GrabbaFloor;
  floorNumber?: number;
  isActive: boolean;
  isPenthouse?: boolean;
  isReadOnly?: boolean;
}

function FloorNavItem({ floor, floorNumber, isActive, isPenthouse, isReadOnly }: FloorNavItemProps) {
  const FloorIcon = floor.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={floor.path}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            isActive
              ? isPenthouse
                ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-700 border border-yellow-500/30"
                : "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            isReadOnly && "opacity-75"
          )}
        >
          {isPenthouse ? (
            <Crown className="h-4 w-4" />
          ) : (
            <FloorIcon className="h-4 w-4" />
          )}
          <span className="flex-1 truncate">
            {isPenthouse ? '👑 Penthouse' : `F${floorNumber}: ${floor.name}`}
          </span>
          {isReadOnly && (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div>
          <p className="font-medium">{floor.emoji} {floor.name}</p>
          <p className="text-xs text-muted-foreground">{floor.description}</p>
          {isReadOnly && (
            <p className="text-xs text-amber-500 mt-1">Read-only access</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Helper to filter navigation items based on permissions
 */
export function filterNavItems<T extends { path?: string; floorId?: string }>(
  items: T[],
  getAllowedFloors: () => GrabbaFloor[]
): T[] {
  const allowedFloors = getAllowedFloors();
  const allowedPaths = new Set(allowedFloors.map(f => f.path));

  return items.filter(item => {
    if (!item.path) return true;
    return allowedPaths.has(item.path) || 
           allowedFloors.some(f => item.path?.startsWith(f.path));
  });
}

/**
 * Admin-only route paths that require special protection
 * Part of Dynasty OS Security Protocol
 */
export const ADMIN_ONLY_PATHS = [
  '/system',
  '/os/admin',
  '/penthouse',
  '/settings/security',
  '/settings/users',
  '/audit-logs',
  '/diagnostics',
];

/**
 * Check if a path requires admin access
 */
export function isAdminOnlyPath(path: string): boolean {
  return ADMIN_ONLY_PATHS.some((adminPath) => 
    path.startsWith(adminPath)
  );
}

/**
 * Elevated access paths (admin, employee, accountant)
 */
export const ELEVATED_ACCESS_PATHS = [
  '/finance',
  '/reports',
  '/analytics',
  '/hr',
  '/payroll',
];

/**
 * Check if a path requires elevated access
 */
export function isElevatedPath(path: string): boolean {
  return ELEVATED_ACCESS_PATHS.some((elevatedPath) => 
    path.startsWith(elevatedPath)
  );
}

export default SecureNavigation;
