// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH INTAKE PANEL — Phase 3.2 Floor 4 Integration
// ═══════════════════════════════════════════════════════════════════════════════
// Read-only visibility of Floor 1 signals, wired to RouteAssignmentDialog

import { useMemo, useState } from 'react';
import { useDispatchIntakeView, type DispatchSignal } from '@/hooks/useDispatchIntakeView';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AlertTriangle,
  Package,
  Zap,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface DispatchIntakePanelProps {
  onStoresSelected: (stores: DispatchSignal[]) => void;
}

export function DispatchIntakePanel({ onStoresSelected }: DispatchIntakePanelProps) {
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set());
  const [filterOrder, setFilterOrder] = useState(false);
  const [filterSamples, setFilterSamples] = useState(false);
  const [filterStarterKit, setFilterStarterKit] = useState(false);
  const [filterOpportunity, setFilterOpportunity] = useState(false);
  const [filterFollowUp, setFilterFollowUp] = useState(false);

  const { data: signals = [], isLoading } = useDispatchIntakeView({
    needsOrder: filterOrder || undefined,
    needsSamples: filterSamples || undefined,
    needsStarterKit: filterStarterKit || undefined,
    hasOpportunity: filterOpportunity || undefined,
    hasFollowUp: filterFollowUp || undefined,
  });

  const filteredSignals = useMemo(() => {
    let result = signals;

    if (filterOrder || filterSamples || filterStarterKit || filterOpportunity || filterFollowUp) {
      result = signals.filter(s => {
        if (filterOrder && !s.needs.order) return false;
        if (filterSamples && !s.needs.samples) return false;
        if (filterStarterKit && !s.needs.starter_kit) return false;
        if (filterOpportunity && !s.needs.opportunity) return false;
        if (filterFollowUp && !s.needs.follow_up) return false;
        return true;
      });
    }

    return result;
  }, [signals, filterOrder, filterSamples, filterStarterKit, filterOpportunity, filterFollowUp]);

  const selectedSignals = useMemo(() => {
    return filteredSignals.filter(s => selectedStoreIds.has(s.store_id));
  }, [filteredSignals, selectedStoreIds]);

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else {
        next.add(storeId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStoreIds.size === filteredSignals.length) {
      setSelectedStoreIds(new Set());
    } else {
      setSelectedStoreIds(new Set(filteredSignals.map(s => s.store_id)));
    }
  };

  const handleAssign = () => {
    onStoresSelected(selectedSignals);
    setSelectedStoreIds(new Set());
  };

  const activeFilterCount = [
    filterOrder,
    filterSamples,
    filterStarterKit,
    filterOpportunity,
    filterFollowUp,
  ].filter(Boolean).length;

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Dispatch Intake
            </CardTitle>
            <CardDescription>
              All stores requiring action from Floor 1 (inventory, opportunities, follow-ups)
            </CardDescription>
          </div>
          {selectedStoreIds.size > 0 && (
            <Badge variant="default" className="text-base px-3 py-1">
              {selectedStoreIds.size} selected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Filters</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
              <Checkbox
                checked={filterOrder}
                onCheckedChange={(checked) => setFilterOrder(checked === true)}
              />
              <span className="text-sm">Needs Order</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
              <Checkbox
                checked={filterSamples}
                onCheckedChange={(checked) => setFilterSamples(checked === true)}
              />
              <span className="text-sm">Bring Samples</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
              <Checkbox
                checked={filterStarterKit}
                onCheckedChange={(checked) => setFilterStarterKit(checked === true)}
              />
              <span className="text-sm">Starter Kit</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
              <Checkbox
                checked={filterOpportunity}
                onCheckedChange={(checked) => setFilterOpportunity(checked === true)}
              />
              <span className="text-sm">Opportunity</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
              <Checkbox
                checked={filterFollowUp}
                onCheckedChange={(checked) => setFilterFollowUp(checked === true)}
              />
              <span className="text-sm">Follow-Up</span>
            </label>
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterOrder(false);
                setFilterSamples(false);
                setFilterStarterKit(false);
                setFilterOpportunity(false);
                setFilterFollowUp(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Stores List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredSignals.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No action required"
            description="No stores have active signals at this time"
          />
        ) : (
          <div className="space-y-2">
            {/* Header with Select All */}
            <div className="flex items-center gap-2 p-2 border-b">
              <Checkbox
                checked={selectedStoreIds.size === filteredSignals.length && filteredSignals.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium flex-1">
                {filteredSignals.length} store{filteredSignals.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Store rows */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredSignals.map(signal => (
                  <div
                    key={signal.store_id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition cursor-pointer"
                    onClick={() => toggleStore(signal.store_id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedStoreIds.has(signal.store_id)}
                        onCheckedChange={() => toggleStore(signal.store_id)}
                        onClick={e => e.stopPropagation()}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Store Name + Territory */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{signal.store_name}</span>
                          {signal.territory && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              <MapPin className="h-3 w-3 mr-1" />
                              {signal.territory}
                            </Badge>
                          )}
                        </div>

                        {/* Need Badges */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {signal.needs.order && (
                            <Badge className="bg-primary/10 text-primary border-primary/30">
                              <Package className="h-3 w-3 mr-1" />
                              Order
                            </Badge>
                          )}
                          {signal.needs.samples && (
                            <Badge className="bg-secondary/10 text-secondary-foreground border-secondary/30">
                              Samples
                            </Badge>
                          )}
                          {signal.needs.starter_kit && (
                            <Badge className="bg-accent/10 text-accent-foreground border-accent/30">
                              Kit
                            </Badge>
                          )}
                          {signal.needs.opportunity && (
                            <Badge className="bg-muted text-muted-foreground border-muted/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Opp
                            </Badge>
                          )}
                          {signal.needs.follow_up && (
                            <Badge variant="destructive" className="border-destructive/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              FU
                            </Badge>
                          )}
                        </div>

                        {/* Recommended Actions */}
                        <div className="text-xs text-muted-foreground mb-1">
                          {signal.recommended_actions.join(' • ')}
                        </div>

                        {/* Recency */}
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {signal.last_visit_date && (
                            <span>
                              Last visit:{' '}
                              {formatDistanceToNow(parseISO(signal.last_visit_date), { addSuffix: true })}
                            </span>
                          )}
                        </div>

                        {/* Urgency Score */}
                        {signal.urgency_score > 0 && (
                          <div className="mt-1 text-xs font-medium text-destructive">
                            Urgency: {signal.urgency_score}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Action Buttons */}
        {selectedStoreIds.size > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedStoreIds(new Set())}>
              Clear selection
            </Button>
            <Button onClick={handleAssign} className="flex-1">
              Assign {selectedStoreIds.size} store{selectedStoreIds.size !== 1 ? 's' : ''} to route
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
