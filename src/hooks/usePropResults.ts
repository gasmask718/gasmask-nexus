import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PropResult {
  id: string;
  game_id: string;
  game_date: string;
  sport: string;
  player_id: string | null;
  player_name: string;
  team: string | null;
  opponent: string | null;
  stat_type: string;
  line_value: number;
  final_stat_value: number | null;
  ai_predicted_side: 'MORE' | 'LESS' | 'OVER' | 'UNDER' | null;
  result: 'W' | 'L' | 'Push' | null;
  confidence_score: number | null;
  model_version: string | null;
  dnp: boolean;
  stat_source: string | null;
  settled_at: string;
}

interface UsePropResultsOptions {
  startDate?: string;
  endDate?: string;
  sport?: string;
  statType?: string;
}

export function usePropResults(options: UsePropResultsOptions = {}) {
  const { startDate, endDate, sport = 'NBA', statType } = options;

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['prop-results', startDate, endDate, sport, statType],
    queryFn: async () => {
      let query = supabase
        .from('prop_results')
        .select('*')
        .eq('sport', sport)
        .order('game_date', { ascending: false })
        .order('settled_at', { ascending: false });

      if (startDate) query = query.gte('game_date', startDate);
      if (endDate) query = query.lte('game_date', endDate);
      if (statType) query = query.eq('stat_type', statType);

      const { data, error } = await query;
      if (error) throw error;
      return data as PropResult[];
    },
  });

  const stats = results && results.length > 0 ? (() => {
    const withPrediction = results.filter(r => r.ai_predicted_side !== null);
    const wins = withPrediction.filter(r => r.result === 'W').length;
    const losses = withPrediction.filter(r => r.result === 'L').length;
    const pushes = withPrediction.filter(r => r.result === 'Push').length;
    
    return {
      total: results.length,
      withPrediction: withPrediction.length,
      wins,
      losses,
      pushes,
      winRate: withPrediction.length > 0 ? (wins / withPrediction.length) * 100 : 0,
      dnpCount: results.filter(r => r.dnp).length,
    };
  })() : null;

  return { results, isLoading, refetch, stats };
}
