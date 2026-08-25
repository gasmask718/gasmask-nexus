import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Loader2, PackageX, Truck, RotateCcw, AlertTriangle, ExternalLink, RefreshCw,
} from 'lucide-react';

interface ReturnRow {
  id: string;
  rma_number: string;
  order_id: string;
  customer_email: string | null;
  wholesaler_id: string | null;
  reason_code: string;
  reason_text: string | null;
  photos: string[] | null;
  quantity: number;
  is_fault_return: boolean;
  fault_party: string | null;
  status: string;
  destination: string;
  shipping_paid_by: string;
  return_label_url: string | null;
  return_tracking_number: string | null;
  label_error: string | null;
  refund_amount_cents: number | null;
  stripe_refund_id: string | null;
  split_reversal_id: string | null;
  clawback_id: string | null;
  admin_notes: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  label_created: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_transit: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  received: 'bg-primary/15 text-primary border-primary/30',
  refunded: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  declined: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground',
};

const FILTERS = ['open', 'requested', 'approved', 'received', 'refunded', 'declined', 'all'] as const;

export default function DDReturnsQueue() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const returnsQuery = useQuery({
    queryKey: ['dd-returns', filter],
    refetchInterval: 30000,
    queryFn: async () => {
      let q = supabase
        .from('dd_returns' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filter === 'open') {
        q = q.in('status', ['requested', 'approved', 'label_created', 'in_transit', 'received']);
      } else if (filter !== 'all') {
        q = q.eq('status', filter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ReturnRow[];
    },
  });

  const selected = returnsQuery.data?.find((r) => r.id === selectedId) ?? null;

  const act = useMutation({
    mutationFn: async (vars: { action: string; extra?: Record<string, unknown> }) => {
      if (!selected) throw new Error('No return selected');
      const { data, error } = await supabase.functions.invoke('dd-return-admin', {
        body: { action: vars.action, return_id: selected.id, ...(vars.extra ?? {}) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message ?? data.error);
      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ['dd-returns'] });
      if (vars.action === 'refund') {
        toast.success(
          `Refunded${data?.split_reversal_id ? ' and split reversed' : ''}${data?.clawback_id ? ' — clawback booked against the next payout' : ''}.`,
        );
        if (data?.ledger_note) toast.warning(data.ledger_note);
      } else {
        toast.success(`Return ${vars.action.replace('_', ' ')} done.`);
      }
      setNote('');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Action failed'),
  });

  const busy = (a: string) => act.isPending && act.variables?.action === a;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageX className="h-6 w-6" /> Returns / RMA
          </h1>
          <p className="text-muted-foreground text-sm">
            Approve, label, receive, refund. Refunding also reverses the split — and books a clawback
            if the supplier was already paid.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => returnsQuery.refetch()}>
            <RefreshCw className={`h-4 w-4 ${returnsQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {returnsQuery.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{(returnsQuery.error as any)?.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Queue</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {returnsQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {returnsQuery.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No returns in this view.</p>
            )}
            {returnsQuery.data?.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  selectedId === r.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm">{r.rma_number}</span>
                  <Badge variant="outline" className={STATUS_TONE[r.status] ?? ''}>{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.reason_code.replace(/_/g, ' ')} · qty {r.quantity} ·{' '}
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
                {r.is_fault_return && (
                  <div className="text-xs text-amber-500 mt-1">Fault return — {r.fault_party ?? 'unassigned'}</div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? `${selected.rma_number} — details` : 'Pick a return'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected && <p className="text-sm text-muted-foreground">Select a return from the queue.</p>}
            {selected && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Order</span><div className="font-mono text-xs break-all">{selected.order_id}</div></div>
                  <div><span className="text-muted-foreground">Customer</span><div className="break-all">{selected.customer_email ?? '—'}</div></div>
                  <div><span className="text-muted-foreground">Destination</span><div>{selected.destination}</div></div>
                  <div><span className="text-muted-foreground">Shipping paid by</span><div>{selected.shipping_paid_by}</div></div>
                </div>

                {selected.reason_text && (
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-muted-foreground text-xs mb-1">Customer said</div>
                    {selected.reason_text}
                  </div>
                )}

                {selected.label_error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{selected.label_error}</AlertDescription>
                  </Alert>
                )}

                {selected.return_label_url && (
                  <Alert>
                    <Truck className="h-4 w-4" />
                    <AlertDescription className="flex items-center gap-2">
                      Label bought{selected.return_tracking_number ? ` — ${selected.return_tracking_number}` : ''}.
                      <a className="text-primary underline inline-flex items-center gap-1"
                         href={selected.return_label_url} target="_blank" rel="noopener noreferrer">
                        Open label <ExternalLink className="h-3 w-3" />
                      </a>
                    </AlertDescription>
                  </Alert>
                )}

                {selected.stripe_refund_id && (
                  <Alert>
                    <RotateCcw className="h-4 w-4" />
                    <AlertDescription>
                      Refunded ({selected.stripe_refund_id}).{' '}
                      {selected.split_reversal_id ? 'Split reversed.' : 'No split reversal on file — check the ledger.'}
                      {selected.clawback_id && ' Clawback booked against the next payout.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="rma-note">Note / decline reason</Label>
                  <Textarea id="rma-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={act.isPending || selected.status !== 'requested'}
                    onClick={() => act.mutate({ action: 'approve', extra: { admin_notes: note || undefined } })}>
                    {busy('approve') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Approve
                  </Button>
                  <Button size="sm" variant="destructive" disabled={act.isPending || selected.status !== 'requested'}
                    onClick={() => act.mutate({ action: 'decline', extra: { reason: note } })}>
                    {busy('decline') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Decline
                  </Button>
                  <Button size="sm" variant="outline" disabled={act.isPending || !['approved', 'label_created'].includes(selected.status)}
                    onClick={() => act.mutate({ action: 'create_label' })}>
                    {busy('create_label') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create return label
                  </Button>
                  <Button size="sm" variant="outline" disabled={act.isPending || selected.status === 'refunded'}
                    onClick={() => act.mutate({ action: 'mark_received' })}>
                    {busy('mark_received') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Mark received
                  </Button>
                  <Button size="sm" disabled={act.isPending || !!selected.stripe_refund_id}
                    onClick={() => act.mutate({ action: 'refund' })}>
                    {busy('refund') && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Refund + reverse split
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
