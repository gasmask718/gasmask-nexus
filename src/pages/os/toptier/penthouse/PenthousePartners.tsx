import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Users, CheckCircle, Clock, Star, Download, Eye, Ban, Check, Loader2 } from 'lucide-react';

export default function PenthousePartners() {
  const queryClient = useQueryClient();
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['ph-partners-list'],
    queryFn: () => fetchTopTierData('tt_partners', { select: '*', order: 'created_at.desc' }),
  });

  const { data: earnings = [] } = useQuery({
    queryKey: ['ph-partner-earnings-all'],
    queryFn: () => fetchTopTierData('tt_partner_earnings', { select: '*' }),
  });

  const mutation = useMutation({
    mutationFn: async ({ id, status, currentStatus }: { id: string; status: string; currentStatus?: string }) => {
      const result = await patchTopTierData('tt_partners', { id: `eq.${id}` }, { status, updated_at: new Date().toISOString() });
      const { data } = await supabase.auth.getUser();
      await logPenthouseAction({
        action: `partner_${status === 'active' ? 'approve' : status === 'suspended' ? 'suspend' : 'reject'}`,
        target_type: 'tt_partners',
        target_id: id,
        actor_user_id: data.user?.id || 'unknown',
        before: { status: currentStatus },
        after: { status },
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-partners-list'] });
      toast.success('Partner status updated');
      setSelectedPartner(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const total = partners.length;
  const active = partners.filter((p: any) => p.status === 'active').length;
  const pending = partners.filter((p: any) => p.status === 'pending').length;
  const avgTrust = total > 0 ? Math.round(partners.reduce((s: number, p: any) => s + (p.trust_score || 0), 0) / total) : 0;

  const stats = [
    { label: 'Total Partners', value: total, icon: Users, color: '#C9A84C' },
    { label: 'Active', value: active, icon: CheckCircle, color: '#22c55e' },
    { label: 'Pending Approval', value: pending, icon: Clock, color: '#f59e0b' },
    { label: 'Avg Trust Score', value: `${avgTrust}/5`, icon: Star, color: '#C9A84C' },
  ];

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s === 'pending') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const partnerEarnings = (pid: string) => earnings.filter((e: any) => e.partner_id === pid);

  const exportCSV = () => {
    const rows = [['Name','Business','Category','Status','Trust Score','Bookings','Earnings']];
    partners.forEach((p: any) => rows.push([p.name, p.business_name, p.service_category, p.status, p.trust_score, p.total_bookings, p.total_earnings]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'partners.csv'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Partner Management</h1>
          <p className="text-white/40 text-sm mt-1">Approve, suspend, and monitor all TopTier partners</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4">
              {isLoading ? <Skeleton className="h-12 bg-white/5" /> : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                  <s.icon className="h-4 w-4" style={{ color: s.color, opacity: 0.5 }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111] border-white/5">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/40">Partner</TableHead>
                <TableHead className="text-white/40">Category</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Trust</TableHead>
                <TableHead className="text-white/40">Bookings</TableHead>
                <TableHead className="text-white/40">Response</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p: any) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelectedPartner(p)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[10px] text-[#C9A84C] font-bold">
                        {(p.name || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white/80">{p.name}</p>
                        <p className="text-xs text-white/40">{p.business_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{p.service_category}</Badge></TableCell>
                  <TableCell><Badge className={`text-[10px] ${statusColor(p.status)}`}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={`h-3 w-3 ${n <= (p.trust_score || 0) ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-white/10'}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/60 text-sm">{p.total_bookings || 0}</TableCell>
                  <TableCell className="text-white/60 text-sm">{p.response_rate || 0}%</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-white/40" onClick={() => setSelectedPartner(p)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      {p.status === 'pending' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: p.id, status: 'active', currentStatus: p.status })}>
                          {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                      )}
                      {p.status !== 'suspended' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: p.id, status: 'suspended', currentStatus: p.status })}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <SheetContent className="bg-[#111] border-l border-[#C9A84C]/10 text-white w-[500px]">
          {selectedPartner && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[#C9A84C] font-serif">{selectedPartner.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Business', selectedPartner.business_name],
                    ['Category', selectedPartner.service_category],
                    ['Email', selectedPartner.email],
                    ['Phone', selectedPartner.phone],
                    ['Total Earnings', `$${Number(selectedPartner.total_earnings || 0).toLocaleString()}`],
                    ['Status', selectedPartner.status],
                  ].map(([label, val]) => (
                    <div key={label as string} className="p-3 bg-white/[0.03] rounded-lg">
                      <p className="text-[10px] text-white/40 uppercase">{label}</p>
                      <p className="text-sm text-white/80 mt-1">{val || '—'}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-white/40 uppercase mb-2">Recent Earnings</p>
                  {partnerEarnings(selectedPartner.id).slice(0, 5).map((e: any) => (
                    <div key={e.id} className="flex justify-between p-2 border-b border-white/5">
                      <span className="text-sm text-white/60">{new Date(e.created_at).toLocaleDateString()}</span>
                      <span className="text-sm text-[#C9A84C]">${Number(e.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  {selectedPartner.status !== 'active' && (
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: selectedPartner.id, status: 'active', currentStatus: selectedPartner.status })}>
                      {mutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Approve
                    </Button>
                  )}
                  {selectedPartner.status !== 'suspended' && (
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: selectedPartner.id, status: 'suspended', currentStatus: selectedPartner.status })}>
                      {mutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Suspend
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}