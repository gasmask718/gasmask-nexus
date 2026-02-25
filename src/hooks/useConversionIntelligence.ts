/**
 * useConversionIntelligence — Fetches tobacco conversion data from the view
 * and computes rolling averages, deviation alerts, and admin-level KPIs.
 * Now product-type aware (tubes vs bags).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ProductType } from './useProductionPortal';

export interface ConversionBatch {
  batch_id: string;
  office_id: string | null;
  brand: string;
  batch_date: string | null;
  tobacco_lbs: number;
  boxes_produced: number | null;
  product_type: ProductType;
  product_output_units: number | null;
  production_time_minutes: number | null;
  waste_lbs: number | null;
  tubes_total: number | null;
  status: string | null;
  inventory_state: string;
  is_locked: boolean | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
  // Product-aware conversions
  lbs_per_unit: number | null;
  units_per_lb: number | null;
  time_per_unit: number | null;
  // Legacy box-specific
  lbs_per_box: number | null;
  boxes_per_lb: number | null;
  waste_pct: number | null;
  total_cost: number | null;
  cost_per_unit: number | null;
  cost_per_box: number | null;
  office_name: string | null;
}

export interface ConversionStats {
  totalLbs: number;
  totalUnits: number;
  totalBoxes: number;
  globalAvgLbsPerUnit: number;
  globalAvgUnitsPerLb: number;
  // Legacy
  globalAvgLbsPerBox: number;
  globalAvgBoxesPerLb: number;
  avgWastePct: number;
  avgCostPerUnit: number | null;
  avgCostPerBox: number | null;
  avgTimePerUnit: number | null;
  batchCount: number;
  bestBatch: ConversionBatch | null;
  worstBatch: ConversionBatch | null;
  fastestBatch: ConversionBatch | null;
  slowestBatch: ConversionBatch | null;
  rolling7: {
    avgLbsPerUnit: number;
    avgUnitsPerLb: number;
    avgLbsPerBox: number;
    avgBoxesPerLb: number;
    deviationPct: number;
  };
  efficiencyScore: number;
}

function computeStats(batches: ConversionBatch[]): ConversionStats {
  const valid = batches.filter(b => b.lbs_per_unit !== null && b.units_per_lb !== null);
  
  const totalLbs = batches.reduce((s, b) => s + (b.tobacco_lbs || 0), 0);
  const totalUnits = batches.reduce((s, b) => s + (b.product_output_units || 0), 0);
  const totalBoxes = batches.reduce((s, b) => s + (b.boxes_produced || 0), 0);
  
  const globalAvgLbsPerUnit = totalUnits > 0 ? totalLbs / totalUnits : 0;
  const globalAvgUnitsPerLb = totalLbs > 0 ? totalUnits / totalLbs : 0;
  const globalAvgLbsPerBox = totalBoxes > 0 ? totalLbs / totalBoxes : 0;
  const globalAvgBoxesPerLb = totalLbs > 0 ? totalBoxes / totalLbs : 0;
  
  const wasteEntries = batches.filter(b => b.waste_pct !== null);
  const avgWastePct = wasteEntries.length > 0
    ? wasteEntries.reduce((s, b) => s + (b.waste_pct || 0), 0) / wasteEntries.length
    : 0;
  
  const costEntries = batches.filter(b => b.cost_per_unit !== null);
  const avgCostPerUnit = costEntries.length > 0
    ? costEntries.reduce((s, b) => s + (b.cost_per_unit || 0), 0) / costEntries.length
    : null;

  const boxCostEntries = batches.filter(b => b.cost_per_box !== null);
  const avgCostPerBox = boxCostEntries.length > 0
    ? boxCostEntries.reduce((s, b) => s + (b.cost_per_box || 0), 0) / boxCostEntries.length
    : null;

  // Time per unit
  const timeEntries = batches.filter(b => b.time_per_unit !== null);
  const avgTimePerUnit = timeEntries.length > 0
    ? timeEntries.reduce((s, b) => s + (b.time_per_unit || 0), 0) / timeEntries.length
    : null;

  // Best/worst by units_per_lb
  let bestBatch: ConversionBatch | null = null;
  let worstBatch: ConversionBatch | null = null;
  for (const b of valid) {
    if (!bestBatch || (b.units_per_lb || 0) > (bestBatch.units_per_lb || 0)) bestBatch = b;
    if (!worstBatch || (b.units_per_lb || 0) < (worstBatch.units_per_lb || 0)) worstBatch = b;
  }

  // Fastest/slowest by time_per_unit
  const timeValid = batches.filter(b => b.time_per_unit !== null && b.time_per_unit > 0);
  let fastestBatch: ConversionBatch | null = null;
  let slowestBatch: ConversionBatch | null = null;
  for (const b of timeValid) {
    if (!fastestBatch || (b.time_per_unit || Infinity) < (fastestBatch.time_per_unit || Infinity)) fastestBatch = b;
    if (!slowestBatch || (b.time_per_unit || 0) > (slowestBatch.time_per_unit || 0)) slowestBatch = b;
  }

  // Rolling 7 batches (most recent)
  const sorted = [...valid].sort((a, b) => 
    new Date(b.batch_date || b.created_at || 0).getTime() - new Date(a.batch_date || a.created_at || 0).getTime()
  );
  const recent7 = sorted.slice(0, 7);
  const r7Lbs = recent7.reduce((s, b) => s + (b.tobacco_lbs || 0), 0);
  const r7Units = recent7.reduce((s, b) => s + (b.product_output_units || 0), 0);
  const r7Boxes = recent7.reduce((s, b) => s + (b.boxes_produced || 0), 0);
  const r7AvgLbsPerUnit = r7Units > 0 ? r7Lbs / r7Units : 0;
  const r7AvgUnitsPerLb = r7Lbs > 0 ? r7Units / r7Lbs : 0;
  const r7AvgLbsPerBox = r7Boxes > 0 ? r7Lbs / r7Boxes : 0;
  const r7AvgBoxesPerLb = r7Lbs > 0 ? r7Boxes / r7Lbs : 0;
  
  const deviationPct = globalAvgUnitsPerLb > 0
    ? Math.abs(((r7AvgUnitsPerLb - globalAvgUnitsPerLb) / globalAvgUnitsPerLb) * 100)
    : 0;

  const efficiencyScore = Math.min(100, Math.max(0,
    100 - (avgWastePct * 2) - (deviationPct * 1.5)
  ));

  return {
    totalLbs: Math.round(totalLbs * 100) / 100,
    totalUnits,
    totalBoxes,
    globalAvgLbsPerUnit: Math.round(globalAvgLbsPerUnit * 10000) / 10000,
    globalAvgUnitsPerLb: Math.round(globalAvgUnitsPerLb * 10000) / 10000,
    globalAvgLbsPerBox: Math.round(globalAvgLbsPerBox * 10000) / 10000,
    globalAvgBoxesPerLb: Math.round(globalAvgBoxesPerLb * 10000) / 10000,
    avgWastePct: Math.round(avgWastePct * 100) / 100,
    avgCostPerUnit: avgCostPerUnit !== null ? Math.round(avgCostPerUnit * 100) / 100 : null,
    avgCostPerBox: avgCostPerBox !== null ? Math.round(avgCostPerBox * 100) / 100 : null,
    avgTimePerUnit: avgTimePerUnit !== null ? Math.round(avgTimePerUnit * 100) / 100 : null,
    batchCount: batches.length,
    bestBatch,
    worstBatch,
    fastestBatch,
    slowestBatch,
    rolling7: {
      avgLbsPerUnit: Math.round(r7AvgLbsPerUnit * 10000) / 10000,
      avgUnitsPerLb: Math.round(r7AvgUnitsPerLb * 10000) / 10000,
      avgLbsPerBox: Math.round(r7AvgLbsPerBox * 10000) / 10000,
      avgBoxesPerLb: Math.round(r7AvgBoxesPerLb * 10000) / 10000,
      deviationPct: Math.round(deviationPct * 100) / 100,
    },
    efficiencyScore: Math.round(efficiencyScore),
  };
}

export function useConversionIntelligence(officeId?: string, productType?: ProductType) {
  return useQuery({
    queryKey: ['conversion-intelligence', officeId, productType],
    queryFn: async () => {
      let query = supabase
        .from('v_tobacco_conversion_intelligence' as any)
        .select('*')
        .order('batch_date', { ascending: false });
      
      if (officeId) {
        query = query.eq('office_id', officeId);
      }
      if (productType) {
        query = query.eq('product_type', productType);
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
