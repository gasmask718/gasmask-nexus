import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// props_master predates multi-sport support and stored a hardcoded 'NBA'.
// sbo_player_props carries the real sport_key — map it to the short label
// props_master consumers already use.
const SPORT_LABEL: Record<string, string> = {
  mlb: 'MLB', nba: 'NBA', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL',
  ncaab: 'NCAAB', ncaaf: 'NCAAF',
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

    // ── 2. Get predictions from sbo_predictions (joined by prop_id → sbo_player_props.id) ──
    const { data: predictions, error: predError } = await supabase
      .from('sbo_predictions')
      .select('prop_id, predicted_outcome, final_confidence, confidence_tier, stats_brain_reasoning, market_brain_reasoning, context_brain_reasoning, polymarket_brain_reasoning');

    if (predError) {
      console.error('❌ sbo_predictions query failed:', predError);
      throw new Error(`sbo_predictions query failed: ${predError.message}`);
    }

    const predMap = new Map<string, any>();
    for (const p of (predictions || [])) {
      if (p.prop_id) predMap.set(p.prop_id, p);
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
      const pred = predMap.get(p.id);
      const unified = unifiedMap.get(`${p.player_name}|${p.prop_type}|${p.source}|${p.line}`);

      // Prefer sbo_predictions (predicted_outcome is already 'more'/'less'/'hold'-style),
      // fallback to sbo_unified_props ai_direction (OVER/UNDER → more/less).
      let prediction = pred?.predicted_outcome || null;
      if (!prediction && unified?.ai_direction) {
        prediction = unified.ai_direction === 'OVER' ? 'more'
          : unified.ai_direction === 'UNDER' ? 'less'
          : 'hold';
      }
      const confidence = pred?.final_confidence ?? unified?.ai_confidence ?? null;
      // edge_score has no equivalent in sbo_predictions → fallback to unified only
      const edgeScore = unified?.edge_vs_line ?? null;
      // season/l5/l10/hit_rate/matchup have no equivalent in sbo_predictions → unified only
      const seasonAvg = unified?.season_avg ?? null;
      const l5Avg = unified?.l5_avg ?? null;
      const l10Avg = unified?.l10_avg ?? null;

      // Reasoning: combine the 4 brain reasonings into a JSON blob (was single `reasoning` text)
      const reasoningJson = pred ? {
        stats: pred.stats_brain_reasoning || null,
        market: pred.market_brain_reasoning || null,
        context: pred.context_brain_reasoning || null,
        polymarket: pred.polymarket_brain_reasoning || null,
        confidence_tier: pred.confidence_tier || null,
      } : null;

      return {
        player_name: p.player_name,
        team: p.team || null,
        opponent: null,
        sport: SPORT_LABEL[String(p.sport_key ?? '').toLowerCase()]
          ?? String(p.sport_key ?? 'NBA').toUpperCase(),

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
        reasoning_json: reasoningJson,
        season_avg: seasonAvg,
        last_5_avg: l5Avg,
        last_10_avg: l10Avg,
        hit_rate: null,
        matchup_avg: null,
        actual_result: p.actual_value ?? null,
        result: (() => {
          // correct/incorrect are direct verdicts — already adjudicated
          // against the pick direction.
          if (p.verdict === 'correct') return 'win';
          if (p.verdict === 'incorrect') return 'loss';
          if (p.verdict === 'push') return 'push';
          // over/under = where the actual landed vs the line.
          // Win if the pick direction matches the outcome.
          // `prediction` is computed above as 'more' / 'less' / 'hold'.
          if (p.verdict === 'over' || p.verdict === 'under') {
            const pred = String(prediction ?? '').toLowerCase().trim();
            const normalizedPred =
              pred === 'more' ? 'over'
              : pred === 'less' ? 'under'
              : pred;
            if (!normalizedPred || normalizedPred === 'hold') return 'pending';
            return normalizedPred === p.verdict ? 'win' : 'loss';
          }
          return 'pending';
        })(),
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
        const { error: insertErr } = await supabase
          .from('props_master')
          .insert(chunk);
        if (insertErr) {
          console.error(`Chunk ${i} insert fallback also failed:`, insertErr.message);
        }
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
