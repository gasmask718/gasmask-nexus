/**
 * DD SPRINT 5 — TRAFFIC DIRECTION CONSOLE
 * /dynasty-direct/fulfillment (replaces the Control Tower alias)
 *
 * David's command for steering the fulfillment network: per-supplier
 * priority weight + pause toggle, product/state pins, per-order overrides,
 * live routing feed, volume steering view.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, Pause, Play, Pin, ArrowRightLeft, Activity, TrendingUp } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────
// SUPPLIER CONTROLS
// ─────────────────────────────────────────────────────────────────────
function SupplierControls() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({
    queryKey: ["dd-suppliers-weights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesaler_profiles")
        .select("id, company_name, warehouse_state, priority_weight, routing_paused, is_default_supplier")
        .order("priority_weight", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch, audit }: { id: string; patch: any; audit: any }) => {
      const { error } = await supabase.from("wholesaler_profiles").update(patch).eq("id", id);
      if (error) throw error;
      await supabase.from("dd_routing_audit").insert({
        event_type: audit.event_type,
        wholesaler_id: id,
        new_value: audit.new_value,
        prev_value: audit.prev_value,
        reason: audit.reason,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-suppliers-weights"] });
      qc.invalidateQueries({ queryKey: ["dd-routing-feed"] });
      toast.success("Supplier updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Supplier Controls — Weight & Pause</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {suppliers.map((s: any) => (
          <div key={s.id} className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{s.company_name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.warehouse_state || "no state"} · weight {s.priority_weight}
                  {s.is_default_supplier && <Badge variant="secondary" className="ml-2">default</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.routing_paused ? "destructive" : "default"}>
                  {s.routing_paused ? "PAUSED" : "ACTIVE"}
                </Badge>
                <Switch
                  checked={!s.routing_paused}
                  onCheckedChange={(v) =>
                    update.mutate({
                      id: s.id,
                      patch: { routing_paused: !v },
                      audit: { event_type: v ? "activate" : "pause", prev_value: { paused: s.routing_paused }, new_value: { paused: !v }, reason: "console toggle" },
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Weight</span>
              <Slider
                value={[s.priority_weight ?? 50]}
                min={0} max={100} step={5}
                onValueCommit={(v) =>
                  update.mutate({
                    id: s.id,
                    patch: { priority_weight: v[0] },
                    audit: { event_type: "weight_change", prev_value: { weight: s.priority_weight }, new_value: { weight: v[0] }, reason: "slider commit" },
                  })
                }
              />
              <span className="text-xs font-mono w-8">{s.priority_weight ?? 50}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PINS (product + state)
// ─────────────────────────────────────────────────────────────────────
function PinsManager() {
  const qc = useQueryClient();
  const { data: pins = [] } = useQuery({
    queryKey: ["dd-routing-pins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_routing_pins")
        .select("*, w:pinned_wholesaler_id(company_name), p:product_id(product_name)")
        .neq("pin_type", "order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["dd-suppliers-min"],
    queryFn: async () => (await supabase.from("wholesaler_profiles").select("id, company_name")).data || [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["dd-products-min"],
    queryFn: async () => (await supabase.from("products_all").select("id, product_name").limit(500)).data || [],
  });

  const [pinType, setPinType] = useState<"product" | "state">("product");
  const [productId, setProductId] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = { pin_type: pinType, pinned_wholesaler_id: supplierId };
      if (pinType === "product") payload.product_id = productId;
      if (pinType === "state") payload.state_code = stateCode.toUpperCase();
      const { error } = await supabase.from("dd_routing_pins").insert(payload);
      if (error) throw error;
      await supabase.from("dd_routing_audit").insert({
        event_type: "pin", wholesaler_id: supplierId, new_value: payload, reason: "console pin",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-routing-pins"] });
      toast.success("Pin created");
      setProductId(""); setStateCode(""); setSupplierId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dd_routing_pins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dd-routing-pins"] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Pins — Product & State Preferred Suppliers</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <Select value={pinType} onValueChange={(v: any) => setPinType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="product">Pin product</SelectItem>
              <SelectItem value="state">Pin state</SelectItem>
            </SelectContent>
          </Select>
          {pinType === "product" ? (
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="product" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input placeholder="State (e.g. NY)" value={stateCode} onChange={(e) => setStateCode(e.target.value)} maxLength={2} />
          )}
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="md:col-span-2"><SelectValue placeholder="supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => create.mutate()} disabled={!supplierId || (pinType === "product" ? !productId : !stateCode)}>
            <Pin className="w-4 h-4 mr-1" /> Pin
          </Button>
        </div>
        <div className="space-y-1">
          {pins.length === 0 && <div className="text-sm text-muted-foreground">No pins yet.</div>}
          {pins.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
              <div>
                <Badge variant="outline" className="mr-2">{p.pin_type}</Badge>
                {p.pin_type === "product" ? p.p?.product_name : p.state_code} → <strong>{p.w?.company_name}</strong>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>Remove</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PER-ORDER OVERRIDE (active unshipped orders)
// ─────────────────────────────────────────────────────────────────────
function OrderOverridePanel() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["dd-unshipped-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_routing")
        .select("order_id, assigned_wholesaler_id, routing_reason, manual_override, w:assigned_wholesaler_id(company_name), o:order_id(total, shipping_address, fulfillment_status)")
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).filter((r: any) => r.o?.fulfillment_status !== "shipped" && r.o?.fulfillment_status !== "delivered");
    },
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["dd-suppliers-min"],
    queryFn: async () => (await supabase.from("wholesaler_profiles").select("id, company_name, warehouse_state")).data || [],
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [newW, setNewW] = useState("");
  const [reason, setReason] = useState("");

  const reassign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reassign_order_supplier", {
        p_order_id: openId, p_new_wholesaler_id: newW, p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order reassigned, inventory re-reserved");
      setOpenId(null); setNewW(""); setReason("");
      qc.invalidateQueries({ queryKey: ["dd-unshipped-orders"] });
      qc.invalidateQueries({ queryKey: ["dd-routing-feed"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Active Orders — Manual Reassign</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {orders.length === 0 && <div className="text-sm text-muted-foreground">No unshipped orders.</div>}
        {orders.map((r: any) => (
          <div key={r.order_id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
            <div>
              <span className="font-mono text-xs">{r.order_id.slice(0, 8)}</span>
              <span className="mx-2">→</span>
              <strong>{r.w?.company_name || "—"}</strong>
              {r.routing_reason && <Badge variant="outline" className="ml-2">{r.routing_reason}</Badge>}
              {r.manual_override && <Badge variant="secondary" className="ml-1">override</Badge>}
              <span className="ml-2 text-muted-foreground">${Number(r.o?.total || 0).toFixed(2)} · {r.o?.shipping_address?.state}</span>
            </div>
            <Dialog open={openId === r.order_id} onOpenChange={(o) => setOpenId(o ? r.order_id : null)}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><ArrowRightLeft className="w-3 h-3 mr-1" />Reassign</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Reassign order {r.order_id.slice(0, 8)}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={newW} onValueChange={setNewW}>
                    <SelectTrigger><SelectValue placeholder="New supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.company_name} ({s.warehouse_state})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Reason (required, audited)" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button onClick={() => reassign.mutate()} disabled={!newW || reason.length < 3 || reassign.isPending}>
                    Confirm reassignment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LIVE ROUTING FEED
// ─────────────────────────────────────────────────────────────────────
function RoutingFeed() {
  const { data: feed = [] } = useQuery({
    queryKey: ["dd-routing-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_routing_audit")
        .select("*, w:wholesaler_id(company_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    refetchInterval: 5000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" /> Live Routing Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {feed.length === 0 && <div className="text-sm text-muted-foreground">No routing events yet.</div>}
          {feed.map((e: any) => (
            <div key={e.id} className="border-l-2 border-primary/40 pl-2 py-1 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{e.event_type}</Badge>
                {e.w?.company_name && <strong>{e.w.company_name}</strong>}
                {e.reason && <span className="text-muted-foreground">— {e.reason}</span>}
                <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
              </div>
              {e.order_id && <div className="text-muted-foreground font-mono">order {String(e.order_id).slice(0, 8)}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VOLUME STEERING VIEW
// ─────────────────────────────────────────────────────────────────────
function VolumeSteering() {
  const { data: rows = [] } = useQuery({
    queryKey: ["dd-volume-steering"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data: fulfills } = await supabase
        .from("marketplace_fulfillments")
        .select("wholesaler_id, created_at, w:wholesaler_id(company_name, priority_weight)")
        .gte("created_at", since);
      const map = new Map<string, { name: string; weight: number; week: number; month: number }>();
      const weekAgo = Date.now() - 7 * 86400_000;
      (fulfills || []).forEach((f: any) => {
        const id = f.wholesaler_id;
        const r = map.get(id) || { name: f.w?.company_name || "—", weight: f.w?.priority_weight ?? 50, week: 0, month: 0 };
        r.month += 1;
        if (new Date(f.created_at).getTime() > weekAgo) r.week += 1;
        map.set(id, r);
      });
      return Array.from(map.entries()).map(([id, r]) => ({ id, ...r })).sort((a, b) => b.month - a.month);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Volume Steering — last 30d
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.length === 0 && <div className="text-sm text-muted-foreground">No fulfillments yet.</div>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-sm border rounded px-3 py-2">
              <div className="flex-1">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">weight {r.weight}</div>
              </div>
              <div className="text-right">
                <div className="font-mono">{r.month}</div>
                <div className="text-xs text-muted-foreground">{r.week} this wk</div>
              </div>
              <div className="w-32 h-2 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, r.month * 5)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────
export default function DynastyDirectFulfillmentConsole() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="w-7 h-7" />
        <div>
          <h1 className="text-2xl font-bold">Fulfillment — Traffic Direction</h1>
          <p className="text-sm text-muted-foreground">
            Steer multi-state supplier routing. Weight, pause, pin, override — David always wins.
          </p>
        </div>
      </div>

      <Tabs defaultValue="controls">
        <TabsList>
          <TabsTrigger value="controls">Supplier Controls</TabsTrigger>
          <TabsTrigger value="pins">Pins</TabsTrigger>
          <TabsTrigger value="orders">Order Overrides</TabsTrigger>
          <TabsTrigger value="feed">Live Feed</TabsTrigger>
          <TabsTrigger value="volume">Volume Steering</TabsTrigger>
        </TabsList>
        <TabsContent value="controls"><SupplierControls /></TabsContent>
        <TabsContent value="pins"><PinsManager /></TabsContent>
        <TabsContent value="orders"><OrderOverridePanel /></TabsContent>
        <TabsContent value="feed"><RoutingFeed /></TabsContent>
        <TabsContent value="volume"><VolumeSteering /></TabsContent>
      </Tabs>
    </div>
  );
}
