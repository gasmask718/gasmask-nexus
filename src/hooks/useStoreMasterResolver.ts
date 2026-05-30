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
 * RLS-safe store_master resolver.
 *
 * All existence checks + creates flow through `resolve_or_create_store_master`
 * (SECURITY DEFINER) so scoped users (ambassadors etc.) never trigger a
 * duplicate row when their RLS view hides the original.
 */
export function useStoreMasterResolver(storeId: string | undefined | null) {
  const queryClient = useQueryClient();

  // Read-only resolve (allow_create = false). RLS-bypassed existence check.
  const { data: resolvedStoreMaster, isLoading: resolving } = useQuery({
    queryKey: ['store-master-resolve', storeId],
    queryFn: async (): Promise<ResolvedStoreMaster | null> => {
      if (!storeId) return null;
      const { data, error } = await supabase.rpc('resolve_or_create_store_master', {
        _store_id: storeId,
        _allow_create: false,
      });
      if (error) {
        console.error('[useStoreMasterResolver] RPC error:', error);
        return null;
      }
      if (!data) return null;
      const row = data as any;
      return {
        id: row.id,
        store_name: row.store_name,
        address: row.address,
        city: row.city,
        state: row.state,
      };
    },
    enabled: !!storeId,
  });

  // Legacy data still surfaced for components that need legacy fields.
  const { data: legacyStore, isLoading: loadingLegacy } = useQuery({
    queryKey: ['legacy-store-info', storeId],
    queryFn: async (): Promise<LegacyStore | null> => {
      if (!storeId) return null;
      const { data } = await supabase
        .from('stores')
        .select('name, address_street, address_city, address_state, address_zip, phone, email, type, primary_contact_name')
        .eq('id', storeId)
        .maybeSingle();
      return (data as LegacyStore) || null;
    },
    enabled: !!storeId && !resolvedStoreMaster,
  });

  // Explicit create — only when user-initiated (modal submit, etc.)
  const createStoreMaster = useMutation({
    mutationFn: async (): Promise<ResolvedStoreMaster> => {
      const { data, error } = await supabase.rpc('resolve_or_create_store_master', {
        _store_id: storeId ?? null,
        _store_name: legacyStore?.name ?? null,
        _address: legacyStore?.address_street ?? null,
        _city: legacyStore?.address_city ?? null,
        _state: legacyStore?.address_state ?? null,
        _zip: legacyStore?.address_zip ?? null,
        _phone: legacyStore?.phone ?? null,
        _email: legacyStore?.email ?? null,
        _store_type: legacyStore?.type ?? null,
        _owner_name: legacyStore?.primary_contact_name ?? null,
        _allow_create: true,
      });
      if (error) throw error;
      const row = data as any;
      return {
        id: row.id,
        store_name: row.store_name,
        address: row.address,
        city: row.city,
        state: row.state,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      queryClient.invalidateQueries({ queryKey: ['store-master-resolve'] });
    },
  });

  const isLoading = resolving || loadingLegacy;

  return {
    storeMasterId: resolvedStoreMaster?.id || null,
    storeMaster: resolvedStoreMaster ?? null,
    legacyStore,
    isLoading,
    isResolved: !!resolvedStoreMaster,
    needsCreation: !isLoading && !resolvedStoreMaster && !!legacyStore,
    createStoreMaster: async () => {
      return createStoreMaster.mutateAsync();
    },
    isCreating: createStoreMaster.isPending,
  };
}
