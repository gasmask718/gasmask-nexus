import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTopTierData, patchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCheck, Clock, Star, Search, Download, Eye, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type SortKey = 'name' | 'service_category' | 'status' | 'trust_score' | 'total_bookings' | 'response_rate' | 'last_active_at';
type SortDir = 'asc' | 'desc';

function KPICard({ title, value, icon: Icon, loading }: any) {
  if (loading) return <Card className="bg-[#111111] border-[#C9A84C]/10"><CardContent className="p-5"><Skeleton className="h-16 bg-white/5" /></CardContent></Card>;
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-[#C9A84C] mt-1">{value}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#C9A84C]/10"><Icon className="h-5 w-5 text-[#C9A84C]" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= score ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-white/10'}`} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <Badge className={colors[status] || colors.pending}>{status}</Badge>;
}

export default function TTPartners() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  const { data: partners, isLoading } = useQuery({
    queryKey: ['tt-partners'],
    queryFn: () => fetchTopTierData('partners', {
      select: '*',
      order: 'created_at.desc',
    }),
  });

  const { data: partnerBookings } = useQuery({
    queryKey: ['tt-partner-bookings', selectedPartner?.id],
    enabled: !!selectedPartner,
    queryFn: () => fetchTopTierData('bookings', {
      select: '*',
      filters: { 'partner_id': `eq.${selectedPartner.id}` },
      order: 'created_at.desc',
      limit: 5,
    }),
  });

  const { data: partnerEarnings } = useQuery({
    queryKey: ['tt-partner-earnings', selectedPartner?.id],
    enabled: !!selectedPartner,
    queryFn: () => fetchTopTierData('partner_earnings', {
      select: '*',
      filters: { 'partner_id': `eq.${selectedPartner.id}` },
      order: 'created_at.desc',
    }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await patchTopTierData('partners', { 'id': `eq.${id}` }, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tt-partners'] });
      toast.success('Partner status updated');
    },
  });

  const filtered = (partners || [])
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.service_category?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const stats = {
    total: partners?.length || 0,
    active: partners?.filter(p => p.status === 'active').length || 0,
    pending: partners?.filter(p => p.status === 'pending').length || 0,
    avgTrust: partners?.length ? (partners.reduce((s, p) => s + (p.trust_score || 0), 0) / partners.length).toFixed(1) : '0',
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Category', 'Status', 'Trust Score', 'Total Bookings', 'Response Rate', 'Last Active'];
    const rows = filtered.map(p => [p.name, p.service_category, p.status, p.trust_score, p.total_bookings, `${p.response_rate}%`, p.last_active_at ? format(new Date(p.last_active_at), 'yyyy-MM-dd') : '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `partners_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer hover:text-[#C9A84C] transition-colors text-white/50" onClick={() => toggleSort(k)}>
      {label} {sortKey === k && (sortDir === 'asc' ? '↑' : '↓')}
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Partner Network</h1>
          <p className="text-white/40 text-sm">Manage luxury service providers</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Total Partners" value={stats.total} icon={Users} loading={isLoading} />
        <KPICard title="Active" value={stats.active} icon={UserCheck} loading={isLoading} />
        <KPICard title="Pending Approval" value={stats.pending} icon={Clock} loading={isLoading} />
        <KPICard title="Avg Trust Score" value={stats.avgTrust} icon={Star} loading={isLoading} />
      </div>

      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input placeholder="Search partners..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <SortHeader label="Name" k="name" />
                <SortHeader label="Category" k="service_category" />
                <SortHeader label="Status" k="status" />
                <SortHeader label="Trust Score" k="trust_score" />
                <SortHeader label="Bookings" k="total_bookings" />
                <SortHeader label="Response Rate" k="response_rate" />
                <SortHeader label="Last Active" k="last_active_at" />
                <TableHead className="text-white/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array(5).fill(0).map((_, i) => (
                <TableRow key={i} className="border-white/5"><TableCell colSpan={8}><Skeleton className="h-10 bg-white/5" /></TableCell></TableRow>
              )) : filtered.length === 0 ? (
                <TableRow className="border-white/5"><TableCell colSpan={8} className="text-center text-white/30 py-12">No partners found</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedPartner(p)}>
                  <TableCell className="text-white font-medium">{p.name}</TableCell>
                  <TableCell className="text-white/60">{p.service_category}</TableCell>
                  <TableCell><StatusBadge status={p.status || 'pending'} /></TableCell>
                  <TableCell><StarRating score={p.trust_score || 0} /></TableCell>
                  <TableCell className="text-white/60">{p.total_bookings || 0}</TableCell>
                  <TableCell className="text-white/60">{p.response_rate || 0}%</TableCell>
                  <TableCell className="text-white/40">{p.last_active_at ? format(new Date(p.last_active_at), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 text-white/40 hover:text-[#C9A84C]" onClick={() => setSelectedPartner(p)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {p.status !== 'active' && (
                        <Button size="sm" variant="ghost" className="h-7 text-emerald-400 hover:text-emerald-300" onClick={() => updateStatus.mutate({ id: p.id, status: 'active' })}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {p.status !== 'suspended' && (
                        <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:text-red-300" onClick={() => updateStatus.mutate({ id: p.id, status: 'suspended' })}>
                          <XCircle className="h-3.5 w-3.5" />
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

      {/* Partner Detail Sheet */}
      <Sheet open={!!selectedPartner} onOpenChange={open => !open && setSelectedPartner(null)}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[500px] sm:max-w-[500px]">
          {selectedPartner && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold text-lg">
                    {selectedPartner.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div>{selectedPartner.name}</div>
                    <div className="text-sm font-normal text-white/40">{selectedPartner.business_name}</div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Status</p>
                    <StatusBadge status={selectedPartner.status || 'pending'} />
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Trust Score</p>
                    <StarRating score={selectedPartner.trust_score || 0} />
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Total Bookings</p>
                    <p className="text-lg font-bold text-white">{selectedPartner.total_bookings || 0}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Response Rate</p>
                    <p className="text-lg font-bold text-white">{selectedPartner.response_rate || 0}%</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Category</p>
                    <p className="text-sm text-white">{selectedPartner.service_category}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/40">Total Earnings</p>
                    <p className="text-lg font-bold text-[#C9A84C]">${Number(selectedPartner.total_earnings || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedPartner.status !== 'active' && (
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { updateStatus.mutate({ id: selectedPartner.id, status: 'active' }); setSelectedPartner({ ...selectedPartner, status: 'active' }); }}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Approve
                    </Button>
                  )}
                  {selectedPartner.status !== 'suspended' && (
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => { updateStatus.mutate({ id: selectedPartner.id, status: 'suspended' }); setSelectedPartner({ ...selectedPartner, status: 'suspended' }); }}>
                      <XCircle className="h-4 w-4 mr-2" /> Suspend
                    </Button>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#C9A84C] mb-3">Recent Bookings</h3>
                  {(partnerBookings || []).length === 0 ? (
                    <p className="text-sm text-white/30">No bookings yet</p>
                  ) : partnerBookings!.map(b => (
                    <div key={b.id} className="bg-white/5 rounded-lg p-3 mb-2">
                      <div className="flex justify-between"><span className="text-sm text-white">{b.service_name}</span><StatusBadge status={b.status || 'pending'} /></div>
                      <p className="text-xs text-white/40 mt-1">{b.client_name} • ${Number(b.total_price || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#C9A84C] mb-3">Earnings History</h3>
                  {(partnerEarnings || []).length === 0 ? (
                    <p className="text-sm text-white/30">No earnings recorded</p>
                  ) : partnerEarnings!.map(e => (
                    <div key={e.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 mb-2">
                      <span className="text-[#C9A84C] font-semibold">${Number(e.amount || 0).toLocaleString()}</span>
                      <Badge className={e.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>{e.status}</Badge>
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
