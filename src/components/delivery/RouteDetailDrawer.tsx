// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE DETAIL DRAWER — Full route context, stops, payouts, profit, dispatch
// Read-only except dispatch controls. Never creates parallel state.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  MapPin, Calendar, User, Clock, Package, DollarSign,
  ArrowRight, Pause, Play, X, AlertTriangle, TrendingUp,
  Loader2, Layers, FileText, MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouteDetail } from '@/hooks/useRouteManager';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { useDispatchActions } from '@/hooks/useDispatchInterventions';
import { RouteReassignDialog } from './RouteReassignDialog';
import { SLAAlertBadges, RouteSLASummary } from './SLAAlertBadges';
import { useSLAAlerts } from '@/hooks/useSLAAlerts';

interface RouteDetailDrawerProps {
  routeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRouteChanged?: () => void;
}

const statusBadge = (status: string | null) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    active: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    in_progress: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    paused: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };
  return map[status || ''] || 'bg-muted text-muted-foreground';
};

const profitBadge = (score: number | null) => {
  if (score === null) return null;
  if (score >= 70) return { label: 'High', cls: 'bg-green-500/10 text-green-600 border-green-500/20' };
  if (score >= 40) return { label: 'Medium', cls: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
  return { label: 'Low', cls: 'bg-red-500/10 text-red-600 border-red-500/20' };
};

export const RouteDetailDrawer: React.FC<RouteDetailDrawerProps> = ({
  routeId,
  open,
  onOpenChange,
  onRouteChanged,
}) => {
  const { data, isLoading } = useRouteDetail(routeId);
  const { pauseRoute, resumeRoute, cancelRoute } = useDispatchActions();
  const [reassignOpen, setReassignOpen] = useState(false);

  const route = data?.route;
  const stops = data?.stops || [];
  const profit = data?.profit;
  const payout = data?.payout;
  const interventions = data?.interventions || [];
  const overview = (data as any)?.overview as { worker_name?: string | null; money_on_this_route?: number | null } | null;
  const owedByStore: Record<string, number> = (data as any)?.owedByStore || {};

  // SLA alerts for all stores in this route
  const stopStoreIds = useMemo(() => stops.map((s: any) => s.store_id).filter(Boolean), [stops]);
  const { data: slaAlerts = [] } = useSLAAlerts(stopStoreIds.length > 0 ? stopStoreIds : undefined);
  const slaMap = useMemo(() => new Map(slaAlerts.map(a => [a.store_id, a])), [slaAlerts]);

  const completedStops = stops.filter(s => s.status === 'completed' || s.status === 'visited').length;
  const progress = stops.length > 0 ? Math.round((completedStops / stops.length) * 100) : 0;

  const handlePause = () => {
    if (!routeId) return;
    pauseRoute.mutate(
      { routeId, reason: 'Paused from dispatch control center' },
      { onSuccess: onRouteChanged },
    );
  };

  const handleResume = () => {
    if (!routeId) return;
    resumeRoute.mutate(
      { routeId, reason: 'Resumed from dispatch control center' },
      { onSuccess: onRouteChanged },
    );
  };

  const handleCancel = () => {
    if (!routeId) return;
    cancelRoute.mutate(
      { routeId, reason: 'Cancelled from dispatch control center', justification: 'Dispatcher decision' },
      { onSuccess: onRouteChanged },
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Route Detail
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !route ? (
            <div className="flex items-center justify-center py-12 flex-1 text-muted-foreground">
              Route not found
            </div>
          ) : (
            <ScrollArea className="flex-1 mt-4">
              <div className="space-y-5 pr-4">
                {/* Route Header */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={statusBadge(route.status)}>{(route.status || 'unknown').replace('_', ' ')}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge variant="outline" className="capitalize">{route.type}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</p>
                    <p className="text-sm font-medium">{format(new Date(route.date), 'PPP')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Assigned To</p>
                    <p className="text-sm font-medium">{(route as any).assignee?.name || 'Unassigned'}</p>
                  </div>
                  {route.territory && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Territory</p>
                      <p className="text-sm font-medium">{route.territory}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-medium tabular-nums">{completedStops}/{stops.length}</span>
                    </div>
                  </div>
                </div>

                {/* Brand badges */}
                {route.brand_ids && route.brand_ids.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" /> Brands</p>
                    <div className="flex flex-wrap gap-1">
                      {route.brand_ids.map((b: string) => (
                        <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dispatch Controls */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
                    <ArrowRight className="h-4 w-4 mr-1" /> Reassign
                  </Button>
                  {(route.status === 'in_progress' || route.status === 'active') && (
                    <Button variant="outline" size="sm" onClick={handlePause} disabled={pauseRoute.isPending}>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </Button>
                  )}
                  {route.status === 'paused' && (
                    <Button variant="outline" size="sm" onClick={handleResume} disabled={resumeRoute.isPending}>
                      <Play className="h-4 w-4 mr-1" /> Resume
                    </Button>
                  )}
                  {route.status !== 'completed' && route.status !== 'cancelled' && (
                    <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelRoute.isPending}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Stops */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Stops ({stops.length})
                  </h4>
                  {slaAlerts.length > 0 && (
                    <div className="mb-3">
                      <RouteSLASummary alerts={slaAlerts} />
                    </div>
                  )}
                  <div className="space-y-2">
                    {stops.map((stop: any, idx: number) => (
                      <div key={stop.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{stop.store?.store_name || 'Unknown Store'}</p>
                            <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                              {stop.status || 'pending'}
                            </Badge>
                          </div>
                          {stop.store?.address && (
                            <p className="text-xs text-muted-foreground truncate">{stop.store.address}</p>
                          )}
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {stop.brand_id && (
                              <Badge variant="secondary" className="text-[10px]">{stop.brand_id}</Badge>
                            )}
                            {stop.order_ids && stop.order_ids.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">{stop.order_ids.length} order(s)</span>
                            )}
                          </div>
                          <SLAAlertBadges alert={slaMap.get(stop.store_id)} compact className="mt-1" />
                        </div>
                      </div>
                    ))}
                    {stops.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No stops assigned</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Payout */}
                {payout && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Payout
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-lg font-bold">${(payout.total_to_pay || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">To Pay</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-lg font-bold">${(payout.total_earned || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Earned</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <Badge variant="outline" className="capitalize">{payout.status || 'pending'}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">Status</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profitability */}
                {profit && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Profitability
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-2xl font-bold">{profit.profit_score.toFixed(0)}</p>
                          {(() => { const b = profitBadge(profit.profit_score); return b ? <Badge className={b.cls}>{b.label}</Badge> : null; })()}
                        </div>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold">${profit.net_profit.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Net Profit</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-lg font-bold">${(profit.profit_per_stop || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Per Stop</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-lg font-bold">${(profit.profit_per_minute || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Per Minute</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Intervention History */}
                {interventions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Dispatch Interventions ({interventions.length})
                    </h4>
                    <div className="space-y-2">
                      {interventions.map((int: any) => (
                        <div key={int.id} className="p-3 rounded-lg border text-sm">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="capitalize text-xs">{int.intervention_type?.replace(/_/g, ' ')}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {int.created_at ? format(new Date(int.created_at), 'MMM d, yyyy, h:mm a') : ''}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1">{int.reason}</p>
                          {int.performer?.name && (
                            <p className="text-xs text-muted-foreground mt-1">By: {int.performer.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Route ID for reference */}
                <div className="text-xs text-muted-foreground font-mono pt-2 pb-4">
                  <FileText className="h-3 w-3 inline mr-1" />
                  {routeId}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Reassign dialog - reuses existing component */}
      {routeId && route && (
        <RouteReassignDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          routeId={routeId}
          routeDate={route.date}
          currentAssigneeName={(route as any).assignee?.name || 'Unassigned'}
          workerType={route.type === 'driver' ? 'driver' : 'biker'}
          onReassigned={onRouteChanged}
        />
      )}
    </>
  );
};

export default RouteDetailDrawer;
