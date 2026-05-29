import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStoreTubeKPI } from './useStoreTubeKPI';

/**
 * Per-SKU order history for a store.
 *
 * The existing `store-recent-invoices-sku` cache (useStoreRecentInvoices)
 * returns invoice rows with a single "top SKU" label per invoice — NOT a
 * per-SKU rollup. To show "last ordered date + qty per SKU" we must
 * aggregate `invoice_line_items` grouped by product. That's this hook.
 *
 * Returned rows are sorted most-recent first. SKUs that exist in the brand
 * catalog but have never been ordered are merged in by the consumer panel
 * (via useStoreTubeKPI brands) and shown as "Never ordered".
 *
 * IMPORTANT: query is on `invoices.store_id` (the live store id) — so
 * post-merge survivors automatically see ALL repointed invoices.
 */

export interface SkuOrderHistoryRow {
  sku: string;
  brand: string | null;
  last_ordered_at: string; // ISO
  last_qty: number;
  lifetime_qty: number;
  order_count: number;
}

export function useStoreSkuOrderHistory(storeId: string | null) {
  return useQuery({
    queryKey: ['store-sku-order-history', storeId],
    queryFn: async () => {
      if (!storeId) return [] as SkuOrderHistoryRow[];

      // Pull invoices + line items in one round-trip via nested select.
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `
          id,
          created_at,
          deleted_at,
          invoice_line_items (
            product_name,
            product_name_snapshot,
            brand,
            brand_name_snapshot,
            quantity
          )
        `
        )
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const map = new Map<string, SkuOrderHistoryRow>();
      for (const inv of data || []) {
        const createdAt = (inv as any).created_at as string;
        const items = ((inv as any).invoice_line_items || []) as Array<{
          product_name?: string | null;
          product_name_snapshot?: string | null;
          brand?: string | null;
          brand_name_snapshot?: string | null;
          quantity?: number | null;
        }>;
        for (const li of items) {
          const sku =
            li.product_name_snapshot?.trim() ||
            li.product_name?.trim() ||
            'Unknown SKU';
          const brand =
            li.brand_name_snapshot?.trim() || li.brand?.trim() || null;
          const qty = Number(li.quantity ?? 0);
          const existing = map.get(sku);
          if (!existing) {
            map.set(sku, {
              sku,
              brand,
              last_ordered_at: createdAt,
              last_qty: qty,
              lifetime_qty: qty,
              order_count: 1,
            });
          } else {
            existing.lifetime_qty += qty;
            existing.order_count += 1;
            // invoices were ordered DESC so first hit is the latest
            if (createdAt > existing.last_ordered_at) {
              existing.last_ordered_at = createdAt;
              existing.last_qty = qty;
            }
          }
        }
      }

      return {
        rows: Array.from(map.values()).sort((a, b) =>
          a.last_ordered_at < b.last_ordered_at ? 1 : -1
        ),
        totalInvoices: (data || []).length,
        invoicesWithLineItems: (data || []).filter(
          (inv: any) => (inv.invoice_line_items || []).length > 0
        ).length,
      };
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

/**
 * Convenience: marries `useStoreSkuOrderHistory` with the brand catalog
 * from `useStoreTubeKPI` so brands with zero orders surface as
 * "Never ordered" rows.
 */
export interface SkuOrderHistoryWithGaps extends SkuOrderHistoryRow {
  never_ordered?: boolean;
}

export function useStoreSkuOrderHistoryWithGaps(storeId: string | null) {
  const history = useStoreSkuOrderHistory(storeId);
  const kpi = useStoreTubeKPI(storeId);

  const orderedSkuKeys = new Set(
    (history.data || []).map((r) => `${r.brand ?? ''}|${r.sku}`.toLowerCase())
  );

  // Brands present in catalog but never appear in any invoice line — surface
  // them at the bottom so reorder gaps are obvious.
  const gapRows: SkuOrderHistoryWithGaps[] = (kpi.data || [])
    .filter((b) => {
      // brand-level gap: if no SKU under this brand has ever been ordered
      const hit = (history.data || []).some(
        (h) => (h.brand || '').toLowerCase() === b.brand_name.toLowerCase()
      );
      return !hit;
    })
    // dedupe by brand_name
    .filter(
      (b, i, arr) =>
        arr.findIndex((x) => x.brand_name === b.brand_name) === i
    )
    .map((b) => ({
      sku: `${b.brand_name} (no SKU on file)`,
      brand: b.brand_name,
      last_ordered_at: '',
      last_qty: 0,
      lifetime_qty: 0,
      order_count: 0,
      never_ordered: true,
    }));

  return {
    isLoading: history.isLoading || kpi.isLoading,
    error: history.error || kpi.error,
    rows: [...((history.data as SkuOrderHistoryWithGaps[]) || []), ...gapRows],
  };
}
