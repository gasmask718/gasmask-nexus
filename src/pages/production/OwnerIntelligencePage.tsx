/**
 * OWNER INTELLIGENCE (Product B) — the owner's side of the production floor.
 *
 * Cross-office, dense, desktop. The three numbers that matter:
 *   1. CONVERSION — lbs of tobacco in, boxes out, per office / brand / time,
 *      with the baseline as the comparison line.
 *   2. VARIANCE AS LEAKAGE — issued minus used, in plain words:
 *      "3,000 stickers issued, 2,400 used, 2,000 boxes made — 400 unaccounted."
 *   3. COST PER BOX — the pricing floor, with margin at wholesale and retail.
 *
 * Outliers are flagged in words rather than left for the owner to hunt.
 *
 * RBAC: admin tier only. Office leaders never reach this page — the route
 * self-gates, and the underlying views/tables are RLS-enforced so a leader
 * querying them directly gets nothing beyond their own office's quantities
 * (costs are owner/admin at the database level).
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductionRBACGate, useProductionRBAC } from '@/components/production/ProductionRBACGate';
import {
  useConversionRows,
  useMarginRows,
  useLeakageRows,
  useConversionBaselines,
  type ConversionRow,
} from '@/hooks/useOwnerIntelligence';
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  Scale,
  DollarSign,
  PackageSearch,
  Users,
  TrendingDown,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const OFFICE_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d + 'T12:00:00'), 'MMM d'); } catch { return d; }
};

function IntelligenceBody() {
  const { data: conversion = [], isLoading: convLoading } = useConversionRows();
  const { data: margins = [] } = useMarginRows();
  const { data: leakage = [] } = useLeakageRows();
  const { data: baselines = [] } = useConversionBaselines();

  // ── Per-office rollup ────────────────────────────────────────────────
  const officeStats = useMemo(() => {
    const map = new Map<string, {
      name: string; lbs: number; boxes: number; batches: number;
      costedBoxes: number; costTotal: number; leakageStickers: number; leakageBoxes: number;
    }>();
    for (const r of conversion) {
      const key = r.office_name || 'Unknown office';
      const s = map.get(key) || { name: key, lbs: 0, boxes: 0, batches: 0, costedBoxes: 0, costTotal: 0, leakageStickers: 0, leakageBoxes: 0 };
      s.lbs += Number(r.tobacco_lbs) || 0;
      s.boxes += Number(r.boxes_equivalent ?? r.boxes_produced) || 0;
      s.batches += 1;
      map.set(key, s);
    }
    for (const m of margins) {
      const key = m.office_name || 'Unknown office';
      const s = map.get(key);
      if (s && m.cost_per_box != null && m.boxes_produced > 0) {
        s.costedBoxes += m.boxes_produced;
        s.costTotal += Number(m.total_cost) || 0;
      }
    }
    for (const l of leakage) {
      const key = l.office_name || 'Unknown office';
      const s = map.get(key);
      if (s) {
        if ((l.variance_stickers ?? 0) > 0) s.leakageStickers += l.variance_stickers!;
        if ((l.variance_boxes ?? 0) > 0) s.leakageBoxes += l.variance_boxes!;
      }
    }
    return [...map.values()]
      .map((s) => ({
        ...s,
        boxesPerLb: s.lbs > 0 ? s.boxes / s.lbs : null,
        avgCostPerBox: s.costedBoxes > 0 ? s.costTotal / s.costedBoxes : null,
      }))
      .sort((a, b) => (b.boxesPerLb ?? 0) - (a.boxesPerLb ?? 0));
  }, [conversion, margins, leakage]);

  // ── Outlier flags — in words, not columns ────────────────────────────
  const flags = useMemo(() => {
    const out: { tone: 'red' | 'amber' | 'info'; text: string }[] = [];

    // Zero-box batches: tobacco in, nothing out.
    for (const r of conversion) {
      const boxes = Number(r.boxes_equivalent ?? r.boxes_produced) || 0;
      if (Number(r.tobacco_lbs) > 0 && boxes === 0) {
        out.push({
          tone: 'red',
          text: `${r.office_name || 'Unknown office'}: ${r.tobacco_lbs} lbs of ${r.brand} tobacco in, 0 boxes out (${fmtDate(r.batch_date)}). Investigate waste, theft, or data entry.`,
        });
      }
    }

    // Conversion spread between offices.
    const withYield = officeStats.filter((s) => s.boxesPerLb != null && s.boxesPerLb > 0);
    if (withYield.length >= 2) {
      const best = withYield[0];
      const worst = withYield[withYield.length - 1];
      const pctMore = ((best.boxesPerLb! / worst.boxesPerLb!) - 1) * 100;
      if (pctMore >= 10) {
        out.push({
          tone: 'amber',
          text: `${worst.name} used ${pctMore.toFixed(0)}% more tobacco per box than ${best.name} (${worst.boxesPerLb!.toFixed(2)} vs ${best.boxesPerLb!.toFixed(2)} boxes/lb).`,
        });
      }
    }

    // Leakage totals per office.
    for (const s of officeStats) {
      if (s.leakageStickers > 0) {
        out.push({ tone: 'amber', text: `${s.name}: ${s.leakageStickers.toLocaleString()} stickers issued but never became product — unaccounted.` });
      }
      if (s.leakageBoxes > 0) {
        out.push({ tone: 'amber', text: `${s.name}: ${s.leakageBoxes.toLocaleString()} empty boxes issued but never used — unaccounted.` });
      }
    }

    // Missing costs.
    const noCost = margins.filter((m) => m.cost_per_box == null).length;
    if (margins.length > 0 && noCost > 0) {
      out.push({
        tone: 'info',
        text: `${noCost} of ${margins.length} batches have no cost recorded — cost per box can't be computed for them.`,
      });
    }

    // Baseline missing.
    const usableBaseline = baselines.find((b) => Number(b.baseline_boxes_per_lb) > 0);
    if (!usableBaseline) {
      out.push({
        tone: 'info',
        text: 'Conversion baseline not calculated yet — the chart below has no comparison line until enough batches accumulate.',
      });
    }

    return out;
  }, [conversion, officeStats, margins, baselines]);

  // ── Conversion chart data: date → office → boxes/lb ──────────────────
  const { chartData, officeNames, baselineValue } = useMemo(() => {
    const names = [...new Set(conversion.map((r) => r.office_name || 'Unknown office'))];
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of conversion) {
      if (r.boxes_per_lb == null) continue;
      const d = r.batch_date;
      const row = byDate.get(d) || { date: fmtDate(d) };
      row[r.office_name || 'Unknown office'] = Number(r.boxes_per_lb);
      byDate.set(d, row);
    }
    const baseline = baselines.find((b) => Number(b.baseline_boxes_per_lb) > 0);
    return {
      chartData: [...byDate.values()],
      officeNames: names,
      baselineValue: baseline ? Number(baseline.baseline_boxes_per_lb) : null,
    };
  }, [conversion, baselines]);

  // ── Per office + brand conversion table ──────────────────────────────
  const brandRows = useMemo(() => {
    const map = new Map<string, { office: string; brand: string; lbs: number; boxes: number; batches: number }>();
    for (const r of conversion) {
      const key = `${r.office_name}|${r.brand}`;
      const s = map.get(key) || { office: r.office_name || 'Unknown', brand: r.brand, lbs: 0, boxes: 0, batches: 0 };
      s.lbs += Number(r.tobacco_lbs) || 0;
      s.boxes += Number(r.boxes_equivalent ?? r.boxes_produced) || 0;
      s.batches += 1;
      map.set(key, s);
    }
    const baseline = baselines.find((b) => Number(b.baseline_boxes_per_lb) > 0);
    const bpl0 = baseline ? Number(baseline.baseline_boxes_per_lb) : null;
    return [...map.values()]
      .map((s) => ({ ...s, bpl: s.lbs > 0 ? s.boxes / s.lbs : null, baseline: bpl0 }))
      .sort((a, b) => (a.bpl ?? 0) - (b.bpl ?? 0));
  }, [conversion, baselines]);

  // ── Leakage in plain words ───────────────────────────────────────────
  const leakageSentences = useMemo(() => {
    const out: { key: string; tone: 'red' | 'amber'; office: string; date: string; brand: string; text: string }[] = [];
    for (const l of leakage) {
      const office = l.office_name || 'Unknown office';
      const date = fmtDate(l.batch_date);
      if ((l.variance_stickers ?? 0) > 0) {
        out.push({
          key: `${l.id}-s`, tone: 'red', office, date, brand: l.brand,
          text: `${Number(l.stickers_issued).toLocaleString()} stickers issued, ${Number(l.stickers_used ?? 0).toLocaleString()} used, ${l.boxes_completed} boxes made — ${Number(l.variance_stickers).toLocaleString()} unaccounted.`,
        });
      } else if ((l.variance_stickers ?? 0) < 0) {
        out.push({
          key: `${l.id}-s`, tone: 'amber', office, date, brand: l.brand,
          text: `${Number(l.stickers_used ?? 0).toLocaleString()} stickers used but only ${Number(l.stickers_issued ?? 0).toLocaleString()} recorded as issued — issuance wasn't logged.`,
        });
      }
      if ((l.variance_boxes ?? 0) > 0) {
        out.push({
          key: `${l.id}-b`, tone: 'red', office, date, brand: l.brand,
          text: `${Number(l.empty_boxes_issued).toLocaleString()} empty boxes issued, ${Number(l.empty_boxes_used ?? 0).toLocaleString()} used — ${Number(l.variance_boxes).toLocaleString()} unaccounted.`,
        });
      } else if ((l.variance_boxes ?? 0) < 0) {
        out.push({
          key: `${l.id}-b`, tone: 'amber', office, date, brand: l.brand,
          text: `${Number(l.empty_boxes_used ?? 0).toLocaleString()} empty boxes used but none recorded as issued — issuance wasn't logged.`,
        });
      }
    }
    return out;
  }, [leakage]);

  // ── Output per worker ────────────────────────────────────────────────
  const workerRows = useMemo(() => {
    const map = new Map<string, { name: string; boxes: number; entries: number; defects: number }>();
    for (const l of leakage) {
      if (!l.worker_id) continue;
      const key = l.worker_name || 'Unknown worker';
      const s = map.get(key) || { name: key, boxes: 0, entries: 0, defects: 0 };
      s.boxes += l.boxes_completed || 0;
      s.entries += 1;
      s.defects += l.defects_count || 0;
      map.set(key, s);
    }
    return [...map.values()].sort((a, b) => b.boxes - a.boxes);
  }, [leakage]);

  if (convLoading) {
    return <p className="py-16 text-center text-muted-foreground">Loading intelligence…</p>;
  }

  return (
    <div className="space-y-6">
      {/* ── OUTLIER FLAGS ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Flags — what needs an answer
          </CardTitle>
          <CardDescription>Outliers surfaced in words, so nothing has to be hunted for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Nothing flagged on the current data.
            </p>
          ) : (
            flags.map((f, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm flex items-start gap-2',
                  f.tone === 'red' && 'border-destructive/40 bg-destructive/10 text-destructive',
                  f.tone === 'amber' && 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  f.tone === 'info' && 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {f.tone === 'info' ? <Info className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{f.text}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── OFFICES SIDE BY SIDE — ranked by conversion ──────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Offices side by side — ranked by conversion
        </h2>
        {officeStats.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No production data yet.</CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {officeStats.map((s, idx) => (
              <Card key={s.name} className={cn(idx === 0 && officeStats.length > 1 && 'border-emerald-500/50')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{s.name}</span>
                    <Badge variant={idx === 0 ? 'default' : 'secondary'} className="text-xs">#{idx + 1}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Conversion</span>
                    <span className="font-mono font-semibold">{s.boxesPerLb != null ? `${s.boxesPerLb.toFixed(2)} boxes/lb` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Output</span>
                    <span className="font-mono">{s.boxes.toLocaleString()} boxes · {s.lbs.toLocaleString()} lbs</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cost per box</span>
                    <span className="font-mono">{s.avgCostPerBox != null ? `$${s.avgCostPerBox.toFixed(2)}` : 'no costs recorded'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Unaccounted</span>
                    <span className={cn('font-mono', (s.leakageStickers + s.leakageBoxes) > 0 && 'text-destructive font-semibold')}>
                      {(s.leakageStickers + s.leakageBoxes) > 0
                        ? `${(s.leakageStickers + s.leakageBoxes).toLocaleString()} items`
                        : 'none'}
                    </span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Batches</span>
                    <span className="font-mono">{s.batches}</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── CONVERSION OVER TIME + PER BRAND ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversion over time — boxes per lb, per office</CardTitle>
          <CardDescription>
            {baselineValue != null
              ? `Dashed line: baseline ${baselineValue} boxes/lb.`
              : 'No baseline yet — the comparison line appears once the baseline is calculated.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No conversion data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {baselineValue != null && (
                    <ReferenceLine y={baselineValue} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" label={{ value: 'baseline', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  )}
                  {officeNames.map((name, i) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={OFFICE_COLORS[i % OFFICE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {brandRows.length > 0 && (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Tobacco</TableHead>
                  <TableHead className="text-right">Boxes</TableHead>
                  <TableHead className="text-right">Boxes/lb</TableHead>
                  <TableHead className="text-right">vs baseline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandRows.map((r) => (
                  <TableRow key={`${r.office}-${r.brand}`}>
                    <TableCell>{r.office}</TableCell>
                    <TableCell><Badge variant="outline">{r.brand}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{r.batches}</TableCell>
                    <TableCell className="text-right font-mono">{r.lbs.toLocaleString()} lbs</TableCell>
                    <TableCell className="text-right font-mono">{r.boxes.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{r.bpl != null ? r.bpl.toFixed(2) : '—'}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {r.baseline != null && r.bpl != null
                        ? `${r.bpl >= r.baseline ? '+' : ''}${(((r.bpl - r.baseline) / r.baseline) * 100).toFixed(0)}%`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── LEAKAGE IN PLAIN WORDS ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-destructive" />
            Leakage — material that left the room and did not become product
          </CardTitle>
          <CardDescription>Issued minus used, said out loud. Each sentence is a conversation to have.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {leakageSentences.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              No unaccounted material — issued matches used on every recorded batch.
            </p>
          ) : (
            leakageSentences.map((s) => (
              <div
                key={s.key}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm',
                  s.tone === 'red' ? 'border-destructive/40 bg-destructive/10' : 'border-amber-500/40 bg-amber-500/10',
                )}
              >
                <span className="font-medium">{s.office}</span>
                <span className="text-muted-foreground"> · {s.date} · </span>
                <Badge variant="outline" className="text-[10px] mx-1">{s.brand}</Badge>
                <span> — {s.text}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── COST PER BOX & MARGIN — the pricing floor ────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Cost per box &amp; margin — the pricing floor
          </CardTitle>
          <CardDescription>What a box costs to make, and the margin at wholesale and retail.</CardDescription>
        </CardHeader>
        <CardContent>
          {margins.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No batches to cost yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Boxes</TableHead>
                  <TableHead className="text-right">Cost/box</TableHead>
                  <TableHead className="text-right">Wholesale</TableHead>
                  <TableHead className="text-right">Margin WS</TableHead>
                  <TableHead className="text-right">Retail</TableHead>
                  <TableHead className="text-right">Margin RT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {margins.map((m) => (
                  <TableRow key={m.batch_id}>
                    <TableCell>{m.office_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{m.brand}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(m.batch_date)}</TableCell>
                    <TableCell className="text-right font-mono">{m.boxes_produced}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {m.cost_per_box != null ? `$${Number(m.cost_per_box).toFixed(2)}` : <span className="text-muted-foreground font-normal">no cost recorded</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.wholesale_price_per_box != null && Number(m.wholesale_price_per_box) > 0 ? `$${Number(m.wholesale_price_per_box).toFixed(2)}` : '—'}</TableCell>
                    <TableCell className={cn('text-right font-mono', m.margin_pct_wholesale != null && Number(m.margin_pct_wholesale) < 0 && 'text-destructive')}>
                      {m.margin_pct_wholesale != null ? `${Number(m.margin_pct_wholesale).toFixed(0)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.retail_price_per_box != null && Number(m.retail_price_per_box) > 0 ? `$${Number(m.retail_price_per_box).toFixed(2)}` : '—'}</TableCell>
                    <TableCell className={cn('text-right font-mono', m.margin_pct_retail != null && Number(m.margin_pct_retail) < 0 && 'text-destructive')}>
                      {m.margin_pct_retail != null ? `${Number(m.margin_pct_retail).toFixed(0)}%` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── OUTPUT PER WORKER ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Output per worker
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workerRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No worker-attributed output yet — most entries so far don't name a worker.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Boxes</TableHead>
                  <TableHead className="text-right">Defects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerRows.map((w) => (
                  <TableRow key={w.name}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-right font-mono">{w.entries}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{w.boxes.toLocaleString()}</TableCell>
                    <TableCell className={cn('text-right font-mono', w.defects > 0 && 'text-destructive')}>{w.defects}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {conversion.some((r: ConversionRow) => (Number(r.waste_pct) || 0) > 10) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingDown className="h-3 w-3" /> Some batches record &gt;10% waste in lbs — see conversion table for detail.
        </p>
      )}
    </div>
  );
}

export default function OwnerIntelligencePage() {
  const rbac = useProductionRBAC();
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Owner Intelligence
        </h1>
        <p className="text-muted-foreground mt-1">
          Cross-office conversion, cost, margin and leakage. This is the side of the floor an office leader never sees.
        </p>
      </div>
      <ProductionRBACGate currentTier={rbac.tier} requiredTier="admin" resourceName="Owner Intelligence">
        <IntelligenceBody />
      </ProductionRBACGate>
    </div>
  );
}
