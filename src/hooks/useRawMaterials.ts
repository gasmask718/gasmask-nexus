/**
 * RAW MATERIAL INTAKE HOOKS
 * CRUD operations for production_raw_materials table.
 * Tracks inbound material receipts with supplier/cost data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RawMaterial {
  id: string;
  office_id: string;
  material_type: string;
  quantity: number;
  unit: string;
  cost_per_unit: number | null;
  total_cost: number | null;
  supplier_name: string | null;
  supplier_id: string | null;
  received_by: string | null;
  received_at: string;
  batch_number: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type RawMaterialInsert = Omit<RawMaterial, 'id' | 'created_at' | 'updated_at'>;

export const MATERIAL_TYPES = [
  { value: 'tobacco', label: 'Tobacco', unit: 'lbs', icon: '🍂' },
  { value: 'tubes', label: 'Empty Tubes', unit: 'units', icon: '🔧' },
  { value: 'stickers', label: 'Stickers', unit: 'sheets', icon: '🏷️' },
  { value: 'bags', label: 'Packaging Bags', unit: 'units', icon: '👜' },
  { value: 'boxes', label: 'Empty Boxes', unit: 'units', icon: '📦' },
  { value: 'other', label: 'Other', unit: 'units', icon: '🔩' },
] as const;

export function useRawMaterials(officeId: string | undefined) {
  return useQuery({
    queryKey: ['production-raw-materials', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_raw_materials')
        .select('*')
        .eq('office_id', officeId)
        .order('received_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as RawMaterial[];
    },
    enabled: !!officeId,
  });
}

/** Aggregated material levels for an office */
export function useRawMaterialLevels(officeId: string | undefined) {
  return useQuery({
    queryKey: ['production-raw-material-levels', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_raw_materials')
        .select('material_type, quantity, unit, total_cost')
        .eq('office_id', officeId);

      if (error) throw error;

      // Aggregate by material_type
      const levels: Record<string, { total_qty: number; total_cost: number; unit: string }> = {};
      for (const row of (data || [])) {
        const key = row.material_type;
        if (!levels[key]) {
          levels[key] = { total_qty: 0, total_cost: 0, unit: row.unit };
        }
        levels[key].total_qty += Number(row.quantity) || 0;
        levels[key].total_cost += Number(row.total_cost) || 0;
      }

      return Object.entries(levels).map(([type, agg]) => ({
        material_type: type,
        ...agg,
      }));
    },
    enabled: !!officeId,
  });
}

export function useCreateRawMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (material: RawMaterialInsert) => {
      const computed_total = (material.quantity || 0) * (material.cost_per_unit || 0);
      const { data, error } = await supabase
        .from('production_raw_materials')
        .insert({
          ...material,
          total_cost: material.total_cost ?? computed_total,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-raw-materials', variables.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-raw-material-levels', variables.office_id] });
      toast({ title: 'Material received', description: 'Raw material intake recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record material', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRawMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, officeId }: { id: string; officeId: string }) => {
      const { error } = await supabase
        .from('production_raw_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { officeId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['production-raw-materials', result.officeId] });
      queryClient.invalidateQueries({ queryKey: ['production-raw-material-levels', result.officeId] });
      toast({ title: 'Material record deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    },
  });
}
