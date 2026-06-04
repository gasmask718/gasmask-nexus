/**
 * Dynasty Direct — Affiliates Admin
 * Affiliate list, ledger, payouts-due, mark-paid, rate/status editor.
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Handshake, DollarSign, Users, MousePointerClick, CheckCircle2, Pause, Play } from 'lucide-react';
import { DDAlertBar } from '@/components/dynasty-direct/DDAlertBar';

type Affiliate = {
  id: string; user_id: string | null; code: string; display_name: string | null;
  email: string | null; status: string; tier: string; commission_rate: number;
  clicks: number; conversions: number; total_earned: number; total_paid: number;
};
type Event = {
  id: string; affiliate_id: string; kind: string; status: string; order_id: string | null;
  amount: number; commission_rate: number | null; commission_amount: number;
  created_at: string; earned_at: string | null; paid_at: string | null;
};

const fmt = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function DynastyDirectAffiliates() {
  const qc = useQueryClient();
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('10');
  const [open, setOpen] = useState(false);

  const affiliatesQ = useQuery({
    queryKey: ['dd-affiliates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_affiliates' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Affiliate[];
    },
  });

  const eventsQ = useQuery({
    queryKey: ['dd-affiliate-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_affiliate_events' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Event[];
    },
  });

  const affiliates = affiliatesQ.data || [];
  const events = eventsQ.data || [];

  const kpis = useMemo(() => {
    const earned = affiliates.reduce((s, a) => s + Number(a.total_earned), 0);
    const paid = affiliates.reduce((s, a) => s + Number(a.total_paid), 0);
    const active = affiliates.filter(a => a.status === 'active').length;
    const clicks = affiliates.reduce((s, a) => s + a.clicks, 0);
    const conv = affiliates.reduce((s, a) => s + a.conversions, 0);
    const revenue = events
      .filter(e => e.kind === 'order' && ['earned','paid','pending'].includes(e.status))
      .reduce((s, e) => s + Number(e.amount), 0);
    return { earned, paid, due: earned - paid, active, clicks, conv, revenue };
  }, [affiliates, events]);

  const payoutDue = useMemo(() => events.filter(e => e.kind === 'order' && e.status === 'earned'), [events]);

  const createAffiliate = useMutation({
    mutationFn: async () => {
      const code = newCode.trim().toUpperCase() || null;
      const insert: any = {
        code: code || `DD${Math.floor(Math.random() * 90 + 10)}${(newName || 'AFF').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}`,
        display_name: newName.trim() || null,
        status: 'active',
        tier: 'bronze',
        commission_rate: Math.max(0, Math.min(100, parseFloat(newRate) || 10)) / 100,
      };
      const { error } = await supabase.from('dd_affiliates' as any).insert(insert);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dd-affiliates'] });
      setOpen(false); setNewCode(''); setNewName(''); setNewRate('10');
      toast.success('Affiliate created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAffiliate = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Affiliate> }) => {
      const { error } = await supabase.from('dd_affiliates' as any).update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dd-affiliates'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('dd_affiliate_mark_paid' as any, {
        p_event_ids: ids, p_payout_batch_id: null,
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['dd-affiliates'] });
      qc.invalidateQueries({ queryKey: ['dd-affiliate-events'] });
      toast.success(`Paid out ${fmt(Number(data?.total_paid || 0))}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="h-7 w-7 text-primary" />
            Dynasty Direct — Affiliates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Codes, clicks, conversions, commission ledger, payouts.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ New Affiliate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create affiliate</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Display name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="David Smith" /></div>
              <div><Label>Code (auto if blank)</Label><Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="DAVID10" /></div>
              <div><Label>Commission rate (%)</Label><Input type="number" step="0.5" value={newRate} onChange={e => setNewRate(e.target.value)} /></div>
              <Button onClick={() => createAffiliate.mutate()} disabled={createAffiliate.isPending} className="w-full">
                {createAffiliate.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Active" value={kpis.active} icon={Users} />
        <Kpi label="Clicks" value={kpis.clicks} icon={MousePointerClick} />
        <Kpi label="Conversions" value={kpis.conv} icon={CheckCircle2} />
        <Kpi label="Aff. Revenue" value={fmt(kpis.revenue)} icon={DollarSign} />
        <Kpi label="Earned" value={fmt(kpis.earned)} icon={DollarSign} />
        <Kpi label="Payout Due" value={fmt(kpis.due)} icon={DollarSign} highlight />
      </div>

      <Tabs defaultValue="affiliates">
        <TabsList>
          <TabsTrigger value="affiliates">Affiliates ({affiliates.length})</TabsTrigger>
          <TabsTrigger value="ledger">Ledger ({events.length})</TabsTrigger>
          <TabsTrigger value="payouts">Payouts Due ({payoutDue.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Conv.</TableHead><TableHead className="text-right">CR%</TableHead>
                <TableHead className="text-right">Earned</TableHead><TableHead className="text-right">Paid</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {affiliates.map(a => {
                  const cr = a.clicks ? (a.conversions / a.clicks * 100).toFixed(1) : '—';
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono font-semibold">{a.code}</TableCell>
                      <TableCell>{a.display_name || '—'}</TableCell>
                      <TableCell><Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge></TableCell>
                      <TableCell className="text-right">{(a.commission_rate * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{a.clicks}</TableCell>
                      <TableCell className="text-right">{a.conversions}</TableCell>
                      <TableCell className="text-right">{cr}{cr !== '—' && '%'}</TableCell>
                      <TableCell className="text-right">{fmt(a.total_earned)}</TableCell>
                      <TableCell className="text-right">{fmt(a.total_paid)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => {
                            const nr = prompt(`Commission rate % for ${a.code}`, (a.commission_rate * 100).toString());
                            if (nr !== null) updateAffiliate.mutate({ id: a.id, patch: { commission_rate: Math.max(0, Math.min(100, parseFloat(nr) || 0)) / 100 } });
                          }}>Rate</Button>
                          <Button size="sm" variant="outline" onClick={() => updateAffiliate.mutate({
                            id: a.id, patch: { status: a.status === 'active' ? 'paused' : 'active' },
                          })}>{a.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!affiliates.length && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No affiliates yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Affiliate</TableHead><TableHead>Kind</TableHead>
                <TableHead>Status</TableHead><TableHead>Order</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {events.map(e => {
                  const a = affiliates.find(x => x.id === e.affiliate_id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{a?.code || e.affiliate_id.slice(0,8)}</TableCell>
                      <TableCell><Badge variant="outline">{e.kind}</Badge></TableCell>
                      <TableCell><StatusBadge status={e.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{e.order_id?.slice(0,8) || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(e.amount)}</TableCell>
                      <TableCell className="text-right">{e.commission_rate != null ? `${(e.commission_rate * 100).toFixed(1)}%` : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(e.commission_amount)}</TableCell>
                    </TableRow>
                  );
                })}
                {!events.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No events yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Earned, awaiting payout</CardTitle>
              <Button
                disabled={!payoutDue.length || markPaid.isPending}
                onClick={() => markPaid.mutate(payoutDue.map(e => e.id))}
              >
                Mark all paid — {fmt(payoutDue.reduce((s, e) => s + Number(e.commission_amount), 0))}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Earned at</TableHead><TableHead>Affiliate</TableHead>
                  <TableHead>Order</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Commission</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payoutDue.map(e => {
                    const a = affiliates.find(x => x.id === e.affiliate_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{e.earned_at ? new Date(e.earned_at).toLocaleString() : '—'}</TableCell>
                        <TableCell className="font-mono">{a?.code}</TableCell>
                        <TableCell className="font-mono text-xs">{e.order_id?.slice(0,8)}</TableCell>
                        <TableCell className="text-right">{fmt(e.amount)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(e.commission_amount)}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => markPaid.mutate([e.id])}>Pay</Button></TableCell>
                      </TableRow>
                    );
                  })}
                  {!payoutDue.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nothing due.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, highlight }: { label: string; value: any; icon: any; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/50 ring-1 ring-primary/20' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: any = status === 'earned' ? 'default'
    : status === 'paid' ? 'secondary'
    : status === 'pending' ? 'outline'
    : status === 'reversed' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{status}</Badge>;
}
