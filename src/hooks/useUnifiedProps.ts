import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface UnifiedProp {
  id: string;
  player_name: string;
  team: string | null;
  stat_type: string;
  platform: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  game_date: string;
  game_id: string | null;
  season_avg: number | null;
  l5_avg: number | null;
  l10_avg: number | null;
  matchup_avg: number | null;
  edge_vs_line: number | null;
  ai_direction: string | null;
  ai_confidence: number | null;
  best_platform: boolean;
  analysis_job_id: string | null;
}

export interface AnalysisJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useUnifiedProps(date?: string) {
  const todayEST = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  return useQuery({
    queryKey: ['unified-props', todayEST],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_unified_props')
        .select('*')
        .eq('game_date', todayEST)
        .order('ai_confidence', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data || []) as UnifiedProp[];
    },
    refetchInterval: 30000,
    placeholderData: (prev: any) => prev, // keep previous data during refetch
  });
}

export function useAnalysisJob() {
  const queryClient = useQueryClient();
  const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Get latest job
  const jobQuery = useQuery({
    queryKey: ['analysis-job', todayEST],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_analysis_jobs')
        .select('*')
        .gte('created_at', todayEST)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as AnalysisJob | null;
    },
    refetchInterval: 3000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('analysis-job-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sbo_analysis_jobs',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['analysis-job'] });
        queryClient.refetchQueries({ queryKey: ['unified-props'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Start analysis mutation
  const startAnalysis = useMutation({
    mutationFn: async () => {
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

      if (jobError) throw jobError;

      // Fire-and-forget the edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sbo-run-analysis`;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(console.error); // Fire and forget

      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis-job'] });
    },
  });

  return {
    job: jobQuery.data,
    isLoading: jobQuery.isLoading,
    startAnalysis,
  };
}
