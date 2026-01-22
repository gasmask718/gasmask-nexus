import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetch all stores for selection dropdown
export function useStoreOptions() {
  return useQuery({
    queryKey: ['store-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('id, store_name, city, state')
        .order('store_name');
      if (error) throw error;
      return data || [];
    },
  });
}

// Fetch stores assigned to a product
export function useProductAssignedStores(productId?: string) {
  return useQuery({
    queryKey: ['product-assigned-stores', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from('product_store_assignments' as any)
        .select('store_id')
        .eq('product_id', productId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((d: any) => d.store_id as string);
    },
    enabled: !!productId,
  });
}

// Get product counts per store
export function useStoreProductCounts() {
  return useQuery({
    queryKey: ['store-product-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_store_assignments' as any)
        .select('store_id')
        .eq('is_active', true);
      if (error) throw error;
      
      // Aggregate counts by store
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.store_id] = (counts[row.store_id] || 0) + 1;
      });
      return counts;
    },
  });
}

// Mutation to assign stores to a product
export function useAssignStoresToProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, storeIds }: { productId: string; storeIds: string[] }) => {
      // Get existing assignments
      const { data: existing, error: fetchError } = await supabase
        .from('product_store_assignments' as any)
        .select('store_id, is_active')
        .eq('product_id', productId);
      if (fetchError) throw fetchError;

      const existingStoreIds = (existing || [])
        .filter((e: any) => e.is_active)
        .map((e: any) => e.store_id as string);
      const allExistingIds = (existing || []).map((e: any) => e.store_id as string);

      const toAdd = storeIds.filter(id => !allExistingIds.includes(id));
      const toReactivate = storeIds.filter(id => allExistingIds.includes(id) && !existingStoreIds.includes(id));
      const toDeactivate = existingStoreIds.filter(id => !storeIds.includes(id));

      // Insert new assignments
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('product_store_assignments' as any)
          .insert(toAdd.map(storeId => ({
            product_id: productId,
            store_id: storeId,
            is_active: true,
          })));
        if (error) throw error;
      }

      // Reactivate previously deactivated
      if (toReactivate.length > 0) {
        const { error } = await supabase
          .from('product_store_assignments' as any)
          .update({ is_active: true })
          .eq('product_id', productId)
          .in('store_id', toReactivate);
        if (error) throw error;
      }

      // Deactivate removed
      if (toDeactivate.length > 0) {
        const { error } = await supabase
          .from('product_store_assignments' as any)
          .update({ is_active: false })
          .eq('product_id', productId)
          .in('store_id', toDeactivate);
        if (error) throw error;
      }

      return { added: toAdd.length, reactivated: toReactivate.length, deactivated: toDeactivate.length };
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-assigned-stores', productId] });
      queryClient.invalidateQueries({ queryKey: ['store-product-counts'] });
    },
  });
}
