import { useQuery } from "@tanstack/react-query";
import { dp } from "@/lib/dpClient";
import { supabase } from "@/integrations/supabase/client";

export type DPAdminStatus =
  | { state: "admin" }
  | { state: "not_admin" }
  | { state: "schema_pending"; message: string }
  | { state: "no_user" };

export function useDPAdminStatus() {
  return useQuery<DPAdminStatus>({
    queryKey: ["dp-is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { state: "no_user" };

      const { data, error } = await dp()
        .from("partner_admins")
        .select("user_id")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (error) {
        console.error("[useDPAdminStatus] Query error:", error);
        // PGRST106 = schema not exposed via PostgREST
        if (error.code === "PGRST106" || /schema/i.test(error.message ?? "")) {
          return {
            state: "schema_pending",
            message: error.message ?? "Backend schema not yet exposed.",
          };
        }
        return { state: "not_admin" };
      }

      return data ? { state: "admin" } : { state: "not_admin" };
    },
    // Identity check: cache briefly and never re-verify on tab focus — the
    // window-focus refetch was part of the alt-tab re-verification loop.
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

// Back-compat: boolean flag used by existing call sites.
export function useIsDPAdmin() {
  const q = useDPAdminStatus();
  return {
    ...q,
    data: q.data?.state === "admin",
  };
}
