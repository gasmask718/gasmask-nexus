import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreOpportunity {
  id: string;
  store_id: string;
  opportunity_text: string;
  is_completed: boolean;
  source: string;
  detected_from_note_id: string | null;
  detected_from_interaction_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    store_name: string;
    city: string | null;
  } | null;
}

export interface OpportunitySummary {
  total: number;
  pending: number;
  completed: number;
}

export function useStoreOpportunities(storeId?: string) {
  return useQuery({
    queryKey: ['store-opportunities', storeId],
    queryFn: async () => {
      let query = supabase
        .from('store_opportunities')
        .select(`
          *,
          store:store_master!store_id (
            id,
            store_name,
            city
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StoreOpportunity[];
    },
  });
}

export function useOpportunitiesSummary() {
  return useQuery({
    queryKey: ['opportunities-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_opportunities')
        .select('id, is_completed')
        .is('deleted_at', null);
      
      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter(o => o.is_completed).length || 0;
      const pending = total - completed;

      return { total, pending, completed } as OpportunitySummary;
    },
  });
}

export function useCompleteOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase
        .from('store_opportunities')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities-summary'] });
    },
  });
}

export function useReopenOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('store_opportunities')
        .update({
          is_completed: false,
          completed_at: null,
          completed_by: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities-summary'] });
    },
  });
}
