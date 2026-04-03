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
import { UserCheck, Users, DollarSign, Clock, Check, Ban, Eye, Copy, Loader2 } from 'lucide-react';

const TIERS = [
  { name: 'Bronze', min: 0, color: '#CD7F32' },
  { name: 'Silver', min: 10, color: '#C0C0C0' },
  { name: 'Gold', min: 25, color: '#C9A84C' },
  { name: 'Platinum', min: 50, color: '#E5E4E2' },
];

function getTier(referrals: number) {
  return [...TIERS].reverse().find(t => referrals >= t.min) || TIERS[0];
}

export default function PenthouseAffiliates() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);

  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['ph-affiliates-list'],
    queryFn: () => fetchTopTierData('tt_affiliates', { select: '*', order: 'created_at.desc' }),
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['ph-aff-commissions'],
    queryFn: () => fetchTopTierData('tt_affiliate_commissions', { select: '*' }),
  });

  const mutation = useMutation({
    mutationFn: async ({ id, updates, currentStatus }: { id: string; updates: any; currentStatus?: string }) => {
      const result = await patchTopTierData('tt_affiliates', { id: `eq.${id}` }, { ...updates, updated_at: new Date().toISOString() });
      const { data } = await supabase.auth.getUser();
      await logPenthouseAction({
        action: `affiliate_${updates.status || 'update'}`,
        target_type: 'tt_affiliates',
        target_id: id,
        actor_user_id: data.user?.id || 'unknown',
        before: { status: currentStatus },
        after: updates,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ph-affiliates-list'] });
      toast.success('Affiliate updated');
      setSelected(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const total = affiliates.length;
  const active = affiliates.filter((a: any) => a.status === 'active').length;
  const totalEarned = affiliates.reduce((s: number, a: any) => s + Number(a.total_earned || 0), 0);
  const totalPending = affiliates.reduce((s: number, a: any) => s + Number(a.pending_amount || 0), 0);

  const stats = [
    { label: 'Total Affiliates', value: total, icon: Users, color: '#C9A84C' },
    { label: 'Active', value: active, icon: UserCheck, color: '#22c55e' },
    { label: 'Commissions Paid', value: `$${totalEarned.toLocaleString()}`, icon: DollarSign, color: '#C9A84C' },
    { label: 'Pending Payouts', value: `$${totalPending.toLocaleString()}`, icon: Clock, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Affiliate Management</h1>
        <p className="text-white/40 text-sm mt-1">TopTier Ambassador & Affiliate network</p>
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
                <TableHead className="text-white/40">Affiliate</TableHead>
                <TableHead className="text-white/40">Referral Code</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
                <TableHead className="text-white/40">Referrals</TableHead>
                <TableHead className="text-white/40">Earned</TableHead>
                <TableHead className="text-white/40">Pending</TableHead>
                <TableHead className="text-white/40">Tier</TableHead>
                <TableHead className="text-white/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map((a: any) => {
                const tier = getTier(a.total_referrals || 0);
                return (
                  <TableRow key={a.id} className="border-white/5 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelected(a)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[10px] text-[#C9A84C] font-bold">
                          {(a.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-sm text-white/80">{a.name}</p>
                      </div>
                    </TableCell>
                    <TableCell><code className="text-[#C9A84C] text-xs font-mono bg-[#C9A84C]/5 px-2 py-0.5 rounded">{a.referral_code}</code></TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${a.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : a.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/60 text-sm">{a.total_referrals || 0}</TableCell>
                    <TableCell className="text-[#C9A84C] text-sm">${Number(a.total_earned || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-amber-400 text-sm">${Number(a.pending_amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge style={{ backgroundColor: `${tier.color}20`, color: tier.color, borderColor: `${tier.color}40` }} className="text-[10px]">{tier.name}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-white/40" onClick={() => setSelected(a)}><Eye className="h-3 w-3" /></Button>
                        {a.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => mutation.mutate({ id: a.id, updates: { status: 'active' } })}><Check className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="bg-[#111] border-l border-[#C9A84C]/10 text-white w-[500px]">
          {selected && (
            <>
              <SheetHeader><SheetTitle className="text-[#C9A84C] font-serif">{selected.name}</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Email', selected.email],
                    ['Phone', selected.phone],
                    ['Referrals', selected.total_referrals],
                    ['Tier', getTier(selected.total_referrals || 0).name],
                  ].map(([label, val]) => (
                    <div key={label as string} className="p-3 bg-white/[0.03] rounded-lg">
                      <p className="text-[10px] text-white/40 uppercase">{label}</p>
                      <p className="text-sm text-white/80 mt-1">{val || '—'}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-white/[0.03] rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase">Referral Code</p>
                    <code className="text-[#C9A84C] font-mono">{selected.referral_code}</code>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(selected.referral_code || ''); toast.success('Copied'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                {/* Tier progress */}
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <p className="text-[10px] text-white/40 uppercase mb-2">Tier Progress</p>
                  <div className="flex gap-1">
                    {TIERS.map(t => (
                      <div key={t.name} className="flex-1">
                        <div className={`h-2 rounded-full ${(selected.total_referrals || 0) >= t.min ? 'opacity-100' : 'opacity-20'}`} style={{ backgroundColor: t.color }} />
                        <p className="text-[9px] text-center mt-1" style={{ color: t.color }}>{t.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/40 uppercase mb-2">Commission History</p>
                  {commissions.filter((c: any) => c.affiliate_id === selected.id).slice(0, 5).map((c: any) => (
                    <div key={c.id} className="flex justify-between p-2 border-b border-white/5">
                      <span className="text-sm text-white/60">{new Date(c.created_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#C9A84C]">${Number(c.amount).toLocaleString()}</span>
                        <Badge className={`text-[9px] ${c.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{c.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  {selected.status !== 'active' && (
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => mutation.mutate({ id: selected.id, updates: { status: 'active' } })}>Approve</Button>
                  )}
                  {selected.status !== 'rejected' && (
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => mutation.mutate({ id: selected.id, updates: { status: 'rejected' } })}>Reject</Button>
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
