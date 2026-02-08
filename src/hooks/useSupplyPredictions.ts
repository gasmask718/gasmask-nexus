/**
 * SUPPLY PREDICTION HOOKS
 * Manages AI-driven supply forecasting and supplier lead time configuration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SupplyPrediction {
  id: string;
  office_id: string;
  material_type: string;
  current_stock: number;
  daily_consumption_rate: number;
  predicted_stockout_date: string | null;
  recommended_reorder_date: string | null;
  recommended_order_quantity: number | null;
  confidence_score: number;
  urgency: 'critical' | 'warning' | 'normal' | 'surplus';
  ai_reasoning: string | null;
  data_points_used: number;
  predicted_at: string;
  created_at: string;
}

export interface SupplierLeadTime {
  id: string;
  office_id: string | null;
  material_type: string;
  supplier_name: string | null;
  lead_time_days: number;
  min_order_quantity: number | null;
  cost_per_unit: number | null;
  reliability_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierLeadTimeInsert = Omit<SupplierLeadTime, 'id' | 'created_at' | 'updated_at'>;

/** Fetch the latest predictions for an office */
export function useSupplyPredictions(officeId: string | undefined) {
  return useQuery({
    queryKey: ['supply-predictions', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_supply_predictions')
        .select('*')
        .eq('office_id', officeId)
        .order('urgency', { ascending: true });

      if (error) throw error;
      return (data || []) as SupplyPrediction[];
    },
    enabled: !!officeId,
  });
}

/** Fetch supplier lead time configurations */
export function useSupplierLeadTimes(officeId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-lead-times', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_supplier_lead_times')
        .select('*')
        .eq('office_id', officeId)
        .order('material_type');

      if (error) throw error;
      return (data || []) as SupplierLeadTime[];
    },
    enabled: !!officeId,
  });
}

/** Trigger AI prediction run */
export function useRunSupplyPrediction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (officeId: string) => {
      const { data, error } = await supabase.functions.invoke('production-supply-predict', {
        body: { officeId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, officeId) => {
      queryClient.invalidateQueries({ queryKey: ['supply-predictions', officeId] });
      const criticalCount = data?.analysis?.critical_count || 0;
      const warningCount = data?.analysis?.warning_count || 0;
      
      toast({
        title: 'Supply forecast updated',
        description: criticalCount > 0
          ? `⚠️ ${criticalCount} critical, ${warningCount} warning items detected`
          : `${data?.predictions?.length || 0} materials analyzed successfully`,
        variant: criticalCount > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Prediction failed', description: error.message, variant: 'destructive' });
    },
  });
}

/** Create a new supplier lead time config */
export function useCreateLeadTime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (leadTime: SupplierLeadTimeInsert) => {
      const { data, error } = await supabase
        .from('production_supplier_lead_times')
        .insert(leadTime)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-lead-times', variables.office_id] });
      toast({ title: 'Lead time saved', description: 'Supplier configuration updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });
}

/** Update a supplier lead time */
export function useUpdateLeadTime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, officeId, ...updates }: { id: string; officeId: string } & Partial<SupplierLeadTimeInsert>) => {
      const { error } = await supabase
        .from('production_supplier_lead_times')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { officeId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-lead-times', result.officeId] });
      toast({ title: 'Lead time updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });
}

/** Delete a supplier lead time */
export function useDeleteLeadTime() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, officeId }: { id: string; officeId: string }) => {
      const { error } = await supabase
        .from('production_supplier_lead_times')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { officeId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-lead-times', result.officeId] });
      toast({ title: 'Lead time removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });
}
