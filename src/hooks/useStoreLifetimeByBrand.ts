import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_TUBE_SKUS, type SkuStatus } from '@/lib/inventory/skuDisplay';
import { productIdForBrandId } from '@/lib/inventory/tubeSkuKeys';

export interface BrandLifetime {
  product_id: string;
  brand: string; // display name (kept for back-compat with hero chip key)
  display: string;
  parent_brand: string;
  order: number;
  tubes: number;
  percentage: number;
  status: SkuStatus;
  inventory_count: number;
}

/**
 * Lifetime tubes sold per SKU for a store. Always returns ALL 9 canonical SKUs,
 * with status indicating whether the store has bought / stocked / never offered each.
 */
export function useStoreLifetimeByBrand(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['store-lifetime-by-sku', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrandLifetime[]> => {
      if (!storeId) return [];

      // 1. Pre-populate all 9 SKUs at zero
      const result = new Map<string, BrandLifetime>();
      CANONICAL_TUBE_SKUS.forEach((sku) => {
        result.set(sku.product_id, {
          product_id: sku.product_id,
          brand: sku.display,
          display: sku.display,
          parent_brand: sku.parent_brand,
          order: sku.order,
          tubes: 0,
          percentage: 0,
          status: 'never_offered',
          inventory_count: 0,
        });
      });

      // 2. Sum line items per product_id
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('store_id', storeId)
        .is('deleted_at', null);
      if (error) throw error;

      if (invoices?.length) {
        const invoiceIds = invoices.map((i) => i.id);
        const { data: lineItems, error: liErr } = await supabase
          .from('invoice_line_items')
          .select('product_id, computed_tubes_total')
          .is('deleted_at', null)
          .in('invoice_id', invoiceIds);
        if (liErr) throw liErr;
        lineItems?.forEach((li) => {
          if (li.product_id && result.has(li.product_id)) {
            const row = result.get(li.product_id)!;
            row.tubes += Number(li.computed_tubes_total ?? 0);
          }
        });
      }

      // 3. Pull on-hand from the canonical status table, rolled up by product_id
      //    (store_tube_inventory is RETIRED; brand_id is the canonical SKU key).
      const { data: inventory } = await supabase
        .from('store_tube_inventory_status')
        .select('brand_id, current_tubes_left')
        .eq('store_id', storeId)
        .eq('is_simulation', false);

      const invByProductId = new Map<string, number>();
      inventory?.forEach((inv) => {
        const pid = productIdForBrandId(inv.brand_id);
        if (!pid) return;
        invByProductId.set(pid, (invByProductId.get(pid) ?? 0) + Number(inv.current_tubes_left ?? 0));
      });

      // 4. Compute percentages + statuses (per product_id, not brand string)
      const total = Array.from(result.values()).reduce((s, r) => s + r.tubes, 0);
      result.forEach((row) => {
        row.percentage = total > 0 ? Math.round((row.tubes / total) * 100) : 0;
        row.inventory_count = invByProductId.get(row.product_id) ?? 0;
        row.status = row.tubes > 0 ? 'bought' : row.inventory_count > 0 ? 'staged' : 'never_offered';
      });

      return Array.from(result.values()).sort((a, b) => a.order - b.order);
    },
  });
}
