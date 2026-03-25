import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Search, Upload, Download, Plus, List, Phone, Clock, Flame,
  FileSignature, DollarSign, Check, X, ChevronUp, ChevronDown,
  MoreHorizontal, Scale, Eye
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { formatDistanceToNow } from 'date-fns';

const AMBER = '#BA7517';

const STATUS_PILLS = [
  'all','new','phone_found','queued','called','interested',
  'consultation_booked','agreement_signed','referred_to_attorney',
  'case_filed','funds_released','closed','do_not_contact'
];

const statusColor: Record<string, string> = {
  new: 'bg-gray-600/20 text-gray-400 border-gray-600',
  skip_trace_pending: 'bg-blue-600/20 text-blue-400 border-blue-600',
  phone_found: 'bg-blue-500/20 text-blue-300 border-blue-500',
  queued: 'bg-purple-500/20 text-purple-400 border-purple-500',
  called: 'bg-purple-400/20 text-purple-300 border-purple-400',
  interested: 'bg-teal-500/20 text-teal-400 border-teal-500',
  consultation_booked: 'bg-amber-500/20 text-amber-400 border-amber-500',
  agreement_signed: 'bg-amber-600/20 text-amber-300 border-amber-600',
  referred_to_attorney: 'bg-orange-500/20 text-orange-400 border-orange-500',
  case_filed: 'bg-orange-600/20 text-orange-300 border-orange-600',
  hearing_scheduled: 'bg-cyan-500/20 text-cyan-400 border-cyan-500',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500',
  funds_released: 'bg-green-500/20 text-green-400 border-green-500',
  closed: 'bg-green-600/20 text-green-300 border-green-600',
  lost: 'bg-red-700/20 text-red-400 border-red-700',
  do_not_contact: 'bg-red-600/10 text-red-500/60 border-red-600/40',
};

function relativeDate(d: string | null): string {
  if (!d) return 'Never';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }); }
  catch { return '—'; }
}

function fmt$(v: number | null | undefined): string {
  if (!v) return '—';
  return '$' + v.toLocaleString();
}

type SortKey = 'created_at' | 'surplus_amount' | 'last_called_at' | 'call_count';

export default function SFLeadPipeline() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['sf-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('surplus_funds_leads').select('*').order('created_at', { ascending: false }).limit(500);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const addLead = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('surplus_funds_leads').insert(lead);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sf-leads'] }); toast.success('Lead added'); setAddOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const total = leads.length;
    const skipTraced = leads.filter((l: any) => l.skip_traced).length;
    const queued = leads.filter((l: any) => l.status === 'queued').length;
    const interested = leads.filter((l: any) => l.status === 'interested').length;
    const agreement = leads.filter((l: any) => l.status === 'agreement_signed').length;
    const totalSurplus = leads.reduce((sum: number, l: any) => sum + (l.surplus_amount || 0), 0);
    return { total, skipTraced, queued, interested, agreement, totalSurplus };
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== 'all') result = result.filter((l: any) => l.status === statusFilter);
    if (stateFilter !== 'all') result = result.filter((l: any) => l.state === stateFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((l: any) =>
        `${l.first_name} ${l.last_name} ${l.county} ${l.state} ${l.court_case_number}`.toLowerCase().includes(s)
      );
    }
    result = [...result].sort((a: any, b: any) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return result;
  }, [leads, statusFilter, stateFilter, search, sortKey, sortDir]);

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((l: any) => l.id)));

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
    const mapped = rows.map(r => ({
      first_name: r.first_name || r.FirstName || r['First Name'] || '',
      last_name: r.last_name || r.LastName || r['Last Name'] || '',
      county: r.county || r.County || 'Unknown',
      state: r.state || r.State || '',
      phone: r.phone || r.Phone || '',
      property_address: r.property_address || r.Address || r['Property Address'] || '',
      surplus_amount: r.surplus_amount ? Number(r.surplus_amount || r['Surplus Amount']) : null,
      court_case_number: r.court_case_number || r['Case Number'] || '',
      foreclosure_date: r.foreclosure_date || r['Foreclosure Date'] || null,
      lead_source: 'csv_upload',
    }));
    const { error } = await supabase.from('surplus_funds_leads').insert(mapped);
    if (error) toast.error('Upload failed: ' + error.message);
    else { toast.success(`${mapped.length} leads imported`); qc.invalidateQueries({ queryKey: ['sf-leads'] }); }
    e.target.value = '';
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'surplus_funds_leads.xlsx');
  };

  const states = useMemo(() => [...new Set(leads.map((l: any) => l.state).filter(Boolean))].sort(), [leads]);

  const StatCard = ({ label, value, icon: Icon, color, sub }: any) => (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="rounded-lg p-2.5 bg-muted/50"><Icon className="h-5 w-5" style={{ color }} /></div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: AMBER }}>🎯 Floor 1 — Lead Intelligence</h1>
          <p className="text-muted-foreground text-sm">All surplus fund leads — import, skip trace, and launch campaigns</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm" style={{ backgroundColor: AMBER }}><Plus className="h-4 w-4 mr-1" />Add Lead</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Lead Manually</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addLead.mutate({ first_name: fd.get('first_name'), last_name: fd.get('last_name'), phone: fd.get('phone'), county: fd.get('county') || 'Unknown', state: fd.get('state'), property_address: fd.get('property_address'), surplus_amount: fd.get('surplus_amount') ? Number(fd.get('surplus_amount')) : null, court_case_number: fd.get('court_case_number'), foreclosure_date: fd.get('foreclosure_date') || null }); }} className="space-y-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Owner</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input name="first_name" /></div>
                  <div><Label>Last Name</Label><Input name="last_name" /></div>
                </div>
                <div><Label>Phone</Label><Input name="phone" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase pt-2">Location</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>County *</Label><Input name="county" required /></div>
                  <div><Label>State</Label><Input name="state" /></div>
                </div>
                <div><Label>Property Address</Label><Input name="property_address" /></div>
                <p className="text-xs text-muted-foreground font-semibold uppercase pt-2">Case Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Surplus Amount</Label><Input name="surplus_amount" type="number" placeholder="$" /></div>
                  <div><Label>Court Case #</Label><Input name="court_case_number" /></div>
                </div>
                <div><Label>Foreclosure Date</Label><Input name="foreclosure_date" type="date" /></div>
                <Button type="submit" className="w-full" style={{ backgroundColor: AMBER }} disabled={addLead.isPending}>{addLead.isPending ? 'Saving...' : 'Save Lead'}</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />Upload CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCSVUpload} />
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Leads" value={stats.total} icon={List} color="#9ca3af" />
        <StatCard label="Skip Traced" value={stats.skipTraced} icon={Phone} color={AMBER} sub={stats.total > 0 ? `${Math.round(stats.skipTraced / stats.total * 100)}%` : undefined} />
        <StatCard label="Queued for DC" value={stats.queued} icon={Clock} color="#7c3aed" />
        <StatCard label="Interested" value={stats.interested} icon={Flame} color="#ea580c" />
        <StatCard label="Agreements" value={stats.agreement} icon={FileSignature} color="#0d9488" />
        <StatCard label="Total Surplus" value={fmt$(stats.totalSurplus)} icon={DollarSign} color={AMBER} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, county, state, or case number..." className="pl-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter pills */}
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_PILLS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${statusFilter === s ? 'text-white border-transparent' : 'text-muted-foreground border-border hover:border-muted-foreground/50'}`}
              style={statusFilter === s ? { backgroundColor: AMBER } : undefined}
            >{s === 'all' ? 'All' : s.replace(/_/g, ' ')}</button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>{[{ v: 'all', l: 'All States' }, ...states.map(s => ({ v: s, l: s }))].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest</SelectItem>
              <SelectItem value="surplus_amount">Surplus Amount</SelectItem>
              <SelectItem value="last_called_at">Last Contact</SelectItem>
              <SelectItem value="call_count">Call Count</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
            {sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">Showing {filtered.length} leads</span>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/80 animate-in slide-in-from-bottom-2" style={{ borderColor: AMBER + '40' }}>
          <span className="text-sm font-medium">{selected.size} leads selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline">Add to Campaign</Button>
            <Button size="sm" variant="outline">Skip Trace Batch</Button>
            <Button size="sm" variant="outline">Export Selected</Button>
            <Button size="sm" variant="outline" className="text-red-400">Mark DNC</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Deselect All</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Scale className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium">No surplus leads yet — upload county records or add manually</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Start finding unclaimed funds to recover</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload CSV</Button>
                <Button style={{ backgroundColor: AMBER }} onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Lead Manually</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">County</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">State</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Surplus Amount</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Case #</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Skip</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Last Contact</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l: any) => {
                    const isHot = l.status === 'interested' || l.status === 'agreement_signed';
                    return (
                      <tr key={l.id}
                        className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors group ${isHot ? 'bg-amber-950/10' : ''}`}
                        style={{ borderLeft: isHot ? `3px solid ${AMBER}` : '3px solid transparent' }}
                        onClick={() => { setDetailLead(l); setDrawerTab('overview'); }}
                      >
                        <td className="p-3" onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} /></td>
                        <td className="p-3">
                          <div className="font-medium">{[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}</div>
                          {l.phone && <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>}
                        </td>
                        <td className="p-3">{l.county || '—'}</td>
                        <td className="p-3">{l.state || '—'}</td>
                        <td className="p-3">
                          <span className="text-lg font-bold" style={{ color: AMBER }}>{l.surplus_amount ? `$${Number(l.surplus_amount).toLocaleString()}` : '—'}</span>
                        </td>
                        <td className="p-3 font-mono text-xs">{l.court_case_number || '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${statusColor[l.status] || ''}`}>{(l.status || 'new').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          {l.skip_traced ? <Check className="h-4 w-4 text-amber-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                        </td>
                        <td className="p-3">
                          <div className="text-xs">{relativeDate(l.last_called_at)}</div>
                          <div className="text-[10px] text-muted-foreground">{l.call_count || 0} calls</div>
                        </td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setDetailLead(l); setDrawerTab('overview'); }}>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem>Add to Campaign</DropdownMenuItem>
                              <DropdownMenuItem>Refer to Attorney</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-400">Mark DNC</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <SheetContent className="w-[420px] overflow-auto p-0">
          {detailLead && (
            <>
              <div className="p-6 border-b border-border" style={{ borderTop: `3px solid ${AMBER}` }}>
                <SheetHeader>
                  <SheetTitle className="text-lg">{[detailLead.first_name, detailLead.last_name].filter(Boolean).join(' ') || 'Unknown'}</SheetTitle>
                </SheetHeader>
                <p className="text-sm text-muted-foreground">{detailLead.county}, {detailLead.state}</p>
                {detailLead.surplus_amount && <p className="text-2xl font-bold mt-2" style={{ color: AMBER }}>${Number(detailLead.surplus_amount).toLocaleString()}</p>}
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className={statusColor[detailLead.status] || ''}>{(detailLead.status || 'new').replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              <Tabs value={drawerTab} onValueChange={setDrawerTab} className="px-6 pt-4">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="calls">Calls</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4 space-y-5 pb-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Contact Info</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{detailLead.phone || '—'}</p></div>
                      <div><span className="text-muted-foreground">Email</span><p className="font-medium">{detailLead.email || '—'}</p></div>
                      <div><span className="text-muted-foreground">Address</span><p className="font-medium">{detailLead.property_address || '—'}</p></div>
                      <div>{!detailLead.phone && <Button size="sm" variant="outline" className="mt-1">Skip Trace Now</Button>}</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Case Details</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Surplus Amount</span><p className="font-bold text-lg" style={{ color: AMBER }}>{fmt$(detailLead.surplus_amount)}</p></div>
                      <div><span className="text-muted-foreground">Case #</span><p className="font-medium font-mono">{detailLead.court_case_number || '—'}</p></div>
                      <div><span className="text-muted-foreground">Sale Price</span><p className="font-medium">{fmt$(detailLead.sale_price)}</p></div>
                      <div><span className="text-muted-foreground">Amount Owed</span><p className="font-medium">{fmt$(detailLead.amount_owed)}</p></div>
                      <div><span className="text-muted-foreground">Foreclosure Date</span><p className="font-medium">{detailLead.foreclosure_date || '—'}</p></div>
                      <div><span className="text-muted-foreground">Source</span><p className="font-medium">{detailLead.lead_source || '—'}</p></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recovery Estimate</p>
                    <div className="p-3 rounded-lg bg-muted/30 text-sm">
                      <div className="flex justify-between"><span>Surplus Amount</span><span className="font-bold">{fmt$(detailLead.surplus_amount)}</span></div>
                      <div className="flex justify-between mt-1"><span>35% Recovery Fee</span><span className="font-bold" style={{ color: AMBER }}>{fmt$(detailLead.surplus_amount ? detailLead.surplus_amount * 0.35 : null)}</span></div>
                    </div>
                  </div>
                  {detailLead.status === 'agreement_signed' && (
                    <Button className="w-full" style={{ backgroundColor: AMBER }}>Create Case →</Button>
                  )}
                </TabsContent>
                <TabsContent value="calls" className="mt-4 pb-6">
                  <p className="text-sm text-muted-foreground">
                    {detailLead.call_count ? `${detailLead.call_count} calls made` : 'No calls recorded yet'}
                  </p>
                  {detailLead.last_called_at && <p className="text-xs text-muted-foreground mt-1">Last: {relativeDate(detailLead.last_called_at)}</p>}
                  {detailLead.call_outcome && <Badge variant="outline" className="mt-2">{detailLead.call_outcome}</Badge>}
                </TabsContent>
                <TabsContent value="notes" className="mt-4 pb-6">
                  <Textarea placeholder="Add a note..." rows={3} className="mb-3" />
                  <Button size="sm" style={{ backgroundColor: AMBER }}>Add Note</Button>
                  {detailLead.notes && <div className="mt-4 p-3 rounded-lg bg-muted/30 text-sm">{detailLead.notes}</div>}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
