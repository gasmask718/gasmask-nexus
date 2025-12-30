import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MoneylineResult {
  id: string;
  game_id: string;
  game_date: string;
  sport: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  ai_predicted_winner: string | null;
  actual_winner: string;
  result: 'W' | 'L' | null;
  ai_probability: number | null;
  confidence_score: number | null;
  model_version: string | null;
  settled_at: string;
}

interface UseMoneylineResultsOptions {
  startDate?: string;
  endDate?: string;
  sport?: string;
}

export function useMoneylineResults(options: UseMoneylineResultsOptions = {}) {
  const { startDate, endDate, sport = 'NBA' } = options;

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['moneyline-results', startDate, endDate, sport],
    queryFn: async () => {
      let query = supabase
        .from('moneyline_results')
        .select('*')
        .eq('sport', sport)
        .order('game_date', { ascending: false })
        .order('settled_at', { ascending: false });

      if (startDate) query = query.gte('game_date', startDate);
      if (endDate) query = query.lte('game_date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data as MoneylineResult[];
    },
  });

  const stats = results && results.length > 0 ? (() => {
    const withPrediction = results.filter(r => r.ai_predicted_winner !== null);
    const wins = withPrediction.filter(r => r.result === 'W').length;
    const losses = withPrediction.filter(r => r.result === 'L').length;
    
    return {
      total: results.length,
      withPrediction: withPrediction.length,
      wins,
      losses,
      winRate: withPrediction.length > 0 ? (wins / withPrediction.length) * 100 : 0,
    };
  })() : null;

  return { results, isLoading, refetch, stats };
}
