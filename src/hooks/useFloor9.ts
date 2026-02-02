// Floor 9 - AI Operations Hooks
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  getAIWorkers,
  getWorker,
  updateWorkerStatus,
  getAITasks,
  updateTaskStatus,
  getPlaybooks,
  getPlaybook,
  togglePlaybook,
  getRoutines,
  toggleRoutine,
  getInstinctLogs,
  submitInstinctFeedback,
  getActionQueue,
  resolveActionItem,
  getPerformanceResults,
  getKillSwitchState,
  activateKillSwitch,
  deactivateKillSwitch,
  getWorkforceStats,
  getAIHealthMetrics,
  AIWorker,
  AIWorkTask,
  AIPlaybook,
  AIRoutine,
  AIInstinctLog,
  AIActionQueueItem,
  TaskStatus,
  RiskLevel,
} from '@/services/floor9';

// ============= WORKERS =============

export function useAIWorkers() {
  return useQuery({
    queryKey: ['floor9', 'workers'],
    queryFn: getAIWorkers,
    refetchInterval: 30000,
  });
}

export function useWorker(workerId: string) {
  return useQuery({
    queryKey: ['floor9', 'worker', workerId],
    queryFn: () => getWorker(workerId),
    enabled: !!workerId,
  });
}

export function useUpdateWorkerStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workerId, status }: { workerId: string; status: AIWorker['status'] }) =>
      updateWorkerStatus(workerId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'workers'] });
      toast({ title: 'Worker status updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update worker', description: error.message, variant: 'destructive' });
    },
  });
}

// ============= TASKS =============

export function useFloor9Tasks(params?: {
  status?: TaskStatus;
  workerId?: string;
  priority?: string;
  department?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['floor9', 'tasks', params],
    queryFn: () => getAITasks(params),
    refetchInterval: 15000,
  });
}

export function useUpdateTaskStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      status,
      output,
      errorMessage,
    }: {
      taskId: string;
      status: TaskStatus;
      output?: Record<string, any>;
      errorMessage?: string;
    }) => updateTaskStatus(taskId, status, output, errorMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['floor9', 'stats'] });
      toast({ title: 'Task updated' });
    },
  });
}

// ============= PLAYBOOKS =============

export function usePlaybooks(params?: { domain?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['floor9', 'playbooks', params],
    queryFn: () => getPlaybooks(params),
    refetchInterval: 60000,
  });
}

export function usePlaybook(playbookId: string) {
  return useQuery({
    queryKey: ['floor9', 'playbook', playbookId],
    queryFn: () => getPlaybook(playbookId),
    enabled: !!playbookId,
  });
}

export function useTogglePlaybook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playbookId, isActive }: { playbookId: string; isActive: boolean }) =>
      togglePlaybook(playbookId, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'playbooks'] });
      toast({ title: `Playbook ${isActive ? 'activated' : 'deactivated'}` });
    },
  });
}

// ============= ROUTINES =============

export function useRoutines(params?: { playbookId?: string; active?: boolean }) {
  return useQuery({
    queryKey: ['floor9', 'routines', params],
    queryFn: () => getRoutines(params),
    refetchInterval: 30000,
  });
}

export function useToggleRoutine() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routineId, active }: { routineId: string; active: boolean }) =>
      toggleRoutine(routineId, active),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'routines'] });
      toast({ title: `Routine ${active ? 'activated' : 'paused'}` });
    },
  });
}

// ============= INSTINCT LOG =============

export function useInstinctLogs(params?: {
  workerId?: string;
  taskId?: string;
  feedbackStatus?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['floor9', 'instinct-logs', params],
    queryFn: () => getInstinctLogs(params),
    refetchInterval: 30000,
  });
}

export function useSubmitInstinctFeedback() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      logId,
      feedback,
      status,
    }: {
      logId: string;
      feedback: string;
      status: 'accepted' | 'rejected' | 'modified';
    }) => submitInstinctFeedback(logId, feedback, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'instinct-logs'] });
      toast({ title: 'Feedback submitted' });
    },
  });
}

// ============= ACTION QUEUE =============

export function useActionQueue(params?: {
  status?: string;
  riskLevel?: RiskLevel;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['floor9', 'action-queue', params],
    queryFn: () => getActionQueue(params),
    refetchInterval: 15000,
  });
}

export function useResolveActionItem() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      decision,
      notes,
      userId,
    }: {
      itemId: string;
      decision: 'accepted' | 'rejected' | 'modified';
      notes?: string;
      userId?: string;
    }) => resolveActionItem(itemId, decision, notes, userId),
    onSuccess: (_, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'action-queue'] });
      queryClient.invalidateQueries({ queryKey: ['floor9', 'stats'] });
      toast({ title: `Action ${decision}` });
    },
  });
}

// ============= PERFORMANCE =============

export function usePerformanceResults(params?: {
  workerId?: string;
  playbookId?: string;
  days?: number;
}) {
  return useQuery({
    queryKey: ['floor9', 'performance', params],
    queryFn: () => getPerformanceResults(params),
    refetchInterval: 60000,
  });
}

// ============= KILL SWITCH =============

export function useKillSwitchState() {
  return useQuery({
    queryKey: ['floor9', 'kill-switch'],
    queryFn: getKillSwitchState,
    refetchInterval: 10000,
  });
}

export function useActivateKillSwitch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      reason,
      targetId,
      userId,
    }: {
      scope: 'global' | 'worker' | 'playbook';
      reason: string;
      targetId?: string;
      userId?: string;
    }) => activateKillSwitch(scope, reason, targetId, userId),
    onSuccess: (_, { scope }) => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'kill-switch'] });
      queryClient.invalidateQueries({ queryKey: ['floor9', 'health'] });
      toast({
        title: 'Kill Switch Activated',
        description: `${scope} AI operations paused`,
        variant: 'destructive',
      });
    },
  });
}

export function useDeactivateKillSwitch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ switchId, userId }: { switchId: string; userId?: string }) =>
      deactivateKillSwitch(switchId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'kill-switch'] });
      queryClient.invalidateQueries({ queryKey: ['floor9', 'health'] });
      toast({ title: 'Kill Switch Deactivated' });
    },
  });
}

// ============= STATS & HEALTH =============

export function useWorkforceStats() {
  return useQuery({
    queryKey: ['floor9', 'stats'],
    queryFn: getWorkforceStats,
    refetchInterval: 15000,
  });
}

export function useAIHealthMetrics() {
  return useQuery({
    queryKey: ['floor9', 'health'],
    queryFn: getAIHealthMetrics,
    refetchInterval: 10000,
  });
}
