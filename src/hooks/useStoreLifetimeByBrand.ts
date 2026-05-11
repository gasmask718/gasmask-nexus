import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { skuDisplayName } from '@/lib/inventory/skuDisplay';

export interface BrandLifetime {
  brand: string; // SKU display name (field name kept for backwards compat with hero chip)
  tubes: number;
  percentage: number;
}

/**
 * Lifetime tubes sold per SKU for a store.
 * Source of truth: invoice_line_items.product_id → products
 * (Owner decision: SKU-level breakdown, not parent brand. Roso deferred.)
 */
export function useStoreLifetimeByBrand(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['store-lifetime-by-sku', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrandLifetime[]> => {
      if (!storeId) return [];

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('store_id', storeId)
        .is('deleted_at', null);
      if (error) throw error;
      if (!invoices?.length) return [];

      const invoiceIds = invoices.map((i) => i.id);
      const { data: lineItems, error: liErr } = await supabase
        .from('invoice_line_items')
        .select('product_id, product_name, product_name_snapshot, computed_tubes_total')
        .in('invoice_id', invoiceIds);
      if (liErr) throw liErr;

      const bySku = new Map<string, number>();
      lineItems?.forEach((li) => {
        const key = skuDisplayName(li.product_id, li.product_name_snapshot ?? li.product_name);
        bySku.set(key, (bySku.get(key) ?? 0) + Number(li.computed_tubes_total ?? 0));
      });

      const total = Array.from(bySku.values()).reduce((s, v) => s + v, 0);
      return Array.from(bySku.entries())
        .filter(([, tubes]) => tubes > 0)
        .map(([brand, tubes]) => ({
          brand,
          tubes,
          percentage: total > 0 ? Math.round((tubes / total) * 100) : 0,
        }))
        .sort((a, b) => b.tubes - a.tubes);
    },
  });
}
