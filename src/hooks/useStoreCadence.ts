// ═══════════════════════════════════════════════════════════════════════════════
// STORE CADENCE HOOK — Manages outreach cadence policies for stores
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StoreCadencePolicy {
  id: string;
  store_id: string;
  enabled: boolean;
  cadence_days: number;
  text_first: boolean;
  max_texts_per_window: number;
  max_calls_per_window: number;
  allowed_hours_start: string;
  allowed_hours_end: string;
  owner_user_id: string | null;
  owner_team: string | null;
  created_at: string;
  updated_at: string;
}

export interface CadencePolicyInput {
  enabled?: boolean;
  cadence_days?: number;
  text_first?: boolean;
  max_texts_per_window?: number;
  max_calls_per_window?: number;
  allowed_hours_start?: string;
  allowed_hours_end?: string;
  owner_team?: string;
}

const QUERY_KEY = 'store-cadence-policy';

export function useStoreCadence(storeId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch cadence policy for a store
  const policyQuery = useQuery({
    queryKey: [QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('store_cadence_policy')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) throw error;
      return data as StoreCadencePolicy | null;
    },
    enabled: !!storeId,
  });

  // Create or update cadence policy
  const upsertPolicy = useMutation({
    mutationFn: async (input: CadencePolicyInput) => {
      if (!storeId) throw new Error('Store ID required');

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Check if policy exists
      const existing = policyQuery.data;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('store_cadence_policy')
          .update(input)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('store_cadence_policy')
          .insert({
            store_id: storeId,
            owner_user_id: user.user.id,
            ...input,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, storeId] });
      toast.success('Cadence policy saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save policy: ${error.message}`);
    },
  });

  // Toggle enabled state
  const toggleEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!storeId) throw new Error('Store ID required');

      const existing = policyQuery.data;

      if (existing) {
        const { error } = await supabase
          .from('store_cadence_policy')
          .update({ enabled })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create with enabled state
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('store_cadence_policy')
          .insert({
            store_id: storeId,
            enabled,
            owner_user_id: user.user?.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, storeId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  return {
    policy: policyQuery.data,
    isLoading: policyQuery.isLoading,
    error: policyQuery.error,
    upsertPolicy: upsertPolicy.mutateAsync,
    toggleEnabled: toggleEnabled.mutateAsync,
    isSaving: upsertPolicy.isPending || toggleEnabled.isPending,
  };
}

// Hook for fetching all stores with cadence enabled
export function useStoresDueCadence() {
  return useQuery({
    queryKey: [QUERY_KEY, 'due'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_cadence_policy')
        .select(`
          *,
          store:store_master(id, name, address)
        `)
        .eq('enabled', true);

      if (error) throw error;
      return data || [];
    },
  });
}
