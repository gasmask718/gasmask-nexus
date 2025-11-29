// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED PANEL — Full activity log with filters
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import {
  getBrandConfig,
  GRABBA_BRAND_IDS,
  GRABBA_FLOORS,
  GrabbaBrandId,
} from '@/config/grabbaSkyscraper';
import { FLOOR_MAP, ActivityEventType } from '@/lib/activity/ActivityEngine';
import { formatDistanceToNow, format } from 'date-fns';
import { Activity, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityFeedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFloor?: string;
  defaultBrand?: GrabbaBrandId;
}

export function ActivityFeedPanel({
  isOpen,
  onClose,
  defaultFloor,
  defaultBrand,
}: ActivityFeedPanelProps) {
  const [selectedFloor, setSelectedFloor] = useState<string>(defaultFloor || 'all');
  const [selectedBrand, setSelectedBrand] = useState<GrabbaBrandId>(defaultBrand || 'all');

  const { events, floorCounts } = useActivityFeed({
    floorId: selectedFloor === 'all' ? undefined : selectedFloor,
    brand: selectedBrand,
    limit: 100,
    autoRefresh: true,
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-3 pr-4">
                {events.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No activity yet</div>
                ) : (
                  events.map((event) => {
                    const brandConfig = event.brand ? getBrandConfig(event.brand) : null;
                    const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });
                    const floorName = FLOOR_MAP[event.floorId] || event.floorId;

                    return (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {brandConfig && (
                              <span className="text-lg">{brandConfig.icon}</span>
                            )}
                            <div>
                              <p className="font-medium text-sm">{event.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {floorName}
                                </Badge>
                                {brandConfig && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                    style={{
                                      borderColor: brandConfig.color,
                                      color: brandConfig.color,
                                    }}
                                  >
                                    {brandConfig.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>{timeAgo}</div>
                            {event.userName && <div className="mt-0.5">by {event.userName}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="heatmap" className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(floorCounts).map(([floorId, count]) => {
                const floorName = FLOOR_MAP[floorId] || floorId;
                const intensity = Math.min(count / 10, 1);

                return (
                  <div
                    key={floorId}
                    className={cn(
                      'p-3 rounded-lg border border-border/50 transition-all',
                      count > 0 && 'animate-pulse'
                    )}
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${intensity * 0.3})`,
                    }}
                  >
                    <div className="text-xs text-muted-foreground">{floorName}</div>
                    <div className="text-lg font-bold">{count}</div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="filters" className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Floor</label>
              <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                <SelectTrigger>
                  <SelectValue placeholder="All Floors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {GRABBA_FLOORS.map((floor) => (
                    <SelectItem key={floor.id} value={floor.id}>
                      {floor.emoji} {floor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Brand</label>
              <Select value={selectedBrand} onValueChange={(v) => setSelectedBrand(v as GrabbaBrandId)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏢 All Brands</SelectItem>
                  {GRABBA_BRAND_IDS.map((brandId) => {
                    const config = getBrandConfig(brandId);
                    return (
                      <SelectItem key={brandId} value={brandId}>
                        {config.icon} {config.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default ActivityFeedPanel;
