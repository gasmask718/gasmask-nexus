/**
 * DD SPRINT 5 — WHOLESALER PORTAL: ORDER GRABBA
 * /portal/wholesaler/order-grabba
 *
 * Wholesalers buy GasMask grabba via dd_create_grabba_order RPC.
 * First tap auto-links them to a store_master record.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const GRABBA_BRANDS = ["Bigga Bredda", "Gold Leaf", "Royal", "Crown", "Imperial", "Diamond"];

export default function WholesalerOrderGrabba() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [brand, setBrand] = useState(GRABBA_BRANDS[0]);
  const [boxes, setBoxes] = useState(1);
  const [day, setDay] = useState("this_week");
  const [window, setWindow] = useState("morning");
  const [notes, setNotes] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["wholesaler-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesaler_profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ["wholesaler-grabba-orders", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_wholesaler_grabba_orders")
        .select("*")
        .eq("wholesaler_id", profile!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.id,
    refetchInterval: 10000,
  });

  const place = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("dd_create_grabba_order", {
        p_wholesaler_id: profile!.id,
        p_brand: brand,
        p_boxes: boxes,
        p_requested_day: day,
        p_requested_window: window,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Grabba order submitted to GasMask dispatch");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["wholesaler-grabba-orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!profile) {
    return <div className="p-6 text-sm text-muted-foreground">Loading wholesaler profile…</div>;
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🍃 Order Grabba</h1>
        <p className="text-sm text-muted-foreground">
          Buy GasMask grabba — delivered through our standard dispatch network.
          Invoicing is handled by GasMask; this is separate from your Dynasty Direct catalog sales.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Place Order</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Brand</label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRABBA_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Boxes</label>
              <Input type="number" min={1} value={boxes} onChange={(e) => setBoxes(Math.max(1, +e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Day</label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This week</SelectItem>
                  <SelectItem value="next_week">Next week</SelectItem>
                  <SelectItem value="no_rush">No rush</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Window</label>
              <Select value={window} onValueChange={setWindow}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea placeholder="Notes for the driver (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={() => place.mutate()} disabled={place.isPending}>
            {place.isPending ? "Submitting…" : "Submit Grabba Order"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">My Grabba Orders</CardTitle></CardHeader>
        <CardContent>
          {myOrders.length === 0 && <div className="text-sm text-muted-foreground">No orders yet.</div>}
          <div className="space-y-2">
            {myOrders.map((o: any) => (
              <div key={o.pending_route_stop_id} className="border rounded px-3 py-2 text-sm flex items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium">{o.boxes} × {o.brand}</div>
                  <div className="text-xs text-muted-foreground">{o.requested_day} {o.requested_window}</div>
                </div>
                <Badge variant={
                  o.status === "approved" ? "default" :
                  o.status === "rejected" ? "destructive" : "secondary"
                }>
                  {o.route_stop_id ? "scheduled" : o.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
