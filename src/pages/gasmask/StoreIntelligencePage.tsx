// ═══════════════════════════════════════════════════════════════════════════════
// STORE INTELLIGENCE — GasMask Hub
// Read-only view over public.store_intelligence_v
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Download, ChevronUp, ChevronDown, ExternalLink, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';


type Tier = 'TIER_1_REVENUE_ACTIVE' | 'TIER_2_ENGAGEMENT_ACTIVE' | 'TIER_3_CONTACTS_ONLY' | 'TIER_4_DEAD';

interface StoreIntel {
  store_id: string;
  store_name: string;
  full_address: string | null;
  phone: string | null;
  email: string | null;
  invoice_count: number;
  order_count: number;
  note_count: number;
  contact_count: number;
  comm_event_count: number;
  call_count: number;
  last_invoice_date: string | null;
  last_order_date: string | null;
  total_revenue: number;
  avg_invoice_amount: number;
  activity_tier: Tier;
  days_since_last_activity: number | null;
  has_drift: boolean;
}

const TIER_META: Record<Tier, { label: string; sub: string; cls: string; badgeCls: string }> = {
  TIER_1_REVENUE_ACTIVE: {
    label: 'Revenue Active',
    sub: 'Has invoices',
    cls: 'border-emerald-500/30 bg-emerald-500/5',
    badgeCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  TIER_2_ENGAGEMENT_ACTIVE: {
    label: 'Engagement Active',
    sub: 'Notes / calls only',
    cls: 'border-amber-500/30 bg-amber-500/5',
    badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  TIER_3_CONTACTS_ONLY: {
    label: 'Contacts Only',
    sub: 'No engagement',
    cls: 'border-orange-500/30 bg-orange-500/5',
    badgeCls: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  },
  TIER_4_DEAD: {
    label: 'Dead Weight',
    sub: 'Zero activity',
    cls: 'border-rose-500/30 bg-rose-500/5',
    badgeCls: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  },
};

const ACTIVITY_OPTIONS = [
  { value: 'all', label: 'All activity' },
  { value: 'active', label: 'Active (≤30d)' },
  { value: 'stale-30d', label: 'Stale > 30d' },
  { value: 'stale-90d', label: 'Stale > 90d' },
];

type SortKey =
  | 'store_name' | 'full_address' | 'activity_tier' | 'last_invoice_date'
  | 'invoice_count' | 'total_revenue' | 'days_since_last_activity';

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function toCSV(rows: StoreIntel[]): string {
  const headers = [
    'store_id','store_name','full_address','phone','email',
    'activity_tier','invoice_count','order_count','note_count','contact_count',
    'call_count','comm_event_count','total_revenue','avg_invoice_amount',
    'last_invoice_date','last_order_date','days_since_last_activity','has_drift',
  ];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => esc((r as unknown as Record<string, unknown>)[h])).join(',')),
  ].join('\n');
}

export default function StoreIntelligencePage() {
  const [rows, setRows] = useState<StoreIntel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | Tier>('all');
  const [activity, setActivity] = useState<string>('all');
  const [minRevenue, setMinRevenue] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('total_revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[] | null>(null);



  async function fetchData() {
    setLoading(true);
    // Pull in chunks of 1000 to bypass PostgREST default cap
    const all: StoreIntel[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('store_intelligence_v' as never)
        .select('*')
        .range(from, from + step - 1);
      if (error) {
        toast.error(`Failed to load: ${error.message}`);
        break;
      }
      const batch = (data ?? []) as unknown as StoreIntel[];
      all.push(...batch);
      if (batch.length < step) break;
      from += step;
    }
    setRows(all);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    const { error } = await supabase.rpc('refresh_store_intelligence' as never);
    if (error) toast.error(`Refresh failed: ${error.message}`);
    else {
      toast.success('Store intelligence refreshed');
      await fetchData();
    }
    setRefreshing(false);
  }

  const summary = useMemo(() => {
    const out: Record<Tier, { count: number; revenue: number }> = {
      TIER_1_REVENUE_ACTIVE: { count: 0, revenue: 0 },
      TIER_2_ENGAGEMENT_ACTIVE: { count: 0, revenue: 0 },
      TIER_3_CONTACTS_ONLY: { count: 0, revenue: 0 },
      TIER_4_DEAD: { count: 0, revenue: 0 },
    };
    for (const r of rows) {
      out[r.activity_tier].count += 1;
      out[r.activity_tier].revenue += Number(r.total_revenue) || 0;
    }
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minRev = Number(minRevenue) || 0;
    return rows.filter(r => {
      if (tierFilter !== 'all' && r.activity_tier !== tierFilter) return false;
      if (q) {
        const hay = `${r.store_name ?? ''} ${r.full_address ?? ''} ${r.phone ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (minRev && Number(r.total_revenue) < minRev) return false;
      const days = r.days_since_last_activity ?? 99999;
      if (activity === 'active' && days > 30) return false;
      if (activity === 'stale-30d' && days <= 30) return false;
      if (activity === 'stale-90d' && days <= 90) return false;
      return true;
    });
  }, [rows, search, tierFilter, activity, minRevenue]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const n = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? n : -n;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const paged = useMemo(
    () => sorted.slice(page * pageSize, (page + 1) * pageSize),
    [sorted, page]
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  }

  function exportCsv() {
    const csv = toCSV(sorted);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store_intelligence_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead
      className={cn('cursor-pointer select-none hover:text-foreground', className)}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && (sortDir === 'asc'
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Tiered view of every active store — revenue, engagement, and dead weight at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={selectedIds.length === 0}
            onClick={() => setDispatchStores(selectedIds)}
          >
            <RouteIcon className="h-4 w-4 mr-2" />
            Dispatch Selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </Button>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh Data
          </Button>
        </div>
      </div>


      {/* Tier summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(TIER_META) as Tier[]).map((tier) => {
          const meta = TIER_META[tier];
          const s = summary[tier];
          return (
            <Card
              key={tier}
              className={cn('cursor-pointer transition-shadow hover:shadow-md', meta.cls,
                tierFilter === tier && 'ring-2 ring-primary')}
              onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier)}
            >
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wide">{meta.sub}</CardDescription>
                <CardTitle className="text-base">{meta.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(s.count)}</div>
                {tier === 'TIER_1_REVENUE_ACTIVE' && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatCurrency(s.revenue)} lifetime
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name, address, phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="max-w-xs"
          />
          <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v as 'all' | Tier); setPage(0); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {(Object.keys(TIER_META) as Tier[]).map(t => (
                <SelectItem key={t} value={t}>{TIER_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activity} onValueChange={(v) => { setActivity(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Min revenue $"
            value={minRevenue}
            onChange={(e) => { setMinRevenue(e.target.value); setPage(0); }}
            className="w-36"
          />
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground">
            {formatNumber(sorted.length)} of {formatNumber(rows.length)}
          </div>
          <Button onClick={exportCsv} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <SortHead k="store_name" label="Store" />
                <SortHead k="full_address" label="Address" />
                <SortHead k="activity_tier" label="Tier" />
                <SortHead k="last_invoice_date" label="Last Invoice" />
                <SortHead k="invoice_count" label="Invoices" className="text-right" />
                <SortHead k="total_revenue" label="Revenue" className="text-right" />
                <SortHead k="days_since_last_activity" label="Stale (d)" className="text-right" />
                <TableHead>Phone</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No stores match the current filters.</TableCell></TableRow>
              ) : paged.map((r) => {
                const meta = TIER_META[r.activity_tier];
                return (
                  <TableRow key={r.store_id}>
                    <TableCell className="font-medium">
                      {r.store_name}
                      {r.has_drift && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/40 text-amber-600">drift</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.full_address || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.badgeCls}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{relativeDate(r.last_invoice_date)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.invoice_count)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.total_revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.days_since_last_activity != null && r.days_since_last_activity < 99999
                        ? r.days_since_last_activity
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {r.phone ? (
                        <a href={`tel:${r.phone}`} className="text-primary hover:underline">{r.phone}</a>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Link to={`/gasmask/stores/${r.store_id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
