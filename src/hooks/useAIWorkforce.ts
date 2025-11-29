import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  getAIWorkers,
  getWorkersByDepartment,
  getWorker,
  getAITasks,
  createTask,
  submitCommand,
  runWorkerEngine,
  getWorkforceStats,
  updateTaskStatus,
  deleteTask,
  getTask,
  AIWorker,
  AIWorkTask,
  WorkforceStats,
} from '@/services/aiWorkforceEngine';

export function useAIWorkers() {
  return useQuery({
    queryKey: ['ai-workers'],
    queryFn: getAIWorkers,
    refetchInterval: 30000,
  });
}

export function useWorkersByDepartment(department: string) {
  return useQuery({
    queryKey: ['ai-workers', 'department', department],
    queryFn: () => getWorkersByDepartment(department),
    enabled: !!department,
  });
}

export function useWorker(workerId: string) {
  return useQuery({
    queryKey: ['ai-worker', workerId],
    queryFn: () => getWorker(workerId),
    enabled: !!workerId,
  });
}

export function useAITasks(params?: {
  status?: string;
  workerId?: string;
  priority?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['ai-tasks', params],
    queryFn: () => getAITasks(params),
    refetchInterval: 15000,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['ai-task', taskId],
    queryFn: () => getTask(taskId),
    enabled: !!taskId,
  });
}

export function useWorkforceStats() {
  return useQuery({
    queryKey: ['workforce-stats'],
    queryFn: getWorkforceStats,
    refetchInterval: 30000,
  });
}

export function useCreateTask() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-stats'] });
      toast({ title: 'Task created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSubmitCommand() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (command: string, options?: {
    priority?: 'low' | 'medium' | 'high' | 'critical';
    details?: string;
  }) => {
    setIsSubmitting(true);
    try {
      const result = await submitCommand(command, options);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['workforce-stats'] });
        toast({ title: 'Command submitted to AI workforce' });
      } else {
        toast({ title: 'Failed to submit command', description: result.error, variant: 'destructive' });
      }
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [queryClient, toast]);

  return { submit, isSubmitting };
}

export function useRunWorkerEngine() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(async () => {
    setIsRunning(true);
    try {
      const result = await runWorkerEngine();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['ai-workers'] });
        queryClient.invalidateQueries({ queryKey: ['workforce-stats'] });
        toast({ 
          title: 'Worker engine completed',
          description: `Processed ${result.results?.length || 0} tasks`,
        });
      } else {
        toast({ title: 'Engine run failed', description: result.error, variant: 'destructive' });
      }
      return result;
    } finally {
      setIsRunning(false);
    }
  }, [queryClient, toast]);

  return { run, isRunning };
}

export function useTaskActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated' }) =>
      updateTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-stats'] });
      toast({ title: 'Task updated' });
    },
  });

  const remove = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workforce-stats'] });
      toast({ title: 'Task deleted' });
    },
  });

  return {
    updateStatus: updateStatus.mutate,
    deleteTask: remove.mutate,
    isUpdating: updateStatus.isPending || remove.isPending,
  };
}
