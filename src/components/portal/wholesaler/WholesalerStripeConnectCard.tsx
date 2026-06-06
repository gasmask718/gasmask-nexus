/**
 * DD SPRINT 5 — Wholesaler Stripe Connect Card
 * Onboarding link + status badge + reserve balance + payout history.
 * Key-ready: shows a clear "pending Stripe activation" state when the
 * DD Stripe keys haven't been set yet.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Wallet, RefreshCw } from "lucide-react";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function WholesalerStripeConnectCard() {
  const { profile } = useWholesalerProfile();
  const [busy, setBusy] = useState(false);

  const { data: stats, refetch } = useQuery({
    queryKey: ["dd-connect-stats", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const [{ data: heldRows }, { data: releasedRows }, { data: splits }] = await Promise.all([
        supabase.from("dd_reserve_ledger").select("amount_cents").eq("wholesaler_id", profile!.id).eq("status", "held"),
        supabase.from("dd_reserve_ledger").select("amount_cents,released_at,released_transfer_id").eq("wholesaler_id", profile!.id).eq("status", "released").order("released_at", { ascending: false }).limit(10),
        supabase.from("dd_split_ledger").select("supplier_transfer_cents,stripe_transfer_id,status,created_at").eq("wholesaler_id", profile!.id).order("created_at", { ascending: false }).limit(10),
      ]);
      const held = (heldRows ?? []).reduce((s: number, r: any) => s + Number(r.amount_cents || 0), 0);
      return { held, released: releasedRows ?? [], splits: splits ?? [] };
    },
  });

  const p = profile as any;
  const status = p?.stripe_payouts_enabled
    ? { label: "Payouts enabled", tone: "default" as const }
    : p?.stripe_connect_id
      ? { label: "Pending verification", tone: "secondary" as const }
      : { label: "Not started", tone: "outline" as const };

  async function onboard() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("dd-stripe-connect-onboard", {
        body: { wholesaler_id: profile?.id },
      });
      if (error) throw error;
      if ((data as any)?.key_ready === false) {
        toast.info("Stripe keys not yet configured — David will activate this from Lovable Cloud settings.");
        return;
      }
      const url = (data as any)?.url;
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("dd-stripe-connect-status", {
        body: { wholesaler_id: profile?.id },
      });
      if ((data as any)?.status === "key_not_ready") {
        toast.info("Stripe keys not yet configured.");
      } else {
        toast.success("Status refreshed");
        await refetch();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Stripe Payouts
          <Badge variant={status.tone}>{status.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!(profile as any)?.stripe_payouts_enabled && (
            <Button onClick={onboard} disabled={busy}>
              <ExternalLink className="w-3 h-3 mr-1" />
              {(profile as any)?.stripe_connect_id ? "Continue onboarding" : "Start Stripe onboarding"}
            </Button>
          )}
          {(profile as any)?.stripe_connect_id && (
            <Button variant="outline" onClick={refreshStatus} disabled={busy}>
              <RefreshCw className="w-3 h-3 mr-1" />Refresh status
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" />Rolling reserve held</div>
            <div className="text-xl font-bold">{fmt(stats?.held ?? 0)}</div>
            <div className="text-[10px] text-muted-foreground">released ~45 days after each order</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-muted-foreground">Reserve rate</div>
            <div className="text-xl font-bold">{Number((profile as any).reserve_pct ?? 8)}%</div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Recent payouts</div>
          {(stats?.splits ?? []).length === 0 && <div className="text-xs text-muted-foreground">No payouts yet.</div>}
          {(stats?.splits ?? []).map((s: any, i: number) => (
            <div key={i} className="text-xs flex items-center justify-between border-b py-1">
              <span className="font-mono">{s.stripe_transfer_id?.slice(0, 14) ?? "—"}</span>
              <Badge variant={s.status === "transferred" ? "default" : s.status === "disputed" ? "destructive" : "secondary"}>{s.status}</Badge>
              <span>{fmt(s.supplier_transfer_cents)}</span>
              <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Recent reserve releases</div>
          {(stats?.released ?? []).length === 0 && <div className="text-xs text-muted-foreground">None yet.</div>}
          {(stats?.released ?? []).map((r: any, i: number) => (
            <div key={i} className="text-xs flex items-center justify-between border-b py-1">
              <span>released</span>
              <span>{fmt(r.amount_cents)}</span>
              <span className="text-muted-foreground">{r.released_at ? new Date(r.released_at).toLocaleDateString() : "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
