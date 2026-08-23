/**
 * Labor Intelligence Panel — Manager/Owner view
 * Normalized metrics, performance scores, batch labor variance, efficiency trends
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useOfficeTasks,
  useLaborBaselines,
  computeLaborAnalytics,
  getTaskVarianceLevel,
  TASK_TYPE_LABELS,
  type WorkerTaskType,
} from '@/hooks/useWorkerTaskTimer';
import {
  Timer, Trophy, Users, AlertTriangle, BarChart3,
  Clock, Target, Activity, TrendingDown, Gauge, Shield,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface LaborEfficiencyPanelProps {
  officeId: string;
}

export function LaborEfficiencyPanel({ officeId }: LaborEfficiencyPanelProps) {
  const [days, setDays] = useState('30');
  // Memoized: a fresh Date every render made the query key unstable and the
  // panel refetched forever ("Loading labor analytics…" never resolved).
  const fromDate = useMemo(() => startOfDay(subDays(new Date(), parseInt(days))).toISOString(), [days]);
  const toDate = useMemo(() => new Date().toISOString(), [days]);

  const { data: tasks = [], isLoading } = useOfficeTasks(officeId, { from: fromDate, to: toDate });
  const { data: baselines = [] } = useLaborBaselines(officeId);

  const analytics = useMemo(() => computeLaborAnalytics(tasks), [tasks]);

  const getBaseline = (type: string) => {
    const b = baselines.find(bl => bl.task_type === type && (bl.office_id === officeId || !bl.office_id));
    return b?.baseline_minutes_per_1000;
  };

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const byDay: Record<string, { totalNorm: number; count: number; totalUnits: number }> = {};
    for (const t of tasks) {
      if (t.status !== 'completed' || !t.duration_seconds) continue;
      const day = format(new Date(t.started_at), 'MM/dd');
      const units = t.actual_units_completed || 1000;
      const mins = t.duration_seconds / 60;
      const normMin = units > 0 ? (mins / units) * 1000 : mins;
      if (!byDay[day]) byDay[day] = { totalNorm: 0, count: 0, totalUnits: 0 };
      byDay[day].totalNorm += normMin;
      byDay[day].count++;
      byDay[day].totalUnits += units;
    }
    return Object.entries(byDay)
      .map(([day, d]) => ({ day, avg: d.totalNorm / d.count, count: d.count, totalUnits: d.totalUnits }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [tasks]);

  // Efficiency trend slope (simple linear regression)
  const efficiencySlope = useMemo(() => {
    if (dailyTrend.length < 3) return null;
    const n = dailyTrend.length;
    const xs = dailyTrend.map((_, i) => i);
    const ys = dailyTrend.map(d => d.avg);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + Math.pow(x - xMean, 2), 0);
    if (den === 0) return null;
    const slope = num / den;
    const pctChange = yMean > 0 ? (slope * n) / yMean * 100 : 0;
    return { slope, pctChange, declining: pctChange > 10 };
  }, [dailyTrend]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading labor analytics…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Labor Intelligence</h3>
          <Badge variant="outline" className="text-[10px]">
            <Shield className="h-3 w-3 mr-1" />
            Stability Mode
          </Badge>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="14">Last 14 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Efficiency decline alert */}
      {efficiencySlope?.declining && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Office Labor Efficiency Declining</p>
              <p className="text-xs text-muted-foreground">
                Avg min/1000 increased {efficiencySlope.pctChange.toFixed(0)}% over period — investigate staffing or process issues.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics ? (
        <Tabs defaultValue="kpis" className="space-y-4">
          <TabsList className="h-auto flex flex-wrap gap-1">
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          {/* KPI Tab */}
          <TabsContent value="kpis" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {analytics.taskTypeStats.map(stat => {
                const baseline = getBaseline(stat.task_type);
                const variance = getTaskVarianceLevel(stat.avg_minutes, baseline);
                return (
                  <Card key={stat.task_type}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Timer className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {TASK_TYPE_LABELS[stat.task_type as WorkerTaskType] || stat.task_type}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {stat.avg_minutes.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground"> min/1k</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stat.units_per_hour.toFixed(0)} units/hr · {stat.count} tasks
                      </p>
                      {baseline && (
                        <Badge variant={variance === 'red' ? 'destructive' : variance === 'amber' ? 'secondary' : 'outline'} className="text-[10px] mt-1">
                          {variance === 'normal' ? 'On Target' : variance === 'amber' ? '> 15% Slow' : '> 30% Slow'}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Units</span>
                  </div>
                  <p className="text-2xl font-bold">{analytics.totalUnits.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{analytics.totalCompleted} tasks</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Labor Hours</span>
                  </div>
                  <p className="text-2xl font-bold">{analytics.totalHours.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">total hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Efficiency</span>
                  </div>
                  <p className="text-2xl font-bold">{analytics.laborEfficiencyRatio.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">units / labor hr</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5" />
                  Worker Leaderboard
                </CardTitle>
                <CardDescription>
                  Ranked by Performance Score (70% speed + 30% consistency) — lower is better
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="min-w-[600px]">
                    <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
                      <div className="col-span-2">Worker</div>
                      <div className="text-right">Avg Min/1k</div>
                      <div className="text-right">σ</div>
                      <div className="text-right">Score</div>
                      <div className="text-right">Tasks</div>
                      <div className="text-right">Units/Hr</div>
                      <div className="text-right">Status</div>
                    </div>
                    {analytics.workerStats.map((worker, idx) => (
                      <div key={worker.worker_id} className="grid grid-cols-8 gap-2 items-center py-2 border-b border-border/50 last:border-0">
                        <div className="col-span-2 flex items-center gap-2">
                          {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          {idx === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                          {idx === 2 && <Trophy className="h-4 w-4 text-amber-700" />}
                          <span className="font-medium text-sm">{worker.worker_name}</span>
                        </div>
                        <div className="text-right font-mono text-sm">{worker.avg_minutes.toFixed(1)}</div>
                        <div className="text-right font-mono text-sm">{worker.std_dev.toFixed(1)}</div>
                        <div className="text-right font-mono text-sm font-bold">{worker.performance_score.toFixed(1)}</div>
                        <div className="text-right font-mono text-sm">{worker.count}</div>
                        <div className="text-right font-mono text-sm">{worker.units_per_hour.toFixed(0)}</div>
                        <div className="text-right">
                          {worker.inconsistent ? (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              Inconsistent
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Stable</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            {dailyTrend.length > 1 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Daily Avg Min/1,000 (Normalized)
                  </CardTitle>
                  {efficiencySlope && (
                    <CardDescription>
                      Trend: {efficiencySlope.slope > 0 ? '↗' : '↘'} {Math.abs(efficiencySlope.pctChange).toFixed(0)}% over period
                      {efficiencySlope.declining && ' ⚠️'}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-32">
                    {dailyTrend.map((d, i) => {
                      const maxAvg = Math.max(...dailyTrend.map(x => x.avg));
                      const height = maxAvg > 0 ? (d.avg / maxAvg) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] font-mono text-muted-foreground">{d.avg.toFixed(0)}</span>
                          <div
                            className="w-full bg-primary/80 rounded-t-sm min-h-[4px]"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[9px] text-muted-foreground">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Not enough data for trend analysis yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No completed tasks in this period.</p>
            <p className="text-xs mt-1">Workers can start timing tasks from the Task Timer tab.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
