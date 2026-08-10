import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrossPlatformProp {
  player_name: string;
  prop_type: string;
  game_date: string;
  game_id: string | null;
  prop_id: string | null;
  sources: {
    source: string;
    line: number;
    over_odds: number | null;
    under_odds: number | null;
    id: string;
  }[];
  best_over: { source: string; line: number; odds: number | null } | null;
  best_under: { source: string; line: number; odds: number | null } | null;
  line_spread: number;
  has_edge: boolean;
}

export function useCrossPlatformProps(date?: string) {
  const todayEST = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  return useQuery({
    queryKey: ['cross-platform-props', todayEST],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_player_props')
        .select('id, player_name, team, prop_type, line, over_odds, under_odds, source, game_id, game_date')
        .gte('game_date', todayEST)
        .lte('game_date', todayEST + 'T23:59:59')
        // PHASE 3 / ITEM 8 — bounded read (single-day slate); table exceeds the 1k PostgREST default.
        .limit(1000)
        .order('player_name');

      if (error) throw error;
      if (!data?.length) return [];

      // Group by player + prop_type
      const grouped: Record<string, any[]> = {};
      for (const prop of data) {
        const key = `${prop.player_name}::${prop.prop_type}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(prop);
      }

      // Build cross-platform entries (only where 2+ sources exist)
      const results: CrossPlatformProp[] = [];

      for (const [key, props] of Object.entries(grouped)) {
        const sources = props.map((p: any) => ({
          source: p.source || 'manual',
          line: p.line,
          over_odds: p.over_odds,
          under_odds: p.under_odds,
          id: p.id,
        }));

        // Find best over (lowest line = best for over)
        const sortedByLineAsc = [...sources].sort((a, b) => a.line - b.line);
        const bestOver = sortedByLineAsc[0]
          ? { source: sortedByLineAsc[0].source, line: sortedByLineAsc[0].line, odds: sortedByLineAsc[0].over_odds }
          : null;

        // Find best under (highest line = best for under)
        const sortedByLineDesc = [...sources].sort((a, b) => b.line - a.line);
        const bestUnder = sortedByLineDesc[0]
          ? { source: sortedByLineDesc[0].source, line: sortedByLineDesc[0].line, odds: sortedByLineDesc[0].under_odds }
          : null;

        const lines = sources.map((s: any) => s.line);
        const lineSpread = Math.max(...lines) - Math.min(...lines);

        results.push({
          player_name: props[0].player_name,
          prop_type: props[0].prop_type,
          game_date: props[0].game_date,
          game_id: props[0].game_id,
          prop_id: props[0].id,
          sources,
          best_over: bestOver,
          best_under: bestUnder,
          line_spread: lineSpread,
          has_edge: lineSpread >= 1.5,
        });
      }

      // Sort: multi-source edges first, then by line spread
      return results.sort((a, b) => {
        if (a.sources.length > 1 && b.sources.length <= 1) return -1;
        if (b.sources.length > 1 && a.sources.length <= 1) return 1;
        return b.line_spread - a.line_spread;
      });
    },
    refetchInterval: 60000,
  });
}
