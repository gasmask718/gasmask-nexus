import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users, DollarSign, Clock, Star, Search, Download, Copy, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type SortKey = 'name' | 'tracking_code' | 'is_active' | 'total_earnings' | 'tier';
type SortDir = 'asc' | 'desc';

const TIER_CONFIG: Record<string, { color: string; min: number; max: number; next?: string }> = {
  starter: { color: 'bg-amber-700/20 text-amber-600', min: 0, max: 5, next: 'rising' },
  rising: { color: 'bg-gray-400/20 text-gray-300', min: 6, max: 20, next: 'elite' },
  elite: { color: 'bg-[#C9A84C]/20 text-[#C9A84C]', min: 21, max: 50, next: 'dynasty' },
  dynasty: { color: 'bg-purple-500/20 text-purple-400', min: 51, max: 999 },
};

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.starter;
  return <Badge className={cfg.color}>{tier}</Badge>;
}

export default function TTAmbassadors() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedAmb, setSelectedAmb] = useState<any>(null);

  const { data: ambassadors, isLoading } = useQuery({
    queryKey: ['tt-ambassadors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ambassadors').select('*').is('deleted_at', null).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: commissions } = useQuery({
    queryKey: ['tt-amb-commissions', selectedAmb?.id],
    enabled: !!selectedAmb,
    queryFn: async () => {
      const { data } = await supabase.from('ambassador_commissions').select('*').eq('ambassador_id', selectedAmb.id).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const payoutMutation = useMutation({
    mutationFn: async (commissionIds: string[]) => {
      for (const id of commissionIds) {
        const { error } = await supabase.from('ambassador_commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-amb-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['tt-ambassadors'] });
      toast.success('Payouts processed');
    },
  });

  const filtered = (ambassadors || [])
    .filter(a => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.referral_code?.toLowerCase().includes(search.toLowerCase()) || a.tracking_code?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : Number(av) - Number(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const stats = {
    total: ambassadors?.length || 0,
    active: ambassadors?.filter(a => a.is_active).length || 0,
    totalEarnings: ambassadors?.reduce((s, a) => s + Number(a.total_earnings || 0), 0) || 0,
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Referral Code', 'Status', 'Tier', 'Total Earnings'];
    const rows = filtered.map(a => [a.name, a.referral_code || a.tracking_code, a.is_active ? 'Active' : 'Inactive', a.tier, a.total_earnings]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a'); a2.href = url; a2.download = `ambassadors_${format(new Date(), 'yyyyMMdd')}.csv`; a2.click();
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer hover:text-[#C9A84C] transition-colors text-white/50" onClick={() => toggleSort(k)}>
      {label} {sortKey === k && (sortDir === 'asc' ? '↑' : '↓')}
    </TableHead>
  );

  const pendingCommissions = commissions?.filter(c => c.status === 'pending') || [];
  const paidCommissions = commissions?.filter(c => c.status === 'paid') || [];
  const pendingTotal = pendingCommissions.reduce((s, c) => s + Number(c.amount || 0), 0);

  // Tier progress
  const ambTier = selectedAmb?.tier || 'starter';
  const cfg = TIER_CONFIG[ambTier] || TIER_CONFIG.starter;
  const referralCount = commissions?.length || 0;
  const progress = cfg.max > 0 ? Math.min(100, ((referralCount - cfg.min) / (cfg.max - cfg.min + 1)) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ambassador Network</h1>
          <p className="text-white/40 text-sm">Manage referral partners & commissions</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { title: 'Total Ambassadors', value: stats.total, icon: Users },
          { title: 'Active', value: stats.active, icon: CheckCircle },
          { title: 'Total Earned', value: `$${stats.totalEarnings.toLocaleString()}`, icon: DollarSign },
          { title: 'Pending Payouts', value: '—', icon: Clock },
        ].map(s => (
          <Card key={s.title} className="bg-[#111111] border-[#C9A84C]/10">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">{s.title}</p>
                  <p className="text-3xl font-bold text-[#C9A84C] mt-1">{s.value}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-[#C9A84C]/10"><s.icon className="h-5 w-5 text-[#C9A84C]" /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input placeholder="Search ambassadors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <SortHeader label="Name" k="name" />
                <SortHeader label="Code" k="tracking_code" />
                <SortHeader label="Status" k="is_active" />
                <SortHeader label="Tier" k="tier" />
                <SortHeader label="Total Earned" k="total_earnings" />
                <TableHead className="text-white/50">Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array(5).fill(0).map((_, i) => (
                <TableRow key={i} className="border-white/5"><TableCell colSpan={6}><Skeleton className="h-10 bg-white/5" /></TableCell></TableRow>
              )) : filtered.length === 0 ? (
                <TableRow className="border-white/5"><TableCell colSpan={6} className="text-center text-white/30 py-12">No ambassadors found</TableCell></TableRow>
              ) : filtered.map(a => (
                <TableRow key={a.id} className="border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedAmb(a)}>
                  <TableCell className="text-white font-medium">{a.name}</TableCell>
                  <TableCell className="text-white/60 font-mono text-xs">{a.referral_code || a.tracking_code}</TableCell>
                  <TableCell>
                    <Badge className={a.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell><TierBadge tier={a.tier || 'starter'} /></TableCell>
                  <TableCell className="text-[#C9A84C] font-semibold">${Number(a.total_earnings || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-white/40">{a.phone_primary || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ambassador Detail Sheet */}
      <Sheet open={!!selectedAmb} onOpenChange={open => !open && setSelectedAmb(null)}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[500px] sm:max-w-[500px]">
          {selectedAmb && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold text-lg">
                    {selectedAmb.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div>{selectedAmb.name}</div>
                    <TierBadge tier={selectedAmb.tier || 'starter'} />
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Referral Code */}
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-white/40 mb-2">Referral Code</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[#C9A84C] font-mono text-lg">{selectedAmb.referral_code || selectedAmb.tracking_code}</code>
                    <Button size="sm" variant="ghost" className="h-7 text-white/40 hover:text-[#C9A84C]" onClick={() => {
                      navigator.clipboard.writeText(selectedAmb.referral_code || selectedAmb.tracking_code || '');
                      toast.success('Copied to clipboard');
                    }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Tier Progress */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-xs text-white/40">Tier Progress</p>
                    <p className="text-xs text-white/40">{referralCount} referrals</p>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/10" />
                  <div className="flex justify-between mt-2 text-[10px] text-white/30">
                    <span>Bronze (0-5)</span><span>Silver (6-20)</span><span>Gold (21-50)</span><span>Platinum (50+)</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Total Earned</p>
                    <p className="text-lg font-bold text-[#C9A84C]">${Number(selectedAmb.total_earnings || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Pending Payout</p>
                    <p className="text-lg font-bold text-amber-400">${pendingTotal.toLocaleString()}</p>
                  </div>
                </div>

                {/* Process Payout */}
                {pendingCommissions.length > 0 && (
                  <Button className="w-full bg-[#C9A84C] hover:bg-[#B8973F] text-black" disabled={payoutMutation.isPending}
                    onClick={() => payoutMutation.mutate(pendingCommissions.map(c => c.id))}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Process {pendingCommissions.length} Pending Payouts (${pendingTotal.toLocaleString()})
                  </Button>
                )}

                {/* Commission History */}
                <div>
                  <h3 className="text-sm font-semibold text-[#C9A84C] mb-3">Commission History</h3>
                  {(commissions || []).length === 0 ? (
                    <p className="text-sm text-white/30">No commissions recorded</p>
                  ) : commissions!.slice(0, 10).map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 mb-2">
                      <div>
                        <span className="text-[#C9A84C] font-semibold">${Number(c.amount || 0).toLocaleString()}</span>
                        <p className="text-xs text-white/30">{c.created_at ? format(new Date(c.created_at), 'MMM d, yyyy') : ''}</p>
                      </div>
                      <Badge className={c.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>{c.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
