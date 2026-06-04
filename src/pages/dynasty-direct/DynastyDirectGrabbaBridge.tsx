/**
 * DD SPRINT 5 — GRABBA BRIDGE
 * /dynasty-direct/grabba-bridge
 *
 * Cross-company surface: lists all grabba orders DD wholesalers have
 * injected into the GasMask route command center. Admin oversight only —
 * actual order placement happens from the wholesaler portal.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DynastyDirectGrabbaBridge() {
  const { data: orders = [] } = useQuery({
    queryKey: ["dd-grabba-bridge-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_wholesaler_grabba_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 8000,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["dd-grabba-bridge-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_wholesaler_store_link")
        .select("wholesaler_id, store_master_id, created_at, w:wholesaler_id(company_name)");
      return data || [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="w-7 h-7 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Grabba Bridge</h1>
          <p className="text-sm text-muted-foreground">
            Cross-company order injection — DD wholesalers buy GasMask grabba. Booking goes through the standard route command center; invoicing is GasMask-side. DD never touches grabba revenue.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Linked Wholesalers (as GasMask customers)</CardTitle></CardHeader>
        <CardContent>
          {links.length === 0 && <div className="text-sm text-muted-foreground">No wholesalers have placed a grabba order yet.</div>}
          <div className="space-y-1">
            {links.map((l: any) => (
              <div key={l.wholesaler_id} className="text-sm flex items-center gap-2 border-b py-1">
                <span className="font-medium">{l.w?.company_name}</span>
                <span className="text-muted-foreground font-mono text-xs">store_master {l.store_master_id.slice(0, 8)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Grabba Orders Injected
            <Link to="/gasmask/route-command-center">
              <Button size="sm" variant="outline"><ExternalLink className="w-3 h-3 mr-1" />Route Command Center</Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 && <div className="text-sm text-muted-foreground">No grabba orders yet.</div>}
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o.pending_route_stop_id} className="border rounded px-3 py-2 text-sm flex items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium">{o.store_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.boxes} boxes · {o.brand} · {o.requested_day} {o.requested_window}
                  </div>
                </div>
                <Badge variant="outline">DD-wholesaler</Badge>
                <Badge variant={o.status === "approved" ? "default" : o.status === "rejected" ? "destructive" : "secondary"}>
                  {o.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
