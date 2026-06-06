// Dynasty Direct — Master Inventory View (admin: all products × all suppliers)
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Package, AlertTriangle, History } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  product_id: string;
  product_name: string;
  wholesaler_id: string;
  wholesaler_name: string;
  quantity_available: number;
  reserved_quantity: number;
  low_stock_threshold: number | null;
  reorder_point: number | null;
  product_total: number; // sum across suppliers (= products_all.inventory_qty)
};

export default function DynastyDirectInventory() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [adjust, setAdjust] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["dd-master-inventory"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("marketplace_inventory")
        .select("id, product_id, wholesaler_id, quantity_available, reserved_quantity, low_stock_threshold, reorder_point, product:products_all(product_name, inventory_qty), wholesaler:wholesaler_profiles(business_name)")
        .order("quantity_available", { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product?.product_name || "—",
        wholesaler_id: r.wholesaler_id,
        wholesaler_name: r.wholesaler?.business_name || "—",
        quantity_available: r.quantity_available,
        reserved_quantity: r.reserved_quantity,
        low_stock_threshold: r.low_stock_threshold,
        reorder_point: r.reorder_point,
        product_total: r.product?.inventory_qty ?? 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    let f = rows || [];
    if (filter) {
      const q = filter.toLowerCase();
      f = f.filter((r) => r.product_name.toLowerCase().includes(q) || r.wholesaler_name.toLowerCase().includes(q));
    }
    if (onlyLow) f = f.filter((r) => r.quantity_available <= (r.low_stock_threshold ?? r.reorder_point ?? 10));
    return f;
  }, [rows, filter, onlyLow]);

  const lowCount = (rows || []).filter((r) => r.quantity_available <= (r.low_stock_threshold ?? r.reorder_point ?? 10)).length;
  const oosCount = (rows || []).filter((r) => r.quantity_available === 0).length;

  const applyAdjust = useMutation({
    mutationFn: async (v: { row: Row; new_qty: number; reason: string }) => {
      const { error } = await supabase.rpc("dd_apply_inventory_adjustment", {
        p_product_id: v.row.product_id,
        p_wholesaler_id: v.row.wholesaler_id,
        p_new_quantity: v.new_qty,
        p_kind: "admin_override",
        p_reason: v.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-master-inventory"] });
      toast.success("Stock adjusted (admin override logged)");
      setAdjust(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dynasty-direct"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6"/>Master Inventory</h1>
          <p className="text-muted-foreground">All products × all suppliers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Product/supplier rows</div>
          <div className="text-2xl font-bold">{rows?.length ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Available units</div>
          <div className="text-2xl font-bold">{rows?.reduce((s,r)=>s+r.quantity_available,0) ?? 0}</div>
        </CardContent></Card>
        <Card className={lowCount>0?"border-amber-500/50 bg-amber-500/5":""}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {lowCount>0 && <AlertTriangle className="h-3 w-3 text-amber-500"/>}Low stock rows
            </div>
            <div className="text-2xl font-bold">{lowCount}</div>
          </CardContent>
        </Card>
        <Card className={oosCount>0?"border-destructive/50 bg-destructive/5":""}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Sold-out rows</div>
            <div className="text-2xl font-bold">{oosCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 mb-4">
        <Input placeholder="Filter by product or supplier…" value={filter} onChange={(e)=>setFilter(e.target.value)} className="max-w-md"/>
        <Button variant={onlyLow?"default":"outline"} onClick={()=>setOnlyLow(!onlyLow)}>
          <AlertTriangle className="h-4 w-4 mr-1"/>Low only
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Inventory rows</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nothing matches.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const t = r.low_stock_threshold ?? r.reorder_point ?? 10;
                const low = r.quantity_available <= t;
                const oos = r.quantity_available === 0;
                return (
                  <div key={r.id} className={`p-3 rounded border flex items-center gap-3 ${oos?"border-destructive/50 bg-destructive/5":low?"border-amber-500/50 bg-amber-500/5":""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.product_name}</div>
                      <div className="text-xs text-muted-foreground">{r.wholesaler_name} · public total {r.product_total} · threshold {t}</div>
                    </div>
                    <div className="text-center min-w-[70px]">
                      <div className="text-xs text-muted-foreground">Avail</div>
                      <div className="text-lg font-bold">{r.quantity_available}</div>
                    </div>
                    <div className="text-center min-w-[70px]">
                      <div className="text-xs text-muted-foreground">Reserved</div>
                      <div className="text-lg font-bold">{r.reserved_quantity}</div>
                    </div>
                    {oos && <Badge variant="destructive">Sold out</Badge>}
                    {!oos && low && <Badge className="bg-amber-500">Low</Badge>}
                    <Button size="sm" variant="outline" onClick={()=>setAdjust(r)}>Override</Button>
                    <Button size="sm" variant="ghost" onClick={()=>setHistory(r)}><History className="h-4 w-4"/></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!adjust} onOpenChange={(o)=>!o&&setAdjust(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Admin override — {adjust?.product_name}</DialogTitle></DialogHeader>
          {adjust && <AdminOverrideForm row={adjust} pending={applyAdjust.isPending}
            onSubmit={(v)=>applyAdjust.mutate({ row: adjust, ...v })}/>}
        </DialogContent>
      </Dialog>

      <Sheet open={!!history} onOpenChange={(o)=>!o&&setHistory(null)}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          <SheetHeader><SheetTitle>{history?.product_name} · {history?.wholesaler_name}</SheetTitle></SheetHeader>
          {history && <AdminHistory productId={history.product_id} wholesalerId={history.wholesaler_id}/>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AdminOverrideForm({ row, pending, onSubmit }:{ row: Row; pending: boolean; onSubmit:(v:{ new_qty: number; reason: string })=>void }) {
  const [qty, setQty] = useState(row.quantity_available);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <div className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/30">
        Admin overrides are flagged in the audit log and visible to the supplier.
      </div>
      <div>
        <Label>New available quantity</Label>
        <Input type="number" min={0} value={qty} onChange={(e)=>setQty(parseInt(e.target.value)||0)}/>
        <div className="text-xs text-muted-foreground mt-1">Was {row.quantity_available} · Δ {qty-row.quantity_available}</div>
      </div>
      <div>
        <Label>Reason (required)</Label>
        <Textarea value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Why is admin overriding supplier stock?"/>
      </div>
      <DialogFooter>
        <Button disabled={pending || !reason.trim()} onClick={()=>onSubmit({ new_qty: qty, reason })}>{pending?"Saving…":"Apply override"}</Button>
      </DialogFooter>
    </div>
  );
}

function AdminHistory({ productId, wholesalerId }:{ productId: string; wholesalerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dd-master-inv-history", productId, wholesalerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_inventory_adjustments")
        .select("*")
        .eq("product_id", productId)
        .eq("wholesaler_id", wholesalerId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
  if (isLoading) return <Skeleton className="h-32 w-full mt-4"/>;
  if (!data?.length) return <p className="text-sm text-muted-foreground mt-4">No adjustments yet.</p>;
  return (
    <div className="mt-4 space-y-2 max-h-[80vh] overflow-y-auto">
      {data.map((a:any) => (
        <div key={a.id} className="p-2 rounded border text-sm">
          <div className="flex justify-between items-center">
            <div className="flex gap-1 items-center">
              <Badge variant={a.kind==="admin_override"?"destructive":"outline"}>{a.kind}</Badge>
              {a.actor_role && <span className="text-xs text-muted-foreground">{a.actor_role}</span>}
            </div>
            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-1">{a.quantity_before} → <strong>{a.quantity_after}</strong> ({a.delta>=0?"+":""}{a.delta})</div>
          {a.reason && <div className="text-xs text-muted-foreground mt-1">{a.reason}</div>}
        </div>
      ))}
    </div>
  );
}
