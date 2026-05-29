import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { parseRLSError } from '@/lib/rls-error-handler';
import { isFieldRole, FieldRole, UpdateMethod } from '@/services/fieldGovernance/types';
import { submitFieldChange, GOVERNANCE_STRICT_MODE } from '@/services/fieldGovernance/submitFieldChange';
export const TUBE_BRANDS = [
  { id: 'gasmask', name: 'GasMask Bags', color: '#EF4444' },
  { id: 'gasmasktubes', name: 'GasMask Tubes', color: '#3B82F6' },
  { id: 'hotmama', name: 'HotMama', color: '#EC4899' },
  { id: 'grabba_r_us', name: 'Grabba R Us', color: '#A855F7' },
  { id: 'hotscolatti-light', name: 'Hotscolatti Light', color: '#FBBF24' },
  { id: 'hotscolatti-dark', name: 'Hotscolatti Dark', color: '#92400E' },
] as const;

export type TubeBrandId = typeof TUBE_BRANDS[number]['id'];

export interface TubeIntelStatus {
  id: string;
  store_id: string;
  brand_id: string;
  brand_name: string;
  current_tubes_left: number | null;
  last_order_date: string | null;
  product_introduced: boolean;
  owner_interested: boolean | null;
  needs_order: boolean;
  bring_samples: boolean;
  bring_starter_kit: boolean;
  needs_switch: boolean;
  switch_quantity: number | null;
  switch_notes: string | null;
  switch_flagged_at: string | null;
  switch_flagged_by: string | null;
  has_ever_ordered: boolean;
  starter_kit_delivered: boolean;
  last_updated_by: string | null;
  last_updated_by_role: string | null;
  last_updated_at: string;
  last_updated_method: string | null;
  is_simulation: boolean;
}

export interface TubeIntelUpdatePayload {
  id?: string;
  store_id: string;
  brand_id: string;
  field: keyof Pick<TubeIntelStatus, 
    'product_introduced' | 'owner_interested' | 'needs_order' | 
    'bring_samples' | 'bring_starter_kit' | 'starter_kit_delivered' | 'needs_switch' |
    'switch_quantity' | 'switch_notes'
  >;
  value: boolean | number | string | null;
  role?: TubeIntelRole;
  update_method?: UpdateMethod;
}

// Role-based field editability
export type TubeIntelRole = 'admin' | 'va' | 'ambassador' | 'biker' | 'driver';

// Updated permissions - all field users can set interest + action signals
export const ROLE_FIELD_PERMISSIONS: Record<TubeIntelRole, string[]> = {
  admin: ['product_introduced', 'owner_interested', 'needs_order', 'bring_samples', 'bring_starter_kit', 'starter_kit_delivered', 'needs_switch'],
  va: ['product_introduced', 'owner_interested', 'needs_order', 'bring_samples', 'bring_starter_kit', 'starter_kit_delivered', 'needs_switch'],
  ambassador: ['owner_interested', 'needs_order', 'bring_samples', 'bring_starter_kit', 'needs_switch'],
  biker: ['owner_interested', 'needs_order', 'bring_samples', 'bring_starter_kit', 'needs_switch'],
  driver: [], // Read-only
};

export function canEditField(role: TubeIntelRole, field: string): boolean {
  return ROLE_FIELD_PERMISSIONS[role]?.includes(field) ?? false;
}

/**
 * Hook to fetch tube intelligence status for a store
 */
export function useTubeIntelligence(storeId: string | null) {
  const { simulationMode } = useSimulationMode();
  const { user } = useAuth();
  const { role: userRole } = useUserRole();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tube-intelligence', storeId, simulationMode],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_simulation', simulationMode)
        .order('brand_name');

      if (error) throw error;
      return data as TubeIntelStatus[];
    },
    enabled: !!storeId,
  });

  // Initialize missing brands for a store
  const initializeBrands = useMutation({
    mutationFn: async (storeId: string) => {
      const existing = query.data || [];
      const existingBrandIds = new Set(existing.map(e => e.brand_id));
      
      const missingBrands = TUBE_BRANDS.filter(b => !existingBrandIds.has(b.id));
      
      if (missingBrands.length === 0) return [];

      const inserts = missingBrands.map(brand => ({
        store_id: storeId,
        brand_id: brand.id,
        brand_name: brand.name,
        is_simulation: simulationMode,
      }));

      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .insert(inserts)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
    },
  });

  // Update a single field with role attribution and governance
  const updateField = useMutation({
    mutationFn: async (payload: TubeIntelUpdatePayload) => {
      const { id, store_id, brand_id, field, value, role, update_method } = payload;
      const effectiveRole = role || userRole;
      const effectiveMethod: string = update_method || 'system';

      // For field roles, route through governance FIRST
      if (user?.id && isFieldRole(effectiveRole)) {
        // Fetch current state for diff
        let payloadBefore: Record<string, unknown> | null = null;
        if (id) {
          const { data } = await supabase
            .from('store_tube_inventory_status')
            .select('*')
            .eq('id', id)
            .single();
          payloadBefore = data as Record<string, unknown> | null;
        }
        
        const payloadAfter = { brand_id, field, value, update_method: effectiveMethod };
        
        const result = await submitFieldChange(
          {
            store_id,
            entity_type: 'tube_inventory',
            action_type: id ? 'update' : 'create',
            entity_id: id,
            payload_before: payloadBefore || undefined,
            payload_after: payloadAfter,
            update_method: effectiveMethod as UpdateMethod,
          },
          user.id,
          effectiveRole as FieldRole
        );
        
        // In STRICT mode, do NOT execute mutation - submission only
        if (GOVERNANCE_STRICT_MODE) {
          if (!result.success) {
            throw new Error(result.error || 'Governance submission failed');
          }
          return { governed: true, submissionId: result.submissionId };
        }
      }

      // Non-field roles: execute mutation directly
      if (id) {
        const updatePayload: Record<string, unknown> = { 
          [field]: value,
          last_updated_by_role: effectiveRole || null,
          last_updated_at: new Date().toISOString(),
          last_updated_method: effectiveMethod,
        };
        // When toggling switch off, clear quantity/notes/flagged fields
        if (field === 'needs_switch' && value === false) {
          updatePayload.switch_quantity = null;
          updatePayload.switch_notes = null;
          updatePayload.switch_flagged_at = null;
          updatePayload.switch_flagged_by = null;
        }
        // When toggling switch on, set flagged timestamp
        if (field === 'needs_switch' && value === true) {
          updatePayload.switch_flagged_at = new Date().toISOString();
          updatePayload.switch_flagged_by = user?.id || null;
        }
        // When setting switch_quantity, also set flagged fields if not already set
        if (field === 'switch_quantity' && value && Number(value) > 0) {
          updatePayload.needs_switch = true;
          updatePayload.switch_flagged_at = new Date().toISOString();
          updatePayload.switch_flagged_by = user?.id || null;
        }
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .update(updatePayload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const brand = TUBE_BRANDS.find(b => b.id === brand_id);
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .insert({
            store_id,
            brand_id,
            brand_name: brand?.name || brand_id,
            [field]: value,
            last_updated_by_role: effectiveRole || null,
            last_updated_method: effectiveMethod,
            is_simulation: simulationMode,
          });
        if (error) throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
      
      // Check if this was a governed submission
      if (result && typeof result === 'object' && 'governed' in result) {
        toast.info('Change submitted for review');
      } else {
        toast.success('Updated');
      }
    },
    onError: (error: Error) => {
      const parsed = parseRLSError(error);
      toast.error(parsed.title, { description: parsed.description });
    },
  });


  return {
    data: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    initializeBrands,
    updateField,
  };
}

/**
 * Hook to fetch global tube intelligence with filters
 */
export interface TubeIntelFilters {
  needsOrder?: boolean;
  bringSamples?: boolean;
  bringStarterKit?: boolean;
  needsSwitch?: boolean;
  interested?: boolean;
  notInterested?: boolean;
  notAsked?: boolean;
  // Legacy filters (for backward compatibility)
  notIntroduced?: boolean;
  introducedNotInterested?: boolean;
  brandId?: string;
  lastOrderDaysAgo?: number;
  ambassadorId?: string;
  routeId?: string;
  borough?: string;
}

export function useGlobalTubeIntelligence(filters: TubeIntelFilters = {}) {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['global-tube-intelligence', filters, simulationMode],
    queryFn: async () => {
      let query = supabase
        .from('store_tube_inventory_status')
        .select(`
          *,
          store:store_master!inner(
            id,
            store_name,
            city,
            state,
            borough_id,
            health_status
          )
        `)
        .eq('is_simulation', simulationMode);

      // Apply filters
      if (filters.needsOrder) {
        query = query.eq('needs_order', true);
      }
      if (filters.bringSamples) {
        query = query.eq('bring_samples', true);
      }
      if (filters.bringStarterKit) {
        query = query.eq('bring_starter_kit', true);
      }
      if (filters.needsSwitch) {
        query = query.eq('needs_switch', true);
      }
      // New interest-based filters
      if (filters.interested) {
        query = query.eq('owner_interested', true);
      }
      if (filters.notInterested) {
        query = query.eq('owner_interested', false);
      }
      if (filters.notAsked) {
        query = query.is('owner_interested', null);
      }
      // Legacy filters (kept for backward compatibility)
      if (filters.notIntroduced) {
        query = query.eq('product_introduced', false);
      }
      if (filters.introducedNotInterested) {
        query = query.eq('product_introduced', true).eq('owner_interested', false);
      }
      if (filters.brandId) {
        query = query.eq('brand_id', filters.brandId);
      }
      if (filters.lastOrderDaysAgo) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - filters.lastOrderDaysAgo);
        query = query.or(`last_order_date.lt.${cutoffDate.toISOString().split('T')[0]},last_order_date.is.null`);
      }

      const { data, error } = await query.order('brand_name');

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to get tube intel summary counts
 * Updated to include interested/not_interested/not_asked counts
 */
export function useTubeIntelSummary() {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['tube-intel-summary', simulationMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('needs_order, bring_samples, bring_starter_kit, needs_switch, switch_quantity, product_introduced, owner_interested')
        .eq('is_simulation', simulationMode);

      if (error) throw error;

      const summary = {
        needsOrder: 0,
        bringSamples: 0,
        bringStarterKit: 0,
        needsSwitch: 0,
        totalSwitchQuantity: 0,
        interested: 0,
        notInterested: 0,
        notAsked: 0,
        // Legacy fields (kept for backward compatibility)
        notIntroduced: 0,
        introducedNotInterested: 0,
        total: data?.length || 0,
      };

      data?.forEach(item => {
        if (item.needs_order) summary.needsOrder++;
        if (item.bring_samples) summary.bringSamples++;
        if (item.bring_starter_kit) summary.bringStarterKit++;
        if (item.needs_switch) {
          summary.needsSwitch++;
          summary.totalSwitchQuantity += (item as any).switch_quantity || 0;
        }
        
        // New interest-based counts
        if (item.owner_interested === true) summary.interested++;
        else if (item.owner_interested === false) summary.notInterested++;
        else summary.notAsked++;
        
        // Legacy counts (for backward compatibility)
        if (!item.product_introduced) summary.notIntroduced++;
        if (item.product_introduced && item.owner_interested === false) summary.introducedNotInterested++;
      });

      return summary;
    },
  });
}
