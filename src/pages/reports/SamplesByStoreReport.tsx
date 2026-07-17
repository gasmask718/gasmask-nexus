import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, Loader2, ArrowUpDown, Info } from 'lucide-react';
import { format } from 'date-fns';
import { brandDisplayName } from '@/lib/inventory/skuDisplay';

interface Row {
  store_id: string;
  store_name: string | null;
  brand: string | null;
  repeat_count: number;
  total_units: number;
  first_sample_at: string | null;
  last_sample_at: string | null;
  first_order_after: string | null;
  days_to_first_order: number | null;
  orders_90d: number;
  revenue_90d: number;
}

type SortKey = 'repeat_count' | 'days_to_first_order' | 'revenue_90d' | 'last_sample_at';

export default function SamplesByStoreReport() {
  const [brand, setBrand] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_sample_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data = [], isLoading } = useQuery({
    queryKey: ['samples-by-store'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('samples_by_store_v')
        .select('*')
        .limit(2000);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const brands = useMemo(
    () => Array.from(new Set(data.map((r) => r.brand).filter(Boolean))) as string[],
    [data]
  );

  const rows = useMemo(() => {
    const filtered = data.filter((r) => {
      if (brand !== 'all' && r.brand !== brand) return false;
      if (from && r.last_sample_at && new Date(r.last_sample_at) < new Date(from)) return false;
      if (to && r.first_sample_at && new Date(r.first_sample_at) > new Date(to + 'T23:59:59')) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] ?? -Infinity) as any;
      const bv = (b[sortKey] ?? -Infinity) as any;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, brand, from, to, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const SortHead = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`py-2 pr-3 ${right ? 'text-right' : ''}`}>
      <button className="inline-flex items-center gap-1 uppercase text-xs text-muted-foreground hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}<ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" /> Samples — by Store
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-store sample history plus follow-on order activity within 90 days.
        </p>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex gap-2">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          Revenue attribution is <b>store-level</b>: it counts every invoice for the store after
          the first sample. Brand-level attribution is approximate because invoices don't carry
          per-line brand.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (<SelectItem key={b} value={b}>{brandDisplayName(b)}</SelectItem>))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Per-store rollup</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No samples logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 uppercase text-xs text-muted-foreground">Store</th>
                    <th className="py-2 pr-3 uppercase text-xs text-muted-foreground">Brand</th>
                    <SortHead k="repeat_count" right>Repeat</SortHead>
                    <th className="py-2 pr-3 text-right uppercase text-xs text-muted-foreground">Units</th>
                    <th className="py-2 pr-3 uppercase text-xs text-muted-foreground">First</th>
                    <SortHead k="last_sample_at">Last</SortHead>
                    <th className="py-2 pr-3 uppercase text-xs text-muted-foreground">1st order after</th>
                    <SortHead k="days_to_first_order" right>Days→sale</SortHead>
                    <th className="py-2 pr-3 text-right uppercase text-xs text-muted-foreground">Orders 90d</th>
                    <SortHead k="revenue_90d" right>Rev 90d</SortHead>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.store_id}-${r.brand ?? ''}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.store_name || '—'}</td>
                      <td className="py-2 pr-3">{brandDisplayName(r.brand)}</td>
                      <td className="py-2 pr-3 text-right">
                        <Badge variant={r.repeat_count > 1 ? 'default' : 'secondary'}>{r.repeat_count}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">{r.total_units}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {r.first_sample_at ? format(new Date(r.first_sample_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {r.last_sample_at ? format(new Date(r.last_sample_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {r.first_order_after ? format(new Date(r.first_order_after), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.days_to_first_order != null ? Number(r.days_to_first_order).toFixed(1) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.orders_90d}</td>
                      <td className="py-2 pr-3 text-right font-medium">
                        {r.revenue_90d ? `$${Number(r.revenue_90d).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
