import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";

interface ScorecardRow {
  id: string;
  period_start: string;
  period_end: string;
  orders_received: number | null;
  orders_fulfilled: number | null;
  fulfillment_rate: number | null;
  avg_fulfillment_hours: number | null;
  revenue_generated: number | null;
}

function gradeFor(rate: number, received: number): string {
  if (!received) return "—";
  if (rate >= 95) return "A";
  if (rate >= 85) return "B";
  if (rate >= 70) return "C";
  if (rate >= 50) return "D";
  return "F";
}

const gradeBadge: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-700",
  B: "bg-blue-500/15 text-blue-700",
  C: "bg-yellow-500/15 text-yellow-700",
  D: "bg-orange-500/15 text-orange-700",
  F: "bg-red-500/15 text-red-700",
};

export function ScorecardHistory({ wholesalerId, supplierName }: { wholesalerId: string; supplierName: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dd-supplier-scorecards", wholesalerId],
    queryFn: async (): Promise<ScorecardRow[]> => {
      const { data, error } = await supabase
        .from("dd_supplier_metrics")
        .select("id, period_start, period_end, orders_received, orders_fulfilled, fulfillment_rate, avg_fulfillment_hours, revenue_generated")
        .eq("wholesaler_id", wholesalerId)
        .order("period_start", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as ScorecardRow[];
    },
  });

  const chartData = [...rows].reverse().map((r) => ({
    week: new Date(r.period_start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    rate: Number(r.fulfillment_rate ?? 0),
  }));
  const avgRate = chartData.length
    ? chartData.reduce((acc, c) => acc + c.rate, 0) / chartData.length
    : 0;
  const lineColor = avgRate > 85 ? "#10b981" : avgRate >= 70 ? "#eab308" : "#ef4444";

  const downloadCsv = () => {
    const header = ["Week", "Orders", "Fulfilled", "Rate %", "Avg Hours", "Revenue", "Grade"];
    const lines = rows.map((r) => {
      const received = Number(r.orders_received ?? 0);
      const rate = Number(r.fulfillment_rate ?? 0);
      return [
        r.period_start,
        received,
        Number(r.orders_fulfilled ?? 0),
        rate.toFixed(1),
        Number(r.avg_fulfillment_hours ?? 0).toFixed(1),
        Number(r.revenue_generated ?? 0).toFixed(2),
        gradeFor(rate, received),
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${supplierName.replace(/[^a-z0-9]/gi, "_")}_scorecards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">📊 Weekly Scorecards</CardTitle>
        <Button size="sm" variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground">No scorecards yet — first report sends Monday at 9am EST.</div>
        ) : (
          <>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" stroke={lineColor} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Week</TableHead>
                    <TableHead className="text-xs">Orders</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs">Avg Hrs</TableHead>
                    <TableHead className="text-xs">Revenue</TableHead>
                    <TableHead className="text-xs">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const received = Number(r.orders_received ?? 0);
                    const rate = Number(r.fulfillment_rate ?? 0);
                    const grade = gradeFor(rate, received);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.period_start).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{received}</TableCell>
                        <TableCell className="text-xs">{rate.toFixed(1)}%</TableCell>
                        <TableCell className="text-xs">{Number(r.avg_fulfillment_hours ?? 0).toFixed(1)}</TableCell>
                        <TableCell className="text-xs">${Number(r.revenue_generated ?? 0).toFixed(0)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge className={gradeBadge[grade] ?? "bg-muted text-muted-foreground"}>{grade}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
