import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('🔄 Syncing sbo_player_props → props_master...');

    // Fetch all props from sbo_player_props (paginated to bypass 1000 limit)
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

    // Also get existing predictions from sbo_predictions
    const { data: predictions } = await supabase
      .from('sbo_predictions')
      .select('player_name, prop_type, prediction, confidence, edge_score, reasoning, season_avg, last_5_avg, last_10_avg, hit_rate_pct, vs_opp_avg');

    const predMap = new Map<string, any>();
    for (const p of (predictions || [])) {
      predMap.set(`${p.player_name}|${p.prop_type}`, p);
    }

    // Transform and upsert into props_master
    const upsertRows = allProps.map(p => {
      const pred = predMap.get(`${p.player_name}|${p.prop_type}`);
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
        prediction: pred?.prediction || null,
        confidence_score: pred?.confidence || null,
        edge_score: pred?.edge_score || null,
        reasoning_json: pred?.reasoning || null,
        season_avg: pred?.season_avg || null,
        last_5_avg: pred?.last_5_avg || null,
        last_10_avg: pred?.last_10_avg || null,
        hit_rate: pred?.hit_rate_pct || null,
        matchup_avg: pred?.vs_opp_avg || null,
        actual_result: p.actual_value || null,
        result: p.verdict === 'hit' ? 'win' : p.verdict === 'miss' ? 'loss' : 'pending',
        settled_at: p.verified_at || null,
        batch_id: `sync-${new Date().toISOString().split('T')[0]}`,
      };
    });

    // Upsert in chunks of 200
    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < upsertRows.length; i += 200) {
      const chunk = upsertRows.slice(i, i + 200);
      const { error, count } = await supabase
        .from('props_master')
        .upsert(chunk, { 
          onConflict: 'player_name,stat_type,line,platform,game_date',
          ignoreDuplicates: false 
        });
      if (error) {
        console.error(`Chunk ${i} error:`, error.message);
        // Try insert without upsert constraint - just insert ignoring dupes
        const { error: insertErr } = await supabase
          .from('props_master')
          .insert(chunk);
        if (insertErr && !insertErr.message.includes('duplicate')) {
          console.error('Insert fallback error:', insertErr.message);
        }
      }
      inserted += chunk.length;
    }

    console.log(`✅ Synced ${inserted} props to props_master`);

    return new Response(JSON.stringify({
      success: true,
      synced: inserted,
      source_count: allProps.length,
      predictions_matched: predMap.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('❌ Sync error:', e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: e instanceof Error ? e.message : 'Unknown error' 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
