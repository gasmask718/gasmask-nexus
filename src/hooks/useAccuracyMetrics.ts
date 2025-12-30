import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, startOfWeek, startOfMonth } from 'date-fns';

// Confidence bands for accuracy analysis
const CONFIDENCE_BANDS = [
  { band: '<50', min: 0, max: 49, label: 'Low' },
  { band: '50-59', min: 50, max: 59, label: '50-59%' },
  { band: '60-69', min: 60, max: 69, label: '60-69%' },
  { band: '70-79', min: 70, max: 79, label: '70-79%' },
  { band: '80-89', min: 80, max: 89, label: '80-89%' },
  { band: '90-100', min: 90, max: 100, label: '90-100%' },
];

export interface AccuracyFilters {
  sport: 'NBA' | 'all';
  dateFrom: string;
  dateTo: string;
  marketType: 'moneyline' | 'player_prop' | 'all';
  modelVersion: string | 'all';
}

export interface ConfidenceBandMetrics {
  band: string;
  min: number;
  max: number;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgProbability: number;
  avgConfidence: number;
  calibrationGap: number;
  brierContribution: number;
}

export interface DailyAccuracy {
  date: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  cumulativeWins: number;
  cumulativeTotal: number;
  cumulativeWinRate: number;
}

export interface AccuracyMetrics {
  totalSettled: number;
  totalWithPredictions: number;
  wins: number;
  losses: number;
  noPrediction: number;
  winRate: number;
  brierScore: number;
  logLoss: number;
  avgConfidence: number;
  avgProbability: number;
}

export interface CalibrationPoint {
  predictedBand: string;
  avgPredictedProb: number;
  actualWinRate: number;
  count: number;
  calibrationError: number;
}

export const DEFAULT_ACCURACY_FILTERS: AccuracyFilters = {
  sport: 'NBA',
  dateFrom: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
  marketType: 'all',
  modelVersion: 'all',
};

export function useAccuracyMetrics(filters: AccuracyFilters = DEFAULT_ACCURACY_FILTERS) {
  // Fetch from final_results - the authoritative source
  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['accuracy-metrics', filters],
    queryFn: async () => {
      let query = supabase
        .from('final_results')
        .select('*')
        .eq('is_valid', true) // Only read valid rows
        .gte('game_date', filters.dateFrom)
        .lte('game_date', filters.dateTo)
        .order('game_date', { ascending: true });

      if (filters.sport !== 'all') {
        query = query.eq('sport', filters.sport);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Calculate global accuracy metrics
  const globalMetrics = useMemo((): AccuracyMetrics => {
    if (!results || results.length === 0) {
      return {
        totalSettled: 0,
        totalWithPredictions: 0,
        wins: 0,
        losses: 0,
        noPrediction: 0,
        winRate: 0,
        brierScore: 0,
        logLoss: 0,
        avgConfidence: 0,
        avgProbability: 0,
      };
    }

    const totalSettled = results.length;
    const withPredictions = results.filter(r => r.ai_predicted_winner !== null);
    const noPrediction = results.filter(r => r.ai_predicted_winner === null).length;
    
    const wins = withPredictions.filter(r => r.is_correct === true).length;
    const losses = withPredictions.filter(r => r.is_correct === false).length;
    const winRate = withPredictions.length > 0 ? (wins / withPredictions.length) * 100 : 0;

    // Calculate Brier Score: mean((probability - outcome)^2)
    // outcome = 1 if correct, 0 if incorrect
    let brierSum = 0;
    let logLossSum = 0;
    let totalProb = 0;
    let totalConf = 0;
    let probCount = 0;

    withPredictions.forEach(r => {
      const prob = r.ai_probability !== null ? Number(r.ai_probability) : 0.5;
      const conf = r.ai_confidence_score !== null ? Number(r.ai_confidence_score) : 50;
      const outcome = r.is_correct ? 1 : 0;

      // Brier score contribution
      brierSum += Math.pow(prob - outcome, 2);
      
      // Log loss contribution (with epsilon to avoid log(0))
      const epsilon = 1e-15;
      const clampedProb = Math.max(epsilon, Math.min(1 - epsilon, prob));
      logLossSum += -(outcome * Math.log(clampedProb) + (1 - outcome) * Math.log(1 - clampedProb));

      totalProb += prob;
      totalConf += conf;
      probCount++;
    });

    const brierScore = probCount > 0 ? brierSum / probCount : 0;
    const logLoss = probCount > 0 ? logLossSum / probCount : 0;
    const avgProbability = probCount > 0 ? (totalProb / probCount) * 100 : 0;
    const avgConfidence = probCount > 0 ? totalConf / probCount : 0;

    return {
      totalSettled,
      totalWithPredictions: withPredictions.length,
      wins,
      losses,
      noPrediction,
      winRate,
      brierScore,
      logLoss,
      avgConfidence,
      avgProbability,
    };
  }, [results]);

  // Calculate confidence band breakdown
  const confidenceBands = useMemo((): ConfidenceBandMetrics[] => {
    if (!results || results.length === 0) return [];

    return CONFIDENCE_BANDS.map(band => {
      const inBand = results.filter(r => {
        const conf = r.ai_confidence_score !== null ? Number(r.ai_confidence_score) : null;
        if (conf === null) return false;
        return conf >= band.min && conf <= band.max && r.ai_predicted_winner !== null;
      });

      const wins = inBand.filter(r => r.is_correct === true).length;
      const losses = inBand.filter(r => r.is_correct === false).length;
      const total = inBand.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;

      // Calculate average probability for this band
      let totalProb = 0;
      let totalConf = 0;
      let brierSum = 0;
      
      inBand.forEach(r => {
        const prob = r.ai_probability !== null ? Number(r.ai_probability) : 0.5;
        const conf = r.ai_confidence_score !== null ? Number(r.ai_confidence_score) : 50;
        totalProb += prob;
        totalConf += conf;
        
        const outcome = r.is_correct ? 1 : 0;
        brierSum += Math.pow(prob - outcome, 2);
      });

      const avgProbability = total > 0 ? (totalProb / total) * 100 : 0;
      const avgConfidence = total > 0 ? totalConf / total : 0;
      const calibrationGap = winRate - avgProbability;
      const brierContribution = total > 0 ? brierSum / total : 0;

      return {
        band: band.label,
        min: band.min,
        max: band.max,
        total,
        wins,
        losses,
        winRate,
        avgProbability,
        avgConfidence,
        calibrationGap,
        brierContribution,
      };
    }).filter(b => b.total > 0);
  }, [results]);

  // Calibration analysis (predicted vs actual)
  const calibrationData = useMemo((): CalibrationPoint[] => {
    if (!results || results.length === 0) return [];

    // Group by probability bands (10% intervals)
    const probBands = [
      { label: '0-10%', min: 0, max: 0.10 },
      { label: '10-20%', min: 0.10, max: 0.20 },
      { label: '20-30%', min: 0.20, max: 0.30 },
      { label: '30-40%', min: 0.30, max: 0.40 },
      { label: '40-50%', min: 0.40, max: 0.50 },
      { label: '50-60%', min: 0.50, max: 0.60 },
      { label: '60-70%', min: 0.60, max: 0.70 },
      { label: '70-80%', min: 0.70, max: 0.80 },
      { label: '80-90%', min: 0.80, max: 0.90 },
      { label: '90-100%', min: 0.90, max: 1.00 },
    ];

    return probBands.map(band => {
      const inBand = results.filter(r => {
        const prob = r.ai_probability !== null ? Number(r.ai_probability) : null;
        if (prob === null || r.ai_predicted_winner === null) return false;
        return prob >= band.min && prob < band.max;
      });

      const count = inBand.length;
      if (count === 0) {
        return {
          predictedBand: band.label,
          avgPredictedProb: (band.min + band.max) / 2,
          actualWinRate: 0,
          count: 0,
          calibrationError: 0,
        };
      }

      const wins = inBand.filter(r => r.is_correct === true).length;
      const totalProb = inBand.reduce((sum, r) => sum + (Number(r.ai_probability) || 0.5), 0);
      
      const avgPredictedProb = totalProb / count;
      const actualWinRate = wins / count;
      const calibrationError = Math.abs(actualWinRate - avgPredictedProb) * 100;

      return {
        predictedBand: band.label,
        avgPredictedProb: avgPredictedProb * 100,
        actualWinRate: actualWinRate * 100,
        count,
        calibrationError,
      };
    }).filter(b => b.count > 0);
  }, [results]);

  // Daily accuracy rollup
  const dailyAccuracy = useMemo((): DailyAccuracy[] => {
    if (!results || results.length === 0) return [];

    const dailyGroups: Record<string, { total: number; wins: number; losses: number }> = {};
    
    results.forEach(r => {
      if (r.ai_predicted_winner === null) return;
      
      const date = r.game_date;
      if (!dailyGroups[date]) {
        dailyGroups[date] = { total: 0, wins: 0, losses: 0 };
      }
      dailyGroups[date].total++;
      if (r.is_correct === true) dailyGroups[date].wins++;
      if (r.is_correct === false) dailyGroups[date].losses++;
    });

    const sorted = Object.entries(dailyGroups)
      .sort((a, b) => a[0].localeCompare(b[0]));

    let cumulativeWins = 0;
    let cumulativeTotal = 0;

    return sorted.map(([date, data]) => {
      cumulativeWins += data.wins;
      cumulativeTotal += data.total;
      
      return {
        date,
        total: data.total,
        wins: data.wins,
        losses: data.losses,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
        cumulativeWins,
        cumulativeTotal,
        cumulativeWinRate: cumulativeTotal > 0 ? (cumulativeWins / cumulativeTotal) * 100 : 0,
      };
    });
  }, [results]);

  // Weekly and monthly rollups
  const weeklyAccuracy = useMemo(() => {
    if (!dailyAccuracy || dailyAccuracy.length === 0) return [];

    const weekGroups: Record<string, { total: number; wins: number }> = {};
    
    dailyAccuracy.forEach(day => {
      const weekStart = format(startOfWeek(new Date(day.date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weekGroups[weekStart]) {
        weekGroups[weekStart] = { total: 0, wins: 0 };
      }
      weekGroups[weekStart].total += day.total;
      weekGroups[weekStart].wins += day.wins;
    });

    return Object.entries(weekGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, data]) => ({
        week,
        total: data.total,
        wins: data.wins,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      }));
  }, [dailyAccuracy]);

  const monthlyAccuracy = useMemo(() => {
    if (!dailyAccuracy || dailyAccuracy.length === 0) return [];

    const monthGroups: Record<string, { total: number; wins: number }> = {};
    
    dailyAccuracy.forEach(day => {
      const monthStart = format(startOfMonth(new Date(day.date)), 'yyyy-MM');
      if (!monthGroups[monthStart]) {
        monthGroups[monthStart] = { total: 0, wins: 0 };
      }
      monthGroups[monthStart].total += day.total;
      monthGroups[monthStart].wins += day.wins;
    });

    return Object.entries(monthGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        total: data.total,
        wins: data.wins,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      }));
  }, [dailyAccuracy]);

  // Last 7 days quick stats
  const last7Days = useMemo(() => {
    if (!results || results.length === 0) return null;

    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const recent = results.filter(r => 
      r.game_date >= sevenDaysAgo && r.ai_predicted_winner !== null
    );

    const wins = recent.filter(r => r.is_correct === true).length;
    const total = recent.length;

    return {
      total,
      wins,
      losses: total - wins,
      winRate: total > 0 ? (wins / total) * 100 : 0,
    };
  }, [results]);

  return {
    results,
    isLoading,
    refetch,
    globalMetrics,
    confidenceBands,
    calibrationData,
    dailyAccuracy,
    weeklyAccuracy,
    monthlyAccuracy,
    last7Days,
  };
}
