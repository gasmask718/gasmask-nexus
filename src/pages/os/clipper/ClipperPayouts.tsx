import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DollarSign, Users, Clock, CheckCircle2, Send, AlertTriangle, Loader2 } from "lucide-react";

type PayoutStatus = "all" | "pending" | "processing" | "paid" | "failed";

const GOLD = "#C9A84C";

const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  processing: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  paid:       "bg-green-500/15 text-green-300 border-green-500/30",
  failed:     "bg-red-500/15 text-red-300 border-red-500/30",
};

type PendingRow = {
  clipper_id: string;
  full_name: string;
  email: string | null;
  stripe_connect_id: string | null;
  stripe_connect_onboarded: boolean | null;
  pending_amount: number;
  items: number;
};

export default function ClipperPayouts() {
  const [paying, setPaying] = useState<string | null>(null);

  const { data: earnings, isLoading: eLoad, error: eErr } = useQuery({
    queryKey: ["clipper-payouts-earnings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_earnings")
        .select(`
          id, clipper_id, amount, status, created_at,
          clipper_accounts!clipper_id(
            id, full_name, email, stripe_connect_id, stripe_connect_onboarded
          )
        `)
        .eq("status", "approved");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payouts, isLoading: pLoad, error: pErr } = useQuery({
    queryKey: ["clipper-payouts-history"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_payouts")
        .select(`
          *,
          clipper_accounts!clipper_id(full_name, email)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pending: PendingRow[] = useMemo(() => {
    const map = new Map<string, PendingRow>();
    (earnings || []).forEach((e: any) => {
      const acct = e.clipper_accounts;
      if (!acct) return;
      const prev = map.get(e.clipper_id);
      map.set(e.clipper_id, {
        clipper_id: e.clipper_id,
        full_name: acct.full_name,
        email: acct.email,
        stripe_connect_id: acct.stripe_connect_id,
        stripe_connect_onboarded: acct.stripe_connect_onboarded,
        pending_amount: (prev?.pending_amount || 0) + Number(e.amount || 0),
        items: (prev?.items || 0) + 1,
      });
    });
    return Array.from(map.values())
      .filter((r) => r.pending_amount > 0)
      .sort((a, b) => b.pending_amount - a.pending_amount);
  }, [earnings]);

  const stats = useMemo(() => {
    const totalPending = pending.reduce((s, r) => s + r.pending_amount, 0);
    const readyToPay = pending.filter((r) => r.stripe_connect_onboarded).length;
    const totalPaid = (payouts || [])
      .filter((p: any) => p.status === "paid")
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return {
      totalPending,
      clippersOwed: pending.length,
      readyToPay,
      totalPaid,
    };
  }, [pending, payouts]);

  const handlePay = async (row: PendingRow) => {
    setPaying(row.clipper_id);
    await new Promise((r) => setTimeout(r, 500));
    toast.success(`Payout initiated for ${row.full_name} — ${fmtMoney(row.pending_amount)}`, {
      description: "Stripe Connect payout is not wired yet. This is a placeholder action.",
    });
    setPaying(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>💸 Payouts</h1>
        <p className="text-sm text-muted-foreground">Approved earnings ready to pay and payout history.</p>
      </div>

      {(eErr || pErr) && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">
            {eErr && <div>Error loading earnings: {(eErr as Error).message}</div>}
            {pErr && <div>Error loading payouts: {(pErr as Error).message}</div>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Clock className="h-4 w-4" />} label="Total Pending" loading={eLoad}
          value={fmtMoney(stats.totalPending)} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Clippers Owed" loading={eLoad}
          value={stats.clippersOwed.toString()} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Ready to Pay" loading={eLoad}
          value={stats.readyToPay.toString()}
          sub="Stripe Connect onboarded" />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Paid All-Time" loading={pLoad}
          value={fmtMoney(stats.totalPaid)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Pending Earnings by Clipper</CardTitle>
        </CardHeader>
        <CardContent>
          {eLoad ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center max-w-md mx-auto">
              No pending earnings. Approved submissions will appear here once ready to pay.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pending.map((r) => {
                const ready = !!r.stripe_connect_onboarded;
                return (
                  <div key={r.clipper_id}
                       className="border border-border/40 rounded-md p-4 hover:bg-muted/20 transition space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.email || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums" style={{ color: GOLD }}>
                          {fmtMoney(r.pending_amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.items} item{r.items === 1 ? "" : "s"}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {ready ? (
                        <Badge variant="outline" className="text-xs bg-green-500/15 text-green-300 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Stripe ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-yellow-500/15 text-yellow-300 border-yellow-500/30">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Not onboarded
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        disabled={!ready || paying === r.clipper_id}
                        onClick={() => handlePay(r)}
                        style={ready ? { backgroundColor: GOLD, color: "#000" } : undefined}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {paying === r.clipper_id ? "Sending..." : "Pay Now"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {pLoad ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (payouts || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No payouts yet. Payouts will appear here once initiated.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Clipper</th>
                    <th className="text-left py-2 px-2">Email</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-left py-2 px-2">Period</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Transfer ID</th>
                  </tr>
                </thead>
                <tbody>
                  {(payouts || []).map((p: any) => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-2 whitespace-nowrap">{fmtDate(p.paid_at || p.created_at)}</td>
                      <td className="py-2 px-2">{p.clipper_accounts?.full_name || "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{p.clipper_accounts?.email || "—"}</td>
                      <td className="text-right py-2 px-2 tabular-nums" style={{ color: GOLD }}>
                        {fmtMoney(Number(p.amount || 0))}
                      </td>
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {p.period_start && p.period_end
                          ? `${fmtDate(p.period_start)} – ${fmtDate(p.period_end)}`
                          : "—"}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={cn("text-xs capitalize", STATUS_BADGE[p.status] || "")}>
                          {p.status || "—"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-[200px]">
                        {p.stripe_transfer_id || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        {loading ? (
          <>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <div className="text-xl font-bold truncate" style={{ color: GOLD }}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
