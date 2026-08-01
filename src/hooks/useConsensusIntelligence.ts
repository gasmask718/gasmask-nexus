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
  // ── Per-pick market signals (differentiate picks backed by the same cappers) ──
  avgOdds: number | null;          // average American odds across the backing cappers
  impliedProb: number | null;      // 0-1, de-juiced-free implied probability of avgOdds
  directionAgreement: number;      // 0-1, share of cappers on the majority side
  marketLine: number | null;       // live market line for player+prop+date
  lineEdgePct: number | null;      // signed edge of the capper line vs market, in the pick's direction
  marketWinRate: number | null;    // 0-100 historical hit rate of this sport+prop_type (null if <5 graded)
  marketSampleSize: number;        // graded picks behind marketWinRate
  formHitRate: number | null;      // 0-100 share of the player's recent games clearing the line, in the pick's direction
  formGames: number;               // games behind formHitRate
  formAvgStat: number | null;      // player's recent average for this stat


}

export interface ConsensusStats {
  totalConsensusPicks: number;
  consensusWinRate: number;
  consensusROI: number;
  highConsensusWinRate: number;
  mediumConsensusWinRate: number;
}

import { normalizeStat, marketPropCandidates } from '@/lib/sbo/statNormalize';

function impliedFromAmerican(odds: number | null): number | null {
  if (odds === null || odds === undefined || !Number.isFinite(odds) || odds === 0) return null;
  return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
}

export function useConsensusIntelligence() {
  // Fetch all resolved picks with capper info
  const { data: allPicks = [], isLoading: picksLoading } = useQuery({
    queryKey: ['consensus-intel-picks'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_capper_picks')
        .select('id, capper_id, player_name, prop_type, line, direction, odds, game_date, sport, team, result, bet_type, sbo_cappers(name, tier, win_rate)')
        .not('player_name', 'is', null)
        .not('prop_type', 'is', null)
        .not('line', 'is', null)
        .order('game_date', { ascending: false })
        .limit(1000);
      return data || [];
    },
  });

  // Live market lines — the per-pick reference point for line edge
  const { data: marketProps = [] } = useQuery({
    queryKey: ['consensus-intel-market-props'],
    queryFn: async () => {
      const since = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
      const { data } = await (supabase as any).from('sbo_player_props')
        .select('player_name, prop_type, line, game_date, over_odds, under_odds')
        .gte('game_date', since)
        .limit(5000);
      return data || [];
    },
  });

  // Recent player form (ESPN box scores) — the strongest per-pick signal
  const playerNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of allPicks as any[]) if (p.player_name) names.add(p.player_name);
    return [...names].slice(0, 600);
  }, [allPicks]);

  const { data: playerGameStats = [] } = useQuery({
    queryKey: ['consensus-intel-player-form', playerNames.length],
    enabled: playerNames.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const all: any[] = [];
      const CHUNK = 150;
      for (let i = 0; i < playerNames.length; i += CHUNK) {
        const { data } = await (supabase as any).from('sbo_player_game_stats')
          .select('player_name, game_date, stat_line')
          .in('player_name', playerNames.slice(i, i + CHUNK))
          .gte('game_date', since)
          .order('game_date', { ascending: false })
          .limit(5000);
        all.push(...((data as any[]) || []));
      }
      return all;
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
    // Market line lookup: player|NORMALIZED prop|date -> market row.
    // sbo_capper_picks and sbo_player_props use different prop vocabularies
    // ("strikeouts" vs "strikeouts_p", "pts+reb+ast" vs "pts_reb_ast"), so both
    // sides go through the shared normalizeStat() layer before keying.
    const marketMapByKey = new Map<string, any>();
    for (const m of marketProps as any[]) {
      const k = `${(m.player_name || '').toLowerCase().trim()}|${normalizeStat(m.prop_type || '')}|${m.game_date}`;
      if (!marketMapByKey.has(k)) marketMapByKey.set(k, m);
    }

    // Recent player form index: player -> games (desc by date)
    const PROP_STAT_KEY: Record<string, string> = {
      home_runs: 'HR', hr: 'HR', hits: 'H', total_bases: 'TB', rbis: 'RBI', rbi: 'RBI',
      runs: 'R', runs_scored: 'R', walks: 'BB', strikeouts: 'K_p', pitcher_strikeouts: 'K_p',
      strikeouts_thrown: 'K_p', batter_strikeouts: 'K_b', hits_allowed: 'H_allowed',
      earned_runs: 'ER', home_runs_allowed: 'HR_allowed', walks_allowed: 'BB_allowed',
      outs_recorded: 'OUTS', pitcher_outs: 'OUTS', innings_pitched: 'IP',
      strikeouts_pitched: 'K_p', pitching_strikeouts: 'K_p', total_hits: 'H',

    };
    const formIndex = new Map<string, any[]>();
    for (const g of playerGameStats as any[]) {
      const k = (g.player_name || '').toLowerCase().trim();
      if (!formIndex.has(k)) formIndex.set(k, []);
      formIndex.get(k)!.push(g);
    }
    for (const arr of formIndex.values()) arr.sort((a, b) => (a.game_date < b.game_date ? 1 : -1));


    // Historical hit rate per sport+prop_type (a real per-pick market signal)
    const marketHist = new Map<string, { wins: number; total: number }>();
    for (const p of allPicks as any[]) {
      if (p.result !== 'won' && p.result !== 'lost') continue;
      const mk = `${(p.sport || '').toLowerCase()}|${(p.prop_type || '').toLowerCase()}`;
      if (!marketHist.has(mk)) marketHist.set(mk, { wins: 0, total: 0 });
      const e = marketHist.get(mk)!;
      e.total++;
      if (p.result === 'won') e.wins++;
    }


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
      
      // Get avg ROI/WR from perf data (column is `roi`, not `roi_pct`)
      const capperIds = [...uniqueCappers.keys()];
      const relevantPerfs = capperPerf.filter((p: any) => capperIds.includes(p.capper_id));
      const avgROI = relevantPerfs.length > 0
        ? relevantPerfs.reduce((s: number, p: any) => s + (Number(p.roi) || 0), 0) / relevantPerfs.length
        : 0;
      const avgWR = relevantPerfs.length > 0
        ? relevantPerfs.reduce((s: number, p: any) => s + (Number(p.win_rate) || 0), 0) / relevantPerfs.length
        : 0;

      // ── Per-pick signals ──
      const members = [...uniqueCappers.values()];

      // 1) Directional agreement (the group key ignores direction, so cappers can be on opposite sides)
      const dirCounts = new Map<string, number>();
      for (const m of members) {
        const d = (m.direction || '').toLowerCase().trim() || 'unknown';
        dirCounts.set(d, (dirCounts.get(d) || 0) + 1);
      }
      let majorityDir = (first.direction || '').toLowerCase().trim();
      let majorityCount = 0;
      for (const [d, c] of dirCounts) {
        if (c > majorityCount) { majorityCount = c; majorityDir = d; }
      }
      const directionAgreement = members.length > 0 ? majorityCount / members.length : 0;

      // 2) Price: average American odds across the backing cappers
      const oddsVals = members.map(m => (m.odds === null || m.odds === undefined ? null : Number(m.odds)))
        .filter((o): o is number => o !== null && Number.isFinite(o) && o !== 0);
      const avgOdds = oddsVals.length > 0
        ? Math.round(oddsVals.reduce((s, o) => s + o, 0) / oddsVals.length)
        : null;
      const impliedProb = impliedFromAmerican(avgOdds);

      // 3) Line edge vs the live market line for this player+prop+date.
      // Try each plausible market spelling of the pick's prop (e.g. a capper's
      // "strikeouts" is either strikeouts_p or strikeouts_b in the market table).
      const mPlayer = (first.player_name || '').toLowerCase().trim();
      let marketRow: any = null;
      for (const cand of marketPropCandidates(first.prop_type || '')) {
        marketRow = marketMapByKey.get(`${mPlayer}|${cand}|${first.game_date}`);
        if (marketRow) break;
      }
      const marketLine = marketRow && marketRow.line !== null ? Number(marketRow.line) : null;
      let lineEdgePct: number | null = null;
      if (marketLine !== null && Number.isFinite(Number(first.line)) && Math.abs(marketLine) > 0) {
        const pickLine = Number(first.line);
        // Over wants the lowest possible line; under wants the highest.
        const raw = majorityDir.startsWith('u') ? pickLine - marketLine : marketLine - pickLine;
        lineEdgePct = raw / Math.abs(marketLine);
      }

      // 3b) Recent player form vs this exact line/direction
      let formHitRate: number | null = null;
      let formAvgStat: number | null = null;
      let formGames = 0;
      const statKey = PROP_STAT_KEY[(first.prop_type || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')];
      const pickLineNum = Number(first.line);
      if (statKey && Number.isFinite(pickLineNum)) {
        const games = (formIndex.get((first.player_name || '').toLowerCase().trim()) || [])
          .filter((g: any) => g.game_date < first.game_date)
          .slice(0, 15)
          .map((g: any) => Number(g.stat_line?.[statKey]))
          .filter((v: number) => Number.isFinite(v));
        formGames = games.length;
        if (formGames >= 5) {
          const isUnder = majorityDir.startsWith('u');
          const hits = games.filter((v) => (isUnder ? v < pickLineNum : v > pickLineNum)).length;
          formHitRate = Math.round((hits / formGames) * 1000) / 10;
          formAvgStat = Math.round((games.reduce((s, v) => s + v, 0) / formGames) * 100) / 100;
        }
      }


      // 4) Historical hit rate of this market (sport + prop_type)
      const histEntry = marketHist.get(`${(first.sport || '').toLowerCase()}|${(first.prop_type || '').toLowerCase()}`);
      const marketSampleSize = histEntry?.total || 0;
      const marketWinRate = histEntry && histEntry.total >= 5
        ? Math.round((histEntry.wins / histEntry.total) * 1000) / 10
        : null;


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
        avgOdds,
        impliedProb,
        directionAgreement,
        marketLine,
        lineEdgePct: lineEdgePct === null ? null : Math.round(lineEdgePct * 10000) / 10000,
        marketWinRate,
        marketSampleSize,
        formHitRate,
        formGames,
        formAvgStat,

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
  }, [allPicks, capperPerf, cappers, marketProps, playerGameStats]);

  return {
    consensusPicks,
    consensusStats,
    capperKPIs,
    todayConsensusPicks,
    isLoading: picksLoading || perfLoading,
  };
}
