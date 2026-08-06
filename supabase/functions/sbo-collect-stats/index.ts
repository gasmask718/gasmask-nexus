import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bounded sweep: process at most BATCH rows per invocation (hourly cron drains the backlog)
const BATCH = 500;

function normalize(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startTime = Date.now();
  const { data: logEntry } = await supabase.from('sbo_function_logs').insert({
    function_name: 'sbo-collect-stats', status: 'running',
  }).select('id').single();
  const logId = logEntry?.id;

  try {
    // 1. Fetch ONE bounded batch of props missing stats.
    //    Watermark: never-checked rows first (nulls first), then oldest-checked.
    const { data: missingRows, error: missingErr } = await supabase
      .from('props_master')
      .select('id, player_name, stat_type, line, game_date')
      .is('season_avg', null)
      .order('stats_checked_at', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .limit(BATCH);

    if (missingErr) throw missingErr;
    const missing = missingRows || [];

    if (missing.length === 0) {
      if (logId) await supabase.from('sbo_function_logs').update({ status: 'completed', records_processed: 0, duration_ms: Date.now() - startTime, completed_at: new Date().toISOString() }).eq('id', logId);
      return new Response(JSON.stringify({ success: true, analyzed: 0, failed: 0, batch_size: 0, message: 'No props missing stats' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[collect-stats] Batch of ${missing.length} props missing stats`);

    // 2. Stamp the watermark IMMEDIATELY so unmatched rows rotate out of the front of the queue.
    const stampedAt = new Date().toISOString();
    const batchIds = missing.map((m: any) => m.id);
    for (let i = 0; i < batchIds.length; i += 100) {
      const { error: stampErr } = await supabase
        .from('props_master')
        .update({ stats_checked_at: stampedAt })
        .in('id', batchIds.slice(i, i + 100));
      if (stampErr) console.warn('[collect-stats] Watermark stamp error:', stampErr.message);
    }

    // 3. Fetch stat context scoped to THIS batch's players only.
    const players = Array.from(new Set(missing.map((m: any) => m.player_name).filter(Boolean)));
    const allStats: any[] = [];
    for (let i = 0; i < players.length; i += 100) {
      const { data, error } = await supabase
        .from('sbo_prop_stat_context')
        .select('player_name, stat_type, season_avg, last_5_avg, last_10_avg, vs_opponent_avg, confidence_score')
        .not('season_avg', 'is', null)
        .in('player_name', players.slice(i, i + 100));
      if (error) throw error;
      if (data) allStats.push(...data);
    }

    // Build normalized lookup — keep highest confidence per player+stat
    const statMap: Record<string, any> = {};
    for (const s of allStats) {
      const key = `${normalize(s.player_name)}::${normalize(s.stat_type)}`;
      if (!statMap[key] || (s.confidence_score || 0) > (statMap[key].confidence_score || 0)) {
        statMap[key] = s;
      }
    }
    console.log(`[collect-stats] Stat context unique keys: ${Object.keys(statMap).length} for ${players.length} players`);

    // 4. Group batch props and match
    let updated = 0;
    let noMatch = 0;

    const grouped: Record<string, string[]> = {};
    for (const prop of missing) {
      const key = `${normalize(prop.player_name)}::${normalize(prop.stat_type)}`;
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

    // 5. Execute batch updates
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
            stats_checked_at: stampedAt,
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

    const duration = Date.now() - startTime;
    if (logId) await supabase.from('sbo_function_logs').update({
      status: 'completed', records_processed: updated, records_skipped: noMatch,
      duration_ms: duration, completed_at: new Date().toISOString(),
      metadata: { stat_entries: Object.keys(statMap).length, batch_size: missing.length, players: players.length },
    }).eq('id', logId);

    return new Response(JSON.stringify({
      success: true,
      analyzed: updated,
      failed: 0,
      skipped: noMatch,
      batch_size: missing.length,
      players_in_batch: players.length,
      stat_entries_available: Object.keys(statMap).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[collect-stats] Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (logId) await supabase.from('sbo_function_logs').update({
      status: 'failed', error_message: msg, duration_ms: Date.now() - startTime, completed_at: new Date().toISOString(),
    }).eq('id', logId);
    return new Response(JSON.stringify({
      success: false,
      error: msg,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
