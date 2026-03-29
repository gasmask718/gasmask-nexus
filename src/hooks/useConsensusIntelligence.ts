import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CapperKPI {
  id: string;
  name: string;
  tier: string;
  totalPicks: number;
  wins: number;
  losses: number;
  winRate: number;
  roi: number;
  consensusHitRate: number;
  bestMarket: string;
  badge: 'high_roi' | 'low_accuracy' | 'neutral';
  currentStreak: number;
  grade: string;
  weight: number;
}

export interface ConsensusPick {
  player_name: string;
  prop_type: string;
  line: number;
  direction: string;
  game_date: string;
  sport: string;
  team: string | null;
  capperCount: number;
  capperNames: string[];
  avgCapperROI: number;
  avgCapperWinRate: number;
  result: string | null;
  confidenceLevel: 'high' | 'medium' | 'normal';
}

export interface ConsensusStats {
  totalConsensusPicks: number;
  consensusWinRate: number;
  consensusROI: number;
  highConsensusWinRate: number;
  mediumConsensusWinRate: number;
}

export function useConsensusIntelligence() {
  // Fetch all resolved picks with capper info
  const { data: allPicks = [], isLoading: picksLoading } = useQuery({
    queryKey: ['consensus-intel-picks'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_picks')
        .select('id, capper_id, player_name, prop_type, line, direction, game_date, sport, team, result, bet_type, sbo_cappers(name, tier, win_rate)')
        .not('player_name', 'is', null)
        .not('prop_type', 'is', null)
        .not('line', 'is', null)
        .order('game_date', { ascending: false })
        .limit(1000);
      return data || [];
    },
  });

  // Fetch capper performance data
  const { data: capperPerf = [], isLoading: perfLoading } = useQuery({
    queryKey: ['consensus-intel-perf'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_performance')
        .select('*');
      return data || [];
    },
  });

  // Fetch cappers
  const { data: cappers = [] } = useQuery({
    queryKey: ['consensus-intel-cappers'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_cappers')
        .select('*');
      return data || [];
    },
  });

  // Build consensus groups
  const { consensusPicks, consensusStats, capperKPIs, todayConsensusPicks } = useMemo(() => {
    // Group picks by key (player+stat+line+date)
    const groups = new Map<string, typeof allPicks>();
    for (const p of allPicks) {
      const key = `${(p.player_name || '').toLowerCase().trim()}|${(p.prop_type || '').toLowerCase()}|${p.line}|${p.game_date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    // Build consensus picks (2+ cappers)
    const cPicks: ConsensusPick[] = [];
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      const uniqueCappers = new Map<string, any>();
      for (const p of group) {
        if (!uniqueCappers.has(p.capper_id)) uniqueCappers.set(p.capper_id, p);
      }
      if (uniqueCappers.size < 2) continue;

      const first = group[0];
      const capperNames = [...uniqueCappers.values()].map(p => p.sbo_cappers?.name || 'Unknown');
      
      // Get avg ROI/WR from perf data
      const capperIds = [...uniqueCappers.keys()];
      const relevantPerfs = capperPerf.filter((p: any) => capperIds.includes(p.capper_id));
      const avgROI = relevantPerfs.length > 0
        ? relevantPerfs.reduce((s: number, p: any) => s + (p.roi_pct || 0), 0) / relevantPerfs.length
        : 0;
      const avgWR = relevantPerfs.length > 0
        ? relevantPerfs.reduce((s: number, p: any) => s + (p.win_rate || 0), 0) / relevantPerfs.length
        : 0;

      // Result: use any resolved pick in the group
      const resolvedPick = group.find((p: any) => p.result === 'won' || p.result === 'lost' || p.result === 'push');

      cPicks.push({
        player_name: first.player_name,
        prop_type: first.prop_type,
        line: first.line,
        direction: first.direction || '',
        game_date: first.game_date,
        sport: first.sport || 'NBA',
        team: first.team,
        capperCount: uniqueCappers.size,
        capperNames,
        avgCapperROI: Math.round(avgROI * 100) / 100,
        avgCapperWinRate: Math.round(avgWR * 100) / 100,
        result: resolvedPick?.result || null,
        confidenceLevel: uniqueCappers.size >= 4 ? 'high' : uniqueCappers.size >= 2 ? 'medium' : 'normal',
      });
    }

    cPicks.sort((a, b) => b.capperCount - a.capperCount || b.avgCapperROI - a.avgCapperROI);

    // Consensus stats
    const resolved = cPicks.filter(p => p.result === 'won' || p.result === 'lost');
    const wins = resolved.filter(p => p.result === 'won').length;
    const highRes = resolved.filter(p => p.confidenceLevel === 'high');
    const highWins = highRes.filter(p => p.result === 'won').length;
    const medRes = resolved.filter(p => p.confidenceLevel === 'medium');
    const medWins = medRes.filter(p => p.result === 'won').length;

    const cStats: ConsensusStats = {
      totalConsensusPicks: cPicks.length,
      consensusWinRate: resolved.length > 0 ? Math.round((wins / resolved.length) * 10000) / 100 : 0,
      consensusROI: resolved.length > 0
        ? Math.round(((wins * 0.909 - (resolved.length - wins)) / resolved.length) * 10000) / 100
        : 0,
      highConsensusWinRate: highRes.length > 0 ? Math.round((highWins / highRes.length) * 10000) / 100 : 0,
      mediumConsensusWinRate: medRes.length > 0 ? Math.round((medWins / medRes.length) * 10000) / 100 : 0,
    };

    // Capper KPIs
    const kpis: CapperKPI[] = cappers.map((c: any) => {
      const cPick = allPicks.filter((p: any) => p.capper_id === c.id);
      const cResolved = cPick.filter((p: any) => p.result === 'won' || p.result === 'lost');
      const cWins = cResolved.filter((p: any) => p.result === 'won').length;
      const cLosses = cResolved.length - cWins;
      const winRate = cResolved.length > 0 ? Math.round((cWins / cResolved.length) * 10000) / 100 : 0;
      const roi = cResolved.length > 0
        ? Math.round(((cWins * 0.909 - cLosses) / cResolved.length) * 10000) / 100
        : 0;

      // Consensus hit rate: % of this capper's picks that were also consensus
      const consensusHits = cPick.filter((p: any) => {
        const key = `${(p.player_name || '').toLowerCase().trim()}|${(p.prop_type || '').toLowerCase()}|${p.line}|${p.game_date}`;
        const group = groups.get(key);
        if (!group) return false;
        const uniqueIds = new Set(group.map((g: any) => g.capper_id));
        return uniqueIds.size >= 2;
      });
      const consensusHitRate = cPick.length > 0
        ? Math.round((consensusHits.length / cPick.length) * 10000) / 100
        : 0;

      // Best market
      const marketMap = new Map<string, { wins: number; total: number }>();
      for (const p of cResolved) {
        const mkt = p.prop_type || p.bet_type || 'unknown';
        if (!marketMap.has(mkt)) marketMap.set(mkt, { wins: 0, total: 0 });
        const m = marketMap.get(mkt)!;
        m.total++;
        if (p.result === 'won') m.wins++;
      }
      let bestMarket = '—';
      let bestWR = 0;
      for (const [mkt, stats] of marketMap) {
        if (stats.total >= 2) {
          const wr = stats.wins / stats.total;
          if (wr > bestWR) { bestWR = wr; bestMarket = mkt; }
        }
      }

      const badge: CapperKPI['badge'] = roi > 5 ? 'high_roi' : winRate < 45 && cResolved.length >= 5 ? 'low_accuracy' : 'neutral';

      // Current streak
      const recentResults = cResolved.map((p: any) => p.result);
      let streak = 0;
      for (let i = recentResults.length - 1; i >= 0; i--) {
        if (i === recentResults.length - 1) {
          streak = recentResults[i] === 'won' ? 1 : -1;
        } else {
          if (recentResults[i] === 'won' && streak > 0) streak++;
          else if (recentResults[i] === 'lost' && streak < 0) streak--;
          else break;
        }
      }

      return {
        id: c.id,
        name: c.name,
        tier: c.tier || 'unproven',
        totalPicks: cPick.length,
        wins: cWins,
        losses: cLosses,
        winRate,
        roi,
        consensusHitRate,
        bestMarket,
        badge,
        currentStreak: streak,
        grade: c.grade || c.confidence_grade || 'D',
        weight: c.capper_weight || 1.0,
      };
    });

    kpis.sort((a, b) => b.roi - a.roi);

    // Today's consensus picks
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayCP = cPicks.filter(p => p.game_date === today);

    return { consensusPicks: cPicks, consensusStats: cStats, capperKPIs: kpis, todayConsensusPicks: todayCP };
  }, [allPicks, capperPerf, cappers]);

  return {
    consensusPicks,
    consensusStats,
    capperKPIs,
    todayConsensusPicks,
    isLoading: picksLoading || perfLoading,
  };
}
