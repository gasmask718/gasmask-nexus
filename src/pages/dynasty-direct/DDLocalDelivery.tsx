// Dynasty Direct — Local Delivery management
// Pending in-person deliveries, schedule, mark delivered, route planner.
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Truck, MapPin, CalendarCheck, Plus } from "lucide-react";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  total: number | null;
  status: string | null;
  fulfillment_method: string | null;
  delivery_scheduled_date: string | null;
  delivery_completed_at: string | null;
  created_at: string;
  shipping_address: any;
  store_account_id: string | null;
  store_accounts?: {
    business_name: string | null;
    phone: string | null;
    delivery_address: string | null;
    delivery_city: string | null;
    delivery_state: string | null;
    delivery_zip: string | null;
    delivery_window: string | null;
    delivery_notes: string | null;
  } | null;
};

type Route = {
  id: string;
  route_date: string;
  driver_name: string | null;
  status: string;
  order_ids: string[];
  total_stops: number;
  notes: string | null;
};

function formatAddr(o: OrderRow): string {
  const sa = o.store_accounts;
  if (sa?.delivery_address) {
    return [sa.delivery_address, sa.delivery_city, sa.delivery_state, sa.delivery_zip]
      .filter(Boolean).join(", ");
  }
  const ship = o.shipping_address ?? {};
  return [ship.line1, ship.city, ship.state, ship.postal_code].filter(Boolean).join(", ") || "—";
}

export default function DDLocalDelivery() {
  const qc = useQueryClient();
  const [scheduling, setScheduling] = useState<OrderRow | null>(null);
  const [routeDate, setRouteDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedForRoute, setSelectedForRoute] = useState<Set<string>>(new Set());

  const { data: orders = [] } = useQuery({
    queryKey: ["dd-local-delivery-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await (supabase as any)
        .from("marketplace_orders")
        .select(`
          id,total,status,fulfillment_method,delivery_scheduled_date,
          delivery_completed_at,created_at,shipping_address,store_account_id,
          store_accounts:store_account_id (
            business_name,phone,delivery_address,delivery_city,delivery_state,
            delivery_zip,delivery_window,delivery_notes
          )
        `)
        .eq("fulfillment_method", "local_delivery")
        .is("delivery_completed_at", null)
        .in("status", ["paid", "captured", "completed", "processing"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
    refetchInterval: 30_000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["dd-delivery-routes"],
    queryFn: async (): Promise<Route[]> => {
      const { data, error } = await (supabase as any)
        .from("dd_delivery_routes")
        .select("id,route_date,driver_name,status,order_ids,total_stops,notes")
        .order("route_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Route[];
    },
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pending = orders.filter((o) => !o.delivery_scheduled_date).length;
    const scheduled = orders.filter((o) => !!o.delivery_scheduled_date).length;
    return { pending, scheduled, completedToday: 0, _today: today };
  }, [orders]);

  const { data: completedToday = 0 } = useQuery({
    queryKey: ["dd-local-delivery-completed-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await (supabase as any)
        .from("marketplace_orders")
        .select("id", { count: "exact", head: true })
        .eq("fulfillment_method", "local_delivery")
        .gte("delivery_completed_at", start.toISOString());
      return count ?? 0;
    },
  });

  const ordersOnRouteDate = useMemo(
    () => orders.filter((o) => o.delivery_scheduled_date === routeDate),
    [orders, routeDate],
  );

  const scheduleMutation = useMutation({
    mutationFn: async ({ order, date }: { order: OrderRow; date: string }) => {
      const { error } = await (supabase as any)
        .from("marketplace_orders")
        .update({ delivery_scheduled_date: date })
        .eq("id", order.id);
      if (error) throw error;

      const phone = order.store_accounts?.phone;
      const window = order.store_accounts?.delivery_window ?? "the scheduled window";
      if (phone) {
        await supabase.functions.invoke("send-sms", {
          body: {
            to_number: phone,
            message_body: `📦 Your Dynasty Direct order is scheduled for delivery on ${date} during ${window}. Questions? Reply to this SMS.`,
            idempotency_key: `dd-deliv-sched-${order.id}-${date}`,
            metadata: { brand: "dynasty_direct", category: "delivery_scheduled", order_id: order.id },
          },
        }).catch(() => null);
      }
    },
    onSuccess: () => {
      toast.success("Delivery scheduled");
      setScheduling(null);
      qc.invalidateQueries({ queryKey: ["dd-local-delivery-orders"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to schedule"),
  });

  const markDeliveredMutation = useMutation({
    mutationFn: async (order: OrderRow) => {
      const { error } = await (supabase as any)
        .from("marketplace_orders")
        .update({ delivery_completed_at: new Date().toISOString(), status: "delivered" })
        .eq("id", order.id);
      if (error) throw error;

      const phone = order.store_accounts?.phone;
      if (phone) {
        await supabase.functions.invoke("send-sms", {
          body: {
            to_number: phone,
            message_body: `✅ Your Dynasty Direct order has been delivered! Check your inventory and let us know if anything is missing.`,
            idempotency_key: `dd-deliv-done-${order.id}`,
            metadata: { brand: "dynasty_direct", category: "delivery_completed", order_id: order.id },
          },
        }).catch(() => null);
      }
    },
    onSuccess: () => {
      toast.success("Marked as delivered");
      qc.invalidateQueries({ queryKey: ["dd-local-delivery-orders"] });
      qc.invalidateQueries({ queryKey: ["dd-local-delivery-completed-today"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to mark delivered"),
  });

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedForRoute);
      if (ids.length === 0) throw new Error("Select at least one order");
      const { error } = await (supabase as any).from("dd_delivery_routes").insert({
        route_date: routeDate,
        order_ids: ids,
        total_stops: ids.length,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Route created");
      setSelectedForRoute(new Set());
      qc.invalidateQueries({ queryKey: ["dd-delivery-routes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create route"),
  });

  const routeStatusMutation = useMutation({
    mutationFn: async ({ route, nextStatus }: { route: Route; nextStatus: "in_progress" | "completed" | "cancelled" }) => {
      const { error } = await (supabase as any)
        .from("dd_delivery_routes")
        .update({ status: nextStatus })
        .eq("id", route.id);
      if (error) throw error;
      if (nextStatus === "completed" && route.order_ids?.length) {
        const nowIso = new Date().toISOString();
        await (supabase as any)
          .from("marketplace_orders")
          .update({ delivery_completed_at: nowIso, status: "delivered" })
          .in("id", route.order_ids)
          .is("delivery_completed_at", null);
      }
    },
    onSuccess: () => {
      toast.success("Route updated");
      qc.invalidateQueries({ queryKey: ["dd-delivery-routes"] });
      qc.invalidateQueries({ queryKey: ["dd-local-delivery-orders"] });
      qc.invalidateQueries({ queryKey: ["dd-local-delivery-completed-today"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Truck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">🚗 Local Delivery</h1>
          <p className="text-sm text-muted-foreground">Manage orders for in-person delivery</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Scheduled" value={stats.scheduled} />
        <StatCard label="Completed today" value={completedToday} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="w-5 h-5" /> Pending Delivery Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                      No pending local delivery orders.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{o.store_accounts?.business_name ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[240px]">{formatAddr(o)}</TableCell>
                      <TableCell className="text-sm">${Number(o.total ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{o.store_accounts?.delivery_window ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {o.delivery_scheduled_date ? (
                          <Badge variant="outline">{o.delivery_scheduled_date}</Badge>
                        ) : <span className="text-muted-foreground">unscheduled</span>}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setScheduling(o)}>
                          Schedule
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => markDeliveredMutation.mutate(o)}
                          disabled={markDeliveredMutation.isPending}
                        >
                          Mark Delivered
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-5 h-5" /> Plan a Delivery Route
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-xs">Route date</Label>
              <Input
                type="date"
                value={routeDate}
                onChange={(e) => { setRouteDate(e.target.value); setSelectedForRoute(new Set()); }}
                className="w-44"
              />
            </div>
            <Button
              onClick={() => createRouteMutation.mutate()}
              disabled={createRouteMutation.isPending || selectedForRoute.size === 0}
            >
              <Plus className="w-4 h-4 mr-1" /> Create Route ({selectedForRoute.size})
            </Button>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead className="text-right">Items / Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersOnRouteDate.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                      No orders scheduled for {routeDate}.
                    </TableCell>
                  </TableRow>
                ) : (
                  ordersOnRouteDate.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedForRoute.has(o.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedForRoute);
                            if (v) next.add(o.id); else next.delete(o.id);
                            setSelectedForRoute(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{o.store_accounts?.business_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{formatAddr(o)}</TableCell>
                      <TableCell className="text-xs">{o.store_accounts?.delivery_window ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">${Number(o.total ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">Recent routes</div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Stops</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                        No routes yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    routes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs">{r.route_date}</TableCell>
                        <TableCell className="text-sm">{r.total_stops}</TableCell>
                        <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          {r.status === "planned" && (
                            <Button size="sm" variant="outline"
                              onClick={() => routeStatusMutation.mutate({ route: r, nextStatus: "in_progress" })}>
                              Start
                            </Button>
                          )}
                          {r.status === "in_progress" && (
                            <Button size="sm"
                              onClick={() => routeStatusMutation.mutate({ route: r, nextStatus: "completed" })}>
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <ScheduleDialog
        order={scheduling}
        onClose={() => setScheduling(null)}
        onSave={(date) => scheduling && scheduleMutation.mutate({ order: scheduling, date })}
        saving={scheduleMutation.isPending}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function ScheduleDialog({
  order, onClose, onSave, saving,
}: {
  order: OrderRow | null;
  onClose: () => void;
  onSave: (date: string) => void;
  saving: boolean;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule delivery</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {order?.store_accounts?.business_name ?? "Order"} · {order ? formatAddr(order) : ""}
          </div>
          <div>
            <Label>Delivery date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(date)} disabled={saving}>
            {saving ? "Saving…" : "Save & notify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
