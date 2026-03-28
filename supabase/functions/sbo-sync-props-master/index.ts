import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    console.log('🔄 Syncing sbo_player_props + predictions → props_master...');

    // ── 1. Fetch all props from sbo_player_props (paginated) ──
    let allProps: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('sbo_player_props')
        .select('*')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) break;
      allProps = allProps.concat(data);
      if (data.length < batchSize) break;
      offset += batchSize;
    }
    console.log(`📦 Fetched ${allProps.length} props from sbo_player_props`);

    // ── 2. Get predictions from sbo_predictions ──
    const { data: predictions } = await supabase
      .from('sbo_predictions')
      .select('player_name, prop_type, prediction, confidence, edge_score, reasoning, season_avg, last_5_avg, last_10_avg, hit_rate_pct, vs_opp_avg');

    const predMap = new Map<string, any>();
    for (const p of (predictions || [])) {
      predMap.set(`${p.player_name}|${p.prop_type}`, p);
    }
    console.log(`🧠 Predictions from sbo_predictions: ${predMap.size}`);

    // ── 3. Also get predictions from sbo_unified_props (analysis output) ──
    const { data: unifiedPreds } = await supabase
      .from('sbo_unified_props')
      .select('player_name, stat_type, ai_direction, ai_confidence, season_avg, l5_avg, l10_avg, edge_vs_line, platform, line');

    const unifiedMap = new Map<string, any>();
    for (const u of (unifiedPreds || [])) {
      unifiedMap.set(`${u.player_name}|${u.stat_type}|${u.platform}|${u.line}`, u);
    }
    console.log(`📊 Unified props with predictions: ${unifiedMap.size}`);

    // ── 4. Transform and upsert into props_master ──
    const upsertRows = allProps.map(p => {
      const pred = predMap.get(`${p.player_name}|${p.prop_type}`);
      const unified = unifiedMap.get(`${p.player_name}|${p.prop_type}|${p.source}|${p.line}`);

      // Prefer sbo_predictions, fallback to sbo_unified_props
      const prediction = pred?.prediction
        || (unified?.ai_direction === 'OVER' ? 'more' : unified?.ai_direction === 'UNDER' ? 'less' : null);
      const confidence = pred?.confidence || unified?.ai_confidence || null;
      const edgeScore = pred?.edge_score || unified?.edge_vs_line || null;
      const seasonAvg = pred?.season_avg || unified?.season_avg || null;
      const l5Avg = pred?.last_5_avg || unified?.l5_avg || null;
      const l10Avg = pred?.last_10_avg || unified?.l10_avg || null;

      return {
        player_name: p.player_name,
        team: p.team || null,
        opponent: null,
        sport: 'NBA',
        stat_type: p.prop_type,
        line: p.line,
        platform: p.source,
        odds: p.over_odds ? `O${p.over_odds}/U${p.under_odds}` : null,
        game_time: null,
        game_date: p.game_date,
        source: 'api',
        prediction,
        confidence_score: confidence,
        edge_score: edgeScore,
        reasoning_json: pred?.reasoning || null,
        season_avg: seasonAvg,
        last_5_avg: l5Avg,
        last_10_avg: l10Avg,
        hit_rate: pred?.hit_rate_pct || null,
        matchup_avg: pred?.vs_opp_avg || null,
        actual_result: p.actual_value || null,
        result: p.verdict === 'hit' ? 'win' : p.verdict === 'miss' ? 'loss' : 'pending',
        settled_at: p.verified_at || null,
        batch_id: `sync-${new Date().toISOString().split('T')[0]}`,
      };
    });

    // Upsert in chunks
    let synced = 0;
    for (let i = 0; i < upsertRows.length; i += 200) {
      const chunk = upsertRows.slice(i, i + 200);
      const { error } = await supabase
        .from('props_master')
        .upsert(chunk, {
          onConflict: 'player_name,stat_type,line,platform,game_date',
          ignoreDuplicates: false,
        });
      if (error) {
        console.warn(`Chunk ${i} upsert error:`, error.message);
        // Fallback: try insert ignoring dupes
        await supabase.from('props_master').insert(chunk);
      }
      synced += chunk.length;
    }

    const withPred = upsertRows.filter(r => r.prediction).length;
    console.log(`✅ Synced ${synced} props to props_master (${withPred} with predictions)`);

    return new Response(JSON.stringify({
      success: true,
      synced,
      source_count: allProps.length,
      predictions_matched: withPred,
      from_sbo_predictions: predMap.size,
      from_unified: unifiedMap.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('❌ Sync error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
