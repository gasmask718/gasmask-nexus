import { useOpsTaskAnalytics } from '@/hooks/useOpsTasks';
import {
  useAggregateTimingStats,
  useTaskOutcomeDistribution,
  useSLADriftAnalysis,
} from '@/hooks/useOpsTaskAnalyticsExtended';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle2, Clock, XCircle, AlertCircle, TrendingUp, Timer, BarChart3 } from 'lucide-react';

const outcomeLabels: Record<string, string> = {
  completed_on_time: 'On Time',
  completed_late: 'Late',
  completed_no_deadline: 'No Deadline',
  still_open: 'Still Open',
  cancelled: 'Cancelled',
  stalled: 'Stalled',
};

const outcomeColors: Record<string, string> = {
  completed_on_time: 'bg-green-500',
  completed_late: 'bg-orange-500',
  completed_no_deadline: 'bg-blue-500',
  still_open: 'bg-yellow-500',
  cancelled: 'bg-muted-foreground',
  stalled: 'bg-destructive',
};

const delayLabels: Record<string, string> = {
  before_task_start: 'Before Start',
  during_task_execution: 'During Execution',
  no_delay: 'No Delay',
  external_unknown: 'External / Unknown',
};

export default function OpsTaskAnalyticsPanel() {
  const { data: stats, isLoading: statsLoading } = useOpsTaskAnalytics();
  const { data: timing } = useAggregateTimingStats();
  const { data: outcomes } = useTaskOutcomeDistribution();
  const { data: sla } = useSLADriftAnalysis();

  if (statsLoading || !stats) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Task Analytics
        </h3>
        <Badge variant="outline" className="text-xs">Read-only</Badge>
      </div>

      {/* Status overview */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <MetricCard icon={<ClipboardList className="h-4 w-4 text-blue-500" />} label="Open" value={stats.open} />
        <MetricCard icon={<Clock className="h-4 w-4 text-yellow-500" />} label="In Progress" value={stats.inProgress} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Completed" value={stats.completed} />
        <MetricCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Cancelled" value={stats.cancelled} />
      </div>

      {/* Core metrics */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Completion Rate</p>
            <p className="text-2xl font-bold">{stats.completionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Avg Completion</p>
            <p className="text-2xl font-bold">{stats.avgCompletionHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Tasks</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Timing Stats (Phase 10B) ── */}
      {timing && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4" /> Timing Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <TimingStat label="Avg First Action" value={`${timing.avgTimeToFirstActionHours}h`} />
              <TimingStat label="Avg Completion" value={`${timing.avgTimeToCompletionHours}h`} />
              <TimingStat label="Median Completion" value={`${timing.medianTimeToCompletionHours}h`} />
              <TimingStat label="Avg Overdue" value={`${timing.avgOverdueHours}h`} />
            </div>

            {/* Completion Funnel */}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Completion Funnel</p>
              <div className="flex gap-1 h-6 rounded-md overflow-hidden">
                <FunnelBar
                  value={timing.completionFunnel.completed}
                  total={timing.completionFunnel.total}
                  color="bg-green-500"
                  label="Completed"
                />
                <FunnelBar
                  value={timing.completionFunnel.started - timing.completionFunnel.completed}
                  total={timing.completionFunnel.total}
                  color="bg-yellow-500"
                  label="In Progress"
                />
                <FunnelBar
                  value={timing.completionFunnel.total - timing.completionFunnel.started - timing.completionFunnel.cancelled - timing.completionFunnel.stalled}
                  total={timing.completionFunnel.total}
                  color="bg-blue-500"
                  label="Open"
                />
                <FunnelBar
                  value={timing.completionFunnel.stalled}
                  total={timing.completionFunnel.total}
                  color="bg-destructive"
                  label="Stalled"
                />
                <FunnelBar
                  value={timing.completionFunnel.cancelled}
                  total={timing.completionFunnel.total}
                  color="bg-muted-foreground"
                  label="Cancelled"
                />
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                <FunnelLegend color="bg-green-500" label={`Completed (${timing.completionFunnel.completed})`} />
                <FunnelLegend color="bg-yellow-500" label={`In Progress`} />
                <FunnelLegend color="bg-blue-500" label={`Open`} />
                <FunnelLegend color="bg-destructive" label={`Stalled (${timing.completionFunnel.stalled})`} />
                <FunnelLegend color="bg-muted-foreground" label={`Cancelled (${timing.completionFunnel.cancelled})`} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Outcome Distribution (Phase 10B) ── */}
      {outcomes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Outcome Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {Object.entries(outcomes.outcomeDist).map(([key, count]) => (
                count > 0 && (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${outcomeColors[key] || 'bg-muted'}`} />
                    <span className="text-xs flex-1">{outcomeLabels[key] || key}</span>
                    <span className="text-xs font-mono font-medium">{count}</span>
                  </div>
                )
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Delay Attribution</p>
              <div className="space-y-1">
                {Object.entries(outcomes.delayDist).map(([key, count]) => (
                  count > 0 && (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs flex-1 text-muted-foreground">{delayLabels[key] || key}</span>
                      <span className="text-xs font-mono">{count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SLA Drift (Phase 10B) ── */}
      {sla && sla.totalWithDeadline > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> SLA Drift Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-green-500/10">
                <p className="text-xl font-bold text-green-600">{sla.onTimePercent}%</p>
                <p className="text-[10px] text-muted-foreground">On Time ({sla.onTimeCount})</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-orange-500/10">
                <p className="text-xl font-bold text-orange-600">{sla.latePercent}%</p>
                <p className="text-[10px] text-muted-foreground">Late ({sla.lateCount})</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10">
                <p className="text-xl font-bold text-destructive">{sla.neverCompletedPercent}%</p>
                <p className="text-[10px] text-muted-foreground">Never ({sla.neverCompletedCount})</p>
              </div>
            </div>

            {/* Breakdown by priority */}
            {Object.keys(sla.byPriority).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">By Priority</p>
                <div className="space-y-1">
                  {Object.entries(sla.byPriority).map(([p, counts]) => (
                    <div key={p} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] w-16 justify-center">{p}</Badge>
                      <div className="flex-1 flex gap-1 h-4 rounded overflow-hidden">
                        <SLABar value={counts.onTime} total={counts.onTime + counts.late + counts.never} color="bg-green-500" />
                        <SLABar value={counts.late} total={counts.onTime + counts.late + counts.never} color="bg-orange-500" />
                        <SLABar value={counts.never} total={counts.onTime + counts.late + counts.never} color="bg-destructive" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breakdown by role */}
            {Object.keys(sla.byRole).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">By Role</p>
                <div className="space-y-1">
                  {Object.entries(sla.byRole).map(([role, counts]) => (
                    <div key={role} className="flex items-center gap-2 text-xs">
                      <span className="w-20 truncate text-muted-foreground">{role}</span>
                      <div className="flex-1 flex gap-1 h-4 rounded overflow-hidden">
                        <SLABar value={counts.onTime} total={counts.onTime + counts.late + counts.never} color="bg-green-500" />
                        <SLABar value={counts.late} total={counts.onTime + counts.late + counts.never} color="bg-orange-500" />
                        <SLABar value={counts.never} total={counts.onTime + counts.late + counts.never} color="bg-destructive" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Avg Completion by Role (Phase 10B) ── */}
      {timing && Object.keys(timing.byRole).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Completion Time by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(timing.byRole).map(([role, data]) => (
                <div key={role} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{role}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{data.avgCompletionHours}h</span>
                    <Badge variant="outline" className="text-[10px]">{data.count} tasks</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Avg Completion by Type (Phase 10B) ── */}
      {timing && Object.keys(timing.byTaskType).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Completion Time by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(timing.byTaskType).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{type.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{data.avgCompletionHours}h</span>
                    <Badge variant="outline" className="text-[10px]">{data.count} tasks</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By role (original) */}
      {Object.keys(stats.byRole).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byRole).map(([role, count]) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By priority (original) */}
      {Object.keys(stats.byPriority).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">By Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byPriority).map(([p, count]) => (
                <Badge key={p} variant="outline" className="text-xs">
                  {p}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Governance banner */}
      <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          This analysis is descriptive only. It does not enforce SLAs, evaluate performance, or trigger actions.
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TimingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/50">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function FunnelBar({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  if (value <= 0 || total <= 0) return null;
  const pct = Math.max(2, (value / total) * 100);
  return (
    <div
      className={`${color} relative group`}
      style={{ width: `${pct}%` }}
      title={`${label}: ${value}`}
    />
  );
}

function FunnelLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function SLABar({ value, total, color }: { value: number; total: number; color: string }) {
  if (value <= 0 || total <= 0) return null;
  const pct = Math.max(3, (value / total) * 100);
  return <div className={color} style={{ width: `${pct}%` }} title={`${value}`} />;
}
