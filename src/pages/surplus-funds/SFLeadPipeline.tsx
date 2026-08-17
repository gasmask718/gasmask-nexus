import { useState, useRef, useMemo, useEffect } from 'react';
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
  MoreHorizontal, Scale, Eye, MapPin, TrendingUp, Filter
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { formatDistanceToNow } from 'date-fns';
import { CaseActionButtons } from './components/CaseActionButtons';

const AMBER = '#BA7517';

const STATUS_PILLS = [
  'all','new','skip_trace_pending','phone_found','queued','called','interested',
  'consultation_booked','agreement_signed','referred_to_attorney',
  'case_filed','funds_released','closed','do_not_contact'
];

// Derived skip-trace status — narrow definition that matches DB semantics:
// - traced: status='phone_found' OR skip_traced flag=true
//           (downstream statuses like queued/called/interested are pipeline
//            progress, not skip-trace signals, and would inflate the count)
// - failed: status='skip_trace_failed' OR skip_trace_failed flag=true
// - pending: everything else
type SkipStatus = 'pending' | 'traced' | 'failed';
function deriveSkipStatus(l: any): SkipStatus {
  if (l?.status === 'skip_trace_failed' || l?.skip_trace_failed === true) return 'failed';
  if (l?.status === 'phone_found' || l?.skip_traced === true) return 'traced';
  return 'pending';
}
const skipBadgeStyle: Record<SkipStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  traced:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  failed:  'bg-red-500/15 text-red-400 border-red-500/40',
};
const skipBadgeLabel: Record<SkipStatus, string> = {
  pending: '🟡 Pending Skip Trace',
  traced:  '🟢 Skip Traced',
  failed:  '🔴 Failed',
};

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

type AmountBucket = 'all' | '0-10k' | '10k-50k' | '50k-plus' | 'custom';
const AMOUNT_BUCKETS: { key: AmountBucket; label: string; min: number | null; max: number | null }[] = [
  { key: 'all',      label: 'Any amount',   min: null,   max: null },
  { key: '0-10k',    label: '$0 – $10k',    min: 0,      max: 10000 },
  { key: '10k-50k',  label: '$10k – $50k',  min: 10000,  max: 50000 },
  { key: '50k-plus', label: '$50k+',        min: 50000,  max: null },
  { key: 'custom',   label: 'Custom range', min: null,   max: null },
];

export default function SFLeadPipeline() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilters, setStateFilters] = useState<string[]>([]); // multi-select; empty = all
  const [countyFilter, setCountyFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [skipTab, setSkipTab] = useState<'all' | SkipStatus>('all');
  const [amountBucket, setAmountBucket] = useState<AmountBucket>('all');
  const [amountMinInput, setAmountMinInput] = useState<string>('');
  const [amountMaxInput, setAmountMaxInput] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // Resolve active amount range from bucket + custom inputs
  const { activeAmountMin, activeAmountMax } = useMemo(() => {
    if (amountBucket === 'custom') {
      const min = amountMinInput === '' ? null : Number(amountMinInput);
      const max = amountMaxInput === '' ? null : Number(amountMaxInput);
      return {
        activeAmountMin: Number.isFinite(min as number) ? (min as number) : null,
        activeAmountMax: Number.isFinite(max as number) ? (max as number) : null,
      };
    }
    const b = AMOUNT_BUCKETS.find(x => x.key === amountBucket)!;
    return { activeAmountMin: b.min, activeAmountMax: b.max };
  }, [amountBucket, amountMinInput, amountMaxInput]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['sf-leads'],
    queryFn: async () => {
      // Supabase caps a single request at 1000 rows — page through until we've got everything.
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('surplus_funds_leads')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return all;
    },
    refetchInterval: 30000,
  });

  const addLead = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('surplus_funds_leads').insert(lead);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sf-leads'] }); qc.invalidateQueries({ queryKey: ['sf-lead-summary'] }); toast.success('Lead added'); setAddOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter payload — shared between the summary RPC and the client-side list filter
  // so both always describe the same "what am I looking at" slice.
  const filterPayload = useMemo(() => ({
    states: stateFilters,
    amountMin: activeAmountMin,
    amountMax: activeAmountMax,
    skipStatus: skipTab === 'all' ? null : skipTab,
    status: statusFilter === 'all' ? null : statusFilter,
    source: sourceFilter === 'all' ? null : sourceFilter,
    search: search.trim() || null,
  }), [stateFilters, activeAmountMin, activeAmountMax, skipTab, statusFilter, sourceFilter, search]);

  // SQL-side aggregation — count/sum/avg computed in Postgres, not JS.
  // Stays fast at 5,000+ rows.
  const { data: summary } = useQuery({
    queryKey: ['sf-lead-summary', filterPayload],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('sf_lead_summary', {
        _states: filterPayload.states.length ? filterPayload.states : null,
        _amount_min: filterPayload.amountMin,
        _amount_max: filterPayload.amountMax,
        _skip_status: filterPayload.skipStatus,
        _status: filterPayload.status,
        _source: filterPayload.source,
        _search: filterPayload.search,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_leads:        Number(row?.total_leads ?? 0),
        distinct_states:    Number(row?.distinct_states ?? 0),
        total_surplus:      Number(row?.total_surplus ?? 0),
        avg_surplus:        Number(row?.avg_surplus ?? 0),
        skip_pending_count: Number(row?.skip_pending_count ?? 0),
        skip_traced_count:  Number(row?.skip_traced_count ?? 0),
        skip_failed_count:  Number(row?.skip_failed_count ?? 0),
      };
    },
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  // Website-today spotlight remains client-side (small, always-visible metric)
  const websiteToday = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return leads.filter((l: any) =>
      l.lead_source === 'dynasty_recovery_website' &&
      l.created_at && new Date(l.created_at) >= todayStart
    ).length;
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (skipTab !== 'all') result = result.filter((l: any) => deriveSkipStatus(l) === skipTab);
    if (statusFilter !== 'all') result = result.filter((l: any) => l.status === statusFilter);
    if (stateFilters.length > 0) result = result.filter((l: any) => stateFilters.includes(l.state));
    if (countyFilter !== 'all') result = result.filter((l: any) => l.county === countyFilter);
    if (sourceFilter !== 'all') result = result.filter((l: any) => (l.lead_source || 'manual_upload') === sourceFilter);
    if (activeAmountMin != null) result = result.filter((l: any) => Number(l.surplus_amount || 0) >= activeAmountMin);
    if (activeAmountMax != null) result = result.filter((l: any) => Number(l.surplus_amount || 0) <= activeAmountMax);
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
  }, [leads, skipTab, statusFilter, stateFilters, countyFilter, sourceFilter, activeAmountMin, activeAmountMax, search, sortKey, sortDir]);

  // Reset to page 1 whenever the filter slice changes
  useEffect(() => { setPage(1); }, [skipTab, statusFilter, stateFilters, countyFilter, sourceFilter, activeAmountMin, activeAmountMax, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(pageStart, pageEnd);

  const hasActiveFilters =
    stateFilters.length > 0 || countyFilter !== 'all' || amountBucket !== 'all' || skipTab !== 'all' ||
    statusFilter !== 'all' || sourceFilter !== 'all' || search.trim() !== '';

  const clearAllFilters = () => {
    setStateFilters([]); setCountyFilter('all'); setAmountBucket('all'); setAmountMinInput(''); setAmountMaxInput('');
    setSkipTab('all'); setStatusFilter('all'); setSourceFilter('all'); setSearch('');
  };

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((l: any) => l.id)));

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];

    const norm = (v: any) => String(v ?? '').trim().toLowerCase();
    const normPhone = (v: any) => String(v ?? '').replace(/\D/g, '');
    const dedupKey = (fn: any, ln: any, ph: any) => `${norm(fn)}|${norm(ln)}|${normPhone(ph)}`;

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

    // In-file dedupe (first_name + last_name + phone)
    const seen = new Set<string>();
    const inFileUnique = mapped.filter(m => {
      const k = dedupKey(m.first_name, m.last_name, m.phone);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const inFileDupes = mapped.length - inFileUnique.length;

    // DB dedupe: fetch existing candidates matching any first_name in this batch
    const firstNames = Array.from(new Set(inFileUnique.map(m => m.first_name).filter(Boolean)));
    let existingKeys = new Set<string>();
    if (firstNames.length > 0) {
      const { data: existing, error: exErr } = await supabase
        .from('surplus_funds_leads')
        .select('first_name, last_name, phone')
        .in('first_name', firstNames)
        .limit(5000);
      if (exErr) {
        toast.error('Dedupe lookup failed: ' + exErr.message);
        e.target.value = '';
        return;
      }
      existingKeys = new Set((existing || []).map((r: any) => dedupKey(r.first_name, r.last_name, r.phone)));
    }

    const toInsert = inFileUnique.filter(m => !existingKeys.has(dedupKey(m.first_name, m.last_name, m.phone)));
    const dbDupes = inFileUnique.length - toInsert.length;

    if (toInsert.length === 0) {
      toast.info(`No new leads — ${inFileDupes} in-file duplicates and ${dbDupes} already in database`);
      e.target.value = '';
      return;
    }

    // `pool` is required but set server-side by trg_sf_leads_set_pool from lead_source
    const { data: inserted, error } = await supabase
      .from('surplus_funds_leads')
      .insert(toInsert as any)
      .select('id, state');
    if (error) { toast.error('Upload failed: ' + error.message); e.target.value = ''; return; }
    const skipped = inFileDupes + dbDupes;
    toast.success(
      skipped > 0
        ? `${toInsert.length} imported — skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`
        : `${toInsert.length} leads imported`
    );
    qc.invalidateQueries({ queryKey: ['sf-leads'] });

    const insertedIds = (inserted || []).map((l: any) => l.id);
    if (insertedIds.length > 0) {
      try {
        const detectedState = (inserted || []).find((l: any) => l.state)?.state || 'FL';
        const { data: campaignResult, error: campErr } = await supabase.functions.invoke('sf-trigger-bland-campaign', {
          body: {
            lead_ids: insertedIds,
            campaign_name: `SF_Upload_${new Date().toISOString().slice(0, 10)}`,
            state: detectedState,
          },
        });
        if (campErr) throw campErr;
        toast.success(`Bland AI campaign started — calls beginning now! (${insertedIds.length} leads)`, { duration: 6000 });
        console.log('[SF campaign started]', campaignResult);
      } catch (err: any) {
        console.error('Campaign trigger failed:', err);
        toast.warning('Leads uploaded but campaign failed to start. Trigger manually from Automation tab.', { duration: 8000 });
      }
    }
    e.target.value = '';
  };


  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'surplus_funds_leads.xlsx');
  };

  const states = useMemo(() => [...new Set(leads.map((l: any) => l.state).filter(Boolean))].sort(), [leads]);

  // Counties scoped to the currently selected state(s) so the list stays relevant.
  const counties = useMemo(() => {
    const scoped = stateFilters.length > 0
      ? leads.filter((l: any) => stateFilters.includes(l.state))
      : leads;
    return [...new Set(scoped.map((l: any) => l.county).filter(Boolean))].sort() as string[];
  }, [leads, stateFilters]);

  // Dependent amount bucket counts — recompute whenever the selected state(s) change,
  // so the Amount filter always reflects the currently-scoped state slice.
  // (Reverse dependency intentionally not applied — amount doesn't rescope state.)
  const amountBucketCounts = useMemo(() => {
    const scoped = stateFilters.length > 0
      ? leads.filter((l: any) => stateFilters.includes(l.state))
      : leads;
    const counts: Record<AmountBucket, number> = {
      'all': scoped.length, '0-10k': 0, '10k-50k': 0, '50k-plus': 0, 'custom': 0,
    };
    for (const l of scoped) {
      const amt = Number(l.surplus_amount || 0);
      if (amt < 10000) counts['0-10k']++;
      else if (amt < 50000) counts['10k-50k']++;
      else counts['50k-plus']++;
    }
    return counts;
  }, [leads, stateFilters]);

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

      {/* Today's Website Leads spotlight — compact strip */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border"
        style={{ borderColor: '#0F6E56', background: 'linear-gradient(90deg, hsl(var(--card)), hsl(var(--card)/0.6))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="h-4 w-4 shrink-0" style={{ color: '#0F6E56' }} />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Today's Website Leads</span>
          <span className="text-lg font-bold leading-none" style={{ color: '#0F6E56' }}>{websiteToday}</span>
          <span className="text-xs text-muted-foreground truncate hidden sm:inline">· dynastyrecoverygroup.com live intake</span>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSourceFilter('dynasty_recovery_website')}>
          View
        </Button>
      </div>

      {/* Summary cards — recompute in SQL against whatever filters are currently active */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="States"           value={summary?.distinct_states ?? 0}                                     icon={MapPin}         color="#60a5fa" />
        <StatCard label="Total Leads"      value={summary?.total_leads ?? 0}                                         icon={List}           color="#9ca3af" />
        <StatCard label="Total Surplus"    value={fmt$(summary?.total_surplus ?? 0)}                                 icon={DollarSign}     color={AMBER} />
        <StatCard label="Average Surplus"  value={fmt$(summary?.avg_surplus ?? 0)}                                   icon={TrendingUp}     color={AMBER} />
        <StatCard label="Pending Skip"     value={summary?.skip_pending_count ?? 0}                                  icon={Clock}          color="#eab308" />
        <StatCard label="Skip Traced"      value={summary?.skip_traced_count ?? 0}                                   icon={Phone}          color="#10b981" />
      </div>
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-3">
          <Filter className="h-3 w-3" />
          <span>Cards reflect current filters</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearAllFilters}>Clear all filters</Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, county, state, or case number..." className="pl-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Skip-trace tabs */}
      <div className="flex gap-2 flex-wrap items-center border-b border-border pb-3">
        {([
          { key: 'all',     label: `All Leads`,             count: (summary?.skip_pending_count ?? 0) + (summary?.skip_traced_count ?? 0) + (summary?.skip_failed_count ?? 0), color: '#9ca3af' },
          { key: 'pending', label: `🟡 Pending Skip Trace`, count: summary?.skip_pending_count ?? 0, color: '#eab308' },
          { key: 'traced',  label: `🟢 Skip Traced`,        count: summary?.skip_traced_count ?? 0,  color: '#10b981' },
          { key: 'failed',  label: `🔴 Failed`,             count: summary?.skip_failed_count ?? 0,  color: '#ef4444' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setSkipTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              skipTab === t.key
                ? 'text-white border-transparent shadow-sm'
                : 'text-muted-foreground border-border hover:border-muted-foreground/50 bg-transparent'
            }`}
            style={skipTab === t.key ? { backgroundColor: t.color } : undefined}
          >
            {t.label} <span className="ml-1 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          {/* Status filter (was: redundant pill row) */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {STATUS_PILLS.map(s => (
                <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Multi-select state filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {stateFilters.length === 0 ? 'All States' : `${stateFilters.length} state${stateFilters.length === 1 ? '' : 's'}`}
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                <span className="text-xs font-semibold uppercase text-muted-foreground">States</span>
                {stateFilters.length > 0 && (
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setStateFilters([])}>Clear</button>
                )}
              </div>
              <div className="max-h-64 overflow-auto space-y-1">
                {states.length === 0 && <p className="text-xs text-muted-foreground px-1 py-2">No states in data yet</p>}
                {states.map(s => {
                  const checked = stateFilters.includes(s);
                  return (
                    <label key={s} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setStateFilters(prev => v ? [...prev, s] : prev.filter(x => x !== s));
                        }}
                      />
                      <span>{s}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* County filter — scoped by selected state(s) */}
          <Select value={countyFilter} onValueChange={setCountyFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="All Counties" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All Counties</SelectItem>
              {counties.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>


          {/* Amount bucket filter — counts recompute based on currently selected state(s) */}
          <Select value={amountBucket} onValueChange={(v) => setAmountBucket(v as AmountBucket)}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Surplus amount" /></SelectTrigger>
            <SelectContent>
              {AMOUNT_BUCKETS.map(b => (
                <SelectItem key={b.key} value={b.key}>
                  {b.label}
                  {b.key !== 'custom' && (
                    <span className="ml-2 opacity-60">({amountBucketCounts[b.key].toLocaleString()})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {amountBucket === 'custom' && (
            <>
              <Input
                type="number"
                placeholder="Min $"
                className="h-8 w-24 text-xs"
                value={amountMinInput}
                onChange={e => setAmountMinInput(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max $"
                className="h-8 w-24 text-xs"
                value={amountMaxInput}
                onChange={e => setAmountMaxInput(e.target.value)}
              />
            </>
          )}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="dynasty_recovery_website">⭐ Dynasty Recovery Website</SelectItem>
              <SelectItem value="scraped">Scraped</SelectItem>
              <SelectItem value="skip_traced">Skip-traced</SelectItem>
              <SelectItem value="manual_upload">Manual Upload</SelectItem>
              <SelectItem value="csv_upload">CSV Upload</SelectItem>
            </SelectContent>
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
            hasActiveFilters ? (
              <div className="py-16 text-center">
                <Filter className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">No leads match these filters</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6">
                  Try widening the state, amount range, or skip-trace filter.
                </p>
                <Button variant="outline" onClick={clearAllFilters}>
                  <X className="h-4 w-4 mr-2" />Clear all filters
                </Button>
              </div>
            ) : (
              <div className="py-16 text-center">
                <Scale className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">No surplus leads yet — upload county records or add manually</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Start finding unclaimed funds to recover</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload CSV</Button>
                  <Button style={{ backgroundColor: AMBER }} onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Lead Manually</Button>
                </div>
              </div>
            )
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
                  {paginated.map((l: any) => {
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
                        <td className="p-3">
                          {(() => {
                            const st = deriveSkipStatus(l);
                            return <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${skipBadgeStyle[st]}`}>{skipBadgeLabel[st]}</Badge>;
                          })()}
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

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-1">
          <span className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{pageStart + 1}</span>–
            <span className="font-medium text-foreground">{pageEnd}</span> of{' '}
            <span className="font-medium text-foreground">{filtered.length.toLocaleString()}</span> leads
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}



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
                  {(() => { const st = deriveSkipStatus(detailLead); return <Badge variant="outline" className={skipBadgeStyle[st]}>{skipBadgeLabel[st]}</Badge>; })()}
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
                    <LeadCaseActions leadId={detailLead.id} />
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

function LeadCaseActions({ leadId }: { leadId: string }) {
  const { data: linkedCase, isLoading } = useQuery({
    queryKey: ['sf-case-for-lead', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surplus_funds_cases')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;
  if (!linkedCase) {
    return (
      <Button className="w-full" style={{ backgroundColor: AMBER }} disabled>
        Create Case → (coming soon)
      </Button>
    );
  }
  return <CaseActionButtons case={linkedCase} />;
}
