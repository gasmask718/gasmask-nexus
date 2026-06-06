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
import { useTranslation } from "@/hooks/useTranslation";

interface SaleRow { store_id: string; product_id: string; bags_delta: number; source: string; created_at: string; }
interface InvRow { store_id: string; product_id: string; bags_delta: number; }
interface AlertRow { store_id: string; product_id: string; product_name?: string; bags_on_hand?: number; min_quantity?: number; }

export function BagPipelinePanel() {
  const qc = useQueryClient();
  const { t } = useTranslation();
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
      toast.success(t('bag.toast.backfill_done', { n: data?.inserted ?? 0 }));
      qc.invalidateQueries({ queryKey: ["bag-pipeline-sales"] });
      qc.invalidateQueries({ queryKey: ["bag-pipeline-inv"] });
    } catch (e: any) {
      toast.error(t('bag.toast.activation_failed', { err: e.message || String(e) }));
    } finally {
      setActivating(false);
    }
  };

  const steps = [
    { label: t('bag.step.1'), done: isLive, manual: true },
    { label: t('bag.step.2'), done: true },
    { label: t('bag.step.3'), done: true },
    { label: t('bag.step.4'), done: isBackfilled, action: true },
    { label: t('bag.step.5'), done: isLive, manual: true },
  ];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {t('bag.title')}
            </CardTitle>
            <CardDescription>
              {t('bag.desc_prefix')}{" "}
              <Badge variant={isLive ? "default" : "secondary"}>{isLive ? t('bag.status.active') : t('bag.status.dormant')}</Badge>
            </CardDescription>
          </div>
          <Button onClick={activate} disabled={activating} className="gap-2">
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {t('bag.run_backfill')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isLive && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              {t('bag.warn_finalize')}
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
              {s.manual && !s.done && <Badge variant="outline" className="text-xs">{t('bag.tag.manual')}</Badge>}
              {s.action && <Badge variant="outline" className="text-xs">{t('bag.tag.action')}</Badge>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('bag.stat.live')} value={liveSaleCount} />
          <Stat label={t('bag.stat.backfilled')} value={backfillCount} />
          <Stat label={t('bag.stat.inv_rows')} value={(inv.data || []).length} />
          <Stat label={t('bag.stat.low_stock')} value={(alerts.data || []).length} />
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{t('bag.rollup_title')}</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('bag.col.store')}</TableHead>
                <TableHead className="text-right">{t('bag.col.distributed')}</TableHead>
                <TableHead className="text-right">{t('bag.col.sold')}</TableHead>
                <TableHead className="text-right">{t('bag.col.on_hand')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storeRollup.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    {t('bag.empty')}
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
              <AlertTriangle className="h-4 w-4 text-amber-500" /> {t('bag.low_stock_title')}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('bag.low_stock_summary', { n: (alerts.data || []).length })}
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
