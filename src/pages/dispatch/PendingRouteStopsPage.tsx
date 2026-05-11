// ═══════════════════════════════════════════════════════════════════════════════
// PENDING ROUTE STOPS — Step 6 dispatcher queue (AI-flagged delivery requests)
// Three sections: Pending approval, Approved (today), Rejected (today).
// ═══════════════════════════════════════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { usePendingRouteStops, type PendingRouteStop } from '@/hooks/usePendingRouteStops';
import { SendToRouteModal } from '@/components/scheduling/SendToRouteModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const CONF_BADGE: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};
const URGENCY_BADGE: Record<string, string> = {
  today: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  this_week: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  next_week: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  no_rush: 'bg-muted text-muted-foreground',
};

function nextDateForDay(day: string | null): string {
  const today = new Date();
  if (!day) {
    today.setDate(today.getDate() + 1);
    return format(today, 'yyyy-MM-dd');
  }
  const map: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const target = map[day.toLowerCase()];
  if (target == null) return format(today, 'yyyy-MM-dd');
  const diff = (target - today.getDay() + 7) % 7 || 7;
  today.setDate(today.getDate() + diff);
  return format(today, 'yyyy-MM-dd');
}

function timeForWindow(window: string | null): string {
  if (window === 'morning') return '10:00';
  if (window === 'afternoon') return '14:00';
  if (window === 'evening') return '17:00';
  return '10:00';
}

function StopCard({
  stop,
  onApprove,
  onReject,
}: {
  stop: PendingRouteStop;
  onApprove: (s: PendingRouteStop, edit?: boolean) => void;
  onReject: (s: PendingRouteStop) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{stop.store_name || 'Unknown store'}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Logged {format(new Date(stop.created_at), 'MMM d, h:mma')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {stop.urgency && (
              <Badge variant="outline" className={URGENCY_BADGE[stop.urgency]}>
                {stop.urgency.replace('_', ' ')}
              </Badge>
            )}
            {stop.confidence_level && (
              <Badge variant="outline" className={CONF_BADGE[stop.confidence_level]}>
                {stop.confidence_level.toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stop.intent_summary && (
          <p className="text-sm italic text-muted-foreground border-l-2 border-border pl-3">
            "{stop.intent_summary}"
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{stop.requested_day || 'No day specified'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{stop.requested_window || 'Anytime'}</span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
          <div className="font-semibold">
            {stop.recommended_boxes ?? '—'} box{stop.recommended_boxes === 1 ? '' : 'es'}{' '}
            {stop.recommended_brand || ''}
          </div>
          {stop.estimated_revenue != null && (
            <div className="text-xs text-muted-foreground">
              Est. revenue: ${Number(stop.estimated_revenue).toLocaleString()}
            </div>
          )}
        </div>

        {stop.status === 'pending_approval' && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => onApprove(stop)} className="flex-1">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onApprove(stop, true)}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(stop)}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}

        {stop.status === 'rejected' && stop.rejection_reason && (
          <div className="text-xs text-rose-400 flex items-start gap-1">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <span>Rejected: {stop.rejection_reason}</span>
          </div>
        )}

        {stop.status === 'approved' && (
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approved {stop.approved_at && format(new Date(stop.approved_at), 'h:mma')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PendingRouteStopsPage() {
  const { stops, isLoading, refetch, reject } = usePendingRouteStops();

  const [modalStop, setModalStop] = useState<PendingRouteStop | null>(null);
  const [rejectStop, setRejectStop] = useState<PendingRouteStop | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');
  const grouped = useMemo(() => {
    const pending: PendingRouteStop[] = [];
    const approved: PendingRouteStop[] = [];
    const rejected: PendingRouteStop[] = [];
    for (const s of stops) {
      if (s.status === 'pending_approval' || s.status === 'edited') pending.push(s);
      else if (s.status === 'approved' && s.approved_at?.startsWith(today)) approved.push(s);
      else if (s.status === 'rejected' && s.approved_at?.startsWith(today)) rejected.push(s);
    }
    return { pending, approved, rejected };
  }, [stops, today]);

  const openApprove = (stop: PendingRouteStop, _edit?: boolean) => {
    setModalStop(stop);
  };

  const submitReject = async () => {
    if (!rejectStop || !rejectReason.trim()) return;
    await reject({ id: rejectStop.id, reason: rejectReason.trim() });
    setRejectStop(null);
    setRejectReason('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pending Route Stops</h1>
        <p className="text-muted-foreground text-sm">
          AI-flagged delivery requests from inbound calls awaiting dispatcher approval.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading queue...
        </div>
      )}

      <section>
        <h2 className="font-semibold mb-3">
          Pending Approval <Badge variant="outline" className="ml-2">{grouped.pending.length}</Badge>
        </h2>
        {grouped.pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending stops. 🎉</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grouped.pending.map((s) => (
              <StopCard key={s.id} stop={s} onApprove={openApprove} onReject={setRejectStop} />
            ))}
          </div>
        )}
      </section>

      {grouped.approved.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">
            Approved Today <Badge variant="outline" className="ml-2">{grouped.approved.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grouped.approved.map((s) => (
              <StopCard key={s.id} stop={s} onApprove={openApprove} onReject={setRejectStop} />
            ))}
          </div>
        </section>
      )}

      {grouped.rejected.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">
            Rejected Today <Badge variant="outline" className="ml-2">{grouped.rejected.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grouped.rejected.map((s) => (
              <StopCard key={s.id} stop={s} onApprove={openApprove} onReject={setRejectStop} />
            ))}
          </div>
        </section>
      )}

      {modalStop && (
        <SendToRouteModal
          open={!!modalStop}
          onOpenChange={(o) => !o && setModalStop(null)}
          storeId={modalStop.store_id}
          storeName={modalStop.store_name || undefined}
          brand={modalStop.recommended_brand || undefined}
          pendingStopId={modalStop.id}
          initialBoxes={modalStop.recommended_boxes ?? undefined}
          initialBrand={modalStop.recommended_brand ?? undefined}
          initialDate={nextDateForDay(modalStop.requested_day)}
          initialTime={timeForWindow(modalStop.requested_window)}
          initialNotes={modalStop.intent_summary || ''}
          sourceOutreach="manual_call"
          onSuccess={() => {
            setModalStop(null);
            refetch();
          }}
        />
      )}

      <Dialog open={!!rejectStop} onOpenChange={(o) => !o && setRejectStop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Pending Stop</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Store closed, customer changed mind, duplicate..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectStop(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={!rejectReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
