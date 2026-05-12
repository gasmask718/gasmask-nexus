import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dp } from "@/lib/dpClient";

export function useIsDPAdmin() {
  return useQuery({
    queryKey: ["dp-is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      // Server-authoritative — query partner_admins via RLS-friendly select
      const { data, error } = await dp()
        .from("partner_admins")
        .select("user_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    staleTime: 60_000,
  });
}
