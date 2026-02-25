/**
 * Override Audit Panel
 * 
 * 30-day override stats: total overrides, avg deviation %, top managers, trend chart.
 * Gated to admin/manager via useProductionRBAC.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProductionRBAC } from '@/hooks/useProductionRBAC';
import { ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

export function OverrideAuditPanel() {
  const { canApproveSubmissions, isLoading: rbacLoading } = useProductionRBAC();

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ['override-audit-30d'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('production_demand_overrides')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: canApproveSubmissions,
  });

  if (rbacLoading || !canApproveSubmissions) return null;

  const totalOverrides = overrides.length;
  const avgDeviation = totalOverrides > 0
    ? Math.round(overrides.reduce((s, o) => s + (o.deviation_pct || 0), 0) / totalOverrides * 10) / 10
    : 0;
  const highOverrides = overrides.filter((o: any) => o.is_high_override).length;

  // Top managers by override count
  const managerCounts: Record<string, number> = {};
  overrides.forEach((o) => {
    const mgr = o.acknowledged_by || 'Unknown';
    managerCounts[mgr] = (managerCounts[mgr] || 0) + 1;
  });
  const topManagers = Object.entries(managerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Daily trend
  const dailyMap: Record<string, number> = {};
  overrides.forEach((o) => {
    const day = format(new Date(o.created_at!), 'MM/dd');
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  });
  const trendData = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Override Audit (30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{totalOverrides}</p>
            <p className="text-xs text-muted-foreground">Total Overrides</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{avgDeviation}%</p>
            <p className="text-xs text-muted-foreground">Avg Deviation</p>
          </div>
          <div className="text-center p-3 bg-destructive/10 rounded-lg">
            <p className="text-2xl font-bold text-destructive">{highOverrides}</p>
            <p className="text-xs text-muted-foreground">High Overrides (&gt;35%)</p>
          </div>
        </div>

        {/* Trend Chart */}
        {trendData.length > 1 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Override Frequency
            </h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Managers */}
        {topManagers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Users className="h-4 w-4" /> Top Override Managers
            </h4>
            <div className="space-y-1">
              {topManagers.map(([mgr, count]) => (
                <div key={mgr} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{mgr}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      </CardContent>
    </Card>
  );
}
