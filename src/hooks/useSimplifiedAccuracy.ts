import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AccuracyStats {
  moneyline: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    byConfidence: ConfidenceBand[];
  };
  props: {
    total: number;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    byConfidence: ConfidenceBand[];
    byStatType: StatTypeBreakdown[];
  };
  combined: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

interface ConfidenceBand {
  label: string;
  min: number;
  max: number;
  total: number;
  wins: number;
  winRate: number;
}

interface StatTypeBreakdown {
  statType: string;
  total: number;
  wins: number;
  winRate: number;
}

const CONFIDENCE_BANDS = [
  { label: '0-25%', min: 0, max: 0.25 },
  { label: '25-50%', min: 0.25, max: 0.5 },
  { label: '50-75%', min: 0.5, max: 0.75 },
  { label: '75-100%', min: 0.75, max: 1.0 },
];

interface UseSimplifiedAccuracyOptions {
  startDate?: string;
  endDate?: string;
  sport?: string;
}

export function useSimplifiedAccuracy(options: UseSimplifiedAccuracyOptions = {}) {
  const { startDate, endDate, sport = 'NBA' } = options;

  return useQuery({
    queryKey: ['simplified-accuracy', startDate, endDate, sport],
    queryFn: async (): Promise<AccuracyStats> => {
      // Fetch moneyline results
      let mlQuery = supabase
        .from('moneyline_results')
        .select('*')
        .eq('sport', sport);
      if (startDate) mlQuery = mlQuery.gte('game_date', startDate);
      if (endDate) mlQuery = mlQuery.lte('game_date', endDate);
      
      const { data: mlResults } = await mlQuery;

      // Fetch prop results
      let propQuery = supabase
        .from('prop_results')
        .select('*')
        .eq('sport', sport);
      if (startDate) propQuery = propQuery.gte('game_date', startDate);
      if (endDate) propQuery = propQuery.lte('game_date', endDate);
      
      const { data: propResults } = await propQuery;

      // Calculate moneyline stats
      const mlWithPrediction = (mlResults || []).filter(r => r.ai_predicted_winner);
      const mlWins = mlWithPrediction.filter(r => r.result === 'W').length;
      const mlLosses = mlWithPrediction.filter(r => r.result === 'L').length;

      const mlByConfidence = CONFIDENCE_BANDS.map(band => {
        const inBand = mlWithPrediction.filter(r => {
          const conf = r.confidence_score || 0;
          return conf >= band.min && conf < band.max;
        });
        const wins = inBand.filter(r => r.result === 'W').length;
        return {
          ...band,
          total: inBand.length,
          wins,
          winRate: inBand.length > 0 ? (wins / inBand.length) * 100 : 0,
        };
      });

      // Calculate prop stats
      const propsWithPrediction = (propResults || []).filter(r => r.ai_predicted_side);
      const propWins = propsWithPrediction.filter(r => r.result === 'W').length;
      const propLosses = propsWithPrediction.filter(r => r.result === 'L').length;
      const propPushes = propsWithPrediction.filter(r => r.result === 'Push').length;

      const propByConfidence = CONFIDENCE_BANDS.map(band => {
        const inBand = propsWithPrediction.filter(r => {
          const conf = r.confidence_score || 0;
          return conf >= band.min && conf < band.max;
        });
        const wins = inBand.filter(r => r.result === 'W').length;
        return {
          ...band,
          total: inBand.length,
          wins,
          winRate: inBand.length > 0 ? (wins / inBand.length) * 100 : 0,
        };
      });

      // Group by stat type
      const statTypes = [...new Set(propsWithPrediction.map(r => r.stat_type))];
      const byStatType = statTypes.map(statType => {
        const ofType = propsWithPrediction.filter(r => r.stat_type === statType);
        const wins = ofType.filter(r => r.result === 'W').length;
        return {
          statType,
          total: ofType.length,
          wins,
          winRate: ofType.length > 0 ? (wins / ofType.length) * 100 : 0,
        };
      });

      // Combined stats
      const combinedTotal = mlWithPrediction.length + propsWithPrediction.length;
      const combinedWins = mlWins + propWins;
      const combinedLosses = mlLosses + propLosses;

      return {
        moneyline: {
          total: mlWithPrediction.length,
          wins: mlWins,
          losses: mlLosses,
          winRate: mlWithPrediction.length > 0 ? (mlWins / mlWithPrediction.length) * 100 : 0,
          byConfidence: mlByConfidence,
        },
        props: {
          total: propsWithPrediction.length,
          wins: propWins,
          losses: propLosses,
          pushes: propPushes,
          winRate: propsWithPrediction.length > 0 ? (propWins / propsWithPrediction.length) * 100 : 0,
          byConfidence: propByConfidence,
          byStatType: byStatType,
        },
        combined: {
          total: combinedTotal,
          wins: combinedWins,
          losses: combinedLosses,
          winRate: combinedTotal > 0 ? (combinedWins / combinedTotal) * 100 : 0,
        },
      };
    },
  });
}
