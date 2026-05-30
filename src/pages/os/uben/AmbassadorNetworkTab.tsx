import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, TrendingUp, DollarSign, Network, UserPlus, Search, Filter, Download,
  ChevronRight, CheckCircle, XCircle, Eye, MessageSquare, Ban, Award, Zap, Settings,
  ArrowRight, Clock
} from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';

const GOLD = '#C9A84C';
const NAVY = '#1B2A4A';

const BUSINESS_UNITS = ['All', 'Unforgettable Times', 'TopTier Experience', 'iClean WeClean', 'GasMask', 'UBEN Programs'];
const SALE_TYPES = ['Sale', 'Referral', 'Program Enrollment', 'Event Booking'];
const TIERS = ['bronze', 'silver', 'gold', 'platinum'];
const APP_STAGES = ['applied', 'under_review', 'approved', 'onboarding', 'active', 'rejected'];

// ── Hooks ──────────────────────────────────────────────────────────────

function useAmbassadors() {
  return useQuery({
    queryKey: ['uben-ambassadors-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_ambassadors')
        .select('*, uben_staff_recruiters(name, business_unit)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useStaffRecruiters() {
  return useQuery({
    queryKey: ['uben-staff-recruiters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_staff_recruiters').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });
}

function useCommissionConfig() {
  return useQuery({
    queryKey: ['uben-commission-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_commission_config').select('*').order('business_unit');
      if (error) throw error;
      return data || [];
    },
  });
}

function useCommissionLedger() {
  return useQuery({
    queryKey: ['uben-commission-ledger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_commission_ledger')
        .select('*, uben_ambassadors(full_name), uben_staff_recruiters(name)')
        .order('sale_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useApplications() {
  return useQuery({
    queryKey: ['uben-ambassador-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_ambassador_applications')
        .select('*, uben_staff_recruiters(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ── KPI Card ───────────────────────────────────────────────────────────

function KPI({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <Card className="border-0 bg-gradient-to-br from-[#1B2A4A] to-[#0F1A2E]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold font-mono mt-1" style={{ color: GOLD }}>{value}</p>
          </div>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
            <Icon className="h-4 w-4" style={{ color: GOLD }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tier Badge ─────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    bronze: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    silver: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
    gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    platinum: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  return <Badge className={styles[tier] || styles.bronze}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Badge>;
}

// ── SUB-TAB 1: Network Overview ────────────────────────────────────────

function NetworkOverview() {
  const { data: ambassadors = [] } = useAmbassadors();
  const { data: ledger = [] } = useCommissionLedger();
  const { data: staff = [] } = useStaffRecruiters();
  const [buFilter, setBuFilter] = useState('All');

  const thisMonth = startOfMonth(new Date());

  const filtered = buFilter === 'All' ? ambassadors : ambassadors.filter(a => a.business_unit === buFilter);
  const filteredLedger = buFilter === 'All' ? ledger : ledger.filter(l => l.business_unit === buFilter);

  const activeThisMonth = new Set(
    filteredLedger.filter(l => new Date(l.sale_date) >= thisMonth).map(l => l.ambassador_id)
  ).size;

  const totalSales = filteredLedger.reduce((s, l) => s + Number(l.sale_amount || 0), 0);
  const totalCommissions = filteredLedger.filter(l => l.status === 'paid').reduce((s, l) => s + Number(l.ambassador_commission || 0), 0);
  const totalOverrides = filteredLedger.filter(l => l.status === 'paid').reduce((s, l) => s + Number(l.staff_override_amount || 0), 0);

  // Staff tree
  const staffTree = staff.map(s => {
    const recruits = ambassadors.filter(a => a.recruited_by_staff_id === s.id);
    const recruitIds = new Set(recruits.map(r => r.id));
    const staffLedger = ledger.filter(l => recruitIds.has(l.ambassador_id));
    return {
      ...s,
      ambassadorCount: recruits.length,
      networkSales: staffLedger.reduce((sum, l) => sum + Number(l.sale_amount || 0), 0),
      overrideEarned: staffLedger.reduce((sum, l) => sum + Number(l.staff_override_amount || 0), 0),
    };
  }).filter(s => buFilter === 'All' || s.business_unit === buFilter);

  return (
    <div className="space-y-6">
      {/* BU Filter */}
      <div className="flex flex-wrap gap-2">
        {BUSINESS_UNITS.map(bu => (
          <button
            key={bu}
            onClick={() => setBuFilter(bu)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              buFilter === bu ? 'text-black' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
            style={buFilter === bu ? { backgroundColor: GOLD } : {}}
          >
            {bu}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI title="Total Ambassadors" value={filtered.length} icon={Users} />
        <KPI title="Active This Month" value={activeThisMonth} icon={Zap} />
        <KPI title="Total Sales Generated" value={`$${totalSales.toLocaleString()}`} icon={DollarSign} />
        <KPI title="Commissions Paid" value={`$${totalCommissions.toLocaleString()}`} icon={TrendingUp} />
        <KPI title="Staff Overrides" value={`$${totalOverrides.toLocaleString()}`} icon={Award} />
      </div>

      {/* Staff Network Tree */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Network className="h-4 w-4" style={{ color: GOLD }} /> Network Tree Summary
        </h3>
        {staffTree.length === 0 ? (
          <Card className="border-0 bg-card/80 p-6 text-center text-muted-foreground text-sm">No staff recruiters yet. Add staff in the Staff Recruiter Dashboard.</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {staffTree.map(s => (
              <Card key={s.id} className="border-0 bg-card/80 hover:bg-card/90 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${GOLD}30`, color: GOLD }}>
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.business_unit}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Recruited:</span> <span className="font-medium">{s.ambassadorCount}</span></div>
                    <div><span className="text-muted-foreground">Sales:</span> <span className="font-mono" style={{ color: GOLD }}>${s.networkSales.toLocaleString()}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Override Earned:</span> <span className="font-mono" style={{ color: GOLD }}>${s.overrideEarned.toLocaleString()}</span></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SUB-TAB 2: Ambassador Roster ───────────────────────────────────────

function AmbassadorRoster() {
  const queryClient = useQueryClient();
  const { data: ambassadors = [] } = useAmbassadors();
  const { data: ledger = [] } = useCommissionLedger();
  const [search, setSearch] = useState('');
  const [buFilter, setBuFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [selectedAmb, setSelectedAmb] = useState<any>(null);

  const filtered = ambassadors.filter(a => {
    const matchBu = buFilter === 'All' || a.business_unit === buFilter;
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    const matchTier = tierFilter === 'All' || a.tier === tierFilter;
    const matchSearch = !search || a.full_name?.toLowerCase().includes(search.toLowerCase()) || a.referral_code?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase());
    return matchBu && matchStatus && matchTier && matchSearch;
  });

  const getAmbSales = (id: string) => ledger.filter(l => l.ambassador_id === id);
  const getTotal = (id: string, field: string) => getAmbSales(id).reduce((s, l) => s + Number((l as any)[field] || 0), 0);

  const suspendAmb = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uben_ambassadors').update({ status: 'suspended' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-ambassadors-full'] }); toast.success('Ambassador suspended'); },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, code, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={buFilter} onValueChange={setBuFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Business Unit" /></SelectTrigger>
          <SelectContent>{BUSINESS_UNITS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            {['active', 'inactive', 'pending', 'suspended'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Tiers</SelectItem>
            {TIERS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Ref Code</TableHead>
              <TableHead>Business Unit</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Recruited By</TableHead>
              <TableHead>Total Sales</TableHead>
              <TableHead>Commissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No ambassadors found.</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedAmb(a)}>
                <TableCell className="font-medium">{a.full_name}</TableCell>
                <TableCell className="font-mono text-xs">{a.referral_code || '—'}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{a.business_unit || '—'}</Badge></TableCell>
                <TableCell><TierBadge tier={a.tier || 'bronze'} /></TableCell>
                <TableCell className="text-xs">{(a as any).uben_staff_recruiters?.name || '—'}</TableCell>
                <TableCell className="font-mono text-xs">${getTotal(a.id, 'sale_amount').toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">${getTotal(a.id, 'ambassador_commission').toLocaleString()}</TableCell>
                <TableCell><Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedAmb(a)}><Eye className="h-3.5 w-3.5" /></Button>
                    {a.status !== 'suspended' && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => suspendAmb.mutate(a.id)}><Ban className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Profile Modal */}
      <Dialog open={!!selectedAmb} onOpenChange={() => setSelectedAmb(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ambassador Profile</DialogTitle></DialogHeader>
          {selectedAmb && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {selectedAmb.full_name}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedAmb.email || '—'}</div>
                <div><span className="text-muted-foreground">Phone:</span> {selectedAmb.phone || '—'}</div>
                <div><span className="text-muted-foreground">Ref Code:</span> <span className="font-mono">{selectedAmb.referral_code || '—'}</span></div>
                <div><span className="text-muted-foreground">Business Unit:</span> {selectedAmb.business_unit || '—'}</div>
                <div><span className="text-muted-foreground">Joined:</span> {format(new Date(selectedAmb.created_at), 'MMM d, yyyy')}</div>
                <div><span className="text-muted-foreground">Recruited By:</span> {(selectedAmb as any).uben_staff_recruiters?.name || '—'}</div>
                <div><span className="text-muted-foreground">Tier:</span> <TierBadge tier={selectedAmb.tier || 'bronze'} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-0 bg-muted/50"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Earned</p><p className="font-mono font-bold" style={{ color: GOLD }}>${getTotal(selectedAmb.id, 'ambassador_commission').toLocaleString()}</p></CardContent></Card>
                <Card className="border-0 bg-muted/50"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Paid</p><p className="font-mono font-bold">${getAmbSales(selectedAmb.id).filter(l => l.status === 'paid').reduce((s, l) => s + Number(l.ambassador_commission || 0), 0).toLocaleString()}</p></CardContent></Card>
                <Card className="border-0 bg-muted/50"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Pending</p><p className="font-mono font-bold">${getAmbSales(selectedAmb.id).filter(l => l.status === 'pending').reduce((s, l) => s + Number(l.ambassador_commission || 0), 0).toLocaleString()}</p></CardContent></Card>
              </div>
              <div>
                <p className="text-xs font-medium mb-2">Sales History</p>
                <div className="max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Commission</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {getAmbSales(selectedAmb.id).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">No sales yet</TableCell></TableRow>
                      ) : getAmbSales(selectedAmb.id).map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{format(new Date(l.sale_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-xs font-mono">${Number(l.sale_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-mono">${Number(l.ambassador_commission).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={l.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">{l.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SUB-TAB 3: Staff Recruiter Dashboard ───────────────────────────────

function StaffDashboard() {
  const queryClient = useQueryClient();
  const { data: staff = [] } = useStaffRecruiters();
  const { data: ambassadors = [] } = useAmbassadors();
  const { data: ledger = [] } = useCommissionLedger();
  const { data: config = [] } = useCommissionConfig();
  const [showAddStaff, setShowAddStaff] = useState(false);

  const thisMonth = startOfMonth(new Date());

  const addStaff = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_staff_recruiters').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-staff-recruiters'] }); toast.success('Staff added'); setShowAddStaff(false); },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: number }) => {
      const { error } = await supabase.from('uben_commission_config').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-commission-config'] }); toast.success('Rate updated'); },
  });

  return (
    <div className="space-y-6">
      {/* Override Structure Config */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4" style={{ color: GOLD }} /> Commission Rate Config
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {config.map(c => (
            <Card key={c.id} className="border-0 bg-card/80">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">{c.business_unit}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Ambassador %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      defaultValue={Number(c.ambassador_commission_rate)}
                      className="h-8 text-xs"
                      onBlur={e => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== Number(c.ambassador_commission_rate)) {
                          updateConfig.mutate({ id: c.id, field: 'ambassador_commission_rate', value: val });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Staff Override %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      defaultValue={Number(c.staff_override_rate)}
                      className="h-8 text-xs"
                      onBlur={e => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== Number(c.staff_override_rate)) {
                          updateConfig.mutate({ id: c.id, field: 'staff_override_rate', value: val });
                        }
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Staff Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: GOLD }} /> Staff Recruiters
        </h3>
        <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }} onClick={() => setShowAddStaff(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Add Staff
        </Button>
      </div>

      {staff.length === 0 ? (
        <Card className="border-0 bg-card/80 p-6 text-center text-muted-foreground text-sm">No staff recruiters added yet.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staff.map(s => {
            const recruits = ambassadors.filter(a => a.recruited_by_staff_id === s.id);
            const recruitIds = new Set(recruits.map(r => r.id));
            const sLedger = ledger.filter(l => recruitIds.has(l.ambassador_id));
            const activeThisMonth = new Set(sLedger.filter(l => new Date(l.sale_date) >= thisMonth).map(l => l.ambassador_id)).size;
            const overrideEarned = sLedger.reduce((sum, l) => sum + Number(l.staff_override_amount || 0), 0);
            const mtdOverride = sLedger.filter(l => new Date(l.sale_date) >= thisMonth).reduce((sum, l) => sum + Number(l.staff_override_amount || 0), 0);

            return (
              <Card key={s.id} className="border-0 bg-card/80">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${GOLD}30`, color: GOLD }}>
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <Badge variant="outline" className="text-[10px]">{s.business_unit}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div><span className="text-muted-foreground">Ambassadors:</span> <span className="font-medium">{recruits.length}</span></div>
                    <div><span className="text-muted-foreground">Active MTD:</span> <span className="font-medium">{activeThisMonth}</span></div>
                    <div><span className="text-muted-foreground">Override Earned:</span> <span className="font-mono" style={{ color: GOLD }}>${overrideEarned.toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">MTD Override:</span> <span className="font-mono" style={{ color: GOLD }}>${mtdOverride.toLocaleString()}</span></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Staff Recruiter</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addStaff.mutate({ name: fd.get('name'), email: fd.get('email'), business_unit: fd.get('business_unit') }); }} className="space-y-3">
            <div><Label>Name</Label><Input name="name" required /></div>
            <div><Label>Email</Label><Input name="email" type="email" /></div>
            <div><Label>Business Unit</Label>
              <select name="business_unit" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {BUSINESS_UNITS.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={addStaff.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SUB-TAB 4: Sales & Commissions Log ─────────────────────────────────

function CommissionsLog() {
  const queryClient = useQueryClient();
  const { data: ledger = [] } = useCommissionLedger();
  const { data: ambassadors = [] } = useAmbassadors();
  const { data: staff = [] } = useStaffRecruiters();
  const { data: config = [] } = useCommissionConfig();
  const [buFilter, setBuFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = ledger.filter(l => {
    const matchBu = buFilter === 'All' || l.business_unit === buFilter;
    const matchStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchBu && matchStatus;
  });

  const totalSales = filtered.reduce((s, l) => s + Number(l.sale_amount || 0), 0);
  const totalAmbComm = filtered.reduce((s, l) => s + Number(l.ambassador_commission || 0), 0);
  const totalOverride = filtered.reduce((s, l) => s + Number(l.staff_override_amount || 0), 0);
  const pendingCount = filtered.filter(l => l.status === 'pending').length;

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase.from('uben_commission_ledger').update({ status }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-commission-ledger'] }); toast.success('Status updated'); setSelected(new Set()); },
  });

  const addEntry = useMutation({
    mutationFn: async (form: any) => {
      // Auto-calculate commissions
      const ambConfig = config.find(c => c.business_unit === form.business_unit);
      const ambRate = Number(ambConfig?.ambassador_commission_rate || 10) / 100;
      const amb = ambassadors.find(a => a.id === form.ambassador_id);
      const staffId = amb?.recruited_by_staff_id;
      const overrideRate = Number(ambConfig?.staff_override_rate || 2) / 100;
      const ambComm = Number(form.sale_amount) * ambRate;
      const staffOverride = staffId ? Number(form.sale_amount) * overrideRate : 0;

      const { error } = await supabase.from('uben_commission_ledger').insert({
        ...form,
        ambassador_commission: ambComm,
        staff_override_amount: staffOverride,
        staff_recruiter_id: staffId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-commission-ledger'] }); toast.success('Entry added'); setShowAdd(false); },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const exportCsv = () => {
    const headers = ['Date', 'Ambassador', 'Business Unit', 'Type', 'Sale Amount', 'Ambassador Commission', 'Staff Override', 'Staff', 'Status'];
    const rows = filtered.map(l => [
      l.sale_date, (l as any).uben_ambassadors?.full_name || '', l.business_unit, l.sale_type,
      l.sale_amount, l.ambassador_commission, l.staff_override_amount, (l as any).uben_staff_recruiters?.name || '', l.status
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'uben_commissions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI title="Total Sales" value={`$${totalSales.toLocaleString()}`} icon={DollarSign} />
        <KPI title="Ambassador Commissions" value={`$${totalAmbComm.toLocaleString()}`} icon={TrendingUp} />
        <KPI title="Staff Overrides" value={`$${totalOverride.toLocaleString()}`} icon={Award} />
        <KPI title="Pending Approvals" value={pendingCount} icon={Clock} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Select value={buFilter} onValueChange={setBuFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{BUSINESS_UNITS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              {['pending', 'approved', 'paid', 'disputed'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ ids: Array.from(selected), status: 'paid' })}>
              Mark Paid ({selected.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }} onClick={() => setShowAdd(true)}>
            <DollarSign className="h-4 w-4 mr-1" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Ambassador</TableHead>
              <TableHead>Business Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sale $</TableHead>
              <TableHead>Amb Comm $</TableHead>
              <TableHead>Override $</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No commission entries.</TableCell></TableRow>
            ) : filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} className="rounded" />
                </TableCell>
                <TableCell className="text-xs">{format(new Date(l.sale_date), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-xs font-medium">{(l as any).uben_ambassadors?.full_name || '—'}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{l.business_unit}</Badge></TableCell>
                <TableCell className="text-xs">{l.sale_type}</TableCell>
                <TableCell className="text-xs font-mono">${Number(l.sale_amount).toLocaleString()}</TableCell>
                <TableCell className="text-xs font-mono" style={{ color: GOLD }}>${Number(l.ambassador_commission).toLocaleString()}</TableCell>
                <TableCell className="text-xs font-mono">${Number(l.staff_override_amount).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{(l as any).uben_staff_recruiters?.name || '—'}</TableCell>
                <TableCell><Badge variant={l.status === 'paid' ? 'default' : l.status === 'pending' ? 'secondary' : 'outline'} className="text-[10px]">{l.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {l.status === 'pending' && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => updateStatus.mutate({ ids: [l.id], status: 'approved' })}>Approve</Button>
                    )}
                    {l.status === 'approved' && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => updateStatus.mutate({ ids: [l.id], status: 'paid' })}>Pay</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add Entry Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Commission Entry</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addEntry.mutate({ ambassador_id: fd.get('ambassador_id'), business_unit: fd.get('business_unit'), sale_type: fd.get('sale_type'), sale_amount: Number(fd.get('sale_amount')), sale_date: fd.get('sale_date') }); }} className="space-y-3">
            <div><Label>Ambassador</Label>
              <select name="ambassador_id" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select ambassador</option>
                {ambassadors.filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.business_unit || '—'})</option>)}
              </select>
            </div>
            <div><Label>Business Unit</Label>
              <select name="business_unit" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {BUSINESS_UNITS.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><Label>Sale Type</Label>
              <select name="sale_type" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {SALE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Sale Amount ($)</Label><Input name="sale_amount" type="number" min="0" step="0.01" required /></div>
            <div><Label>Sale Date</Label><Input name="sale_date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
            <p className="text-[10px] text-muted-foreground">Commissions auto-calculated from config rates.</p>
            <Button type="submit" disabled={addEntry.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── SUB-TAB 5: Ambassador Applications ─────────────────────────────────

function ApplicationsPipeline() {
  const queryClient = useQueryClient();
  const { data: applications = [] } = useApplications();
  const { data: staff = [] } = useStaffRecruiters();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);

  const stages = [
    { key: 'applied', label: 'Applied', color: 'bg-blue-500/20 border-blue-500/40' },
    { key: 'under_review', label: 'Under Review', color: 'bg-yellow-500/20 border-yellow-500/40' },
    { key: 'approved', label: 'Approved', color: 'bg-emerald-500/20 border-emerald-500/40' },
    { key: 'onboarding', label: 'Onboarding', color: 'bg-purple-500/20 border-purple-500/40' },
    { key: 'active', label: 'Active', color: 'bg-emerald-500/20 border-emerald-500/40' },
    { key: 'rejected', label: 'Rejected', color: 'bg-red-500/20 border-red-500/40' },
  ];

  const updateApp = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('uben_ambassador_applications').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-ambassador-applications'] }); toast.success('Application updated'); },
  });

  const approveAndCreate = useMutation({
    mutationFn: async (app: any) => {
      // Generate ref code
      const refCode = `AMB-${app.first_name.slice(0, 2).toUpperCase()}${Date.now().toString(36).toUpperCase().slice(-4)}`;
      // Create ambassador
      const { error: ambErr } = await supabase.from('uben_ambassadors').insert({
        full_name: `${app.first_name} ${app.last_name}`,
        email: app.email,
        phone: app.phone,
        referral_code: refCode,
        business_unit: app.business_unit_interest,
        recruited_by_staff_id: app.assigned_staff_id,
        status: 'active',
        tier: 'bronze',
      });
      if (ambErr) throw ambErr;
      // Update application
      const { error: appErr } = await supabase.from('uben_ambassador_applications').update({ application_status: 'active' }).eq('id', app.id);
      if (appErr) throw appErr;
      // Log activity
      await supabase.from('uben_activity_log').insert({
        action_type: 'ambassador_joined',
        description: `New ambassador approved: ${app.first_name} ${app.last_name}`,
        actor_name: 'Admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uben-ambassador-applications'] });
      queryClient.invalidateQueries({ queryKey: ['uben-ambassadors-full'] });
      queryClient.invalidateQueries({ queryKey: ['uben-ambassadors'] });
      queryClient.invalidateQueries({ queryKey: ['uben-activity-log'] });
      toast.success('Ambassador approved and created');
      setSelectedApp(null);
    },
  });

  const manualAdd = useMutation({
    mutationFn: async (form: any) => {
      const refCode = `AMB-${form.full_name.slice(0, 2).toUpperCase()}${Date.now().toString(36).toUpperCase().slice(-4)}`;
      const { error } = await supabase.from('uben_ambassadors').insert({
        ...form,
        referral_code: refCode,
        status: 'active',
        tier: 'bronze',
      });
      if (error) throw error;
      await supabase.from('uben_activity_log').insert({
        action_type: 'ambassador_joined',
        description: `Ambassador manually added: ${form.full_name}`,
        actor_name: 'Admin',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uben-ambassadors-full'] });
      queryClient.invalidateQueries({ queryKey: ['uben-ambassadors'] });
      queryClient.invalidateQueries({ queryKey: ['uben-activity-log'] });
      toast.success('Ambassador added');
      setShowManualAdd(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recruitment Pipeline</h3>
        <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }} onClick={() => setShowManualAdd(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Manual Add
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageApps = applications.filter(a => a.application_status === stage.key);
          return (
            <div key={stage.key} className="min-w-[220px] flex-shrink-0">
              <div className={`rounded-lg border p-2 mb-2 ${stage.color}`}>
                <p className="text-xs font-medium text-center">{stage.label} ({stageApps.length})</p>
              </div>
              <div className="space-y-2">
                {stageApps.map(app => (
                  <Card key={app.id} className="border-0 bg-card/80 cursor-pointer hover:bg-card/90 transition-colors" onClick={() => setSelectedApp(app)}>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium">{app.first_name} {app.last_name}</p>
                      <p className="text-[10px] text-muted-foreground">{app.business_unit_interest || '—'}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(app.created_at), 'MMM d, yyyy')}</p>
                      {app.referred_by && <p className="text-[10px] text-muted-foreground">Ref: {app.referred_by}</p>}
                    </CardContent>
                  </Card>
                ))}
                {stageApps.length === 0 && (
                  <div className="text-center py-6 text-[10px] text-muted-foreground">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Application Detail Modal */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Application Detail</DialogTitle></DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {selectedApp.first_name} {selectedApp.last_name}</div>
                <div><span className="text-muted-foreground">Email:</span> {selectedApp.email || '—'}</div>
                <div><span className="text-muted-foreground">Phone:</span> {selectedApp.phone || '—'}</div>
                <div><span className="text-muted-foreground">Interest:</span> {selectedApp.business_unit_interest || '—'}</div>
                <div><span className="text-muted-foreground">Referred By:</span> {selectedApp.referred_by || '—'}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{selectedApp.application_status}</Badge></div>
              </div>

              {/* Assign Staff */}
              <div>
                <Label className="text-xs">Assign to Staff Recruiter</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                  defaultValue={selectedApp.assigned_staff_id || ''}
                  onChange={e => updateApp.mutate({ id: selectedApp.id, updates: { assigned_staff_id: e.target.value || null } })}
                >
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.business_unit})</option>)}
                </select>
              </div>

              {/* Set Business Unit */}
              <div>
                <Label className="text-xs">Business Unit</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
                  defaultValue={selectedApp.business_unit_interest || ''}
                  onChange={e => updateApp.mutate({ id: selectedApp.id, updates: { business_unit_interest: e.target.value } })}
                >
                  {BUSINESS_UNITS.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  defaultValue={selectedApp.notes || ''}
                  className="mt-1"
                  onBlur={e => {
                    if (e.target.value !== (selectedApp.notes || '')) {
                      updateApp.mutate({ id: selectedApp.id, updates: { notes: e.target.value } });
                    }
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {selectedApp.application_status !== 'active' && selectedApp.application_status !== 'rejected' && (
                  <>
                    {selectedApp.application_status === 'applied' && (
                      <Button size="sm" variant="outline" onClick={() => { updateApp.mutate({ id: selectedApp.id, updates: { application_status: 'under_review' } }); setSelectedApp(null); }}>
                        Move to Review
                      </Button>
                    )}
                    {(selectedApp.application_status === 'under_review' || selectedApp.application_status === 'approved' || selectedApp.application_status === 'onboarding') && (
                      <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }} onClick={() => approveAndCreate.mutate(selectedApp)} disabled={approveAndCreate.isPending}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve & Create
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => { updateApp.mutate({ id: selectedApp.id, updates: { application_status: 'rejected' } }); setSelectedApp(null); }}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={showManualAdd} onOpenChange={setShowManualAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manually Add Ambassador</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); manualAdd.mutate({ full_name: fd.get('full_name'), email: fd.get('email'), phone: fd.get('phone'), business_unit: fd.get('business_unit'), recruited_by_staff_id: fd.get('recruited_by_staff_id') || null }); }} className="space-y-3">
            <div><Label>Full Name</Label><Input name="full_name" required /></div>
            <div><Label>Email</Label><Input name="email" type="email" /></div>
            <div><Label>Phone</Label><Input name="phone" /></div>
            <div><Label>Business Unit</Label>
              <select name="business_unit" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                {BUSINESS_UNITS.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><Label>Recruited By (Staff)</Label>
              <select name="recruited_by_staff_id" className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">None</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={manualAdd.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Create Ambassador</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Ambassador Network Tab ────────────────────────────────────────

export default function AmbassadorNetworkTab() {
  const [subTab, setSubTab] = useState('overview');

  const tabs = [
    { key: 'overview', label: 'Network Overview' },
    { key: 'roster', label: 'Ambassador Roster' },
    { key: 'staff', label: 'Staff Recruiters' },
    { key: 'commissions', label: 'Sales & Commissions' },
    { key: 'applications', label: 'Applications' },
  ];

  return (
    <div className="space-y-5">
      {/* Pill Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
              subTab === t.key ? 'text-black' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
            style={subTab === t.key ? { backgroundColor: GOLD } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'overview' && <NetworkOverview />}
      {subTab === 'roster' && <AmbassadorRoster />}
      {subTab === 'staff' && <StaffDashboard />}
      {subTab === 'commissions' && <CommissionsLog />}
      {subTab === 'applications' && <ApplicationsPipeline />}
    </div>
  );
}
