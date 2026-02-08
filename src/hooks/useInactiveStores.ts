import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GRABBA_BRAND_IDS } from "@/config/grabbaSkyscraper";
import type { GlobalSellThroughRow } from "./useGlobalSellThroughAnalytics";

interface StoreMasterRow {
  id: string;
  store_name: string;
  city: string | null;
  state: string | null;
}

/**
 * Fetches ALL stores from store_master using paginated queries
 * to avoid the Supabase 1000-row default limit.
 */
async function fetchAllStores(): Promise<StoreMasterRow[]> {
  const PAGE_SIZE = 1000;
  const allStores: StoreMasterRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("store_master")
      .select("id, store_name, city, state")
      .order("store_name")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data || []) as StoreMasterRow[];
    allStores.push(...batch);

    if (batch.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return allStores;
}

/**
 * Fetches stores from store_master that have zero sell-through rows.
 * Returns synthetic GlobalSellThroughRow[] with zeroed metrics.
 */
export function useInactiveStores(activeStoreIds: Set<string>, enabled: boolean) {
  return useQuery({
    queryKey: ["inactive-stores", enabled, [...activeStoreIds].sort().join(",")],
    queryFn: async () => {
      const allStores = await fetchAllStores();
      const inactive = allStores.filter((s) => !activeStoreIds.has(s.id));
      return buildInactiveRows(inactive);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

function buildInactiveRows(stores: StoreMasterRow[]): GlobalSellThroughRow[] {
  const rows: GlobalSellThroughRow[] = [];
  for (const store of stores) {
    for (const brand of GRABBA_BRAND_IDS) {
      rows.push({
        store_id: store.id,
        store_name: store.store_name,
        city: store.city,
        state: store.state,
        brand_name: brand,
        total_orders_lifetime: 0,
        total_units_lifetime: 0,
        total_tubes_lifetime: 0,
        total_revenue_lifetime: 0,
        first_order_date: null,
        last_order_date: null,
        days_since_last_order: null,
        avg_days_between_orders: null,
        min_days_between: null,
        max_days_between: null,
        orders_last_30d: 0,
        orders_last_90d: 0,
        revenue_last_30d: null,
        revenue_last_90d: null,
        revenue_per_day: null,
        order_frequency_class: "New",
        projected_next_order: null,
      });
    }
  }
  return rows;
}
