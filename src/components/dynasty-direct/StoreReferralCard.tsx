// Store referral program card — surfaces invite link, email invite, and a
// history of referrals with status badges.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Mail, Users } from "lucide-react";
import { toast } from "sonner";

type Referral = {
  id: string;
  referred_email: string;
  referral_code: string;
  status: "pending" | "signed_up" | "qualified" | "rewarded";
  referrer_credit_amount: number | null;
  created_at: string;
  rewarded_at: string | null;
  first_order_id: string | null;
};

const STATUS_META: Record<Referral["status"], { label: string; cls: string }> = {
  pending:   { label: "Invited",     cls: "bg-muted text-muted-foreground" },
  signed_up: { label: "Signed Up",   cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  qualified: { label: "Ordered ✅",  cls: "bg-green-500/15 text-green-700 dark:text-green-300" },
  rewarded:  { label: "$50 Earned",  cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
};

export default function StoreReferralCard({ userId, storeId, referrerName }: {
  userId: string;
  storeId?: string | null;
  referrerName?: string | null;
}) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Stable personal share code derived from user id (memoized). Backed by a
  // referral row only when the user clicks "Email Invite" or shares the link
  // to a specific friend. Generic link is a permanent shortcut.
  const personalCode = useMemo(() => `STORE${userId.replace(/-/g, "").slice(0, 6).toUpperCase()}`, [userId]);
  const referralLink = `https://dynastydirect.com/join?ref=${personalCode}`;

  const { data: referrals = [] } = useQuery({
    queryKey: ["dd-store-referrals", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_store_referrals")
        .select("id, referred_email, referral_code, status, referrer_credit_amount, created_at, rewarded_at, first_order_id")
        .eq("referrer_user_id", userId)
        .order("created_at", { ascending: false });
      return (data || []) as Referral[];
    },
  });

  // Ensure the personal code exists as a pending row so the generic link works.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dd_store_referrals")
        .select("id")
        .eq("referral_code", personalCode)
        .maybeSingle();
      if (!data) {
        await supabase.from("dd_store_referrals").insert({
          referrer_user_id: userId,
          referrer_store_id: storeId ?? null,
          referred_email: "link-share@dynastydirect.com",
          referral_code: personalCode,
          status: "pending",
        });
      }
    })();
  }, [personalCode, storeId, userId]);

  const totalEarned = useMemo(
    () => referrals.filter((r) => r.status === "rewarded")
      .reduce((s, r) => s + Number(r.referrer_credit_amount ?? 50), 0),
    [referrals]
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  }

  async function sendInvite() {
    if (!inviteEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail)) {
      toast.error("Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("dd-send-referral-invite", {
        body: {
          referrer_user_id: userId,
          referrer_store_id: storeId ?? null,
          referrer_name: referrerName ?? null,
          referred_email: inviteEmail,
        },
      });
      if (error) throw error;
      toast.success(`Invite sent to ${inviteEmail}!`);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["dd-store-referrals", userId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          🤝 Refer a Store, Earn $50
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Earn $50 store credit for every store you refer that places their first order
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {["Share your referral link","They sign up + place first order","You earn $50 store credit"]
            .map((step, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Step {i + 1}</div>
                <div className="font-medium">{step}</div>
              </div>
            ))}
        </div>

        {/* Your referral link */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Your Referral Link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input readOnly value={referralLink} className="font-mono text-xs" />
            <Button variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
          </div>
        </div>

        {/* Invite by email */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Invite by Email</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="friend@storename.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button onClick={sendInvite} disabled={busy}>
              <Mail className="h-4 w-4 mr-2" /> Send Invite
            </Button>
          </div>
        </div>

        {/* Total earned */}
        <div className="rounded-lg border bg-emerald-500/5 p-4">
          <div className="text-xs uppercase text-muted-foreground">Total Earned</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${totalEarned.toFixed(0)} in referral credits
          </div>
        </div>

        {/* Your referrals */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Your Referrals</div>
          {referrals.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
              No referrals yet — invite your first store above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals
                  .filter((r) => r.referred_email !== "link-share@dynastydirect.com")
                  .map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.referred_email}</TableCell>
                        <TableCell><Badge className={meta.cls} variant="outline">{meta.label}</Badge></TableCell>
                        <TableCell className="text-xs">{r.status !== "pending" ? "Yes" : "—"}</TableCell>
                        <TableCell className="text-xs">{r.first_order_id ? "Yes" : "—"}</TableCell>
                        <TableCell className="text-right">
                          {r.status === "rewarded" ? `$${Number(r.referrer_credit_amount ?? 50).toFixed(0)}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
