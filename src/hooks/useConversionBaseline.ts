/**
 * useConversionBaseline — Fetches the production conversion baseline
 * for variance detection and projection accuracy.
 * Now product-type aware (tubes vs bags).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductType } from './useProductionPortal';

export interface ConversionBaseline {
  id: string;
  office_id: string | null;
  product_type: string;
  baseline_boxes_per_lb: number;
  baseline_lbs_per_box: number;
  baseline_units_per_lb: number;
  baseline_lbs_per_unit: number;
  baseline_time_per_unit: number | null;
  baseline_time_per_box: number | null;
  calculated_from_batch_count: number;
  last_updated_at: string;
}

export function useConversionBaseline(officeId?: string, productType?: ProductType) {
  return useQuery({
    queryKey: ['conversion-baseline', officeId, productType],
    queryFn: async () => {
      let query = supabase
        .from('production_conversion_baseline' as any)
        .select('*')
        .order('last_updated_at', { ascending: false });

      if (productType) {
        query = query.eq('product_type', productType);
      }

      const { data, error } = await query;
      if (error) throw error;

      const all = (data || []) as unknown as ConversionBaseline[];
      const global = all.find(b => b.office_id === null) || null;
      const office = officeId ? all.find(b => b.office_id === officeId) || null : null;
      const active = office || global;

      return { global, office, active, all };
    },
  });
}

/**
 * Compute variance level for a batch against baseline (product-aware)
 */
export function getVarianceLevel(batchUnitsPerLb: number, baselineUnitsPerLb: number): {
  level: 'normal' | 'moderate' | 'high';
  pct: number;
  color: string;
  label: string;
} {
  if (baselineUnitsPerLb <= 0) {
    return { level: 'normal', pct: 0, color: 'text-muted-foreground', label: 'No baseline' };
  }

  const pct = Math.abs(((batchUnitsPerLb - baselineUnitsPerLb) / baselineUnitsPerLb) * 100);
  const rounded = Math.round(pct * 100) / 100;

  if (pct > 8) {
    return { level: 'high', pct: rounded, color: 'text-destructive', label: 'High Variance Alert' };
  }
  if (pct > 5) {
    return { level: 'moderate', pct: rounded, color: 'text-hud-amber', label: 'Moderate Variance' };
  }
  return { level: 'normal', pct: rounded, color: 'text-hud-green', label: 'Within Range' };
}

/**
 * Compute time variance against baseline
 */
export function getTimeVarianceLevel(batchTimePerUnit: number, baselineTimePerUnit: number): {
  level: 'normal' | 'slow' | 'critical';
  pct: number;
  color: string;
  label: string;
} {
  if (baselineTimePerUnit <= 0) {
    return { level: 'normal', pct: 0, color: 'text-muted-foreground', label: 'No baseline' };
  }

  const ratio = batchTimePerUnit / baselineTimePerUnit;
  const pct = Math.round((ratio - 1) * 10000) / 100;

  if (ratio > 1.15) {
    return { level: 'critical', pct, color: 'text-destructive', label: 'Production Slowdown' };
  }
  if (ratio > 1.05) {
    return { level: 'slow', pct, color: 'text-hud-amber', label: 'Slightly Slow' };
  }
  return { level: 'normal', pct, color: 'text-hud-green', label: 'On Pace' };
}
