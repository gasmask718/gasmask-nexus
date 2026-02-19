import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Timing metrics per task ──
export interface TaskTimingMetrics {
  taskId: string;
  title: string;
  taskType: string;
  priority: string;
  expectedRole: string | null;
  status: string;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
  // Derived timing (ms)
  timeToFirstActionMs: number | null;
  timeToCompletionMs: number | null;
  overdueMs: number | null;
  statusChurnCount: number;
  // Descriptive outcome label
  outcomeLabel: TaskOutcomeLabel;
  // Delay attribution
  delayAttribution: DelayAttribution;
}

export type TaskOutcomeLabel =
  | 'completed_on_time'
  | 'completed_late'
  | 'completed_no_deadline'
  | 'still_open'
  | 'cancelled'
  | 'stalled';

export type DelayAttribution =
  | 'before_task_start'
  | 'during_task_execution'
  | 'no_delay'
  | 'external_unknown';

// ── SLA drift breakdown ──
export interface SLADriftStats {
  totalWithDeadline: number;
  onTimeCount: number;
  lateCount: number;
  neverCompletedCount: number;
  onTimePercent: number;
  latePercent: number;
  neverCompletedPercent: number;
  byTaskType: Record<string, { onTime: number; late: number; never: number }>;
  byPriority: Record<string, { onTime: number; late: number; never: number }>;
  byRole: Record<string, { onTime: number; late: number; never: number }>;
}

// ── Aggregate timing stats ──
export interface AggregateTimingStats {
  avgTimeToFirstActionHours: number;
  avgTimeToCompletionHours: number;
  medianTimeToCompletionHours: number;
  avgOverdueHours: number;
  avgChurnCount: number;
  completionFunnel: {
    total: number;
    started: number;
    completed: number;
    cancelled: number;
    stalled: number;
  };
  byRole: Record<string, { avgCompletionHours: number; count: number }>;
  byTaskType: Record<string, { avgCompletionHours: number; count: number }>;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function msToHours(ms: number): number {
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

function classifyOutcome(task: any): TaskOutcomeLabel {
  if (task.status === 'cancelled') return 'cancelled';
  if (task.status === 'completed') {
    if (!task.due_at) return 'completed_no_deadline';
    return new Date(task.completed_at!) <= new Date(task.due_at) ? 'completed_on_time' : 'completed_late';
  }
  if (task.status === 'open' || task.status === 'in_progress') {
    if (task.due_at && new Date() > new Date(task.due_at)) return 'stalled';
    return 'still_open';
  }
  return 'still_open';
}

function classifyDelay(
  firstEventMs: number | null,
  completionMs: number | null,
  totalMs: number | null
): DelayAttribution {
  if (!totalMs || totalMs < 3600000) return 'no_delay'; // < 1h
  if (firstEventMs && firstEventMs > (totalMs * 0.6)) return 'before_task_start';
  if (completionMs && firstEventMs && (completionMs - firstEventMs) > (totalMs * 0.6)) return 'during_task_execution';
  return 'external_unknown';
}

/** Detailed per-task timing metrics */
export function useTaskTimingMetrics() {
  return useQuery({
    queryKey: ['ops-task-timing-metrics'],
    queryFn: async () => {
      // Fetch tasks and events in parallel
      const [tasksRes, eventsRes] = await Promise.all([
        supabase.from('ops_tasks').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('ops_task_events').select('*').order('created_at', { ascending: true }).limit(2000),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const tasks = tasksRes.data || [];
      const events = eventsRes.data || [];

      // Group events by task_id
      const eventsByTask: Record<string, any[]> = {};
      events.forEach(e => {
        if (!eventsByTask[e.task_id]) eventsByTask[e.task_id] = [];
        eventsByTask[e.task_id].push(e);
      });

      const metrics: TaskTimingMetrics[] = tasks.map(t => {
        const taskEvents = eventsByTask[t.id] || [];
        const createdMs = new Date(t.created_at).getTime();

        // Time to first action
        const firstStatusChange = taskEvents.find(e => e.event_type === 'status_changed');
        const timeToFirstActionMs = firstStatusChange
          ? new Date(firstStatusChange.created_at).getTime() - createdMs
          : null;

        // Time to completion
        const timeToCompletionMs = t.completed_at
          ? new Date(t.completed_at).getTime() - createdMs
          : null;

        // Overdue
        const overdueMs = t.due_at && t.status !== 'completed' && t.status !== 'cancelled'
          ? Math.max(0, Date.now() - new Date(t.due_at).getTime())
          : t.due_at && t.completed_at && new Date(t.completed_at) > new Date(t.due_at)
            ? new Date(t.completed_at).getTime() - new Date(t.due_at).getTime()
            : null;

        // Status churn
        const statusChurnCount = taskEvents.filter(e => e.event_type === 'status_changed').length;

        const totalTimeMs = t.completed_at ? timeToCompletionMs : (Date.now() - createdMs);

        return {
          taskId: t.id,
          title: t.title,
          taskType: t.task_type,
          priority: t.priority,
          expectedRole: t.expected_role,
          status: t.status,
          createdAt: t.created_at,
          dueAt: t.due_at,
          completedAt: t.completed_at,
          timeToFirstActionMs,
          timeToCompletionMs,
          overdueMs,
          statusChurnCount,
          outcomeLabel: classifyOutcome(t),
          delayAttribution: classifyDelay(timeToFirstActionMs, timeToCompletionMs, totalTimeMs),
        };
      });

      return metrics;
    },
    staleTime: 60_000,
  });
}

/** SLA drift analysis for tasks with due dates */
export function useSLADriftAnalysis() {
  return useQuery({
    queryKey: ['ops-task-sla-drift'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('ops_tasks')
        .select('status, priority, expected_role, task_type, due_at, completed_at')
        .not('due_at', 'is', null)
        .limit(500);

      if (error) throw error;
      if (!tasks || tasks.length === 0) {
        return {
          totalWithDeadline: 0, onTimeCount: 0, lateCount: 0, neverCompletedCount: 0,
          onTimePercent: 0, latePercent: 0, neverCompletedPercent: 0,
          byTaskType: {}, byPriority: {}, byRole: {},
        } as SLADriftStats;
      }

      const total = tasks.length;
      let onTime = 0, late = 0, never = 0;

      const byTaskType: Record<string, { onTime: number; late: number; never: number }> = {};
      const byPriority: Record<string, { onTime: number; late: number; never: number }> = {};
      const byRole: Record<string, { onTime: number; late: number; never: number }> = {};

      const increment = (map: Record<string, any>, key: string, field: 'onTime' | 'late' | 'never') => {
        if (!map[key]) map[key] = { onTime: 0, late: 0, never: 0 };
        map[key][field]++;
      };

      tasks.forEach(t => {
        const role = t.expected_role || 'unassigned';
        let field: 'onTime' | 'late' | 'never';

        if (t.status === 'completed' && t.completed_at) {
          if (new Date(t.completed_at) <= new Date(t.due_at!)) {
            field = 'onTime';
            onTime++;
          } else {
            field = 'late';
            late++;
          }
        } else {
          field = 'never';
          never++;
        }

        increment(byTaskType, t.task_type, field);
        increment(byPriority, t.priority, field);
        increment(byRole, role, field);
      });

      const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

      return {
        totalWithDeadline: total,
        onTimeCount: onTime, lateCount: late, neverCompletedCount: never,
        onTimePercent: pct(onTime), latePercent: pct(late), neverCompletedPercent: pct(never),
        byTaskType, byPriority, byRole,
      } as SLADriftStats;
    },
    staleTime: 60_000,
  });
}

/** Aggregate timing statistics */
export function useAggregateTimingStats() {
  const { data: metrics } = useTaskTimingMetrics();

  return useQuery({
    queryKey: ['ops-task-aggregate-timing', metrics?.length],
    queryFn: async () => {
      if (!metrics || metrics.length === 0) return null;

      const firstActionTimes = metrics.filter(m => m.timeToFirstActionMs !== null).map(m => m.timeToFirstActionMs!);
      const completionTimes = metrics.filter(m => m.timeToCompletionMs !== null).map(m => m.timeToCompletionMs!);
      const overdueTimes = metrics.filter(m => m.overdueMs !== null && m.overdueMs > 0).map(m => m.overdueMs!);

      const started = metrics.filter(m => m.status === 'in_progress' || m.status === 'completed').length;
      const completed = metrics.filter(m => m.status === 'completed').length;
      const cancelled = metrics.filter(m => m.status === 'cancelled').length;
      const stalled = metrics.filter(m => m.outcomeLabel === 'stalled').length;

      // By role
      const byRole: Record<string, { totalMs: number; count: number }> = {};
      metrics.filter(m => m.timeToCompletionMs !== null).forEach(m => {
        const role = m.expectedRole || 'unassigned';
        if (!byRole[role]) byRole[role] = { totalMs: 0, count: 0 };
        byRole[role].totalMs += m.timeToCompletionMs!;
        byRole[role].count++;
      });

      // By type
      const byType: Record<string, { totalMs: number; count: number }> = {};
      metrics.filter(m => m.timeToCompletionMs !== null).forEach(m => {
        if (!byType[m.taskType]) byType[m.taskType] = { totalMs: 0, count: 0 };
        byType[m.taskType].totalMs += m.timeToCompletionMs!;
        byType[m.taskType].count++;
      });

      const roleStats: Record<string, { avgCompletionHours: number; count: number }> = {};
      Object.entries(byRole).forEach(([k, v]) => {
        roleStats[k] = { avgCompletionHours: msToHours(v.totalMs / v.count), count: v.count };
      });

      const typeStats: Record<string, { avgCompletionHours: number; count: number }> = {};
      Object.entries(byType).forEach(([k, v]) => {
        typeStats[k] = { avgCompletionHours: msToHours(v.totalMs / v.count), count: v.count };
      });

      return {
        avgTimeToFirstActionHours: firstActionTimes.length > 0
          ? msToHours(firstActionTimes.reduce((a, b) => a + b, 0) / firstActionTimes.length) : 0,
        avgTimeToCompletionHours: completionTimes.length > 0
          ? msToHours(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) : 0,
        medianTimeToCompletionHours: msToHours(median(completionTimes)),
        avgOverdueHours: overdueTimes.length > 0
          ? msToHours(overdueTimes.reduce((a, b) => a + b, 0) / overdueTimes.length) : 0,
        avgChurnCount: metrics.length > 0
          ? Math.round((metrics.reduce((s, m) => s + m.statusChurnCount, 0) / metrics.length) * 10) / 10 : 0,
        completionFunnel: { total: metrics.length, started, completed, cancelled, stalled },
        byRole: roleStats,
        byTaskType: typeStats,
      } as AggregateTimingStats;
    },
    enabled: !!metrics && metrics.length > 0,
    staleTime: 60_000,
  });
}

/** Outcome distribution for charts */
export function useTaskOutcomeDistribution() {
  const { data: metrics } = useTaskTimingMetrics();

  return useQuery({
    queryKey: ['ops-task-outcome-dist', metrics?.length],
    queryFn: async () => {
      if (!metrics) return null;
      const dist: Record<TaskOutcomeLabel, number> = {
        completed_on_time: 0,
        completed_late: 0,
        completed_no_deadline: 0,
        still_open: 0,
        cancelled: 0,
        stalled: 0,
      };
      metrics.forEach(m => { dist[m.outcomeLabel]++; });

      const delayDist: Record<DelayAttribution, number> = {
        before_task_start: 0,
        during_task_execution: 0,
        no_delay: 0,
        external_unknown: 0,
      };
      metrics.forEach(m => { delayDist[m.delayAttribution]++; });

      return { outcomeDist: dist, delayDist };
    },
    enabled: !!metrics && metrics.length > 0,
    staleTime: 60_000,
  });
}
