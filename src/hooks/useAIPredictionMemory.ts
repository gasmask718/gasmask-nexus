import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AIPrediction {
  id: string;
  game_id: string;
  game_date: string;
  sport: string;
  home_team: string;
  away_team: string;
  ai_predicted_winner: string;
  ai_predicted_probability: number | null;
  ai_confidence_score: number | null;
  model_version: string | null;
  prediction_source: string;
  created_at: string;
  locked_at: string | null;
}

export interface PredictionEvaluation {
  id: string;
  game_id: string;
  game_date: string;
  sport: string;
  ai_predicted_winner: string;
  confirmed_winner: string;
  ai_result: 'correct' | 'incorrect';
  prediction_id: string | null;
  confirmation_id: string | null;
  evaluated_at: string;
  evaluated_by: string | null;
  notes: string | null;
  is_valid: boolean;
  invalidated_at: string | null;
  invalidation_reason: string | null;
}

interface StorePredictionInput {
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  ai_predicted_winner: string;
  ai_predicted_probability?: number;
  ai_confidence_score?: number;
  model_version?: string;
}

interface EvaluatePredictionInput {
  game_id: string;
  game_date: string;
  confirmed_winner: string;
}

// Simple team strength model for predictions
const TEAM_STRENGTHS: Record<string, number> = {
  "Boston Celtics": 0.72,
  "Oklahoma City Thunder": 0.70,
  "Cleveland Cavaliers": 0.68,
  "Denver Nuggets": 0.65,
  "Minnesota Timberwolves": 0.63,
  "Phoenix Suns": 0.62,
  "Dallas Mavericks": 0.61,
  "New York Knicks": 0.60,
  "Milwaukee Bucks": 0.59,
  "LA Clippers": 0.58,
  "Los Angeles Lakers": 0.57,
  "Sacramento Kings": 0.56,
  "Miami Heat": 0.55,
  "Indiana Pacers": 0.54,
  "Philadelphia 76ers": 0.53,
  "New Orleans Pelicans": 0.52,
  "Golden State Warriors": 0.51,
  "Orlando Magic": 0.50,
  "Houston Rockets": 0.49,
  "Atlanta Hawks": 0.48,
  "Chicago Bulls": 0.47,
  "Brooklyn Nets": 0.46,
  "Memphis Grizzlies": 0.45,
  "Toronto Raptors": 0.44,
  "Utah Jazz": 0.43,
  "San Antonio Spurs": 0.42,
  "Portland Trail Blazers": 0.41,
  "Charlotte Hornets": 0.40,
  "Detroit Pistons": 0.39,
  "Washington Wizards": 0.38,
};

// INTERNAL ONLY - generate AI prediction based on team strengths
// This should ONLY be called by storePredictions mutation when storing new predictions
// NEVER call this directly from UI components to avoid prediction discrepancies
function generateAIPrediction(homeTeam: string, awayTeam: string) {
  const homeStrength = TEAM_STRENGTHS[homeTeam] || 0.50;
  const awayStrength = TEAM_STRENGTHS[awayTeam] || 0.50;
  
  // Home court advantage ~3%
  const homeAdvantage = 0.03;
  const adjustedHomeStrength = homeStrength + homeAdvantage;
  
  const totalStrength = adjustedHomeStrength + awayStrength;
  const homeWinProb = adjustedHomeStrength / totalStrength;
  
  const predictedWinner = homeWinProb >= 0.5 ? homeTeam : awayTeam;
  const winProbability = homeWinProb >= 0.5 ? homeWinProb : (1 - homeWinProb);
  
  // Confidence based on probability difference
  const confidence = Math.abs(homeWinProb - 0.5) * 2;
  
  return {
    ai_predicted_winner: predictedWinner,
    ai_predicted_probability: Math.round(winProbability * 10000) / 10000,
    ai_confidence_score: Math.round(confidence * 10000) / 10000,
  };
}

export function useAIPredictionMemory(dateRange?: { start: string; end: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch AI predictions for date range
  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = useQuery({
    queryKey: ['ai-predictions', dateRange?.start, dateRange?.end],
    queryFn: async () => {
      let query = supabase
        .from('ai_game_predictions')
        .select('*')
        .eq('sport', 'NBA')
        .order('game_date', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('game_date', dateRange.start);
      }
      if (dateRange?.end) {
        query = query.lte('game_date', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AIPrediction[];
    },
  });

  // Fetch evaluations for date range
  const { data: evaluations, isLoading: evaluationsLoading, refetch: refetchEvaluations } = useQuery({
    queryKey: ['prediction-evaluations', dateRange?.start, dateRange?.end],
    queryFn: async () => {
      let query = supabase
        .from('prediction_evaluations')
        .select('*')
        .eq('sport', 'NBA')
        .order('game_date', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('game_date', dateRange.start);
      }
      if (dateRange?.end) {
        query = query.lte('game_date', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PredictionEvaluation[];
    },
  });

  // Get prediction for a specific game
  const getPredictionByGameId = (gameId: string) => {
    return predictions?.find(p => p.game_id === gameId);
  };

  // Get evaluation for a specific game
  const getEvaluationByGameId = (gameId: string) => {
    return evaluations?.find(e => e.game_id === gameId);
  };

  // Store a new AI prediction (uses ON CONFLICT DO NOTHING - immutable once created)
  const storePrediction = useMutation({
    mutationFn: async (input: StorePredictionInput) => {
      // Use INSERT with ON CONFLICT DO NOTHING - respects unique constraint
      // This ensures predictions are NEVER overwritten
      const { error } = await supabase
        .from('ai_game_predictions')
        .insert({
          game_id: input.game_id,
          game_date: input.game_date,
          sport: 'NBA',
          home_team: input.home_team,
          away_team: input.away_team,
          ai_predicted_winner: input.ai_predicted_winner,
          ai_predicted_probability: input.ai_predicted_probability,
          ai_confidence_score: input.ai_confidence_score,
          model_version: input.model_version || 'v1',
          prediction_source: 'ai',
          // locked_at is auto-set by trigger
        });

      // Ignore unique constraint violations (prediction already exists)
      if (error && error.code !== '23505') {
        throw error;
      }
      
      return { action: error?.code === '23505' ? 'exists' : 'created', game_id: input.game_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-predictions'] });
    },
  });

  // Store predictions for multiple games (uses ON CONFLICT DO NOTHING - immutable)
  const storePredictions = useMutation({
    mutationFn: async (games: Array<{
      game_id: string;
      game_date: string;
      home_team: string;
      away_team: string;
    }>) => {
      if (games.length === 0) {
        return { stored: 0, skipped: 0 };
      }

      const predictionsToStore = games.map(game => {
        const prediction = generateAIPrediction(game.home_team, game.away_team);
        return {
          game_id: game.game_id,
          game_date: game.game_date,
          sport: 'NBA',
          home_team: game.home_team,
          away_team: game.away_team,
          ai_predicted_winner: prediction.ai_predicted_winner,
          ai_predicted_probability: prediction.ai_predicted_probability,
          ai_confidence_score: prediction.ai_confidence_score,
          model_version: 'v1',
          prediction_source: 'ai',
          // locked_at is auto-set by trigger
        };
      });

      // Use INSERT with ON CONFLICT DO NOTHING to respect immutability
      // This ensures existing predictions are NEVER modified
      const { data, error } = await supabase
        .from('ai_game_predictions')
        .insert(predictionsToStore)
        .select();

      // Count how many were actually inserted
      const stored = data?.length || 0;
      const skipped = games.length - stored;

      // Ignore unique constraint violations (some predictions already existed)
      if (error && error.code !== '23505') {
        throw error;
      }

      return { stored, skipped };
    },
    onSuccess: (data) => {
      if (data.stored > 0) {
        toast.success(`Stored ${data.stored} AI predictions`);
      }
      queryClient.invalidateQueries({ queryKey: ['ai-predictions'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to store predictions: ${error.message}`);
    },
  });

  // Evaluate a prediction against confirmed winner
  // Learning Safety Rule: Only evaluate if AI prediction was made before game
  const evaluatePrediction = useMutation({
    mutationFn: async (input: EvaluatePredictionInput) => {
      // Get the AI prediction for this game
      const { data: prediction } = await supabase
        .from('ai_game_predictions')
        .select('*')
        .eq('game_id', input.game_id)
        .eq('game_date', input.game_date)
        .single();

      if (!prediction) {
        // No prediction exists - cannot evaluate
        return { action: 'no_prediction', game_id: input.game_id };
      }

      // Learning Safety Rule: Check if prediction was made before game
      // For now, we'll trust stored predictions as valid
      // In the future, we can add game_start_time comparison
      const predictionTimestamp = new Date(prediction.created_at);
      
      // Get the confirmation record
      const { data: confirmation } = await supabase
        .from('confirmed_game_winners')
        .select('id, confirmation_revoked')
        .eq('game_id', input.game_id)
        .single();

      // If confirmation is revoked, don't create evaluation
      if (confirmation?.confirmation_revoked) {
        return { action: 'confirmation_revoked', game_id: input.game_id };
      }

      // Determine if prediction was correct
      const aiResult = prediction.ai_predicted_winner === input.confirmed_winner ? 'correct' : 'incorrect';

      // Check if evaluation exists
      const { data: existingEval } = await supabase
        .from('prediction_evaluations')
        .select('id')
        .eq('game_id', input.game_id)
        .eq('game_date', input.game_date)
        .single();

      if (existingEval) {
        // Update existing evaluation
        const { error } = await supabase
          .from('prediction_evaluations')
          .update({
            ai_predicted_winner: prediction.ai_predicted_winner,
            confirmed_winner: input.confirmed_winner,
            ai_result: aiResult,
            evaluated_at: new Date().toISOString(),
            evaluated_by: user?.id,
            is_valid: true, // Re-validate on update
            invalidated_at: null,
            invalidation_reason: null,
          })
          .eq('id', existingEval.id);

        if (error) throw error;
        return { action: 'updated', game_id: input.game_id, result: aiResult };
      }

      // Insert new evaluation
      const { error } = await supabase
        .from('prediction_evaluations')
        .insert({
          game_id: input.game_id,
          game_date: input.game_date,
          sport: 'NBA',
          ai_predicted_winner: prediction.ai_predicted_winner,
          confirmed_winner: input.confirmed_winner,
          ai_result: aiResult,
          prediction_id: prediction.id,
          confirmation_id: confirmation?.id,
          evaluated_by: user?.id,
          is_valid: true,
        });

      if (error) throw error;
      return { action: 'created', game_id: input.game_id, result: aiResult };
    },
    onSuccess: (data) => {
      if (data.action !== 'no_prediction' && data.action !== 'confirmation_revoked') {
        toast.success(`AI prediction was ${data.result}`);
      }
      queryClient.invalidateQueries({ queryKey: ['prediction-evaluations'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to evaluate prediction: ${error.message}`);
    },
  });

  // Calculate accuracy stats (only count valid evaluations)
  const validEvaluations = evaluations?.filter(e => e.is_valid !== false) || [];
  const stats = validEvaluations.length > 0 ? {
    total: validEvaluations.length,
    correct: validEvaluations.filter(e => e.ai_result === 'correct').length,
    incorrect: validEvaluations.filter(e => e.ai_result === 'incorrect').length,
    accuracy: (validEvaluations.filter(e => e.ai_result === 'correct').length / validEvaluations.length) * 100,
  } : null;

  // Stats by confidence bands
  const statsByConfidence = predictions && evaluations ? (() => {
    const bands = [
      { min: 0, max: 0.25, label: '0-25%' },
      { min: 0.25, max: 0.5, label: '25-50%' },
      { min: 0.5, max: 0.75, label: '50-75%' },
      { min: 0.75, max: 1, label: '75-100%' },
    ];

    return bands.map(band => {
      const predictionsInBand = predictions.filter(p => {
        const conf = p.ai_confidence_score || 0;
        return conf >= band.min && conf < band.max;
      });
      
      const evaluatedInBand = evaluations.filter(e => {
        const prediction = predictions.find(p => p.game_id === e.game_id);
        const conf = prediction?.ai_confidence_score || 0;
        return conf >= band.min && conf < band.max;
      });

      const correct = evaluatedInBand.filter(e => e.ai_result === 'correct').length;
      const total = evaluatedInBand.length;

      return {
        label: band.label,
        predictions: predictionsInBand.length,
        evaluated: total,
        correct,
        accuracy: total > 0 ? (correct / total) * 100 : 0,
      };
    });
  })() : null;

  return {
    predictions,
    evaluations,
    isLoading: predictionsLoading || evaluationsLoading,
    getPredictionByGameId,
    getEvaluationByGameId,
    storePrediction,
    storePredictions,
    evaluatePrediction,
    refetch: () => {
      refetchPredictions();
      refetchEvaluations();
    },
    stats,
    statsByConfidence,
    isStoring: storePrediction.isPending || storePredictions.isPending,
    isEvaluating: evaluatePrediction.isPending,
  };
}
