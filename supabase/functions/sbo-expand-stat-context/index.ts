import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PAGE = 1000;

function normalize(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
}

async function paginatedFetch(supabase: any, query: () => any) {
  let all: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query().range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
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

  const startTime = Date.now();
  const { data: logEntry } = await supabase.from('sbo_function_logs').insert({
    function_name: 'sbo-expand-stat-context', status: 'running',
  }).select('id').single();
  const logId = logEntry?.id;

  try {
    // 1. Fetch ALL props_master (paginated)
    const allProps = await paginatedFetch(supabase, () =>
      supabase.from('props_master').select('player_name, stat_type, line, game_date').order('game_date', { ascending: false })
    );
    console.log(`[expand-context] Total props fetched: ${allProps.length}`);

    // 2. Fetch ALL existing context with season_avg status
    const existing = await paginatedFetch(supabase, () =>
      supabase.from('sbo_prop_stat_context').select('id, player_name, stat_type, season_avg')
    );

    const keysWithStats = new Set<string>();
    const keysWithoutStats = new Map<string, string[]>();
    const allExistingKeys = new Set<string>();

    for (const e of existing) {
      const key = `${normalize(e.player_name)}::${normalize(e.stat_type)}`;
      allExistingKeys.add(key);
      if (e.season_avg != null) {
        keysWithStats.add(key);
      } else {
        if (!keysWithoutStats.has(key)) keysWithoutStats.set(key, []);
        keysWithoutStats.get(key)!.push(e.id);
      }
    }
    console.log(`[expand-context] Keys with stats: ${keysWithStats.size}, Keys missing stats: ${keysWithoutStats.size}`);

    // 3. Build line averages from props
    const lineMap: Record<string, number[]> = {};
    for (const p of allProps) {
      const key = `${normalize(p.player_name)}::${normalize(p.stat_type)}`;
      if (!lineMap[key]) lineMap[key] = [];
      if (p.line != null) lineMap[key].push(Number(p.line));
    }

    // 4. Insert truly missing combos
    const missingEntries: { player_name: string; stat_type: string; lines: number[]; latest_date: string }[] = [];
    const seenMissing = new Set<string>();
    for (const p of allProps) {
      const key = `${normalize(p.player_name)}::${normalize(p.stat_type)}`;
      if (allExistingKeys.has(key) || seenMissing.has(key)) continue;
      seenMissing.add(key);
      missingEntries.push({
        player_name: p.player_name,
        stat_type: p.stat_type,
        lines: lineMap[key] || [],
        latest_date: p.game_date,
      });
    }

    let inserted = 0;
    const BATCH = 100;
    for (let i = 0; i < missingEntries.length; i += BATCH) {
      const batch = missingEntries.slice(i, i + BATCH);
      const rows = batch.map(m => {
        const avg = m.lines.length > 0 ? Math.round((m.lines.reduce((a, b) => a + b, 0) / m.lines.length) * 100) / 100 : null;
        const l5 = m.lines.slice(0, 5);
        const l10 = m.lines.slice(0, 10);
        return {
          player_name: m.player_name,
          stat_type: m.stat_type,
          season_avg: avg,
          last_5_avg: l5.length > 0 ? Math.round((l5.reduce((a, b) => a + b, 0) / l5.length) * 100) / 100 : null,
          last_10_avg: l10.length > 0 ? Math.round((l10.reduce((a, b) => a + b, 0) / l10.length) * 100) / 100 : null,
          line_value: avg,
          confidence_score: 30,
          data_quality: 'estimated',
          game_date: m.latest_date,
        };
      });
      const { error } = await supabase.from('sbo_prop_stat_context').insert(rows);
      if (error) console.warn(`[expand-context] Insert error:`, error.message);
      else inserted += batch.length;
    }

    // 5. Backfill existing entries that have NULL season_avg
    let backfilled = 0;
    for (const [key, ids] of keysWithoutStats.entries()) {
      if (keysWithStats.has(key)) continue;
      const lines = lineMap[key];
      if (!lines || lines.length === 0) continue;

      const avg = Math.round((lines.reduce((a, b) => a + b, 0) / lines.length) * 100) / 100;
      const l5 = lines.slice(0, 5);
      const l10 = lines.slice(0, 10);

      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('sbo_prop_stat_context').update({
          season_avg: avg,
          last_5_avg: l5.length > 0 ? Math.round((l5.reduce((a, b) => a + b, 0) / l5.length) * 100) / 100 : null,
          last_10_avg: l10.length > 0 ? Math.round((l10.reduce((a, b) => a + b, 0) / l10.length) * 100) / 100 : null,
          confidence_score: 25,
          data_quality: 'backfilled',
        }).in('id', batch);
        if (error) console.warn(`[expand-context] Backfill error:`, error.message);
        else backfilled += batch.length;
      }
    }

    console.log(`[expand-context] Inserted: ${inserted}, Backfilled: ${backfilled}`);

    const duration = Date.now() - startTime;
    if (logId) await supabase.from('sbo_function_logs').update({
      status: 'completed', records_processed: inserted + backfilled, duration_ms: duration,
      completed_at: new Date().toISOString(),
      metadata: { inserted, backfilled, existing_with_stats: keysWithStats.size },
    }).eq('id', logId);

    return new Response(JSON.stringify({
      success: true,
      inserted,
      backfilled,
      existing_with_stats: keysWithStats.size,
      existing_without_stats: keysWithoutStats.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[expand-context] Error:', error);
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
