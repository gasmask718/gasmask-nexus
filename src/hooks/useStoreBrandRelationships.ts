import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaymentType = 'pay_upfront' | 'bill_to_bill' | 'net7' | 'net14' | 'cod';
export type SamplingStatus = 'none' | 'samples_given' | 'trialing' | 'converted';
export type RelationshipHealth = 'healthy' | 'at_risk' | 'paused' | 'terminated';

export interface StoreBrandRelationship {
  id: string;
  store_id: string;
  brand_id: string;
  is_active: boolean;
  payment_type: PaymentType;
  needs_starter_kit: boolean;
  starter_kit_sent: boolean;
  starter_kit_date: string | null;
  sampling_status: SamplingStatus;
  relationship_health: RelationshipHealth;
  created_at: string;
  updated_at: string;
}

/** Canonical DB brand IDs */
export const STORE_BRAND_IDS = ['gasmask', 'grabba_r_us', 'hotmama', 'hotscolatti'] as const;
export type StoreBrandId = (typeof STORE_BRAND_IDS)[number];

/** Map DB brand_id → display info */
export const BRAND_DISPLAY: Record<StoreBrandId, { name: string; icon: string; color: string }> = {
  gasmask: { name: 'GasMask', icon: '🔴', color: 'hsl(0, 84%, 60%)' },
  hotmama: { name: 'HotMama', icon: '💖', color: 'hsl(330, 100%, 65%)' },
  hotscolatti: { name: 'Hot Scolatti', icon: '🟠', color: 'hsl(30, 100%, 50%)' },
  grabba_r_us: { name: 'Grabba R Us', icon: '🟪', color: 'hsl(270, 70%, 53%)' },
};

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
