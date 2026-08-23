/**
 * DD SPRINT 5 — TRAFFIC DIRECTION CONSOLE
 * /dynasty-direct/fulfillment (replaces the Control Tower alias)
 *
 * David's command for steering the fulfillment network: per-supplier
 * priority weight + pause toggle, product/state pins, per-order overrides,
 * live routing feed, volume steering view.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
import { Truck, Pause, Play, Pin, ArrowRightLeft, Activity, TrendingUp, Radio } from "lucide-react";
import { DDShell } from "@/components/dynasty-direct/DDShell";
import { DDPageHeader } from "@/components/dynasty-direct/DDPageHeader";
import { DDEmpty } from "@/components/dynasty-direct/DDStates";
import { cn } from "@/lib/utils";

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
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [rangeHours, setRangeHours] = useState<string>("24");
  const [paused, setPaused] = useState(false);
  const [latestSeenAt, setLatestSeenAt] = useState<number>(0);
  const [pulse, setPulse] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["dd-routing-feed-suppliers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesaler_profiles")
        .select("id, company_name")
        .order("company_name");
      return data || [];
    },
  });

  const { data: feed = [], isFetching, refetch } = useQuery({
    queryKey: ["dd-routing-feed", supplierFilter, rangeHours],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - Number(rangeHours) * 3_600_000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS2589: untyped relation
      let q: any = supabase
        .from("dd_routing_audit" as any)
        .select("*, w:wholesaler_id(company_name)")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200);
      if (supplierFilter !== "all") q = q.eq("wholesaler_id", supplierFilter);
      const { data, error } = await q;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []) as any[];
    },
    refetchInterval: paused ? false : 5_000,
  });

  // Detect new rows since last tick → pulse the LIVE chip
  useEffect(() => {
    if (!feed.length) return;
    const newest = new Date(feed[0].created_at).getTime();
    if (latestSeenAt && newest > latestSeenAt) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1200);
      return () => clearTimeout(t);
    }
    setLatestSeenAt(newest);
  }, [feed, latestSeenAt]);

  const sevStyle = (eventType: string) => {
    const e = eventType.toLowerCase();
    if (e.includes("fail") || e.includes("error") || e.includes("reject"))
      return { border: "border-red-500", dot: "bg-red-500", badge: "bg-red-500/15 text-red-400 border-red-500/30" };
    if (e.includes("manual") || e.includes("pin") || e.includes("override") || e.includes("reassign"))
      return { border: "border-amber-500", dot: "bg-amber-500", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    if (e.includes("route") || e.includes("assign") || e.includes("in_state") || e.includes("ship"))
      return { border: "border-emerald-500", dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    return { border: "border-muted-foreground/30", dot: "bg-muted-foreground/60", badge: "bg-muted text-muted-foreground border-transparent" };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" /> Live Routing Feed
            <span
              className={cn(
                "ml-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
                paused
                  ? "bg-muted text-muted-foreground"
                  : pulse
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              )}
            >
              <Radio className={cn("h-3 w-3", !paused && "animate-pulse")} />
              {paused ? "Paused" : "Live"}
            </span>
            {isFetching && !paused && (
              <span className="text-[10px] text-muted-foreground">refreshing…</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={rangeHours} onValueChange={setRangeHours}>
              <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1h</SelectItem>
                <SelectItem value="6">Last 6h</SelectItem>
                <SelectItem value="24">Last 24h</SelectItem>
                <SelectItem value="168">Last 7d</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setPaused((p) => !p)} className="h-8">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 text-xs">
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[28rem] overflow-y-auto pr-1">
          {feed.length === 0 && (
            <DDEmpty
              icon={Activity}
              title="No routing events in this window"
              description="Routing activates when paid orders arrive. Adjust the time range or seed inventory to start the feed."
              actionLabel="Open orders"
              actionHref="/dynasty-direct/orders"
            />
          )}
          {feed.map((e: any) => {
            const sty = sevStyle(e.event_type);
            return (
              <div
                key={e.id}
                className={cn(
                  "border-l-2 pl-2.5 py-1.5 text-xs transition-colors hover:bg-muted/30 rounded-r",
                  sty.border
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("h-1.5 w-1.5 rounded-full", sty.dot)} />
                  <Badge variant="outline" className={cn("text-[10px]", sty.badge)}>
                    {e.event_type}
                  </Badge>
                  {e.w?.company_name && (
                    <Link
                      to={`/dynasty-direct/suppliers/network?focus=${e.wholesaler_id}`}
                      className="font-semibold hover:underline"
                    >
                      {e.w.company_name}
                    </Link>
                  )}
                  {e.reason && <span className="text-muted-foreground">— {e.reason}</span>}
                  <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                </div>
                {e.order_id && (
                  <Link
                    to={`/dynasty-direct/orders?order=${e.order_id}`}
                    className="text-muted-foreground font-mono hover:text-foreground hover:underline"
                  >
                    order {String(e.order_id).slice(0, 8)}
                  </Link>
                )}
              </div>
            );
          })}
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
        {rows.length === 0 ? (
          <DDEmpty
            icon={TrendingUp}
            title="No routed fulfillments in the last 30 days"
            description="Routing activates once inventory exists and paid orders fan out to suppliers. Seed stock to start the meter."
            actionLabel="Open inventory"
            actionHref="/dynasty-direct/suppliers/inventory"
          />
        ) : (
          <div className="space-y-2">
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
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────
export default function DynastyDirectFulfillmentConsole() {
  return (
    <DDShell>
      <DDPageHeader
        icon={Truck}
        title="Fulfillment — Traffic Direction"
        purpose="Steer multi-state supplier routing. Weight, pause, pin, override — David always wins."
        crumbs={[{ label: 'Fulfillment' }]}
      />
      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Live Feed</TabsTrigger>
          <TabsTrigger value="controls">Supplier Controls</TabsTrigger>
          <TabsTrigger value="pins">Pins</TabsTrigger>
          <TabsTrigger value="orders">Order Overrides</TabsTrigger>
          <TabsTrigger value="volume">Volume Steering</TabsTrigger>
        </TabsList>
        <TabsContent value="feed"><RoutingFeed /></TabsContent>
        <TabsContent value="controls"><SupplierControls /></TabsContent>
        <TabsContent value="pins"><PinsManager /></TabsContent>
        <TabsContent value="orders"><OrderOverridePanel /></TabsContent>
        <TabsContent value="volume"><VolumeSteering /></TabsContent>
      </Tabs>
    </DDShell>
  );
}
