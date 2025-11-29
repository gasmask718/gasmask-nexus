// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY TRAY — Floating activity widget for all Grabba pages
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { getBrandConfig, GrabbaBrandId } from '@/config/grabbaSkyscraper';
import { ActivityFeedPanel } from './ActivityFeedPanel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityTrayProps {
  floorId?: string;
  brand?: GrabbaBrandId;
  className?: string;
}

export function ActivityTray({ floorId, brand, className }: ActivityTrayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { events } = useActivityFeed({ floorId, brand, limit: 5, autoRefresh: true });

  const recentEvents = events.slice(0, 5);

  return (
    <>
      <div className={cn('fixed bottom-4 right-4 z-40', className)}>
        <Card className="w-80 overflow-hidden shadow-lg border-border/50">
          {/* Header */}
          <div
            className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Recent Activity</span>
              {recentEvents.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {recentEvents.length}
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="max-h-64 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No recent activity
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentEvents.map((event) => {
                    const brandConfig = event.brand ? getBrandConfig(event.brand) : null;
                    const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });

                    return (
                      <div key={event.id} className="p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-2">
                          {brandConfig && (
                            <span className="text-sm mt-0.5">{brandConfig.icon}</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{event.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{timeAgo}</span>
                              {event.userName && (
                                <span className="text-xs text-muted-foreground/70">
                                  • {event.userName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View all button */}
              <div className="p-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsPanelOpen(true)}
                >
                  View All Activity
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <ActivityFeedPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        defaultFloor={floorId}
        defaultBrand={brand}
      />
    </>
  );
}

export default ActivityTray;
