/**
 * useSupplierYieldIntelligence — Fetches supplier-level yield rankings
 * from v_supplier_yield_intelligence for procurement decisions.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierYield {
  supplier_id: string;
  supplier_name: string;
  total_lbs_supplied: number;
  total_boxes_produced: number;
  avg_boxes_per_lb: number;
  avg_lbs_per_box: number;
  avg_waste_pct: number;
  batch_count: number;
  variance_frequency: number;
  yield_stability_score: number;
  stddev_boxes_per_lb: number | null;
  avg_boxes_per_lb_30d: number | null;
  batch_count_30d: number;
  first_batch_date: string | null;
  last_batch_date: string | null;
  global_avg_boxes_per_lb: number;
  efficiency_score: number;
  baseline_band: 'above' | 'within' | 'below';
  trend_direction: 'improving' | 'declining' | 'stable' | 'no_data';
  yield_rank: number;
}

export function useSupplierYieldIntelligence() {
  return useQuery({
    queryKey: ['supplier-yield-intelligence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_supplier_yield_intelligence' as any)
        .select('*')
        .order('avg_boxes_per_lb', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SupplierYield[];
    },
  });
}
