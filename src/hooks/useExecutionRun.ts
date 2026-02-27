import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export type SpeedPreset = 'safe' | 'fast' | 'ai_burst';

interface StartRunParams {
  storeIds: string[];
  mode: 'human' | 'ai' | 'hybrid';
  voiceEngine: string;
  speedPreset: SpeedPreset;
}

interface RunProgress {
  id: string;
  status: string;
  total_targets: number;
  callable_targets: number;
  queued_targets: number;
  completed_targets: number;
  failed_targets: number;
  concurrency_limit: number;
  batch_size: number;
}

export function useExecutionRun() {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Poll active run progress
  const { data: runProgress } = useQuery({
    queryKey: ['execution-run-progress', activeRunId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('follow_up_execution_runs')
        .select('*')
        .eq('id', activeRunId!)
        .single();
      if (error) throw error;
      return data as RunProgress;
    },
    enabled: !!activeRunId,
    refetchInterval: 2000,
  });

  // Auto-trigger worker when run is active
  useEffect(() => {
    if (!activeRunId || !runProgress) return;
    if (runProgress.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        await supabase.functions.invoke('followup-execution-worker', {
          body: { run_id: activeRunId },
        });
        queryClient.invalidateQueries({ queryKey: ['execution-run-progress', activeRunId] });
      } catch (e) {
        console.error('Worker tick failed', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeRunId, runProgress?.status, queryClient]);

  // Clear run when completed
  useEffect(() => {
    if (runProgress?.status === 'completed') {
      toast.success(`Execution run completed: ${runProgress.queued_targets} queued, ${runProgress.failed_targets} failed`);
    }
  }, [runProgress?.status]);

  const startRun = useCallback(async (params: StartRunParams) => {
    if (!bizId) { toast.error('No business selected'); return; }
    setIsStarting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('start-followup-execution-run', {
        body: {
          store_ids: params.storeIds,
          voice_engine: params.voiceEngine,
          mode: params.mode,
          speed_preset: params.speedPreset,
          business_id: bizId,
          user_id: userData?.user?.id,
        },
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result.error) throw new Error(result.error);
      setActiveRunId(result.run_id);
      toast.success(`Execution run started: ${result.callable_targets} callable / ${result.total_targets} total`);
    } catch (err: any) {
      toast.error(`Failed to start run: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsStarting(false);
    }
  }, [bizId]);

  const pauseRun = useCallback(async () => {
    if (!activeRunId) return;
    await (supabase as any).from('follow_up_execution_runs').update({ status: 'paused' }).eq('id', activeRunId);
    queryClient.invalidateQueries({ queryKey: ['execution-run-progress', activeRunId] });
    toast.info('Run paused');
  }, [activeRunId, queryClient]);

  const resumeRun = useCallback(async () => {
    if (!activeRunId) return;
    await (supabase as any).from('follow_up_execution_runs').update({ status: 'running' }).eq('id', activeRunId);
    queryClient.invalidateQueries({ queryKey: ['execution-run-progress', activeRunId] });
    toast.info('Run resumed');
  }, [activeRunId, queryClient]);

  const cancelRun = useCallback(async () => {
    if (!activeRunId) return;
    await (supabase as any).from('follow_up_execution_runs').update({ status: 'cancelled' }).eq('id', activeRunId);
    queryClient.invalidateQueries({ queryKey: ['execution-run-progress', activeRunId] });
    setActiveRunId(null);
    toast.info('Run cancelled');
  }, [activeRunId, queryClient]);

  return {
    startRun,
    pauseRun,
    resumeRun,
    cancelRun,
    activeRunId,
    runProgress,
    isStarting,
    isRunning: runProgress?.status === 'running',
    isPaused: runProgress?.status === 'paused',
    isCompleted: runProgress?.status === 'completed' || runProgress?.status === 'cancelled',
  };
}
