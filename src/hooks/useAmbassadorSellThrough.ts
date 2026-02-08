/**
 * Ambassador-Scoped Sell-Through Analytics Hook
 * 
 * Fetches sell-through data from v_global_sell_through_analytics
 * filtered ONLY to stores the current ambassador is assigned to.
 * 
 * Uses the same views as global analytics — zero logic duplication.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { GlobalSellThroughRow } from "@/hooks/useGlobalSellThroughAnalytics";

/**
 * Resolves the current user's ambassador ID from the ambassadors table.
 */
function useAmbassadorId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ambassador-self-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("ambassadors")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Fetches the set of store_ids the ambassador is assigned to.
 */
function useAmbassadorStoreIds(ambassadorId: string | null | undefined) {
  return useQuery({
    queryKey: ["ambassador-assigned-store-ids", ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      // Get store IDs from ambassador_assignments (active only)
      const { data: assignments, error: assignError } = await supabase
        .from("ambassador_assignments")
        .select("store_id")
        .eq("ambassador_id", ambassadorId)
        .eq("active", true)
        .not("store_id", "is", null);

      if (assignError) throw assignError;

      // Also get stores directly assigned on store_master
      const { data: directStores, error: directError } = await supabase
        .from("store_master")
        .select("id")
        .eq("assigned_ambassador_id", ambassadorId);

      if (directError) throw directError;

      // Merge unique IDs
      const ids = new Set<string>();
      (assignments || []).forEach((a: any) => { if (a.store_id) ids.add(a.store_id); });
      (directStores || []).forEach((s: any) => { if (s.id) ids.add(s.id); });

      return Array.from(ids);
    },
    enabled: !!ambassadorId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches sell-through analytics scoped to the ambassador's assigned stores.
 * Reuses v_global_sell_through_analytics — no logic duplication.
 */
export function useAmbassadorSellThrough() {
  const { data: ambassadorId, isLoading: isLoadingAmbassador } = useAmbassadorId();
  const { data: storeIds = [], isLoading: isLoadingStores } = useAmbassadorStoreIds(ambassadorId);

  const sellThroughQuery = useQuery({
    queryKey: ["ambassador-sell-through", ambassadorId, storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];

      // Paginate to avoid 1000-row limit
      const PAGE_SIZE = 1000;
      const allRows: GlobalSellThroughRow[] = [];

      // Query in batches of store IDs (Supabase .in() has limits ~100)
      const BATCH_SIZE = 80;
      for (let i = 0; i < storeIds.length; i += BATCH_SIZE) {
        const batch = storeIds.slice(i, i + BATCH_SIZE);
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("v_global_sell_through_analytics" as any)
            .select("*")
            .in("store_id", batch)
            .order("days_since_last_order", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) throw error;

          const rows = (data || []) as unknown as GlobalSellThroughRow[];
          allRows.push(...rows);

          if (rows.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            offset += PAGE_SIZE;
          }
        }
      }

      return allRows;
    },
    enabled: !!ambassadorId && storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: sellThroughQuery.data ?? [],
    isLoading: isLoadingAmbassador || isLoadingStores || sellThroughQuery.isLoading,
    storeCount: storeIds.length,
    ambassadorId,
  };
}
