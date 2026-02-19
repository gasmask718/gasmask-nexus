import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OpsTask {
  id: string;
  thread_id: string | null;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  expected_role: string | null;
  expected_actor_id: string | null;
  due_at: string | null;
  created_at: string;
  created_by: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
}

export interface OpsTaskEvent {
  id: string;
  task_id: string;
  actor_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
}

/** Fetch tasks visible to current user */
export function useOpsTasks(filter?: { status?: string; priority?: string; role?: string }) {
  return useQuery({
    queryKey: ['ops-tasks', filter],
    queryFn: async () => {
      let query = supabase
        .from('ops_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter?.status) query = query.eq('status', filter.status as any);
      if (filter?.priority) query = query.eq('priority', filter.priority as any);
      if (filter?.role) query = query.eq('expected_role', filter.role);

      const { data, error } = await query;
      if (error) throw error;
      return data as OpsTask[];
    },
    staleTime: 30_000,
  });
}

/** Fetch task for a specific thread */
export function useOpsTaskByThread(threadId: string | undefined) {
  return useQuery({
    queryKey: ['ops-task-by-thread', threadId],
    queryFn: async () => {
      if (!threadId) return null;
      const { data, error } = await supabase
        .from('ops_tasks')
        .select('*')
        .eq('thread_id', threadId)
        .maybeSingle();
      if (error) throw error;
      return data as OpsTask | null;
    },
    enabled: !!threadId,
  });
}

/** Fetch events for a task */
export function useOpsTaskEvents(taskId: string | undefined) {
  return useQuery({
    queryKey: ['ops-task-events', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('ops_task_events')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as OpsTaskEvent[];
    },
    enabled: !!taskId,
  });
}

/** Create a task from a thread (admin only) */
export function useCreateOpsTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      threadId: string;
      title: string;
      description?: string;
      taskType?: string;
      priority?: string;
      expectedRole?: string;
      expectedActorId?: string;
      dueAt?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_ops_task', {
        p_thread_id: params.threadId,
        p_title: params.title,
        p_description: params.description || null,
        p_task_type: (params.taskType || 'other') as any,
        p_priority: (params.priority || 'normal') as any,
        p_expected_role: params.expectedRole || null,
        p_expected_actor_id: params.expectedActorId || null,
        p_due_at: params.dueAt || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ops-tasks'] });
      qc.invalidateQueries({ queryKey: ['ops-task-by-thread', vars.threadId] });
    },
  });
}

/** Update task status */
export function useUpdateOpsTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase.rpc('update_ops_task_status', {
        p_task_id: taskId,
        p_new_status: status as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-tasks'] });
      qc.invalidateQueries({ queryKey: ['ops-task-by-thread'] });
      qc.invalidateQueries({ queryKey: ['ops-task-events'] });
    },
  });
}

/** Analytics: task metrics (read-only) */
export function useOpsTaskAnalytics() {
  return useQuery({
    queryKey: ['ops-task-analytics'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('ops_tasks')
        .select('status, priority, expected_role, created_at, completed_at, task_type')
        .limit(500);
      if (error) throw error;

      const total = tasks?.length || 0;
      const open = tasks?.filter(t => t.status === 'open').length || 0;
      const inProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;
      const completed = tasks?.filter(t => t.status === 'completed').length || 0;
      const cancelled = tasks?.filter(t => t.status === 'cancelled').length || 0;
      const overdue = tasks?.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.completed_at === null).length || 0;

      // Avg completion time
      const completedTasks = tasks?.filter(t => t.status === 'completed' && t.completed_at) || [];
      let avgCompletionMs = 0;
      if (completedTasks.length > 0) {
        const totalMs = completedTasks.reduce((sum, t) => {
          return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime());
        }, 0);
        avgCompletionMs = totalMs / completedTasks.length;
      }

      // By role
      const byRole: Record<string, number> = {};
      tasks?.forEach(t => {
        const role = t.expected_role || 'unassigned';
        byRole[role] = (byRole[role] || 0) + 1;
      });

      // By priority
      const byPriority: Record<string, number> = {};
      tasks?.forEach(t => {
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      });

      // By type
      const byType: Record<string, number> = {};
      tasks?.forEach(t => {
        byType[t.task_type] = (byType[t.task_type] || 0) + 1;
      });

      return {
        total, open, inProgress, completed, cancelled, overdue,
        avgCompletionHours: Math.round(avgCompletionMs / (1000 * 60 * 60) * 10) / 10,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byRole, byPriority, byType,
      };
    },
    staleTime: 60_000,
  });
}
