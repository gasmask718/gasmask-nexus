// Dynasty Direct — Supplier Performance Dashboard
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  TrendingUp, RefreshCw, Star, AlertTriangle, Mail, Trophy, ChevronsUpDown, MessageCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type RangeDays = 7 | 30 | 90 | 3650;
type SortKey =
  | "rank" | "name" | "grade" | "orders" | "fulfilled"
  | "rate" | "avg_days" | "issues" | "revenue" | "last_order";

interface SupplierRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  grade: string;
  preferred: boolean;
  orders_received: number;
  orders_fulfilled: number;
  fulfillment_rate: number;
  avg_fulfillment_days: number;
  issue_count: number;
  revenue: number;
  last_order_at: string | null;
}

function gradeFromRate(rate: number, received: number): "A" | "B" | "C" | "D" | "F" | "unrated" {
  if (!received) return "unrated";
  if (rate >= 95) return "A";
  if (rate >= 85) return "B";
  if (rate >= 70) return "C";
  if (rate >= 50) return "D";
  return "F";
}

const gradeColor: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  B: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  C: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  D: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  F: "bg-red-500/15 text-red-700 border-red-500/30",
  unrated: "bg-muted text-muted-foreground border-border",
};

const rowTint: Record<string, string> = {
  A: "bg-emerald-500/5",
  F: "bg-red-500/5",
};

export default function DDSupplierPerformance() {
  const qc = useQueryClient();
  const [days, setDays] = useState<RangeDays>(30);
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [flagText, setFlagText] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dd-supplier-performance", days],
    queryFn: async (): Promise<SupplierRow[]> => {
      const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
      const [{ data: whs }, { data: syncs }] = await Promise.all([
        supabase
          .from("wholesalers")
          .select("id,name,email,phone,reliability_grade,preferred,avg_fulfillment_days,last_order_at")
          .is("deleted_at", null),
        supabase
          .from("dd_grabba_sync" as any)
          .select("wholesaler_id,status,marketplace_order_id,created_at")
          .gte("created_at", sinceIso),
      ]);

      const orderIds = Array.from(
        new Set((syncs ?? []).map((s: any) => s.marketplace_order_id).filter(Boolean)),
      );
      const orderTotals = new Map<string, number>();
      if (orderIds.length) {
        const { data: orders } = await supabase
          .from("marketplace_orders")
          .select("id,total")
          .in("id", orderIds);
        (orders ?? []).forEach((o: any) => orderTotals.set(o.id, Number(o.total ?? 0)));
      }

      const byWholesaler = new Map<string, { received: number; fulfilled: number; revenue: number }>();
      (syncs ?? []).forEach((s: any) => {
        if (!s.wholesaler_id) return;
        const acc = byWholesaler.get(s.wholesaler_id) ?? { received: 0, fulfilled: 0, revenue: 0 };
        acc.received += 1;
        if (s.status === "fulfilled") {
          acc.fulfilled += 1;
          acc.revenue += orderTotals.get(s.marketplace_order_id) ?? 0;
        }
        byWholesaler.set(s.wholesaler_id, acc);
      });

      return (whs ?? []).map((w: any) => {
        const m = byWholesaler.get(w.id) ?? { received: 0, fulfilled: 0, revenue: 0 };
        const rate = m.received > 0 ? Math.round((m.fulfilled / m.received) * 1000) / 10 : 0;
        return {
          id: w.id,
          name: w.name,
          email: w.email,
          phone: w.phone,
          grade: w.reliability_grade ?? gradeFromRate(rate, m.received),
          preferred: !!w.preferred,
          orders_received: m.received,
          orders_fulfilled: m.fulfilled,
          fulfillment_rate: rate,
          avg_fulfillment_days: Number(w.avg_fulfillment_days ?? 0),
          issue_count: 0,
          revenue: m.revenue,
          last_order_at: w.last_order_at,
        };
      });
    },
  });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const get = (r: SupplierRow): number | string => {
        switch (sortKey) {
          case "name": return r.name.toLowerCase();
          case "grade": return r.grade;
          case "orders": return r.orders_received;
          case "fulfilled": return r.orders_fulfilled;
          case "rate": return r.fulfillment_rate;
          case "avg_days": return r.avg_fulfillment_days;
          case "issues": return r.issue_count;
          case "revenue": return r.revenue;
          case "last_order": return r.last_order_at ? new Date(r.last_order_at).getTime() : 0;
          default: return r.fulfillment_rate;
        }
      };
      const va = get(a), vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const leaderboard = useMemo(
    () => [...rows].sort((a, b) => b.fulfillment_rate - a.fulfillment_rate).slice(0, 3),
    [rows],
  );

  const alerts = useMemo(
    () => rows.filter(r => r.orders_received >= 1 && (r.fulfillment_rate < 70 || r.avg_fulfillment_days > 5 || r.issue_count > 3)),
    [rows],
  );

  const recalc = useMutation({
    mutationFn: async () => {
      let n = 0;
      for (const r of rows) {
        const { error } = await supabase.rpc("dd_calculate_supplier_metrics" as any, {
          p_wholesaler_id: r.id, p_days: days,
        });
        if (!error) n++;
      }
      return n;
    },
    onSuccess: (n) => {
      toast.success(`Metrics updated for ${n} suppliers`);
      qc.invalidateQueries({ queryKey: ["dd-supplier-performance"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Supplier Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track fulfillment speed and reliability per supplier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as RangeDays)}>
            <TabsList>
              <TabsTrigger value="7">Last 7 Days</TabsTrigger>
              <TabsTrigger value="30">Last 30 Days</TabsTrigger>
              <TabsTrigger value="90">Last 90 Days</TabsTrigger>
              <TabsTrigger value="3650">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => recalc.mutate()} disabled={recalc.isPending} size="sm">
            <RefreshCw className={`w-3 h-3 mr-1 ${recalc.isPending ? "animate-spin" : ""}`} />
            Recalculate All Metrics
          </Button>
        </div>
      </div>

      {/* LEADERBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {leaderboard.map((r, i) => {
          const medal = ["🥇", "🥈", "🥉"][i];
          return (
            <Card key={r.id} className="cursor-pointer hover:border-primary/40 transition" onClick={() => setOpenId(r.id)}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{medal}</span>
                    <span className="truncate max-w-[180px]">{r.name}</span>
                  </span>
                  <Badge className={gradeColor[r.grade] ?? gradeColor.unrated} variant="outline">{r.grade}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row k="Fulfillment rate" v={`${r.fulfillment_rate}%`} />
                <Row k="Orders fulfilled" v={String(r.orders_fulfilled)} />
                <Row k="Avg fulfillment" v={`${r.avg_fulfillment_days.toFixed(1)} days`} />
                <Row k="Revenue" v={`$${r.revenue.toFixed(2)}`} />
              </CardContent>
            </Card>
          );
        })}
        {leaderboard.length === 0 && !isLoading && (
          <Card className="md:col-span-3"><CardContent className="p-6 text-sm text-muted-foreground text-center">
            No supplier activity in this window.
          </CardContent></Card>
        )}
      </div>

      {/* FULL TABLE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> All Suppliers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <Th label="Supplier" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Grade" k="grade" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Orders" k="orders" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Fulfilled" k="fulfilled" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Fulfillment %" k="rate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Avg Days" k="avg_days" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Issues" k="issues" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Revenue" k="revenue" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Last Order" k="last_order" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, idx) => (
                <TableRow
                  key={r.id}
                  className={`cursor-pointer ${rowTint[r.grade] ?? ""}`}
                  onClick={() => setOpenId(r.id)}
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium flex items-center gap-1">
                    {r.preferred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    {r.name}
                  </TableCell>
                  <TableCell><Badge className={gradeColor[r.grade] ?? gradeColor.unrated} variant="outline">{r.grade}</Badge></TableCell>
                  <TableCell>{r.orders_received}</TableCell>
                  <TableCell>{r.orders_fulfilled}</TableCell>
                  <TableCell>{r.fulfillment_rate}%</TableCell>
                  <TableCell>{r.avg_fulfillment_days.toFixed(1)}</TableCell>
                  <TableCell>{r.issue_count}</TableCell>
                  <TableCell>${r.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.last_order_at ? new Date(r.last_order_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!sorted.length && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                  {isLoading ? "Loading…" : "No suppliers."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ALERTS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Suppliers Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-sm text-emerald-600">✅ All suppliers performing well</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map(a => {
                const reasons: string[] = [];
                if (a.fulfillment_rate < 70) reasons.push(`Low fulfillment rate (${a.fulfillment_rate}%)`);
                if (a.avg_fulfillment_days > 5) reasons.push(`Slow fulfillment (${a.avg_fulfillment_days.toFixed(1)} days)`);
                if (a.issue_count > 3) reasons.push(`${a.issue_count} issues reported`);
                return (
                  <Card key={a.id} className="border-red-500/40">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{reasons.join(" • ")}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)}>View</Button>
                        {a.email && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`mailto:${a.email}`}><Mail className="w-3 h-3" /></a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DetailSheet
        supplier={rows.find(r => r.id === openId) ?? null}
        days={days}
        flagText={flagText}
        setFlagText={setFlagText}
        onClose={() => { setOpenId(null); setFlagText(""); }}
        onChanged={() => qc.invalidateQueries({ queryKey: ["dd-supplier-performance"] })}
      />
    </div>
  );
}

/* ─── Helpers ─── */

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Th({
  label, k, sortKey, sortDir, onSort,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button onClick={() => onSort(k)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <ChevronsUpDown className={`w-3 h-3 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
        {active && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}

function DetailSheet({
  supplier, days, flagText, setFlagText, onClose, onChanged,
}: {
  supplier: SupplierRow | null;
  days: number;
  flagText: string;
  setFlagText: (s: string) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const open = !!supplier;

  const { data: trend = [] } = useQuery({
    queryKey: ["dd-supplier-trend", supplier?.id, days],
    enabled: open && !!supplier,
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
      const { data } = await supabase
        .from("dd_grabba_sync" as any)
        .select("created_at,status")
        .eq("wholesaler_id", supplier!.id)
        .gte("created_at", sinceIso);
      const byDay = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        if (r.status !== "fulfilled") return;
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        byDay.set(d, (byDay.get(d) ?? 0) + 1);
      });
      const out: { date: string; fulfilled: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        out.push({ date: d.slice(5), fulfilled: byDay.get(d) ?? 0 });
      }
      return out;
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["dd-supplier-recent", supplier?.id],
    enabled: open && !!supplier,
    queryFn: async () => {
      const { data: syncs } = await supabase
        .from("dd_grabba_sync" as any)
        .select("marketplace_order_id,status,synced_at,created_at")
        .eq("wholesaler_id", supplier!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      const ids = (syncs ?? []).map((s: any) => s.marketplace_order_id).filter(Boolean);
      const orders = ids.length
        ? (await supabase.from("marketplace_orders").select("id,total,fulfillment_status").in("id", ids)).data ?? []
        : [];
      const m = new Map<string, any>();
      orders.forEach((o: any) => m.set(o.id, o));
      return (syncs ?? []).map((s: any) => ({ ...s, order: m.get(s.marketplace_order_id) }));
    },
  });

  const { data: activeProducts = 0 } = useQuery({
    queryKey: ["dd-supplier-products", supplier?.id],
    enabled: open && !!supplier,
    queryFn: async () => {
      const { count } = await supabase
        .from("products_all")
        .select("id", { count: "exact", head: true })
        .eq("wholesaler_id", supplier!.id);
      return count ?? 0;
    },
  });

  const markPreferred = useMutation({
    mutationFn: async () => {
      if (!supplier) return;
      const { error } = await supabase
        .from("wholesalers").update({ preferred: !supplier.preferred } as any).eq("id", supplier.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveFlag = useMutation({
    mutationFn: async () => {
      if (!supplier) return;
      const { error } = await supabase
        .from("wholesalers").update({ review_notes: flagText } as any).eq("id", supplier.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Flag saved"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Contact preferences (whatsapp + preferred_contact) — fetched separately so SupplierRow stays slim.
  const { data: contactInfo, refetch: refetchContact } = useQuery({
    queryKey: ["dd-supplier-contact", supplier?.id],
    enabled: open && !!supplier,
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesalers")
        .select("whatsapp, preferred_contact")
        .eq("id", supplier!.id)
        .maybeSingle();
      return (data ?? {}) as { whatsapp?: string | null; preferred_contact?: string | null };
    },
  });

  const [waNumber, setWaNumber] = useState("");
  const [waPref, setWaPref] = useState<"email" | "whatsapp" | "both">("email");
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const contactLoaded = useRef<string | null>(null);
  if (supplier && contactInfo && contactLoaded.current !== supplier.id) {
    contactLoaded.current = supplier.id;
    setWaNumber(contactInfo.whatsapp ?? "");
    const p = (contactInfo.preferred_contact ?? "email") as "email" | "whatsapp" | "both";
    setWaPref(["email", "whatsapp", "both"].includes(p) ? p : "email");
  }

  const saveContact = useMutation({
    mutationFn: async () => {
      if (!supplier) return;
      const { error } = await supabase
        .from("wholesalers")
        .update({ whatsapp: waNumber.trim() || null, preferred_contact: waPref } as never)
        .eq("id", supplier.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contact updated"); refetchContact(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const sendWhatsApp = useMutation({
    mutationFn: async () => {
      if (!supplier || !waNumber.trim() || !waMessage.trim()) return;
      const { data, error } = await supabase.functions.invoke("dd-whatsapp-notify", {
        body: { to_whatsapp: waNumber.trim(), message: waMessage, wholesaler_id: supplier.id },
      });
      if (error) throw error;
      if ((data as { success?: boolean } | null)?.success === false) {
        throw new Error((data as { error?: string; warning?: string }).error ?? (data as { warning?: string }).warning ?? "Send failed");
      }
    },
    onSuccess: () => { toast.success("WhatsApp sent"); setWaOpen(false); setWaMessage(""); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });


  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {supplier && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {supplier.preferred && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                {supplier.name}
                <Badge className={gradeColor[supplier.grade] ?? gradeColor.unrated} variant="outline">
                  Grade {supplier.grade}
                </Badge>
              </SheetTitle>
              <div className="text-xs text-muted-foreground">
                {supplier.email ?? "—"} {supplier.phone ? `• ${supplier.phone}` : ""}
              </div>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Fulfillment Trend ({days}d)</CardTitle></CardHeader>
                <CardContent className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="fulfilled" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat k="Orders received" v={String(supplier.orders_received)} />
                <Stat k="Orders fulfilled" v={String(supplier.orders_fulfilled)} />
                <Stat k="Fulfillment rate" v={`${supplier.fulfillment_rate}%`} />
                <Stat k="Avg fulfillment" v={`${supplier.avg_fulfillment_days.toFixed(1)} days`} />
                <Stat k="Issues reported" v={String(supplier.issue_count)} />
                <Stat k="Revenue generated" v={`$${supplier.revenue.toFixed(2)}`} />
                <Stat k="Active products" v={String(activeProducts)} />
                <Stat k="Last order" v={supplier.last_order_at ? new Date(supplier.last_order_at).toLocaleDateString() : "—"} />
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Orders</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Synced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((r: any, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.marketplace_order_id?.slice(0, 8) ?? "—"}</TableCell>
                          <TableCell>${Number(r.order?.total ?? 0).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.synced_at ? new Date(r.synced_at).toLocaleString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!recent.length && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No orders.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => markPreferred.mutate()} disabled={markPreferred.isPending}>
                  <Star className="w-3 h-3 mr-1" />
                  {supplier.preferred ? "Unmark Preferred" : "Mark as Preferred"}
                </Button>
                {supplier.email && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${supplier.email}`}><Mail className="w-3 h-3 mr-1" /> Contact Supplier</a>
                  </Button>
                )}
                {waNumber && (
                  <Button size="sm" variant="outline" onClick={() => setWaOpen(true)}>
                    <MessageCircle className="w-3 h-3 mr-1" /> Send WhatsApp
                  </Button>
                )}
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="w-3 h-3" /> Contact Preferences
                  <Badge variant="outline" className="ml-1">
                    {waPref === "both" ? "📧💬 Both" : waPref === "whatsapp" ? "💬 WhatsApp" : "📧 Email"}
                  </Badge>
                </CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] uppercase text-muted-foreground">WhatsApp number</label>
                      <Input
                        placeholder="+1 555 123 4567"
                        value={waNumber}
                        onChange={(e) => setWaNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase text-muted-foreground">Preferred contact</label>
                      <Select value={waPref} onValueChange={(v) => setWaPref(v as typeof waPref)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => saveContact.mutate()} disabled={saveContact.isPending}>
                    Save Contact
                  </Button>
                </CardContent>
              </Card>


              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Flag for Review
                </CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Textarea
                    placeholder="Why is this supplier flagged?"
                    value={flagText}
                    onChange={(e) => setFlagText(e.target.value)}
                  />
                  <Button size="sm" variant="outline" onClick={() => saveFlag.mutate()} disabled={!flagText || saveFlag.isPending}>
                    Save Flag Note
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[11px] uppercase text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}
