import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalSellThroughRow {
  store_id: string;
  store_name: string;
  city: string | null;
  state: string | null;
  brand_name: string;
  total_orders_lifetime: number;
  total_units_lifetime: number;
  total_tubes_lifetime: number;
  total_revenue_lifetime: number;
  first_order_date: string | null;
  last_order_date: string | null;
  days_since_last_order: number | null;
  avg_days_between_orders: number | null;
  min_days_between: number | null;
  max_days_between: number | null;
  orders_last_30d: number;
  orders_last_90d: number;
  revenue_last_30d: number | null;
  revenue_last_90d: number | null;
  revenue_per_day: number | null;
  order_frequency_class: "Fast" | "Medium" | "Slow" | "New";
  projected_next_order: string | null;
}

/**
 * Fetches all rows from the sell-through view using paginated queries
 * to avoid the Supabase 1000-row default limit.
 */
export function useGlobalSellThroughAnalytics() {
  return useQuery({
    queryKey: ["global-sell-through-analytics"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allRows: GlobalSellThroughRow[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("v_global_sell_through_analytics" as any)
          .select("*")
          .order("days_since_last_order", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        const batch = (data || []) as unknown as GlobalSellThroughRow[];
        allRows.push(...batch);

        if (batch.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += PAGE_SIZE;
        }
      }

      return allRows;
    },
    staleTime: 5 * 60 * 1000,
  });
}
