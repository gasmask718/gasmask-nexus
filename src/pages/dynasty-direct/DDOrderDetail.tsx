// Dynasty Direct — Order Detail
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Mail, DollarSign, Zap, TrendingUp, Bell, CheckCircle2, Clock, Shield, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type NotifyEvent = "confirmed" | "processing" | "shipped" | "delivered";
const stages = ["paid", "routed", "fulfillment", "shipped", "delivered"];

export default function DDOrderDetail() {
  const { orderId = "" } = useParams();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["dd-order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["dd-order-items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_order_items" as any)
        .select("*, products_all(product_name, images)")
        .eq("order_id", orderId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });

  const { data: routing = [] } = useQuery({
    queryKey: ["dd-order-routing", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_routing_audit" as any)
        .select("*")
        .eq("order_id", orderId);
      return (data || []) as any[];
    },
    enabled: !!orderId,
  });

  const { data: grabba = [] } = useQuery({
    queryKey: ["dd-order-grabba", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_grabba_sync" as any)
        .select("*")
        .eq("marketplace_order_id", orderId);
      return (data || []) as any[];
    },
    enabled: !!orderId,
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: ["dd-order-webhooks", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_webhook_events" as any)
        .select("event_id, type, source, received_at")
        .order("received_at", { ascending: false })
        .limit(50);
      // Filter on client - dd_webhook_events doesn't have order_id column
      return (data || []) as any[];
    },
    enabled: !!orderId,
  });

  const forceSync = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("dd-grabba-bridge", {
        body: { order_id: orderId, force_resync: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grabba sync triggered");
      qc.invalidateQueries({ queryKey: ["dd-order-grabba", orderId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendEmail = useMutation({
    mutationFn: async () => {
      if (!order?.customer_email) throw new Error("No customer email on order");
      const { error } = await supabase.functions.invoke("dd-send-email", {
        body: {
          template: "order-confirmation",
          to: order.customer_email,
          data: { order_id: orderId, amount_total: order.total },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Confirmation email resent"),
    onError: (e: any) => toast.error(e.message),
  });

  const notifySupplier = useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await supabase.functions.invoke("dd-notify-supplier-order", {
        body: {
          grabba_sync_id: row.id,
          wholesaler_id: row.wholesaler_id,
          order_id: orderId,
        },
      });
      if (error) throw error;
      return data as { notified?: string; sent?: boolean; error?: string };
    },
    onSuccess: (res) => {
      if (res?.sent) toast.success(`Notification sent to ${res.notified ?? "supplier"}`);
      else toast.warning(res?.error ?? "Notification not sent");
      qc.invalidateQueries({ queryKey: ["dd-order-grabba", orderId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [notifyEvent, setNotifyEvent] = useState<NotifyEvent>("confirmed");
  const notifyCustomer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("dd-notify-customer-order-update", {
        body: { order_id: orderId, event_type: notifyEvent },
      });
      if (error) throw error;
      return data as { success: boolean; sms_sent: boolean; email_sent: boolean };
    },
    onSuccess: (res) => {
      const channels = [res?.sms_sent && "SMS", res?.email_sent && "email"].filter(Boolean).join(" and ");
      toast.success(channels ? `Customer notified via ${channels}` : "Notification logged (no channels reachable)");
      qc.invalidateQueries({ queryKey: ["dd-order-detail", orderId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading order…</div>;
  if (!order) return <div className="p-6 text-sm text-muted-foreground">Order not found.</div>;

  const grabbaRow = grabba[0];
  const grabbaStatus = grabbaRow?.status ?? "not_synced";
  const currentStageIdx = (() => {
    const s = order.fulfillment_status ?? "processing";
    if (order.payment_status === "paid" && s === "processing") return 0;
    if (s === "routed") return 1;
    if (s === "fulfillment") return 2;
    if (s === "shipped") return 3;
    if (s === "delivered") return 4;
    return 0;
  })();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dynasty-direct/orders"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders</Link>
          </Button>
          <h1 className="text-xl font-bold">
            Order #{orderId.slice(0, 8)}
          </h1>
          <Badge variant="outline">{order.payment_status}</Badge>
          <Badge variant="outline">{order.fulfillment_status}</Badge>
          {(order as any).stripe_risk_level === "highest" && (
            <Badge className="bg-red-500/15 text-red-700 border-red-500/30" variant="outline">🚫 High Risk</Badge>
          )}
          {(order as any).stripe_risk_level === "elevated" && (
            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">⚠️ Review</Badge>
          )}
          {(order as any).three_ds_authenticated && (
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">🛡️ 3DS Verified</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Order Info</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row k="Customer Email" v={order.customer_email} />
              <Row k="Customer Phone" v={order.customer_phone} />
              <Row k="Order Date" v={new Date(order.created_at).toLocaleString()} />
              <Row k="Payment Intent" v={order.stripe_payment_intent_id} mono />
              <Row k="Total" v={`$${Number(order.total).toFixed(2)}`} />
              <Row k="Order Type" v={order.order_type} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No items.</div>
              ) : (
                <div className="space-y-2">
                  {items.map((it: any) => (
                    <div key={it.id} className="flex items-center gap-3 border-b py-2 text-sm">
                      <div className="w-10 h-10 bg-muted rounded shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">{it.products_all?.product_name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.qty} × ${Number(it.price_each).toFixed(2)}
                        </div>
                      </div>
                      <div className="font-mono">${(Number(it.qty) * Number(it.price_each)).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <Row k="Subtotal" v={`$${Number(order.subtotal ?? 0).toFixed(2)}`} />
              <Row k="Tax" v={`$${Number(order.tax_amount ?? 0).toFixed(2)}`} />
              <Row k="Shipping" v={`$${Number(order.shipping_cost ?? 0).toFixed(2)}`} />
              {Number(order.discount_amount ?? 0) > 0 && (
                <Row k="Discount" v={`-$${Number(order.discount_amount).toFixed(2)}`} />
              )}
              <Row k="Total" v={`$${Number(order.total).toFixed(2)}`} />
            </CardContent>
          </Card>

          <FraudProtectionCard order={order} orderId={orderId} />
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Fulfillment Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {stages.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div
                      className={`w-6 h-6 rounded-full text-xs flex items-center justify-center border ${
                        i <= currentStageIdx
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>
                    {i < stages.length - 1 && (
                      <div className={`h-0.5 flex-1 ${i < currentStageIdx ? "bg-emerald-500" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                {stages.map((s) => <span key={s} className="capitalize">{s}</span>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Supplier Routing</CardTitle></CardHeader>
            <CardContent>
              {routing.length === 0 ? (
                <div className="text-sm text-muted-foreground">No routing decisions logged.</div>
              ) : (
                <div className="space-y-1 text-sm">
                  {routing.map((r: any) => (
                    <div key={r.id} className="flex justify-between border-b py-1">
                      <span>{r.action ?? r.type ?? "route"}</span>
                      <span className="font-mono text-xs">{r.wholesaler_id?.slice(0, 8) ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <SupplierPerformanceMini wholesalerId={routing[0]?.wholesaler_id ?? grabbaRow?.wholesaler_id ?? (order as any).wholesaler_id ?? null} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span><Zap className="w-4 h-4 inline mr-1 text-amber-500" />Grabba Bridge</span>
                <Badge variant={grabbaStatus === "synced" ? "default" : grabbaStatus === "failed" ? "destructive" : "secondary"}>
                  {grabbaStatus}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {grabbaRow && (
                <div className="text-xs space-y-1">
                  <Row k="Attempts" v={String(grabbaRow.attempt_count ?? 0)} />
                  <Row k="Last Synced" v={grabbaRow.synced_at ? new Date(grabbaRow.synced_at).toLocaleString() : "—"} />
                  <Row
                    k="Supplier Notified"
                    v={
                      grabbaRow.supplier_notified
                        ? `✅ ${grabbaRow.supplier_notified_at ? new Date(grabbaRow.supplier_notified_at).toLocaleString() : "sent"}`
                        : "❌ Not sent"
                    }
                  />
                  {grabbaRow.last_error && <Row k="Last Error" v={grabbaRow.last_error} />}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => forceSync.mutate()} disabled={forceSync.isPending}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {grabbaStatus === "synced" ? "Force Resync" : "Sync to Grabba"}
                </Button>
                {grabbaRow && !grabbaRow.supplier_notified && grabbaRow.wholesaler_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => notifySupplier.mutate(grabbaRow)}
                    disabled={notifySupplier.isPending}
                  >
                    <Mail className="w-3 h-3 mr-1" /> Resend Notification
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent Webhook Events</CardTitle></CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events.</div>
              ) : (
                <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                  {webhooks.map((w: any) => (
                    <div key={w.event_id} className="flex justify-between border-b py-1">
                      <span className="font-mono">{w.type}</span>
                      <span className="text-muted-foreground">{new Date(w.received_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" />Customer Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Phone: <span className="font-mono">{order.customer_phone ?? "—"}</span> · Email: <span className="font-mono">{order.customer_email ?? "—"}</span>
              </div>
              <div className="space-y-1 text-sm">
                {(["confirmed", "processing", "shipped", "delivered"] as NotifyEvent[]).map((evt) => {
                  const log = (Array.isArray((order as any).notification_log) ? (order as any).notification_log : []) as any[];
                  const entry = log.filter((l) => l?.type === evt).pop();
                  return (
                    <div key={evt} className="flex items-center justify-between border-b py-1">
                      <span className="flex items-center gap-2 capitalize">
                        {entry ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                        {evt}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry ? `${new Date(entry.sent_at).toLocaleString()} · ${(entry.channels ?? []).join(", ") || "logged"}` : "pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center pt-2">
                <Select value={notifyEvent} onValueChange={(v) => setNotifyEvent(v as NotifyEvent)}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => notifyCustomer.mutate()} disabled={notifyCustomer.isPending}>
                  <Bell className="w-3 h-3 mr-1" />
                  {notifyCustomer.isPending ? "Sending…" : "Send Notification"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => resendEmail.mutate()} disabled={resendEmail.isPending}>
                <Mail className="w-3 h-3 mr-1" /> Resend Confirmation
              </Button>
              <Button size="sm" variant="outline" onClick={() => forceSync.mutate()} disabled={forceSync.isPending}>
                <Zap className="w-3 h-3 mr-1" /> Force Grabba Sync
              </Button>
              <Button size="sm" variant="destructive" disabled>
                <DollarSign className="w-3 h-3 mr-1" /> Issue Refund
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{v ?? "—"}</span>
    </div>
  );
}

function SupplierPerformanceMini({ wholesalerId }: { wholesalerId: string | null }) {
  const { data } = useQuery({
    queryKey: ["dd-order-supplier-mini", wholesalerId],
    enabled: !!wholesalerId,
    queryFn: async () => {
      const { data: w } = await supabase
        .from("wholesalers")
        .select("name,reliability_grade,on_time_rate_lifetime,avg_fulfillment_days")
        .eq("id", wholesalerId!)
        .maybeSingle();
      return w;
    },
  });
  if (!wholesalerId) return null;
  const grade = (data as any)?.reliability_grade ?? "unrated";
  const gradeColor: Record<string, string> = {
    A: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    B: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    C: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
    D: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    F: "bg-red-500/15 text-red-700 border-red-500/30",
    unrated: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Supplier Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{(data as any)?.name ?? "Supplier"}</span>
          <Badge className={gradeColor[grade] ?? gradeColor.unrated} variant="outline">Grade {grade}</Badge>
        </div>
        <Row k="Fulfillment rate" v={`${Number((data as any)?.on_time_rate_lifetime ?? 0).toFixed(1)}%`} />
        <Row k="Avg fulfillment" v={`${Number((data as any)?.avg_fulfillment_days ?? 0).toFixed(1)} days`} />
        <Button asChild size="sm" variant="outline" className="w-full mt-2">
          <Link to={`/dynasty-direct/suppliers/performance?supplier=${wholesalerId}`}>View Full Performance →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FraudProtectionCard({ order, orderId }: { order: any; orderId: string }) {
  const qc = useQueryClient();
  const flagged = !!order.fraud_review_flag;
  const riskLevel = order.stripe_risk_level ?? "normal";
  const riskScore = order.stripe_risk_score;
  const verified = !!order.three_ds_authenticated;

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("marketplace_orders")
        .update({ fraud_review_flag: false })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order approved for fulfillment");
      qc.invalidateQueries({ queryKey: ["dd-order-detail", orderId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelRefund = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("dd-refund-order", {
        body: { order_id: orderId, reason: "fraud_review_cancelled" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Refund initiated and order cancelled");
      qc.invalidateQueries({ queryKey: ["dd-order-detail", orderId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Refund failed"),
  });

  const riskColor =
    riskLevel === "highest"
      ? "bg-red-500/15 text-red-700 border-red-500/30"
      : riskLevel === "elevated"
      ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4" /> Fraud Protection
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Risk Level</span>
          <Badge className={riskColor} variant="outline">{riskLevel}</Badge>
        </div>
        <Row k="Risk Score" v={riskScore != null ? `${riskScore} / 100` : "—"} />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">3DS Authenticated</span>
          <span className="flex items-center gap-1">
            {verified ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <ShieldAlert className="w-4 h-4 text-amber-500" />}
            {verified ? "✅ Yes" : "❌ No"}
          </span>
        </div>
        <Row k="Flagged for Review" v={flagged ? "Yes" : "No"} />

        {flagged && (
          <div className="border-2 border-red-500 bg-red-500/10 rounded p-3 mt-3">
            <div className="font-semibold text-red-600 text-sm">
              ⚠️ This order was flagged as elevated risk by Stripe Radar.
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Review the order details before fulfilling.
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve and Fulfill
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Refund and cancel this order?")) cancelRefund.mutate();
                }}
                disabled={cancelRefund.isPending}
              >
                <XCircle className="w-3 h-3 mr-1" /> Cancel and Refund
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
