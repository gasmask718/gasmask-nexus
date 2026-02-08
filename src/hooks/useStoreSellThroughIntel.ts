import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandSellThroughSummary {
  store_id: string;
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

export interface BrandOrderGap {
  order_id: string;
  store_id: string;
  brand_name: string;
  order_date: string;
  total_units: number;
  total_tubes: number;
  total_amount: number;
  payment_status: string | null;
  previous_order_date: string | null;
  days_between_orders: number | null;
}

/** Summary KPIs per brand for a store */
export function useStoreSellThroughSummary(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["store-sell-through-summary", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_store_brand_sell_through_summary" as any)
        .select("*")
        .eq("store_id", storeId!);

      if (error) throw error;
      return (data || []) as unknown as BrandSellThroughSummary[];
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Order timeline with gaps for a specific brand at a specific store */
export function useStoreBrandOrderTimeline(
  storeId: string | null | undefined,
  brandName: string | null | undefined,
  limit = 12
) {
  return useQuery({
    queryKey: ["store-brand-order-timeline", storeId, brandName, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_store_brand_order_gaps" as any)
        .select("*")
        .eq("store_id", storeId!)
        .eq("brand_name", brandName!)
        .order("order_date", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as BrandOrderGap[];
    },
    enabled: !!storeId && !!brandName,
    staleTime: 5 * 60 * 1000,
  });
}

/** Aggregate KPIs across all brands for a store */
export function useStoreSellThroughTotals(summaries: BrandSellThroughSummary[]) {
  const totalOrders = summaries.reduce((s, b) => s + (b.total_orders_lifetime || 0), 0);
  const totalRevenue = summaries.reduce((s, b) => s + (b.total_revenue_lifetime || 0), 0);
  const lastOrderDate = summaries.reduce<string | null>((latest, b) => {
    if (!b.last_order_date) return latest;
    if (!latest) return b.last_order_date;
    return b.last_order_date > latest ? b.last_order_date : latest;
  }, null);

  const avgGaps = summaries
    .map((b) => b.avg_days_between_orders)
    .filter((v): v is number => v != null && v > 0);
  const avgDaysBetween =
    avgGaps.length > 0
      ? Math.round((avgGaps.reduce((s, v) => s + v, 0) / avgGaps.length) * 10) / 10
      : null;

  return { totalOrders, totalRevenue, lastOrderDate, avgDaysBetween };
}
