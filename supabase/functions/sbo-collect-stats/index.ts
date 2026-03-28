import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Paginated fetch of ALL props missing stats (cursor-based using id)
    const PAGE = 1000;
    let missing: any[] = [];
    let lastId = '00000000-0000-0000-0000-000000000000';
    while (true) {
      const { data, error } = await supabase
        .from('props_master')
        .select('id, player_name, stat_type, line, game_date')
        .is('season_avg', null)
        .gt('id', lastId)
        .order('id', { ascending: true })
        .limit(PAGE);
      if (error) throw error;
      if (!data || data.length === 0) break;
      missing = missing.concat(data);
      lastId = data[data.length - 1].id;
      if (data.length < PAGE) break;
    }

    if (missing.length === 0) {
      return new Response(JSON.stringify({ success: true, analyzed: 0, failed: 0, message: 'No props missing stats' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[collect-stats] Found ${missing.length} props missing stats`);

    // 2. Paginated fetch of ALL stat context
    let allStats: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('sbo_prop_stat_context')
        .select('player_name, stat_type, season_avg, last_5_avg, last_10_avg, vs_opponent_avg, confidence_score')
        .not('season_avg', 'is', null)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allStats = allStats.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Build normalized lookup
    const statMap: Record<string, any> = {};
    for (const s of allStats) {
      const key = `${s.player_name.toLowerCase().trim()}::${s.stat_type.toLowerCase().trim()}`;
      if (!statMap[key] || (s.confidence_score || 0) > (statMap[key].confidence_score || 0)) {
        statMap[key] = s;
      }
    }
    console.log(`[collect-stats] Stat context unique keys: ${Object.keys(statMap).length}`);

    // 3. Group missing props by player+stat, match to context
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

    // 4. Execute batch updates
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
