import { useQuery } from "@tanstack/react-query";
import { dp } from "@/lib/dpClient";
import { supabase } from "@/integrations/supabase/client";

export function useIsDPAdmin() {
  return useQuery({
    queryKey: ["dp-is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data, error } = await dp()
        .from("partner_admins")
        .select("user_id")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (error) {
        console.error("[useIsDPAdmin] Query error:", error);
        return false;
      }

      console.log("[useIsDPAdmin] Result:", {
        userId: u.user.id,
        email: u.user.email,
        isAdmin: !!data,
      });

      return !!data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
