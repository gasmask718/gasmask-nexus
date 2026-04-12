import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Send, Clock, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

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

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Needs Dispatch', cls: 'bg-amber-500/20 text-amber-400' },
  sent: { label: 'Awaiting Response', cls: 'bg-blue-500/20 text-blue-400' },
  accepted: { label: 'Partner Confirmed', cls: 'bg-emerald-500/20 text-emerald-400' },
  declined: { label: 'Declined', cls: 'bg-red-500/20 text-red-400' },
  expired: { label: 'Expired — Reassign', cls: 'bg-red-500/20 text-red-400' },
  fulfilled: { label: 'Completed', cls: 'bg-white/10 text-white/60' },
  cancelled: { label: 'Cancelled', cls: 'bg-white/10 text-white/40' },
};

export default function TTDispatchRequests() {
  const qc = useQueryClient();
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignReq, setAssignReq] = useState<any>(null);
  const [selectedAsset, setSelectedAsset] = useState('');

  const { data: requests = [] } = useQuery({
    queryKey: ['dispatch-requests'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_dispatch_requests').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['partner-assets-all'],
    queryFn: async () => {
      const { data } = await supabase.from('tt_partner_assets').select('*').eq('is_available', true);
      return data || [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('dispatch-requests-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tt_dispatch_requests' }, () => {
        qc.invalidateQueries({ queryKey: ['dispatch-requests'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const pending = requests.filter((r: any) => r.status === 'pending').length;
  const accepted = requests.filter((r: any) => r.status === 'accepted').length;
  const expired = requests.filter((r: any) => r.status === 'expired').length;
  const fulfilled = requests.filter((r: any) => r.status === 'fulfilled').length;

  const handleDispatch = async (req: any) => {
    setDispatching(req.id);
    try {
      const { data, error } = await supabase.functions.invoke('tt-smart-dispatch', {
        body: { booking_id: req.booking_id },
      });
      if (error) throw error;
      toast.success(data?.message || 'Dispatched successfully');
      qc.invalidateQueries({ queryKey: ['dispatch-requests'] });
    } catch (err: any) {
      toast.error(err.message || 'Dispatch failed');
    } finally {
      setDispatching(null);
    }
  };

  const handleAcceptPartner = async (req: any, partner: any) => {
    const { error } = await supabase.from('tt_dispatch_requests').update({
      status: 'accepted',
      accepted_partner_id: partner.id || partner.partner_id,
      accepted_partner_name: partner.partner_name || partner.name,
      accepted_at: new Date().toISOString(),
    }).eq('id', req.id);
    if (error) { toast.error('Failed to accept partner'); return; }
    await supabase.from('tt_bookings').update({ status: 'driver_assigned' }).eq('id', req.booking_id);
    toast.success(`${partner.partner_name || partner.name} assigned`);
    qc.invalidateQueries({ queryKey: ['dispatch-requests'] });
    setMatchesOpen(false);
  };

  const handleManualAssign = async () => {
    if (!selectedAsset || !assignReq) return;
    const asset = assets.find((a: any) => a.id === selectedAsset);
    if (!asset) return;
    const { error } = await supabase.from('tt_dispatch_requests').update({
      status: 'accepted',
      accepted_partner_id: asset.id,
      accepted_partner_name: asset.partner_name,
      accepted_at: new Date().toISOString(),
      matched_partners: [asset],
    }).eq('id', assignReq.id);
    if (error) { toast.error('Assignment failed'); return; }
    await supabase.from('tt_bookings').update({ status: 'driver_assigned' }).eq('id', assignReq.booking_id);
    toast.success(`Manually assigned to ${asset.partner_name}`);
    qc.invalidateQueries({ queryKey: ['dispatch-requests'] });
    setAssignOpen(false);
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Dispatch Requests</h1><p className="text-white/40 text-sm">Partner matching & request pipeline</p></div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Pending" value={pending} icon={Clock} color={pending > 0 ? 'text-amber-400' : 'text-[#C9A84C]'} />
        <KPICard label="Accepted" value={accepted} icon={CheckCircle} color="text-emerald-400" />
        <KPICard label="Expired" value={expired} icon={AlertTriangle} color={expired > 0 ? 'text-red-400' : 'text-white/40'} />
        <KPICard label="Fulfilled" value={fulfilled} icon={Send} />
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-white/40">Booking Ref</TableHead>
              <TableHead className="text-white/40">Service</TableHead>
              <TableHead className="text-white/40">Customer</TableHead>
              <TableHead className="text-white/40">Pickup / Date</TableHead>
              <TableHead className="text-white/40">Value</TableHead>
              <TableHead className="text-white/40">Matched</TableHead>
              <TableHead className="text-white/40">Status</TableHead>
              <TableHead className="text-white/40">Accepted By</TableHead>
              <TableHead className="text-white/40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/5">
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-white/40 py-12">No dispatch requests yet. Bookings will appear here when dispatched.</TableCell></TableRow>
            ) : requests.map((r: any) => {
              const partners = r.matched_partners || [];
              const st = statusMap[r.status] || statusMap.pending;
              return (
                <TableRow key={r.id} className="border-white/5">
                  <TableCell><span className="font-mono text-[#C9A84C] text-sm">{r.booking_reference || '—'}</span></TableCell>
                  <TableCell className="text-white/80 text-sm">{(r.service_type || '').replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <div><p className="text-white text-sm">{r.customer_name || '—'}</p><p className="text-white/40 text-xs">{r.customer_phone || ''}</p></div>
                  </TableCell>
                  <TableCell>
                    <div><p className="text-white/80 text-xs">{r.pickup_location || '—'}</p><p className="text-white/40 text-xs">{r.scheduled_at ? new Date(r.scheduled_at).toLocaleDateString() : '—'}</p></div>
                  </TableCell>
                  <TableCell><span className="text-[#C9A84C] font-bold">${Number(r.total_price || 0).toLocaleString()}</span></TableCell>
                  <TableCell><Badge className="bg-white/5 text-white/60">{partners.length} notified</Badge></TableCell>
                  <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                  <TableCell className="text-white/60 text-sm">{r.accepted_partner_name || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {r.status === 'pending' && (
                        <Button size="sm" className="bg-[#C9A84C] text-black h-7 text-xs" onClick={() => handleDispatch(r)} disabled={dispatching === r.id}>
                          {dispatching === r.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Dispatching...</> : 'Dispatch Now'}
                        </Button>
                      )}
                      {r.status === 'sent' && partners.length > 0 && (
                        <Button size="sm" variant="ghost" className="text-blue-400 h-7 text-xs" onClick={() => { setSelectedReq(r); setMatchesOpen(true); }}>View Matches</Button>
                      )}
                      {['pending', 'sent', 'expired'].includes(r.status) && (
                        <Button size="sm" variant="ghost" className="text-white/60 h-7 text-xs" onClick={() => { setAssignReq(r); setAssignOpen(true); }}>Manual Assign</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Matches Detail Sheet */}
      <Sheet open={matchesOpen} onOpenChange={setMatchesOpen}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[520px] sm:max-w-[520px] overflow-y-auto">
          {selectedReq && (
            <>
              <SheetHeader><SheetTitle className="text-white">Matched Partners — {selectedReq.booking_reference}</SheetTitle></SheetHeader>
              <div className="mt-3 p-3 rounded-lg bg-white/5 text-sm space-y-1">
                <p className="text-white/60">Service: <span className="text-white">{(selectedReq.service_type || '').replace(/_/g, ' ')}</span></p>
                <p className="text-white/60">Customer: <span className="text-white">{selectedReq.customer_name}</span></p>
                <p className="text-white/60">Value: <span className="text-[#C9A84C] font-bold">${Number(selectedReq.total_price || 0).toLocaleString()}</span></p>
              </div>
              <div className="mt-4 space-y-3">
                {((selectedReq.matched_partners || []) as any[]).map((p: any, i: number) => (
                  <Card key={i} className="bg-white/5 border-white/10">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{p.partner_name || p.name || 'Partner'}</p>
                          <p className="text-white/40 text-xs">{p.asset_name || p.asset_category || p.partner_type || ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/40">Score</p>
                          <p className="text-[#C9A84C] font-bold">{Math.round(p.match_score || 0)}</p>
                        </div>
                      </div>
                      <Progress value={Math.min(100, (p.match_score || 0) / 1.5)} className="h-2" />
                      <div className="flex gap-1 flex-wrap">
                        {(p.markets || []).slice(0, 4).map((m: string, j: number) => <Badge key={j} className="bg-white/5 text-white/40 text-[10px]">{m}</Badge>)}
                      </div>
                      {p.response === 'declined' ? (
                        <Badge className="bg-red-500/20 text-red-400">Declined</Badge>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-[#C9A84C] text-black h-7 text-xs" onClick={() => handleAcceptPartner(selectedReq, p)}>Accept This Partner</Button>
                          <Button size="sm" variant="ghost" className="text-white/40 h-7 text-xs">Remove</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white">
          <DialogHeader><DialogTitle className="text-[#C9A84C]">Manual Partner Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-white/60 text-sm">Assign a partner asset to booking {assignReq?.booking_reference}</p>
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue placeholder="Select partner asset" /></SelectTrigger>
              <SelectContent className="bg-[#111111] border-white/10">
                {assets.map((a: any) => (
                  <SelectItem key={a.id} value={a.id} className="text-white">
                    {a.partner_name} — {a.asset_name} ({a.asset_category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full bg-[#C9A84C] text-black" onClick={handleManualAssign} disabled={!selectedAsset}>Assign Partner</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
