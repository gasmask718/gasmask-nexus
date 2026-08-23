/**
 * OFFICE LEADER — TODAY (one screen, no tabs)
 *
 * Built for a person standing in a workspace with a phone.
 * In order: TODAY header → ENTER OUTPUT (big thumb-sized inputs, no modal)
 * → LIVE YIELD (verdict while they type, so a mistake is caught at entry)
 * → WHAT YOU STILL HOLD (material balance, quantities only)
 * → CLOSE THE DAY.
 *
 * RBAC: quantities only. This screen NEVER renders cost per box, material
 * cost, margin, or another office's numbers.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useTodayBatches,
  useCreateBatch,
  useUpdateBatch,
  useRecordOutput,
  useDailyKPIs,
  useCloseDay,
} from '@/hooks/useProductionPortal';
import { useYieldStandards, activeStandardFor } from '@/hooks/useYieldWatch';
import { MaterialBalanceCard } from '@/components/production/MaterialBalanceCard';
import {
  CalendarDays,
  Building2,
  Boxes,
  Scale,
  Lock,
  LockOpen,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

const BRANDS = [
  { id: 'gasmask', label: 'Gasmask', color: 'bg-emerald-500' },
  { id: 'hotmama', label: 'HotMama', color: 'bg-pink-500' },
  { id: 'hotscolati', label: 'Hotscolatti', color: 'bg-amber-500' },
  { id: 'grabba-rus', label: 'GrabbaRus', color: 'bg-purple-500' },
] as const;

type BrandId = (typeof BRANDS)[number]['id'];

interface Props {
  officeId: string;
  officeName: string;
}

interface EntryState {
  tobacco_lbs: string;
  boxes_completed: string;
  tubes_used: string;
  stickers_used: string;
  empty_boxes_used: string;
  defects: string;
}

const EMPTY_ENTRY: EntryState = {
  tobacco_lbs: '',
  boxes_completed: '',
  tubes_used: '',
  stickers_used: '',
  empty_boxes_used: '',
  defects: '',
};

export function OfficeLeaderToday({ officeId, officeName }: Props) {
  const { t } = useTranslation();
  const { data: batches = [] } = useTodayBatches(officeId);
  const { data: kpis } = useDailyKPIs(officeId);
  const { data: standards = [] } = useYieldStandards();
  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();
  const recordOutput = useRecordOutput();
  const closeDay = useCloseDay();

  const [brand, setBrand] = useState<BrandId>('gasmask');
  const [entry, setEntry] = useState<EntryState>(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);

  const isDayClosed = kpis?.isDayClosed || false;

  const setField = (k: keyof EntryState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Digits and one decimal point only — thumb entry on a phone.
    const v = e.target.value.replace(/[^0-9.]/g, '');
    setEntry((prev) => ({ ...prev, [k]: v }));
  };

  const lbs = parseFloat(entry.tobacco_lbs) || 0;
  const boxes = parseInt(entry.boxes_completed) || 0;

  // ── LIVE YIELD — computed on every keystroke ─────────────────────────
  const liveYield = useMemo(() => {
    if (lbs <= 0 || boxes < 0 || entry.boxes_completed === '') return null;
    const bpl = boxes / lbs;
    const std = activeStandardFor(standards, brand);
    if (!std) {
      return { bpl, verdict: 'no_standard' as const, std: null };
    }
    const tol = Number(std.tolerance_pct) || 0;
    const expected = Number(std.expected_boxes_per_lb);
    const low = expected * (1 - tol / 100);
    const high = expected * (1 + tol / 100);
    if (boxes === 0 && lbs > 0) return { bpl, verdict: 'zero' as const, std };
    if (bpl < low) return { bpl, verdict: 'under' as const, std };
    if (bpl > high) return { bpl, verdict: 'over' as const, std };
    return { bpl, verdict: 'within' as const, std };
  }, [lbs, boxes, entry.boxes_completed, standards, brand]);

  const todayBrandBatches = batches.filter((b) => b.brand === brand);

  const handleSave = async () => {
    if (lbs <= 0 && boxes <= 0) {
      toast.error(t('production.enter_something_first'));
      return;
    }
    setSaving(true);
    try {
      // Reuse today's open/in-progress batch for this brand, else create one.
      let batch = todayBrandBatches.find((b) => b.status !== 'completed' && b.status !== 'cancelled');
      if (!batch) {
        batch = (await createBatch.mutateAsync({
          office_id: officeId,
          brand,
          shift_label: format(new Date(), 'a') === 'AM' ? 'Morning' : 'Afternoon',
          tobacco_lbs: lbs,
          tubes_total: parseInt(entry.tubes_used) || 0,
          status: 'in_progress',
        })) as any;
      } else {
        await updateBatch.mutateAsync({
          id: batch.id,
          tobacco_lbs: lbs,
          tubes_total: parseInt(entry.tubes_used) || 0,
        });
      }

      if (boxes > 0 || parseInt(entry.defects) > 0) {
        await recordOutput.mutateAsync({
          batch_id: batch.id,
          brand,
          boxes_completed: boxes,
          tubes_used: parseInt(entry.tubes_used) || 0,
          stickers_used: parseInt(entry.stickers_used) || 0,
          empty_boxes_used: parseInt(entry.empty_boxes_used) || 0,
          defects_count: parseInt(entry.defects) || 0,
        });
      }

      toast.success(t('production.output_saved'));
      setEntry(EMPTY_ENTRY);
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDay = async () => {
    await closeDay.mutateAsync({
      officeId,
      summary: {
        totalBoxes: kpis?.totalBoxes || 0,
        totalTobaccoLbs: kpis?.tobaccoUsed || 0,
        totalTubesUsed: kpis?.tubesUsed || 0,
        totalDefects: kpis?.totalDefects || 0,
        varianceSummary: { tubes: kpis?.tubesVariance || 0 },
      },
    });
  };

  const inputCls = 'h-14 text-center text-2xl font-mono font-semibold';

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* ── 1. TODAY ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-lg font-semibold leading-tight">
                {format(new Date(), 'EEEE, MMMM d')}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {officeName}
              </p>
            </div>
          </div>
          <Badge
            className={cn(
              'text-sm px-3 py-1',
              isDayClosed
                ? 'bg-muted text-muted-foreground'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {isDayClosed ? <Lock className="h-3.5 w-3.5 mr-1" /> : <LockOpen className="h-3.5 w-3.5 mr-1" />}
            {isDayClosed ? t('production.day_closed') : t('production.day_open')}
          </Badge>
        </CardContent>
      </Card>

      {/* ── 2. ENTER OUTPUT ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            {t('production.enter_output')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Brand chips — thumb-sized */}
          <div className="grid grid-cols-4 gap-2">
            {BRANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBrand(b.id)}
                className={cn(
                  'h-12 rounded-lg border-2 font-medium text-sm flex items-center justify-center gap-1.5 transition-colors',
                  brand === b.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background text-muted-foreground',
                )}
              >
                <span className={cn('w-2.5 h-2.5 rounded-full', b.color)} />
                {b.label}
              </button>
            ))}
          </div>

          {/* Big inputs */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('production.tobacco_lbs')}
              </span>
              <Input inputMode="decimal" className={inputCls} value={entry.tobacco_lbs} onChange={setField('tobacco_lbs')} placeholder="0" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('production.boxes_completed')}
              </span>
              <Input inputMode="numeric" className={inputCls} value={entry.boxes_completed} onChange={setField('boxes_completed')} placeholder="0" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('production.tubes_used')}
              </span>
              <Input inputMode="numeric" className={inputCls} value={entry.tubes_used} onChange={setField('tubes_used')} placeholder="0" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('production.stickers_used')}
              </span>
              <Input inputMode="numeric" className={inputCls} value={entry.stickers_used} onChange={setField('stickers_used')} placeholder="0" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('production.empty_boxes_used')}
              </span>
              <Input inputMode="numeric" className={inputCls} value={entry.empty_boxes_used} onChange={setField('empty_boxes_used')} placeholder="0" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('production.defects')}
              </span>
              <Input inputMode="numeric" className={inputCls} value={entry.defects} onChange={setField('defects')} placeholder="0" />
            </label>
          </div>

          {/* ── 3. LIVE YIELD — verdict while they type ──────────────── */}
          {liveYield && (
            <div
              className={cn(
                'rounded-lg border-2 p-4 text-center space-y-1',
                liveYield.verdict === 'within' && 'border-emerald-500 bg-emerald-500/10',
                (liveYield.verdict === 'under' || liveYield.verdict === 'zero') && 'border-destructive bg-destructive/10',
                liveYield.verdict === 'over' && 'border-amber-500 bg-amber-500/10',
                liveYield.verdict === 'no_standard' && 'border-border bg-muted/50',
              )}
            >
              <p className="text-3xl font-mono font-bold">
                {liveYield.bpl.toFixed(2)}
                <span className="text-base font-normal text-muted-foreground ml-2">
                  {t('production.boxes_per_lb')}
                </span>
              </p>
              {liveYield.verdict === 'within' && (
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {t('production.within_tolerance')}
                  {liveYield.std && ` (${t('production.expected')}: ${Number(liveYield.std.expected_boxes_per_lb).toFixed(2)} ±${Number(liveYield.std.tolerance_pct)}%)`}
                </p>
              )}
              {liveYield.verdict === 'under' && (
                <p className="text-sm font-medium text-destructive flex items-center justify-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  {t('production.under_yield_entry')}
                  {liveYield.std && ` (${t('production.expected')}: ${Number(liveYield.std.expected_boxes_per_lb).toFixed(2)})`}
                </p>
              )}
              {liveYield.verdict === 'zero' && (
                <p className="text-sm font-medium text-destructive flex items-center justify-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {t('production.zero_boxes_entry')}
                </p>
              )}
              {liveYield.verdict === 'over' && (
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {t('production.over_yield_entry')}
                  {liveYield.std && ` (${t('production.expected')}: ${Number(liveYield.std.expected_boxes_per_lb).toFixed(2)})`}
                </p>
              )}
              {liveYield.verdict === 'no_standard' && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Minus className="h-4 w-4" />
                  {t('production.no_standard_entry')}
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full h-14 text-lg"
            disabled={saving || isDayClosed}
            onClick={handleSave}
          >
            {saving ? t('production.saving') : t('production.save_output')}
          </Button>

          {/* Today's saved batches for this brand — confirmation, not a ledger */}
          {todayBrandBatches.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('production.entered_today')}
              </p>
              {todayBrandBatches.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                    {b.tobacco_lbs ?? 0} {t('production.lbs')} → {(b as any).boxes_full || b.boxes_produced || 0} {t('production.boxes_lower')}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. WHAT YOU STILL HOLD ───────────────────────────────────── */}
      <MaterialBalanceCard officeId={officeId} />

      {/* ── 5. CLOSE THE DAY ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <Button
            variant={isDayClosed ? 'outline' : 'default'}
            className="w-full h-14 text-lg"
            disabled={isDayClosed || closeDay.isPending}
            onClick={handleCloseDay}
          >
            <Lock className="h-5 w-5 mr-2" />
            {isDayClosed
              ? t('production.day_closed')
              : closeDay.isPending
                ? t('production.saving')
                : t('production.close_the_day')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default OfficeLeaderToday;
