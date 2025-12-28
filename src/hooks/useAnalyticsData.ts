import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupportedState, FormatTag, PlatformKey } from './useStateCompliance';
import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

export interface AnalyticsFilters {
  dateFrom: string;
  dateTo: string;
  state: SupportedState | 'all';
  platform: PlatformKey | 'all';
  sport: string;
  formatTag: FormatTag | 'all';
  decisionSource: 'AI' | 'USER' | 'all';
  market: string;
  selection: 'MORE' | 'LESS' | 'over' | 'under' | 'home' | 'away' | 'all';
}

export interface PickEntry {
  id: string;
  user_id: string;
  date: string;
  state: SupportedState;
  platform: PlatformKey;
  sport: string;
  format_tag: FormatTag;
  player: string | null;
  team: string | null;
  opponent: string | null;
  market: string;
  line_value: number | null;
  side: string | null;
  stake: number;
  odds: number | null;
  multiplier: number | null;
  status: 'open' | 'settled';
  result: 'W' | 'L' | 'Push' | null;
  profit_loss: number;
  notes: string | null;
  locked_at: string | null;
  decision_source: 'AI' | 'USER' | null;
  actual_result_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConfidenceBand {
  band: string;
  minScore: number;
  maxScore: number;
  entries: number;
  wins: number;
  winRate: number;
  totalStaked: number;
  totalPL: number;
  roi: number;
}

export interface DailyPerformance {
  date: string;
  totalStaked: number;
  totalPL: number;
  roi: number;
  cumulativePL: number;
  entries: number;
}

export interface BreakdownRow {
  name: string;
  entries: number;
  wins: number;
  winRate: number;
  totalStaked: number;
  totalPL: number;
  roi: number;
}

export interface GlobalMetrics {
  totalEntries: number;
  winRate: number;
  totalPL: number;
  roi: number;
  avgProfitPerEntry: number;
  maxDrawdown: number;
  currentStreak: { type: 'W' | 'L' | null; count: number };
  totalStaked: number;
  wins: number;
  losses: number;
  pushes: number;
}

const CONFIDENCE_BANDS = [
  { band: '50–54', minScore: 50, maxScore: 54 },
  { band: '55–59', minScore: 55, maxScore: 59 },
  { band: '60–64', minScore: 60, maxScore: 64 },
  { band: '65–69', minScore: 65, maxScore: 69 },
  { band: '70–74', minScore: 70, maxScore: 74 },
  { band: '75–79', minScore: 75, maxScore: 79 },
  { band: '80–84', minScore: 80, maxScore: 84 },
  { band: '85–89', minScore: 85, maxScore: 89 },
  { band: '90+', minScore: 90, maxScore: 100 },
  { band: 'Unscored', minScore: -1, maxScore: -1 },
];

export function useAnalyticsData(filters: AnalyticsFilters) {
  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ['analytics-entries-full', filters],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('pick_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'settled')
        .gte('date', filters.dateFrom)
        .lte('date', filters.dateTo)
        .order('date', { ascending: true });

      if (filters.state !== 'all') query = query.eq('state', filters.state);
      if (filters.platform !== 'all') query = query.eq('platform', filters.platform);
      if (filters.sport) query = query.eq('sport', filters.sport);
      if (filters.formatTag !== 'all') query = query.eq('format_tag', filters.formatTag);
      if (filters.decisionSource !== 'all') query = query.eq('decision_source', filters.decisionSource);
      if (filters.market) query = query.eq('market', filters.market);
      if (filters.selection !== 'all') query = query.eq('side', filters.selection);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PickEntry[];
    },
  });

  // Calculate profit/loss with fallback
  const calculatePL = (entry: PickEntry): number => {
    if (entry.profit_loss !== null && entry.profit_loss !== undefined) {
      return entry.profit_loss;
    }
    
    const stake = entry.stake || 1;
    
    if (entry.format_tag === 'fantasy_pickem') {
      const multiplier = entry.multiplier || 2;
      return entry.result === 'W' ? stake * (multiplier - 1) : -stake;
    } else {
      // Sportsbook - convert American odds
      const odds = entry.odds || 100;
      if (entry.result === 'W') {
        if (odds > 0) {
          return stake * (odds / 100);
        } else {
          return stake * (100 / Math.abs(odds));
        }
      } else if (entry.result === 'Push') {
        return 0;
      } else {
        return -stake;
      }
    }
  };

  // Global metrics
  const globalMetrics = useMemo((): GlobalMetrics => {
    if (!entries || entries.length === 0) {
      return {
        totalEntries: 0,
        winRate: 0,
        totalPL: 0,
        roi: 0,
        avgProfitPerEntry: 0,
        maxDrawdown: 0,
        currentStreak: { type: null, count: 0 },
        totalStaked: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
      };
    }

    const totalStaked = entries.reduce((sum, e) => sum + (e.stake || 0), 0);
    const totalPL = entries.reduce((sum, e) => sum + calculatePL(e), 0);
    const wins = entries.filter(e => e.result === 'W').length;
    const losses = entries.filter(e => e.result === 'L').length;
    const pushes = entries.filter(e => e.result === 'Push').length;
    const decisioned = wins + losses;

    // Calculate max drawdown from cumulative P/L
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime() || 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    sortedEntries.forEach(e => {
      cumulative += calculatePL(e);
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Calculate current streak
    let currentStreak = { type: null as 'W' | 'L' | null, count: 0 };
    for (let i = sortedEntries.length - 1; i >= 0; i--) {
      const result = sortedEntries[i].result;
      if (result === 'Push') continue;
      if (currentStreak.type === null) {
        currentStreak.type = result as 'W' | 'L';
        currentStreak.count = 1;
      } else if (result === currentStreak.type) {
        currentStreak.count++;
      } else {
        break;
      }
    }

    return {
      totalEntries: entries.length,
      winRate: decisioned > 0 ? (wins / decisioned) * 100 : 0,
      totalPL,
      roi: totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0,
      avgProfitPerEntry: entries.length > 0 ? totalPL / entries.length : 0,
      maxDrawdown,
      currentStreak,
      totalStaked,
      wins,
      losses,
      pushes,
    };
  }, [entries]);

  // Breakdown by state
  const breakdownByState = useMemo((): BreakdownRow[] => {
    if (!entries || entries.length === 0) return [];
    const groups: Record<string, { staked: number; pl: number; wins: number; count: number }> = {};
    
    entries.forEach(e => {
      const key = e.state;
      if (!groups[key]) groups[key] = { staked: 0, pl: 0, wins: 0, count: 0 };
      groups[key].staked += e.stake || 0;
      groups[key].pl += calculatePL(e);
      groups[key].count++;
      if (e.result === 'W') groups[key].wins++;
    });

    return Object.entries(groups).map(([name, data]) => ({
      name,
      entries: data.count,
      wins: data.wins,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      totalStaked: data.staked,
      totalPL: data.pl,
      roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
    }));
  }, [entries]);

  // Breakdown by platform
  const breakdownByPlatform = useMemo((): BreakdownRow[] => {
    if (!entries || entries.length === 0) return [];
    const groups: Record<string, { staked: number; pl: number; wins: number; count: number }> = {};
    
    entries.forEach(e => {
      const key = e.platform;
      if (!groups[key]) groups[key] = { staked: 0, pl: 0, wins: 0, count: 0 };
      groups[key].staked += e.stake || 0;
      groups[key].pl += calculatePL(e);
      groups[key].count++;
      if (e.result === 'W') groups[key].wins++;
    });

    return Object.entries(groups).map(([name, data]) => ({
      name,
      entries: data.count,
      wins: data.wins,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      totalStaked: data.staked,
      totalPL: data.pl,
      roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
    }));
  }, [entries]);

  // Breakdown by format
  const breakdownByFormat = useMemo((): BreakdownRow[] => {
    if (!entries || entries.length === 0) return [];
    const groups: Record<string, { staked: number; pl: number; wins: number; count: number }> = {};
    
    entries.forEach(e => {
      const key = e.format_tag;
      if (!groups[key]) groups[key] = { staked: 0, pl: 0, wins: 0, count: 0 };
      groups[key].staked += e.stake || 0;
      groups[key].pl += calculatePL(e);
      groups[key].count++;
      if (e.result === 'W') groups[key].wins++;
    });

    return Object.entries(groups).map(([name, data]) => ({
      name,
      entries: data.count,
      wins: data.wins,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      totalStaked: data.staked,
      totalPL: data.pl,
      roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
    }));
  }, [entries]);

  // Breakdown by market
  const breakdownByMarket = useMemo((): BreakdownRow[] => {
    if (!entries || entries.length === 0) return [];
    const groups: Record<string, { staked: number; pl: number; wins: number; count: number }> = {};
    
    entries.forEach(e => {
      const key = e.market;
      if (!groups[key]) groups[key] = { staked: 0, pl: 0, wins: 0, count: 0 };
      groups[key].staked += e.stake || 0;
      groups[key].pl += calculatePL(e);
      groups[key].count++;
      if (e.result === 'W') groups[key].wins++;
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        entries: data.count,
        wins: data.wins,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
        totalStaked: data.staked,
        totalPL: data.pl,
        roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
      }))
      .sort((a, b) => b.roi - a.roi);
  }, [entries]);

  // Breakdown by selection
  const breakdownBySelection = useMemo((): BreakdownRow[] => {
    if (!entries || entries.length === 0) return [];
    const groups: Record<string, { staked: number; pl: number; wins: number; count: number }> = {};
    
    entries.forEach(e => {
      const key = e.side || 'Unknown';
      if (!groups[key]) groups[key] = { staked: 0, pl: 0, wins: 0, count: 0 };
      groups[key].staked += e.stake || 0;
      groups[key].pl += calculatePL(e);
      groups[key].count++;
      if (e.result === 'W') groups[key].wins++;
    });

    return Object.entries(groups).map(([name, data]) => ({
      name,
      entries: data.count,
      wins: data.wins,
      winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      totalStaked: data.staked,
      totalPL: data.pl,
      roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
    }));
  }, [entries]);

  // Confidence bands
  const confidenceBands = useMemo((): ConfidenceBand[] => {
    if (!entries || entries.length === 0) return [];
    
    const bandData: Record<string, { entries: PickEntry[] }> = {};
    CONFIDENCE_BANDS.forEach(b => bandData[b.band] = { entries: [] });
    
    entries.forEach(e => {
      // Extract confidence_score from AI columns if they exist
      const confidenceScore = (e as any).confidence_score ?? (e as any).ai_confidence ?? null;
      
      if (confidenceScore === null || confidenceScore === undefined) {
        bandData['Unscored'].entries.push(e);
      } else {
        const score = Number(confidenceScore);
        for (const band of CONFIDENCE_BANDS) {
          if (band.band === 'Unscored') continue;
          if (score >= band.minScore && score <= band.maxScore) {
            bandData[band.band].entries.push(e);
            break;
          }
        }
      }
    });

    return CONFIDENCE_BANDS.map(band => {
      const bandEntries = bandData[band.band].entries;
      const totalStaked = bandEntries.reduce((sum, e) => sum + (e.stake || 0), 0);
      const totalPL = bandEntries.reduce((sum, e) => sum + calculatePL(e), 0);
      const wins = bandEntries.filter(e => e.result === 'W').length;
      
      return {
        band: band.band,
        minScore: band.minScore,
        maxScore: band.maxScore,
        entries: bandEntries.length,
        wins,
        winRate: bandEntries.length > 0 ? (wins / bandEntries.length) * 100 : 0,
        totalStaked,
        totalPL,
        roi: totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0,
      };
    }).filter(b => b.entries > 0);
  }, [entries]);

  // Daily performance
  const dailyPerformance = useMemo((): DailyPerformance[] => {
    if (!entries || entries.length === 0) return [];
    
    const dailyGroups: Record<string, { staked: number; pl: number; entries: number }> = {};
    
    entries.forEach(e => {
      const date = e.date;
      if (!dailyGroups[date]) dailyGroups[date] = { staked: 0, pl: 0, entries: 0 };
      dailyGroups[date].staked += e.stake || 0;
      dailyGroups[date].pl += calculatePL(e);
      dailyGroups[date].entries++;
    });

    const sorted = Object.entries(dailyGroups)
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    let cumulative = 0;
    return sorted.map(([date, data]) => {
      cumulative += data.pl;
      return {
        date,
        totalStaked: data.staked,
        totalPL: data.pl,
        roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
        cumulativePL: cumulative,
        entries: data.entries,
      };
    });
  }, [entries]);

  // Performance insights
  const insights = useMemo((): string[] => {
    const result: string[] = [];
    
    if (!entries || entries.length === 0) {
      result.push('No settled entries yet. Start tracking to see insights.');
      return result;
    }

    // Best market by ROI
    if (breakdownByMarket.length > 0) {
      const bestMarket = breakdownByMarket[0];
      if (bestMarket.roi > 0) {
        result.push(`Your best ROI is in ${bestMarket.name} markets (${bestMarket.roi.toFixed(1)}% ROI).`);
      }
    }

    // MORE vs LESS comparison
    const moreRow = breakdownBySelection.find(r => r.name === 'MORE');
    const lessRow = breakdownBySelection.find(r => r.name === 'LESS');
    if (moreRow && lessRow) {
      const diff = moreRow.roi - lessRow.roi;
      if (Math.abs(diff) > 5) {
        const better = diff > 0 ? 'MORE' : 'LESS';
        result.push(`${better} selections outperform by ${Math.abs(diff).toFixed(1)}% ROI.`);
      }
    }

    // Best confidence band
    const profitableBands = confidenceBands.filter(b => b.roi > 0 && b.band !== 'Unscored');
    if (profitableBands.length > 0) {
      const bestBand = profitableBands.reduce((a, b) => a.roi > b.roi ? a : b);
      result.push(`Band ${bestBand.band} shows strongest performance (${bestBand.roi.toFixed(1)}% ROI, ${bestBand.winRate.toFixed(0)}% win rate).`);
    }

    // Suggested confidence threshold
    const sortedBands = confidenceBands
      .filter(b => b.band !== 'Unscored' && b.entries >= 3)
      .sort((a, b) => a.minScore - b.minScore);
    
    let bestThreshold = 50;
    let bestThresholdROI = globalMetrics.roi;
    
    for (let threshold = 55; threshold <= 85; threshold += 5) {
      const aboveThreshold = sortedBands.filter(b => b.minScore >= threshold);
      if (aboveThreshold.length === 0) continue;
      
      const totalStaked = aboveThreshold.reduce((sum, b) => sum + b.totalStaked, 0);
      const totalPL = aboveThreshold.reduce((sum, b) => sum + b.totalPL, 0);
      const roi = totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0;
      
      if (roi > bestThresholdROI) {
        bestThreshold = threshold;
        bestThresholdROI = roi;
      }
    }
    
    if (bestThreshold > 50) {
      result.push(`Recommended minimum confidence: ${bestThreshold}% (projected ${bestThresholdROI.toFixed(1)}% ROI).`);
    }

    // Win rate insight
    if (globalMetrics.winRate > 55) {
      result.push(`Strong ${globalMetrics.winRate.toFixed(1)}% win rate across ${globalMetrics.totalEntries} entries.`);
    }

    return result;
  }, [entries, breakdownByMarket, breakdownBySelection, confidenceBands, globalMetrics]);

  return {
    entries,
    isLoading,
    refetch,
    globalMetrics,
    breakdownByState,
    breakdownByPlatform,
    breakdownByFormat,
    breakdownByMarket,
    breakdownBySelection,
    confidenceBands,
    dailyPerformance,
    insights,
    calculatePL,
  };
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
  state: 'all',
  platform: 'all',
  sport: 'NBA',
  formatTag: 'all',
  decisionSource: 'all',
  market: '',
  selection: 'all',
};
