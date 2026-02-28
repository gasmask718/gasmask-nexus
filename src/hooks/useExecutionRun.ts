import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface FlowState {
  state: 'waiting' | 'flowing' | 'completed' | 'unknown';
  active_calls: number;
  capacity: number;
  available_slots: number;
  remaining_targets: number;
  wave_size: number;
  last_wave_queued?: number;
  last_wave_failed?: number;
  smart_dial?: boolean;
  avg_pickup_probability?: number;
  predicted_connections?: number;
  exploitation_calls?: number;
  exploration_calls?: number;
  learning_rate?: number;
  adaptive_exploration?: boolean;
  exploration_ratio?: number;
  confidence_score?: number;
  exploration_mode?: 'HIGH' | 'BALANCED' | 'PRECISION';
}

interface RunProgress {
  id: string;
  business_id: string;
  status: string;
  total_targets: number;
  callable_targets: number;
  queued_targets: number;
  completed_targets: number;
  failed_targets: number;
  concurrency_limit: number;
  batch_size: number;
  notes: string | null;
}

function parseFlowState(notes: string | null): FlowState {
  if (!notes) return { state: 'unknown', active_calls: 0, capacity: 0, available_slots: 0, remaining_targets: 0, wave_size: 0 };
  try {
    const parsed = JSON.parse(notes);
    return {
      state: parsed.state || 'unknown',
      active_calls: parsed.active_calls || 0,
      capacity: parsed.capacity || 0,
      available_slots: parsed.available_slots || 0,
      remaining_targets: parsed.remaining_targets || 0,
      wave_size: parsed.wave_size || 0,
      last_wave_queued: parsed.last_wave_queued,
      last_wave_failed: parsed.last_wave_failed,
      smart_dial: parsed.smart_dial,
      avg_pickup_probability: parsed.avg_pickup_probability,
      predicted_connections: parsed.predicted_connections,
      exploitation_calls: parsed.exploitation_calls,
      exploration_calls: parsed.exploration_calls,
      learning_rate: parsed.learning_rate,
      adaptive_exploration: parsed.adaptive_exploration,
      exploration_ratio: parsed.exploration_ratio,
      confidence_score: parsed.confidence_score,
      exploration_mode: parsed.exploration_mode,
    };
  } catch {
    // Legacy string notes
    return { state: notes.includes('Waiting') ? 'waiting' : 'unknown', active_calls: 0, capacity: 0, available_slots: 0, remaining_targets: 0, wave_size: 0 };
  }
}

export function useExecutionRun() {
  const { currentBusiness } = useBusiness();
  const bizId = currentBusiness?.id;
  const queryClient = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const workerTickRef = useRef(0);

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

  const flowState = parseFlowState(runProgress?.notes || null);

  // Wave heartbeat — triggers worker every 5s
  useEffect(() => {
    if (!activeRunId || !runProgress) return;
    if (runProgress.status !== 'running') return;

    const interval = setInterval(async () => {
      workerTickRef.current++;
      try {
        await supabase.functions.invoke('followup-execution-worker', {
          body: { run_id: activeRunId },
        });
        queryClient.invalidateQueries({ queryKey: ['execution-run-progress', activeRunId] });
      } catch (e) {
        console.error('Worker wave tick failed', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeRunId, runProgress?.status, queryClient]);

  // Notify on completion
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

  const forceWave = useCallback(async () => {
    if (!activeRunId || !runProgress) return;
    const client = supabase as any;
    await client.from('outbound_call_queue')
      .update({ status: 'failed' })
      .eq('business_id', runProgress.business_id)
      .in('status', ['queued', 'dialing']);
    await supabase.functions.invoke('followup-execution-worker', { body: { run_id: activeRunId } });
    queryClient.invalidateQueries({ queryKey: ['execution-run-progress', activeRunId] });
    toast.info('Forced next wave — cleared stale queue');
  }, [activeRunId, runProgress, queryClient]);

  return {
    startRun,
    pauseRun,
    resumeRun,
    cancelRun,
    forceWave,
    activeRunId,
    runProgress,
    flowState,
    isStarting,
    isRunning: runProgress?.status === 'running',
    isPaused: runProgress?.status === 'paused',
    isCompleted: runProgress?.status === 'completed' || runProgress?.status === 'cancelled',
  };
}
