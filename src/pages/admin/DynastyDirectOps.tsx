import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GeocodingService } from "@/services/geocoding";
import { Loader2, MapPin, Link2, Warehouse, Package } from "lucide-react";

/**
 * Dynasty Direct Sprint 1 — Operations Console
 * - Wholesaler unification (CRM ↔ portal profile linking)
 * - Geocoding review queue (rows needing manual address fix)
 * - Live fulfillment + inventory snapshot
 */
export default function DynastyDirectOps() {
  const qc = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ["dd-ops-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesaler_profiles")
        .select("id, company_name, email, wholesaler_id, warehouse_state, warehouse_lat, warehouse_lng");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: crmWholesalers } = useQuery({
    queryKey: ["dd-ops-crm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesalers")
        .select("id, name, email, state, city, address, latitude, longitude, geocode_status")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: inventory } = useQuery({
    queryKey: ["dd-ops-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_products_all_with_stock" as any)
        .select("id, product_name, available_stock, total_stock, supplier_count_with_stock");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: fulfillments } = useQuery({
    queryKey: ["dd-ops-fulfillments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_fulfillments")
        .select("id, order_id, status, shipping_mode, carrier, tracking_number, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const linkProfile = useMutation({
    mutationFn: async (vars: { profileId: string; wholesalerId: string | null }) => {
      const { error } = await supabase
        .from("wholesaler_profiles")
        .update({ wholesaler_id: vars.wholesalerId })
        .eq("id", vars.profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-ops-profiles"] });
      toast.success("Profile linked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const geocodeRow = useMutation({
    mutationFn: async (w: any) => {
      const res = await GeocodingService.geocodeAddress(w.address, w.city, w.state, null);
      if ("error" in res) {
        await supabase.from("wholesalers").update({
          geocode_status: "needs_review",
          geocode_notes: res.error,
          geocode_last_attempt_at: new Date().toISOString(),
        }).eq("id", w.id);
        throw new Error(res.error);
      }
      await supabase.from("wholesalers").update({
        latitude: res.lat,
        longitude: res.lng,
        geocode_status: "geocoded",
        geocode_last_attempt_at: new Date().toISOString(),
      }).eq("id", w.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-ops-crm"] });
      toast.success("Geocoded");
    },
    onError: (e: any) => toast.error(`Flagged for review: ${e.message}`),
  });

  const geocodeAll = useMutation({
    mutationFn: async () => {
      const pending = (crmWholesalers || []).filter((w: any) => !w.latitude);
      let ok = 0, fail = 0;
      for (const w of pending) {
        try { await geocodeRow.mutateAsync(w); ok++; }
        catch { fail++; }
      }
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => toast.success(`Geocoded ${ok}, flagged ${fail}`),
  });

  const unmapped = (profiles || []).filter((p: any) => !p.wholesaler_id);
  const reviewQueue = (crmWholesalers || []).filter((w: any) => w.geocode_status === "needs_review" || (!w.latitude && w.address));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dynasty Direct — Operations</h1>
        <p className="text-sm text-muted-foreground">Sprint 1: supplier unification, geocoding, and live fulfillment pipeline.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Portal Profiles</div><div className="text-2xl font-bold">{profiles?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">CRM Wholesalers</div><div className="text-2xl font-bold">{crmWholesalers?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Live Fulfillments</div><div className="text-2xl font-bold">{fulfillments?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Products w/ Stock</div><div className="text-2xl font-bold">{inventory?.filter((p: any) => p.available_stock > 0).length || 0}/{inventory?.length || 0}</div></CardContent></Card>
      </div>

      {/* Unification */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />Link Portal Profiles → CRM Wholesalers</CardTitle></CardHeader>
        <CardContent>
          {unmapped.length === 0 ? (
            <div className="text-sm text-muted-foreground">All profiles linked.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Profile</TableHead><TableHead>Email</TableHead><TableHead>Link to CRM</TableHead></TableRow></TableHeader>
              <TableBody>
                {unmapped.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.company_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell>
                      <Select onValueChange={(val) => linkProfile.mutate({ profileId: p.id, wholesalerId: val })}>
                        <SelectTrigger className="w-72"><SelectValue placeholder="Pick CRM record…" /></SelectTrigger>
                        <SelectContent>
                          {(crmWholesalers || []).map((w: any) => (
                            <SelectItem key={w.id} value={w.id}>{w.name} {w.email ? `(${w.email})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Geocoding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />Geocoding Queue ({reviewQueue.length})</span>
            <Button size="sm" onClick={() => geocodeAll.mutate()} disabled={geocodeAll.isPending}>
              {geocodeAll.isPending && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
              Geocode All Pending
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviewQueue.length === 0 ? (
            <div className="text-sm text-muted-foreground">All CRM wholesalers geocoded.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {reviewQueue.slice(0, 20).map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-xs">{[w.address, w.city, w.state].filter(Boolean).join(", ") || <span className="text-red-500">no address</span>}</TableCell>
                    <TableCell>
                      <Badge variant={w.geocode_status === "needs_review" ? "destructive" : "outline"}>{w.geocode_status || "pending"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => geocodeRow.mutate(w)}>Geocode</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Live fulfillments */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Warehouse className="h-4 w-4" />Live Fulfillments (last 20)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead>Mode</TableHead><TableHead>Tracking</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {(fulfillments || []).map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.order_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge>{f.status}</Badge></TableCell>
                  <TableCell><Badge variant={f.shipping_mode === "live" ? "default" : "outline"}>{f.shipping_mode}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{f.tracking_number || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Per-Supplier Inventory</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Available</TableHead><TableHead>Total</TableHead><TableHead>Suppliers w/ stock</TableHead></TableRow></TableHeader>
            <TableBody>
              {(inventory || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className={p.available_stock === 0 ? "text-red-500" : ""}>{p.available_stock}</TableCell>
                  <TableCell>{p.total_stock}</TableCell>
                  <TableCell>{p.supplier_count_with_stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
