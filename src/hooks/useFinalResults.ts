import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FinalResult {
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
  is_correct: boolean | null;
  ai_probability: number | null;
  ai_confidence_score: number | null;
  model_version: string | null;
  prediction_id: string | null;
  confirmation_id: string | null;
  settled_at: string;
  settled_by: string | null;
  created_at: string;
}

interface UseFinalResultsOptions {
  start?: string;
  end?: string;
  sport?: string;
}

/**
 * Hook to read from the authoritative final_results table
 * This is the single source of truth for all settled games
 */
export function useFinalResults(options: UseFinalResultsOptions = {}) {
  const queryClient = useQueryClient();
  const { start, end, sport = 'NBA' } = options;

  // Fetch final results
  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['final-results', start, end, sport],
    queryFn: async () => {
      let query = supabase
        .from('final_results')
        .select('*')
        .eq('sport', sport)
        .order('game_date', { ascending: false })
        .order('settled_at', { ascending: false });

      if (start) {
        query = query.gte('game_date', start);
      }
      if (end) {
        query = query.lte('game_date', end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinalResult[];
    },
  });

  // Get result by game_id
  const getResultByGameId = (gameId: string) => {
    return results?.find(r => r.game_id === gameId);
  };

  // Calculate accuracy stats
  const stats = results && results.length > 0 ? (() => {
    const withPrediction = results.filter(r => r.ai_predicted_winner !== null);
    const correct = withPrediction.filter(r => r.is_correct === true);
    const incorrect = withPrediction.filter(r => r.is_correct === false);
    
    return {
      total: results.length,
      withPrediction: withPrediction.length,
      correct: correct.length,
      incorrect: incorrect.length,
      accuracy: withPrediction.length > 0 
        ? (correct.length / withPrediction.length) * 100 
        : 0,
      noPrediction: results.filter(r => r.ai_predicted_winner === null).length,
    };
  })() : null;

  // Stats by confidence bands
  const statsByConfidence = results ? (() => {
    const bands = [
      { min: 0, max: 0.25, label: '0-25%' },
      { min: 0.25, max: 0.5, label: '25-50%' },
      { min: 0.5, max: 0.75, label: '50-75%' },
      { min: 0.75, max: 1, label: '75-100%' },
    ];

    return bands.map(band => {
      const inBand = results.filter(r => {
        const conf = r.ai_confidence_score || 0;
        return conf >= band.min && conf < band.max && r.ai_predicted_winner !== null;
      });
      
      const correct = inBand.filter(r => r.is_correct === true).length;
      const total = inBand.length;

      return {
        label: band.label,
        total,
        correct,
        accuracy: total > 0 ? (correct / total) * 100 : 0,
      };
    });
  })() : null;

  // Invalidate cache
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['final-results'] });
  };

  return {
    results,
    isLoading,
    refetch,
    getResultByGameId,
    stats,
    statsByConfidence,
    invalidate,
  };
}
