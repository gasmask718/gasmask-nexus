import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch } from '@/lib/publicSiteApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { DollarSign, Clock, AlertTriangle, TrendingUp, Download } from 'lucide-react';

function KPICard({ label, value, icon: Icon, color = 'text-[#C9A84C]' }: any) {
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center"><Icon className={`h-5 w-5 ${color}`} /></div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TTPayouts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('partners');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const { data: earnings = [], isError } = useQuery({
    queryKey: ['pub-earnings'],
    queryFn: async () => {
      let data = await pubFetch('partner_earnings');
      if (!data.length) data = await pubFetch('payments', { filters: { type: 'eq.partner_payout' } });
      return data;
    },
  });

  const { data: affiliateComm = [] } = useQuery({
    queryKey: ['pub-aff-commissions'],
    queryFn: () => pubFetch('affiliate_commissions'),
  });

  const allPayouts = useMemo(() => [...earnings, ...affiliateComm], [earnings, affiliateComm]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const paidMTD = allPayouts.filter(p => (p.status || '').toLowerCase() === 'paid' && p.paid_at >= monthStart).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingTotal = allPayouts.filter(p => (p.status || '').toLowerCase() === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);
  const failedCount = allPayouts.filter(p => (p.status || '').toLowerCase() === 'failed').length;
  const avgPayout = allPayouts.length > 0 ? Math.round(allPayouts.reduce((s, p) => s + Number(p.amount || 0), 0) / allPayouts.length) : 0;

  const filteredPayouts = tab === 'partners' ? earnings : tab === 'affiliates' ? affiliateComm : allPayouts;

  const handleMarkPaid = async (id: string, table: string) => {
    const ok = await pubPatch(table, id, { status: 'paid', paid_at: new Date().toISOString() });
    if (ok) { toast.success('Marked as paid'); qc.invalidateQueries({ queryKey: ['pub-earnings'] }); qc.invalidateQueries({ queryKey: ['pub-aff-commissions'] }); }
    else toast.error('Update failed. Try again.');
  };

  const handleBulkPaid = async () => {
    setProcessing(true);
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i++) {
      toast.info(`Processing ${i + 1} of ${ids.length}...`);
      await pubPatch('partner_earnings', ids[i], { status: 'paid', paid_at: new Date().toISOString() });
    }
    setSelected(new Set());
    setProcessing(false);
    toast.success('All selected marked as paid');
    qc.invalidateQueries({ queryKey: ['pub-earnings'] });
  };

  const exportCSV = () => {
    const rows = [['Date', 'Recipient', 'Amount', 'Booking Ref', 'Service', 'Status']];
    filteredPayouts.forEach(p => rows.push([p.created_at || '', p.partner_name || p.affiliate_name || '', p.amount || '', p.booking_ref || p.booking_reference || '', p.service_type || '', p.status || '']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payouts_${tab}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Payouts Center</h1><p className="text-white/40 text-sm">Track and process partner & affiliate payouts</p></div>
        <Button variant="ghost" className="text-[#C9A84C]" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      {isError && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">Could not load data from public site. Check Settings &gt; Public Site Connection.</div>}

      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Paid Out MTD" value={`$${paidMTD.toLocaleString()}`} icon={DollarSign} />
        <KPICard label="Pending Payouts" value={`$${pendingTotal.toLocaleString()}`} icon={Clock} color={pendingTotal > 0 ? 'text-amber-400' : 'text-white/40'} />
        <KPICard label="Failed" value={failedCount} icon={AlertTriangle} color={failedCount > 0 ? 'text-red-400' : 'text-white/40'} />
        <KPICard label="Avg Payout" value={`$${avgPayout.toLocaleString()}`} icon={TrendingUp} />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#C9A84C]/10 rounded-lg border border-[#C9A84C]/20">
          <span className="text-[#C9A84C] text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" className="bg-[#C9A84C] text-black" onClick={handleBulkPaid} disabled={processing}>Mark All Selected as Paid</Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="partners" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Partners</TabsTrigger>
          <TabsTrigger value="affiliates" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Affiliates</TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card className="bg-[#111111] border-[#C9A84C]/10 mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-white/40">Recipient</TableHead>
                  <TableHead className="text-white/40">Amount</TableHead>
                  <TableHead className="text-white/40">Booking Ref</TableHead>
                  <TableHead className="text-white/40">Service</TableHead>
                  <TableHead className="text-white/40">Date</TableHead>
                  <TableHead className="text-white/40">Status</TableHead>
                  <TableHead className="text-white/40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {filteredPayouts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-white/40 py-12">No payouts found.</TableCell></TableRow>
                ) : filteredPayouts.map((p: any) => {
                  const st = (p.status || '').toLowerCase();
                  return (
                    <TableRow key={p.id} className="border-white/5">
                      <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white text-sm font-medium">{p.partner_name || p.affiliate_name || 'Unknown'}</p>
                          <Badge className="bg-white/5 text-white/40 text-[10px]">{p.type || 'partner'}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#C9A84C] font-bold">${Number(p.amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-white/60 text-xs">{p.booking_ref || p.booking_reference || '—'}</TableCell>
                      <TableCell className="text-white/60 text-sm">{p.service_type || '—'}</TableCell>
                      <TableCell className="text-white/40 text-sm">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Badge className={st === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : st === 'pending' ? 'bg-amber-500/20 text-amber-400' : st === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60'}>{p.status || 'unknown'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          {st === 'pending' && <Button size="sm" className="bg-emerald-500/20 text-emerald-400 h-7 text-xs" onClick={() => handleMarkPaid(p.id, p.affiliate_name ? 'affiliate_commissions' : 'partner_earnings')}>Mark Paid</Button>}
                          {st === 'failed' && <Button size="sm" className="bg-amber-500/20 text-amber-400 h-7 text-xs" onClick={() => pubPatch(p.affiliate_name ? 'affiliate_commissions' : 'partner_earnings', p.id, { status: 'pending' }).then(() => { toast.success('Retrying'); qc.invalidateQueries({ queryKey: ['pub-earnings'] }); })}>Retry</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
