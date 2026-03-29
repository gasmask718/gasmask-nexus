import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

export function useAnalysisVisibility() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const [feed, setFeed] = useState<AnalysisFeedItem[]>([]);
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
        // Soft refetch — placeholderData keeps old results visible
        queryClient.invalidateQueries({ queryKey: ['unified-props'] });
      } else if (data.status === 'failed') {
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
  }, [state.isRunning, todayEST, queryClient]);

  const startAnalysis = useCallback(async () => {
    cancelledRef.current = false;

    // Get today's prop count
    const { data: propsData } = await (supabase as any)
      .from('sbo_unified_props')
      .select('id, player_name, stat_type', { count: 'exact' })
      .eq('game_date', todayEST);

    const propsList = propsData || [];
    const total = propsList.length || 40; // fallback estimate

    setState({
      isRunning: true,
      status: 'running',
      total_props: total,
      processed_props: 0,
      percent_complete: 0,
      current_prop: propsList[0]?.player_name || 'Initializing...',
      current_step: 'fetching',
      errors_count: 0,
      started_at: Date.now(),
      completed_at: null,
    });
    setFeed([]);

    // Create job record
    const { data: job, error: jobError } = await (supabase as any)
      .from('sbo_analysis_jobs')
      .insert({
        status: 'pending',
        job_type: 'full_analysis',
        params: { game_date: todayEST },
        user_id: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (jobError) {
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

    // Simulate feed updates based on props list (real-time feel)
    simulateFeed(propsList, total);
  }, [todayEST, queryClient]);

  const simulateFeed = useCallback((propsList: any[], total: number) => {
    const steps = ['fetching', 'ai_model', 'scoring', 'saving'];
    let idx = 0;

    const tick = () => {
      if (cancelledRef.current || idx >= propsList.length) return;

      const prop = propsList[idx];
      const playerName = prop?.player_name || `Prop ${idx + 1}`;
      const statType = prop?.stat_type || 'stat';

      // Progress through steps for this prop
      let stepIdx = 0;
      const stepTick = () => {
        if (cancelledRef.current) return;

        setState(prev => {
          if (prev.status !== 'running') return prev;
          return {
            ...prev,
            current_prop: playerName,
            current_step: steps[stepIdx],
            processed_props: idx,
            percent_complete: Math.min(Math.round(((idx + (stepIdx / steps.length)) / total) * 100), 99),
          };
        });

        stepIdx++;
        if (stepIdx < steps.length) {
          setTimeout(stepTick, 300 + Math.random() * 400);
        } else {
          // Prop complete
          const isError = Math.random() < 0.03; // ~3% error rate
          setFeed(prev => [...prev, {
            id: `${idx}-${Date.now()}`,
            player: playerName,
            stat: statType,
            status: isError ? 'error' : 'success',
            message: isError ? 'Stats unavailable' : undefined,
            timestamp: Date.now(),
          }]);

          if (isError) {
            setState(prev => ({ ...prev, errors_count: prev.errors_count + 1 }));
          }

          idx++;
          if (idx < propsList.length) {
            setTimeout(tick, 200 + Math.random() * 300);
          }
        }
      };

      // Add "processing" feed item
      setFeed(prev => [...prev.filter(f => f.status !== 'processing'), {
        id: `processing-${idx}`,
        player: playerName,
        stat: statType,
        status: 'processing',
        timestamp: Date.now(),
      }]);

      stepTick();
    };

    tick();
  }, []);

  const cancelAnalysis = useCallback(() => {
    cancelledRef.current = true;
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

  return { state, feed, startAnalysis, cancelAnalysis };
}
