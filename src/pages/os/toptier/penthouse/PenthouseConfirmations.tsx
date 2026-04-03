import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData, logPenthouseAction } from '@/lib/toptierApi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Check, X, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function PenthouseConfirmations() {
  const queryClient = useQueryClient();

  const { data: confirmations = [], isLoading } = useQuery({
    queryKey: ['ph-confirmations'],
    queryFn: () => fetchTopTierData('tt_confirmation_requests', { select: '*', order: 'requested_at.desc' }),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['ph-conf-bookings'],
    queryFn: () => fetchTopTierData('tt_bookings', { select: 'id,client_name,service_name' }),
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['ph-conf-partners'],
    queryFn: () => fetchTopTierData('tt_partners', { select: 'id,name' }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, currentStatus }: { id: string; status: string; currentStatus: string }) => {
      await patchTopTierData('tt_confirmation_requests', { id: `eq.${id}` }, {
        status,
        responded_at: new Date().toISOString(),
      });
      const { data } = await supabase.auth.getUser();
      await logPenthouseAction({
        action: `${status}_confirmation`,
        target_type: 'tt_confirmation_requests',
        target_id: id,
        actor_user_id: data.user?.id || 'unknown',
        before: { status: currentStatus },
        after: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-confirmations'] });
      toast.success('Confirmation updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const getBookingName = (bid: string) => {
    const b = bookings.find((bk: any) => bk.id === bid);
    return b ? `${b.client_name} — ${b.service_name}` : bid?.slice(0, 8) || '—';
  };

  const getPartnerName = (pid: string) => partners.find((p: any) => p.id === pid)?.name || '—';

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-400',
      confirmed: 'bg-emerald-500/20 text-emerald-400',
      declined: 'bg-red-500/20 text-red-400',
    };
    return <Badge className={`text-[10px] ${map[s] || 'bg-white/10 text-white/40'}`}>{s}</Badge>;
  };

  const pendingCount = confirmations.filter((c: any) => c.status === 'pending').length;
  const confirmedCount = confirmations.filter((c: any) => c.status === 'confirmed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Confirmation Requests</h1>
        <p className="text-white/40 text-sm mt-1">Partner confirmation status for bookings</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: confirmations.length, icon: Clock, color: '#C9A84C' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: '#f59e0b' },
          { label: 'Confirmed', value: confirmedCount, icon: CheckCircle, color: '#22c55e' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111] border-white/5">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40">{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
              <s.icon className="h-4 w-4" style={{ color: s.color, opacity: 0.5 }} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111] border-white/5">
        <CardHeader><CardTitle className="text-sm text-white/70">All Confirmation Requests</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Booking</TableHead>
                <TableHead className="text-white/40">Partner</TableHead>
                <TableHead className="text-white/40">Requested</TableHead>
                <TableHead className="text-white/40">Responded</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {confirmations.map((c: any) => (
                <TableRow key={c.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-white/80 text-sm">{getBookingName(c.booking_id)}</TableCell>
                  <TableCell className="text-white/60 text-sm">{getPartnerName(c.partner_id)}</TableCell>
                  <TableCell className="text-white/50 text-sm">{c.requested_at ? new Date(c.requested_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-white/50 text-sm">{c.responded_at ? new Date(c.responded_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>{statusBadge(c.status || 'pending')}</TableCell>
                  <TableCell>
                    {c.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: c.id, status: 'confirmed', currentStatus: 'pending' })}>
                          <Check className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: c.id, status: 'declined', currentStatus: 'pending' })}>
                          <X className="h-3 w-3 mr-1" /> Decline
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {confirmations.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8">{isLoading ? 'Loading...' : 'No confirmation requests'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
