/**
 * OWNER'S YIELD SCREEN — /portals/production/yield-watch
 *
 * Reads v_yield_watch, ordered worst verdict first. The number this
 * business turns on is boxes per pound — the live data shows a SIX-FOLD
 * spread (0.33 → 2.0) on the same brand, and one completed batch that
 * consumed 20 lbs and produced zero boxes. This page exists so that
 * can never be invisible again.
 *
 * Above the table: SET THE STANDARD per brand. Until a standard exists
 * every row reads 'NO STANDARD SET' and the page is inert — so setting
 * it is the obvious first action.
 *
 * RBAC: admin/owner only (wraps everything in ProductionRBACGate).
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductionRBACGate } from '@/components/production/ProductionRBACGate';
import { useProductionRBAC } from '@/hooks/useProductionRBAC';
import {
  useYieldStandards,
  useSetYieldStandard,
  useYieldWatch,
  useSupplierLotYield,
  verdictRank,
  activeStandardFor,
} from '@/hooks/useYieldWatch';
import { Scale, AlertTriangle, CheckCircle, Settings2, Building2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';

const BRANDS = ['gasmask', 'hotmama', 'hotscolati', 'grabba-rus'];

function VerdictBadge({ verdict }: { verdict: string }) {
  const rank = verdictRank(verdict);
  const cls =
    rank === 0
      ? 'bg-red-600 text-white'
      : rank === 1
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
        : rank === 2
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
          : rank === 3
            ? 'bg-muted text-muted-foreground'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  return <Badge className={cn('text-[10px] whitespace-nowrap', cls)}>{verdict}</Badge>;
}

function StandardSetter() {
  const { t } = useTranslation();
  const { data: standards = [] } = useYieldStandards();
  const setStandard = useSetYieldStandard();
  const [form, setForm] = useState<Record<string, { expected: string; tolerance: string }>>({});

  const get = (brand: string) => form[brand] || { expected: '', tolerance: '' };
  const set = (brand: string, patch: Partial<{ expected: string; tolerance: string }>) =>
    setForm((prev) => ({ ...prev, [brand]: { ...get(brand), ...patch } }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          {t('production.set_standard_title')}
        </CardTitle>
        <CardDescription>{t('production.set_standard_why')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {BRANDS.map((brand) => {
          const current = activeStandardFor(standards, brand);
          const f = get(brand);
          return (
            <div key={brand} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <div>
                <p className="font-medium capitalize">{brand.replace('-', ' ')}</p>
                {current ? (
                  <p className="text-xs text-muted-foreground">
                    {t('production.current_standard', {
                      expected: Number(current.expected_boxes_per_lb).toFixed(2),
                      tolerance: Number(current.tolerance_pct),
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {t('production.no_standard_set')}
                  </p>
                )}
              </div>
              <Input
                className="w-24 h-9 text-right font-mono"
                inputMode="decimal"
                placeholder={t('production.boxes_per_lb')}
                value={f.expected}
                onChange={(e) => set(brand, { expected: e.target.value.replace(/[^0-9.]/g, '') })}
              />
              <Input
                className="w-20 h-9 text-right font-mono"
                inputMode="numeric"
                placeholder="± %"
                value={f.tolerance}
                onChange={(e) => set(brand, { tolerance: e.target.value.replace(/[^0-9.]/g, '') })}
              />
              <Button
                size="sm"
                disabled={!parseFloat(f.expected) || !f.tolerance || setStandard.isPending}
                onClick={() =>
                  setStandard.mutate({
                    brand,
                    expected_boxes_per_lb: parseFloat(f.expected),
                    tolerance_pct: parseFloat(f.tolerance),
                  })
                }
              >
                {t('production.save')}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function YieldWatchPage() {
  const { t } = useTranslation();
  const rbac = useProductionRBAC();
  const { data: standards = [], isLoading: standardsLoading } = useYieldStandards();
  const { data: rows = [], isLoading } = useYieldWatch();
  const { data: lots = [] } = useSupplierLotYield();

  const hasStandards = standards.length > 0;

  // Per-office rollup — which office wastes.
  const officeRollup = useMemo(() => {
    const map = new Map<string, { office: string; batches: number; lbs: number; boxes: number; bad: number }>();
    for (const r of rows) {
      const cur = map.get(r.office_id) || { office: r.office, batches: 0, lbs: 0, boxes: 0, bad: 0 };
      cur.batches += 1;
      cur.lbs += Number(r.tobacco_lbs) || 0;
      cur.boxes += Number(r.boxes_produced) || 0;
      if (verdictRank(r.verdict) <= 1) cur.bad += 1;
      map.set(r.office_id, cur);
    }
    return Array.from(map.values())
      .map((o) => ({ ...o, bpl: o.lbs > 0 ? o.boxes / o.lbs : null }))
      .sort((a, b) => (a.bpl ?? 999) - (b.bpl ?? 999));
  }, [rows]);

  return (
    <ProductionRBACGate currentTier={rbac.tier} requiredTier="admin" resourceName="Yield Watch">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            {t('production.yield_watch_title')}
          </h1>
          <p className="text-muted-foreground">{t('production.yield_watch_subtitle')}</p>
        </div>

        {/* The obvious first action when no standard exists */}
        {!standardsLoading && !hasStandards && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  {t('production.set_standard_first')}
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t('production.set_standard_first_why')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <StandardSetter />

        {/* Per-office rollup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {t('production.yield_by_office')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {officeRollup.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('production.no_batches_yet')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {officeRollup.map((o) => (
                  <div key={o.office} className="rounded-lg border p-3">
                    <p className="font-medium text-sm">{o.office}</p>
                    <p className="text-2xl font-mono font-bold">
                      {o.bpl != null ? o.bpl.toFixed(2) : '—'}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        {t('production.boxes_per_lb')}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.batches} {t('production.batches').toLowerCase()}
                      {o.bad > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {' '}· {o.bad} {t('production.flagged')}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per supplier lot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {t('production.yield_by_lot')}
            </CardTitle>
            <CardDescription>{t('production.yield_by_lot_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('production.no_lots_recorded')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('production.lot')}</TableHead>
                    <TableHead className="text-right">{t('production.batches')}</TableHead>
                    <TableHead className="text-right">{t('production.tobacco_lbs')}</TableHead>
                    <TableHead className="text-right">{t('production.boxes')}</TableHead>
                    <TableHead className="text-right">{t('production.boxes_per_lb')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((l) => (
                    <TableRow key={`${l.supplier_id}-${l.lot}`}>
                      <TableCell className="font-medium">{l.lot}</TableCell>
                      <TableCell className="text-right font-mono">{l.batches}</TableCell>
                      <TableCell className="text-right font-mono">{l.tobacco_lbs.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono">{l.boxes_produced}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {l.boxes_per_lb != null ? l.boxes_per_lb.toFixed(2) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* The watch table — worst first */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              {t('production.yield_watch_table')}
            </CardTitle>
            <CardDescription>{t('production.yield_watch_table_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('production.loading')}</p>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('production.no_batches_yet')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('production.office')}</TableHead>
                      <TableHead>{t('production.date')}</TableHead>
                      <TableHead>{t('production.brand')}</TableHead>
                      <TableHead className="text-right">{t('production.tobacco_lbs')}</TableHead>
                      <TableHead className="text-right">{t('production.boxes')}</TableHead>
                      <TableHead className="text-right">{t('production.boxes_per_lb')}</TableHead>
                      <TableHead className="text-right">{t('production.expected')}</TableHead>
                      <TableHead className="text-right">{t('production.short_over')}</TableHead>
                      <TableHead>{t('production.verdict')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const rank = verdictRank(r.verdict);
                      return (
                        <TableRow
                          key={r.batch_id}
                          className={cn(
                            rank === 0 && 'bg-red-50 dark:bg-red-950/30',
                            rank === 1 && 'bg-red-50/60 dark:bg-red-950/20',
                            rank === 2 && 'bg-amber-50/60 dark:bg-amber-950/20',
                          )}
                        >
                          <TableCell className="font-medium">{r.office}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {r.batch_date ? format(new Date(r.batch_date), 'MMM d, yyyy') : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{r.brand}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{Number(r.tobacco_lbs || 0).toFixed(1)}</TableCell>
                          <TableCell className="text-right font-mono">{r.boxes_produced ?? 0}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {r.boxes_per_lb != null ? Number(r.boxes_per_lb).toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {r.boxes_expected != null ? Number(r.boxes_expected).toFixed(1) : '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-mono',
                              (r.boxes_short_or_over ?? 0) < 0 && 'text-red-600 dark:text-red-400 font-semibold',
                              (r.boxes_short_or_over ?? 0) > 0 && 'text-amber-600 dark:text-amber-400',
                            )}
                          >
                            {r.boxes_short_or_over != null
                              ? `${r.boxes_short_or_over > 0 ? '+' : ''}${Number(r.boxes_short_or_over).toFixed(1)}`
                              : '—'}
                          </TableCell>
                          <TableCell><VerdictBadge verdict={r.verdict} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProductionRBACGate>
  );
}
