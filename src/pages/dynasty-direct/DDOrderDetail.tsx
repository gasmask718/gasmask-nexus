// Dynasty Direct — Order Detail
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Mail, DollarSign, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

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
        .from("marketplace_order_items")
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
                  {grabbaRow.last_error && <Row k="Last Error" v={grabbaRow.last_error} />}
                </div>
              )}
              <Button size="sm" onClick={() => forceSync.mutate()} disabled={forceSync.isPending}>
                <RefreshCw className="w-3 h-3 mr-1" />
                {grabbaStatus === "synced" ? "Force Resync" : "Sync to Grabba"}
              </Button>
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
