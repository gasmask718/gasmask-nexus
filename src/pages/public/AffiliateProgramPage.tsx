import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Loader2, MousePointerClick, DollarSign, ShoppingBag, Link2 } from "lucide-react";

interface AffiliateRow {
  id: string;
  code: string;
  display_name: string | null;
  status: string;
  tier: string;
  commission_rate: number;
  clicks: number;
  conversions: number;
  total_earned: number;
  total_paid: number;
}

interface EventTotals {
  pending: number;
  earned: number;
  orders: number;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export default function AffiliateProgramPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ id: string; email: string | null } | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateRow | null>(null);
  const [totals, setTotals] = useState<EventTotals>({ pending: 0, earned: 0, orders: 0 });

  // auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAffiliate = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("dd_affiliates")
      .select("id, code, display_name, status, tier, commission_rate, clicks, conversions, total_earned, total_paid")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setAffiliate((data as AffiliateRow) ?? null);
    if (data) {
      const { data: events } = await supabase
        .from("dd_affiliate_events")
        .select("status, commission_amount")
        .eq("affiliate_id", (data as AffiliateRow).id)
        .eq("kind", "order");
      const rows = (events ?? []) as { status: string; commission_amount: number }[];
      setTotals({
        orders: rows.length,
        pending: rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.commission_amount || 0), 0),
        earned: rows.filter((r) => r.status === "earned").reduce((s, r) => s + Number(r.commission_amount || 0), 0),
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!active) return;
      if (u) {
        setSession({ id: u.id, email: u.email ?? null });
        await loadAffiliate(u.id);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const u = s?.user;
      setSession(u ? { id: u.id, email: u.email ?? null } : null);
      if (u) void loadAffiliate(u.id);
      else setAffiliate(null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAffiliate]);

  const referralLink = useMemo(
    () =>
      affiliate
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/shop?ref=${affiliate.code}`
        : "",
    [affiliate],
  );

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let userId = session?.id ?? null;
      if (!userId) {
        // Sign in if the account already exists; otherwise provision one
        // (server-side, confirmed) and then sign in so the RPC has auth.uid().
        let signIn = await supabase.auth.signInWithPassword({ email, password });
        if (signIn.error) {
          const { data: prov, error: provErr } = await supabase.functions.invoke(
            "dd-affiliate-signup",
            { body: { email, password, display_name: displayName } },
          );
          if (provErr) throw provErr;
          if ((prov as any)?.error) throw new Error((prov as any).error);
          if ((prov as any)?.existed) {
            throw new Error("An account with this email already exists — check your password.");
          }
          signIn = await supabase.auth.signInWithPassword({ email, password });
          if (signIn.error) throw signIn.error;
        }
        userId = signIn.data.user!.id;
      }


      const { data, error } = await (supabase as any).rpc("dd_affiliate_self_signup", {
        p_display_name: displayName || email,
        p_email: email || session?.email,
        p_phone: phone || null,
      });
      if (error) throw error;
      toast.success(data?.existed ? "You already have an affiliate account." : "Application submitted!");
      await loadAffiliate(userId!);
    } catch (err: any) {
      toast.error(err?.message ?? "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  if (affiliate) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Affiliate Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {affiliate.display_name || session?.email}
            </p>
          </div>
          <Badge variant={affiliate.status === "active" ? "default" : "secondary"} className="capitalize">
            {affiliate.status}
          </Badge>
        </div>

        {affiliate.status !== "active" && (
          <Card className="border-dashed">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Your application is under review. Your link works once approved — commissions only
              accrue on orders placed after approval.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Your referral link
            </CardTitle>
            <CardDescription>
              Commission rate: {(Number(affiliate.commission_rate) * 100).toFixed(0)}% · Code{" "}
              <span className="font-mono">{affiliate.code}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input readOnly value={referralLink} className="font-mono text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<MousePointerClick className="h-4 w-4" />} label="Clicks" value={String(affiliate.clicks)} />
          <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Attributed orders" value={String(totals.orders)} />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Pending" value={money(totals.pending)} />
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Earned" value={money(Number(affiliate.total_earned))} />
        </div>

        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Total earned</span>
              <span className="text-foreground font-medium">{money(Number(affiliate.total_earned))}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>Total paid out</span>
              <span className="text-foreground font-medium">{money(Number(affiliate.total_paid))}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>Unpaid balance</span>
              <span className="text-foreground font-medium">
                {money(Number(affiliate.total_earned) - Number(affiliate.total_paid))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Signup ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Become an Affiliate</h1>
      <p className="text-muted-foreground mb-6">
        Share your link, earn a commission on every order it brings in. Free to join.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apply in 30 seconds</CardTitle>
          <CardDescription>
            We'll create your account and issue your referral code right away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="aff-name">Your name</Label>
              <Input
                id="aff-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            {!session && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-email">Email</Label>
                  <Input
                    id="aff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-pass">Password</Label>
                  <Input
                    id="aff-pass"
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="aff-phone">Phone (optional)</Label>
              <Input id="aff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Join the program
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
