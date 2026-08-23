/**
 * YIELD INTELLIGENCE HOOKS
 *
 * Reads the owner-built yield data layer:
 *   - yield_standards  — what a pound SHOULD produce, per brand (owner sets this)
 *   - v_yield_watch    — every batch measured against its standard, with verdict
 *   - v_batch_yield    — raw per-batch ratios (boxes/lb, lbs/box, boxes/100 tubes)
 *
 * The verdict ranking is deliberate: the worst rows sort first so the owner
 * sees the six-fold spread (0.33 → 2.0 boxes/lb on the same brand) without
 * hunting for it.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface YieldStandard {
  id: string;
  brand: string;
  tube_size: string | null;
  expected_boxes_per_lb: number;
  tolerance_pct: number;
  set_by: string | null;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
  created_at: string;
}

export interface YieldWatchRow {
  batch_id: string;
  office_id: string;
  office: string;
  batch_date: string;
  brand: string;
  status: string;
  tobacco_lbs: number;
  boxes_produced: number;
  tubes_total: number;
  waste_lbs: number;
  tube_size: string | null;
  actual_bpl: number | null;
  expected_bpl: number | null;
  tolerance: number | null;
  boxes_per_lb: number | null;
  boxes_expected: number | null;
  boxes_short_or_over: number | null;
  verdict: string;
}

export interface BatchYieldRow {
  batch_id: string;
  office_id: string;
  office: string;
  batch_date: string;
  brand: string;
  status: string;
  tobacco_lbs: number;
  boxes_produced: number;
  tubes_total: number;
  waste_lbs: number;
  boxes_per_lb: number | null;
  lbs_per_box: number | null;
  boxes_per_100_tubes: number | null;
}

/** Verdict severity — lower sorts first ("worst verdict first"). */
export function verdictRank(verdict: string): number {
  const v = (verdict || '').toUpperCase();
  if (v.includes('ZERO BOXES')) return 0;
  if (v.includes('UNDER YIELD')) return 1;
  if (v.includes('OVER YIELD')) return 2;
  if (v.includes('NO STANDARD')) return 3;
  return 4; // within tolerance
}

export type VerdictTone = 'destructive' | 'warning' | 'muted' | 'ok';

export function verdictTone(verdict: string): VerdictTone {
  const r = verdictRank(verdict);
  if (r === 0) return 'destructive';
  if (r === 1) return 'destructive';
  if (r === 2) return 'warning';
  if (r === 3) return 'muted';
  return 'ok';
}

export function useYieldStandards() {
  return useQuery({
    queryKey: ['yield-standards'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('yield_standards')
        .select('*')
        .order('brand', { ascending: true })
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return (data || []) as YieldStandard[];
    },
  });
}

/** The standard currently in force for a brand (latest effective_from, not expired). */
export function activeStandardFor(
  standards: YieldStandard[],
  brand: string,
  onDate?: string,
): YieldStandard | undefined {
  const d = onDate || new Date().toISOString().slice(0, 10);
  return standards
    .filter(
      (s) =>
        s.brand === brand &&
        s.effective_from <= d &&
        (!s.effective_to || s.effective_to >= d),
    )
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
}

export function useSetYieldStandard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      brand: string;
      expected_boxes_per_lb: number;
      tolerance_pct: number;
      note?: string | null;
      effective_from?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from('yield_standards')
        .insert({
          brand: input.brand,
          expected_boxes_per_lb: input.expected_boxes_per_lb,
          tolerance_pct: input.tolerance_pct,
          note: input.note || null,
          effective_from: input.effective_from || new Date().toISOString().slice(0, 10),
          set_by: userData.user?.email || userData.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as YieldStandard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yield-standards'] });
      queryClient.invalidateQueries({ queryKey: ['yield-watch'] });
      toast({ title: 'Yield standard saved — every batch for this brand is now measured against it.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save standard', description: error.message, variant: 'destructive' });
    },
  });
}

export function useYieldWatch() {
  return useQuery({
    queryKey: ['yield-watch'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_yield_watch')
        .select('*');
      if (error) throw error;
      const rows = (data || []) as YieldWatchRow[];
      // Worst verdict first, then lowest boxes/lb, then newest date.
      return rows.sort((a, b) => {
        const r = verdictRank(a.verdict) - verdictRank(b.verdict);
        if (r !== 0) return r;
        const bpl = (a.boxes_per_lb ?? 999) - (b.boxes_per_lb ?? 999);
        if (bpl !== 0) return bpl;
        return (b.batch_date || '').localeCompare(a.batch_date || '');
      });
    },
  });
}

export function useBatchYield(officeId?: string) {
  return useQuery({
    queryKey: ['batch-yield', officeId || 'all'],
    queryFn: async () => {
      let q = (supabase as any).from('v_batch_yield').select('*');
      if (officeId) q = q.eq('office_id', officeId);
      const { data, error } = await q.order('batch_date', { ascending: false });
      if (error) throw error;
      return (data || []) as BatchYieldRow[];
    },
  });
}

export interface SupplierLotYield {
  supplier_id: string | null;
  lot: string;
  batches: number;
  tobacco_lbs: number;
  boxes_produced: number;
  boxes_per_lb: number | null;
}

/**
 * Per-supplier-lot yield. Lots are only known when intake recorded
 * supplier_batch_reference on the batch — most legacy batches have none,
 * and the UI says so rather than inventing a lot.
 */
export function useSupplierLotYield() {
  return useQuery({
    queryKey: ['supplier-lot-yield'],
    queryFn: async () => {
      const { data: batches, error } = await (supabase as any)
        .from('production_batches')
        .select('id, supplier_id, supplier_batch_reference, tobacco_lbs, boxes_produced')
        .not('supplier_batch_reference', 'is', null);
      if (error) throw error;

      const lots = new Map<string, SupplierLotYield>();
      for (const b of batches || []) {
        const key = `${b.supplier_id || 'unknown'}::${b.supplier_batch_reference}`;
        const cur = lots.get(key) || {
          supplier_id: b.supplier_id,
          lot: b.supplier_batch_reference,
          batches: 0,
          tobacco_lbs: 0,
          boxes_produced: 0,
          boxes_per_lb: null,
        };
        cur.batches += 1;
        cur.tobacco_lbs += Number(b.tobacco_lbs) || 0;
        cur.boxes_produced += Number(b.boxes_produced) || 0;
        lots.set(key, cur);
      }
      const out = Array.from(lots.values());
      for (const l of out) {
        l.boxes_per_lb = l.tobacco_lbs > 0 ? l.boxes_produced / l.tobacco_lbs : null;
      }
      return out.sort((a, b) => (a.boxes_per_lb ?? 999) - (b.boxes_per_lb ?? 999));
    },
  });
}
