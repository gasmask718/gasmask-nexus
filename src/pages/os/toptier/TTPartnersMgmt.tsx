import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pubFetch, pubPatch, pubPost } from '@/lib/publicSiteApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Users, Shield, Clock, AlertTriangle, Star, Plus, Search, ExternalLink, Phone, Mail } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const TYPES = ['All', 'Driver', 'Chef', 'Security', 'Photographer', 'Yacht Owner', 'Florist', 'Wellness', 'Beauty', 'Media'];
const STATUSES = ['All', 'Active', 'Pending', 'Suspended'];

function KPICard({ label, value, icon: Icon, color = 'text-[#C9A84C]' }: any) {
  return (
    <Card className="bg-[#111111] border-[#C9A84C]/10">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    pending_review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <Badge className={map[s] || 'bg-white/10 text-white/60'}>{status}</Badge>;
}

export default function TTPartnersMgmt() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({ business_name: '', type: '', email: '', phone: '', markets: '', bio: '', trust_score: 80, status: 'pending' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: partners = [], isError } = useQuery({
    queryKey: ['pub-partners'],
    queryFn: () => pubFetch('partners', { order: 'created_at.desc' }),
  });

  const { data: partnerBookings = [] } = useQuery({
    queryKey: ['pub-partner-bookings', selectedPartner?.id],
    queryFn: () => selectedPartner ? pubFetch('bookings', { filters: { partner_id: `eq.${selectedPartner.id}` }, order: 'created_at.desc', limit: 20 }) : Promise.resolve([]),
    enabled: !!selectedPartner,
  });

  const { data: partnerEarnings = [] } = useQuery({
    queryKey: ['pub-partner-earnings', selectedPartner?.id],
    queryFn: () => selectedPartner ? pubFetch('partner_earnings', { filters: { partner_id: `eq.${selectedPartner.id}` } }) : Promise.resolve([]),
    enabled: !!selectedPartner,
  });

  const filtered = useMemo(() => {
    return partners.filter((p: any) => {
      const s = search.toLowerCase();
      if (s && !(p.business_name || '').toLowerCase().includes(s) && !(p.email || '').toLowerCase().includes(s)) return false;
      if (typeFilter !== 'All' && (p.type || '').toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (statusFilter !== 'All') {
        const st = (p.status || '').toLowerCase();
        if (statusFilter === 'Active' && st !== 'approved' && st !== 'active') return false;
        if (statusFilter === 'Pending' && st !== 'pending' && st !== 'pending_review') return false;
        if (statusFilter === 'Suspended' && st !== 'suspended') return false;
      }
      return true;
    });
  }, [partners, search, typeFilter, statusFilter]);

  const total = partners.length;
  const active = partners.filter((p: any) => ['approved', 'active'].includes((p.status || '').toLowerCase())).length;
  const pending = partners.filter((p: any) => ['pending', 'pending_review'].includes((p.status || '').toLowerCase())).length;
  const suspended = partners.filter((p: any) => (p.status || '').toLowerCase() === 'suspended').length;
  const avgTrust = total > 0 ? Math.round(partners.reduce((a: number, p: any) => a + (p.trust_score || 0), 0) / total) : 0;

  const handleAction = async (id: string, data: Record<string, any>, label: string) => {
    setActionLoading(id);
    const ok = await pubPatch('partners', id, data);
    if (ok) { toast.success(`${label} successful`); qc.invalidateQueries({ queryKey: ['pub-partners'] }); }
    else toast.error('Update failed. Try again.');
    setActionLoading(null);
  };

  const handleAdd = async () => {
    const result = await pubPost('partners', { ...newPartner, markets: newPartner.markets ? newPartner.markets.split(',').map(m => m.trim()) : [] });
    if (result) { toast.success('Partner created!'); setAddOpen(false); setNewPartner({ business_name: '', type: '', email: '', phone: '', markets: '', bio: '', trust_score: 80, status: 'pending' }); qc.invalidateQueries({ queryKey: ['pub-partners'] }); }
    else toast.error('Failed to create partner.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Partner Command Center</h1>
          <p className="text-white/40 text-sm">Manage your service provider network</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"><Plus className="h-4 w-4 mr-2" />New Partner</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111111] border-[#C9A84C]/20 text-white max-w-lg">
            <DialogHeader><DialogTitle className="text-[#C9A84C]">Add Partner</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-white/60">Business Name *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newPartner.business_name} onChange={e => setNewPartner({...newPartner, business_name: e.target.value})} /></div>
              <div><Label className="text-white/60">Type *</Label>
                <Select value={newPartner.type} onValueChange={v => setNewPartner({...newPartner, type: v})}>
                  <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111111] border-white/10">{TYPES.filter(t=>t!=='All').map(t=><SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-white/60">Email *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newPartner.email} onChange={e => setNewPartner({...newPartner, email: e.target.value})} /></div>
              <div><Label className="text-white/60">Phone *</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newPartner.phone} onChange={e => setNewPartner({...newPartner, phone: e.target.value})} /></div>
              <div><Label className="text-white/60">Markets (comma separated)</Label><Input className="bg-[#0A0A0A] border-white/10 text-white" value={newPartner.markets} onChange={e => setNewPartner({...newPartner, markets: e.target.value})} /></div>
              <div><Label className="text-white/60">Bio</Label><Textarea className="bg-[#0A0A0A] border-white/10 text-white" value={newPartner.bio} onChange={e => setNewPartner({...newPartner, bio: e.target.value})} /></div>
              <Button className="w-full bg-[#C9A84C] text-black" onClick={handleAdd}>Create Partner</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-sm">
          Could not load data from public site. Check Settings &gt; Public Site Connection.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard label="Total Partners" value={total} icon={Users} />
        <KPICard label="Active" value={active} icon={Shield} color="text-emerald-400" />
        <KPICard label="Pending Review" value={pending} icon={Clock} color={pending > 0 ? 'text-amber-400' : 'text-white/40'} />
        <KPICard label="Suspended" value={suspended} icon={AlertTriangle} color={suspended > 0 ? 'text-red-400' : 'text-white/40'} />
        <KPICard label="Avg Trust Score" value={avgTrust} icon={Star} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {TYPES.map(t => (
            <Button key={t} size="sm" variant={typeFilter === t ? 'default' : 'ghost'} className={typeFilter === t ? 'bg-[#C9A84C] text-black' : 'text-white/60'} onClick={() => setTypeFilter(t)}>{t}</Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {STATUSES.map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'ghost'} className={statusFilter === s ? 'bg-[#C9A84C] text-black' : 'text-white/60'} onClick={() => setStatusFilter(s)}>{s}</Button>
          ))}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-white/30" />
            <Input className="bg-[#111111] border-white/10 text-white pl-9 w-56" placeholder="Search partners..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#111111] border-[#C9A84C]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-white/40">Partner</TableHead>
              <TableHead className="text-white/40">Markets</TableHead>
              <TableHead className="text-white/40">Trust</TableHead>
              <TableHead className="text-white/40">Status</TableHead>
              <TableHead className="text-white/40">Since</TableHead>
              <TableHead className="text-white/40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-12">No partners found. Click + New Partner to add one.</TableCell></TableRow>
            ) : filtered.map((p: any) => {
              const st = (p.status || '').toLowerCase();
              const trust = p.trust_score || 0;
              const markets = Array.isArray(p.markets) ? p.markets : typeof p.markets === 'string' ? p.markets.split(',') : [];
              return (
                <TableRow key={p.id} className="border-white/5">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-xs font-bold text-[#C9A84C]">
                        {(p.business_name || 'P').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{p.business_name || 'Unnamed'}</p>
                        <p className="text-white/40 text-xs">{p.type || 'N/A'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {markets.slice(0, 3).map((m: string, i: number) => <Badge key={i} className="bg-white/5 text-white/60 text-[10px]">{m.trim()}</Badge>)}
                      {markets.length > 3 && <Badge className="bg-white/5 text-white/40 text-[10px]">+{markets.length - 3}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><span className={`font-bold ${trust >= 80 ? 'text-emerald-400' : trust >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{trust}</span></TableCell>
                  <TableCell><StatusBadge status={p.status || 'unknown'} /></TableCell>
                  <TableCell className="text-white/40 text-sm">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {(st === 'pending' || st === 'pending_review') && <>
                        <Button size="sm" className="bg-emerald-500/20 text-emerald-400 h-7 text-xs" disabled={actionLoading === p.id} onClick={() => handleAction(p.id, { status: 'approved' }, 'Approved')}>Approve</Button>
                        <Button size="sm" className="bg-red-500/20 text-red-400 h-7 text-xs" disabled={actionLoading === p.id} onClick={() => handleAction(p.id, { status: 'rejected' }, 'Rejected')}>Reject</Button>
                      </>}
                      {st === 'approved' || st === 'active' ? <Button size="sm" className="bg-amber-500/20 text-amber-400 h-7 text-xs" disabled={actionLoading === p.id} onClick={() => handleAction(p.id, { status: 'suspended' }, 'Suspended')}>Suspend</Button> : null}
                      {st === 'suspended' && <Button size="sm" className="bg-emerald-500/20 text-emerald-400 h-7 text-xs" disabled={actionLoading === p.id} onClick={() => handleAction(p.id, { status: 'approved' }, 'Reinstated')}>Reinstate</Button>}
                      <Button size="sm" variant="ghost" className="text-[#C9A84C] h-7 text-xs" onClick={() => { setSelectedPartner(p); setSheetOpen(true); }}>View</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[500px] sm:max-w-[500px] overflow-y-auto">
          {selectedPartner && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-lg font-bold text-[#C9A84C]">
                    {(selectedPartner.business_name || 'P').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-white text-lg">{selectedPartner.business_name}</SheetTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge className="bg-white/5 text-white/60">{selectedPartner.type}</Badge>
                      <StatusBadge status={selectedPartner.status || ''} />
                      <span className="text-[#C9A84C] font-bold text-sm">Trust: {selectedPartner.trust_score || 0}</span>
                    </div>
                  </div>
                </div>
              </SheetHeader>
              <Tabs defaultValue="profile" className="mt-6">
                <TabsList className="bg-white/5 border-white/10">
                  <TabsTrigger value="profile" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Profile</TabsTrigger>
                  <TabsTrigger value="bookings" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Bookings</TabsTrigger>
                  <TabsTrigger value="earnings" className="data-[state=active]:bg-[#C9A84C]/20 data-[state=active]:text-[#C9A84C]">Earnings</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    {selectedPartner.email && <a href={`mailto:${selectedPartner.email}`} className="flex items-center gap-2 text-sm text-[#C9A84C] hover:underline"><Mail className="h-4 w-4" />{selectedPartner.email}</a>}
                    {selectedPartner.phone && <a href={`tel:${selectedPartner.phone}`} className="flex items-center gap-2 text-sm text-white/60"><Phone className="h-4 w-4" />{selectedPartner.phone}</a>}
                  </div>
                  {selectedPartner.bio && <p className="text-white/60 text-sm">{selectedPartner.bio}</p>}
                  {selectedPartner.description && <p className="text-white/60 text-sm">{selectedPartner.description}</p>}
                </TabsContent>
                <TabsContent value="bookings" className="mt-4">
                  <p className="text-white/40 text-sm mb-2">Total: {partnerBookings.length} bookings</p>
                  <div className="space-y-2">
                    {partnerBookings.length === 0 ? <p className="text-white/30 text-sm">No bookings found.</p> : partnerBookings.map((b: any) => (
                      <div key={b.id} className="p-3 bg-white/5 rounded-lg flex justify-between text-sm">
                        <div>
                          <p className="text-white">{b.service_type || b.service_name || 'Booking'}</p>
                          <p className="text-white/40 text-xs">{b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#C9A84C] font-bold">${Number(b.total_price || b.amount || 0).toLocaleString()}</p>
                          <StatusBadge status={b.status || ''} />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="earnings" className="mt-4">
                  {partnerEarnings.length === 0 ? <p className="text-white/30 text-sm">No earnings data found.</p> : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={partnerEarnings.slice(0, 12)}>
                          <XAxis dataKey="month" tick={{ fill: '#ffffff60', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#ffffff60', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#111', border: '1px solid #C9A84C33' }} />
                          <Bar dataKey="amount" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
