import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FunctionHealth {
  status: string;
  last_run: string;
  records: number;
  duration_ms: number | null;
}

export interface SBOSystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  stats_coverage: number;
  results_coverage: number;
  total_props: number;
  props_with_stats: number;
  props_with_results: number;
  context_entries: number;
  alerts: { level: string; message: string }[];
  functions: {
    collect_stats: FunctionHealth | null;
    expand_context: FunctionHealth | null;
    run_analysis: FunctionHealth | null;
    settle_results: FunctionHealth | null;
  };
  recent_logs: {
    function_name: string;
    status: string;
    records_processed: number;
    started_at: string;
    duration_ms: number | null;
    error: string | null;
  }[];
  checked_at: string;
}

export function useSBOSystemHealth(enabled = true) {
  return useQuery<SBOSystemHealth>({
    queryKey: ['sbo-system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sbo-system-health');
      if (error) throw error;
      return data as SBOSystemHealth;
    },
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}
