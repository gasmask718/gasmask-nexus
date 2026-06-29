// Dynasty Direct — Inventory Forecast: predicts stockouts from 30d sales velocity.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, TrendingDown, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";

type ForecastRow = {
  product_id: string;
  product_name: string;
  retail_price: number | null;
  wholesaler_id: string | null;
  current_stock: number;
  daily_velocity: number;
  days_until_stockout: number;
  stockout_date: string;
  units_needed_to_cover: number;
  risk_level: "critical" | "warning" | "monitor" | "healthy" | "no_sales";
};

const HORIZONS = [7, 14, 30, 60] as const;

const riskBadge = (r: ForecastRow["risk_level"]) => {
  switch (r) {
    case "critical": return <Badge className="bg-red-600 text-white animate-pulse">CRITICAL</Badge>;
    case "warning":  return <Badge className="bg-amber-500 text-white">WARNING</Badge>;
    case "monitor":  return <Badge className="bg-blue-500 text-white">MONITOR</Badge>;
    case "healthy":  return <Badge className="bg-green-600 text-white">HEALTHY</Badge>;
    default:         return <Badge variant="secondary">NO SALES</Badge>;
  }
};

const daysColor = (d: number) => {
  if (d <= 7) return "text-red-600 font-bold";
  if (d <= 14) return "text-amber-600 font-semibold";
  if (d <= 30) return "text-yellow-600";
  return "text-green-600";
};

export default function DDInventoryForecast() {
  const [days, setDays] = useState<number>(30);
  const [reorder, setReorder] = useState<ForecastRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dd-inventory-forecast", days],
    queryFn: async (): Promise<ForecastRow[]> => {
      const { data, error } = await (supabase as any).rpc("dd_inventory_forecast", { p_days_ahead: days });
      if (error) throw error;
      return (data || []) as ForecastRow[];
    },
  });

  const rows = data || [];
  const critical = useMemo(() => rows.filter(r => r.risk_level === "critical"), [rows]);
  const warning  = useMemo(() => rows.filter(r => r.risk_level === "warning"),  [rows]);

  const summary = useMemo(() => {
    const tracked = rows.length;
    const atRisk = critical.length + warning.length;
    const finite = rows.filter(r => r.risk_level !== "no_sales");
    const avgDays = finite.length
      ? Math.round((finite.reduce((s, r) => s + Number(r.days_until_stockout || 0), 0) / finite.length) * 10) / 10
      : 0;
    const projectedValue = rows
      .filter(r => r.risk_level === "critical" || r.risk_level === "warning")
      .reduce((s, r) => s + Number(r.current_stock || 0) * Number(r.retail_price || 0), 0);
    return { tracked, atRisk, avgDays, projectedValue };
  }, [rows, critical, warning]);

  const genPo = useMutation({
    mutationFn: async (v: { wholesaler_id: string; units: number }) => {
      const { data, error } = await supabase.functions.invoke("dd-generate-po", {
        body: { wholesaler_id: v.wholesaler_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Purchase order drafted");
      setReorder(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to generate PO"),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dynasty-direct/inventory"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6" /> Inventory Forecast
          </h1>
          <p className="text-muted-foreground">Predicted stockouts based on current sales velocity</p>
        </div>
        <div className="flex gap-1">
          {HORIZONS.map(h => (
            <Button key={h} size="sm" variant={days === h ? "default" : "outline"} onClick={() => { setDays(h); refetch(); }}>
              {h} Days
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Tracked products</div>
          <div className="text-2xl font-bold">{summary.tracked}</div>
        </CardContent></Card>
        <Card className={summary.atRisk > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">At risk</div>
            <div className="text-2xl font-bold">{summary.atRisk}</div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Avg days of stock</div>
          <div className="text-2xl font-bold">{summary.avgDays}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">At-risk inventory value</div>
          <div className="text-2xl font-bold">${summary.projectedValue.toFixed(2)}</div>
        </CardContent></Card>
      </div>

      {/* Alerts */}
      {critical.length > 0 && (
        <Card className="mb-4 border-red-600/50 bg-red-600/5">
          <CardHeader><CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> 🚨 {critical.length} product{critical.length === 1 ? "" : "s"} will sell out within 7 days
          </CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {critical.slice(0, 8).map(r => (
                <li key={r.product_id} className="flex justify-between">
                  <span className="truncate">{r.product_name}</span>
                  <span className="font-mono">{r.days_until_stockout}d left</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {warning.length > 0 && (
        <Card className="mb-4 border-amber-500/50 bg-amber-500/5">
          <CardHeader><CardTitle className="text-amber-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> ⚠️ {warning.length} product{warning.length === 1 ? "" : "s"} running low
          </CardTitle></CardHeader>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Forecast ({days}-day horizon)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No tracked products yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-right px-2">Stock</th>
                    <th className="text-right px-2">Daily</th>
                    <th className="text-right px-2">Days Left</th>
                    <th className="text-left px-2">Stockout</th>
                    <th className="text-right px-2">Need</th>
                    <th className="text-center px-2">Risk</th>
                    <th className="text-right px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.product_id} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-2 truncate max-w-[260px]">{r.product_name}</td>
                      <td className="text-right px-2">{r.current_stock}</td>
                      <td className="text-right px-2">{Number(r.daily_velocity).toFixed(2)}</td>
                      <td className={`text-right px-2 ${r.risk_level === "no_sales" ? "text-muted-foreground" : daysColor(Number(r.days_until_stockout))}`}>
                        {r.risk_level === "no_sales" ? "—" : `${r.days_until_stockout}d`}
                      </td>
                      <td className="px-2 text-xs">{r.risk_level === "no_sales" ? "—" : r.stockout_date}</td>
                      <td className="text-right px-2 font-medium">{r.units_needed_to_cover}</td>
                      <td className="text-center px-2">{riskBadge(r.risk_level)}</td>
                      <td className="text-right px-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.wholesaler_id || r.units_needed_to_cover === 0}
                          onClick={() => setReorder(r)}
                        >
                          Reorder
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reorder} onOpenChange={(o) => !o && setReorder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick reorder — {reorder?.product_name}</DialogTitle></DialogHeader>
          {reorder && (
            <ReorderForm
              row={reorder}
              pending={genPo.isPending}
              onSubmit={(units) => genPo.mutate({ wholesaler_id: reorder.wholesaler_id!, units })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReorderForm({ row, pending, onSubmit }: { row: ForecastRow; pending: boolean; onSubmit: (units: number) => void }) {
  const [units, setUnits] = useState<number>(row.units_needed_to_cover);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Supplier auto-selected from product. PO will be drafted and emailed to the supplier.
      </div>
      <div>
        <Label>Supplier</Label>
        <Input value={row.wholesaler_id || "—"} disabled className="font-mono text-xs" />
      </div>
      <div>
        <Label>Units to order</Label>
        <Input type="number" min={1} value={units} onChange={(e) => setUnits(parseInt(e.target.value) || 0)} />
      </div>
      <DialogFooter>
        <Button disabled={pending || units <= 0 || !row.wholesaler_id} onClick={() => onSubmit(units)}>
          {pending ? "Generating…" : "Generate PO"}
        </Button>
      </DialogFooter>
    </div>
  );
}
