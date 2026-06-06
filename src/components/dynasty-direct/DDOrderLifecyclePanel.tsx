/**
 * DD SPRINT 5 — Order Lifecycle Panel
 * Drop into an order detail screen to show the full chain:
 *   paid → routed → supplier accepted → shipped → delivered → settled
 * plus dispute banner.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertTriangle, Truck, Package } from "lucide-react";

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { orderId: string }

export function DDOrderLifecyclePanel({ orderId }: Props) {
  const { data } = useQuery({
    queryKey: ["dd-order-lifecycle", orderId],
    enabled: !!orderId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [
        { data: order },
        { data: routing },
        { data: fulfillments },
        { data: splits },
        { data: reserves },
        { data: dispute },
      ] = await Promise.all([
        supabase.from("marketplace_orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("order_routing").select("*").eq("order_id", orderId).maybeSingle(),
        supabase.from("marketplace_fulfillments").select("*").eq("order_id", orderId),
        supabase.from("dd_split_ledger").select("*").eq("order_id", orderId),
        supabase.from("dd_reserve_ledger").select("*").eq("order_id", orderId),
        supabase.from("dd_dispute_events").select("*").eq("order_id", orderId).maybeSingle(),
      ]);
      return { order, routing, fulfillments: fulfillments ?? [], splits: splits ?? [], reserves: reserves ?? [], dispute };
    },
  });

  if (!data?.order) return null;
  const o = data.order;
  const routing = data.routing as any;
  const fulfillments = data.fulfillments;
  const splits = data.splits;
  const reserves = data.reserves;
  const dispute = data.dispute as any;

  const paid = o.payment_status === "paid";
  const routed = !!routing?.assigned_wholesaler_id;
  const accepted = fulfillments.some((f: any) => ["accepted", "processing", "shipped", "delivered"].includes(f.status));
  const shipped = fulfillments.some((f: any) => f.tracking_number);
  const delivered = fulfillments.every((f: any) => f.status === "delivered");
  const settled = splits.length > 0 && splits.every((s: any) => s.status === "transferred");
  const reserveReleased = reserves.length > 0 && reserves.every((r: any) => r.status === "released");

  const steps = [
    { ok: paid, label: `Paid${o.total ? ` · $${Number(o.total).toFixed(2)}` : ""}` },
    { ok: routed, label: `Routed${routing?.routing_reason ? ` (${routing.routing_reason})` : ""}` },
    { ok: accepted, label: "Supplier accepted" },
    { ok: shipped, label: shipped ? `Shipped · ${fulfillments[0].tracking_number}` : "Shipped" },
    { ok: delivered, label: "Delivered" },
    { ok: settled, label: "Split settled" },
    { ok: reserveReleased, label: reserves.length > 0 ? "Reserve released" : "No reserve" },
  ];

  return (
    <div className="space-y-3">
      {dispute && (
        <div className="border-2 border-red-500 bg-red-500/10 rounded p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-red-600">Dispute: {dispute.status} · {dispute.reason}</div>
            <div className="text-xs text-muted-foreground">Stripe dispute {dispute.stripe_dispute_id} · amount {fmt(dispute.amount_cents)}</div>
            {dispute.recovery_steps && Array.isArray(dispute.recovery_steps) && dispute.recovery_steps.length > 0 && (
              <div className="text-xs mt-1">Recovery: {dispute.recovery_steps.map((s: any) => s.step).join(" → ")}</div>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" />Lifecycle</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {s.ok
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <Circle className="w-4 h-4 text-muted-foreground" />}
              <span className={s.ok ? "" : "text-muted-foreground"}>{s.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" />Fulfillments</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {fulfillments.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between border-b py-1">
              <span className="font-mono">{f.id.slice(0, 8)}</span>
              <Badge variant={f.status === "delivered" ? "default" : "secondary"}>{f.status}</Badge>
              <span>{f.tracking_number ? `${f.carrier ?? ""} ${f.tracking_number}` : "no tracking"}</span>
            </div>
          ))}
          {fulfillments.length === 0 && <div className="text-muted-foreground">none</div>}
        </CardContent>
      </Card>

      {splits.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Splits</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {splits.map((s: any) => (
              <div key={s.id} className="grid grid-cols-5 gap-2 border-b py-1">
                <span>Gross {fmt(s.gross_amount_cents)}</span>
                <span>Fee {fmt(s.stripe_fee_cents)}</span>
                <span>DD {fmt(s.dd_margin_cents)}</span>
                <span>Transfer {fmt(s.supplier_transfer_cents)}</span>
                <Badge variant={s.status === "transferred" ? "default" : s.status === "disputed" ? "destructive" : "secondary"}>{s.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
