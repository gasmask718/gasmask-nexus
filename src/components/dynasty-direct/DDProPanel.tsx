// Dynasty Direct Pro — store-facing inventory & analytics panel
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, AlertTriangle, TrendingUp, Package, Plus } from "lucide-react";
import { toast } from "sonner";

type Sub = {
  id: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  monthly_price: number;
  next_billing_date: string | null;
  created_at: string;
  store_account_id: string | null;
};

type InvRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  current_qty: number;
  reorder_point: number;
  reorder_qty: number;
  unit_cost: number | null;
  selling_price: number | null;
  location_in_store: string | null;
};

type Analytics = {
  top_sellers: Array<{ product_name: string; product_id: string | null; units_sold_30d: number; revenue_30d: number; stock_left: number; reorder_status: string }>;
  reorder_alerts: Array<{ product_name: string; current_qty: number; reorder_point: number; reorder_qty: number; alert_message: string }>;
  slow_movers: Array<{ product_name: string; current_qty: number; sold_30d: number }>;
  total_inventory_value: number;
  total_retail_value: number;
};

function fmt(n: number) {
  return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function DDProPanel({ userId, storeAccountId }: { userId: string; storeAccountId: string | null }) {
  const qc = useQueryClient();

  const { data: sub, isLoading } = useQuery({
    queryKey: ["dd-pro-sub", userId],
    queryFn: async (): Promise<Sub | null> => {
      const { data, error } = await (supabase as any)
        .from("dd_pro_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["trial", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const startTrial = useMutation({
    mutationFn: async () => {
      if (!storeAccountId) throw new Error("Store account not linked yet — contact support.");
      const trialEnds = new Date(Date.now() + 14 * 86400000).toISOString();
      const { error } = await (supabase as any).from("dd_pro_subscriptions").insert({
        user_id: userId,
        store_account_id: storeAccountId,
        plan: "pro",
        status: "trial",
        trial_ends_at: trialEnds,
        monthly_price: 97,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your 14-day free trial has started!");
      qc.invalidateQueries({ queryKey: ["dd-pro-sub", userId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to start trial"),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading Pro status…</div>;
  }

  if (!sub) {
    return (
      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            🚀 Dynasty Direct Pro — $97/month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm space-y-1">
            <li>✅ AI inventory tracking</li>
            <li>✅ Sales velocity analysis</li>
            <li>✅ Automatic reorder alerts</li>
            <li>✅ Product performance scoring</li>
            <li>✅ Monthly business reports</li>
            <li>✅ Priority support</li>
          </ul>
          <Button
            size="lg"
            disabled={startTrial.isPending || !storeAccountId}
            onClick={() => startTrial.mutate()}
          >
            {startTrial.isPending ? "Starting…" : "Start 14-Day Free Trial"}
          </Button>
          {!storeAccountId && (
            <p className="text-xs text-muted-foreground">
              Your store account isn't linked yet — please complete store signup first.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return <ProDashboard userId={userId} storeAccountId={sub.store_account_id ?? storeAccountId!} sub={sub} />;
}

function ProDashboard({ userId, storeAccountId, sub }: { userId: string; storeAccountId: string; sub: Sub & { store_account_id?: string | null } }) {
  const qc = useQueryClient();
  const [logSaleOpen, setLogSaleOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const { data: analytics } = useQuery({
    queryKey: ["dd-pro-analytics", storeAccountId],
    queryFn: async (): Promise<Analytics | null> => {
      const { data, error } = await (supabase as any).rpc("dd_store_inventory_analytics", { p_store_id: storeAccountId });
      if (error) throw error;
      return data as Analytics;
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["dd-pro-inventory", storeAccountId],
    queryFn: async (): Promise<InvRow[]> => {
      const { data, error } = await (supabase as any)
        .from("dd_store_inventory")
        .select("*")
        .eq("store_account_id", storeAccountId)
        .order("product_name");
      if (error) throw error;
      return data || [];
    },
  });

  const totalProfit = useMemo(() => {
    return (analytics?.total_retail_value ?? 0) - (analytics?.total_inventory_value ?? 0);
  }, [analytics]);

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          📊 Pro Inventory Management
          <Badge variant="outline" className="ml-2">
            {sub.status === "trial" ? `Trial · ends ${sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : "—"}` : sub.status}
          </Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}><Plus className="w-3 h-3 mr-1" />Add item</Button>
          <Button size="sm" onClick={() => setLogSaleOpen(true)}>Log a sale</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="alerts">Reorder Alerts</TabsTrigger>
            <TabsTrigger value="top">Top Sellers</TabsTrigger>
            <TabsTrigger value="slow">Slow Movers</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={<Package className="w-4 h-4" />} label="Products tracked" value={String(inventory.length)} />
              <Stat label="Stock value" value={fmt(analytics?.total_inventory_value ?? 0)} />
              <Stat label="Retail value" value={fmt(analytics?.total_retail_value ?? 0)} />
              <Stat icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} label="Potential profit" value={fmt(totalProfit)} />
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4 space-y-2">
            {(analytics?.reorder_alerts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No reorder alerts — stock levels look good.</p>
            ) : (
              (analytics?.reorder_alerts ?? []).map((a, i) => (
                <Card key={i} className="border-rose-500/40 bg-rose-500/5">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" /> {a.product_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.alert_message}</div>
                    </div>
                    <Button size="sm" variant="default" onClick={() => toast.info("Order flow — coming next")}>Order Now →</Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="top" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Sold 30d</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(analytics?.top_sellers ?? []).map((t, i) => (
                  <TableRow key={t.product_id ?? i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{t.product_name}</TableCell>
                    <TableCell className="text-right">{t.units_sold_30d}</TableCell>
                    <TableCell className="text-right">{fmt(t.revenue_30d)}</TableCell>
                    <TableCell className="text-right">{t.stock_left}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        t.reorder_status === "reorder_now" ? "bg-rose-500/20 text-rose-700 border-rose-500/40" :
                        t.reorder_status === "reorder_soon" ? "bg-amber-500/20 text-amber-700 border-amber-500/40" :
                        "bg-emerald-500/20 text-emerald-700 border-emerald-500/40"
                      }>
                        {t.reorder_status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="slow" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Sold 30d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(analytics?.slow_movers ?? []).map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.product_name}</TableCell>
                    <TableCell className="text-right">{s.current_qty}</TableCell>
                    <TableCell className="text-right">{s.sold_30d}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <InventoryEditor inventory={inventory} storeAccountId={storeAccountId} userId={userId} onChanged={() => {
              qc.invalidateQueries({ queryKey: ["dd-pro-inventory", storeAccountId] });
              qc.invalidateQueries({ queryKey: ["dd-pro-analytics", storeAccountId] });
            }} />
          </TabsContent>
        </Tabs>

        <LogSaleDialog open={logSaleOpen} onClose={() => setLogSaleOpen(false)} inventory={inventory} userId={userId} storeAccountId={storeAccountId} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["dd-pro-inventory", storeAccountId] });
          qc.invalidateQueries({ queryKey: ["dd-pro-analytics", storeAccountId] });
        }} />
        <AddItemDialog open={addItemOpen} onClose={() => setAddItemOpen(false)} userId={userId} storeAccountId={storeAccountId} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["dd-pro-inventory", storeAccountId] });
          qc.invalidateQueries({ queryKey: ["dd-pro-analytics", storeAccountId] });
        }} />
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">{icon}{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function InventoryEditor({ inventory, storeAccountId, userId, onChanged }: { inventory: InvRow[]; storeAccountId: string; userId: string; onChanged: () => void }) {
  const [edits, setEdits] = useState<Record<string, number>>({});
  const save = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(edits);
      for (const [id, qty] of updates) {
        const { error } = await (supabase as any).from("dd_store_inventory").update({ current_qty: qty, last_updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Inventory updated"); setEdits({}); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">New count</TableHead>
            <TableHead className="text-right">Reorder pt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.product_name}</TableCell>
              <TableCell className="text-xs">{i.sku ?? "—"}</TableCell>
              <TableCell className="text-right">{i.current_qty}</TableCell>
              <TableCell className="text-right">
                <Input className="w-24 ml-auto" type="number" defaultValue={i.current_qty} onChange={(e) => setEdits({ ...edits, [i.id]: Number(e.target.value) })} />
              </TableCell>
              <TableCell className="text-right">{i.reorder_point}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={() => save.mutate()} disabled={save.isPending || Object.keys(edits).length === 0}>
        {save.isPending ? "Saving…" : `Update ${Object.keys(edits).length} item(s)`}
      </Button>
    </div>
  );
}

function LogSaleDialog({ open, onClose, inventory, userId, storeAccountId, onSaved }: { open: boolean; onClose: () => void; inventory: InvRow[]; userId: string; storeAccountId: string; onSaved: () => void }) {
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);

  const submit = useMutation({
    mutationFn: async () => {
      const item = inventory.find((i) => i.id === productId);
      if (!item) throw new Error("Pick a product");
      const { error: insErr } = await (supabase as any).from("dd_store_sales_log").insert({
        user_id: userId,
        store_account_id: storeAccountId,
        product_id: item.product_id,
        qty_sold: qty,
        sale_price: price || item.selling_price || 0,
      });
      if (insErr) throw insErr;
      const newQty = Math.max(0, item.current_qty - qty);
      const { error: updErr } = await (supabase as any).from("dd_store_inventory").update({ current_qty: newQty, last_updated_at: new Date().toISOString() }).eq("id", item.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => { toast.success("Sale logged"); onSaved(); onClose(); setProductId(""); setQty(1); setPrice(0); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log a sale</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <select className="w-full border rounded-md p-2 bg-background" value={productId} onChange={(e) => { setProductId(e.target.value); const it = inventory.find(i => i.id === e.target.value); if (it?.selling_price) setPrice(Number(it.selling_price)); }}>
            <option value="">Pick a product…</option>
            {inventory.map((i) => (
              <option key={i.id} value={i.id}>{i.product_name} (stock: {i.current_qty})</option>
            ))}
          </select>
          <Input type="number" placeholder="Quantity sold" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <Input type="number" step="0.01" placeholder="Sale price (per unit)" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || !productId}>{submit.isPending ? "Saving…" : "Log sale"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ open, onClose, userId, storeAccountId, onSaved }: { open: boolean; onClose: () => void; userId: string; storeAccountId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ product_name: "", sku: "", current_qty: 0, reorder_point: 5, reorder_qty: 20, unit_cost: 0, selling_price: 0, location_in_store: "" });

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.product_name.trim()) throw new Error("Product name required");
      const { error } = await (supabase as any).from("dd_store_inventory").insert({
        user_id: userId,
        store_account_id: storeAccountId,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Item added"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add inventory item</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Product name *" className="col-span-2" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <Input placeholder="Location (Aisle 3 / Shelf B)" value={form.location_in_store} onChange={(e) => setForm({ ...form, location_in_store: e.target.value })} />
          <Input type="number" placeholder="Current qty" value={form.current_qty} onChange={(e) => setForm({ ...form, current_qty: Number(e.target.value) })} />
          <Input type="number" placeholder="Reorder point" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: Number(e.target.value) })} />
          <Input type="number" placeholder="Reorder qty" value={form.reorder_qty} onChange={(e) => setForm({ ...form, reorder_qty: Number(e.target.value) })} />
          <Input type="number" step="0.01" placeholder="Unit cost" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} />
          <Input type="number" step="0.01" placeholder="Selling price" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Saving…" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
