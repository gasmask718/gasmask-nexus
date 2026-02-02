/**
 * useGovernedTasks - React hook for task governance
 * Provides easy access to task operations for any floor
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FloorId,
  GovernedTask,
  GovernedTaskStatus,
  TaskTemplate,
  getTasksByFloor,
  getAllActiveTasks,
  getTaskById,
  createGovernedTask,
  startTask,
  cancelTask,
  getTaskTemplatesByFloor,
} from '@/services/taskGovernance';

interface UseGovernedTasksOptions {
  floorId?: FloorId;
  status?: GovernedTaskStatus;
  limit?: number;
  refetchInterval?: number;
}

export function useGovernedTasks(options: UseGovernedTasksOptions = {}) {
  const { floorId, status, limit = 50, refetchInterval = 5000 } = options;
  const queryClient = useQueryClient();

  // Fetch tasks for a specific floor
  const tasksQuery = useQuery({
    queryKey: ['governed-tasks', floorId, status],
    queryFn: async () => {
      if (floorId) {
        return getTasksByFloor(floorId, status, limit);
      }
      return getAllActiveTasks();
    },
    refetchInterval,
    enabled: !!floorId || !status,
  });

  // Get task templates for the floor
  const templates = floorId ? getTaskTemplatesByFloor(floorId) : [];

  // Launch a new task
  const launchTask = useMutation({
    mutationFn: async (params: {
      template?: TaskTemplate;
      taskType?: string;
      taskTitle?: string;
      taskDetails?: string;
      totalItems?: number;
      autoStart?: boolean;
    }) => {
      if (!floorId) throw new Error('Floor ID required to launch task');

      const taskId = await createGovernedTask({
        floor_id: floorId,
        task_type: params.template?.task_type || params.taskType || 'general',
        task_title: params.template?.task_title || params.taskTitle || 'New Task',
        task_details: params.template?.description || params.taskDetails,
        total_items: params.totalItems,
      });

      // Auto-start if requested and no approval required
      const shouldAutoStart = params.autoStart !== false && 
        !(params.template?.requires_approval);
      
      if (shouldAutoStart) {
        await startTask(taskId);
      }

      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governed-tasks', floorId] });
      toast.success('Task launched');
    },
    onError: (error: Error) => {
      toast.error('Failed to launch task', { description: error.message });
    },
  });

  // Cancel a task
  const cancelTaskMutation = useMutation({
    mutationFn: async (params: { taskId: string; reason?: string }) => {
      return cancelTask(params.taskId, params.reason);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['governed-tasks', floorId] });
        toast.success('Task cancelled', {
          description: `${result.cancelled_actions} actions cancelled`,
        });
      } else {
        toast.error('Cancellation failed', { description: result.error });
      }
    },
  });

  // Start a queued task
  const startTaskMutation = useMutation({
    mutationFn: startTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governed-tasks', floorId] });
      toast.success('Task started');
    },
  });

  // Refresh tasks
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['governed-tasks', floorId] });
  };

  return {
    // Data
    tasks: tasksQuery.data || [],
    templates,
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,

    // Computed
    activeTasks: (tasksQuery.data || []).filter(t => 
      ['queued', 'running', 'paused_for_approval'].includes(t.status)
    ),
    runningTasks: (tasksQuery.data || []).filter(t => t.status === 'running'),
    completedTasks: (tasksQuery.data || []).filter(t => t.status === 'completed'),
    failedTasks: (tasksQuery.data || []).filter(t => 
      ['failed', 'cancelled'].includes(t.status)
    ),

    // Mutations
    launchTask: launchTask.mutate,
    launchTaskAsync: launchTask.mutateAsync,
    isLaunching: launchTask.isPending,

    cancelTask: cancelTaskMutation.mutate,
    isCancelling: cancelTaskMutation.isPending,

    startTask: startTaskMutation.mutate,
    isStarting: startTaskMutation.isPending,

    // Actions
    refresh,
  };
}

/**
 * useGlobalTasks - Get all active tasks across all floors
 */
export function useGlobalTasks(options: { refetchInterval?: number } = {}) {
  const { refetchInterval = 5000 } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['global-active-tasks'],
    queryFn: getAllActiveTasks,
    refetchInterval,
  });

  // Group by floor
  const tasksByFloor = (query.data || []).reduce((acc, task) => {
    if (!acc[task.floor_id]) acc[task.floor_id] = [];
    acc[task.floor_id].push(task);
    return acc;
  }, {} as Record<FloorId, GovernedTask[]>);

  // Stats
  const stats = {
    total: query.data?.length || 0,
    running: (query.data || []).filter(t => t.status === 'running').length,
    queued: (query.data || []).filter(t => t.status === 'queued').length,
    awaitingApproval: (query.data || []).filter(t => t.status === 'paused_for_approval').length,
  };

  return {
    tasks: query.data || [],
    tasksByFloor,
    stats,
    isLoading: query.isLoading,
    error: query.error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['global-active-tasks'] }),
  };
}

/**
 * useTaskDetails - Get detailed information about a specific task
 */
export function useTaskDetails(taskId: string | null) {
  return useQuery({
    queryKey: ['governed-task', taskId],
    queryFn: () => taskId ? getTaskById(taskId) : null,
    enabled: !!taskId,
    refetchInterval: 3000,
  });
}
