import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_TUBE_SKUS, type SkuStatus } from '@/lib/inventory/skuDisplay';
import { productIdForBrandId } from '@/lib/inventory/tubeSkuKeys';

export interface SkuInventoryRow {
  product_id: string;
  display: string;
  parent_brand: string;
  order: number;
  tubes_remaining: number;
  last_updated: string | null;
  status: SkuStatus;
  needs_operator_verification: boolean;
}

/**
 * Returns ALL 9 canonical SKUs for a store (always emits the full list, even
 * when there's no inventory row for a given SKU). Status icon (🟢🟡🔴) is
 * derived inline so the Stock chip can render with one read.
 *
 * Source of truth: public.store_tube_inventory_status (store_tube_inventory is RETIRED).
 *
 * - tubes_remaining > 0  → 🟢 'bought'  (in stock)
 * - tubes_remaining = 0 but row exists → 🟡 'staged' (counted, depleted)
 * - no row at all        → 🔴 'never_offered'
 */
export function useStoreInventoryBySku(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['store-inventory-by-sku', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<SkuInventoryRow[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_tube_inventory_status')
        .select('brand_id, current_tubes_left, last_updated_at, tubes_updated_at')
        .eq('store_id', storeId)
        .eq('is_simulation', false);

      if (error) throw error;

      // Bucket rows by product_id (resolving canonical brand_id → product_id).
      const byProductId = new Map<string, { tubes: number; last_updated: string | null; needs_verification: boolean }>();
      for (const row of (data ?? []) as any[]) {
        const pid = productIdForBrandId(row.brand_id);
        if (!pid) continue;
        const existing = byProductId.get(pid) ?? { tubes: 0, last_updated: null, needs_verification: false };
        existing.tubes += Number(row.current_tubes_left ?? 0);
        const stamp = row.tubes_updated_at ?? row.last_updated_at ?? null;
        if (stamp && (!existing.last_updated || stamp > existing.last_updated)) {
          existing.last_updated = stamp;
        }
        byProductId.set(pid, existing);
      }


      return CANONICAL_TUBE_SKUS.map((sku) => {
        const bucket = byProductId.get(sku.product_id);
        const tubes = bucket?.tubes ?? 0;
        const status: SkuStatus = !bucket ? 'never_offered' : tubes > 0 ? 'bought' : 'staged';
        return {
          product_id: sku.product_id,
          display: sku.display,
          parent_brand: sku.parent_brand,
          order: sku.order,
          tubes_remaining: tubes,
          last_updated: bucket?.last_updated ?? null,
          status,
          needs_operator_verification: bucket?.needs_verification ?? false,
        };
      }).sort((a, b) => a.order - b.order);
    },
  });
}
