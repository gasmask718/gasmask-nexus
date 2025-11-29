import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useReadOnly } from './RequireRole';
import { Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Permission = 'create' | 'read' | 'update' | 'delete' | 'export';
type Module = 'crm' | 'inventory' | 'deliveries' | 'finance' | 'production' | 'wholesale' | 'ambassadors' | 'communication' | 'ai' | 'penthouse';

interface PermissionGateProps {
  children: ReactNode;
  module: Module;
  permission: Permission;
  fallback?: ReactNode;
  showLocked?: boolean;
  hideCompletely?: boolean;
}

/**
 * PermissionGate - Conditionally renders children based on permissions
 * Used to hide/disable UI elements based on user role
 */
export function PermissionGate({ 
  children, 
  module, 
  permission, 
  fallback,
  showLocked = false,
  hideCompletely = false
}: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions();
  const isReadOnly = useReadOnly();

  if (isLoading) {
    return null;
  }

  // In read-only mode, block create/update/delete actions
  if (isReadOnly && ['create', 'update', 'delete'].includes(permission)) {
    if (hideCompletely) return null;
    if (showLocked) return <LockedIndicator action={permission} />;
    return fallback ? <>{fallback}</> : null;
  }

  const hasAccess = hasPermission(module, permission);

  if (!hasAccess) {
    if (hideCompletely) return null;
    if (showLocked) return <LockedIndicator action={permission} />;
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

/**
 * LockedIndicator - Shows a lock icon with tooltip
 */
function LockedIndicator({ action }: { action: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-muted/50 cursor-not-allowed">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>You don't have permission to {action}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * ProtectedButton - A button that respects permissions
 */
interface ProtectedButtonProps {
  children: ReactNode;
  module: Module;
  permission: Permission;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function ProtectedButton({
  children,
  module,
  permission,
  onClick,
  className,
  disabled
}: ProtectedButtonProps) {
  const { hasPermission, isLoading } = usePermissions();
  const isReadOnly = useReadOnly();

  const hasAccess = hasPermission(module, permission) && !isReadOnly;
  const isDisabled = disabled || !hasAccess || isLoading;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={hasAccess ? onClick : undefined}
            disabled={isDisabled}
            className={cn(
              className,
              !hasAccess && 'opacity-50 cursor-not-allowed'
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        {!hasAccess && (
          <TooltipContent>
            <p>You don't have permission for this action</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * useFieldVisibility - Hook to determine which fields should be visible
 */
export function useFieldVisibility() {
  const { role, isLoading } = usePermissions();

  const canSeeFinancials = ['admin', 'manager', 'accountant'].includes(role || '');
  const canSeePricing = ['admin', 'manager', 'accountant', 'wholesale', 'wholesaler'].includes(role || '');
  const canSeeCommissions = ['admin', 'manager', 'accountant'].includes(role || '');
  const canSeeInternalNotes = ['admin', 'manager'].includes(role || '');
  const canSeeBrandSettings = role === 'admin';
  const canSeeProductionConfig = ['admin', 'manager', 'warehouse'].includes(role || '');
  const canSeeDriverPayments = ['admin', 'manager', 'accountant'].includes(role || '');

  return {
    isLoading,
    canSeeFinancials,
    canSeePricing,
    canSeeCommissions,
    canSeeInternalNotes,
    canSeeBrandSettings,
    canSeeProductionConfig,
    canSeeDriverPayments,
  };
}

export default PermissionGate;
