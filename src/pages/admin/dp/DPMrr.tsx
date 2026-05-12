import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dp, fmtMoney, monthStartISO } from "@/lib/dpClient";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function DPMrr() {
  const { data, isLoading } = useQuery({
    queryKey: ["dp-mrr"],
    queryFn: async () => {
      const monthStart = monthStartISO(0);
      const lastMonthStart = monthStartISO(-1);

      const { data: subs } = await dp().from("mrr_subscriptions")
        .select("id, partner_id, monthly_amount_cents, tier, status, created_at, canceled_at");

      const active = (subs ?? []).filter((s: any) => s.status === "active");
      const totalMrr = active.reduce((s: number, r: any) => s + r.monthly_amount_cents, 0);

      const newThis = active.filter((s: any) => s.created_at >= monthStart)
        .reduce((s: number, r: any) => s + r.monthly_amount_cents, 0);

      const churnedThis = (subs ?? []).filter((s: any) => s.canceled_at && s.canceled_at >= monthStart)
        .reduce((s: number, r: any) => s + r.monthly_amount_cents, 0);

      const byTier: Record<string, number> = {};
      active.forEach((s: any) => { byTier[s.tier] = (byTier[s.tier] ?? 0) + s.monthly_amount_cents; });

      // 12 month series
      const months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - (11 - i), 1);
        return { key: d.toISOString().slice(0, 7), label: d.toLocaleString(undefined, { month: "short" }), mrr: 0 };
      });
      (subs ?? []).forEach((s: any) => {
        const created = new Date(s.created_at).getTime();
        const canceled = s.canceled_at ? new Date(s.canceled_at).getTime() : Infinity;
        months.forEach((m) => {
          const mTime = new Date(m.key + "-15").getTime();
          if (created <= mTime && canceled > mTime) m.mrr += s.monthly_amount_cents / 100;
        });
      });

      // At-risk partners: past_due subscriptions OR mrr_active_until expired OR low ambassador production
      const { data: pastDue } = await dp().from("mrr_subscriptions")
        .select("partner_id, monthly_amount_cents, status").in("status", ["past_due","paused"]);
      const partnerIds = (pastDue ?? []).map((p: any) => p.partner_id);
      const { data: partners } = partnerIds.length
        ? await dp().from("partners").select("id, full_name, email, status").in("id", partnerIds)
        : { data: [] };

      return {
        totalMrr, newThis, churnedThis, netNew: newThis - churnedThis,
        byTier, months,
        atRisk: (pastDue ?? []).map((p: any) => ({
          ...p,
          partner: (partners ?? []).find((x: any) => x.id === p.partner_id),
        })),
      };
    },
  });

  if (isLoading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">MRR Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total MRR", value: fmtMoney(data!.totalMrr) },
          { label: "New MRR (MTD)", value: fmtMoney(data!.newThis) },
          { label: "Churned MRR (MTD)", value: fmtMoney(data!.churnedThis) },
          { label: "Net New MRR", value: fmtMoney(data!.netNew) },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>MRR by tier</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Tier</TableHead><TableHead>MRR</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(data!.byTier).map(([t, v]) => (
                  <TableRow key={t}><TableCell><Badge variant="outline">{t}</Badge></TableCell><TableCell className="font-mono">{fmtMoney(v as number)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>MRR over 12 months</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data!.months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" /><YAxis />
                <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>At-risk partners</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Sub status</TableHead><TableHead>MRR</TableHead></TableRow></TableHeader>
            <TableBody>
              {data!.atRisk.map((r: any) => (
                <TableRow key={r.partner_id}>
                  <TableCell>{r.partner?.full_name ?? r.partner_id}</TableCell>
                  <TableCell><Badge variant="destructive">{r.status}</Badge></TableCell>
                  <TableCell className="font-mono">{fmtMoney(r.monthly_amount_cents)}</TableCell>
                </TableRow>
              ))}
              {data!.atRisk.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No at-risk partners</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
