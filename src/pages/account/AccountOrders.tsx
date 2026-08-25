import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Truck, ChevronRight } from "lucide-react";

interface OrderRow {
  id: string;
  created_at: string | null;
  total: number | null;
  payment_status: string | null;
  fulfillment_status: string | null;
}

interface FulfillmentRow {
  order_id: string;
  tracking_number: string | null;
  carrier: string | null;
  status: string;
}

function statusVariant(status: string | null) {
  if (!status) return "outline" as const;
  if (["paid", "delivered", "completed"].includes(status)) return "default" as const;
  if (["failed", "cancelled", "disputed"].includes(status)) return "destructive" as const;
  return "secondary" as const;
}

export default function AccountOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [fulfillmentsByOrder, setFulfillmentsByOrder] = useState<Record<string, FulfillmentRow[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("marketplace_orders" as any)
        .select("id, created_at, total, payment_status, fulfillment_status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error(`Failed to load orders: ${error.message}`);
        setLoading(false);
        return;
      }
      if (cancelled) return;

      const rows = (data || []) as any as OrderRow[];
      setOrders(rows);

      if (rows.length > 0) {
        const { data: fulfillments, error: fError } = await supabase
          .from("marketplace_fulfillments" as any)
          .select("order_id, tracking_number, carrier, status")
          .in("order_id", rows.map((r) => r.id));
        if (fError) {
          toast.error(`Failed to load shipments: ${fError.message}`);
        } else {
          const grouped: Record<string, FulfillmentRow[]> = {};
          ((fulfillments || []) as any as FulfillmentRow[]).forEach((f) => {
            grouped[f.order_id] = grouped[f.order_id] || [];
            grouped[f.order_id].push(f);
          });
          setFulfillmentsByOrder(grouped);
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">You haven't placed any orders yet.</p>
          <Button asChild>
            <Link to="/shop">Browse the shop</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Order History</h1>
      {orders.map((order) => {
        const shipments = fulfillmentsByOrder[order.id] || [];
        return (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Order #{order.id.slice(0, 8).toUpperCase()}
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(order.payment_status)}>
                  {order.payment_status || "unknown"}
                </Badge>
                <Badge variant={statusVariant(order.fulfillment_status)}>
                  {order.fulfillment_status || "pending"}
                </Badge>
                <span className="ml-auto font-semibold">${Number(order.total || 0).toFixed(2)}</span>
              </div>

              {shipments.filter((s) => s.tracking_number).length > 0 && (
                <div className="space-y-1 text-sm">
                  {shipments.filter((s) => s.tracking_number).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      {s.carrier ? `${s.carrier}: ` : ""}
                      <span className="font-mono">{s.tracking_number}</span>
                      <Badge variant="outline" className="ml-1">{s.status}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to={`/account/orders/${order.id}`}>
                  View details
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
