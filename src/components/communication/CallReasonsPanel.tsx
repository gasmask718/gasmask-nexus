import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLiveCallSessions } from "@/hooks/useLiveCallSessions";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface CallReasonsPanelProps {
  businessId?: string;
}

const REASON_COLORS: Record<string, string> = {
  order: "hsl(var(--primary))",
  complaint: "hsl(var(--destructive))",
  billing: "hsl(45, 100%, 50%)",
  delivery: "hsl(200, 100%, 50%)",
  intro: "hsl(280, 100%, 60%)",
  retention: "hsl(150, 100%, 40%)",
  support: "hsl(30, 100%, 50%)",
  other: "hsl(var(--muted-foreground))",
};

export function CallReasonsPanel({ businessId }: CallReasonsPanelProps) {
  const { callReasons } = useLiveCallSessions(businessId);

  // Aggregate reasons
  const reasonCounts = callReasons.reduce((acc, cr) => {
    const reason = cr.reason.toLowerCase();
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(reasonCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: REASON_COLORS[name] || REASON_COLORS.other,
  }));

  const totalCalls = callReasons.length;

  // Top reasons with percentages
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0,
    }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Call Reasons Distribution</CardTitle>
          <CardDescription>AI-detected reasons for recent calls</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No call reason data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Reasons List */}
      <Card>
        <CardHeader>
          <CardTitle>Top Call Reasons</CardTitle>
          <CardDescription>Most common reasons across {totalCalls} calls</CardDescription>
        </CardHeader>
        <CardContent>
          {topReasons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          ) : (
            <div className="space-y-4">
              {topReasons.map((item) => (
                <div key={item.reason} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{
                          backgroundColor: REASON_COLORS[item.reason] || REASON_COLORS.other,
                        }}
                        className="text-white"
                      >
                        {item.reason.charAt(0).toUpperCase() + item.reason.slice(1)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{item.count} calls</span>
                    </div>
                    <span className="font-medium">{item.percentage}%</span>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Call Reasons */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Recent Call Reasons</CardTitle>
          <CardDescription>Latest AI-detected call reasons</CardDescription>
        </CardHeader>
        <CardContent>
          {callReasons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No call reasons detected yet</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {callReasons.slice(0, 12).map((cr) => (
                <div
                  key={cr.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      style={{
                        backgroundColor: REASON_COLORS[cr.reason.toLowerCase()] || REASON_COLORS.other,
                      }}
                      className="text-white"
                    >
                      {cr.reason}
                    </Badge>
                    {cr.confidence !== null && (
                      <span className="text-xs text-muted-foreground">{cr.confidence}% confidence</span>
                    )}
                  </div>
                  {cr.secondary_reasons && cr.secondary_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cr.secondary_reasons.map((sr, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {sr}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(cr.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
