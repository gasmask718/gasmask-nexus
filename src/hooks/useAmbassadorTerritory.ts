/**
 * Ambassador Territory Coverage Hook
 * CRUD operations for structured territory mapping with audit logging
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export type RegionType = 'state' | 'county' | 'city' | 'custom_zone';

export interface TerritoryCoverage {
  id: string;
  ambassador_id: string;
  region_type: RegionType;
  region_value: string;
  coverage_radius_miles: number | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export function useAmbassadorTerritory(ambassadorId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const qk = ['ambassador-territory', ambassadorId];

  const territoriesQuery = useQuery({
    queryKey: qk,
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await supabase
        .from('ambassador_territory_coverage')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return (data || []) as TerritoryCoverage[];
    },
    enabled: !!ambassadorId,
  });

  // Check for territory conflicts
  const checkConflict = async (regionType: RegionType, regionValue: string) => {
    const { data } = await supabase
      .from('ambassador_territory_coverage')
      .select('ambassador_id')
      .eq('region_type', regionType)
      .eq('region_value', regionValue)
      .eq('is_primary', true)
      .neq('ambassador_id', ambassadorId || '');
    return (data || []).length > 0;
  };

  const addTerritory = useMutation({
    mutationFn: async (input: { region_type: RegionType; region_value: string; coverage_radius_miles?: number; is_primary?: boolean }) => {
      if (!ambassadorId || !user?.id) throw new Error('Missing context');
      const { error } = await supabase
        .from('ambassador_territory_coverage')
        .insert({
          ambassador_id: ambassadorId,
          region_type: input.region_type,
          region_value: input.region_value.trim(),
          coverage_radius_miles: input.coverage_radius_miles || null,
          is_primary: input.is_primary || false,
          updated_by: user.id,
        });
      if (error) throw error;
      // Audit
      await supabase.from('ambassador_region_history').insert({
        ambassador_id: ambassadorId,
        change_type: 'added',
        new_value: input as any,
        updated_by: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success('Territory added');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const removeTerritory = useMutation({
    mutationFn: async (territoryId: string) => {
      if (!ambassadorId || !user?.id) throw new Error('Missing context');
      const existing = territoriesQuery.data?.find(t => t.id === territoryId);
      const { error } = await supabase
        .from('ambassador_territory_coverage')
        .delete()
        .eq('id', territoryId);
      if (error) throw error;
      await supabase.from('ambassador_region_history').insert({
        ambassador_id: ambassadorId,
        change_type: 'removed',
        old_value: existing as any,
        updated_by: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success('Territory removed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const updateTerritory = useMutation({
    mutationFn: async (input: { id: string; is_primary?: boolean; coverage_radius_miles?: number | null }) => {
      if (!ambassadorId || !user?.id) throw new Error('Missing context');
      const existing = territoriesQuery.data?.find(t => t.id === input.id);
      const { error } = await supabase
        .from('ambassador_territory_coverage')
        .update({
          is_primary: input.is_primary,
          coverage_radius_miles: input.coverage_radius_miles,
          updated_by: user.id,
        })
        .eq('id', input.id);
      if (error) throw error;
      await supabase.from('ambassador_region_history').insert({
        ambassador_id: ambassadorId,
        change_type: 'updated',
        old_value: existing as any,
        new_value: input as any,
        updated_by: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success('Territory updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    territories: territoriesQuery.data || [],
    isLoading: territoriesQuery.isLoading,
    checkConflict,
    addTerritory: addTerritory.mutateAsync,
    removeTerritory: removeTerritory.mutateAsync,
    updateTerritory: updateTerritory.mutateAsync,
    isAdding: addTerritory.isPending,
    isRemoving: removeTerritory.isPending,
  };
}
