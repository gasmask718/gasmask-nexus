import { ReactNode } from 'react';
import { Lock, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PermissionWrapperProps {
  children: ReactNode;
  hasPermission: boolean;
  hideCompletely?: boolean;
  showLockedIcon?: boolean;
  tooltipMessage?: string;
}

/**
 * PermissionWrapper - Conditionally renders children based on permissions
 * Shows lock icon or hides content for unauthorized users
 */
export function PermissionWrapper({
  children,
  hasPermission,
  hideCompletely = false,
  showLockedIcon = true,
  tooltipMessage = "You don't have permission for this action"
}: PermissionWrapperProps) {
  if (hasPermission) {
    return <>{children}</>;
  }

  if (hideCompletely) {
    return null;
  }

  if (showLockedIcon) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-muted/50 cursor-not-allowed opacity-50">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

interface ProtectedActionButtonProps {
  children: ReactNode;
  hasPermission: boolean;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  tooltipMessage?: string;
}

/**
 * ProtectedActionButton - A button that shows lock icon when unauthorized
 */
export function ProtectedActionButton({
  children,
  hasPermission,
  onClick,
  variant = 'default',
  size = 'default',
  className,
  disabled,
  tooltipMessage = "You don't have permission for this action"
}: ProtectedActionButtonProps) {
  const isDisabled = disabled || !hasPermission;

  if (!hasPermission) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={cn(className, 'opacity-50 cursor-not-allowed')}
              disabled
            >
              <Lock className="h-4 w-4 mr-2" />
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </Button>
  );
}

interface ReadOnlyBadgeProps {
  show: boolean;
  className?: string;
}

/**
 * ReadOnlyBadge - Shows a read-only indicator
 */
export function ReadOnlyBadge({ show, className }: ReadOnlyBadgeProps) {
  if (!show) return null;

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
      "bg-amber-500/10 text-amber-600 border border-amber-500/30",
      className
    )}>
      <Eye className="h-3 w-3" />
      Read Only
    </div>
  );
}

/**
 * LockedOverlay - Shows a blur overlay with lock icon
 */
export function LockedOverlay({ message = "Access Restricted" }: { message?: string }) {
  return (
    <div className="absolute inset-0 backdrop-blur-sm bg-background/80 flex items-center justify-center z-10 rounded-lg">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default PermissionWrapper;
