// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE PROFITABILITY CARD — Read-Only Intelligence Display
// Shows profit scores for completed routes. Never mutates routes or payouts.
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react";

interface RouteProfitabilityCardProps {
  workerId: string;
  workerType: "driver" | "biker";
  /** user_id from profiles (FK target for routes.assigned_to) */
  workerUserId?: string | null;
  limit?: number;
}

interface ProfitMetric {
  id: string;
  route_id: string;
  date: string;
  territory: string | null;
  stop_count: number;
  completed_stops: number;
  net_profit: number;
  profit_per_stop: number | null;
  profit_per_minute: number | null;
  profit_score: number;
  total_revenue: number;
  total_payout: number;
}

const getScoreBadge = (score: number) => {
  if (score >= 70) return { label: "High", className: "bg-green-500/10 text-green-600 border-green-500/20" };
  if (score >= 40) return { label: "Medium", className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" };
  return { label: "Low", className: "bg-red-500/10 text-red-600 border-red-500/20" };
};

const getTrendIcon = (current: number, avg: number) => {
  const diff = current - avg;
  if (diff > 3) return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (diff < -3) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export function RouteProfitabilityCard({
  workerId,
  workerType,
  workerUserId,
  limit = 10,
}: RouteProfitabilityCardProps) {
  const lookupId = workerUserId || workerId;

  const { data: metrics = [] } = useQuery({
    queryKey: ["route-profit-metrics", lookupId, limit],
    queryFn: async () => {
      // Get route IDs for this worker
      const { data: routes } = await supabase
        .from("routes")
        .select("id")
        .eq("assigned_to", lookupId)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(limit);

      if (!routes || routes.length === 0) return [];

      const routeIds = routes.map((r) => r.id);
      const { data, error } = await supabase
        .from("route_profit_metrics")
        .select("*")
        .in("route_id", routeIds)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data || []) as ProfitMetric[];
    },
    enabled: !!lookupId,
  });

  const avgScore = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.profit_score, 0) / metrics.length
    : 0;

  const avgNetProfit = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.net_profit, 0) / metrics.length
    : 0;

  if (metrics.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Route Profitability
          <Badge variant="outline" className="ml-auto">
            Avg: {avgScore.toFixed(0)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{avgScore.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">${avgNetProfit.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Avg Profit</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{metrics.length}</p>
            <p className="text-xs text-muted-foreground">Scored Routes</p>
          </div>
        </div>

        {/* Individual route scores */}
        {metrics.map((m) => {
          const badge = getScoreBadge(m.profit_score);
          return (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getTrendIcon(m.profit_score, avgScore)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {new Date(m.date).toLocaleDateString()}
                    </span>
                    {m.territory && (
                      <span className="text-xs text-muted-foreground">{m.territory}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.completed_stops}/{m.stop_count} stops • ${m.net_profit.toFixed(2)} profit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={badge.className}>{badge.label}</Badge>
                <span className="text-lg font-bold tabular-nums w-10 text-right">
                  {m.profit_score.toFixed(0)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default RouteProfitabilityCard;
