import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dp, fmtMoney } from "@/lib/dpClient";

export default function DPPlatforms() {
  const { data, isLoading } = useQuery({
    queryKey: ["dp-platform-perf"],
    queryFn: async () => {
      const { data: platforms } = await dp().from("platforms").select("id, name, slug, status, commission_pool_rate");
      const ids = (platforms ?? []).map((p: any) => p.id);

      const [salesRes, ambRes, csRes, campRes] = await Promise.all([
        dp().from("sales").select("platform_id, amount_cents").in("platform_id", ids),
        dp().from("ambassadors").select("platform_id, status").in("platform_id", ids),
        dp().from("commission_splits")
          .select("ambassador_share_cents, partner_share_cents, status, sale_id, sales!inner(platform_id)")
          .eq("status", "paid"),
        dp().from("campaigns").select("platform_id, spent_cents").in("platform_id", ids),
      ]);

      return (platforms ?? []).map((p: any) => {
        const sales = (salesRes.data ?? []).filter((s: any) => s.platform_id === p.id);
        const ambs = (ambRes.data ?? []).filter((a: any) => a.platform_id === p.id);
        const commissions = (csRes.data ?? []).filter((c: any) => c.sales?.platform_id === p.id);
        const camps = (campRes.data ?? []).filter((c: any) => c.platform_id === p.id);
        const totalSales = sales.reduce((s: number, r: any) => s + r.amount_cents, 0);
        const totalCommission = commissions.reduce((s: number, r: any) => s + r.ambassador_share_cents + r.partner_share_cents, 0);
        const totalSpent = camps.reduce((s: number, r: any) => s + (r.spent_cents ?? 0), 0);
        const cac = ambs.length ? Math.round(totalSpent / ambs.length) : 0;
        const roi = totalSpent ? (totalSales / totalSpent) : 0;
        return {
          ...p,
          ambassadorCount: ambs.length,
          activeAmbassadors: ambs.filter((a: any) => a.status === "active").length,
          totalSales, totalCommission, totalSpent, cac, roi,
        };
      }).sort((a, b) => b.totalSales - a.totalSales);
    },
  });

  if (isLoading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Platform Performance</h2>
      <Card>
        <CardHeader><CardTitle>All platforms</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pool %</TableHead>
                <TableHead>Total Sales</TableHead>
                <TableHead>Ambassadors</TableHead>
                <TableHead>Commission paid</TableHead>
                <TableHead>Recruitment spend</TableHead>
                <TableHead>CAC</TableHead>
                <TableHead>ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.slug}</div></TableCell>
                  <TableCell><Badge>{p.status}</Badge></TableCell>
                  <TableCell>{(p.commission_pool_rate * 100).toFixed(0)}%</TableCell>
                  <TableCell className="font-mono">{fmtMoney(p.totalSales)}</TableCell>
                  <TableCell>{p.activeAmbassadors} / {p.ambassadorCount}</TableCell>
                  <TableCell className="font-mono">{fmtMoney(p.totalCommission)}</TableCell>
                  <TableCell className="font-mono">{fmtMoney(p.totalSpent)}</TableCell>
                  <TableCell className="font-mono">{fmtMoney(p.cac)}</TableCell>
                  <TableCell><Badge variant={p.roi >= 3 ? "default" : p.roi >= 1 ? "secondary" : "destructive"}>{p.roi.toFixed(2)}x</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
