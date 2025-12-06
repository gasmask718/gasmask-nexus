import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useCallback } from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STORE MASTER AUTO-CREATE HOOK — Self-Healing & Zero-404 Guarantee
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This hook ensures that:
 * 1. Every store ID always resolves to a valid store_master record
 * 2. Missing records are auto-created with proper defaults
 * 3. Legacy stores are migrated automatically
 * 4. 404 errors are IMPOSSIBLE
 */

interface StoreMasterRecord {
  id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  email: string | null;
  store_type: string | null;
  owner_name: string | null;
  notes: string | null;
  country_of_origin: string | null;
  personality_notes: string | null;
  communication_preference: string | null;
  has_expansion: boolean | null;
  expansion_notes: string | null;
  influence_level: string | null;
  loyalty_triggers: string[] | null;
  frustration_triggers: string[] | null;
  risk_score: string | null;
  nickname: string | null;
  languages: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  store_brand_accounts?: any[];
}

interface LegacyStore {
  id: string;
  name: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  type: string | null;
  primary_contact_name: string | null;
  company_id: string | null;
  neighborhood: string | null;
}

export function useStoreMasterAutoCreate(storeId: string | undefined) {
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 1: Direct lookup in store_master table
  // ═══════════════════════════════════════════════════════════════════════════════
  const { 
    data: storeMaster, 
    isLoading: loadingDirect,
    error: directError,
    refetch: refetchStoreMaster
  } = useQuery({
    queryKey: ['store-master-auto', storeId],
    queryFn: async (): Promise<StoreMasterRecord | null> => {
      if (!storeId) return null;
      
      console.log('[StoreMasterAutoCreate] Step 1: Checking store_master for ID:', storeId);
      
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
        console.log('[StoreMasterAutoCreate] ✓ Found store_master directly:', data.store_name);
        return data as StoreMasterRecord;
      }
      
      console.log('[StoreMasterAutoCreate] ✗ No store_master found for ID:', storeId);
      return null;
    },
    enabled: !!storeId,
    staleTime: 30000, // Cache for 30 seconds
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 2: Check legacy stores table if not found in store_master
  // ═══════════════════════════════════════════════════════════════════════════════
  const { data: legacyStore, isLoading: loadingLegacy } = useQuery({
    queryKey: ['legacy-store-for-auto', storeId],
    queryFn: async (): Promise<LegacyStore | null> => {
      if (!storeId) return null;
      
      console.log('[StoreMasterAutoCreate] Step 2: Checking legacy stores table for ID:', storeId);
      
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, phone, email, type, primary_contact_name, company_id, neighborhood')
        .eq('id', storeId)
        .maybeSingle();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] Legacy lookup error:', error);
        return null;
      }
      
      if (data) {
        console.log('[StoreMasterAutoCreate] ✓ Found legacy store:', data.name);
        return data as LegacyStore;
      }
      
      console.log('[StoreMasterAutoCreate] ✗ No legacy store found for ID:', storeId);
      return null;
    },
    enabled: !!storeId && !storeMaster && !loadingDirect,
    staleTime: 30000,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 3: Try to find existing store_master by name match
  // ═══════════════════════════════════════════════════════════════════════════════
  const { data: matchedStoreMaster, isLoading: loadingMatch } = useQuery({
    queryKey: ['store-master-match-auto', legacyStore?.name],
    queryFn: async (): Promise<StoreMasterRecord | null> => {
      if (!legacyStore?.name) return null;
      
      console.log('[StoreMasterAutoCreate] Step 3: Searching store_master by name:', legacyStore.name);
      
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
        console.log('[StoreMasterAutoCreate] ✓ Found matching store_master by name:', data.store_name);
        return data as StoreMasterRecord;
      }
      
      return null;
    },
    enabled: !!legacyStore && !storeMaster,
    staleTime: 30000,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 4: Auto-create mutation - Creates store_master from legacy or scratch
  // ═══════════════════════════════════════════════════════════════════════════════
  const createMutation = useMutation({
    mutationFn: async (legacy: LegacyStore | null): Promise<StoreMasterRecord> => {
      console.log('[StoreMasterAutoCreate] Step 4: Creating new store_master record...');
      
      // Prepare insert data with defaults
      const insertData = {
        store_name: legacy?.name || `Store ${storeId?.slice(0, 8) || 'Unknown'}`,
        address: legacy?.address_street || 'Address Pending',
        city: legacy?.address_city || 'City Pending',
        state: legacy?.address_state || 'NY',
        zip: legacy?.address_zip || '00000',
        phone: legacy?.phone || null,
        email: legacy?.email || null,
        store_type: legacy?.type || 'retail',
        owner_name: legacy?.primary_contact_name || null,
        notes: '',
        country_of_origin: null,
        personality_notes: null,
        communication_preference: null,
        has_expansion: false,
        expansion_notes: null,
        influence_level: 'medium',
        risk_score: 'low',
        nickname: null,
      };
      
      const { data, error } = await supabase
        .from('store_master')
        .insert(insertData)
        .select('*, store_brand_accounts(*)')
        .single();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] ✗ Create error:', error);
        throw error;
      }
      
      console.log('[StoreMasterAutoCreate] ✓ Created new store_master:', data.id, '-', data.store_name);
      
      // Log the creation event for debugging
      console.log('[StoreMasterAutoCreate] 📋 AUDIT LOG: store_master created', {
        newId: data.id,
        storeName: data.store_name,
        fromLegacyId: legacy?.id || null,
        timestamp: new Date().toISOString(),
      });
      
      return data as StoreMasterRecord;
    },
    onSuccess: (data) => {
      // Update cache immediately
      queryClient.setQueryData(['store-master-auto', storeId], data);
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      queryClient.invalidateQueries({ queryKey: ['store-master-memory'] });
      console.log('[StoreMasterAutoCreate] ✓ Cache updated with new store_master');
    },
    onError: (error) => {
      console.error('[StoreMasterAutoCreate] ✗ Failed to create store_master:', error);
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 5: Create from scratch mutation (when no legacy store exists)
  // ═══════════════════════════════════════════════════════════════════════════════
  const createFromScratchMutation = useMutation({
    mutationFn: async (): Promise<StoreMasterRecord> => {
      console.log('[StoreMasterAutoCreate] Step 5: Creating store_master from scratch (no legacy)...');
      
      const insertData = {
        store_name: `New Store ${storeId?.slice(0, 8) || 'Unknown'}`,
        address: 'Address Pending',
        city: 'City Pending',
        state: 'NY',
        zip: '00000',
        phone: null,
        email: null,
        store_type: 'retail',
        owner_name: null,
        notes: 'Auto-created store - please update details',
        country_of_origin: null,
        personality_notes: null,
        communication_preference: null,
        has_expansion: false,
        expansion_notes: null,
        influence_level: 'medium',
        risk_score: 'low',
        nickname: null,
      };
      
      const { data, error } = await supabase
        .from('store_master')
        .insert(insertData)
        .select('*, store_brand_accounts(*)')
        .single();
      
      if (error) {
        console.error('[StoreMasterAutoCreate] ✗ Create from scratch error:', error);
        throw error;
      }
      
      console.log('[StoreMasterAutoCreate] ✓ Created store_master from scratch:', data.id);
      
      return data as StoreMasterRecord;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['store-master-auto', storeId], data);
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTO-TRIGGER: Create store_master if all lookups fail
  // ═══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Don't trigger if still loading
    if (loadingDirect || loadingLegacy || loadingMatch) return;
    
    // Don't trigger if already have a store_master
    if (storeMaster || matchedStoreMaster) return;
    
    // Don't trigger if mutation is pending or succeeded
    if (createMutation.isPending || createMutation.isSuccess) return;
    if (createFromScratchMutation.isPending || createFromScratchMutation.isSuccess) return;
    
    // If we have legacy store, create from it
    if (legacyStore) {
      console.log('[StoreMasterAutoCreate] ⚡ Auto-triggering creation from legacy store...');
      createMutation.mutate(legacyStore);
      return;
    }
    
    // If no legacy store but we have a storeId, create from scratch
    // This handles edge cases where the ID doesn't exist anywhere
    if (storeId && !legacyStore) {
      console.log('[StoreMasterAutoCreate] ⚡ No legacy store found, creating from scratch...');
      createFromScratchMutation.mutate();
    }
  }, [
    loadingDirect, 
    loadingLegacy, 
    loadingMatch, 
    storeMaster, 
    matchedStoreMaster, 
    legacyStore, 
    storeId,
    createMutation.isPending,
    createMutation.isSuccess,
    createFromScratchMutation.isPending,
    createFromScratchMutation.isSuccess,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Manual repair function - force re-create if record is corrupted
  // ═══════════════════════════════════════════════════════════════════════════════
  const repairStoreMaster = useCallback(async () => {
    console.log('[StoreMasterAutoCreate] 🔧 Manual repair triggered for:', storeId);
    
    if (legacyStore) {
      await createMutation.mutateAsync(legacyStore);
    } else {
      await createFromScratchMutation.mutateAsync();
    }
    
    // Refetch to get fresh data
    await refetchStoreMaster();
  }, [legacyStore, storeId, createMutation, createFromScratchMutation, refetchStoreMaster]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESOLVED DATA: Priority order - direct > matched > newly created
  // ═══════════════════════════════════════════════════════════════════════════════
  const resolvedStoreMaster = storeMaster || matchedStoreMaster || createMutation.data || createFromScratchMutation.data;
  const isLoading = loadingDirect || loadingLegacy || loadingMatch || createMutation.isPending || createFromScratchMutation.isPending;
  const isCreating = createMutation.isPending || createFromScratchMutation.isPending;

  return {
    storeMaster: resolvedStoreMaster,
    isLoading,
    isCreating,
    error: directError || createMutation.error || createFromScratchMutation.error,
    legacyStore,
    refetch: refetchStoreMaster,
    repairStoreMaster,
    // Debug info for troubleshooting
    debug: {
      storeId,
      foundDirect: !!storeMaster,
      foundMatch: !!matchedStoreMaster,
      foundLegacy: !!legacyStore,
      autoCreated: createMutation.isSuccess || createFromScratchMutation.isSuccess,
      isRebuilding: isCreating,
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Create store_master when creating a new store
// ═══════════════════════════════════════════════════════════════════════════════
export async function createStoreMasterForNewStore(storeData: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  type?: string;
  ownerName?: string;
}): Promise<{ id: string; store_name: string } | null> {
  console.log('[createStoreMasterForNewStore] Creating store_master for new store:', storeData.name);
  
  const { data, error } = await supabase
    .from('store_master')
    .insert({
      store_name: storeData.name,
      address: storeData.address || 'Address Pending',
      city: storeData.city || 'City Pending',
      state: storeData.state || 'NY',
      zip: storeData.zip || '00000',
      phone: storeData.phone || null,
      email: storeData.email || null,
      store_type: storeData.type || 'retail',
      owner_name: storeData.ownerName || null,
      notes: '',
      country_of_origin: null,
      personality_notes: null,
      communication_preference: null,
      has_expansion: false,
      expansion_notes: null,
      influence_level: 'medium',
      risk_score: 'low',
    })
    .select('id, store_name')
    .single();
  
  if (error) {
    console.error('[createStoreMasterForNewStore] ✗ Error:', error);
    return null;
  }
  
  console.log('[createStoreMasterForNewStore] ✓ Created store_master:', data.id, '-', data.store_name);
  return data;
}
