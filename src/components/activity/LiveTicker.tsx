// ═══════════════════════════════════════════════════════════════════════════════
// LIVE TICKER — Scrolling activity feed bar
// ═══════════════════════════════════════════════════════════════════════════════

import { useActivityFeed } from '@/hooks/useActivityFeed';
import { getBrandConfig, GrabbaBrandId } from '@/config/grabbaSkyscraper';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface LiveTickerProps {
  brand?: GrabbaBrandId;
  floorId?: string;
  onOpenFeed?: () => void;
  className?: string;
}

export function LiveTicker({ brand, floorId, onOpenFeed, className }: LiveTickerProps) {
  const { events } = useActivityFeed({ brand, floorId, limit: 10, autoRefresh: true });

  if (events.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-muted/50 border-b border-border overflow-hidden cursor-pointer hover:bg-muted/70 transition-colors',
        className
      )}
      onClick={onOpenFeed}
    >
      <div className="flex animate-marquee whitespace-nowrap py-2 px-4">
        {events.map((event, idx) => {
          const brandConfig = event.brand ? getBrandConfig(event.brand) : null;
          const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });

          return (
            <span key={event.id} className="inline-flex items-center gap-2 mx-6 text-sm">
              {brandConfig && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: brandConfig.color }}
                />
              )}
              <span className="text-muted-foreground">{event.description}</span>
              {event.userName && (
                <span className="text-xs text-muted-foreground/70">by {event.userName}</span>
              )}
              <span className="text-xs text-muted-foreground/50">{timeAgo}</span>
              {idx < events.length - 1 && <span className="text-muted-foreground/30 ml-4">•</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default LiveTicker;
