// Admin-facing Pro subscription panel for a store
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Sub = {
  id: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  next_billing_date: string | null;
  monthly_price: number;
  created_at: string;
  cancelled_at: string | null;
};

export default function AdminProSubscriptionPanel({ storeAccountId, storeUserId }: { storeAccountId: string; storeUserId: string | null }) {
  const qc = useQueryClient();

  const { data: sub, isLoading } = useQuery({
    queryKey: ["admin-pro-sub", storeAccountId],
    queryFn: async (): Promise<Sub | null> => {
      const { data, error } = await (supabase as any)
        .from("dd_pro_subscriptions")
        .select("*")
        .eq("store_account_id", storeAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("dd_pro_subscriptions").insert({
        store_account_id: storeAccountId,
        user_id: storeUserId,
        plan: "pro",
        status: "active",
        monthly_price: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pro activated (comp)"); qc.invalidateQueries({ queryKey: ["admin-pro-sub", storeAccountId] }); qc.invalidateQueries({ queryKey: ["dd-pro-sub-stats"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!sub) return;
      const { error } = await (supabase as any).from("dd_pro_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", sub.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subscription cancelled"); qc.invalidateQueries({ queryKey: ["admin-pro-sub", storeAccountId] }); qc.invalidateQueries({ queryKey: ["dd-pro-sub-stats"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground mt-4">Loading…</div>;

  if (!sub || sub.status === "cancelled") {
    return (
      <Card className="mt-4">
        <CardContent className="p-4 space-y-3 text-sm">
          <div className="text-muted-foreground">Not subscribed to Pro</div>
          <Button onClick={() => activate.mutate()} disabled={activate.isPending}>
            {activate.isPending ? "Activating…" : "Activate Pro (admin comp)"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <Badge variant="outline">{sub.status}</Badge>
        </div>
        <div><span className="text-muted-foreground">Plan:</span> {sub.plan} (${Number(sub.monthly_price).toFixed(2)}/mo)</div>
        {sub.trial_ends_at && <div><span className="text-muted-foreground">Trial ends:</span> {new Date(sub.trial_ends_at).toLocaleDateString()}</div>}
        {sub.next_billing_date && <div><span className="text-muted-foreground">Next billing:</span> {new Date(sub.next_billing_date).toLocaleDateString()}</div>}
        <div><span className="text-muted-foreground">Since:</span> {new Date(sub.created_at).toLocaleDateString()}</div>
        <Button variant="destructive" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
          {cancel.isPending ? "Cancelling…" : "Cancel Subscription"}
        </Button>
      </CardContent>
    </Card>
  );
}
