// Dynasty Direct — Loyalty panel for a single store user
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

type LoyaltyAccount = {
  id: string;
  user_id: string | null;
  store_account_id: string | null;
  points_balance: number;
  points_lifetime: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  tier_updated_at: string | null;
  created_at: string;
};

type LoyaltyTx = {
  id: string;
  transaction_type: string;
  points: number;
  balance_after: number | null;
  description: string | null;
  created_at: string;
};

const tierColor: Record<string, string> = {
  bronze: "bg-zinc-500/20 text-zinc-700 border-zinc-500/40",
  silver: "bg-sky-500/20 text-sky-700 border-sky-500/40",
  gold: "bg-amber-500/20 text-amber-700 border-amber-500/40",
  platinum: "bg-purple-500/20 text-purple-700 border-purple-500/40",
};

export function LoyaltyPanel({
  storeAccountId,
  userId,
}: {
  storeAccountId: string;
  userId: string | null | undefined;
}) {
  const qc = useQueryClient();
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState<string>("");

  const { data: account, isLoading } = useQuery({
    queryKey: ["dd-loyalty-account", storeAccountId, userId],
    queryFn: async (): Promise<LoyaltyAccount | null> => {
      let q = supabase.from("dd_loyalty_accounts" as any).select("*").limit(1);
      if (userId) q = q.eq("user_id", userId);
      else q = q.eq("store_account_id", storeAccountId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["dd-loyalty-tx", account?.id],
    enabled: !!account?.id,
    queryFn: async (): Promise<LoyaltyTx[]> => {
      const { data, error } = await supabase
        .from("dd_loyalty_transactions" as any)
        .select("*")
        .eq("loyalty_account_id", account!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const adjust = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error("No loyalty account");
      if (!Number.isFinite(adjAmount) || adjAmount === 0) throw new Error("Enter a non-zero amount");
      const newBalance = (account.points_balance ?? 0) + adjAmount;
      const { error: txErr } = await supabase.from("dd_loyalty_transactions" as any).insert({
        loyalty_account_id: account.id,
        transaction_type: "adjust",
        points: adjAmount,
        balance_after: newBalance,
        description: adjReason || "Manual adjustment",
      } as any);
      if (txErr) throw txErr;
      const { error: upErr } = await supabase
        .from("dd_loyalty_accounts" as any)
        .update({ points_balance: newBalance } as any)
        .eq("id", account.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-loyalty-account", storeAccountId, userId] });
      qc.invalidateQueries({ queryKey: ["dd-loyalty-tx", account?.id] });
      setAdjAmount(0);
      setAdjReason("");
      toast.success("Points adjusted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const progress = useMemo(() => {
    if (!account) return null;
    const lifetime = account.points_lifetime ?? 0;
    if (account.tier === "platinum") return { label: "Platinum — top tier", pct: 100, next: null };
    const next =
      account.tier === "bronze" ? 500 : account.tier === "silver" ? 2000 : 5000;
    const prev =
      account.tier === "bronze" ? 0 : account.tier === "silver" ? 500 : 2000;
    const pct = Math.min(100, ((lifetime - prev) / (next - prev)) * 100);
    const nextTier =
      account.tier === "bronze" ? "Silver" : account.tier === "silver" ? "Gold" : "Platinum";
    return { label: `${nextTier}: ${lifetime}/${next}`, pct, next };
  }, [account]);

  if (isLoading) return <div className="text-sm text-muted-foreground mt-4">Loading…</div>;

  if (!account) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            No loyalty account yet. Created automatically on first order.
          </div>
        </CardContent>
      </Card>
    );
  }

  const dollarValue = (account.points_balance / 100).toFixed(2);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Tier</div>
          <Badge className={`${tierColor[account.tier]} mt-1`} variant="outline">
            {account.tier.toUpperCase()}
          </Badge>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Points Balance</div>
          <div className="text-2xl font-bold">{account.points_balance}</div>
          <div className="text-xs text-muted-foreground">= ${dollarValue} in discounts</div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Lifetime Points</span>
          <span className="font-semibold">{account.points_lifetime}</span>
        </div>
        {progress && (
          <>
            <Progress value={progress.pct} className="h-2" />
            <div className="text-xs text-muted-foreground">{progress.label}</div>
          </>
        )}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="text-sm font-semibold">Recent transactions</div>
        {txs.length === 0 ? (
          <div className="text-xs text-muted-foreground">No transactions yet.</div>
        ) : (
          <div className="space-y-1">
            {txs.map((t) => (
              <div key={t.id} className="grid grid-cols-4 gap-2 text-xs border-b pb-1">
                <div className="text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
                <div>{t.transaction_type}</div>
                <div className={t.points >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {t.points >= 0 ? "+" : ""}
                  {t.points}
                </div>
                <div className="text-right">{t.balance_after ?? "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="text-sm font-semibold">Adjust points</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Amount (+ or −)</Label>
            <Input
              type="number"
              value={adjAmount}
              onChange={(e) => setAdjAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Input
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="e.g. goodwill credit"
            />
          </div>
        </div>
        <Button size="sm" onClick={() => adjust.mutate()} disabled={adjust.isPending}>
          {adjust.isPending ? "Saving…" : "Save adjustment"}
        </Button>
      </div>
    </div>
  );
}
