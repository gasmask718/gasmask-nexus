/**
 * useConversionBaseline — Fetches the production conversion baseline
 * for variance detection and projection accuracy.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversionBaseline {
  id: string;
  office_id: string | null;
  baseline_boxes_per_lb: number;
  baseline_lbs_per_box: number;
  calculated_from_batch_count: number;
  last_updated_at: string;
}

export function useConversionBaseline(officeId?: string) {
  return useQuery({
    queryKey: ['conversion-baseline', officeId],
    queryFn: async () => {
      // Fetch both global and office-specific baseline
      const { data, error } = await supabase
        .from('production_conversion_baseline' as any)
        .select('*')
        .order('last_updated_at', { ascending: false });

      if (error) throw error;

      const all = (data || []) as unknown as ConversionBaseline[];
      const global = all.find(b => b.office_id === null) || null;
      const office = officeId ? all.find(b => b.office_id === officeId) || null : null;

      // Use office baseline if available, else global
      const active = office || global;

      return { global, office, active, all };
    },
  });
}

/**
 * Compute variance level for a batch against baseline
 */
export function getVarianceLevel(batchBoxesPerLb: number, baselineBoxesPerLb: number): {
  level: 'normal' | 'moderate' | 'high';
  pct: number;
  color: string;
  label: string;
} {
  if (baselineBoxesPerLb <= 0) {
    return { level: 'normal', pct: 0, color: 'text-muted-foreground', label: 'No baseline' };
  }

  const pct = Math.abs(((batchBoxesPerLb - baselineBoxesPerLb) / baselineBoxesPerLb) * 100);
  const rounded = Math.round(pct * 100) / 100;

  if (pct > 8) {
    return { level: 'high', pct: rounded, color: 'text-destructive', label: 'High Variance Alert' };
  }
  if (pct > 5) {
    return { level: 'moderate', pct: rounded, color: 'text-hud-amber', label: 'Moderate Variance' };
  }
  return { level: 'normal', pct: rounded, color: 'text-hud-green', label: 'Within Range' };
}
