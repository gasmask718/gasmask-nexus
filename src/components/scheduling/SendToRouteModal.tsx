// ═══════════════════════════════════════════════════════════════════════════════
// SEND TO ROUTE MODAL — Create Routes or Schedule Deliveries from Selection
// ═══════════════════════════════════════════════════════════════════════════════
// Step 4 (Session 7): Adds single-store "Schedule Delivery" mode triggered from
// call outcomes. When `storeId` is supplied, the modal:
//   • Locks the store selector to that single store
//   • Calls tube-replenishment-ai for AI-recommended boxes/brand/revenue
//   • Surfaces a HIGH/MEDIUM/LOW confidence badge w/ tooltip
//   • Pre-fills boxes (editable) + visit pattern context
//   • On save, links the originating call_log row to the new route_stop
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useRouteBuilder } from '@/hooks/useRouteBuilder';
import { useScheduler } from '@/hooks/useScheduler';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type SourceOutreach = 'auto_dialer' | 'campaign_dial' | 'manual_call';

interface SendToRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Multi-store batch mode (legacy). Mutually exclusive with `storeId`. */
  storeIds?: string[];
  /** Single-store schedule-delivery mode (call dialer outcome). */
  storeId?: string;
  storeName?: string;
  brand?: string;
  region?: string;
  sourceOutreach?: SourceOutreach;
  sourceCallId?: string;
  /** Step 6: link save-back to a pending_route_stops queue row. */
  pendingStopId?: string;
  /** Step 6: pre-fill overrides from queued recommendation. */
  initialBoxes?: number;
  initialBrand?: string;
  initialDate?: string;     // yyyy-MM-dd
  initialTime?: string;     // HH:mm
  initialNotes?: string;
  onSuccess?: () => void;
}

interface Driver {
  id: string;
  name: string;
}

interface Recommendation {
  brand: string;
  recommended_boxes: number;
  estimated_revenue: number;
  recommended_timing: 'urgent' | 'soon' | 'routine';
  reason: string;
  debug?: { visit_days?: number; avg_tubes_per_visit?: number };
}

interface AIResponse {
  store_id: string;
  store_name: string;
  recommendations: Recommendation[];
  analysis: {
    last_order_days_ago: number | null;
    price_verification?: {
      verification_confidence: 'high' | 'medium' | 'low';
      verified_pct: number;
      invoices_with_verified_pricing: number;
    };
  };
}

const CONFIDENCE_META = {
  high: {
    label: '✅ HIGH',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    tip: (n: number) => `Based on ${n} verified historical deliveries`,
  },
  medium: {
    label: '🟡 MEDIUM',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    tip: () => 'Pricing inferred for some orders — recommendation may need adjustment',
  },
  low: {
    label: '🔴 LOW',
    className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    tip: () => 'Limited price-verified history — operator should review before pitching',
  },
} as const;

export function SendToRouteModal({
  open,
  onOpenChange,
  storeIds,
  storeId,
  storeName,
  brand,
  region,
  sourceOutreach,
  sourceCallId,
  pendingStopId,
  initialBoxes,
  initialBrand,
  initialDate,
  initialTime,
  initialNotes,
  onSuccess,
}: SendToRouteModalProps) {
  const { buildRouteFromStores, saveRoute, loading: routeLoading } = useRouteBuilder();
  const { createTask, loading: taskLoading } = useScheduler();

  // Single-store mode if storeId provided; else fall back to multi-store batch mode.
  const singleStoreMode = Boolean(storeId);
  const effectiveStoreIds = singleStoreMode ? [storeId as string] : storeIds || [];

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(
    initialDate || format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState<string>(initialTime || '10:00');
  const [routeName, setRouteName] = useState<string>('');
  const [taskOnly, setTaskOnly] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(initialNotes || '');

  // AI recommendation state (single-store mode)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<AIResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<number>(initialBoxes || 1);
  const [brandOverride, setBrandOverride] = useState<string>(initialBrand || '');

  const loading = routeLoading || taskLoading;
  const topRec = aiData?.recommendations?.[0];
  const confidence = aiData?.analysis?.price_verification?.verification_confidence ?? null;

  // Fetch drivers + AI recommendations on open
  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const result = await (supabase as any)
          .from('profiles')
          .select('id, name, role')
          .eq('status', 'active');
        if (result.data) {
          setDrivers(
            result.data
              .filter((p: any) => ['driver', 'biker'].includes(p.role))
              .map((d: any) => ({ id: d.id, name: d.name || 'Unknown' })),
          );
        }
      } catch (err) {
        console.error('Failed to fetch drivers', err);
      }
    })();

    const dateStr = format(new Date(scheduledDate), 'MMM d');
    setRouteName(`${storeName || brand || 'Route'} - ${dateStr}`);

    if (sourceOutreach) {
      setNotes(
        sourceOutreach === 'manual_call'
          ? 'Scheduled from manual call outcome'
          : sourceOutreach === 'auto_dialer'
          ? 'Scheduled from auto-dialer outcome'
          : 'Scheduled from campaign dial outcome',
      );
    }
  }, [open, brand, scheduledDate, storeName, sourceOutreach]);

  // Load tube-replenishment-ai recommendation when single-store mode opens
  useEffect(() => {
    if (!open || !singleStoreMode || !storeId) return;
    setAiLoading(true);
    setAiError(null);
    setAiData(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('tube-replenishment-ai', {
          body: { storeId },
        });
        if (error) throw error;
        const resp = data as AIResponse;
        setAiData(resp);
        const top = resp?.recommendations?.[0];
        if (top) {
          if (initialBoxes == null) setBoxes(top.recommended_boxes);
          if (!initialBrand) setBrandOverride(top.brand);
        } else if (initialBoxes == null) {
          setBoxes(1);
        }
      } catch (err: any) {
        console.error('tube-replenishment-ai failed', err);
        setAiError(err?.message || 'Could not load recommendations');
        setBoxes(1);
      } finally {
        setAiLoading(false);
      }
    })();
  }, [open, singleStoreMode, storeId]);

  const handleSubmit = async () => {
    if (!effectiveStoreIds.length) return;

    const date = new Date(scheduledDate);
    const [hours, minutes] = startTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);

    const driverId =
      selectedDriver && selectedDriver !== 'unassigned' ? selectedDriver : undefined;

    if (taskOnly) {
      await createTask({
        type: 'visit_stores',
        payload: {
          store_ids: effectiveStoreIds,
          driver_id: driverId,
          brand: singleStoreMode ? brandOverride || brand : brand,
          region,
        },
        runAt: date,
      });
      onSuccess?.();
      onOpenChange(false);
      return;
    }

    const routePayload = await buildRouteFromStores({
      name: routeName,
      storeIds: effectiveStoreIds,
      driverId,
      brand: singleStoreMode ? brandOverride || brand : brand,
      region,
      scheduledDate: date,
      startTime,
      notes: singleStoreMode
        ? `${notes}${notes ? ' | ' : ''}Recommended ${boxes} box${boxes === 1 ? '' : 'es'} of ${brandOverride || brand || 'product'}`
        : notes || undefined,
    });

    const savedRoute = await saveRoute(routePayload);

    await createTask({
      type: 'delivery_run',
      payload: {
        store_ids: effectiveStoreIds,
        driver_id: driverId,
        brand: singleStoreMode ? brandOverride || brand : brand,
        region,
        route_name: routeName,
      },
      runAt: date,
    });

    // Single-store mode: link the originating call to the route_stop
    if (singleStoreMode && savedRoute?.id && sourceCallId) {
      try {
        const { data: stop } = await supabase
          .from('route_stops')
          .select('id')
          .eq('route_id', savedRoute.id)
          .eq('store_id', storeId as string)
          .maybeSingle();
        if (stop?.id) {
          await (supabase as any)
            .from('communication_logs')
            .update({
              outcome: 'scheduled_delivery',
              scheduled_route_stop_id: stop.id,
            })
            .eq('id', sourceCallId);
        }
      } catch (err) {
        console.error('Failed to link call to route_stop', err);
      }
    }

    // Step 6: mark queued pending stop as approved + link to route_stop
    if (pendingStopId && savedRoute?.id) {
      try {
        const { data: stop } = await supabase
          .from('route_stops')
          .select('id')
          .eq('route_id', savedRoute.id)
          .eq('store_id', storeId as string)
          .maybeSingle();
        await (supabase as any)
          .from('pending_route_stops')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            route_stop_id: stop?.id ?? null,
          })
          .eq('id', pendingStopId);
      } catch (err) {
        console.error('Failed to mark pending stop approved', err);
      }
    }

    if (singleStoreMode) {
      const dayLabel = format(date, 'EEEE, MMM d');
      const windowLabel =
        hours < 12 ? 'morning' : hours < 17 ? 'afternoon' : 'evening';
      toast.success(`Delivery scheduled for ${dayLabel} (${windowLabel})`);
    }

    onSuccess?.();
    onOpenChange(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedDriver('');
      setTaskOnly(false);
      setAiData(null);
      setAiError(null);
      setNotes('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {singleStoreMode ? `Schedule Delivery — ${storeName || 'Store'}` : 'Send to Route'}
          </DialogTitle>
          <DialogDescription>
            {singleStoreMode
              ? 'AI-recommended boxes pulled from this store\'s historical visit pattern.'
              : `Creating route / scheduled task for ${effectiveStoreIds.length} store${effectiveStoreIds.length === 1 ? '' : 's'}${brand ? ` (${brand})` : ''}`}
          </DialogDescription>
        </DialogHeader>

        {/* ─── AI Recommendation block (single-store mode) ─── */}
        {singleStoreMode && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing visit pattern...
              </div>
            )}

            {!aiLoading && aiError && (
              <div className="flex items-start gap-2 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>No order history available — operator must input box count manually.</span>
              </div>
            )}

            {!aiLoading && !aiError && topRec && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">
                      {topRec.recommended_boxes} box{topRec.recommended_boxes === 1 ? '' : 'es'} {topRec.brand}
                    </span>
                  </div>
                  {confidence && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={CONFIDENCE_META[confidence].className}
                          >
                            {CONFIDENCE_META[confidence].label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {CONFIDENCE_META[confidence].tip(
                            aiData?.analysis?.price_verification?.invoices_with_verified_pricing ?? 0,
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>
                    Estimated revenue:{' '}
                    <span className="text-foreground font-medium">
                      ${topRec.estimated_revenue.toLocaleString()}
                    </span>
                  </div>
                  {topRec.debug && (
                    <div>
                      Pattern: {topRec.debug.avg_tubes_per_visit} tubes/visit avg across{' '}
                      {topRec.debug.visit_days} visits
                    </div>
                  )}
                  {aiData?.analysis?.last_order_days_ago != null && (
                    <div>
                      Last delivery: {aiData.analysis.last_order_days_ago} days ago{' '}
                      {aiData.analysis.last_order_days_ago > 90 && (
                        <span className="text-amber-400">(overdue)</span>
                      )}
                    </div>
                  )}
                </div>

                {confidence === 'low' && (
                  <div className="flex items-start gap-2 text-xs text-amber-400 mt-2 pt-2 border-t border-border">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                    <span>Limited history for this store — verify recommendation before scheduling.</span>
                  </div>
                )}
              </>
            )}

            {!aiLoading && !aiError && !topRec && aiData && (
              <div className="text-sm text-muted-foreground">
                No recommendations returned — input box count manually below.
              </div>
            )}
          </div>
        )}

        {!taskOnly && !singleStoreMode && (
          <div className="space-y-1">
            <Label htmlFor="route-name">Route Name</Label>
            <Input
              id="route-name"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. Brooklyn Run - Dec 1"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="route-date">Scheduled Date</Label>
            <Input
              id="route-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="route-time">Start Time</Label>
            <Input
              id="route-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Assign Driver</Label>
          <Select
            value={selectedDriver || 'unassigned'}
            onValueChange={(value) =>
              setSelectedDriver(value === 'unassigned' ? '' : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {singleStoreMode && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="boxes">Boxes</Label>
                <Input
                  id="boxes"
                  type="number"
                  min={1}
                  value={boxes}
                  onChange={(e) => setBoxes(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brand-override">Brand</Label>
                <Input
                  id="brand-override"
                  value={brandOverride}
                  onChange={(e) => setBrandOverride(e.target.value)}
                  placeholder="Brand"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reactivation call outcome..."
              />
            </div>
          </>
        )}

        {!singleStoreMode && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="task-only"
              checked={taskOnly}
              onCheckedChange={(checked) => setTaskOnly(Boolean(checked))}
            />
            <Label htmlFor="task-only" className="cursor-pointer">
              Create scheduled task only (no route)
            </Label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !effectiveStoreIds.length}
          >
            {loading
              ? 'Working...'
              : singleStoreMode
              ? 'Save & Schedule'
              : taskOnly
              ? 'Schedule Task'
              : 'Create Route'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SendToRouteModal;
