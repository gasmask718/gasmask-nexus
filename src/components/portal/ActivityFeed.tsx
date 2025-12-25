import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { SimulationBadge } from '@/contexts/SimulationModeContext';

export interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp: Date | string;
  icon?: ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error';
  href?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isSimulated?: boolean;
  emptyMessage?: string;
  maxItems?: number;
  className?: string;
}

const typeStyles = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-hud-green/10 text-hud-green',
  warning: 'bg-hud-amber/10 text-hud-amber',
  error: 'bg-destructive/10 text-destructive',
};

export function ActivityFeed({
  items,
  isSimulated = false,
  emptyMessage = 'No recent activity',
  maxItems = 10,
  className,
}: ActivityFeedProps) {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground text-sm', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {isSimulated && (
        <div className="flex justify-end">
          <SimulationBadge />
        </div>
      )}
      
      {displayItems.map((item) => {
        const timestamp = typeof item.timestamp === 'string' 
          ? new Date(item.timestamp) 
          : item.timestamp;
        
        const content = (
          <div 
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border bg-card/50 transition-colors',
              item.href && 'hover:bg-card/80 cursor-pointer'
            )}
          >
            {item.icon && (
              <div className={cn(
                'p-2 rounded-lg shrink-0',
                typeStyles[item.type || 'info']
              )}>
                {item.icon}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {item.title}
              </p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {item.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.id} to={item.href}>
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
