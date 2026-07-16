/**
 * Dynasty Direct — Pricing Command Center (/dynasty-direct/pricing)
 *
 * Central console for monitoring, analyzing, and editing catalog pricing.
 * All price writes go through the shared floor-enforcement pattern
 * (client-side margin check + confirm + dd_update_product_pricing RPC with
 * explicit override flag), mirroring ProductDetailPanel.savePricing().
 *
 * Ceiling is computed client-side as market_avg_retail * 1.15 (no
 * ceiling_price column exists on products_all — matches B2/B5 formula).
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  AlertTriangle, DollarSign, Sparkles, History, Download,
  RefreshCw, TrendingUp, Loader2, Search, LineChart, Target,
} from 'lucide-react';

const GOLD = '#C9A84C';
const CEILING_MULTIPLIER = 1.15; // ceiling = market_avg_retail * 1.15 (matches B2/B5)

const CATEGORIES = [
  'disposable_vape', 'nicotine_pouch', 'tobacco_grabba', 'rolling_papers',
  'lighters', 'grinders', 'glass', 'vape_hardware', 'cbd_hemp', 'accessories',
] as const;
type Category = typeof CATEGORIES[number];

type StatusKind = 'on_target' | 'below_target' | 'below_floor' | 'alert';

interface PricingRow {
  id: string;
  product_name: string;
  category: string | null;
  supplier_cost: number | null;
  store_price_a: number | null;
  dtc_price_b: number | null;
  store_margin_pct: number | null;
  dtc_margin_pct: number | null;
  min_store_margin_pct: number | null;
  target_store_margin_pct: number | null;
  min_dtc_margin_pct: number | null;
  target_dtc_margin_pct: number | null;
  market_avg_retail: number | null;
  has_open_alert: boolean;
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toFixed(2)}`;
const pct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;
const ceilingOf = (r: Pick<PricingRow, 'market_avg_retail'>) =>
  r.market_avg_retail == null ? null : r.market_avg_retail * CEILING_MULTIPLIER;

function computeStatus(r: PricingRow): StatusKind {
  if (r.has_open_alert) return 'alert';
  const belowFloor =
    (r.store_margin_pct != null && r.min_store_margin_pct != null && r.store_margin_pct < r.min_store_margin_pct) ||
    (r.dtc_margin_pct != null && r.min_dtc_margin_pct != null && r.dtc_margin_pct < r.min_dtc_margin_pct);
  if (belowFloor) return 'below_floor';
  const belowTarget =
    (r.store_margin_pct != null && r.target_store_margin_pct != null && r.store_margin_pct < r.target_store_margin_pct) ||
    (r.dtc_margin_pct != null && r.target_dtc_margin_pct != null && r.dtc_margin_pct < r.target_dtc_margin_pct);
  if (belowTarget) return 'below_target';
  return 'on_target';
}

function StatusBadge({ s }: { s: StatusKind }) {
  const map: Record<StatusKind, { label: string; cls: string }> = {
    on_target:    { label: '🟢 On Target',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    below_target: { label: '🟡 Below Target', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    below_floor:  { label: '🔴 Below Floor',  cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    alert:        { label: '⚡ Alert',         cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  };
  const v = map[s];
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
}

export default function PricingPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<'all' | Category>('all');
  const [alertFilter, setAlertFilter] = useState<null | 'below_floor' | 'below_target' | 'above_ceiling'>(null);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState<PricingRow | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [refreshingMarket, setRefreshingMarket] = useState<string | null>(null);
  const [applyingSweet, setApplyingSweet] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['dd-pricing-rows', category],
    queryFn: async () => {
      let q = supabase
        .from('products_all')
        .select(`
          id, product_name, category,
          supplier_cost, store_price_a, dtc_price_b,
          store_margin_pct, dtc_margin_pct,
          min_store_margin_pct, target_store_margin_pct,
          min_dtc_margin_pct, target_dtc_margin_pct,
          market_avg_retail
        `)
        .neq('status', 'deleted')
        .order('product_name');
      if (category !== 'all') q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['dd-price-alerts-open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_price_alerts')
        .select('id, product_id, alert_type, current_price, recommended_price, competitor_price, message, created_at')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const alertIds = useMemo(() => new Set(alerts.map(a => a.product_id)), [alerts]);
  const alertsByProduct = useMemo(() => {
    const m: Record<string, typeof alerts> = {};
    alerts.forEach(a => { (m[a.product_id] ??= []).push(a); });
    return m;
  }, [alerts]);

  const enriched: PricingRow[] = useMemo(() => products.map((p: any) => ({
    ...p, has_open_alert: alertIds.has(p.id),
  })), [products, alertIds]);

  // Above-ceiling is computed client-side: any live price above market_avg_retail * 1.15
  const aboveCeilingIds = useMemo(() => {
    const s = new Set<string>();
    enriched.forEach(r => {
      const c = ceilingOf(r);
      if (c == null) return;
      if ((r.store_price_a != null && r.store_price_a > c) || (r.dtc_price_b != null && r.dtc_price_b > c)) {
        s.add(r.id);
      }
    });
    return s;
  }, [enriched]);

  const counts = useMemo(() => {
    let below_floor = 0, below_target = 0;
    alerts.forEach(a => {
      const t = (a.alert_type ?? '').toLowerCase();
      if (t.includes('floor')) below_floor++;
      else below_target++;
    });
    return {
      below_floor,
      below_target,
      above_ceiling: aboveCeilingIds.size,
      total: below_floor + below_target + aboveCeilingIds.size,
    };
  }, [alerts, aboveCeilingIds]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enriched.filter(r => {
      if (term && !r.product_name.toLowerCase().includes(term)) return false;
      if (alertFilter === 'above_ceiling') {
        return aboveCeilingIds.has(r.id);
      }
      if (alertFilter) {
        const rowAlerts = alertsByProduct[r.id] ?? [];
        const has = rowAlerts.some(a => {
          const t = (a.alert_type ?? '').toLowerCase();
          if (alertFilter === 'below_floor') return t.includes('floor');
          return !t.includes('floor');
        });
        if (!has) return false;
      }
      return true;
    });
  }, [enriched, search, alertFilter, alertsByProduct, aboveCeilingIds]);

  const recalcAll = useMutation({
    mutationFn: async () => {
      const rows = enriched.filter(r => r.supplier_cost != null);
      const toastId = toast.loading(`Recalculating ${rows.length} products…`);
      let done = 0;
      for (const r of rows) {
        const { error } = await supabase
          .from('products_all')
          .update({ supplier_cost: r.supplier_cost })
          .eq('id', r.id);
        if (error) { toast.dismiss(toastId); throw error; }
        done++;
      }
      toast.dismiss(toastId);
      return done;
    },
    onSuccess: (n) => {
      toast.success(`Recalculated ${n} products`);
      qc.invalidateQueries({ queryKey: ['dd-pricing-rows'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Recalculation failed'),
  });

  function exportCsv() {
    const header = ['product_name','category','cost','store_price','dtc_price','store_margin_pct','dtc_margin_pct','market_avg_retail','ceiling','status'];
    const rows = filtered.map(r => [
      r.product_name, r.category ?? '',
      r.supplier_cost ?? '', r.store_price_a ?? '', r.dtc_price_b ?? '',
      r.store_margin_pct ?? '', r.dtc_margin_pct ?? '',
      r.market_avg_retail ?? '', ceilingOf(r) ?? '',
      computeStatus(r),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dd-pricing-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function runAnalysis(id: string) {
    setAnalyzing(id);
    try {
      const { data, error } = await supabase.functions.invoke('dd-price-intelligence', {
        body: { action: 'analyze', product_id: id },
      });
      if (error) throw error;
      toast.success(data?.summary ?? 'AI analysis complete');
      qc.invalidateQueries({ queryKey: ['dd-price-alerts-open'] });
      qc.invalidateQueries({ queryKey: ['dd-pricing-rows'] });
    } catch (e: any) {
      toast.error(e.message ?? 'AI analysis failed');
    } finally { setAnalyzing(null); }
  }

  async function checkMarketPrice(id: string) {
    setRefreshingMarket(id);
    try {
      const { data, error } = await supabase.functions.invoke('dd-price-intelligence', {
        body: { action: 'refresh_market', product_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.samples) toast.info(`No competitor prices found for "${data?.query ?? 'query'}"`);
      else toast.success(`Market: avg $${data.avg} · low $${data.low} · high $${data.high} (${data.samples} sources)`);
      qc.invalidateQueries({ queryKey: ['dd-pricing-rows'] });
      qc.invalidateQueries({ queryKey: ['dd-price-alerts-open'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Market check failed');
    } finally { setRefreshingMarket(null); }
  }

  async function applySweetSpot(row: PricingRow) {
    if (row.market_avg_retail == null) {
      toast.error('No market data yet — click "Check Market Price" first.');
      return;
    }
    setApplyingSweet(row.id);
    try {
      // Preview
      const { data: pre, error: preErr } = await supabase.functions.invoke('dd-price-intelligence', {
        body: { action: 'analyze', product_id: row.id },
      });
      if (preErr) throw preErr;
      const sweet = pre?.analysis?.sweet_spot;
      if (!sweet) throw new Error('Sweet-spot unavailable (missing market or cost).');

      const msg =
        `Apply competitive sweet-spot price for "${row.product_name}"?\n\n` +
        `Store: $${row.store_price_a ?? '—'} → $${sweet.store_price} (${sweet.store_margin_pct.toFixed(1)}% margin)\n` +
        `DTC:   $${row.dtc_price_b ?? '—'} → $${sweet.dtc_price} (${sweet.dtc_margin_pct.toFixed(1)}% margin)\n\n` +
        `${sweet.notes}`;
      if (!window.confirm(msg)) return;

      const { data, error } = await supabase.functions.invoke('dd-price-intelligence', {
        body: { action: 'apply_sweet_spot', product_id: row.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Applied sweet spot: store $${data.applied.store_price_a} / DTC $${data.applied.dtc_price_b}`);
      qc.invalidateQueries({ queryKey: ['dd-pricing-rows'] });
      qc.invalidateQueries({ queryKey: ['dd-price-alerts-open'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Apply sweet spot failed');
    } finally { setApplyingSweet(null); }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-7 w-7" style={{ color: GOLD }} /> Pricing Command
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor margins, resolve alerts, and adjust pricing across the catalog.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
            <Button variant="outline" onClick={() => toast.info('Market adjustment wizard coming next')}>
              <TrendingUp className="h-4 w-4 mr-1" /> Apply Market Adjustment
            </Button>
            <Button
              onClick={() => recalcAll.mutate()}
              disabled={recalcAll.isPending}
              style={{ background: GOLD, color: '#000' }}
            >
              {recalcAll.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Recalculate All
            </Button>
          </div>
        </div>

        <Card className="border" style={{ borderColor: counts.total > 0 ? GOLD : undefined }}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" style={{ color: GOLD }} />
              <div>
                <div className="font-semibold">
                  {counts.total} open pricing alert{counts.total === 1 ? '' : 's'}
                </div>
                <div className="text-xs text-muted-foreground">Click a chip to filter the table.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <AlertChip active={alertFilter==='below_floor'}   onClick={() => setAlertFilter(alertFilter==='below_floor' ? null : 'below_floor')}     label={`🔴 Below Floor · ${counts.below_floor}`} />
              <AlertChip active={alertFilter==='below_target'}  onClick={() => setAlertFilter(alertFilter==='below_target' ? null : 'below_target')}   label={`🟡 Below Target · ${counts.below_target}`} />
              <AlertChip active={alertFilter==='above_ceiling'} onClick={() => setAlertFilter(alertFilter==='above_ceiling' ? null : 'above_ceiling')} label={`⚠ Above Ceiling · ${counts.above_ceiling}`} />
              {alertFilter && (
                <Button size="sm" variant="ghost" onClick={() => setAlertFilter(null)}>Clear</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {CATEGORIES.map(c => (
              <TabsTrigger key={c} value={c}>{c.replace(/_/g,' ')}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or SKU…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {filtered.length} product{filtered.length === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                No products match the current filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU / Name</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Store</TableHead>
                    <TableHead className="text-right">DTC</TableHead>
                    <TableHead className="text-right">Store %</TableHead>
                    <TableHead className="text-right">DTC %</TableHead>
                    <TableHead className="text-right">Market Avg</TableHead>
                    <TableHead className="text-right">Ceiling</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const status = computeStatus(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.product_name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{r.category ?? '—'}</div>
                        </TableCell>
                        <TableCell className="text-right">{money(r.supplier_cost)}</TableCell>
                        <TableCell className="text-right">{money(r.store_price_a)}</TableCell>
                        <TableCell className="text-right">{money(r.dtc_price_b)}</TableCell>
                        <TableCell className="text-right">{pct(r.store_margin_pct)}</TableCell>
                        <TableCell className="text-right">{pct(r.dtc_margin_pct)}</TableCell>
                        <TableCell className="text-right">{money(r.market_avg_retail)}</TableCell>
                        <TableCell className="text-right">{money(ceilingOf(r))}</TableCell>
                        <TableCell><StatusBadge s={status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setEditRow(r)}>Edit</Button>
                            <Button size="sm" variant="outline" disabled={analyzing===r.id} onClick={() => runAnalysis(r.id)} title="AI analysis">
                              {analyzing===r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="outline" disabled={refreshingMarket===r.id} onClick={() => checkMarketPrice(r.id)} title="Check market price (SerpAPI)">
                              {refreshingMarket===r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LineChart className="h-3 w-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={applyingSweet===r.id || r.market_avg_retail == null}
                              onClick={() => applySweetSpot(r)}
                              title={r.market_avg_retail == null ? 'Run Check Market Price first' : 'Apply competitive sweet-spot price'}
                              style={r.market_avg_retail != null ? { borderColor: GOLD, color: GOLD } : undefined}
                            >
                              {applyingSweet===r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Target className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setHistoryId(r.id)}>
                              <History className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {editRow && (
        <EditPriceDialog
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['dd-pricing-rows'] });
            qc.invalidateQueries({ queryKey: ['dd-price-alerts-open'] });
          }}
        />
      )}
      {historyId && (
        <AlertHistoryDialog productId={historyId} onClose={() => setHistoryId(null)} />
      )}
    </>
  );
}

function AlertChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs border transition"
      style={{
        borderColor: active ? GOLD : 'hsl(var(--border))',
        background: active ? `${GOLD}22` : 'transparent',
        color: active ? GOLD : undefined,
      }}
    >
      {label}
    </button>
  );
}

// -------------------- Edit Price Dialog (floor-guarded) --------------------

function EditPriceDialog({
  row, onClose, onSaved,
}: { row: PricingRow; onClose: () => void; onSaved: () => void }) {
  const [supplier_cost, setCost] = useState<string>(row.supplier_cost?.toString() ?? '');
  const [store_price_a, setStore] = useState<string>(row.store_price_a?.toString() ?? '');
  const [dtc_price_b, setDtc]   = useState<string>(row.dtc_price_b?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const num = (v: string) => v === '' ? null : Number(v);

  async function save() {
    const cost = num(supplier_cost) ?? row.supplier_cost;
    const newStore = num(store_price_a);
    const newDtc = num(dtc_price_b);

    const breaches: string[] = [];
    if (cost && cost > 0) {
      if (newStore && row.min_store_margin_pct != null && newStore > 0) {
        const m = ((newStore - cost) / newStore) * 100;
        if (m < row.min_store_margin_pct) breaches.push(`Store margin ${m.toFixed(1)}% < floor ${row.min_store_margin_pct}% (price $${newStore}, cost $${cost})`);
      }
      if (newDtc && row.min_dtc_margin_pct != null && newDtc > 0) {
        const m = ((newDtc - cost) / newDtc) * 100;
        if (m < row.min_dtc_margin_pct) breaches.push(`DTC margin ${m.toFixed(1)}% < floor ${row.min_dtc_margin_pct}% (price $${newDtc}, cost $${cost})`);
      }
    }
    if (breaches.length > 0) {
      const ok = window.confirm(`Price floor breach:\n\n${breaches.join('\n')}\n\nOverride and save anyway?`);
      if (!ok) { toast.error('Save blocked — price below margin floor'); return; }
    }

    setSaving(true);
    try {
      if (breaches.length > 0) {
        const { error } = await supabase.rpc('dd_update_product_pricing', {
          p_product_id: row.id,
          p_supplier_cost: num(supplier_cost),
          p_store_price_a: newStore,
          p_dtc_price_b: newDtc,
          p_map_price: null,
          p_allow_override: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products_all').update({
          supplier_cost: num(supplier_cost),
          store_price_a: newStore,
          dtc_price_b: newDtc,
        }).eq('id', row.id);
        if (error) throw error;
      }
      toast.success(breaches.length > 0 ? 'Saved with floor override' : 'Pricing updated');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally { setSaving(false); }
  }

  const ceiling = ceilingOf(row);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Price — {row.product_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Supplier Cost" value={supplier_cost} onChange={setCost} />
          <Field label="Store Price (A)" value={store_price_a} onChange={setStore} />
          <Field label="DTC Price (B)"   value={dtc_price_b}   onChange={setDtc} />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Floor: store ≥ {row.min_store_margin_pct ?? '—'}% · DTC ≥ {row.min_dtc_margin_pct ?? '—'}%</div>
            <div>Market avg {money(row.market_avg_retail)} · ceiling {money(ceiling)} (avg × 1.15)</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: GOLD, color: '#000' }}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// -------------------- Alert History Dialog --------------------

function AlertHistoryDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['dd-price-alerts-history', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_price_alerts')
        .select('id, alert_type, current_price, recommended_price, competitor_price, message, is_resolved, resolved_at, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Alert History</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No alerts recorded for this product.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {data.map(a => (
              <div key={a.id} className="border rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{a.alert_type}</Badge>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                    {a.is_resolved && ' · resolved'}
                  </div>
                </div>
                {a.message && <div className="mt-1">{a.message}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  current {money(a.current_price)} · rec {money(a.recommended_price)} · comp {money(a.competitor_price)}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
