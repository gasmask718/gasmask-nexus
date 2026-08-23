/**
 * OFFICE LEADER — TODAY (Product A: one screen, no tabs)
 *
 * Built for a person standing in a workspace with a phone, at the end of a
 * shift, with ninety seconds and one thumb. They answer four questions:
 *   What did we make today?  → ENTER OUTPUT (the input IS the page)
 *   What did we use?         → the same inputs, with units on every field
 *   What is left in the room?→ WHAT YOU STILL HOLD
 *   Are we done?             → CLOSE THE DAY
 *
 * Design rules honoured here:
 *  - Entry before display. No tab bar, no forecast, no cost, no other office.
 *  - Never a blank grey box: no batch → "No batch open — start today's batch".
 *  - Every field has its unit next to it (boxes / tubes / stickers / lbs).
 *  - Saves confirm in WORDS ("42 boxes recorded for Gasmask. 4,200 tubes
 *    used."), not a toast that says Success.
 *  - One primary action per screen state: start batch → record output →
 *    close day. Never two filled buttons.
 *  - Fully translated EN/ES — a worker who half-understands a form fills
 *    it in wrong.
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
  PackageOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
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

/** What was just saved — rendered back in words, not a toast. */
interface SavedSummary {
  brandLabel: string;
  lbs: number;
  boxes: number;
  tubes: number;
  stickers: number;
  emptyBoxes: number;
  defects: number;
}

export function OfficeLeaderToday({ officeId, officeName }: Props) {
  const { t, language } = useTranslation();
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
  const [savedSummary, setSavedSummary] = useState<SavedSummary | null>(null);

  const isDayClosed = kpis?.isDayClosed || false;
  const hasBatchToday = batches.length > 0;

  const setField = (k: keyof EntryState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Digits and one decimal point only — thumb entry on a phone.
    const v = e.target.value.replace(/[^0-9.]/g, '');
    setEntry((prev) => ({ ...prev, [k]: v }));
    // Editing again means the previous confirmation is stale — clear it and
    // the primary action flips back to Record.
    setSavedSummary(null);
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

      const tubes = parseInt(entry.tubes_used) || 0;
      const stickers = parseInt(entry.stickers_used) || 0;
      const emptyBoxes = parseInt(entry.empty_boxes_used) || 0;
      const defects = parseInt(entry.defects) || 0;

      if (boxes > 0 || defects > 0) {
        await recordOutput.mutateAsync({
          batch_id: batch.id,
          brand,
          boxes_completed: boxes,
          tubes_used: tubes,
          stickers_used: stickers,
          empty_boxes_used: emptyBoxes,
          defects_count: defects,
        });
      }

      // Confirm in words — this stays on screen until they edit again.
      setSavedSummary({
        brandLabel: BRANDS.find((b) => b.id === brand)?.label || brand,
        lbs,
        boxes,
        tubes,
        stickers,
        emptyBoxes,
        defects,
      });
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

  const dateStr =
    language === 'es'
      ? format(new Date(), "EEEE d 'de' MMMM", { locale: esLocale })
      : format(new Date(), 'EEEE, MMMM d');

  const statusLabel = (s: string | null | undefined) => {
    const key = `production.status_${s || 'open'}`;
    const translated = t(key);
    return translated === key ? (s || 'open') : translated;
  };

  // One primary action per screen state:
  //   no batch yet      → "Start today's batch" is the only primary
  //   batch open        → "Record output" primary, Close Day outline
  //   just saved        → "Close the Day" primary, record flips to outline
  //   day closed        → nothing primary, everything locked
  const saveIsPrimary = !savedSummary;
  const saveLabel = !hasBatchToday
    ? t('production.start_todays_batch')
    : savedSummary
      ? t('production.record_more_output')
      : t('production.record_output');

  const inputCls = 'h-14 text-center text-2xl font-mono font-semibold pr-16';

  const UnitInput = ({
    label,
    unit,
    value,
    onChange,
    decimal = false,
  }: {
    label: string;
    unit: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    decimal?: boolean;
  }) => (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="relative block">
        <Input
          inputMode={decimal ? 'decimal' : 'numeric'}
          className={inputCls}
          value={value}
          onChange={onChange}
          placeholder="0"
          disabled={isDayClosed}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
          {unit}
        </span>
      </span>
    </label>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* ── 1. TODAY ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-lg font-semibold leading-tight capitalize">{dateStr}</p>
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
          {/* Never a blank grey box — say what to do, button right below */}
          {!hasBatchToday && !isDayClosed && (
            <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 flex items-center gap-3">
              <PackageOpen className="h-8 w-8 text-primary shrink-0" />
              <p className="text-sm font-medium">{t('production.no_batch_open')}</p>
            </div>
          )}

          {/* Brand chips — thumb-sized */}
          <div className="grid grid-cols-4 gap-2">
            {BRANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={isDayClosed}
                onClick={() => {
                  setBrand(b.id);
                  setSavedSummary(null);
                }}
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

          {/* Big inputs — every field carries its unit */}
          <div className="grid grid-cols-2 gap-3">
            <UnitInput label={t('production.tobacco_lbs')} unit={t('production.unit_lbs')} value={entry.tobacco_lbs} onChange={setField('tobacco_lbs')} decimal />
            <UnitInput label={t('production.boxes_completed')} unit={t('production.unit_boxes')} value={entry.boxes_completed} onChange={setField('boxes_completed')} />
            <UnitInput label={t('production.tubes_used')} unit={t('production.unit_tubes')} value={entry.tubes_used} onChange={setField('tubes_used')} />
            <UnitInput label={t('production.stickers_used')} unit={t('production.unit_stickers')} value={entry.stickers_used} onChange={setField('stickers_used')} />
            <UnitInput label={t('production.empty_boxes_used')} unit={t('production.unit_boxes')} value={entry.empty_boxes_used} onChange={setField('empty_boxes_used')} />
            <UnitInput label={t('production.defects')} unit={t('production.unit_defects')} value={entry.defects} onChange={setField('defects')} />
          </div>

          {/* ── 3. LIVE YIELD — verdict while they type ──────────────── */}
          {liveYield && !isDayClosed && (
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

          {/* Confirmation in WORDS — stays until they edit again */}
          {savedSummary && (
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-4 space-y-1">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" />
                {savedSummary.boxes > 0
                  ? t('production.saved_boxes', { count: savedSummary.boxes.toLocaleString(), brand: savedSummary.brandLabel })
                  : t('production.saved_tobacco', { count: savedSummary.lbs.toLocaleString() })}
              </p>
              {savedSummary.tubes > 0 && (
                <p className="text-sm text-emerald-600/90 dark:text-emerald-400/90 pl-6">
                  {t('production.saved_tubes', { count: savedSummary.tubes.toLocaleString() })}
                </p>
              )}
              {savedSummary.stickers > 0 && (
                <p className="text-sm text-emerald-600/90 dark:text-emerald-400/90 pl-6">
                  {t('production.saved_stickers', { count: savedSummary.stickers.toLocaleString() })}
                </p>
              )}
              {savedSummary.defects > 0 && (
                <p className="text-sm text-emerald-600/90 dark:text-emerald-400/90 pl-6">
                  {t('production.saved_defects', { count: savedSummary.defects.toLocaleString() })}
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full h-14 text-lg"
            variant={saveIsPrimary ? 'default' : 'outline'}
            disabled={saving || isDayClosed}
            onClick={handleSave}
          >
            {saving ? t('production.saving') : saveLabel}
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
                  <Badge variant="outline" className="text-[10px]">{statusLabel(b.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. WHAT YOU STILL HOLD ───────────────────────────────────── */}
      <MaterialBalanceCard officeId={officeId} />

      {/* ── 5. CLOSE THE DAY ─────────────────────────────────────────── */}
      {hasBatchToday && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Button
              variant={isDayClosed ? 'outline' : savedSummary ? 'default' : 'outline'}
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
            {!isDayClosed && (
              <p className="text-xs text-center text-muted-foreground">
                {t('production.close_day_hint')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OfficeLeaderToday;
