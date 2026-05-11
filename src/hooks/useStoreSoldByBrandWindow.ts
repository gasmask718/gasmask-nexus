import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { skuDisplayName } from '@/lib/inventory/skuDisplay';

export interface BrandWindowSold {
  brand: string; // SKU display name
  tubes: number;
}

export type SalesWindow = 'last_30_days' | 'prior_month' | 'this_month';

/**
 * Tubes sold per SKU in a date window for a store.
 * Source of truth: invoice_line_items.product_id (owner-approved SKU breakdown).
 */
export function useStoreSoldByBrandWindow(
  storeId: string | null | undefined,
  window: SalesWindow,
) {
  return useQuery({
    queryKey: ['store-sold-by-sku-window', storeId, window],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<BrandWindowSold[]> => {
      if (!storeId) return [];

      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      if (window === 'last_30_days') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
      } else if (window === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      }

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
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

      return Array.from(bySku.entries())
        .filter(([, tubes]) => tubes > 0)
        .map(([brand, tubes]) => ({ brand, tubes }))
        .sort((a, b) => b.tubes - a.tubes);
    },
  });
}
