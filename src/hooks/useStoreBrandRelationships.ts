import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CANONICAL_BRAND_IDS, CANONICAL_BRANDS, type CanonicalBrandId } from '@/config/brands';

export type PaymentType = 'pay_upfront' | 'bill_to_bill';
export type SamplingStatus = 'none' | 'samples_given' | 'trialing' | 'converted';
export type RelationshipHealth = 'healthy' | 'at_risk' | 'paused' | 'terminated' | 'trialing';

export interface StoreBrandRelationship {
  id: string;
  store_id: string;
  brand_id: string;
  is_active: boolean;
  payment_type: PaymentType;
  /** When false, no Pay Upfront / Bill to Bill choice has been made yet (#52/53). */
  payment_type_chosen: boolean;
  needs_starter_kit: boolean;
  starter_kit_sent: boolean;
  starter_kit_date: string | null;
  sampling_status: SamplingStatus;
  relationship_health: RelationshipHealth;
  brand_activated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Canonical DB brand IDs — derived from single source of truth */
export const STORE_BRAND_IDS = CANONICAL_BRAND_IDS;
export type StoreBrandId = CanonicalBrandId;

/** Map DB brand_id → display info — derived from canonical registry */
export const BRAND_DISPLAY: Record<StoreBrandId, { name: string; icon: string; color: string }> = Object.fromEntries(
  CANONICAL_BRAND_IDS.map(id => [id, {
    name: CANONICAL_BRANDS[id].displayName,
    icon: CANONICAL_BRANDS[id].icon,
    color: CANONICAL_BRANDS[id].primaryColor,
  }])
) as Record<StoreBrandId, { name: string; icon: string; color: string }>;

export function useStoreBrandRelationships(storeId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['store-brand-relationships', storeId];

  const { data: relationships = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // Ensure rows exist first
      const { error: seedErr } = await supabase.rpc('ensure_store_brand_relationships', {
        p_store_id: storeId,
      });
      if (seedErr) console.warn('Seed warning:', seedErr.message);

      const { data, error } = await supabase
        .from('store_brand_relationships')
        .select('*')
        .eq('store_id', storeId)
        .order('brand_id');

      if (error) throw error;
      return (data || []) as StoreBrandRelationship[];
    },
    enabled: !!storeId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StoreBrandRelationship> }) => {
      const { data, error } = await supabase
        .from('store_brand_relationships')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<StoreBrandRelationship[]>(queryKey);
      queryClient.setQueryData<StoreBrandRelationship[]>(queryKey, (old) =>
        (old || []).map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast.error('Failed to update brand relationship');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { relationships, isLoading, error, updateRelationship: updateMutation.mutate };
}
