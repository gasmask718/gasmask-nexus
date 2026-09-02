// Bag pipeline summary for a single store (split from tube tracking).
// Aggregates bag_sale_ledger (sales out) + bag_inventory_ledger (on-hand deltas)
// to produce lifetime / 30d / on-hand counters by product.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreBagSummary {
  lifetime_bags_sold: number;
  bags_last_30_days: number;
  bags_this_month: number;
  on_hand: number;
  invoice_count: number;
  last_sale_at: string | null;
  by_product: Array<{
    product_id: string;
    product_name: string;
    bags_sold: number;
    last_30: number;
    on_hand: number;
  }>;
}

export function useStoreBagSummary(storeId: string | undefined | null) {
  return useQuery({
    queryKey: ['store-bag-summary', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<StoreBagSummary> => {
      const empty: StoreBagSummary = {
        lifetime_bags_sold: 0,
        bags_last_30_days: 0,
        bags_this_month: 0,
        on_hand: 0,
        invoice_count: 0,
        last_sale_at: null,
        by_product: [],
      };
      if (!storeId) return empty;

      const { data: sales, error: sErr } = await supabase
        .from('bag_sale_ledger' as any)
        .select('product_id, product_name, bags_delta, created_at, invoice_id')
        .eq('store_id', storeId);
      if (sErr) throw new Error(`BAG_SALES_FAILED: ${sErr.message}`);

      // CURRENT ON-HAND comes from the canonical inventory table
      // (store_tube_inventory_status), NOT bag_inventory_ledger — that ledger
      // has no live writer and produced a false 0. Sales history below still
      // comes from bag_sale_ledger.
      const { data: statusRows, error: iErr } = await supabase
        .from('store_tube_inventory_status')
        .select('brand_id, current_tubes_left')
        .eq('store_id', storeId)
        .eq('is_simulation', false);
      if (iErr) throw new Error(`BAG_INV_FAILED: ${iErr.message}`);

      const inv = (statusRows ?? [])
        .map((r: any) => ({
          product_id: productIdForBrandId(r.brand_id),
          bags_delta: Number(r.current_tubes_left ?? 0),
        }))
        .filter((r) => r.product_id && unitLabelForProductId(r.product_id) === 'bags');

      const now = Date.now();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const dayMs = 86_400_000;

      const byId = new Map<string, { name: string; sold: number; last30: number; onHand: number }>();
      const invoiceIds = new Set<string>();
      let lifetime = 0;
      let last30 = 0;
      let thisMonth = 0;
      let lastSale: string | null = null;

      (sales || []).forEach((r: any) => {
        const qty = Math.abs(Number(r.bags_delta) || 0);
        lifetime += qty;
        invoiceIds.add(r.invoice_id);
        const t = new Date(r.created_at).getTime();
        if (now - t <= 30 * dayMs) last30 += qty;
        if (t >= monthStart) thisMonth += qty;
        if (!lastSale || r.created_at > lastSale) lastSale = r.created_at;
        const cur = byId.get(r.product_id) || { name: r.product_name || 'Bags', sold: 0, last30: 0, onHand: 0 };
        cur.sold += qty;
        if (now - t <= 30 * dayMs) cur.last30 += qty;
        byId.set(r.product_id, cur);
      });

      let onHand = 0;
      (inv || []).forEach((r: any) => {
        const delta = Number(r.bags_delta) || 0;
        onHand += delta;
        const cur = byId.get(r.product_id) || { name: 'Bags', sold: 0, last30: 0, onHand: 0 };
        cur.onHand += delta;
        byId.set(r.product_id, cur);
      });

      return {
        lifetime_bags_sold: lifetime,
        bags_last_30_days: last30,
        bags_this_month: thisMonth,
        on_hand: Math.max(0, onHand),
        invoice_count: invoiceIds.size,
        last_sale_at: lastSale,
        by_product: Array.from(byId.entries()).map(([product_id, v]) => ({
          product_id,
          product_name: v.name,
          bags_sold: v.sold,
          last_30: v.last30,
          on_hand: Math.max(0, v.onHand),
        })).sort((a, b) => b.bags_sold - a.bags_sold),
      };
    },
  });
}
