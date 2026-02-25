/**
 * BATCH COST HISTORY HOOKS
 * Immutable cost ledger — records are created on batch approval.
 * Never update or delete past entries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BatchCostHistoryRecord {
  id: string;
  batch_id: string;
  office_id: string | null;
  product_type: string;
  boxes_produced: number;
  tobacco_cost: number;
  packaging_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_batch_cost: number;
  cost_per_box: number;
  labor_model: 'hourly' | 'per_box' | 'flat_day' | null;
  worker_count: number;
  cost_snapshot_created_at: string;
  approved_by: string | null;
  is_immutable: boolean;
  created_at: string;
}

export interface BatchCostSummary {
  office_id: string | null;
  office_name: string | null;
  product_type: string;
  batch_count: number;
  total_cost: number;
  total_labor_cost: number;
  total_boxes: number;
  avg_cost_per_box: number;
  labor_pct_of_total: number;
  rolling_30d_avg_cost_per_box: number | null;
}

export function useBatchCostHistory(officeId: string | undefined) {
  return useQuery({
    queryKey: ['batch-cost-history', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('batch_cost_history')
        .select('*')
        .eq('office_id', officeId)
        .order('cost_snapshot_created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BatchCostHistoryRecord[];
    },
    enabled: !!officeId,
  });
}

export function useBatchCostSummary(officeId: string | undefined) {
  return useQuery({
    queryKey: ['batch-cost-summary', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('v_batch_cost_summary')
        .select('*')
        .eq('office_id', officeId);
      if (error) throw error;
      return (data || []) as BatchCostSummary[];
    },
    enabled: !!officeId,
  });
}

/**
 * Create an immutable cost snapshot when a batch is approved.
 * Called from the batch state transition flow.
 */
export function useCreateCostSnapshot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      batchId: string;
      officeId: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      // Get batch data
      const { data: batch, error: batchErr } = await supabase
        .from('production_batches')
        .select('id, product_type, boxes_produced, boxes_equivalent, labor_model, worker_count, selected_worker_ids, labor_hourly_rate_snapshot, labor_per_box_rate_snapshot, labor_flat_day_rate_snapshot, production_time_minutes, changeover_minutes')
        .eq('id', params.batchId)
        .single();
      if (batchErr || !batch) throw new Error('Batch not found');

      // Get existing cost data
      const { data: costData } = await supabase
        .from('production_batch_costs')
        .select('*')
        .eq('batch_id', params.batchId)
        .maybeSingle();

      const boxesProduced = (batch as any).boxes_equivalent || (batch as any).boxes_produced || 0;
      const laborModel = (batch as any).labor_model as string | null;
      const workerCount = (batch as any).worker_count || 1;

      // Calculate labor cost based on model
      let laborCost = 0;
      if (laborModel === 'hourly') {
        const rate = (batch as any).labor_hourly_rate_snapshot || 0;
        const grossMinutes = (batch as any).production_time_minutes || 0;
        const changeover = (batch as any).changeover_minutes || 0;
        const netHours = Math.max(grossMinutes - changeover, 0) / 60;
        laborCost = netHours * rate * workerCount;
      } else if (laborModel === 'per_box') {
        const rate = (batch as any).labor_per_box_rate_snapshot || 0;
        laborCost = boxesProduced * rate;
      } else if (laborModel === 'flat_day') {
        const rate = (batch as any).labor_flat_day_rate_snapshot || 0;
        laborCost = workerCount * rate;
      } else if (costData) {
        // Fallback to legacy hourly calculation
        laborCost = (costData.labor_hours || 0) * (costData.labor_rate_per_hour || 0);
      }

      // Material costs from cost entry
      const tobaccoCost = costData?.material_tobacco_cost || 0;
      const packagingCost = (costData?.material_tubes_cost || 0) +
        (costData?.material_stickers_cost || 0) +
        (costData?.material_bags_cost || 0) +
        (costData?.material_boxes_cost || 0) +
        (costData?.material_other_cost || 0);

      const totalMaterial = tobaccoCost + packagingCost;
      const overheadPct = costData?.overhead_pct || 10;
      const overheadCost = (totalMaterial + laborCost) * (overheadPct / 100);
      const totalBatchCost = totalMaterial + laborCost + overheadCost;
      const costPerBox = boxesProduced > 0 ? totalBatchCost / boxesProduced : 0;

      const { data, error } = await supabase
        .from('batch_cost_history')
        .insert({
          batch_id: params.batchId,
          office_id: params.officeId,
          product_type: (batch as any).product_type || 'tubes',
          boxes_produced: boxesProduced,
          tobacco_cost: tobaccoCost,
          packaging_cost: packagingCost,
          labor_cost: laborCost,
          overhead_cost: overheadCost,
          total_batch_cost: totalBatchCost,
          cost_per_box: Math.round(costPerBox * 100) / 100,
          labor_model: laborModel as any,
          worker_count: workerCount,
          approved_by: userData.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['batch-cost-history'] });
      queryClient.invalidateQueries({ queryKey: ['batch-cost-summary'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create cost snapshot:', error.message);
      // Don't toast — this is called as part of approval flow
    },
  });
}
