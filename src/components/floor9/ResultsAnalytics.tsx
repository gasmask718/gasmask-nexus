// Floor 9 - Results Analytics Panels
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Brain,
  Clock,
  AlertTriangle,
  Shield,
  Undo2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { AIResultItem, AIResultsMetrics } from '@/hooks/useAIResults';

interface ResultsAnalyticsProps {
  results: AIResultItem[];
  metrics: AIResultsMetrics | null;
  isLoading: boolean;
}

const COLORS = {
  completed: '#22c55e',
  failed: '#ef4444',
  escalated: '#f97316',
  blocked: '#eab308',
  approved: '#3b82f6',
  rejected: '#dc2626',
  modified: '#8b5cf6',
};

export function ResultsAnalytics({ results, metrics, isLoading }: ResultsAnalyticsProps) {
  // Calculate analytics from results
  const confidenceVsOutcome = React.useMemo(() => {
    const buckets: Record<string, { approved: number; rejected: number; total: number }> = {
      '0-40': { approved: 0, rejected: 0, total: 0 },
      '40-60': { approved: 0, rejected: 0, total: 0 },
      '60-80': { approved: 0, rejected: 0, total: 0 },
      '80-100': { approved: 0, rejected: 0, total: 0 },
    };

    results.forEach((r) => {
      const conf = r.confidence_score || 50;
      const bucket = conf < 40 ? '0-40' : conf < 60 ? '40-60' : conf < 80 ? '60-80' : '80-100';
      buckets[bucket].total++;
      if (r.approval_status === 'approved') buckets[bucket].approved++;
      if (r.approval_status === 'rejected') buckets[bucket].rejected++;
    });

    return Object.entries(buckets).map(([range, data]) => ({
      range,
      ...data,
      approvalRate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
    }));
  }, [results]);

  const taskTypeROI = React.useMemo(() => {
    const byType: Record<string, { count: number; timeSaved: number }> = {};
    results.forEach((r) => {
      const type = r.task_type || 'Other';
      if (!byType[type]) byType[type] = { count: 0, timeSaved: 0 };
      byType[type].count++;
      byType[type].timeSaved += r.time_saved_minutes || 0;
    });

    return Object.entries(byType)
      .map(([type, data]) => ({
        type: type.replace(/_/g, ' ').slice(0, 20),
        ...data,
        avgTimeSaved: data.count > 0 ? Math.round(data.timeSaved / data.count) : 0,
      }))
      .sort((a, b) => b.timeSaved - a.timeSaved)
      .slice(0, 8);
  }, [results]);

  const failureReasons = React.useMemo(() => {
    const reasons: Record<string, number> = {};
    results
      .filter((r) => r.status === 'failed' || r.status === 'blocked')
      .forEach((r) => {
        const reason = r.error_message?.slice(0, 50) || 'Unknown error';
        reasons[reason] = (reasons[reason] || 0) + 1;
      });

    return Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [results]);

  const statusDistribution = React.useMemo(() => {
    const dist: Record<string, number> = {};
    results.forEach((r) => {
      dist[r.status] = (dist[r.status] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[name as keyof typeof COLORS] || '#6b7280',
    }));
  }, [results]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="h-64 flex items-center justify-center">
              <div className="animate-pulse bg-muted rounded w-full h-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="h-5 w-5" />
        Analytics & Intelligence
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence vs Outcome */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Confidence vs Outcome
            </CardTitle>
            <CardDescription>
              AI confidence correlation with human approval rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confidenceVsOutcome.every((b) => b.total === 0) ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No confidence data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={confidenceVsOutcome}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Bar dataKey="approved" name="Approved" fill={COLORS.approved} stackId="a" />
                  <Bar dataKey="rejected" name="Rejected" fill={COLORS.rejected} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-4 flex items-center gap-4 text-xs">
              {confidenceVsOutcome.some((b) => b.approvalRate < 50 && b.range.startsWith('80')) && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Overconfidence detected
                </Badge>
              )}
              {confidenceVsOutcome.some((b) => b.approvalRate > 80 && b.range.startsWith('0')) && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Underconfidence detected
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Saved by Task Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Saved by Task Type
            </CardTitle>
            <CardDescription>
              Which tasks deliver real ROI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {taskTypeROI.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No time savings data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={taskTypeROI} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="type" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number) => [`${value} min`, 'Time Saved']}
                  />
                  <Bar dataKey="timeSaved" fill={COLORS.completed} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Failure Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Failure Analysis
            </CardTitle>
            <CardDescription>
              Top failure reasons and patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {failureReasons.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-muted-foreground">No failures in this period</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {failureReasons.map((reason, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 font-medium text-sm">
                      {reason.count}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{reason.reason}</p>
                      <Progress 
                        value={(reason.count / failureReasons[0].count) * 100} 
                        className="h-1.5 mt-1" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trust Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Trust Health
            </CardTitle>
            <CardDescription>
              System safety indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{metrics?.humanAcceptanceRate || 0}%</div>
                <p className="text-xs text-muted-foreground">Human Acceptance</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{metrics?.avgConfidence || 0}%</div>
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className={`text-2xl font-bold ${(metrics?.activeKillSwitches || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics?.activeKillSwitches || 0}
                </div>
                <p className="text-xs text-muted-foreground">Active Kill Switches</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{metrics?.rolledBackTasks || 0}</div>
                <p className="text-xs text-muted-foreground">Rollbacks</p>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Status Distribution</p>
              <div className="flex gap-2 flex-wrap">
                {statusDistribution.map((s) => (
                  <Badge 
                    key={s.name} 
                    style={{ backgroundColor: `${s.color}20`, color: s.color }}
                  >
                    {s.name}: {s.value}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
