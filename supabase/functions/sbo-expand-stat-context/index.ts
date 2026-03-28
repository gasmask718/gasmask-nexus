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

  try {
    // 1. Fetch ALL props_master (paginated)
    const allProps = await paginatedFetch(supabase, () =>
      supabase.from('props_master').select('player_name, stat_type, line, game_date').order('game_date', { ascending: false })
    );
    console.log(`[expand-context] Total props fetched: ${allProps.length}`);

    // 2. Fetch ALL existing context (paginated)
    const existing = await paginatedFetch(supabase, () =>
      supabase.from('sbo_prop_stat_context').select('player_name, stat_type')
    );

    const existingKeys = new Set(
      existing.map((e: any) => `${normalize(e.player_name)}::${normalize(e.stat_type)}`)
    );
    console.log(`[expand-context] Existing unique context keys: ${existingKeys.size}`);

    // 3. Find missing combos
    const missingMap: Record<string, { player_name: string; stat_type: string; lines: number[]; latest_date: string }> = {};

    for (const p of allProps) {
      const key = `${p.player_name.toLowerCase().trim()}::${p.stat_type.toLowerCase().trim()}`;
      if (existingKeys.has(key)) continue;

      if (!missingMap[key]) {
        missingMap[key] = {
          player_name: p.player_name,
          stat_type: p.stat_type,
          lines: [],
          latest_date: p.game_date,
        };
      }
      if (p.line != null) missingMap[key].lines.push(Number(p.line));
    }

    const missingEntries = Object.values(missingMap);
    console.log(`[expand-context] Missing combos to insert: ${missingEntries.length}`);

    if (missingEntries.length === 0) {
      return new Response(JSON.stringify({
        success: true, inserted: 0, message: 'All player/stat combos already in context',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Insert in batches
    let inserted = 0;
    let failed = 0;
    const BATCH = 100;

    for (let i = 0; i < missingEntries.length; i += BATCH) {
      const batch = missingEntries.slice(i, i + BATCH);
      const rows = batch.map(m => {
        const avg = m.lines.length > 0
          ? Math.round((m.lines.reduce((a, b) => a + b, 0) / m.lines.length) * 100) / 100
          : null;
        const last5 = m.lines.slice(0, 5);
        const last10 = m.lines.slice(0, 10);
        const l5Avg = last5.length > 0 ? Math.round((last5.reduce((a, b) => a + b, 0) / last5.length) * 100) / 100 : null;
        const l10Avg = last10.length > 0 ? Math.round((last10.reduce((a, b) => a + b, 0) / last10.length) * 100) / 100 : null;

        return {
          player_name: m.player_name,
          stat_type: m.stat_type,
          season_avg: avg,
          last_5_avg: l5Avg,
          last_10_avg: l10Avg,
          line_value: avg,
          confidence_score: 30,
          data_quality: 'estimated',
          game_date: m.latest_date,
        };
      });

      const { error: insErr } = await supabase
        .from('sbo_prop_stat_context')
        .insert(rows);

      if (insErr) {
        console.warn(`[expand-context] Batch insert error:`, insErr.message);
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`[expand-context] Inserted: ${inserted}, Failed: ${failed}`);

    return new Response(JSON.stringify({
      success: true,
      inserted,
      failed,
      total_missing: missingEntries.length,
      existing_count: existingKeys.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[expand-context] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
