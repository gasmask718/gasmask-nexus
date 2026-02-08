/**
 * BATCH COST ENGINE HOOKS
 * CRUD for production_batch_costs + margin analysis view.
 * Cost data is admin/manager only — never exposed to workers.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BatchCost {
  id: string;
  batch_id: string;
  material_tobacco_cost: number;
  material_tubes_cost: number;
  material_stickers_cost: number;
  material_bags_cost: number;
  material_boxes_cost: number;
  material_other_cost: number;
  labor_hours: number;
  labor_rate_per_hour: number;
  labor_cost: number;
  overhead_pct: number;
  total_material_cost: number;
  wholesale_price_per_box: number;
  retail_price_per_box: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarginAnalysis {
  batch_id: string;
  brand: string;
  office_id: string | null;
  batch_date: string | null;
  boxes_produced: number | null;
  inventory_state: string;
  office_name: string | null;
  total_material_cost: number | null;
  labor_cost: number | null;
  overhead_cost: number | null;
  total_cost: number | null;
  cost_per_box: number | null;
  wholesale_price_per_box: number | null;
  retail_price_per_box: number | null;
  gross_margin_wholesale: number | null;
  margin_pct_wholesale: number | null;
  margin_pct_retail: number | null;
  cost_recorded_at: string | null;
}

export interface OverheadConfig {
  id: string;
  office_id: string | null;
  default_labor_rate: number;
  default_overhead_pct: number;
  rent_monthly: number;
  utilities_monthly: number;
  insurance_monthly: number;
  other_monthly: number;
  effective_from: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// BATCH COST HOOKS
// ============================================================

export function useBatchCost(batchId: string | undefined) {
  return useQuery({
    queryKey: ['batch-cost', batchId],
    queryFn: async () => {
      if (!batchId) return null;
      const { data, error } = await supabase
        .from('production_batch_costs')
        .select('*')
        .eq('batch_id', batchId)
        .maybeSingle();

      if (error) throw error;
      return data as BatchCost | null;
    },
    enabled: !!batchId,
  });
}

export function useBatchCosts(officeId: string | undefined) {
  return useQuery({
    queryKey: ['batch-costs', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      // Join through batches to get office-scoped costs
      const { data, error } = await supabase
        .from('production_batch_costs')
        .select(`
          *,
          production_batches!inner (
            office_id, brand, batch_date, boxes_produced, inventory_state
          )
        `)
        .eq('production_batches.office_id', officeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as (BatchCost & { production_batches: any })[];
    },
    enabled: !!officeId,
  });
}

export function useUpsertBatchCost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      batch_id,
      ...costs
    }: Partial<BatchCost> & { batch_id: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      // Check if record exists
      const { data: existing } = await supabase
        .from('production_batch_costs')
        .select('id')
        .eq('batch_id', batch_id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('production_batch_costs')
          .update({ ...costs })
          .eq('batch_id', batch_id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('production_batch_costs')
          .insert({ batch_id, ...costs, created_by: userData.user?.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batch-cost'] });
      queryClient.invalidateQueries({ queryKey: ['batch-costs'] });
      queryClient.invalidateQueries({ queryKey: ['margin-analysis'] });
      toast({ title: 'Cost data saved', description: 'Batch cost breakdown updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save costs', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// MARGIN ANALYSIS HOOKS
// ============================================================

export function useMarginAnalysis(officeId: string | undefined) {
  return useQuery({
    queryKey: ['margin-analysis', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('v_production_margin_analysis')
        .select('*')
        .eq('office_id', officeId)
        .order('batch_date', { ascending: false });

      if (error) throw error;
      return (data || []) as MarginAnalysis[];
    },
    enabled: !!officeId,
  });
}

export function useMarginAnalysisAll() {
  return useQuery({
    queryKey: ['margin-analysis-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_production_margin_analysis')
        .select('*')
        .not('total_cost', 'is', null)
        .order('batch_date', { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data || []) as MarginAnalysis[];
    },
  });
}

// ============================================================
// OVERHEAD CONFIG HOOKS
// ============================================================

export function useOverheadConfig(officeId: string | undefined) {
  return useQuery({
    queryKey: ['overhead-config', officeId],
    queryFn: async () => {
      if (!officeId) return null;
      const { data, error } = await supabase
        .from('production_overhead_config')
        .select('*')
        .eq('office_id', officeId)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as OverheadConfig | null;
    },
    enabled: !!officeId,
  });
}

export function useUpsertOverheadConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<OverheadConfig> & { office_id: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data: existing } = await supabase
        .from('production_overhead_config')
        .select('id')
        .eq('office_id', config.office_id)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('production_overhead_config')
          .update({ ...config })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('production_overhead_config')
          .insert({ ...config, created_by: userData.user?.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['overhead-config', vars.office_id] });
      toast({ title: 'Overhead config saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save config', description: error.message, variant: 'destructive' });
    },
  });
}
