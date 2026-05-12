import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dp } from "@/lib/dpClient";

export default function AdminDebug() {
  const [results, setResults] = useState<Record<string, unknown>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const adminCheck = await dp()
        .from("partner_admins")
        .select("user_id")
        .eq("user_id", u.user?.id ?? "")
        .maybeSingle();
      const adminCount = await dp()
        .from("partner_admins")
        .select("user_id", { count: "exact", head: true });
      const partnerCount = await dp()
        .from("partners")
        .select("*", { count: "exact", head: true });

      if (!cancelled) {
        setResults({
          currentUser: { id: u.user?.id, email: u.user?.email },
          adminCheck: { data: adminCheck.data, error: adminCheck.error },
          adminCount: { count: adminCount.count, error: adminCount.error },
          partnersTableAccess: { count: partnerCount.count, error: partnerCount.error },
          reactQueryCache: queryClient.getQueryState(["dp-is-admin"]),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">Admin Debug</h1>
        <pre className="overflow-x-auto rounded-md border bg-card p-4 text-sm text-foreground">
          {JSON.stringify(results, null, 2)}
        </pre>
      </div>
    </div>
  );
}
