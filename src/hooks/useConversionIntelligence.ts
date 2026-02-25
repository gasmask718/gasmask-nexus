/**
 * useConversionIntelligence — Fetches tobacco conversion data from the view
 * and computes rolling averages, deviation alerts, and admin-level KPIs.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversionBatch {
  batch_id: string;
  office_id: string | null;
  brand: string;
  batch_date: string | null;
  tobacco_lbs: number;
  boxes_produced: number | null;
  waste_lbs: number | null;
  tubes_total: number | null;
  status: string | null;
  inventory_state: string;
  is_locked: boolean | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
  lbs_per_box: number | null;
  boxes_per_lb: number | null;
  waste_pct: number | null;
  total_cost: number | null;
  cost_per_box: number | null;
  office_name: string | null;
}

export interface ConversionStats {
  totalLbs: number;
  totalBoxes: number;
  globalAvgLbsPerBox: number;
  globalAvgBoxesPerLb: number;
  avgWastePct: number;
  avgCostPerBox: number | null;
  batchCount: number;
  bestBatch: ConversionBatch | null;
  worstBatch: ConversionBatch | null;
  rolling7: {
    avgLbsPerBox: number;
    avgBoxesPerLb: number;
    deviationPct: number;
  };
  efficiencyScore: number;
}

function computeStats(batches: ConversionBatch[]): ConversionStats {
  const valid = batches.filter(b => b.lbs_per_box !== null && b.boxes_per_lb !== null);
  
  const totalLbs = batches.reduce((s, b) => s + (b.tobacco_lbs || 0), 0);
  const totalBoxes = batches.reduce((s, b) => s + (b.boxes_produced || 0), 0);
  
  const globalAvgLbsPerBox = totalBoxes > 0 ? totalLbs / totalBoxes : 0;
  const globalAvgBoxesPerLb = totalLbs > 0 ? totalBoxes / totalLbs : 0;
  
  const wasteEntries = batches.filter(b => b.waste_pct !== null);
  const avgWastePct = wasteEntries.length > 0
    ? wasteEntries.reduce((s, b) => s + (b.waste_pct || 0), 0) / wasteEntries.length
    : 0;
  
  const costEntries = batches.filter(b => b.cost_per_box !== null);
  const avgCostPerBox = costEntries.length > 0
    ? costEntries.reduce((s, b) => s + (b.cost_per_box || 0), 0) / costEntries.length
    : null;

  // Best/worst by boxes_per_lb
  let bestBatch: ConversionBatch | null = null;
  let worstBatch: ConversionBatch | null = null;
  for (const b of valid) {
    if (!bestBatch || (b.boxes_per_lb || 0) > (bestBatch.boxes_per_lb || 0)) bestBatch = b;
    if (!worstBatch || (b.boxes_per_lb || 0) < (worstBatch.boxes_per_lb || 0)) worstBatch = b;
  }

  // Rolling 7 batches (most recent)
  const sorted = [...valid].sort((a, b) => 
    new Date(b.batch_date || b.created_at || 0).getTime() - new Date(a.batch_date || a.created_at || 0).getTime()
  );
  const recent7 = sorted.slice(0, 7);
  const r7Lbs = recent7.reduce((s, b) => s + (b.tobacco_lbs || 0), 0);
  const r7Boxes = recent7.reduce((s, b) => s + (b.boxes_produced || 0), 0);
  const r7AvgLbsPerBox = r7Boxes > 0 ? r7Lbs / r7Boxes : 0;
  const r7AvgBoxesPerLb = r7Lbs > 0 ? r7Boxes / r7Lbs : 0;
  
  const deviationPct = globalAvgBoxesPerLb > 0
    ? Math.abs(((r7AvgBoxesPerLb - globalAvgBoxesPerLb) / globalAvgBoxesPerLb) * 100)
    : 0;

  // Efficiency score (0-100): based on waste and conversion consistency
  const efficiencyScore = Math.min(100, Math.max(0,
    100 - (avgWastePct * 2) - (deviationPct * 1.5)
  ));

  return {
    totalLbs: Math.round(totalLbs * 100) / 100,
    totalBoxes,
    globalAvgLbsPerBox: Math.round(globalAvgLbsPerBox * 10000) / 10000,
    globalAvgBoxesPerLb: Math.round(globalAvgBoxesPerLb * 10000) / 10000,
    avgWastePct: Math.round(avgWastePct * 100) / 100,
    avgCostPerBox: avgCostPerBox !== null ? Math.round(avgCostPerBox * 100) / 100 : null,
    batchCount: batches.length,
    bestBatch,
    worstBatch,
    rolling7: {
      avgLbsPerBox: Math.round(r7AvgLbsPerBox * 10000) / 10000,
      avgBoxesPerLb: Math.round(r7AvgBoxesPerLb * 10000) / 10000,
      deviationPct: Math.round(deviationPct * 100) / 100,
    },
    efficiencyScore: Math.round(efficiencyScore),
  };
}

export function useConversionIntelligence(officeId?: string) {
  return useQuery({
    queryKey: ['conversion-intelligence', officeId],
    queryFn: async () => {
      let query = supabase
        .from('v_tobacco_conversion_intelligence' as any)
        .select('*')
        .order('batch_date', { ascending: false });
      
      if (officeId) {
        query = query.eq('office_id', officeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const batches = (data || []) as unknown as ConversionBatch[];
      const stats = computeStats(batches);
      
      return { batches, stats };
    },
    enabled: true,
  });
}
