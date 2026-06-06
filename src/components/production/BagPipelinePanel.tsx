// Bag pipeline activation + health panel.
// Derives activation state from bag_sale_ledger sources, shows distributed vs sold per store,
// surfaces low-stock alerts (v_bag_reorder_alerts), and exposes a one-click activate that
// invokes the bag-pipeline-activate edge function (runs documented backfill step 4).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Package, CheckCircle2, AlertTriangle, ShieldAlert, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface SaleRow { store_id: string; product_id: string; bags_delta: number; source: string; created_at: string; }
interface InvRow { store_id: string; product_id: string; bags_delta: number; }
interface AlertRow { store_id: string; product_id: string; product_name?: string; bags_on_hand?: number; min_quantity?: number; }

export function BagPipelinePanel() {
  const qc = useQueryClient();
  const [activating, setActivating] = useState(false);

  const sales = useQuery({
    queryKey: ["bag-pipeline-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bag_sale_ledger" as any)
        .select("store_id, product_id, bags_delta, source, created_at")
        .limit(5000);
      if (error) throw error;
      return (data || []) as any as SaleRow[];
    },
  });

  const inv = useQuery({
    queryKey: ["bag-pipeline-inv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bag_inventory_ledger" as any)
        .select("store_id, product_id, bags_delta")
        .limit(5000);
      if (error) throw error;
      return (data || []) as any as InvRow[];
    },
  });

  const alerts = useQuery({
    queryKey: ["bag-pipeline-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_bag_reorder_alerts" as any).select("*");
      if (error) return [] as AlertRow[];
      return (data || []) as any as AlertRow[];
    },
  });

  const liveSaleCount = useMemo(
    () => (sales.data || []).filter((r) => r.source === "invoice_finalized").length,
    [sales.data],
  );
  const backfillCount = useMemo(
    () => (sales.data || []).filter((r) => r.source === "invoice_backfill").length,
    [sales.data],
  );
  const isLive = liveSaleCount > 0;
  const isBackfilled = backfillCount > 0;

  const storeRollup = useMemo(() => {
    const map = new Map<string, { store_id: string; distributed: number; sold: number }>();
    (inv.data || []).forEach((r) => {
      const d = Number(r.bags_delta || 0);
      if (d <= 0) return;
      const cur = map.get(r.store_id) || { store_id: r.store_id, distributed: 0, sold: 0 };
      cur.distributed += d;
      map.set(r.store_id, cur);
    });
    (sales.data || []).forEach((r) => {
      const cur = map.get(r.store_id) || { store_id: r.store_id, distributed: 0, sold: 0 };
      cur.sold += Math.abs(Number(r.bags_delta || 0));
      map.set(r.store_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.sold + b.distributed - (a.sold + a.distributed)).slice(0, 25);
  }, [sales.data, inv.data]);

  const activate = async () => {
    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("bag-pipeline-activate", { body: {} });
      if (error) throw error;
      toast.success(`Backfill complete — ${data?.inserted ?? 0} rows inserted`);
      qc.invalidateQueries({ queryKey: ["bag-pipeline-sales"] });
      qc.invalidateQueries({ queryKey: ["bag-pipeline-inv"] });
    } catch (e: any) {
      toast.error(`Activation failed: ${e.message || e}`);
    } finally {
      setActivating(false);
    }
  };

  const steps = [
    { label: "1. finalize_invoice splits bag vs tube writes", done: isLive, manual: true },
    { label: "2. BagsSection on store profile", done: true },
    { label: "3. Tube Inventory card split by track_by", done: true },
    { label: "4. Backfill bag_sale_ledger from invoices", done: isBackfilled, action: true },
    { label: "5. Exclude bags from tube rollups", done: isLive, manual: true },
  ];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Bag Pipeline — Activation & Health
            </CardTitle>
            <CardDescription>
              Per docs/activate-bag-pipeline.md. Pipeline is{" "}
              <Badge variant={isLive ? "default" : "secondary"}>{isLive ? "ACTIVE" : "DORMANT"}</Badge>
            </CardDescription>
          </div>
          <Button onClick={activate} disabled={activating} className="gap-2">
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run Backfill (Step 4)
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isLive && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              finalize_invoice still writes only to tube_sale_ledger. Steps 1 &amp; 5 require a database
              migration before bags flow live — backfill alone is safe but won't capture new invoices.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
              {s.manual && !s.done && <Badge variant="outline" className="text-xs">manual migration</Badge>}
              {s.action && <Badge variant="outline" className="text-xs">one-click</Badge>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Live sales" value={liveSaleCount} />
          <Stat label="Backfilled sales" value={backfillCount} />
          <Stat label="Inventory rows" value={(inv.data || []).length} />
          <Stat label="Low-stock alerts" value={(alerts.data || []).length} />
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Top Stores — Distributed vs Sold</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Distributed</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storeRollup.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No bag activity yet.
                  </TableCell>
                </TableRow>
              ) : (
                storeRollup.map((r) => (
                  <TableRow key={r.store_id}>
                    <TableCell className="font-mono text-xs">{r.store_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-right">{r.distributed.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.sold.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {Math.max(0, r.distributed - r.sold).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {(alerts.data || []).length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Low-Stock Alerts
            </div>
            <div className="text-xs text-muted-foreground">
              {(alerts.data || []).length} store/product pairs below reorder threshold.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
