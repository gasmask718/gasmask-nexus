// Dynasty Direct — Analytics
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";
import { BarChart3, ShoppingCart } from "lucide-react";

const RANGES = { "7d": 7, "30d": 30, "90d": 90, all: 3650 } as const;
type RangeKey = keyof typeof RANGES;

export default function DDAnalytics() {
  const [range, setRange] = useState<RangeKey>("30d");
  const qc = useQueryClient();

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - RANGES[range]);
    return d.toISOString();
  }, [range]);

  const { data: orders = [] } = useQuery({
    queryKey: ["dd-analytics-orders", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("id, total, order_type, payment_status, fulfillment_status, created_at, customer_email, wholesaler_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["dd-analytics-items", range],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("marketplace_order_items")
        .select("product_id, wholesaler_id, qty, price_each, order_id, products_all(product_name)")
        .gte("created_at", since);
      return (data || []) as any[];
    },
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ["dd-analytics-products"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products_all")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    },
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ["dd-analytics-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_low_stock_products" as any)
        .select("*")
        .eq("is_low", true)
        .limit(20);
      return (data || []) as any[];
    },
  });

  const { data: wholesalers = [] } = useQuery({
    queryKey: ["dd-analytics-wholesalers"],
    queryFn: async () => {
      const { data } = await supabase.from("wholesalers").select("id, name");
      return data || [];
    },
  });
  const whMap = useMemo(() => Object.fromEntries(wholesalers.map((w) => [w.id, w.name])), [wholesalers]);

  // Abandoned carts (rolling 30d window)
  const abandonedSince = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString(), []);
  const { data: abandoned = [] } = useQuery({
    queryKey: ["dd-abandoned-carts", abandonedSince],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_abandoned_carts" as any)
        .select("*")
        .gte("created_at", abandonedSince)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const abStats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = abandoned.filter((c) => new Date(c.created_at).getTime() >= weekAgo);
    const recovered = abandoned.filter((c) => c.recovered_at);
    const revenue = recovered.reduce((s, c) => s + Number(c.cart_total ?? 0), 0);
    const rate = abandoned.length ? (recovered.length / abandoned.length) * 100 : 0;
    return { thisWeek: thisWeek.length, recovered: recovered.length, rate, revenue };
  }, [abandoned]);

  async function sendManualRecovery(cartId: string) {
    try {
      const { error } = await supabase.functions.invoke("dd-cart-recovery-cron", { body: { cart_id: cartId } });
      if (error) throw error;
      toast.success("Recovery job triggered");
      qc.invalidateQueries({ queryKey: ["dd-abandoned-carts"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const paidOrders = orders.filter((o) => o.payment_status === "paid");

  const stats = useMemo(() => {
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const d2c = paidOrders.filter((o) => o.order_type === "d2c").reduce((s, o) => s + Number(o.total), 0);
    const store = paidOrders.filter((o) => o.order_type === "store").reduce((s, o) => s + Number(o.total), 0);
    const aov = paidOrders.length ? totalRevenue / paidOrders.length : 0;
    return { totalRevenue, d2c, store, count: orders.length, aov };
  }, [orders, paidOrders]);

  const dailyData = useMemo(() => {
    const byDay: Record<string, { date: string; d2c: number; store: number }> = {};
    paidOrders.forEach((o) => {
      const d = o.created_at.slice(0, 10);
      byDay[d] = byDay[d] ?? { date: d, d2c: 0, store: 0 };
      if (o.order_type === "store") byDay[d].store += Number(o.total);
      else byDay[d].d2c += Number(o.total);
    });
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [paidOrders]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const k = o.fulfillment_status ?? "unknown";
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; revenue: number }> = {};
    items.forEach((it) => {
      const name = it.products_all?.product_name ?? "Unknown";
      const key = it.product_id ?? name;
      map[key] = map[key] ?? { name, revenue: 0 };
      map[key].revenue += Number(it.qty) * Number(it.price_each);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [items]);

  const supplierRev = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((it) => {
      const k = it.wholesaler_id ?? "unknown";
      map[k] = (map[k] ?? 0) + Number(it.qty) * Number(it.price_each);
    });
    return Object.entries(map)
      .map(([id, revenue]) => ({ name: whMap[id] ?? id.slice(0, 8), revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [items, whMap]);

  const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444", "#06b6d4"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">📊 Dynasty Direct Analytics</h1>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="30d">30 days</TabsTrigger>
            <TabsTrigger value="90d">90 days</TabsTrigger>
            <TabsTrigger value="all">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total Revenue" value={`$${stats.totalRevenue.toFixed(0)}`} />
        <Stat label="D2C" value={`$${stats.d2c.toFixed(0)}`} />
        <Stat label="Store" value={`$${stats.store.toFixed(0)}`} />
        <Stat label="Orders" value={stats.count} />
        <Stat label="Avg Order" value={`$${stats.aov.toFixed(2)}`} />
        <Stat label="Active Products" value={productCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            {dailyData.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="d2c" stackId="1" stroke="#10b981" fill="#10b981" />
                  <Area type="monotone" dataKey="store" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Orders by Status</CardTitle></CardHeader>
          <CardContent className="h-72">
            {statusData.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Products by Revenue</CardTitle></CardHeader>
          <CardContent className="h-72">
            {topProducts.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Supplier</CardTitle></CardHeader>
          <CardContent className="h-72">
            {supplierRev.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierRev} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Orders</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 20).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link to={`/dynasty-direct/orders/${o.id}`} className="text-primary hover:underline font-mono text-xs">
                        {o.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{o.customer_email ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{o.order_type}</Badge></TableCell>
                    <TableCell className="text-right">${Number(o.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{o.payment_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Low Stock Products</CardTitle></CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <Empty msg="All stocked!" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{p.inventory_qty}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.low_stock_threshold}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Abandoned Carts (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Abandoned This Week" value={abStats.thisWeek} />
            <Stat label="Recovered" value={abStats.recovered} />
            <Stat label="Recovery Rate" value={`${abStats.rate.toFixed(1)}%`} />
            <Stat label="Revenue Recovered" value={`$${abStats.revenue.toFixed(0)}`} />
          </div>
          {abandoned.length === 0 ? (
            <Empty msg="No abandoned carts yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Recovered</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abandoned.slice(0, 25).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.item_count ?? 0}</TableCell>
                    <TableCell className="text-right">${Number(c.cart_total ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{c.recovery_email_sent_at ? <Badge variant="secondary">Sent</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                    <TableCell>{c.recovery_sms_sent_at ? <Badge variant="secondary">Sent</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                    <TableCell>{c.recovered_at ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => sendManualRecovery(c.id)}>
                        Send Recovery
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReferralsAdminSection />
      <DisputesAdminSection />
    </div>
  );
}

function DisputesAdminSection() {
  const { data: disputes = [] } = useQuery({
    queryKey: ["dd-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const open = disputes.filter((d) => !["won", "lost", "charge_refunded"].includes(d.status ?? "")).length;
  const won = disputes.filter((d) => d.status === "won").length;
  const lost = disputes.filter((d) => d.status === "lost").length;
  const totalDisputed = disputes.reduce((acc, d) => acc + Number(d.amount ?? 0), 0);
  const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">🚨 Chargebacks &amp; Disputes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Open" value={open} />
          <Stat label="Won" value={won} />
          <Stat label="Lost" value={lost} />
          <Stat label="Total Disputed" value={`$${totalDisputed.toFixed(2)}`} />
          <Stat label="Win Rate" value={`${winRate.toFixed(0)}%`} />
        </div>
        {disputes.length === 0 ? (
          <Empty msg="No disputes — clean record" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>3DS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due By</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">
                    {d.order_id ? (
                      <a className="underline" href={`/dynasty-direct/orders/${d.order_id}`}>{String(d.order_id).slice(0, 8)}</a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">${Number(d.amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{d.reason ?? "—"}</TableCell>
                  <TableCell>{d.three_ds_authenticated ? <Badge>🛡️</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                  <TableCell><Badge variant={d.status === "won" ? "default" : d.status === "lost" ? "destructive" : "secondary"}>{d.status ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs">{d.evidence_due_by ? new Date(d.evidence_due_by).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {d.stripe_dispute_id && (
                      <a
                        className="text-xs underline"
                        href={`https://dashboard.stripe.com/disputes/${d.stripe_dispute_id}`}
                        target="_blank" rel="noreferrer"
                      >View in Stripe</a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ReferralsAdminSection() {
  const [filter, setFilter] = useState<"all" | "pending" | "qualified" | "rewarded">("all");
  const { data: refs = [] } = useQuery({
    queryKey: ["dd-admin-referrals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_store_referrals" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return (data || []) as any[];
    },
  });

  const visible = refs.filter((r) => r.referred_email !== "link-share@dynastydirect.com");
  const signedUp = visible.filter((r) => ["signed_up", "qualified", "rewarded"].includes(r.status)).length;
  const qualified = visible.filter((r) => ["qualified", "rewarded"].includes(r.status)).length;
  const rewarded = visible.filter((r) => r.status === "rewarded");
  const issued = rewarded.reduce((s, r) => s + Number(r.referrer_credit_amount ?? 50), 0);

  const filtered = filter === "all" ? visible : visible.filter((r) => {
    if (filter === "qualified") return r.status === "qualified" || r.status === "rewarded";
    return r.status === filter;
  });

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      pending: "bg-gray-500/20 text-gray-300 border-gray-500/40",
      signed_up: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      qualified: "bg-green-500/20 text-green-300 border-green-500/40",
      rewarded: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    };
    return <Badge variant="outline" className={cls[s] ?? ""}>{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Store Referrals</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total Sent" value={visible.length} />
          <Stat label="Signed Up" value={signedUp} />
          <Stat label="Qualified" value={qualified} />
          <Stat label="Credits Issued" value={`$${issued.toFixed(0)}`} />
        </div>
        <div className="flex gap-2 border-b">
          {(["all", "pending", "qualified", "rewarded"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 text-xs capitalize border-b-2 ${filter === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <Empty msg="No referrals" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Referred Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signed Up</TableHead>
                <TableHead>First Order</TableHead>
                <TableHead>Rewarded</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">{r.referrer_user_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.referred_email}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-xs">
                    {["signed_up", "qualified", "rewarded"].includes(r.status) ? new Date(r.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.first_order_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.rewarded_at ? new Date(r.rewarded_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "rewarded" ? `$${Number(r.referrer_credit_amount ?? 50).toFixed(0)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}


function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
        <div className="text-lg font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
function Empty({ msg = "No data" }: { msg?: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{msg}</div>;
}
