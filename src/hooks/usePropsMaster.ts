import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useMemo, useCallback } from 'react';

export interface PropMaster {
  id: string;
  player_name: string;
  team: string | null;
  opponent: string | null;
  sport: string;
  stat_type: string;
  line: number;
  platform: string;
  odds: string | null;
  game_time: string | null;
  game_date: string | null;
  source: string;
  prediction: string | null;
  confidence_score: number | null;
  edge_score: number | null;
  reasoning_json: any;
  season_avg: number | null;
  last_5_avg: number | null;
  last_10_avg: number | null;
  hit_rate: number | null;
  matchup_avg: number | null;
  actual_result: number | null;
  result: string;
  settled_at: string | null;
  batch_id: string | null;
  upload_group_id: string | null;
  original_image_url: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = 'props-master';

// ── Paginated props query ────────────────────────────────────────────────────
export type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'all';

export function getDateRangeForTimeRange(range: TimeRange): { start?: string; end?: string } {
  const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const d = new Date(todayEST + 'T00:00:00');
  switch (range) {
    case 'today':
      return { start: todayEST, end: todayEST };
    case 'yesterday': {
      const y = new Date(d);
      y.setDate(y.getDate() - 1);
      const ys = y.toISOString().slice(0, 10);
      return { start: ys, end: ys };
    }
    case '7d': {
      const s = new Date(d);
      s.setDate(s.getDate() - 6);
      return { start: s.toISOString().slice(0, 10), end: todayEST };
    }
    case '30d': {
      const s = new Date(d);
      s.setDate(s.getDate() - 29);
      return { start: s.toISOString().slice(0, 10), end: todayEST };
    }
    default:
      return {};
  }
}

function applyDateRange(query: any, range?: TimeRange) {
  if (!range || range === 'all') return query;
  const { start, end } = getDateRangeForTimeRange(range);
  if (start) query = query.gte('game_date', start);
  if (end) query = query.lte('game_date', end);
  return query;
}

export function usePropsMaster(filters?: {
  platform?: string;
  gameDate?: string;
  timeRange?: TimeRange;
  minConfidence?: number;
  result?: string;
  searchPlayer?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 100;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: [KEY, filters],
    queryFn: async () => {
      let query = (supabase.from('props_master') as any)
        .select('*', { count: 'exact' })
        .order('confidence_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filters?.platform && filters.platform !== 'all') {
        query = query.eq('platform', filters.platform);
      }
      if (filters?.gameDate) {
        query = query.eq('game_date', filters.gameDate);
      } else if (filters?.timeRange && filters.timeRange !== 'all') {
        query = applyDateRange(query, filters.timeRange);
      }
      if (filters?.minConfidence) {
        query = query.gte('confidence_score', filters.minConfidence);
      }
      if (filters?.result && filters.result !== 'all') {
        query = query.eq('result', filters.result);
      }
      if (filters?.searchPlayer) {
        query = query.ilike('player_name', `%${filters.searchPlayer}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { 
        props: (data || []) as PropMaster[], 
        totalCount: count ?? 0 
      };
    },
  });
}

// ── Full stats from DB (no row limit) ────────────────────────────────────────
export function usePropsMasterStats(gameDate?: string, timeRange?: TimeRange) {
  return useQuery({
    queryKey: ['props-master-stats', gameDate, timeRange],
    queryFn: async () => {
      // Use separate count queries to avoid row limits
      const baseFilter = (q: any) => {
        if (gameDate) return q.eq('game_date', gameDate);
        if (timeRange && timeRange !== 'all') return applyDateRange(q, timeRange);
        return q;
      };

      const [totalRes, winsRes, lossesRes, pendingRes, withPredRes, bestRes, withStatsRes, withResultsRes] = await Promise.all([
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true })),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).eq('result', 'win')),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).eq('result', 'loss')),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).eq('result', 'pending')),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).not('prediction', 'is', null)),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).gte('confidence_score', 70)),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).not('season_avg', 'is', null)),
        baseFilter((supabase.from('props_master') as any).select('*', { count: 'exact', head: true }).in('result', ['win', 'loss'])),
      ]);

      const total = totalRes.count ?? 0;
      const wins = winsRes.count ?? 0;
      const losses = lossesRes.count ?? 0;
      const pending = pendingRes.count ?? 0;
      const withPrediction = withPredRes.count ?? 0;
      const bestPicks = bestRes.count ?? 0;
      const withStats = withStatsRes.count ?? 0;
      const withResults = withResultsRes.count ?? 0;

      // Get platform breakdown with results
      const { data: platformData } = await baseFilter(
        (supabase.from('props_master') as any).select('platform, result, prediction')
      );
      const byPlatform: Record<string, { total: number; wins: number; losses: number; pending: number }> = {};
      for (const p of (Array.isArray(platformData) ? platformData : [])) {
        if (!byPlatform[p.platform]) byPlatform[p.platform] = { total: 0, wins: 0, losses: 0, pending: 0 };
        byPlatform[p.platform].total++;
        if (p.result === 'win') byPlatform[p.platform].wins++;
        if (p.result === 'loss') byPlatform[p.platform].losses++;
        if (p.result === 'pending') byPlatform[p.platform].pending++;
      }

      // Get prediction direction counts
      let overCount = 0, underCount = 0, holdCount = 0;
      for (const p of (Array.isArray(platformData) ? platformData : [])) {
        if (p.prediction === 'more' || p.prediction === 'over') overCount++;
        else if (p.prediction === 'less' || p.prediction === 'under') underCount++;
        else if (p.prediction === 'hold') holdCount++;
      }

      // Get stat type breakdown
      const { data: statData } = await baseFilter(
        (supabase.from('props_master') as any).select('stat_type, result')
      );
      const byStatType: Record<string, { total: number; wins: number; losses: number }> = {};
      for (const p of (Array.isArray(statData) ? statData : [])) {
        if (!byStatType[p.stat_type]) byStatType[p.stat_type] = { total: 0, wins: 0, losses: 0 };
        byStatType[p.stat_type].total++;
        if (p.result === 'win') byStatType[p.stat_type].wins++;
        if (p.result === 'loss') byStatType[p.stat_type].losses++;
      }

      // Get avg confidence
      const { data: confData } = await baseFilter(
        (supabase.from('props_master') as any).select('confidence_score').not('confidence_score', 'is', null).limit(1000)
      );
      const confArr = Array.isArray(confData) ? confData : [];
      const avgConfidence = confArr.length > 0
        ? Math.round(confArr.reduce((s: number, c: any) => s + (c.confidence_score || 0), 0) / confArr.length)
        : 0;

      const missingStats = total - withStats;
      const missingResults = total - withResults;
      const fullyComplete = Math.min(withStats, withResults);
      const healthPct = total > 0 ? Math.round((fullyComplete / total) * 100) : 0;

      return {
        total,
        wins,
        losses,
        pending,
        withPrediction,
        bestPicks,
        withStats,
        noStats: missingStats,
        withResults,
        missingResults,
        fullyComplete,
        healthPct,
        avgConfidence,
        winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
        byPlatform,
        byStatType,
        overCount,
        underCount,
        holdCount,
      };
    },
  });
}

export function usePropCrossIntelligence(playerName?: string, statType?: string) {
  return useQuery({
    queryKey: ['prop-cross-intel', playerName, statType],
    queryFn: async () => {
      if (!playerName || !statType) return [];
      const { data, error } = await (supabase.from('props_master') as any)
        .select('*')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        // PHASE 3 / ITEM 8 — bounded read (one player+stat); table exceeds the 1k PostgREST default.
        .limit(200)
        .order('line', { ascending: true });
      if (error) throw error;
      return (data || []) as PropMaster[];
    },
    enabled: !!playerName && !!statType,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
export function usePropMutations() {
  const qc = useQueryClient();

  const syncBooks = useMutation({
    mutationFn: async () => {
      // Step 1: Trigger API ingestion
      const { data: ingestData, error: ingestErr } = await supabase.functions.invoke('sbo-ingest-book-props', {
        body: { bookmakers: 'bovada,betonlineag,draftkings,fanduel,betmgm' },
      });
      if (ingestErr) console.warn('Ingest warning:', ingestErr.message);

      // Step 2: Sync to props_master
      const { data, error } = await supabase.functions.invoke('sbo-sync-props-master');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['props-master-stats'] });
      toast.success(`Synced ${data.synced || 0} props from all books`);
    },
    onError: (e: Error) => toast.error(`Sync failed: ${e.message}`),
  });

  const runAnalysis = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sbo-run-analysis', {
        body: {},
      });
      if (error) throw error;
      // After analysis, re-sync predictions to props_master
      await supabase.functions.invoke('sbo-sync-props-master');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['props-master-stats'] });
      toast.success('Analysis complete — predictions updated');
    },
    onError: (e: Error) => toast.error(`Analysis failed: ${e.message}`),
  });

  const uploadImage = useMutation({
    mutationFn: async (input: { imageBase64: string; platform: string }) => {
      const { data, error } = await supabase.functions.invoke('sbo-parse-prop-image', {
        body: { image: input.imageBase64, platform: input.platform },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to parse image');
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['props-master-stats'] });
      toast.success(`Parsed ${data.count || 0} props from image`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { syncBooks, runAnalysis, uploadImage };
}
