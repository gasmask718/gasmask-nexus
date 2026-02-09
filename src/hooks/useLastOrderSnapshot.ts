import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeBrandId, type CanonicalBrandId } from '@/config/brands';

// ═══════════════════════════════════════════════════════════════════════════════
// LAST ORDER SNAPSHOT INTELLIGENCE HOOK
// Derived read-only layer: most recent order per store × brand
// Source: v_store_last_order_snapshot (database view)
// ═══════════════════════════════════════════════════════════════════════════════

export interface LastOrderSnapshot {
  store_id: string;
  store_name: string | null;
  brand_name: string;
  brand_key: string;
  canonical_brand_id: CanonicalBrandId | null;
  last_order_date: string;
  days_since_last_order: number;
  last_order_total_units: number;
  last_order_box_equivalent: number;
  last_order_size_label: string;
  last_order_total_amount: number | null;
  last_order_line_count: number | null;
  total_order_count: number;
  avg_tubes_per_order: number;
  avg_days_between_orders: number;
  is_restock_due: boolean;
  is_order_smaller_than_usual: boolean;
}

/**
 * Fetch last order snapshot for a single store.
 * Returns one row per brand that has ever been ordered.
 */
export function useLastOrderSnapshot(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['last-order-snapshot', storeId],
    queryFn: async (): Promise<LastOrderSnapshot[]> => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('v_store_last_order_snapshot' as any)
        .select('*')
        .eq('store_id', storeId);

      if (error) {
        console.error('[LOS] Failed to fetch:', error);
        throw error;
      }

      return ((data || []) as any[]).map((row) => ({
        ...row,
        canonical_brand_id: normalizeBrandId(row.brand_name),
      }));
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

/**
 * Batch fetch for multiple stores (directory views).
 * Returns Map<store_id, LastOrderSnapshot[]>
 */
export function useLastOrderSnapshotBatch(storeIds: string[]) {
  return useQuery({
    queryKey: ['last-order-snapshot-batch', storeIds.sort().join(',')],
    queryFn: async () => {
      if (!storeIds.length) return new Map<string, LastOrderSnapshot[]>();

      const { data, error } = await supabase
        .from('v_store_last_order_snapshot' as any)
        .select('*')
        .in('store_id', storeIds);

      if (error) {
        console.error('[LOS-BATCH] Failed to fetch:', error);
        throw error;
      }

      const map = new Map<string, LastOrderSnapshot[]>();
      for (const row of (data || []) as any[]) {
        const enriched: LastOrderSnapshot = {
          ...row,
          canonical_brand_id: normalizeBrandId(row.brand_name),
        };
        const existing = map.get(row.store_id) || [];
        existing.push(enriched);
        map.set(row.store_id, existing);
      }
      return map;
    },
    enabled: storeIds.length > 0,
    staleTime: 30_000,
  });
}
