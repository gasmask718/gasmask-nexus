import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  requestAdvisorAdvice,
  runScenarioSimulation,
  getAdvisorSessions,
  getAdvisorScenarios,
  getAdvisorActions,
  updateActionStatus,
  getLatestAdvisorSummary,
  getUnifiedContextSummary,
  AdvisorAdviceResponse,
  ScenarioInputs,
  ScenarioResult,
} from '@/services/advisorEngine';

export function useAdvisorAdvice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState<AdvisorAdviceResponse | null>(null);

  const getAdvice = useCallback(async (params: {
    userId?: string;
    question?: string;
    mode?: 'business' | 'personal' | 'mixed';
    timeWindow?: string;
  }) => {
    setIsLoading(true);
    try {
      const result = await requestAdvisorAdvice(params);
      if (result.success && result.advice) {
        setAdvice(result.advice);
        queryClient.invalidateQueries({ queryKey: ['advisor-sessions'] });
        toast({ title: 'Advisor analysis complete' });
      } else {
        toast({ title: 'Advisor error', description: result.error, variant: 'destructive' });
      }
      return result;
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to get advisor advice', variant: 'destructive' });
      return { success: false, error: 'Unknown error' };
    } finally {
      setIsLoading(false);
    }
  }, [queryClient, toast]);

  return { advice, isLoading, getAdvice, setAdvice };
}

export function useScenarioSimulator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSimulating, setIsSimulating] = useState(false);
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);

  const runSimulation = useCallback(async (params: {
    userId?: string;
    scenarioName: string;
    inputs: ScenarioInputs;
  }) => {
    setIsSimulating(true);
    try {
      const result = await runScenarioSimulation(params);
      if (result.success && result.scenario) {
        setScenario(result.scenario);
        queryClient.invalidateQueries({ queryKey: ['advisor-scenarios'] });
        toast({ title: 'Simulation complete' });
      } else {
        toast({ title: 'Simulation error', description: result.error, variant: 'destructive' });
      }
      return result;
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to run simulation', variant: 'destructive' });
      return { success: false, error: 'Unknown error' };
    } finally {
      setIsSimulating(false);
    }
  }, [queryClient, toast]);

  return { scenario, isSimulating, runSimulation, setScenario };
}

export function useAdvisorHistory() {
  const sessionsQuery = useQuery({
    queryKey: ['advisor-sessions'],
    queryFn: () => getAdvisorSessions(20),
  });

  const scenariosQuery = useQuery({
    queryKey: ['advisor-scenarios'],
    queryFn: () => getAdvisorScenarios(20),
  });

  const actionsQuery = useQuery({
    queryKey: ['advisor-actions'],
    queryFn: () => getAdvisorActions(),
  });

  return {
    sessions: sessionsQuery.data || [],
    scenarios: scenariosQuery.data || [],
    actions: actionsQuery.data || [],
    isLoading: sessionsQuery.isLoading || scenariosQuery.isLoading || actionsQuery.isLoading,
    refetch: () => {
      sessionsQuery.refetch();
      scenariosQuery.refetch();
      actionsQuery.refetch();
    },
  };
}

export function useAdvisorActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateActionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisor-actions'] });
      toast({ title: 'Action updated' });
    },
  });

  return {
    updateStatus: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

export function useLatestAdvisorSummary() {
  return useQuery({
    queryKey: ['advisor-latest-summary'],
    queryFn: getLatestAdvisorSummary,
    refetchInterval: 300000, // 5 minutes
  });
}

export function useUnifiedContext(userId?: string) {
  return useQuery({
    queryKey: ['unified-context', userId],
    queryFn: () => getUnifiedContextSummary(userId),
    refetchInterval: 60000,
  });
}
