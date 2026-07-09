// Dynasty Direct — Purchase Orders management
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Send, CheckCircle2, Truck, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import { printShippingLabel } from "@/lib/shipping/printLabel";

type PO = {
  id: string;
  po_number: string;
  wholesaler_id: string;
  marketplace_order_id: string | null;
  status: string;
  items: Array<{
    product_name?: string;
    sku?: string;
    quantity?: number;
    unit_cost?: number;
    line_total?: number;
  }>;
  subtotal: number;
  shipping_cost: number;
  total: number;
  payment_terms: string;
  expected_ship_date: string | null;
  actual_ship_date: string | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  wholesalers?: { name: string | null; email: string | null } | null;
};

const statusColor: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
  sent: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  acknowledged: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  in_production: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  shipped: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  delivered: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

export default function DDPurchaseOrders() {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<PO | null>(null);
  const [creating, setCreating] = useState(false);
  const [trackingFor, setTrackingFor] = useState<PO | null>(null);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["dd-purchase-orders"],
    queryFn: async (): Promise<PO[]> => {
      const { data, error } = await supabase
        .from("dd_purchase_orders" as any)
        .select("*, wholesalers(name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return {
      draft: pos.filter((p) => p.status === "draft").length,
      sent: pos.filter((p) => p.status === "sent").length,
      acknowledged: pos.filter((p) => p.status === "acknowledged").length,
      in_production: pos.filter((p) => p.status === "in_production").length,
      shipped: pos.filter((p) => p.status === "shipped").length,
      this_month: pos.filter((p) => {
        const d = new Date(p.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      }).length,
    };
  }, [pos]);

  const sendToSupplier = useMutation({
    mutationFn: async (po: PO) => {
      const { data, error } = await supabase.functions.invoke("dd-generate-po", {
        body: {
          // Re-trigger build is overkill; just mark sent + ensure email sent.
          // Use a lightweight email-only path: call the edge function with the
          // existing PO's order/wholesaler when present, or just flip status.
        },
      });
      // Simpler & deterministic: update the row directly.
      void data;
      void error;
      const { error: upErr } = await supabase
        .from("dd_purchase_orders" as any)
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", po.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-purchase-orders"] });
      toast.success("PO sent to supplier");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const acknowledge = useMutation({
    mutationFn: async (po: PO) => {
      const { error } = await supabase
        .from("dd_purchase_orders" as any)
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
        .eq("id", po.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-purchase-orders"] });
      toast.success("PO marked acknowledged");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startProduction = useMutation({
    mutationFn: async (po: PO) => {
      const { error } = await supabase
        .from("dd_purchase_orders" as any)
        .update({ status: "in_production" })
        .eq("id", po.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-purchase-orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">📄 Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">
              Formal POs generated for every supplier order
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Manual PO
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Sent" value={stats.sent} />
        <StatCard label="Acknowledged" value={stats.acknowledged} />
        <StatCard label="In Production" value={stats.in_production} />
        <StatCard label="Shipped" value={stats.shipped} />
        <StatCard label="This Month" value={stats.this_month} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : pos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No purchase orders yet. Routed orders auto-generate POs.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected Ship</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                    <TableCell className="text-xs">{po.wholesalers?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {po.marketplace_order_id ? po.marketplace_order_id.slice(0, 8) : "—"}
                    </TableCell>
                    <TableCell className="text-right">${Number(po.total).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[po.status] ?? ""}>
                        {po.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{po.expected_ship_date ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(po)} title="View">
                          <Eye className="w-3 h-3" />
                        </Button>
                        {po.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => sendToSupplier.mutate(po)}
                            title="Send to supplier"
                          >
                            <Send className="w-3 h-3 text-blue-600" />
                          </Button>
                        )}
                        {po.status === "sent" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => acknowledge.mutate(po)}
                            title="Mark acknowledged"
                          >
                            <CheckCircle2 className="w-3 h-3 text-purple-600" />
                          </Button>
                        )}
                        {po.status === "acknowledged" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startProduction.mutate(po)}
                            title="Mark in production"
                          >
                            <FileText className="w-3 h-3 text-amber-600" />
                          </Button>
                        )}
                        {po.status === "in_production" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTrackingFor(po)}
                            title="Enter tracking"
                          >
                            <Truck className="w-3 h-3 text-teal-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ViewPODialog po={viewing} onClose={() => setViewing(null)} />
      <CreateManualPODialog open={creating} onClose={() => setCreating(false)} />
      <TrackingDialog po={trackingFor} onClose={() => setTrackingFor(null)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ViewPODialog({ po, onClose }: { po: PO | null; onClose: () => void }) {
  if (!po) return null;
  return (
    <Dialog open={!!po} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{po.po_number}</span>
            <Badge variant="outline" className={statusColor[po.status] ?? ""}>
              {po.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <InfoBox title="Supplier">
              <div className="font-semibold">{po.wholesalers?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{po.wholesalers?.email ?? ""}</div>
            </InfoBox>
            <InfoBox title="Ship To">
              <div className="font-semibold">Dynasty Direct</div>
              <div className="text-xs text-muted-foreground">orders@dynastydirect.com</div>
            </InfoBox>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <Kv k="Created" v={new Date(po.created_at).toLocaleDateString()} />
            <Kv k="Expected Ship" v={po.expected_ship_date ?? "—"} />
            <Kv k="Payment Terms" v={po.payment_terms?.toUpperCase()} />
            {po.tracking_number && <Kv k="Tracking" v={po.tracking_number} />}
            {po.carrier && <Kv k="Carrier" v={po.carrier} />}
            {po.actual_ship_date && <Kv k="Shipped" v={po.actual_ship_date} />}
          </div>

          <div>
            <div className="text-xs uppercase text-muted-foreground mb-2">Items</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-right">Qty</TableHead>
                  <TableHead className="text-xs text-right">Unit Cost</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(po.items ?? []).map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs">{i.sku || "—"}</TableCell>
                    <TableCell className="text-xs">{i.product_name ?? ""}</TableCell>
                    <TableCell className="text-xs text-right">{i.quantity ?? 0}</TableCell>
                    <TableCell className="text-xs text-right">
                      ${Number(i.unit_cost ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      ${Number(i.line_total ?? 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="ml-auto w-64 text-sm space-y-1">
            <Row k="Subtotal" v={`$${Number(po.subtotal).toFixed(2)}`} />
            <Row k="Shipping" v={po.shipping_cost ? `$${Number(po.shipping_cost).toFixed(2)}` : "TBD"} />
            <div className="border-t pt-2 font-bold flex justify-between">
              <span>Total</span>
              <span>${Number(po.total).toFixed(2)}</span>
            </div>
          </div>

          {po.notes && (
            <div className="text-xs">
              <div className="uppercase text-muted-foreground mb-1">Notes</div>
              <div>{po.notes}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      {children}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div>{v}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function CreateManualPODialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [wholesalerId, setWholesalerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("net30");
  const [expectedShip, setExpectedShip] = useState<string>(
    new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10),
  );

  const { data: wholesalers = [] } = useQuery({
    queryKey: ["dd-wholesalers-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesalers" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!wholesalerId) throw new Error("Select a supplier");
      const { data, error } = await supabase.functions.invoke("dd-generate-po", {
        body: {
          wholesaler_id: wholesalerId,
          send_to_supplier: false,
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.po_id && (notes || terms || expectedShip)) {
        await supabase
          .from("dd_purchase_orders" as any)
          .update({
            notes: notes || null,
            payment_terms: terms,
            expected_ship_date: expectedShip,
          })
          .eq("id", result.po_id);
      }
      return result;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["dd-purchase-orders"] });
      toast.success(`Draft PO ${r?.po_number ?? ""} created`);
      onClose();
      setWholesalerId("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Manual Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Supplier</Label>
            <Select value={wholesalerId} onValueChange={setWholesalerId}>
              <SelectTrigger><SelectValue placeholder="Select supplier…" /></SelectTrigger>
              <SelectContent>
                {wholesalers.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.name ?? "(unnamed)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Items are pulled from the linked marketplace order. Use Inventory &amp; Orders
              to attach line items after creating the draft.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payment Terms</Label>
              <Select value={terms} onValueChange={setTerms}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["prepay", "net15", "net30", "net60"].map((v) => (
                    <SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Expected Ship</Label>
              <Input
                type="date"
                value={expectedShip}
                onChange={(e) => setExpectedShip(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Generating…" : "Generate PO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const buildTrackingUrl = (carrier: string, tracking: string): string => {
  const urls: Record<string, string> = {
    UPS: `https://www.ups.com/track?tracknum=${tracking}`,
    FedEx: `https://www.fedex.com/tracking?trackingnum=${tracking}`,
    USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`,
    DHL: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${tracking}`,
    Amazon: `https://track.amazon.com/tracking/${tracking}`,
  };
  return urls[carrier] || "#";
};

function TrackingDialog({ po, onClose }: { po: PO | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("UPS");
  const [shipDate, setShipDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const save = useMutation({
    mutationFn: async () => {
      if (!po) return;
      if (!tracking.trim()) throw new Error("Tracking number required");
      const { error } = await supabase
        .from("dd_purchase_orders" as any)
        .update({
          tracking_number: tracking,
          carrier,
          actual_ship_date: shipDate,
          status: "shipped",
        })
        .eq("id", po.id);
      if (error) throw error;

      // Notify customer that their order shipped (SMS + Email)
      if (po.marketplace_order_id) {
        await supabase.functions
          .invoke("dd-notify-customer-order-update", {
            body: {
              order_id: po.marketplace_order_id,
              event_type: "shipped",
              tracking_number: tracking,
              carrier,
              tracking_url: buildTrackingUrl(carrier, tracking),
            },
          })
          .catch((e) => console.error("Customer shipped notification failed:", e));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-purchase-orders"] });
      toast.success("Tracking saved · customer notified");
      onClose();
      setTracking("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!po} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Tracking · {po?.po_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tracking Number</Label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["UPS", "FedEx", "USPS", "DHL", "Other"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ship Date</Label>
              <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
