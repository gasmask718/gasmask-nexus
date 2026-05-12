import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dp, fmtMoney, monthStartISO } from "@/lib/dpClient";
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Bar, BarChart, Legend, CartesianGrid,
} from "recharts";

export default function DPDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dp-admin-dashboard"],
    queryFn: async () => {
      const monthStart = monthStartISO(0);

      const [partnersRes, mrrRes, entryRes, salesRes, splitRes] = await Promise.all([
        dp().from("partners").select("id, tier, status"),
        dp().from("mrr_subscriptions").select("monthly_amount_cents, status").eq("status", "active"),
        dp().from("partners").select("entry_fee_amount, entry_fee_paid_at").gte("entry_fee_paid_at", monthStart),
        dp().from("sales").select("amount_cents, sold_at, commission_pool_cents").gte("sold_at", monthStart),
        dp().from("commission_splits").select("dynasty_share_cents, created_at").gte("created_at", monthStart),
      ]);

      const partners = partnersRes.data ?? [];
      const byTier: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      partners.forEach((p: any) => {
        byTier[p.tier] = (byTier[p.tier] ?? 0) + 1;
        byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      });

      const totalMrr = (mrrRes.data ?? []).reduce((s: number, r: any) => s + (r.monthly_amount_cents ?? 0), 0);
      const newEntry = (entryRes.data ?? []).reduce((s: number, r: any) => s + (r.entry_fee_amount ?? 0), 0);
      const platformSales = (salesRes.data ?? []).reduce((s: number, r: any) => s + (r.amount_cents ?? 0), 0);
      const dynastyNet = (splitRes.data ?? []).reduce((s: number, r: any) => s + (r.dynasty_share_cents ?? 0), 0);

      // 12 month MRR series (from subscriptions created_at)
      const { data: subs } = await dp()
        .from("mrr_subscriptions")
        .select("monthly_amount_cents, current_period_start, status, created_at");

      const months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - (11 - i), 1);
        d.setUTCHours(0, 0, 0, 0);
        return { key: d.toISOString().slice(0, 7), label: d.toLocaleString(undefined, { month: "short" }), mrr: 0 };
      });
      (subs ?? []).forEach((s: any) => {
        const created = new Date(s.created_at);
        months.forEach((m) => {
          if (created <= new Date(m.key + "-28")) {
            m.mrr += (s.status === "active" ? s.monthly_amount_cents : 0) / 100;
          }
        });
      });

      // Revenue source mix (this month)
      const { data: addons } = await dp()
        .from("add_ons").select("amount_cents, purchased_at").gte("purchased_at", monthStart);
      const sources = [
        { name: "Entry", value: newEntry / 100 },
        { name: "MRR", value: totalMrr / 100 },
        { name: "Add-ons", value: ((addons ?? []) as any[]).reduce((s, r) => s + (r.amount_cents ?? 0), 0) / 100 },
        { name: "Commission", value: dynastyNet / 100 },
      ];

      return {
        totalPartners: partners.length,
        activePartners: byStatus["active"] ?? 0,
        byTier, byStatus,
        totalMrr, newEntry, platformSales, dynastyNet,
        months, sources,
      };
    },
  });

  if (isLoading) return <div>Loading…</div>;

  const cards = [
    { label: "Total Partners", value: stats!.totalPartners, sub: `${stats!.activePartners} active` },
    { label: "MRR", value: fmtMoney(stats!.totalMrr), sub: "monthly recurring" },
    { label: "Entry Fees (MTD)", value: fmtMoney(stats!.newEntry), sub: "new this month" },
    { label: "Platform Sales (MTD)", value: fmtMoney(stats!.platformSales), sub: "gross volume" },
    { label: "Dynasty Net (MTD)", value: fmtMoney(stats!.dynastyNet), sub: "commission share" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Operator Dashboard</h2>
        <p className="text-muted-foreground text-sm">Cross-partner overview — David's view.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>MRR — last 12 months</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats!.months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenue mix (this month)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats!.sources}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Partners by tier</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {(["foundation", "equity", "sovereign"] as const).map((t) => (
              <div key={t} className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground uppercase">{t}</div>
                <div className="text-2xl font-bold">{stats!.byTier[t] ?? 0}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
