import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

// Authoritative tube brands
export const TUBE_BRANDS = [
  { id: 'gasmask', name: 'GasMask Bags', color: '#EF4444' },
  { id: 'gasmasktubes', name: 'GasMask Tubes', color: '#3B82F6' },
  { id: 'hotmama', name: 'HotMama', color: '#EC4899' },
  { id: 'grabba', name: 'Grabba R Us', color: '#A855F7' },
  { id: 'hotscolatti-light', name: 'Hot Scolatti Light', color: '#FBBF24' },
  { id: 'hotscolatti-dark', name: 'Hot Scolatti Dark', color: '#92400E' },
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
  has_ever_ordered: boolean;
  starter_kit_delivered: boolean;
  last_updated_by: string | null;
  last_updated_by_role: string | null;
  last_updated_at: string;
  is_simulation: boolean;
}

export interface TubeIntelUpdatePayload {
  id?: string;
  store_id: string;
  brand_id: string;
  field: keyof Pick<TubeIntelStatus, 
    'product_introduced' | 'owner_interested' | 'needs_order' | 
    'bring_samples' | 'bring_starter_kit' | 'starter_kit_delivered'
  >;
  value: boolean | null;
  role?: TubeIntelRole;
}

// Role-based field editability
export type TubeIntelRole = 'admin' | 'va' | 'ambassador' | 'biker' | 'driver';

export const ROLE_FIELD_PERMISSIONS: Record<TubeIntelRole, string[]> = {
  admin: ['product_introduced', 'owner_interested', 'needs_order', 'bring_samples', 'bring_starter_kit', 'starter_kit_delivered'],
  va: ['product_introduced', 'owner_interested', 'needs_order', 'bring_samples', 'bring_starter_kit', 'starter_kit_delivered'],
  ambassador: ['product_introduced', 'owner_interested', 'needs_order', 'bring_samples'],
  biker: ['product_introduced', 'owner_interested', 'bring_samples', 'bring_starter_kit'],
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

  // Update a single field with role attribution
  const updateField = useMutation({
    mutationFn: async (payload: TubeIntelUpdatePayload) => {
      const { id, store_id, brand_id, field, value, role } = payload;

      // Check if record exists
      if (id) {
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .update({ 
            [field]: value,
            last_updated_by_role: role || null,
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        // Create new record
        const brand = TUBE_BRANDS.find(b => b.id === brand_id);
        const { error } = await supabase
          .from('store_tube_inventory_status')
          .insert({
            store_id,
            brand_id,
            brand_name: brand?.name || brand_id,
            [field]: value,
            last_updated_by_role: role || null,
            is_simulation: simulationMode,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tube-intelligence', storeId] });
      toast.success('Updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
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
 */
export function useTubeIntelSummary() {
  const { simulationMode } = useSimulationMode();

  return useQuery({
    queryKey: ['tube-intel-summary', simulationMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('needs_order, bring_samples, bring_starter_kit, product_introduced, owner_interested')
        .eq('is_simulation', simulationMode);

      if (error) throw error;

      const summary = {
        needsOrder: 0,
        bringSamples: 0,
        bringStarterKit: 0,
        notIntroduced: 0,
        introducedNotInterested: 0,
        total: data?.length || 0,
      };

      data?.forEach(item => {
        if (item.needs_order) summary.needsOrder++;
        if (item.bring_samples) summary.bringSamples++;
        if (item.bring_starter_kit) summary.bringStarterKit++;
        if (!item.product_introduced) summary.notIntroduced++;
        if (item.product_introduced && item.owner_interested === false) summary.introducedNotInterested++;
      });

      return summary;
    },
  });
}
