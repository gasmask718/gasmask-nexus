import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Paginated fetch to bypass 1000-row limit
async function fetchAllFiltered(supabase: any, table: string, select: string, filters?: (q: any) => any) {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select);
    if (filters) q = filters(q);
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Find ALL props_master rows missing stats (paginated)
    const missing = await fetchAll(
      supabase, 'props_master',
      'id, player_name, stat_type, line, game_date',
      (q: any) => q.is('season_avg', null).order('game_date', { ascending: false })
    );

    if (missing.length === 0) {
      return new Response(JSON.stringify({ success: true, analyzed: 0, failed: 0, message: 'No props missing stats' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[collect-stats] Found ${missing.length} props missing stats`);

    // 2. Load ALL stat context (paginated)
    const allStats = await fetchAll(
      supabase, 'sbo_prop_stat_context',
      'player_name, stat_type, season_avg, last_5_avg, last_10_avg, vs_opponent_avg, confidence_score',
      (q: any) => q.not('season_avg', 'is', null)
    );

    // Build lookup with normalized keys
    const statMap: Record<string, any> = {};
    for (const s of allStats) {
      const key = `${s.player_name.toLowerCase().trim()}::${s.stat_type.toLowerCase().trim()}`;
      if (!statMap[key] || (s.confidence_score || 0) > (statMap[key].confidence_score || 0)) {
        statMap[key] = s;
      }
    }
    console.log(`[collect-stats] Stat context entries: ${Object.keys(statMap).length}`);

    // 3. Match and update
    let updated = 0;
    let noMatch = 0;

    const grouped: Record<string, string[]> = {};
    for (const prop of missing) {
      const key = `${prop.player_name.toLowerCase().trim()}::${prop.stat_type.toLowerCase().trim()}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(prop.id);
    }

    const updates: { ids: string[]; stats: any }[] = [];
    for (const [key, ids] of Object.entries(grouped)) {
      const stat = statMap[key];
      if (stat) {
        updates.push({ ids, stats: stat });
      } else {
        noMatch += ids.length;
      }
    }

    for (const upd of updates) {
      const hitRate = upd.stats.season_avg && upd.stats.season_avg > 0
        ? Math.min(100, Math.round((upd.stats.season_avg / (upd.stats.season_avg + 2)) * 100))
        : null;

      for (let i = 0; i < upd.ids.length; i += 50) {
        const batch = upd.ids.slice(i, i + 50);
        const { error: updErr } = await supabase
          .from('props_master')
          .update({
            season_avg: upd.stats.season_avg,
            last_5_avg: upd.stats.last_5_avg || null,
            last_10_avg: upd.stats.last_10_avg || null,
            hit_rate: hitRate,
            matchup_avg: upd.stats.vs_opponent_avg || null,
            updated_at: new Date().toISOString(),
          })
          .in('id', batch);

        if (updErr) {
          console.warn(`[collect-stats] Update error:`, updErr.message);
        } else {
          updated += batch.length;
        }
      }
    }

    console.log(`[collect-stats] Updated: ${updated}, No match: ${noMatch}`);

    return new Response(JSON.stringify({
      success: true,
      analyzed: updated,
      failed: 0,
      skipped: noMatch,
      total_missing: missing.length,
      stat_entries_available: Object.keys(statMap).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[collect-stats] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
