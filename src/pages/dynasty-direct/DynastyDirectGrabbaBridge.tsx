/**
 * DD — GRABBA BRIDGE Live Status (DD → GasMask sync log)
 * /dynasty-direct/grabba-bridge
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, RefreshCw, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function DynastyDirectGrabbaBridge() {
  const qc = useQueryClient();

  const { data: syncs = [] } = useQuery({
    queryKey: ["dd-grabba-sync-rows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_grabba_sync" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 8000,
  });

  const { data: unsynced = [] } = useQuery({
    queryKey: ["dd-grabba-unsynced"],
    queryFn: async () => {
      // Fetch paid marketplace orders + outer join to grabba sync to find pending
      const { data } = await supabase
        .from("marketplace_orders")
        .select("id, created_at, customer_email, total")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(100);
      const syncedIds = new Set(syncs.filter((s) => s.status === "synced").map((s) => s.marketplace_order_id));
      return (data || []).filter((o) => !syncedIds.has(o.id));
    },
  });

  const todayCount = syncs.filter((s) => {
    const d = new Date(s.synced_at ?? s.created_at);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d >= today && s.status === "synced";
  }).length;
  const pendingCount = syncs.filter((s) => s.status === "pending").length;
  const failedCount = syncs.filter((s) => s.status === "failed").length;

  const sync = useMutation({
    mutationFn: async ({ order_id, force }: { order_id: string; force: boolean }) => {
      const { error } = await supabase.functions.invoke("dd-grabba-bridge", {
        body: { order_id, force_resync: force },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-grabba-sync-rows"] });
      qc.invalidateQueries({ queryKey: ["dd-grabba-unsynced"] });
      toast.success("Sync triggered");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const notify = useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await supabase.functions.invoke("dd-notify-supplier-order", {
        body: {
          grabba_sync_id: row.id,
          wholesaler_id: row.wholesaler_id,
          order_id: row.marketplace_order_id,
        },
      });
      if (error) throw error;
      return data as { sent?: boolean; notified?: string; error?: string };
    },
    onSuccess: (res) => {
      if (res?.sent) toast.success(`Notified ${res.notified ?? "supplier"}`);
      else toast.warning(res?.error ?? "Notification not sent");
      qc.invalidateQueries({ queryKey: ["dd-grabba-sync-rows"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      for (const o of unsynced) {
        await supabase.functions
          .invoke("dd-grabba-bridge", { body: { order_id: o.id } })
          .catch((e) => console.error(e));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-grabba-sync-rows"] });
      qc.invalidateQueries({ queryKey: ["dd-grabba-unsynced"] });
      toast.success(`Synced ${unsynced.length} orders`);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="w-7 h-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Grabba Bridge</h1>
          <p className="text-sm text-muted-foreground">
            DD orders synced to the GasMask delivery pipeline.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Synced Today" value={todayCount} color="text-emerald-600" />
        <Stat label="Pending" value={pendingCount + unsynced.length} color="text-amber-600" />
        <Stat label="Failed" value={failedCount} color="text-rose-600" />
      </div>

      {unsynced.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Paid Orders Awaiting Sync ({unsynced.length})</span>
              <Button size="sm" onClick={() => syncAll.mutate()} disabled={syncAll.isPending}>
                <Play className="w-3 h-3 mr-1" /> Sync All Pending
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {unsynced.slice(0, 10).map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b py-1">
                  <Link to={`/dynasty-direct/orders/${o.id}`} className="font-mono text-xs text-primary hover:underline">
                    {o.id.slice(0, 8)}
                  </Link>
                  <span className="text-xs">{o.customer_email}</span>
                  <span className="text-xs">${Number(o.total).toFixed(2)}</span>
                  <Button size="sm" variant="outline" onClick={() => sync.mutate({ order_id: o.id, force: false })}>
                    Sync
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grabba Sync Log</CardTitle>
        </CardHeader>
        <CardContent>
          {syncs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sync records yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Wholesaler</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Synced At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to={`/dynasty-direct/orders/${s.marketplace_order_id}`} className="font-mono text-xs text-primary hover:underline">
                        {s.marketplace_order_id?.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.wholesaler_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="text-xs">{Array.isArray(s.items) ? s.items.length : 0}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "synced" ? "default" : s.status === "failed" ? "destructive" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.synced_at ? new Date(s.synced_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => sync.mutate({ order_id: s.marketplace_order_id, force: true })}
                        title="Retry / resync"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color = "" }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
