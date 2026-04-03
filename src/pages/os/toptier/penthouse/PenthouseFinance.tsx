import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { DollarSign, CheckCircle, Clock, TrendingUp, Check, X } from 'lucide-react';

export default function PenthouseFinance() {
  const queryClient = useQueryClient();

  const { data: earnings = [], isLoading } = useQuery({
    queryKey: ['ph-finance-earnings'],
    queryFn: () => fetchTopTierData('tt_partner_earnings', { select: '*', order: 'created_at.desc' }),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['ph-finance-bookings'],
    queryFn: () => fetchTopTierData('tt_bookings', { select: '*' }),
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['ph-finance-partners'],
    queryFn: () => fetchTopTierData('tt_partners', { select: 'id,name' }),
  });

  const payoutMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patchTopTierData('tt_partner_earnings', { id: `eq.${id}` }, {
        status,
        ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-finance-earnings'] });
      toast.success('Payout updated');
    },
  });

  const totalPaid = earnings.filter((e: any) => e.status === 'paid').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalPending = earnings.filter((e: any) => e.status === 'pending').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalRevenue = bookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const pendingCount = earnings.filter((e: any) => e.status === 'pending').length;

  const getPartnerName = (pid: string) => partners.find((p: any) => p.id === pid)?.name || 'Unknown';

  const stats = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: '#C9A84C' },
    { label: 'Total Paid Out', value: `$${totalPaid.toLocaleString()}`, icon: CheckCircle, color: '#22c55e' },
    { label: 'Pending Payouts', value: `$${totalPending.toLocaleString()}`, icon: Clock, color: '#f59e0b' },
    { label: 'Pending Count', value: pendingCount, icon: DollarSign, color: pendingCount > 0 ? '#f59e0b' : '#22c55e' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Finance Control</h1>
        <p className="text-white/40 text-sm mt-1">Manage payouts, earnings, and financial operations</p>
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

      {/* Pending Payouts */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-white/70">Pending Payouts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Partner</TableHead>
                <TableHead className="text-white/40">Amount</TableHead>
                <TableHead className="text-white/40">Date</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.filter((e: any) => e.status === 'pending').map((e: any) => (
                <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-white/80 text-sm">{getPartnerName(e.partner_id)}</TableCell>
                  <TableCell className="text-[#C9A84C] text-sm font-medium">${Number(e.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-white/50 text-sm">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge className="bg-amber-500/20 text-amber-400 text-[10px]">pending</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => payoutMutation.mutate({ id: e.id, status: 'paid' })}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => payoutMutation.mutate({ id: e.id, status: 'rejected' })}>
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {earnings.filter((e: any) => e.status === 'pending').length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-white/30 py-8">No pending payouts</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-white/70">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Partner</TableHead>
                <TableHead className="text-white/40">Amount</TableHead>
                <TableHead className="text-white/40">Date</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Paid At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earnings.filter((e: any) => e.status !== 'pending').slice(0, 20).map((e: any) => (
                <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-white/80 text-sm">{getPartnerName(e.partner_id)}</TableCell>
                  <TableCell className="text-[#C9A84C] text-sm">${Number(e.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-white/50 text-sm">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${e.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{e.status}</Badge>
                  </TableCell>
                  <TableCell className="text-white/50 text-sm">{e.paid_at ? new Date(e.paid_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
