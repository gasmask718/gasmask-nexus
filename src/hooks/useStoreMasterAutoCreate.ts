import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

/**
 * Self-healing hook that:
 * 1. Checks if storeId exists in store_master table
 * 2. If not, checks if it's a legacy stores table ID
 * 3. If legacy, finds or creates the corresponding store_master record
 * 4. Returns the resolved store_master data
 * 
 * This ensures Store Master Profile NEVER returns 404.
 */
export function useStoreMasterAutoCreate(storeId: string | undefined) {
  const queryClient = useQueryClient();

  // Step 1: Try to fetch directly from store_master
  const { 
    data: storeMaster, 
    isLoading: loadingDirect,
    error: directError,
    refetch: refetchStoreMaster
  } = useQuery({
    queryKey: ['store-master-auto', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      console.log('[StoreMasterAutoCreate] Checking store_master for:', storeId);
      
      const { data, error } = await supabase
        .from('store_master')
        .select('*, store_brand_accounts(*)')
        .eq('id', storeId)
        .maybeSingle();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] Direct lookup error:', error);
        throw error;
      }
      
      if (data) {
        console.log('[StoreMasterAutoCreate] Found store_master directly:', data.store_name);
        return data;
      }
      
      return null;
    },
    enabled: !!storeId,
  });

  // Step 2: If not found in store_master, check legacy stores table
  const { data: legacyStore, isLoading: loadingLegacy } = useQuery({
    queryKey: ['legacy-store-for-auto', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      console.log('[StoreMasterAutoCreate] Checking legacy stores table for:', storeId);
      
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, phone, email, type, primary_contact_name, company_id, neighborhood')
        .eq('id', storeId)
        .maybeSingle();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] Legacy lookup error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!storeId && !storeMaster && !loadingDirect,
  });

  // Step 3: Try to find existing store_master by name match
  const { data: matchedStoreMaster, isLoading: loadingMatch } = useQuery({
    queryKey: ['store-master-match-auto', legacyStore?.name],
    queryFn: async () => {
      if (!legacyStore?.name) return null;
      
      console.log('[StoreMasterAutoCreate] Searching store_master by name:', legacyStore.name);
      
      const { data, error } = await supabase
        .from('store_master')
        .select('*, store_brand_accounts(*)')
        .ilike('store_name', legacyStore.name)
        .maybeSingle();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] Match lookup error:', error);
        return null;
      }
      
      if (data) {
        console.log('[StoreMasterAutoCreate] Found matching store_master:', data.store_name);
      }
      
      return data;
    },
    enabled: !!legacyStore && !storeMaster,
  });

  // Step 4: Auto-create mutation if nothing found
  const createMutation = useMutation({
    mutationFn: async (legacy: NonNullable<typeof legacyStore>) => {
      if (!legacy) throw new Error('No legacy store data to create from');
      
      console.log('[StoreMasterAutoCreate] Creating new store_master from legacy:', legacy.name);
      
      const { data, error } = await supabase
        .from('store_master')
        .insert({
          store_name: legacy.name || 'Unknown Store',
          address: legacy.address_street,
          city: legacy.address_city,
          state: legacy.address_state,
          zip: legacy.address_zip,
          phone: legacy.phone,
          email: legacy.email,
          store_type: legacy.type,
          owner_name: legacy.primary_contact_name,
          notes: '',
          country: '',
          important_details: '',
        })
        .select('*, store_brand_accounts(*)')
        .single();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] Create error:', error);
        throw error;
      }
      
      console.log('[StoreMasterAutoCreate] Created new store_master:', data.id);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['store-master-auto', storeId], data);
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
    },
  });

  // Auto-trigger creation if we have legacy store but no store_master
  useEffect(() => {
    const shouldAutoCreate = 
      !loadingDirect && 
      !loadingLegacy && 
      !loadingMatch &&
      !storeMaster && 
      !matchedStoreMaster && 
      legacyStore && 
      !createMutation.isPending &&
      !createMutation.isSuccess;

    if (shouldAutoCreate) {
      console.log('[StoreMasterAutoCreate] Auto-creating store_master...');
      createMutation.mutate(legacyStore);
    }
  }, [loadingDirect, loadingLegacy, loadingMatch, storeMaster, matchedStoreMaster, legacyStore, createMutation]);

  // Resolved data priority: direct > matched > newly created
  const resolvedStoreMaster = storeMaster || matchedStoreMaster || createMutation.data;
  const isLoading = loadingDirect || loadingLegacy || loadingMatch || createMutation.isPending;

  return {
    storeMaster: resolvedStoreMaster,
    isLoading,
    isCreating: createMutation.isPending,
    error: directError || createMutation.error,
    legacyStore,
    refetch: refetchStoreMaster,
    // Debug info
    debug: {
      foundDirect: !!storeMaster,
      foundMatch: !!matchedStoreMaster,
      foundLegacy: !!legacyStore,
      autoCreated: createMutation.isSuccess,
    }
  };
}
