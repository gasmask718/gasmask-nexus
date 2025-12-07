import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart3, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { usePredictiveIntelligence } from "@/hooks/usePredictiveIntelligence";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrendMatrixPanelProps {
  businessId?: string;
}

export function TrendMatrixPanel({ businessId }: TrendMatrixPanelProps) {
  const { trendSnapshots, trendsLoading } = usePredictiveIntelligence(businessId);

  const getTrendIcon = (type: string) => {
    if (type.includes("positive") || type.includes("up")) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (type.includes("negative") || type.includes("down")) {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return <Activity className="h-4 w-4 text-blue-500" />;
  };

  const getTrendBadge = (type: string) => {
    if (type.includes("positive")) {
      return <Badge className="bg-green-500">Positive</Badge>;
    }
    if (type.includes("negative")) {
      return <Badge variant="destructive">Negative</Badge>;
    }
    if (type.includes("volume_up")) {
      return <Badge className="bg-blue-500">Volume Up</Badge>;
    }
    if (type.includes("volume_down")) {
      return <Badge className="bg-yellow-500">Volume Down</Badge>;
    }
    return <Badge variant="secondary">Neutral</Badge>;
  };

  // Mock sentiment wave data for visualization
  const sentimentWaveData = [
    { day: "Mon", positive: 65, negative: 20, neutral: 15 },
    { day: "Tue", positive: 70, negative: 15, neutral: 15 },
    { day: "Wed", positive: 55, negative: 30, neutral: 15 },
    { day: "Thu", positive: 60, negative: 25, neutral: 15 },
    { day: "Fri", positive: 75, negative: 10, neutral: 15 },
    { day: "Sat", positive: 80, negative: 8, neutral: 12 },
    { day: "Sun", positive: 72, negative: 12, neutral: 16 },
  ];

  // Categorize trends
  const positiveTrends = trendSnapshots.filter(t => t.trend_type.includes("positive"));
  const negativeTrends = trendSnapshots.filter(t => t.trend_type.includes("negative"));
  const volumeTrends = trendSnapshots.filter(t => t.trend_type.includes("volume"));

  if (trendsLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ArrowUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Positive Trends</p>
                <p className="text-2xl font-bold text-green-500">{positiveTrends.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <ArrowDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Negative Trends</p>
                <p className="text-2xl font-bold text-destructive">{negativeTrends.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volume Trends</p>
                <p className="text-2xl font-bold text-blue-500">{volumeTrends.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Wave Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sentiment Wave (7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentWaveData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="positive"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e" }}
                  name="Positive"
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: "#ef4444" }}
                  name="Negative"
                />
                <Line
                  type="monotone"
                  dataKey="neutral"
                  stroke="#6b7280"
                  strokeWidth={2}
                  dot={{ fill: "#6b7280" }}
                  name="Neutral"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trend List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Trend Snapshots
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendSnapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No trend data available yet</p>
              <p className="text-sm">AI will detect communication patterns over time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trendSnapshots.slice(0, 10).map((trend) => (
                <div
                  key={trend.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getTrendIcon(trend.trend_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        {getTrendBadge(trend.trend_type)}
                        <span className="text-sm text-muted-foreground">
                          {trend.forecast_period}
                        </span>
                      </div>
                      {trend.trend_summary && (
                        <p className="text-sm mt-1">{trend.trend_summary}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(trend.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
