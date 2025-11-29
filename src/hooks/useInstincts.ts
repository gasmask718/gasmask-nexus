import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  runInstinctScan,
  getTriggers,
  getTriggerStats,
  updateTriggerStatus,
  bulkResolveTriggers,
  getAutopilotSettings,
  updateAutopilotSettings,
  calculateHealthScores,
  AdvisorTrigger,
  AutopilotSettings,
  InstinctStats,
} from '@/services/instinctEngine';

export function useInstinctScan() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  const scan = useCallback(async () => {
    setIsScanning(true);
    try {
      const result = await runInstinctScan();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['triggers'] });
        queryClient.invalidateQueries({ queryKey: ['trigger-stats'] });
        toast({
          title: 'Instinct Scan Complete',
          description: `Detected ${result.triggers_detected} new triggers`,
        });
      } else {
        toast({
          title: 'Scan Failed',
          description: result.error,
          variant: 'destructive',
        });
      }
      return result;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run instinct scan',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsScanning(false);
    }
  }, [queryClient, toast]);

  return { scan, isScanning };
}

export function useTriggers(params?: {
  status?: string;
  severity?: string;
  category?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['triggers', params],
    queryFn: () => getTriggers(params),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useTriggerStats() {
  return useQuery({
    queryKey: ['trigger-stats'],
    queryFn: getTriggerStats,
    refetchInterval: 60000,
  });
}

export function useTriggerActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'processing' | 'resolved' | 'dismissed' }) =>
      updateTriggerStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['trigger-stats'] });
      toast({ title: 'Trigger updated' });
    },
  });

  const bulkResolve = useMutation({
    mutationFn: (ids: string[]) => bulkResolveTriggers(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['trigger-stats'] });
      toast({ title: 'Triggers resolved' });
    },
  });

  return {
    updateStatus: updateStatus.mutate,
    bulkResolve: bulkResolve.mutate,
    isUpdating: updateStatus.isPending || bulkResolve.isPending,
  };
}

export function useAutopilotSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['autopilot-settings'],
    queryFn: getAutopilotSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (settings: Partial<AutopilotSettings>) => updateAutopilotSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot-settings'] });
      toast({ title: 'Autopilot settings updated' });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

export function useHealthScores() {
  return useQuery({
    queryKey: ['health-scores'],
    queryFn: calculateHealthScores,
    refetchInterval: 300000, // 5 minutes
  });
}