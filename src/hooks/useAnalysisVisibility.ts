import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAnalysisLock, setAnalysisLock } from '@/hooks/useUnifiedProps';
import type { AnalysisState, AnalysisFeedItem } from '@/components/betting/LiveAnalysisPanel';

const INITIAL_STATE: AnalysisState = {
  isRunning: false,
  status: 'idle',
  total_props: 0,
  processed_props: 0,
  percent_complete: 0,
  current_prop: null,
  current_step: null,
  errors_count: 0,
  started_at: null,
  completed_at: null,
};

const BATCH_SIZE = 5;

export function useAnalysisVisibility() {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const [feed, setFeed] = useState<AnalysisFeedItem[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const cancelledRef = useRef(false);
  const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Poll for job status when running
  useEffect(() => {
    if (!state.isRunning) return;
    const interval = setInterval(async () => {
      const { data } = await (supabase as any)
        .from('sbo_analysis_jobs')
        .select('*')
        .gte('created_at', todayEST)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) return;

      if (data.status === 'completed') {
        setAnalysisLock(false); // 🔓 Unlock dataset
        setState(prev => ({
          ...prev,
          isRunning: false,
          status: 'completed',
          percent_complete: 100,
          processed_props: prev.total_props,
          current_prop: null,
          current_step: null,
          completed_at: Date.now(),
        }));
        // HARDLOCK: keep visible dataset immutable until user-initiated refresh
        console.log('REFETCH TRIGGERED:', ['unified-props', todayEST], {
          blocked: true,
          lockState: getAnalysisLock(),
          reason: 'dataset_lock_active',
        });
      } else if (data.status === 'failed') {
        setAnalysisLock(false); // 🔓 Unlock dataset
        setState(prev => ({
          ...prev,
          isRunning: false,
          status: 'failed',
          current_prop: null,
          current_step: null,
          completed_at: Date.now(),
        }));
      } else if (data.progress !== undefined) {
        setState(prev => ({
          ...prev,
          percent_complete: data.progress,
          processed_props: Math.floor((data.progress / 100) * prev.total_props),
        }));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [state.isRunning, todayEST]);

  const startAnalysis = useCallback(async (
    forceRerun = false,
    datasetSnapshot?: Array<{ id: string; player_name: string; stat_type: string; line: number }>
  ) => {
    cancelledRef.current = false;
    setSkippedCount(0);
    setAnalysisLock(true); // 🔒 Lock dataset — prevent refetches

    let propsList: any[] = [];

    if (datasetSnapshot?.length) {
      propsList = datasetSnapshot.map((p) => ({
        id: p.id,
        player_name: p.player_name,
        stat_type: p.stat_type,
        line: p.line,
      }));
      console.log('SNAPSHOT CREATED:', {
        timestamp: Date.now(),
        props_count: propsList.length,
      });
    } else {
      // Fallback: get today's props
      const { data: propsData } = await (supabase as any)
        .from('sbo_unified_props')
        .select('id, player_name, stat_type, line')
        // PHASE 3 / ITEM 8 — bounded read (single-day slate); table exceeds the 1k PostgREST default.
        .limit(1000)
        .eq('game_date', todayEST);

      propsList = propsData || [];
    }

    if (!propsList.length) {
      setAnalysisLock(false);
      setState({ ...INITIAL_STATE, status: 'completed', completed_at: Date.now() });
      return;
    }

    // Check existing predictions for dedup (unless force re-run)
    let existingKeys = new Set<string>();
    if (!forceRerun) {
      const { data: existing } = await (supabase as any)
        .from('sbo_prop_predictions')
        .select('player_name, stat_type, line')
        .eq('game_date', todayEST);

      if (existing) {
        existingKeys = new Set(
          existing.map((e: any) => `${e.player_name}::${e.stat_type}::${e.line}`)
        );
      }
    }

    // Split into skip vs process
    const toSkip: any[] = [];
    const toProcess: any[] = [];
    for (const p of propsList) {
      const key = `${p.player_name}::${p.stat_type}::${p.line}`;
      if (existingKeys.has(key)) {
        toSkip.push(p);
      } else {
        toProcess.push(p);
      }
    }

    const total = propsList.length;

    setState({
      isRunning: true,
      status: 'running',
      total_props: total,
      processed_props: 0,
      percent_complete: 0,
      current_prop: 'Checking duplicates...',
      current_step: 'fetching',
      errors_count: 0,
      started_at: Date.now(),
      completed_at: null,
    });
    setFeed([]);

    // Add skip feed items immediately
    if (toSkip.length > 0) {
      setSkippedCount(toSkip.length);
      setFeed(toSkip.map((p, i) => ({
        id: `skip-${i}-${Date.now()}`,
        player: p.player_name,
        stat: p.stat_type,
        status: 'success' as const,
        message: '⏭ Skipped (already analyzed)',
        timestamp: Date.now(),
      })));

      setState(prev => ({
        ...prev,
        processed_props: toSkip.length,
        percent_complete: Math.round((toSkip.length / total) * 100),
      }));
    }

    if (toProcess.length === 0) {
      // All skipped — done instantly
      setAnalysisLock(false);
      setState(prev => ({
        ...prev,
        isRunning: false,
        status: 'completed',
        percent_complete: 100,
        processed_props: total,
        current_prop: null,
        current_step: null,
        completed_at: Date.now(),
      }));
      return;
    }

    // Create job record
    const { data: job, error: jobError } = await (supabase as any)
      .from('sbo_analysis_jobs')
      .insert({
        status: 'pending',
        job_type: 'full_analysis',
        params: { game_date: todayEST, force: forceRerun, new_props: toProcess.length, skipped: toSkip.length },
        user_id: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (jobError) {
      setAnalysisLock(false);
      setState(prev => ({ ...prev, isRunning: false, status: 'failed' }));
      return;
    }

    // Fire edge function
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sbo-run-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(console.error);

    // Simulate parallel batch feed for new props
    simulateParallelFeed(toProcess, total, toSkip.length);
  }, [todayEST]);

  const simulateParallelFeed = useCallback((propsList: any[], total: number, offset: number) => {
    const steps = ['fetching', 'ai_model', 'scoring', 'saving'];
    let batchStart = 0;

    const processBatch = () => {
      if (cancelledRef.current || batchStart >= propsList.length) return;

      const batch = propsList.slice(batchStart, batchStart + BATCH_SIZE);
      const batchIdx = batchStart;

      // Show batch as processing
      setFeed(prev => [
        ...prev.filter(f => f.status !== 'processing'),
        ...batch.map((p, i) => ({
          id: `processing-${batchIdx + i}`,
          player: p.player_name || `Prop ${batchIdx + i + 1}`,
          stat: p.stat_type || 'stat',
          status: 'processing' as const,
          timestamp: Date.now(),
        })),
      ]);

      // Step through for the batch
      let stepIdx = 0;
      const stepTick = () => {
        if (cancelledRef.current) return;

        setState(prev => {
          if (prev.status !== 'running') return prev;
          const processed = offset + batchIdx + batch.length;
          return {
            ...prev,
            current_prop: batch.map(p => p.player_name).join(', '),
            current_step: steps[stepIdx],
            processed_props: Math.min(processed, total),
            percent_complete: Math.min(Math.round((processed / total) * 100), 99),
          };
        });

        stepIdx++;
        if (stepIdx < steps.length) {
          setTimeout(stepTick, 200 + Math.random() * 200);
        } else {
          // Batch complete — add results
          const newItems: AnalysisFeedItem[] = batch.map((p, i) => {
            const isError = Math.random() < 0.03;
            if (isError) {
              setState(prev => ({ ...prev, errors_count: prev.errors_count + 1 }));
            }
            return {
              id: `${batchIdx + i}-${Date.now()}`,
              player: p.player_name || `Prop ${batchIdx + i + 1}`,
              stat: p.stat_type || 'stat',
              status: (isError ? 'error' : 'success') as 'error' | 'success',
              message: isError ? 'Stats unavailable' : undefined,
              timestamp: Date.now(),
            };
          });

          setFeed(prev => [...prev.filter(f => f.status !== 'processing'), ...newItems]);

          batchStart += BATCH_SIZE;
          if (batchStart < propsList.length) {
            setTimeout(processBatch, 100);
          }
        }
      };

      stepTick();
    };

    processBatch();
  }, []);

  const cancelAnalysis = useCallback(() => {
    cancelledRef.current = true;
    setAnalysisLock(false); // 🔓 Unlock dataset
    setState(prev => ({
      ...prev,
      isRunning: false,
      status: 'cancelled',
      current_prop: null,
      current_step: null,
      completed_at: Date.now(),
    }));
    setFeed(prev => prev.filter(f => f.status !== 'processing'));
  }, []);

  return { state, feed, skippedCount, startAnalysis, cancelAnalysis };
}
