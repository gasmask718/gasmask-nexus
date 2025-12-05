import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ResolvedStoreMaster {
  id: string;
  store_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface LegacyStore {
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  type: string | null;
  primary_contact_name: string | null;
}

/**
 * Hook to resolve a store_master.id from either:
 * 1. A direct store_master.id
 * 2. A legacy stores table id (by matching name/address)
 */
export function useStoreMasterResolver(storeId: string | undefined | null) {
  const queryClient = useQueryClient();

  // First check if storeId is directly a store_master.id
  const { data: directMatch, isLoading: checkingDirect } = useQuery({
    queryKey: ['store-master-direct', storeId],
    queryFn: async (): Promise<ResolvedStoreMaster | null> => {
      if (!storeId) return null;
      const { data } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .eq('id', storeId)
        .single();
      return data;
    },
    enabled: !!storeId,
  });

  // If not direct, try to get legacy store info to match
  const { data: legacyStore, isLoading: loadingLegacy } = useQuery({
    queryKey: ['legacy-store-info', storeId],
    queryFn: async (): Promise<LegacyStore | null> => {
      if (!storeId) return null;
      const { data } = await supabase
        .from('stores')
        .select('name, address_street, address_city, address_state, address_zip, phone, email, type, primary_contact_name')
        .eq('id', storeId)
        .single();
      return data;
    },
    enabled: !!storeId && !directMatch,
  });

  // Try to find matching store_master by name + address
  const { data: matchedStoreMaster, isLoading: loadingMatch } = useQuery({
    queryKey: ['store-master-match', legacyStore?.name, legacyStore?.address_street],
    queryFn: async (): Promise<ResolvedStoreMaster | null> => {
      if (!legacyStore) return null;
      
      // Try matching by name first
      let query = supabase
        .from('store_master')
        .select('id, store_name, address, city, state')
        .ilike('store_name', legacyStore.name);
      
      // If we have an address, narrow down
      if (legacyStore.address_street) {
        query = query.ilike('address', `%${legacyStore.address_street.substring(0, 20)}%`);
      }
      
      const { data } = await query.limit(1).single();
      return data;
    },
    enabled: !!legacyStore && !directMatch,
  });

  // Mutation to create store_master record from legacy store
  const createStoreMaster = useMutation({
    mutationFn: async (legacy: LegacyStore): Promise<ResolvedStoreMaster> => {
      const { data, error } = await supabase
        .from('store_master')
        .insert({
          store_name: legacy.name,
          address: legacy.address_street,
          city: legacy.address_city,
          state: legacy.address_state,
          zip: legacy.address_zip,
          phone: legacy.phone,
          email: legacy.email,
          store_type: legacy.type,
          owner_name: legacy.primary_contact_name,
        })
        .select('id, store_name, address, city, state')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      queryClient.invalidateQueries({ queryKey: ['store-master-match'] });
    },
  });

  const isLoading = checkingDirect || loadingLegacy || loadingMatch;
  const resolvedStoreMaster = directMatch || matchedStoreMaster;
  
  return {
    storeMasterId: resolvedStoreMaster?.id || null,
    storeMaster: resolvedStoreMaster,
    legacyStore,
    isLoading,
    isResolved: !!resolvedStoreMaster,
    needsCreation: !isLoading && !resolvedStoreMaster && !!legacyStore,
    createStoreMaster: async () => {
      if (!legacyStore) throw new Error('No legacy store data');
      return createStoreMaster.mutateAsync(legacyStore);
    },
    isCreating: createStoreMaster.isPending,
  };
}
