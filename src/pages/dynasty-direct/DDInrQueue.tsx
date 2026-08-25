import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, PackageX, AlertTriangle, Truck, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Claim = {
  id: string;
  claim_number: string;
  order_id: string;
  customer_email: string;
  wholesaler_id: string | null;
  status: string;
  verdict: string;
  recommended_path: string;
  chosen_path: string | null;
  fault_party: string;
  address_mismatch: boolean;
  address_mismatch_detail: Record<string, unknown> | null;
  order_total_cents: number;
  refund_amount_cents: number | null;
  tracking_number: string | null;
  carrier: string | null;
  tracking_status: string | null;
  tracking_last_scan_at: string | null;
  tracking_last_scan_location: string | null;
  tracking_delivered_at: string | null;
  tracking_history: Array<{ status?: string; message?: string; datetime?: string; location?: string }>;
  tracking_fetch_error: string | null;
  signature_on_file: boolean;
  expected_delivery_date: string | null;
  checked_with_neighbours: boolean;
  checked_notes: string | null;
  customer_note: string | null;
  customer_stated_address: Record<string, string> | null;
  admin_notes: string | null;
  created_at: string;
};

const PATH_LABEL: Record<string, string> = {
  a_delivered_absorb: 'A — Delivered: Dynasty absorbs, supplier split stands',
  b_carrier_claim: 'B — Lost/stuck: carrier claim, no supplier fault',
  c_wholesaler_fault: 'C — Wrong address: warehouse error, reverse the split',
  review: 'Needs review — still in transit',
};

const money = (c: number) => `$${((c ?? 0) / 100).toFixed(2)}`;

function VerdictBadge({ claim }: { claim: Claim }) {
  const map: Record<string, { label: string; cls: string }> = {
    delivered: { label: 'Carrier says DELIVERED', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    lost_or_stuck: { label: 'Lost / stuck', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
    no_scan: { label: 'No carrier scan', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
    wrong_address: { label: 'Wrong address', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
    unknown: { label: 'In transit', cls: 'bg-muted text-muted-foreground' },
  };
  const v = map[claim.verdict] ?? map.unknown;
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
}

export default function DDInrQueue() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('open');
  const [selected, setSelected] = useState<Claim | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const { data: claims, isLoading, error } = useQuery({
    queryKey: ['dd-inr-claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_inr_claims')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Claim[];
    },
  });

  const { data: risk } = useQuery({
    queryKey: ['dd-inr-risk'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_dd_inr_customer_risk').select('*');
      if (error) throw error;
      return (data ?? []) as Array<{ customer_email: string; claims_total: number; refunded_cents: number }>;
    },
  });

  const riskByEmail = useMemo(() => {
    const m = new Map<string, number>();
    (risk ?? []).forEach((r) => m.set(r.customer_email, r.claims_total));
    return m;
  }, [risk]);

  const act = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('dd-inr-admin', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).message ?? (data as any).error));
      return data as Record<string, unknown>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dd-inr-claims'] });
      qc.invalidateQueries({ queryKey: ['dd-inr-risk'] });
      if (data?.coverage_warning) toast.warning(String(data.coverage_warning));
      else if (data?.ledger_note) toast.warning(String(data.ledger_note));
      else toast.success('Done');
      setSelected(null);
      setDeclineOpen(false);
      setRefundAmount('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (claims ?? []).filter((c) =>
    tab === 'open'
      ? ['open', 'evidence_gathered'].includes(c.status)
      : tab === 'all'
      ? true
      : c.status === tab,
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageX className="h-6 w-6" /> Item-not-received claims
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A claim is triaged by the carrier's own record, not by who asks loudest. Path A leaves the
          supplier's split alone; only path C reverses it.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="refunded">Refunded</TabsTrigger>
          <TabsTrigger value="carrier_claim_filed">Carrier claims</TabsTrigger>
          <TabsTrigger value="declined">Declined</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading claims…
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No claims here.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const repeats = riskByEmail.get(c.customer_email.toLowerCase()) ?? 0;
            return (
              <Card key={c.id} className={c.address_mismatch ? 'border-destructive/40' : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {c.claim_number}
                      <span className="text-muted-foreground font-normal">
                        · {money(c.order_total_cents)} · {c.customer_email}
                      </span>
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <VerdictBadge claim={c} />
                      <Badge variant="secondary">{c.status}</Badge>
                      {c.signature_on_file && (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          <ShieldCheck className="h-3 w-3 mr-1" /> Signature captured
                        </Badge>
                      )}
                      {repeats > 1 && (
                        <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                          <AlertTriangle className="h-3 w-3 mr-1" /> {repeats} claims from this customer
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="font-medium">Recommended: {PATH_LABEL[c.recommended_path]}</p>
                    <p className="text-muted-foreground whitespace-pre-line mt-1">{c.admin_notes}</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Carrier record</p>
                      <p>
                        {c.carrier ?? 'unknown carrier'} · {c.tracking_number ?? 'no tracking number'} ·{' '}
                        {c.tracking_status ?? 'no status'}
                      </p>
                      {c.tracking_last_scan_at && (
                        <p className="text-muted-foreground">
                          Last scan {new Date(c.tracking_last_scan_at).toLocaleString()}
                          {c.tracking_last_scan_location ? ` — ${c.tracking_last_scan_location}` : ''}
                        </p>
                      )}
                      {c.tracking_fetch_error && (
                        <p className="text-destructive">{c.tracking_fetch_error}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Customer says</p>
                      <p>
                        Expected {c.expected_delivery_date ?? '—'} ·{' '}
                        {c.checked_with_neighbours ? 'checked around the property' : 'has NOT checked neighbours'}
                      </p>
                      {c.customer_note && <p className="text-muted-foreground">{c.customer_note}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setSelected(c)}>
                      <Truck className="h-4 w-4 mr-2" /> Tracking history
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: 'refresh_evidence', claim_id: c.id })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" /> Re-pull evidence
                    </Button>
                    {['open', 'evidence_gathered', 'carrier_claim_filed'].includes(c.status) && (
                      <>
                        <Button
                          size="sm"
                          disabled={act.isPending || c.recommended_path === 'review'}
                          onClick={() =>
                            act.mutate({
                              action: 'refund',
                              claim_id: c.id,
                              path: c.chosen_path ?? c.recommended_path,
                            })}
                        >
                          Refund on path {(c.chosen_path ?? c.recommended_path).charAt(0).toUpperCase()}
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: 'file_carrier_claim', claim_id: c.id })}
                        >
                          File carrier claim
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: 'reship', claim_id: c.id })}
                        >
                          Reship
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { setSelected(c); setDeclineOpen(true); }}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* tracking history */}
      <Dialog open={!!selected && !declineOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carrier tracking — {selected?.claim_number}</DialogTitle>
            <DialogDescription>
              Gathered at intake, before anyone made a judgement. This is what gets attached to a
              chargeback if the claim becomes one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {selected?.address_mismatch && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                Label address does not match the order address — this is a warehouse error (path C).
              </div>
            )}
            {(selected?.tracking_history ?? []).length === 0 ? (
              <p className="text-muted-foreground">No scan history on record.</p>
            ) : (
              (selected?.tracking_history ?? []).map((h, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{h.status ?? '—'}</span>
                    <span className="text-muted-foreground">
                      {h.datetime ? new Date(h.datetime).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{h.message}</p>
                  {h.location && <p className="text-muted-foreground">{h.location}</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* decline */}
      <Dialog open={declineOpen} onOpenChange={(o) => { setDeclineOpen(o); if (!o) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline {selected?.claim_number}</DialogTitle>
            <DialogDescription>The reason is stored on the claim and shown to the customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason" rows={3} value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Carrier confirmed delivery with a signature at the order address."
            />
            <div className="space-y-1">
              <Label htmlFor="amt">Partial refund instead (optional, dollars)</Label>
              <Input id="amt" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="e.g. 24.50" />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={act.isPending || !selected}
              onClick={() => act.mutate({ action: 'decline', claim_id: selected!.id, reason: declineReason })}
            >
              Decline claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
