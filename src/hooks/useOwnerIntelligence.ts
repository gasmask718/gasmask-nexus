/**
 * OWNER INTELLIGENCE — data hooks for Product B (the owner's side of the
 * production floor). Cross-office, cost, margin, conversion, leakage.
 *
 * These views/tables are RLS-enforced: office leaders get nothing or only
 * their own office; these hooks are only mounted on admin-gated screens.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversionRow {
  batch_id: string;
  office_id: string;
  office_name: string | null;
  brand: string;
  batch_date: string;
  tobacco_lbs: number;
  boxes_produced: number;
  boxes_equivalent: number | null;
  boxes_per_lb: number | null;
  lbs_per_box: number | null;
  waste_lbs: number | null;
  waste_pct: number | null;
  cost_per_box: number | null;
  total_cost: number | null;
}

export interface MarginRow {
  batch_id: string;
  office_id: string;
  office_name: string | null;
  brand: string;
  batch_date: string;
  boxes_produced: number;
  total_material_cost: number | null;
  labor_cost: number | null;
  overhead_cost: number | null;
  total_cost: number | null;
  cost_per_box: number | null;
  wholesale_price_per_box: number | null;
  retail_price_per_box: number | null;
  margin_pct_wholesale: number | null;
  margin_pct_retail: number | null;
}

export interface LeakageRow {
  id: string;
  batch_id: string;
  brand: string;
  boxes_completed: number;
  tubes_used: number;
  stickers_issued: number | null;
  stickers_used: number | null;
  variance_stickers: number | null;
  empty_boxes_issued: number | null;
  empty_boxes_used: number | null;
  variance_boxes: number | null;
  defects_count: number | null;
  worker_id: string | null;
  created_at: string;
  office_id: string | null;
  office_name: string | null;
  batch_date: string | null;
  worker_name: string | null;
}

export interface ConversionBaseline {
  id: string;
  office_id: string | null;
  product_type: string | null;
  baseline_boxes_per_lb: number | null;
  baseline_lbs_per_box: number | null;
  calculated_from_batch_count: number | null;
}

export function useConversionRows() {
  return useQuery({
    queryKey: ['owner-intel-conversion'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_tobacco_conversion_intelligence')
        .select('batch_id, office_id, office_name, brand, batch_date, tobacco_lbs, boxes_produced, boxes_equivalent, boxes_per_lb, lbs_per_box, waste_lbs, waste_pct, cost_per_box, total_cost')
        .order('batch_date', { ascending: true });
      if (error) throw error;
      return (data || []) as ConversionRow[];
    },
  });
}

export function useMarginRows() {
  return useQuery({
    queryKey: ['owner-intel-margin'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_production_margin_analysis')
        .select('*')
        .order('batch_date', { ascending: false });
      if (error) throw error;
      return (data || []) as MarginRow[];
    },
  });
}

export function useConversionBaselines() {
  return useQuery({
    queryKey: ['owner-intel-baselines'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('production_conversion_baseline')
        .select('*');
      if (error) throw error;
      return (data || []) as ConversionBaseline[];
    },
  });
}

/**
 * Leakage = material that left the room and did not become product.
 * Joins outputs → batch → office → worker client-side (small tables).
 */
export function useLeakageRows() {
  return useQuery({
    queryKey: ['owner-intel-leakage'],
    queryFn: async () => {
      const [outputsRes, batchesRes, officesRes, workersRes] = await Promise.all([
        (supabase as any)
          .from('production_batch_outputs')
          .select('id, batch_id, brand, boxes_completed, tubes_used, stickers_issued, stickers_used, variance_stickers, empty_boxes_issued, empty_boxes_used, variance_boxes, defects_count, worker_id, created_at')
          .order('created_at', { ascending: false }),
        (supabase as any).from('production_batches').select('id, office_id, batch_date'),
        (supabase as any).from('production_offices').select('id, name'),
        (supabase as any).from('production_workers').select('id, name'),
      ]);
      if (outputsRes.error) throw outputsRes.error;
      const batchMap = new Map((batchesRes.data || []).map((b: any) => [b.id, b]));
      const officeMap = new Map((officesRes.data || []).map((o: any) => [o.id, o.name]));
      const workerMap = new Map((workersRes.data || []).map((w: any) => [w.id, w.name]));
      return ((outputsRes.data || []) as any[]).map((o) => {
        const batch = batchMap.get(o.batch_id);
        return {
          ...o,
          office_id: batch?.office_id ?? null,
          office_name: batch ? (officeMap.get(batch.office_id) ?? null) : null,
          batch_date: batch?.batch_date ?? null,
          worker_name: o.worker_id ? (workerMap.get(o.worker_id) ?? null) : null,
        } as LeakageRow;
      });
    },
  });
}
