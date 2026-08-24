/**
 * DD SPRINT 5 — Split + Reserve Console
 * /dynasty-direct/splits
 *
 * David's view: global margin %, reserve %, dispute auto-submit toggle,
 * per-product margin overrides, ledger of every order split, and the
 * Stripe activation checklist.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DollarSign, Shield, Activity, CheckCircle2, Circle } from "lucide-react";

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function GlobalConfigCard() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ["dd-config"],
    queryFn: async () => (await supabase.from("dd_config").select("*").eq("id", true).maybeSingle()).data,
  });
  const [margin, setMargin] = useState<string>("");
  const [reserve, setReserve] = useState<string>("");
  const [holdDays, setHoldDays] = useState<string>("");

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = {};
      if (margin) patch.default_margin_pct = Number(margin);
      if (reserve) patch.default_reserve_pct = Number(reserve);
      if (holdDays) patch.reserve_hold_days = Number(holdDays);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("dd_config").update(patch).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dd-config"] }); toast.success("Saved"); setMargin(""); setReserve(""); setHoldDays(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAuto = useMutation({
    mutationFn: async (v: boolean) => {
      const { error } = await supabase.from("dd_config").update({ dispute_auto_submit: v, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dd-config"] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" />Global Defaults</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Default margin % <Badge variant="outline" className="ml-1">{cfg?.default_margin_pct ?? "—"}%</Badge></Label>
            <Input placeholder="15" value={margin} onChange={(e) => setMargin(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Default reserve % <Badge variant="outline" className="ml-1">{cfg?.default_reserve_pct ?? "—"}%</Badge></Label>
            <Input placeholder="8" value={reserve} onChange={(e) => setReserve(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Reserve hold days <Badge variant="outline" className="ml-1">{cfg?.reserve_hold_days ?? "—"}d</Badge></Label>
            <Input placeholder="45" value={holdDays} onChange={(e) => setHoldDays(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save defaults</Button>
        <div className="flex items-center gap-2 pt-2 border-t">
          <Switch checked={!!cfg?.dispute_auto_submit} onCheckedChange={(v) => toggleAuto.mutate(v)} />
          <Label className="text-sm">Auto-submit dispute evidence on creation</Label>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierPayoutCard() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({
    queryKey: ["dd-suppliers-payout"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesaler_profiles")
        .select("id, company_name, stripe_connect_id, stripe_payouts_enabled, reserve_pct, margin_pct_override")
        .order("company_name");
      return data || [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("wholesaler_profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dd-suppliers-payout"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Per-Supplier Overrides</CardTitle></CardHeader>
      <CardContent>
        {suppliers.map((s: any) => (
          <div key={s.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border-b py-2 text-sm">
            <div className="font-medium">{s.company_name}</div>
            <Badge variant={s.stripe_payouts_enabled ? "default" : s.stripe_connect_id ? "secondary" : "outline"}>
              {s.stripe_payouts_enabled ? "payouts on" : s.stripe_connect_id ? "pending" : "not connected"}
            </Badge>
            <Input
              type="number" defaultValue={s.margin_pct_override ?? ""} placeholder="margin % override"
              onBlur={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                update.mutate({ id: s.id, patch: { margin_pct_override: v } });
              }}
            />
            <Input
              type="number" defaultValue={s.reserve_pct} placeholder="reserve %"
              onBlur={(e) => {
                const v = Number(e.target.value || 0);
                update.mutate({ id: s.id, patch: { reserve_pct: v } });
              }}
            />
            <span className="text-xs text-muted-foreground font-mono">{s.stripe_connect_id?.slice(0, 16) ?? "—"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SplitLedgerCard() {
  const { data: rows = [] } = useQuery({
    queryKey: ["dd-split-ledger"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_split_ledger")
        .select("*, w:wholesaler_id(company_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    refetchInterval: 10_000,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Split Ledger (last 100)</CardTitle></CardHeader>
      <CardContent>
        <div className="text-xs">
          <div className="grid grid-cols-8 gap-2 font-semibold border-b pb-1">
            <span>Order</span><span>Supplier</span><span>Gross</span><span>Stripe</span><span>DD Margin</span><span>Transfer</span><span>Reserve</span><span>Status</span>
          </div>
          {rows.map((r: any) => (
            <div key={r.id} className="grid grid-cols-8 gap-2 border-b py-1">
              <span className="font-mono">{r.order_id.slice(0, 8)}</span>
              <span>{r.w?.company_name ?? "—"}</span>
              <span>{fmt(r.gross_amount_cents)}</span>
              <span>{fmt(r.stripe_fee_cents)}</span>
              <span className="text-emerald-600">{fmt(r.dd_margin_cents)}</span>
              <span>{fmt(r.supplier_transfer_cents)}</span>
              <span>{fmt(r.reserve_held_cents)}</span>
              <Badge variant={
                r.status === "transferred" ? "default" :
                r.status === "disputed" ? "destructive" :
                r.status === "transfer_failed" ? "destructive" : "secondary"
              }>{r.status}</Badge>
            </div>
          ))}
          {rows.length === 0 && <div className="text-muted-foreground py-4">No split rows yet.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MANUAL RELEASE GATE. Every payout row lands held + unapproved, so no money
 * moves until a human clicks here. Approving stamps approved_at via
 * dd_approve_reserve_release (admin/owner only); the transfer itself is still
 * executed by dd-release-reserves once the hold has matured.
 */
function PayoutApprovalCard() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dd-reserve-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_reserve_ledger")
        .select("*, w:wholesaler_id(company_name)")
        .eq("status", "held")
        .is("approved_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("dd_approve_reserve_release" as any, { p_reserve_id: id });
      if (error) throw error;
      // Release immediately if the hold has already matured; otherwise the cron
      // picks it up on the release date now that it is approved.
      await supabase.functions.invoke("dd-release-reserves", { body: { reserve_id: id } });
    },
    onSuccess: () => {
      toast.success("Payout approved");
      qc.invalidateQueries({ queryKey: ["dd-reserve-approvals"] });
      qc.invalidateQueries({ queryKey: ["dd-split-ledger"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4" />Payouts awaiting your approval
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="text-muted-foreground">Nothing waiting. No supplier money moves without a click here.</div>
        )}
        {rows.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b py-2">
            <div>
              <div className="font-medium">
                {r.w?.company_name ?? "Unknown supplier"} is owed {fmt(r.amount_cents)}
              </div>
              <div className="text-xs text-muted-foreground">
                order {String(r.order_id ?? "").slice(0, 8)} · {r.kind ?? "payout"} · releases{" "}
                {r.release_at ? new Date(r.release_at).toLocaleDateString() : "—"}
              </div>
            </div>
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
              Release
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivationChecklist() {
  const items = [
    { id: "key", label: "STRIPE_SECRET_KEY_DD added to Lovable Cloud secrets" },
    { id: "webhook", label: "DD_STRIPE_CONNECT_WEBHOOK_SECRET configured (Connect events endpoint)" },
    { id: "express", label: "Stripe Connect Express enabled in Stripe dashboard" },
    { id: "debit", label: "Negative balance / debit agreement enabled on connected accounts" },
    { id: "radar", label: "Radar rules enabled (review high-risk + 3DS for risky charges)" },
    { id: "easypost", label: "EASYPOST_API_KEY set (for tracking → evidence kit)" },
  ];
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("dd-activation") || "{}"); } catch { return {}; }
  });
  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem("dd-activation", JSON.stringify(next));
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Activation Checklist (David)</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.map((i) => (
          <button key={i.id} onClick={() => toggle(i.id)} className="flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 p-1 rounded">
            {checked[i.id] ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
            <span className={checked[i.id] ? "line-through text-muted-foreground" : ""}>{i.label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DynastyDirectSplitConsole() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="w-6 h-6" />Split + Reserve Console</h1>
        <p className="text-sm text-muted-foreground">DD margin, rolling reserve, dispute armor. Key-ready: edge functions read STRIPE_SECRET_KEY_DD with a STRIPE_SECRET_KEY fallback.</p>
      </div>
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="activation">Activation</TabsTrigger>
        </TabsList>
        <TabsContent value="config"><GlobalConfigCard /></TabsContent>
        <TabsContent value="suppliers"><SupplierPayoutCard /></TabsContent>
        <TabsContent value="approvals"><PayoutApprovalCard /></TabsContent>
        <TabsContent value="ledger"><SplitLedgerCard /></TabsContent>
        <TabsContent value="activation"><ActivationChecklist /></TabsContent>
      </Tabs>
    </div>
  );
}
