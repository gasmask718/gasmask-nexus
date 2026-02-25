/**
 * PRODUCTION MATERIAL USAGE HOOKS
 * Tracks material consumption per batch and office.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type MaterialType = 'tobacco_lbs' | 'tubes' | 'bags' | 'stickers' | 'boxes' | 'other';

export interface MaterialUsageRecord {
  id: string;
  batch_id: string | null;
  office_id: string;
  material_type: MaterialType;
  quantity_used: number;
  unit_of_measure: string;
  usage_date: string;
  created_at: string;
  created_by: string | null;
}

export interface DailyMaterialSummary {
  usage_date: string;
  office_id: string;
  material_type: string;
  total_used: number;
}

export interface LifetimeMaterialSummary {
  office_id: string;
  material_type: string;
  lifetime_used: number;
}

export function useMaterialUsage(officeId: string | undefined) {
  return useQuery({
    queryKey: ['material-usage', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_material_usage')
        .select('*')
        .eq('office_id', officeId)
        .order('usage_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as MaterialUsageRecord[];
    },
    enabled: !!officeId,
  });
}

export function useDailyMaterialSummary(officeId: string | undefined) {
  return useQuery({
    queryKey: ['material-usage-daily', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('v_material_usage_daily')
        .select('*')
        .eq('office_id', officeId)
        .order('usage_date', { ascending: false })
        .limit(90);
      if (error) throw error;
      return (data || []) as DailyMaterialSummary[];
    },
    enabled: !!officeId,
  });
}

export function useLifetimeMaterialSummary(officeId: string | undefined) {
  return useQuery({
    queryKey: ['material-usage-lifetime', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('v_material_usage_total')
        .select('*')
        .eq('office_id', officeId);
      if (error) throw error;
      return (data || []) as LifetimeMaterialSummary[];
    },
    enabled: !!officeId,
  });
}

/**
 * Auto-record material usage when a batch is completed.
 */
export function useRecordBatchMaterials() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      batchId: string;
      officeId: string;
      tobaccoLbs: number;
      productOutputUnits: number;
      boxesProduced: number;
      productType: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      const records: any[] = [];

      // Tobacco
      if (params.tobaccoLbs > 0) {
        records.push({
          batch_id: params.batchId,
          office_id: params.officeId,
          material_type: 'tobacco_lbs',
          quantity_used: params.tobaccoLbs,
          unit_of_measure: 'lbs',
          created_by: userId,
        });
      }

      // Product units (tubes or bags)
      if (params.productOutputUnits > 0) {
        records.push({
          batch_id: params.batchId,
          office_id: params.officeId,
          material_type: params.productType === 'bags' ? 'bags' : 'tubes',
          quantity_used: params.productOutputUnits,
          unit_of_measure: 'units',
          created_by: userId,
        });
      }

      // Boxes
      if (params.boxesProduced > 0) {
        records.push({
          batch_id: params.batchId,
          office_id: params.officeId,
          material_type: 'boxes',
          quantity_used: params.boxesProduced,
          unit_of_measure: 'boxes',
          created_by: userId,
        });
      }

      if (records.length > 0) {
        const { error } = await supabase
          .from('production_material_usage')
          .insert(records);
        if (error) throw error;
      }

      return records.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-usage'] });
      queryClient.invalidateQueries({ queryKey: ['material-usage-daily'] });
      queryClient.invalidateQueries({ queryKey: ['material-usage-lifetime'] });
    },
    onError: (error: Error) => {
      console.error('Failed to record material usage:', error.message);
    },
  });
}
