import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STORE MASTER AUTO-CREATE HOOK — RLS-safe (RPC chokepoint)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * All resolution + creation goes through the SECURITY DEFINER RPC
 * `resolve_or_create_store_master`. The RPC checks for existing rows with
 * RLS bypassed, so scoped users (e.g. ambassadors) can NEVER trigger a
 * duplicate row just because their RLS view hid the original.
 *
 * The previous client-side auto-INSERT useEffect has been REMOVED. Creation
 * must be explicit (via `repairStoreMaster` or `createStoreMasterForNewStore`).
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
}

export function useStoreMasterAutoCreate(storeId: string | undefined) {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();

  // Resolve via RPC (read-only — never creates). RLS-bypassed existence check.
  const {
    data: storeMaster,
    isLoading,
    error,
    refetch: refetchStoreMaster,
  } = useQuery({
    queryKey: ['store-master-auto', storeId],
    queryFn: async (): Promise<StoreMasterRecord | null> => {
      if (!storeId) return null;
      const { data, error } = await supabase.rpc('resolve_or_create_store_master', {
        _store_id: storeId,
        _allow_create: false,
      });
      if (error) {
        console.error('[StoreMasterAutoCreate] RPC resolve error:', error);
        throw error;
      }
      if (!data) return null;
      // Hydrate brand accounts in a follow-up query (RPC returns the row only).
      const { data: brands } = await supabase
        .from('store_brand_accounts')
        .select('*')
        .eq('store_master_id', (data as any).id);
      return { ...(data as any), store_brand_accounts: brands || [] } as StoreMasterRecord;
    },
    enabled: !!storeId,
    staleTime: 30000,
  });

  // Legacy lookup retained ONLY for components that need legacy fields.
  // Does NOT drive any auto-creation.
  const { data: legacyStore } = useQuery({
    queryKey: ['legacy-store-for-auto', storeId],
    queryFn: async (): Promise<LegacyStore | null> => {
      if (!storeId) return null;
      const { data } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, phone, email, type, primary_contact_name')
        .eq('id', storeId)
        .maybeSingle();
      return (data as LegacyStore) || null;
    },
    enabled: !!storeId && !storeMaster,
    staleTime: 30000,
  });

  // Explicit repair — only fires when a human action requests it.
  const repairMutation = useMutation({
    mutationFn: async (): Promise<StoreMasterRecord> => {
      const { data, error } = await supabase.rpc('resolve_or_create_store_master', {
        _store_id: storeId,
        _legacy_store_id: legacyStore?.id ?? null,
        _store_name: legacyStore?.name ?? null,
        _address: legacyStore?.address_street ?? null,
        _city: legacyStore?.address_city ?? null,
        _state: legacyStore?.address_state ?? null,
        _zip: legacyStore?.address_zip ?? null,
        _phone: legacyStore?.phone ?? null,
        _email: legacyStore?.email ?? null,
        _store_type: legacyStore?.type ?? null,
        _owner_name: legacyStore?.primary_contact_name ?? null,
        _is_simulation: simulationMode,
        _allow_create: true,
      });
      if (error) throw error;
      return data as StoreMasterRecord;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['store-master-auto', storeId], data);
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      queryClient.invalidateQueries({ queryKey: ['store-master-memory'] });
    },
  });

  const repairStoreMaster = useCallback(async () => {
    await repairMutation.mutateAsync();
    await refetchStoreMaster();
  }, [repairMutation, refetchStoreMaster]);

  return {
    storeMaster: storeMaster || null,
    isLoading,
    isCreating: repairMutation.isPending,
    error: error || repairMutation.error,
    legacyStore,
    refetch: refetchStoreMaster,
    repairStoreMaster,
    debug: {
      storeId,
      foundDirect: !!storeMaster,
      foundLegacy: !!legacyStore,
      autoCreated: false, // auto-create disabled
      isRebuilding: repairMutation.isPending,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Create store_master for a brand new store (admin/CSR flows).
// Goes through the same RPC chokepoint so dedup is honored.
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
  isSimulation?: boolean;
}): Promise<{ id: string; store_name: string } | null> {
  const { data, error } = await supabase.rpc('resolve_or_create_store_master', {
    _store_name: storeData.name,
    _address: storeData.address ?? null,
    _city: storeData.city ?? null,
    _state: storeData.state ?? null,
    _zip: storeData.zip ?? null,
    _phone: storeData.phone ?? null,
    _email: storeData.email ?? null,
    _store_type: storeData.type ?? null,
    _owner_name: storeData.ownerName ?? null,
    _is_simulation: storeData.isSimulation ?? false,
    _allow_create: true,
  });
  if (error) {
    console.error('[createStoreMasterForNewStore] RPC error:', error);
    return null;
  }
  if (!data) return null;
  return { id: (data as any).id, store_name: (data as any).store_name };
}
