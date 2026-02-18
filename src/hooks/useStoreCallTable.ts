import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePaginationState } from "./usePaginatedQuery";
import { useState, useMemo } from "react";

export interface StoreRow {
  id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  borough_id: string | null;
  health_status: string | null;
  owner_name: string | null;
}

export function useStoreCallTable() {
  const [search, setSearch] = useState("");
  const pagination = usePaginationState(50);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["store-call-table", pagination.page, pagination.pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from("store_master")
        .select("id, store_name, address, city, state, phone, borough_id, health_status, owner_name", { count: "exact" })
        .is("deleted_at", null)
        .order("store_name", { ascending: true });

      if (search.trim()) {
        query = query.or(`store_name.ilike.%${search.trim()}%,address.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
      }

      const { from, to } = pagination.range;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data as StoreRow[], totalCount: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  // Sync total count
  const totalCount = data?.totalCount ?? 0;
  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  return {
    stores: data?.rows ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    search,
    setSearch,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount,
      totalPages: pagination.totalPages,
      controls: pagination.controls,
    },
  };
}
