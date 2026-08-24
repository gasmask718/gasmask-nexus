// Wholesaler — Marketplace Inventory Console (per-supplier stock for Dynasty Direct)
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Package, AlertTriangle, History, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  product_id: string;
  product_name: string;
  quantity_available: number;
  reserved_quantity: number;
  low_stock_threshold: number | null;
  reorder_point: number | null;
  sold_week: number;
  sold_month: number;
  reserving_orders: { order_id: string; qty: number }[];
};

export default function WholesalerMarketplaceInventory() {
  const { profile } = useWholesalerProfile();
  const qc = useQueryClient();
  const [adjust, setAdjust] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row | null>(null);
  const [threshold, setThreshold] = useState<Row | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["wholesaler-marketplace-inventory", profile?.id],
    enabled: !!profile?.id,
    queryFn: async (): Promise<Row[]> => {
      const wid = profile!.id;
      const { data: inv } = await supabase
        .from("marketplace_inventory")
        .select("product_id, quantity_available, reserved_quantity, low_stock_threshold, reorder_point")
        .eq("wholesaler_id", wid);

      // Product names come from the safe view — products_all SELECT is admin-only now
      // (retail/margin columns are hidden from wholesalers), so an embedded join would 401.
      const invProductIds = (inv || []).map((r: any) => r.product_id);
      const { data: prodRows } = invProductIds.length
        ? await supabase
            .from("dd_wholesaler_products_safe" as any)
            .select("id, product_name")
            .in("id", invProductIds)
        : { data: [] as any[] };
      const nameMap = new Map<string, string>((prodRows || []).map((p: any) => [p.id, p.product_name]));

      const productIds = (inv || []).map((r: any) => r.product_id);
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

      const { data: items } = productIds.length
        ? await supabase
            .from("marketplace_order_items")
            .select("product_id, qty, order:marketplace_orders(id, payment_status, fulfillment_status, created_at)")
            .eq("wholesaler_id", wid)
            .in("product_id", productIds)
            .gte("order.created_at", since30)
        : { data: [] as any[] };

      return (inv || []).map((r: any) => {
        const its = (items || []).filter((i: any) => i.product_id === r.product_id);
        const sold_month = its
          .filter((i) => i.order?.payment_status === "paid")
          .reduce((s, i) => s + (i.qty || 0), 0);
        const sold_week = its
          .filter((i) => i.order?.payment_status === "paid" && i.order?.created_at >= since7)
          .reduce((s, i) => s + (i.qty || 0), 0);
        const reserving_orders = its
          .filter((i) => i.order?.payment_status === "pending")
          .map((i) => ({ order_id: i.order.id, qty: i.qty || 0 }));
        return {
          product_id: r.product_id,
          product_name: nameMap.get(r.product_id) || "—",
          quantity_available: r.quantity_available,
          reserved_quantity: r.reserved_quantity,
          low_stock_threshold: r.low_stock_threshold,
          reorder_point: r.reorder_point,
          sold_week,
          sold_month,
          reserving_orders,
        };
      });
    },
  });

  const lowStock = useMemo(
    () =>
      (rows || []).filter((r) => {
        const t = r.low_stock_threshold ?? r.reorder_point ?? 10;
        return r.quantity_available <= t;
      }),
    [rows],
  );

  const applyAdjust = useMutation({
    mutationFn: async (v: { product_id: string; new_qty: number; kind: string; reason: string }) => {
      const { error } = await supabase.rpc("dd_apply_inventory_adjustment", {
        p_product_id: v.product_id,
        p_wholesaler_id: profile!.id,
        p_new_quantity: v.new_qty,
        p_kind: v.kind,
        p_reason: v.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wholesaler-marketplace-inventory"] });
      toast.success("Stock updated");
      setAdjust(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setThresh = useMutation({
    mutationFn: async (v: { product_id: string; threshold: number }) => {
      const { error } = await supabase.rpc("dd_set_inventory_threshold", {
        p_product_id: v.product_id,
        p_wholesaler_id: profile!.id,
        p_threshold: v.threshold,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wholesaler-marketplace-inventory"] });
      toast.success("Threshold saved");
      setThreshold(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/wholesaler"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" />Marketplace Inventory</h1>
          <p className="text-muted-foreground">Per-product stock you supply to Dynasty Direct</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">SKUs</div>
          <div className="text-2xl font-bold">{rows?.length ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Available units</div>
          <div className="text-2xl font-bold">{rows?.reduce((s,r)=>s+r.quantity_available,0) ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Reserved</div>
          <div className="text-2xl font-bold">{rows?.reduce((s,r)=>s+r.reserved_quantity,0) ?? 0}</div>
        </CardContent></Card>
        <Card className={lowStock.length>0?"border-amber-500/50 bg-amber-500/5":""}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {lowStock.length>0 && <AlertTriangle className="h-3 w-3 text-amber-500"/>}Low stock
            </div>
            <div className="text-2xl font-bold">{lowStock.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No marketplace inventory yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const t = r.low_stock_threshold ?? r.reorder_point ?? 10;
                const low = r.quantity_available <= t;
                const oos = r.quantity_available === 0;
                return (
                  <div key={r.product_id} className={`p-3 rounded-lg border flex items-center gap-3 ${oos?"border-destructive/50 bg-destructive/5":low?"border-amber-500/50 bg-amber-500/5":""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Threshold {t} · Sold 7d: {r.sold_week} · 30d: {r.sold_month}
                      </div>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <div className="text-xs text-muted-foreground">Available</div>
                      <div className="text-lg font-bold">{r.quantity_available}</div>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <div className="text-xs text-muted-foreground">Reserved</div>
                      <div className="text-lg font-bold">{r.reserved_quantity}</div>
                    </div>
                    {oos && <Badge variant="destructive">Sold out</Badge>}
                    {!oos && low && <Badge className="bg-amber-500">Low</Badge>}
                    <Button size="sm" variant="outline" onClick={()=>setAdjust(r)}>Adjust</Button>
                    <Button size="sm" variant="ghost" onClick={()=>setThreshold(r)}><Settings2 className="h-4 w-4"/></Button>
                    <Button size="sm" variant="ghost" onClick={()=>setHistory(r)}><History className="h-4 w-4"/></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust dialog */}
      <Dialog open={!!adjust} onOpenChange={(o)=>!o&&setAdjust(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock — {adjust?.product_name}</DialogTitle></DialogHeader>
          {adjust && <AdjustForm row={adjust} pending={applyAdjust.isPending}
            onSubmit={(v)=>applyAdjust.mutate({ product_id: adjust.product_id, ...v })} />}
        </DialogContent>
      </Dialog>

      {/* Threshold dialog */}
      <Dialog open={!!threshold} onOpenChange={(o)=>!o&&setThreshold(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Low-stock threshold — {threshold?.product_name}</DialogTitle></DialogHeader>
          {threshold && <ThresholdForm row={threshold} pending={setThresh.isPending}
            onSubmit={(t)=>setThresh.mutate({ product_id: threshold.product_id, threshold: t })} />}
        </DialogContent>
      </Dialog>

      {/* History sheet */}
      <Sheet open={!!history} onOpenChange={(o)=>!o&&setHistory(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader><SheetTitle>{history?.product_name} — adjustment history</SheetTitle></SheetHeader>
          {history && <AdjustmentHistory productId={history.product_id} wholesalerId={profile?.id} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AdjustForm({ row, pending, onSubmit }:{ row: Row; pending: boolean; onSubmit:(v:{ new_qty: number; kind: string; reason: string })=>void }) {
  const [qty, setQty] = useState(row.quantity_available);
  const [kind, setKind] = useState("wholesaler_recount");
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <Label>New available quantity</Label>
        <Input type="number" min={0} value={qty} onChange={(e)=>setQty(parseInt(e.target.value)||0)} />
        <div className="text-xs text-muted-foreground mt-1">Was {row.quantity_available} · Δ {qty-row.quantity_available}</div>
      </div>
      <div>
        <Label>Reason</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="wholesaler_recount">Recount</SelectItem>
            <SelectItem value="restock">Restock</SelectItem>
            <SelectItem value="damage">Damage / loss</SelectItem>
            <SelectItem value="offline_sale">Offline sale</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Note (optional)</Label>
        <Textarea value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Context for the audit trail" />
      </div>
      <DialogFooter>
        <Button disabled={pending} onClick={()=>onSubmit({ new_qty: qty, kind, reason })}>{pending?"Saving…":"Apply"}</Button>
      </DialogFooter>
    </div>
  );
}

function ThresholdForm({ row, pending, onSubmit }:{ row: Row; pending: boolean; onSubmit:(t:number)=>void }) {
  const [t, setT] = useState(row.low_stock_threshold ?? row.reorder_point ?? 10);
  return (
    <div className="space-y-3">
      <div>
        <Label>Alert me when available falls to or below</Label>
        <Input type="number" min={0} value={t} onChange={(e)=>setT(parseInt(e.target.value)||0)} />
      </div>
      <DialogFooter>
        <Button disabled={pending} onClick={()=>onSubmit(t)}>{pending?"Saving…":"Save threshold"}</Button>
      </DialogFooter>
    </div>
  );
}

function AdjustmentHistory({ productId, wholesalerId }:{ productId: string; wholesalerId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dd-inv-adjustments", productId, wholesalerId],
    enabled: !!wholesalerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_inventory_adjustments")
        .select("*")
        .eq("product_id", productId)
        .eq("wholesaler_id", wholesalerId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
  if (isLoading) return <Skeleton className="h-32 w-full mt-4"/>;
  if (!data?.length) return <p className="text-sm text-muted-foreground mt-4">No adjustments yet.</p>;
  return (
    <div className="mt-4 space-y-2 max-h-[80vh] overflow-y-auto">
      {data.map((a: any) => (
        <div key={a.id} className="p-2 rounded border text-sm">
          <div className="flex justify-between">
            <Badge variant="outline">{a.kind}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-1">
            {a.quantity_before} → <strong>{a.quantity_after}</strong> ({a.delta>=0?"+":""}{a.delta})
            {a.actor_role && <span className="text-xs text-muted-foreground ml-2">by {a.actor_role}</span>}
          </div>
          {a.reason && <div className="text-xs text-muted-foreground mt-1">{a.reason}</div>}
        </div>
      ))}
    </div>
  );
}
