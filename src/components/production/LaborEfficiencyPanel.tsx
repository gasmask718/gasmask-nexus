/**
 * Labor Efficiency Analytics Panel — Manager/Owner view
 * KPIs, leaderboard, variance alerts, daily trends
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useOfficeTasks,
  useLaborBaselines,
  computeLaborAnalytics,
  getTaskVarianceLevel,
  TASK_TYPE_LABELS,
  type WorkerTaskType,
} from '@/hooks/useWorkerTaskTimer';
import {
  Timer,
  Trophy,
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Clock,
  Target,
  Activity,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface LaborEfficiencyPanelProps {
  officeId: string;
}

export function LaborEfficiencyPanel({ officeId }: LaborEfficiencyPanelProps) {
  const [days, setDays] = useState('30');
  const fromDate = startOfDay(subDays(new Date(), parseInt(days))).toISOString();
  const toDate = new Date().toISOString();

  const { data: tasks = [], isLoading } = useOfficeTasks(officeId, { from: fromDate, to: toDate });
  const { data: baselines = [] } = useLaborBaselines(officeId);

  const analytics = useMemo(() => computeLaborAnalytics(tasks), [tasks]);

  const getBaseline = (type: string) => {
    const b = baselines.find(bl => bl.task_type === type && (bl.office_id === officeId || !bl.office_id));
    return b?.baseline_minutes_per_1000;
  };

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const byDay: Record<string, { total: number; count: number }> = {};
    for (const t of tasks) {
      if (t.status !== 'completed' || !t.duration_seconds) continue;
      const day = format(new Date(t.started_at), 'MM/dd');
      if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
      byDay[day].total += t.duration_seconds / 60;
      byDay[day].count++;
    }
    return Object.entries(byDay)
      .map(([day, d]) => ({ day, avg: d.total / d.count, count: d.count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [tasks]);

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
          <h3 className="text-lg font-semibold">Labor Efficiency</h3>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="14">Last 14 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {analytics ? (
        <>
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
                      <span className="text-sm font-normal text-muted-foreground"> min/1000</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{stat.count} tasks</span>
                      {baseline && (
                        <Badge variant={variance === 'red' ? 'destructive' : variance === 'amber' ? 'secondary' : 'outline'} className="text-[10px]">
                          {variance === 'normal' ? 'On Target' : variance === 'amber' ? '> 15% Slow' : '> 30% Slow'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Boxes</span>
                </div>
                <p className="text-2xl font-bold">{analytics.totalCompleted}</p>
                <p className="text-xs text-muted-foreground">completed tasks</p>
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
          </div>

          {/* Leaderboard */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5" />
                Worker Leaderboard
              </CardTitle>
              <CardDescription>Ranked by average minutes per 1,000 tubes (fastest first)</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="min-w-[500px]">
                  <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
                    <div className="col-span-2">Worker</div>
                    <div className="text-right">Avg Min</div>
                    <div className="text-right">Tasks</div>
                    <div className="text-right">Hours</div>
                    <div className="text-right">Consistency</div>
                  </div>
                  {analytics.workerStats.map((worker, idx) => (
                    <div key={worker.worker_id} className="grid grid-cols-6 gap-2 items-center py-2 border-b border-border/50 last:border-0">
                      <div className="col-span-2 flex items-center gap-2">
                        {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                        {idx === 1 && <Trophy className="h-4 w-4 text-gray-400" />}
                        {idx === 2 && <Trophy className="h-4 w-4 text-amber-700" />}
                        <span className="font-medium text-sm">{worker.worker_name}</span>
                      </div>
                      <div className="text-right font-mono text-sm">{worker.avg_minutes.toFixed(1)}</div>
                      <div className="text-right font-mono text-sm">{worker.count}</div>
                      <div className="text-right font-mono text-sm">{worker.total_hours.toFixed(1)}</div>
                      <div className="text-right">
                        <Badge variant={worker.std_dev < 3 ? 'default' : worker.std_dev < 6 ? 'secondary' : 'outline'} className="text-[10px]">
                          σ {worker.std_dev.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Daily Trend */}
          {dailyTrend.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5" />
                  Daily Avg Minutes per 1,000
                </CardTitle>
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
          )}
        </>
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
