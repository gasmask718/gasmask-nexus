import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_TUBE_SKUS, type SkuStatus } from '@/lib/inventory/skuDisplay';

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
          .in('invoice_id', invoiceIds);
        if (liErr) throw liErr;
        lineItems?.forEach((li) => {
          if (li.product_id && result.has(li.product_id)) {
            const row = result.get(li.product_id)!;
            row.tubes += Number(li.computed_tubes_total ?? 0);
          }
        });
      }

      // 3. Pull inventory (brand-level until Session 8 adds product_id)
      const { data: inventory } = await supabase
        .from('store_tube_inventory')
        .select('brand, current_tubes_left')
        .eq('store_id', storeId);

      const brandInv = new Map<string, number>();
      inventory?.forEach((inv) => {
        const key = (inv.brand || '').toLowerCase().replace(/\s+/g, '');
        brandInv.set(key, (brandInv.get(key) ?? 0) + Number(inv.current_tubes_left ?? 0));
      });

      // 4. Compute percentages + statuses
      const total = Array.from(result.values()).reduce((s, r) => s + r.tubes, 0);
      result.forEach((row) => {
        row.percentage = total > 0 ? Math.round((row.tubes / total) * 100) : 0;
        const sku = CANONICAL_TUBE_SKUS.find((s) => s.product_id === row.product_id)!;
        row.inventory_count = sku.inventory_keys.reduce((sum, k) => sum + (brandInv.get(k) ?? 0), 0);
        row.status = row.tubes > 0 ? 'bought' : row.inventory_count > 0 ? 'staged' : 'never_offered';
      });

      return Array.from(result.values()).sort((a, b) => a.order - b.order);
    },
  });
}
