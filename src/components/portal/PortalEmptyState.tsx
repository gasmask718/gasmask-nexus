import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface PortalEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  className?: string;
}

export function PortalEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  className,
}: PortalEmptyStateProps) {
  return (
    <div className={cn('text-center py-16 px-4', className)}>
      <div className="mx-auto h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Button asChild>
              <Link to={actionHref}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )
        )}
        
        {secondaryActionLabel && secondaryActionHref && (
          <Button variant="outline" asChild>
            <Link to={secondaryActionHref}>{secondaryActionLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default PortalEmptyState;
