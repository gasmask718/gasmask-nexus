/**
 * Orders & Deliveries — unified visibility (Tasks #57/58/59)
 *
 * Tab 1: Orders Requested  — store_tube_inventory_status.needs_order = true
 * Tab 2: Orders Delivered  — invoices (finalized) with line items
 * Tab 3: Paid vs Unpaid    — delivered invoices, filterable by payment status
 *
 * All dates include the year. Extends (does NOT replace) DeliveriesBoard.tsx
 * which manages dispatch-side delivery rows.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Truck, DollarSign, Search, AlertTriangle } from "lucide-react";

const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "MMM d, yyyy") : "—";
const fmtMoney = (n: number | null | undefined) =>
  typeof n === "number" ? `$${n.toFixed(2)}` : "—";

// Days since delivery (used to age unpaid invoices)
const daysSince = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
};

// Bold red row styling for UNPAID invoices — must dominate the table.
// 'partial' gets a softer amber tint so it's still visible but distinct.
const unpaidRowClass = (status: string, owed: number) => {
  if (status === "paid" || owed <= 0) return "";
  if (status === "partial") {
    return "bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500 font-semibold";
  }
  // unpaid (or anything else with owed > 0)
  return "bg-red-500/15 hover:bg-red-500/25 border-l-4 border-l-red-600 font-semibold text-red-700 dark:text-red-300";
};

function AgeBadge({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted-foreground">—</span>;
  const cls =
    days >= 30
      ? "bg-red-600 text-white border-red-700"
      : days >= 14
      ? "bg-red-500/30 text-red-700 dark:text-red-200 border-red-500/50"
      : days >= 7
      ? "bg-amber-500/30 text-amber-800 dark:text-amber-200 border-amber-500/50"
      : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`text-xs font-bold ${cls}`}>
      {days}d unpaid
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab 1 — Orders Requested
// ─────────────────────────────────────────────────────────────────────
function useOrdersRequested() {
  return useQuery({
    queryKey: ["orders-requested"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_tube_inventory_status")
        .select(
          `id, store_id, brand_name, current_tubes_left, needs_order,
           bring_samples, bring_starter_kit, switch_quantity, switch_notes,
           last_updated_at, last_updated_by_role, last_updated_method,
           store:store_master!inner(
             id, store_name, address, city, state, owner_name, phone, relationship_status
           )`,
        )
        .eq("needs_order", true)
        .is("store.deleted_at", null)
        .order("last_updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function OrdersRequestedTab() {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useOrdersRequested();
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter((r: any) =>
      [r.store?.store_name, r.store?.city, r.brand_name, r.store?.owner_name]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(t)),
    );
  }, [data, q]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Orders Requested
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Stores flagged needing an order — from tube inventory checks &amp;
              field rep submissions.
            </p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search store, city, brand…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>What's Needed</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No order requests pending.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => {
                  const needs: string[] = [];
                  if (r.needs_order) needs.push(`${r.brand_name ?? "Product"} reorder`);
                  if (r.bring_samples) needs.push("Bring samples");
                  if (r.bring_starter_kit) needs.push("Starter kit");
                  if (r.switch_quantity) needs.push(`Switch ${r.switch_quantity}`);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.store?.store_name ?? "—"}</div>
                        {r.store?.owner_name && (
                          <div className="text-xs text-muted-foreground">{r.store.owner_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{r.store?.address ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.store?.city, r.store?.state].filter(Boolean).join(", ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {needs.map((n) => (
                            <Badge key={n} variant="outline" className="text-xs">
                              {n}
                            </Badge>
                          ))}
                          {r.current_tubes_left != null && (
                            <Badge variant="secondary" className="text-xs">
                              {r.current_tubes_left} tubes left
                            </Badge>
                          )}
                        </div>
                        {r.switch_notes && (
                          <div className="text-xs text-muted-foreground mt-1">{r.switch_notes}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {fmtDate(r.last_updated_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs">
                          {r.last_updated_by_role ?? r.last_updated_method ?? "system"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab 2 + 3 — Invoices (Delivered) + Paid/Unpaid
// ─────────────────────────────────────────────────────────────────────
function useDeliveredInvoices() {
  return useQuery({
    queryKey: ["delivered-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS2589: deep join type
        .from("invoices" as any)
        .select(
          `id, invoice_number, store_id, total, amount_paid, payment_status,
           paid_at, finalized_at, created_at, finalized_by, created_by,
           total_tubes_sold, total_boxes_sold,
           store:store_master!invoices_store_id_fkey(id, store_name, city, state),
           line_items:invoice_line_items(id, product_name, brand, quantity, unit_type)`,
        )
        .is("deleted_at", null)
        .not("finalized_at", "is", null)
        .order("finalized_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function InvoiceProductsCell({ items }: { items: any[] }) {
  if (!items?.length) return <span className="text-muted-foreground text-xs">—</span>;
  const top = items.slice(0, 2);
  const more = items.length - top.length;
  return (
    <div className="text-sm">
      {top.map((li) => (
        <div key={li.id}>
          <span className="font-medium">{li.quantity}</span>{" "}
          {li.unit_type ?? ""} {li.product_name ?? li.brand}
        </div>
      ))}
      {more > 0 && (
        <span className="text-xs text-muted-foreground">+ {more} more</span>
      )}
    </div>
  );
}

function OrdersDeliveredTab() {
  const [q, setQ] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const { data = [], isLoading } = useDeliveredInvoices();
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.filter((r: any) => {
      const status = r.payment_status ?? "unpaid";
      const owed = Math.max(Number(r.total ?? 0) - Number(r.amount_paid ?? 0), 0);
      if (onlyUnpaid && (status === "paid" || owed <= 0)) return false;
      if (!t) return true;
      return [r.store?.store_name, r.store?.city, r.invoice_number]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(t));
    });
  }, [data, q, onlyUnpaid]);

  const unpaidCount = useMemo(
    () =>
      data.filter((r: any) => {
        const status = r.payment_status ?? "unpaid";
        const owed = Math.max(Number(r.total ?? 0) - Number(r.amount_paid ?? 0), 0);
        return status !== "paid" && owed > 0;
      }).length,
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Orders Delivered
              <Badge variant="secondary">{rows.length}</Badge>
              {unpaidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {unpaidCount} unpaid — go collect
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Finalized invoices — unpaid rows are bold-red. Toggle "Unpaid only" for the collection list.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={onlyUnpaid ? "destructive" : "outline"}
              onClick={() => setOnlyUnpaid((v) => !v)}
            >
              {onlyUnpaid ? "Showing unpaid only" : "Unpaid only"}
            </Button>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search store or invoice…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Qty (tubes)</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Delivered By</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No delivered orders.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => {
                  const total = Number(r.total ?? 0);
                  const paid = Number(r.amount_paid ?? 0);
                  const owed = Math.max(total - paid, 0);
                  const status = r.payment_status ?? "unpaid";
                  const isUnpaid = status !== "paid" && owed > 0;
                  const days = isUnpaid ? daysSince(r.finalized_at ?? r.created_at) : null;
                  return (
                    <TableRow key={r.id} className={unpaidRowClass(status, owed)}>
                      <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.store?.store_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.store?.city, r.store?.state].filter(Boolean).join(", ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <InvoiceProductsCell items={r.line_items ?? []} />
                      </TableCell>
                      <TableCell>{r.total_tubes_sold ?? 0}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {fmtDate(r.finalized_at ?? r.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">{r.finalized_by ?? r.created_by ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmtMoney(total)}</TableCell>
                      <TableCell className="text-right">
                        {owed > 0 ? (
                          <span className="font-bold">{fmtMoney(owed)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isUnpaid ? <AgeBadge days={days} /> : <span className="text-muted-foreground text-xs">paid</span>}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PaidUnpaidTab() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "partial">("unpaid");
  const { data = [], isLoading } = useDeliveredInvoices();

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.filter((r: any) => {
      const status = r.payment_status ?? "unpaid";
      if (filter !== "all" && status !== filter) return false;
      if (!t) return true;
      return [r.store?.store_name, r.store?.city, r.invoice_number]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(t));
    });
  }, [data, q, filter]);

  const totals = useMemo(() => {
    let owed = 0;
    let paid = 0;
    for (const r of rows as any[]) {
      const total = Number(r.total ?? 0);
      const amt = Number(r.amount_paid ?? 0);
      paid += amt;
      owed += Math.max(total - amt, 0);
    }
    return { owed, paid };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Paid vs Unpaid
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Owed in view:{" "}
              <span className="font-semibold text-foreground">{fmtMoney(totals.owed)}</span>{" "}
              · Paid in view:{" "}
              <span className="font-semibold text-foreground">{fmtMoney(totals.paid)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "unpaid", "partial", "paid"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? "default" : "outline"}
                onClick={() => setFilter(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
            <div className="relative w-60">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Paid On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No invoices match filter.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => {
                  const total = Number(r.total ?? 0);
                  const paid = Number(r.amount_paid ?? 0);
                  const owed = Math.max(total - paid, 0);
                  const status = r.payment_status ?? "unpaid";
                  const isUnpaid = status !== "paid" && owed > 0;
                  const days = isUnpaid ? daysSince(r.finalized_at ?? r.created_at) : null;
                  return (
                    <TableRow key={r.id} className={unpaidRowClass(status, owed)}>
                      <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.store?.store_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.store?.city, r.store?.state].filter(Boolean).join(", ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {fmtDate(r.finalized_at ?? r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "paid"
                              ? "default"
                              : status === "partial"
                              ? "secondary"
                              : "destructive"
                          }
                          className="capitalize"
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtMoney(total)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(paid)}</TableCell>
                      <TableCell className="text-right font-bold">
                        {owed > 0 ? (
                          <span>{fmtMoney(owed)}</span>
                        ) : (
                          <span className="text-muted-foreground font-normal">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isUnpaid ? <AgeBadge days={days} /> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {fmtDate(r.paid_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
export default function OrdersDeliveriesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Orders &amp; Deliveries</h1>
        <p className="text-muted-foreground">
          Unified visibility — what's requested, what's delivered, who owes.
        </p>
      </div>
      <Tabs defaultValue="requested">
        <TabsList>
          <TabsTrigger value="requested">Orders Requested</TabsTrigger>
          <TabsTrigger value="delivered">Orders Delivered</TabsTrigger>
          <TabsTrigger value="payments">Paid vs Unpaid</TabsTrigger>
        </TabsList>
        <TabsContent value="requested" className="mt-4">
          <OrdersRequestedTab />
        </TabsContent>
        <TabsContent value="delivered" className="mt-4">
          <OrdersDeliveredTab />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaidUnpaidTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
