import { useTaskTimingMetrics, TaskTimingMetrics } from '@/hooks/useOpsTaskAnalyticsExtended';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, AlertCircle } from 'lucide-react';

const outcomeLabels: Record<string, string> = {
  completed_on_time: 'Completed on time',
  completed_late: 'Completed late',
  completed_no_deadline: 'Completed (no deadline)',
  still_open: 'Still open',
  cancelled: 'Cancelled',
  stalled: 'Stalled (overdue)',
};

const outcomeBadgeColors: Record<string, string> = {
  completed_on_time: 'bg-green-500/10 text-green-600',
  completed_late: 'bg-orange-500/10 text-orange-600',
  completed_no_deadline: 'bg-blue-500/10 text-blue-600',
  still_open: 'bg-yellow-500/10 text-yellow-600',
  cancelled: 'bg-muted text-muted-foreground',
  stalled: 'bg-destructive/10 text-destructive',
};

const delayLabels: Record<string, string> = {
  before_task_start: 'Delay before start',
  during_task_execution: 'Delay during execution',
  no_delay: 'No significant delay',
  external_unknown: 'External / unknown',
};

interface TaskOutcomeSummaryProps {
  taskId: string;
}

export default function TaskOutcomeSummary({ taskId }: TaskOutcomeSummaryProps) {
  const { data: metrics } = useTaskTimingMetrics();

  if (!metrics) return null;

  const task = metrics.find(m => m.taskId === taskId);
  if (!task) return null;

  return (
    <Card className="border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" /> Outcome Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Outcome label */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Outcome:</span>
          <Badge className={outcomeBadgeColors[task.outcomeLabel] || ''} variant="secondary">
            {outcomeLabels[task.outcomeLabel] || task.outcomeLabel}
          </Badge>
        </div>

        {/* Timing stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {task.timeToFirstActionMs !== null && (
            <div>
              <p className="text-muted-foreground">First action</p>
              <p className="font-mono font-medium">{formatDuration(task.timeToFirstActionMs)}</p>
            </div>
          )}
          {task.timeToCompletionMs !== null && (
            <div>
              <p className="text-muted-foreground">Total completion</p>
              <p className="font-mono font-medium">{formatDuration(task.timeToCompletionMs)}</p>
            </div>
          )}
          {task.overdueMs !== null && task.overdueMs > 0 && (
            <div>
              <p className="text-muted-foreground">Overdue by</p>
              <p className="font-mono font-medium text-destructive">{formatDuration(task.overdueMs)}</p>
            </div>
          )}
          {task.statusChurnCount > 0 && (
            <div>
              <p className="text-muted-foreground">Status changes</p>
              <p className="font-mono font-medium">{task.statusChurnCount}</p>
            </div>
          )}
        </div>

        {/* Delay attribution */}
        {task.delayAttribution !== 'no_delay' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Delay:</span>
            <span className="text-foreground">{delayLabels[task.delayAttribution]}</span>
          </div>
        )}

        <div className="pt-1.5 border-t border-border">
          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5" />
            Descriptive only. Does not enforce SLAs or evaluate performance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
