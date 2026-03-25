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
  FileSignature, Star, Check, X, ChevronUp, ChevronDown,
  BarChart3, MoreHorizontal, Building2, Eye
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { formatDistanceToNow } from 'date-fns';

const GREEN = '#3B6D11';
const GOLD = '#BA7517';

const STATUS_PILLS = [
  'all','new','skip_trace_pending','queued','called','interested',
  'offer_made','under_contract','dead','dnc'
];

const statusColor: Record<string, string> = {
  new: 'bg-gray-600/20 text-gray-400 border-gray-600',
  skip_trace_pending: 'bg-blue-600/20 text-blue-400 border-blue-600',
  phone_found: 'bg-blue-500/20 text-blue-300 border-blue-500',
  queued: 'bg-blue-500/20 text-blue-400 border-blue-500',
  called: 'bg-purple-600/20 text-purple-400 border-purple-600',
  interested: 'bg-orange-500/20 text-orange-400 border-orange-500',
  appointment_set: 'bg-amber-500/20 text-amber-400 border-amber-500',
  analyzed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500',
  offer_made: 'bg-amber-600/20 text-amber-400 border-amber-600',
  countering: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
  under_contract: 'bg-emerald-600/20 text-emerald-400 border-emerald-600',
  buyer_found: 'bg-teal-500/20 text-teal-400 border-teal-500',
  assigned: 'bg-green-600/20 text-green-400 border-green-600',
  closed: 'bg-green-700/20 text-green-300 border-green-700',
  dead: 'bg-red-800/20 text-red-400 border-red-800',
  dnc: 'bg-red-600/10 text-red-500/60 border-red-600/40',
};

const leadTypeColor: Record<string, string> = {
  pre_foreclosure: 'bg-red-600/20 text-red-400 border-red-600',
  tax_delinquent: 'bg-orange-600/20 text-orange-400 border-orange-600',
  vacant: 'bg-amber-600/20 text-amber-400 border-amber-600',
  probate: 'bg-purple-600/20 text-purple-400 border-purple-600',
  high_equity: 'bg-teal-600/20 text-teal-400 border-teal-600',
  fsbo: 'bg-blue-600/20 text-blue-400 border-blue-600',
  price_reduced: 'bg-gray-600/20 text-gray-400 border-gray-600',
};

const dealScoreStyle: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-emerald-600/20', text: 'text-emerald-400', border: 'border-emerald-600' },
  B: { bg: 'bg-amber-600/20', text: 'text-amber-400', border: 'border-amber-600' },
  C: { bg: 'bg-orange-600/20', text: 'text-orange-400', border: 'border-orange-600' },
  D: { bg: 'bg-red-600/20', text: 'text-red-400', border: 'border-red-600' },
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

type SortKey = 'created_at' | 'deal_score' | 'estimated_value' | 'last_called_at' | 'call_count';

export default function RELeadPipeline() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['re-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('re_leads').select('*').order('created_at', { ascending: false }).limit(500);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const addLead = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('re_leads').insert(lead);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-leads'] }); toast.success('Lead added'); setAddOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const skipTraced = leads.filter((l: any) => l.skip_traced).length;
    const queued = leads.filter((l: any) => l.status === 'queued').length;
    const interested = leads.filter((l: any) => l.status === 'interested').length;
    const underContract = leads.filter((l: any) => l.status === 'under_contract').length;
    const aDeal = leads.filter((l: any) => l.deal_score === 'A').length;
    return { total, skipTraced, queued, interested, underContract, aDeal };
  }, [leads]);

  // Filtering
  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== 'all') result = result.filter((l: any) => l.status === statusFilter);
    if (stateFilter !== 'all') result = result.filter((l: any) => l.state === stateFilter);
    if (scoreFilter !== 'all') result = result.filter((l: any) => l.deal_score === scoreFilter);
    if (typeFilter !== 'all') result = result.filter((l: any) => l.lead_type === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((l: any) =>
        (l.property_address || '').toLowerCase().includes(s) ||
        (l.first_name || '').toLowerCase().includes(s) ||
        (l.last_name || '').toLowerCase().includes(s) ||
        (l.city || '').toLowerCase().includes(s) ||
        (l.county || '').toLowerCase().includes(s)
      );
    }
    // Sort
    result = [...result].sort((a: any, b: any) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return result;
  }, [leads, statusFilter, stateFilter, scoreFilter, typeFilter, search, sortKey, sortDir]);

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
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
      phone: r.phone || r.Phone || '',
      property_address: r.property_address || r.Address || r.address || '',
      city: r.city || r.City || '',
      state: r.state || r.State || '',
      zip: r.zip || r.Zip || '',
      county: r.county || r.County || '',
      estimated_value: parseFloat(r.estimated_value || r.Value || '0') || null,
      lead_type: r.lead_type || '',
      lead_source: 'csv_upload',
    })).filter(r => r.property_address);
    const { error } = await supabase.from('re_leads').insert(mapped);
    if (error) toast.error('Upload failed: ' + error.message);
    else { toast.success(`${mapped.length} leads imported`); qc.invalidateQueries({ queryKey: ['re-leads'] }); }
    e.target.value = '';
    setCsvOpen(false);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'real_estate_leads.xlsx');
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
          <h1 className="text-3xl font-bold" style={{ color: GREEN }}>🎯 Floor 1 — Lead Intelligence</h1>
          <p className="text-muted-foreground text-sm">All property leads — import, score, and launch campaigns</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm" style={{ backgroundColor: GREEN }}><Plus className="h-4 w-4 mr-1" />Add Lead</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Lead Manually</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addLead.mutate({ first_name: fd.get('first_name'), last_name: fd.get('last_name'), phone: fd.get('phone'), email: fd.get('email'), property_address: fd.get('property_address') || 'Unknown', city: fd.get('city'), state: fd.get('state'), zip: fd.get('zip'), county: fd.get('county'), property_type: fd.get('property_type'), bedrooms: fd.get('bedrooms') ? Number(fd.get('bedrooms')) : null, bathrooms: fd.get('bathrooms') ? Number(fd.get('bathrooms')) : null, sqft: fd.get('sqft') ? Number(fd.get('sqft')) : null, year_built: fd.get('year_built') ? Number(fd.get('year_built')) : null, condition: fd.get('condition'), estimated_value: fd.get('estimated_value') ? Number(fd.get('estimated_value')) : null, asking_price: fd.get('asking_price') ? Number(fd.get('asking_price')) : null, estimated_repairs: fd.get('estimated_repairs') ? Number(fd.get('estimated_repairs')) : null, lead_type: fd.get('lead_type'), lead_source: fd.get('lead_source'), notes: fd.get('notes') }); }} className="space-y-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Owner</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input name="first_name" /></div>
                  <div><Label>Last Name</Label><Input name="last_name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input name="phone" /></div>
                  <div><Label>Email</Label><Input name="email" /></div>
                </div>
                <p className="text-xs text-muted-foreground font-semibold uppercase pt-2">Property</p>
                <div><Label>Address *</Label><Input name="property_address" required /></div>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label>City</Label><Input name="city" /></div>
                  <div><Label>State</Label><Input name="state" /></div>
                  <div><Label>Zip</Label><Input name="zip" /></div>
                  <div><Label>County</Label><Input name="county" /></div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label>Type</Label><Input name="property_type" placeholder="SFH" /></div>
                  <div><Label>Beds</Label><Input name="bedrooms" type="number" /></div>
                  <div><Label>Baths</Label><Input name="bathrooms" type="number" /></div>
                  <div><Label>Sqft</Label><Input name="sqft" type="number" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Year Built</Label><Input name="year_built" type="number" /></div>
                  <div><Label>Condition</Label><Input name="condition" placeholder="Fair/Good/Poor" /></div>
                </div>
                <p className="text-xs text-muted-foreground font-semibold uppercase pt-2">Financial</p>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Est. Value</Label><Input name="estimated_value" type="number" /></div>
                  <div><Label>Asking Price</Label><Input name="asking_price" type="number" /></div>
                  <div><Label>Est. Repairs</Label><Input name="estimated_repairs" type="number" /></div>
                </div>
                <p className="text-xs text-muted-foreground font-semibold uppercase pt-2">Lead Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Lead Type</Label>
                    <Select name="lead_type"><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{['pre_foreclosure','tax_delinquent','vacant','probate','high_equity','fsbo','price_reduced'].map(t => <SelectItem key={t} value={t}>{t.replace(/_/g,' ')}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div><Label>Source</Label><Input name="lead_source" placeholder="PropStream, CSV, etc." /></div>
                </div>
                <div><Label>Notes</Label><Textarea name="notes" rows={2} /></div>
                <Button type="submit" className="w-full" style={{ backgroundColor: GREEN }} disabled={addLead.isPending}>{addLead.isPending ? 'Saving...' : 'Save Lead'}</Button>
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
        <StatCard label="Skip Traced" value={stats.skipTraced} icon={Phone} color={GREEN} sub={stats.total > 0 ? `${Math.round(stats.skipTraced / stats.total * 100)}% of total` : undefined} />
        <StatCard label="Queued for DC" value={stats.queued} icon={Clock} color="#d97706" />
        <StatCard label="Interested" value={stats.interested} icon={Flame} color="#ea580c" />
        <StatCard label="Under Contract" value={stats.underContract} icon={FileSignature} color="#0d9488" />
        <StatCard label="A-Rated Deals" value={stats.aDeal} icon={Star} color={GOLD} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by address, owner name, city, or county..." className="pl-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter pills + dropdowns */}
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_PILLS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${statusFilter === s ? 'text-white border-transparent' : 'text-muted-foreground border-border hover:border-muted-foreground/50'}`}
              style={statusFilter === s ? { backgroundColor: GREEN } : undefined}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>{[{ v: 'all', l: 'All States' }, ...states.map(s => ({ v: s, l: s }))].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Deal Score" /></SelectTrigger>
            <SelectContent>{[{ v: 'all', l: 'All Scores' }, { v: 'A', l: 'A Deals' }, { v: 'B', l: 'B Deals' }, { v: 'C', l: 'C Deals' }, { v: 'D', l: 'D Deals' }].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Lead Type" /></SelectTrigger>
            <SelectContent>{[{ v: 'all', l: 'All Types' }, ...['pre_foreclosure','tax_delinquent','vacant','probate','high_equity','fsbo','price_reduced'].map(t => ({ v: t, l: t.replace(/_/g, ' ') }))].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest</SelectItem>
              <SelectItem value="deal_score">Deal Score</SelectItem>
              <SelectItem value="estimated_value">Est. Value</SelectItem>
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
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/80 animate-in slide-in-from-bottom-2" style={{ borderColor: GREEN + '40' }}>
          <span className="text-sm font-medium">{selected.size} leads selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline">Assign to VA</Button>
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
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium">No leads yet — let's find some deals</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Import leads from PropStream, upload a CSV, or add manually to get your pipeline started</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload CSV</Button>
                <Button style={{ backgroundColor: GREEN }} onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Lead Manually</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Score</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Property</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Owner</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Est. Value</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Skip</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">Last Contact</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase">VA</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l: any) => {
                    const ds = dealScoreStyle[l.deal_score] || null;
                    const isHot = l.status === 'interested' || l.status === 'under_contract';
                    const isA = l.deal_score === 'A';
                    return (
                      <tr key={l.id}
                        className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors group ${isHot ? 'bg-emerald-950/10' : ''}`}
                        style={{ borderLeft: isA ? `3px solid ${GOLD}` : isHot ? `3px solid ${GREEN}` : '3px solid transparent' }}
                        onClick={() => { setDetailLead(l); setDrawerTab('overview'); }}
                      >
                        <td className="p-3" onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} /></td>
                        <td className="p-3">
                          {ds ? <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold ${ds.bg} ${ds.text} border ${ds.border}`}>{l.deal_score}</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-foreground">{l.property_address}</div>
                          <div className="text-xs text-muted-foreground">{[l.city, l.state, l.zip].filter(Boolean).join(', ')}</div>
                        </td>
                        <td className="p-3">
                          <div>{[l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}</div>
                          {l.phone && <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>}
                        </td>
                        <td className="p-3">
                          {l.lead_type ? <Badge variant="outline" className={`text-[10px] ${leadTypeColor[l.lead_type] || ''}`}>{l.lead_type.replace(/_/g, ' ')}</Badge> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{fmt$(l.estimated_value)}</div>
                          {l.asking_price && <div className="text-xs text-muted-foreground">Ask: {fmt$(l.asking_price)}</div>}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${statusColor[l.status] || ''}`}>{(l.status || 'new').replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          {l.skip_traced ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                        </td>
                        <td className="p-3">
                          <div className="text-xs">{relativeDate(l.last_called_at)}</div>
                          <div className="text-[10px] text-muted-foreground">{l.call_count || 0} calls</div>
                        </td>
                        <td className="p-3">
                          {l.assigned_va_id ? <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">VA</div> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setDetailLead(l); setDrawerTab('overview'); }}>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem>Assign VA</DropdownMenuItem>
                              <DropdownMenuItem>Add to Campaign</DropdownMenuItem>
                              <DropdownMenuItem>Run Analysis</DropdownMenuItem>
                              <DropdownMenuItem>Generate Contract</DropdownMenuItem>
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
              <div className="p-6 border-b border-border" style={{ borderTop: `3px solid ${GREEN}` }}>
                <SheetHeader>
                  <SheetTitle className="text-lg">{detailLead.property_address}</SheetTitle>
                </SheetHeader>
                <p className="text-sm text-muted-foreground">{[detailLead.city, detailLead.state, detailLead.zip].filter(Boolean).join(', ')}</p>
                <div className="flex gap-2 mt-3">
                  {detailLead.deal_score && (() => { const ds = dealScoreStyle[detailLead.deal_score]; return ds ? <Badge className={`${ds.bg} ${ds.text} border ${ds.border}`}>{detailLead.deal_score} Deal</Badge> : null; })()}
                  <Badge variant="outline" className={statusColor[detailLead.status] || ''}>{(detailLead.status || 'new').replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              <Tabs value={drawerTab} onValueChange={setDrawerTab} className="px-6 pt-4">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="calls">Calls</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4 space-y-5 pb-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Owner Info</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Name</span><p className="font-medium">{[detailLead.first_name, detailLead.last_name].filter(Boolean).join(' ') || '—'}</p></div>
                      <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{detailLead.phone || '—'}</p></div>
                      <div><span className="text-muted-foreground">Email</span><p className="font-medium">{detailLead.email || '—'}</p></div>
                      <div>{!detailLead.phone && <Button size="sm" variant="outline" className="mt-1">Skip Trace Now</Button>}</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Property Details</p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {[['Beds', detailLead.bedrooms], ['Baths', detailLead.bathrooms], ['Sqft', detailLead.sqft?.toLocaleString()], ['Year', detailLead.year_built], ['Condition', detailLead.condition], ['Type', detailLead.property_type], ['Lead Type', detailLead.lead_type?.replace(/_/g, ' ')], ['Source', detailLead.lead_source], ['Lot', detailLead.lot_size]].map(([k, v]) => (
                        <div key={k as string}><span className="text-muted-foreground">{k}</span><p className="font-medium">{v || '—'}</p></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Financials</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Est. Value</span><p className="font-medium" style={{ color: GREEN }}>{fmt$(detailLead.estimated_value)}</p></div>
                      <div><span className="text-muted-foreground">Asking Price</span><p className="font-medium">{fmt$(detailLead.asking_price)}</p></div>
                      <div><span className="text-muted-foreground">MAO</span><p className="font-medium text-amber-400">{fmt$(detailLead.mao)}</p></div>
                      <div><span className="text-muted-foreground">Est. Repairs</span><p className="font-medium">{fmt$(detailLead.estimated_repairs)}</p></div>
                      <div><span className="text-muted-foreground">ARV</span><p className="font-medium">{fmt$(detailLead.arv)}</p></div>
                      <div><span className="text-muted-foreground">Deal Score</span><p className="font-bold text-lg">{detailLead.deal_score || '—'}</p></div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="calls" className="mt-4 pb-6">
                  <p className="text-sm text-muted-foreground">
                    {detailLead.call_count ? `${detailLead.call_count} calls made` : 'No calls recorded yet'}
                  </p>
                  {detailLead.last_called_at && <p className="text-xs text-muted-foreground mt-1">Last: {relativeDate(detailLead.last_called_at)}</p>}
                  {detailLead.call_outcome && <Badge variant="outline" className="mt-2">{detailLead.call_outcome}</Badge>}
                </TabsContent>
                <TabsContent value="analysis" className="mt-4 pb-6">
                  <div className="space-y-3 text-sm">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">MAO Formula</p>
                      <p className="font-mono text-xs">MAO = 70% × ARV - Repairs</p>
                      {detailLead.arv && <p className="font-mono text-xs mt-1">= 70% × {fmt$(detailLead.arv)} - {fmt$(detailLead.estimated_repairs || 0)} = {fmt$((detailLead.arv * 0.7) - (detailLead.estimated_repairs || 0))}</p>}
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Deal Viability</p>
                      <p>{detailLead.deal_score === 'A' ? '✅ Strong buy — meets all criteria' : detailLead.deal_score === 'B' ? '🟡 Good opportunity — review numbers' : detailLead.deal_score === 'C' ? '🟠 Marginal — needs negotiation' : detailLead.deal_score === 'D' ? '🔴 Poor deal — not recommended' : 'Not yet scored'}</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="notes" className="mt-4 pb-6">
                  <Textarea placeholder="Add a note..." rows={3} className="mb-3" />
                  <Button size="sm" style={{ backgroundColor: GREEN }}>Add Note</Button>
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
