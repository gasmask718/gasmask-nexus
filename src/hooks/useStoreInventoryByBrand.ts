import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BrandInventory {
  brand: string;
  tubes_remaining: number;
  last_updated: string | null;
}

export function useStoreInventoryByBrand(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['store-inventory-by-brand', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrandInventory[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_tube_inventory')
        .select('brand, current_tubes_left, last_updated')
        .eq('store_id', storeId)
        .neq('brand', 'hotscolatti');

      if (error) throw error;

      const byBrand = new Map<string, BrandInventory>();
      for (const row of data ?? []) {
        const existing = byBrand.get(row.brand) ?? {
          brand: row.brand,
          tubes_remaining: 0,
          last_updated: null as string | null,
        };
        existing.tubes_remaining += Number(row.current_tubes_left ?? 0);
        if (
          row.last_updated &&
          (!existing.last_updated || row.last_updated > existing.last_updated)
        ) {
          existing.last_updated = row.last_updated;
        }
        byBrand.set(row.brand, existing);
      }

      return Array.from(byBrand.values()).sort(
        (a, b) => b.tubes_remaining - a.tubes_remaining,
      );
    },
  });
}
