import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SettlementResult {
  id: string;
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  confirmed_winner: string;
  confirmed_at: string;
  confirmation_source: string;
  sport: string;
}

interface UseMoneylineResultsOptions {
  startDate?: string;
  endDate?: string;
}

export function useMoneylineResults(options: UseMoneylineResultsOptions = {}) {
  const { startDate, endDate } = options;

  const { data: results = [], isLoading, refetch } = useQuery({
    queryKey: ['settlement-moneyline', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('confirmed_game_winners')
        .select('*')
        .eq('confirmation_revoked', false)
        .order('game_date', { ascending: false })
        .order('confirmed_at', { ascending: false });

      if (startDate) {
        query = query.gte('game_date', startDate);
      }
      if (endDate) {
        query = query.lte('game_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SettlementResult[];
    },
  });

  // Calculate stats from settlement data
  const stats = {
    total: results.length,
    byDate: results.reduce((acc, r) => {
      acc[r.game_date] = (acc[r.game_date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return { results, isLoading, refetch, stats };
}
