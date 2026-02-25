/**
 * MATERIAL ALLOCATION HOOKS
 * Logical reservation of raw tobacco between tubes and bags.
 * Tracks reserved_lbs, unallocated buffer, and override history.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface MaterialInventory {
  id: string;
  office_id: string;
  material_type: string;
  total_lbs_available: number;
  last_updated_at: string;
}

export interface MaterialAllocation {
  id: string;
  office_id: string;
  product_type: 'tubes' | 'bags';
  reserved_lbs: number;
  auto_reserved_lbs: number;
  manual_reserved_lbs: number;
  coverage_target_days: number;
  last_updated_at: string;
}

export interface AllocationOverview {
  office_id: string;
  material_type: string;
  total_lbs_available: number;
  tubes_reserved_lbs: number;
  bags_reserved_lbs: number;
  unallocated_lbs: number;
  unallocated_pct: number;
  tubes_coverage_target: number;
  bags_coverage_target: number;
  tubes_auto_reserved: number;
  tubes_manual_reserved: number;
  bags_auto_reserved: number;
  bags_manual_reserved: number;
  last_updated_at: string;
}

export interface AllocationOverride {
  id: string;
  office_id: string;
  product_type: string;
  previous_reserved_lbs: number;
  new_reserved_lbs: number;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

export function useMaterialInventory(officeId: string | undefined) {
  return useQuery({
    queryKey: ['raw-material-inventory', officeId],
    queryFn: async () => {
      if (!officeId) return null;
      const { data, error } = await supabase
        .from('raw_material_inventory' as any)
        .select('*')
        .eq('office_id', officeId)
        .eq('material_type', 'tobacco')
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MaterialInventory | null;
    },
    enabled: !!officeId,
  });
}

export function useMaterialAllocations(officeId: string | undefined) {
  return useQuery({
    queryKey: ['raw-material-allocations', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('raw_material_allocations' as any)
        .select('*')
        .eq('office_id', officeId);
      if (error) throw error;
      return (data || []) as unknown as MaterialAllocation[];
    },
    enabled: !!officeId,
  });
}

export function useAllocationOverview(officeId: string | undefined) {
  return useQuery({
    queryKey: ['material-allocation-overview', officeId],
    queryFn: async () => {
      if (!officeId) return null;
      const { data, error } = await supabase
        .from('v_material_allocation_overview' as any)
        .select('*')
        .eq('office_id', officeId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AllocationOverview | null;
    },
    enabled: !!officeId,
  });
}

export function useAllocationOverrides(officeId: string | undefined) {
  return useQuery({
    queryKey: ['raw-allocation-overrides', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('raw_allocation_overrides' as any)
        .select('*')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as AllocationOverride[];
    },
    enabled: !!officeId,
  });
}

// ═══════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════

/** Upsert the total_lbs_available for an office */
export function useUpdateMaterialInventory() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ officeId, totalLbs }: { officeId: string; totalLbs: number }) => {
      // Upsert
      const { data: existing } = await supabase
        .from('raw_material_inventory' as any)
        .select('id')
        .eq('office_id', officeId)
        .eq('material_type', 'tobacco')
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from('raw_material_inventory' as any)
          .update({ total_lbs_available: totalLbs, last_updated_at: new Date().toISOString() } as any)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('raw_material_inventory' as any)
          .insert({ office_id: officeId, material_type: 'tobacco', total_lbs_available: totalLbs } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, { officeId }) => {
      qc.invalidateQueries({ queryKey: ['raw-material-inventory', officeId] });
      qc.invalidateQueries({ queryKey: ['material-allocation-overview', officeId] });
      toast({ title: 'Tobacco inventory updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });
}

/** Manual override of reserved_lbs with audit trail */
export function useOverrideAllocation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      officeId,
      productType,
      newManualLbs,
      reason,
    }: {
      officeId: string;
      productType: 'tubes' | 'bags';
      newManualLbs: number;
      reason: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      // Get current allocation
      const { data: current } = await supabase
        .from('raw_material_allocations' as any)
        .select('*')
        .eq('office_id', officeId)
        .eq('product_type', productType)
        .maybeSingle();

      const previousLbs = Number((current as any)?.manual_reserved_lbs) || 0;
      const autoLbs = Number((current as any)?.auto_reserved_lbs) || 0;
      const newTotal = autoLbs + newManualLbs;

      if ((current as any)?.id) {
        const { error } = await supabase
          .from('raw_material_allocations' as any)
          .update({
            manual_reserved_lbs: newManualLbs,
            reserved_lbs: newTotal,
            last_updated_at: new Date().toISOString(),
          } as any)
          .eq('id', (current as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('raw_material_allocations' as any)
          .insert({
            office_id: officeId,
            product_type: productType,
            manual_reserved_lbs: newManualLbs,
            auto_reserved_lbs: 0,
            reserved_lbs: newManualLbs,
          } as any);
        if (error) throw error;
      }

      // Log override
      await supabase.from('raw_allocation_overrides' as any).insert({
        office_id: officeId,
        product_type: productType,
        previous_reserved_lbs: previousLbs,
        new_reserved_lbs: newManualLbs,
        reason,
        changed_by: userData.user?.id || null,
      } as any);
    },
    onSuccess: (_, { officeId }) => {
      qc.invalidateQueries({ queryKey: ['raw-material-allocations', officeId] });
      qc.invalidateQueries({ queryKey: ['material-allocation-overview', officeId] });
      qc.invalidateQueries({ queryKey: ['raw-allocation-overrides', officeId] });
      toast({ title: 'Allocation override saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Override failed', description: err.message, variant: 'destructive' });
    },
  });
}

/** Run the auto-reserve edge function */
export function useRunAutoReservation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('auto-reserve-materials');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raw-material-allocations'] });
      qc.invalidateQueries({ queryKey: ['material-allocation-overview'] });
      toast({ title: 'Auto-reservation complete' });
    },
    onError: (err: Error) => {
      toast({ title: 'Auto-reserve failed', description: err.message, variant: 'destructive' });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Allocation Check for Draft Enforcement
// ═══════════════════════════════════════════════════════════════

export function useAllocationCheck(officeId: string | undefined) {
  const { data: overview } = useAllocationOverview(officeId);

  return {
    overview,
    canAllocateLbs: (proposedLbs: number): { allowed: boolean; message: string } => {
      if (!overview) return { allowed: true, message: '' };
      const unallocated = Number(overview.unallocated_lbs) || 0;
      if (proposedLbs > unallocated) {
        return {
          allowed: false,
          message: `This production (${proposedLbs} lbs) exceeds unallocated raw inventory (${unallocated.toFixed(1)} lbs). Adjust allocation or procure more tobacco.`,
        };
      }
      return { allowed: true, message: '' };
    },
    bufferRisk: overview
      ? (Number(overview.unallocated_pct) || 0) < 10
      : false,
  };
}
