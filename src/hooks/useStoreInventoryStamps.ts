/**
 * Canonical inventory timestamp source — shared by the store PROFILE
 * (UnifiedTubeIntelligenceCard) and the store KPI CARD (Stores grid), so the
 * two surfaces can never drift apart again.
 *
 * Fields:
 *  - lastUpdated  → most recent store_tube_inventory_status.tubes_updated_at,
 *                   falling back to last_updated_at ("Counts updated")
 *  - lastChecked  → most recent store_tube_inventory_status.last_inventory_check_at
 *  - checkedBy    → store_tube_inventory_status.last_inventory_check_by (user id)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SkuStamp {
  lastChecked: string | null;
  lastUpdated: string | null;
}

export interface StoreInventoryStampData {
  lastUpdated: string | null;
  lastChecked: string | null;
  checkedBy: string | null;
  /** Per-SKU (store_tube_inventory_status.brand_id) check/update stamps */
  perSku: Record<string, SkuStamp>;
}

const newest = (stamps: (string | null | undefined)[]): string | null => {
  const list = stamps.filter(Boolean) as string[];
  if (!list.length) return null;
  return list.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
};

export function useStoreInventoryStampsBatch(storeIds: string[]) {
  const ids = Array.from(new Set(storeIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ['store-inventory-stamps', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: statusRows, error } = await (supabase as any)
        .from('store_tube_inventory_status')
        .select('store_id, brand_id, tubes_updated_at, last_updated_at, last_inventory_check_at, last_inventory_check_by')
        .in('store_id', ids);
      if (error) throw error;

      const map = new Map<string, StoreInventoryStampData>();
      const get = (id: string) => {
        let e = map.get(id);
        if (!e) { e = { lastUpdated: null, lastChecked: null, checkedBy: null, perSku: {} }; map.set(id, e); }
        return e;
      };

      for (const r of statusRows ?? []) {
        const e = get(r.store_id);
        e.lastUpdated = newest([e.lastUpdated, r.tubes_updated_at, r.last_updated_at]);
        const prev = e.lastChecked;
        e.lastChecked = newest([prev, r.last_inventory_check_at]);
        if (r.last_inventory_check_by && e.lastChecked === r.last_inventory_check_at) {
          e.checkedBy = r.last_inventory_check_by;
        }
        if (r.brand_id) {
          const cur = e.perSku[r.brand_id] ?? { lastChecked: null, lastUpdated: null };
          e.perSku[r.brand_id] = {
            lastChecked: newest([cur.lastChecked, r.last_inventory_check_at]),
            lastUpdated: newest([cur.lastUpdated, r.tubes_updated_at, r.last_updated_at]),
          };
        }
      }
      return map;
    },
  });
}

export function useStoreInventoryStamps(storeId: string | undefined | null) {
  const q = useStoreInventoryStampsBatch(storeId ? [storeId] : []);
  return {
    ...q,
    data: storeId ? q.data?.get(storeId) ?? null : null,
  };
}
