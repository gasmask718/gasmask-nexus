import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_TUBE_SKUS, resolveProductIdForBrand, type SkuStatus } from '@/lib/inventory/skuDisplay';

export interface BrandWindowSold {
  product_id: string;
  brand: string; // display name
  display: string;
  parent_brand: string;
  order: number;
  tubes: number;
  percentage: number;
  status: SkuStatus;
  inventory_count: number;
}

export type SalesWindow = 'last_30_days' | 'prior_month' | 'this_month';

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

      // Pre-populate all 9 SKUs
      const result = new Map<string, BrandWindowSold>();
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

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
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

      // Inventory for staged status
      const { data: inventory } = await supabase
        .from('store_tube_inventory')
        .select('brand, current_tubes_left')
        .eq('store_id', storeId);
      const brandInv = new Map<string, number>();
      inventory?.forEach((inv) => {
        const key = (inv.brand || '').toLowerCase().replace(/\s+/g, '');
        brandInv.set(key, (brandInv.get(key) ?? 0) + Number(inv.current_tubes_left ?? 0));
      });

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
