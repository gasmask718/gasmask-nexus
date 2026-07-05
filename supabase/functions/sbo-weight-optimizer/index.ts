import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Brain = 'stats' | 'market' | 'context';

interface Prediction {
  id: string;
  stats_brain_score: number | null;
  market_brain_score: number | null;
  context_brain_score: number | null;
  was_correct: boolean | null;
  sport_key: string;
}

const leadBrain = (p: Prediction): Brain => {
  const scores: Record<Brain, number> = {
    stats: p.stats_brain_score ?? 0,
    market: p.market_brain_score ?? 0,
    context: p.context_brain_score ?? 0,
  };
  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as Brain;
};

async function optimizeSport(supabase: any, sport_key: string) {
  // STEP 1: last 50 graded predictions
  const { data: preds, error: pErr } = await supabase
    .from('sbo_predictions')
    .select('id, stats_brain_score, market_brain_score, context_brain_score, was_correct, sport_key')
    .eq('sport_key', sport_key)
    .not('was_correct', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (pErr) throw pErr;
  if (!preds || preds.length < 50) {
    return {
      sport_key,
      skipped: true,
      reason: 'Need 50+ graded predictions',
      current_count: preds?.length || 0,
    };
  }

  // STEP 2 + 3: brain accuracy
  const brainAccuracy: Record<Brain, { total: number; correct: number; accuracy: number }> = {
    stats: { total: 0, correct: 0, accuracy: 0 },
    market: { total: 0, correct: 0, accuracy: 0 },
    context: { total: 0, correct: 0, accuracy: 0 },
  };

  (preds as Prediction[]).forEach((p) => {
    const b = leadBrain(p);
    brainAccuracy[b].total++;
    if (p.was_correct) brainAccuracy[b].correct++;
  });

  (Object.keys(brainAccuracy) as Brain[]).forEach((k) => {
    const b = brainAccuracy[k];
    b.accuracy = b.total > 0 ? (b.correct / b.total) * 100 : 50;
  });

  // STEP 4: current weights
  const { data: sport, error: sErr } = await supabase
    .from('sbo_sports')
    .select('stats_weight, market_weight, context_weight, learned_stats_weight, learned_market_weight, learned_context_weight, accuracy_rate')
    .eq('sport_key', sport_key)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!sport) {
    return { sport_key, skipped: true, reason: 'Sport not found in sbo_sports' };
  }

  let SW = Number(sport.learned_stats_weight ?? sport.stats_weight ?? 40);
  let MW = Number(sport.learned_market_weight ?? sport.market_weight ?? 35);
  let CW = Number(sport.learned_context_weight ?? sport.context_weight ?? 25);

  const oldWeights = { stats: SW, market: MW, context: CW };

  // STEP 5: adjust
  const sorted = (Object.entries(brainAccuracy) as [Brain, { accuracy: number }][])
    .sort((a, b) => b[1].accuracy - a[1].accuracy);
  const best = sorted[0][0];
  const worst = sorted[2][0];
  const diff = sorted[0][1].accuracy - sorted[2][1].accuracy;

  if (diff < 5) {
    return {
      sport_key,
      adjusted: false,
      reason: 'Difference too small',
      diff,
      brain_accuracy: brainAccuracy,
      sample_size: 50,
    };
  }

  const adjustment = 3;
  if (best === 'stats') SW += adjustment;
  if (best === 'market') MW += adjustment;
  if (best === 'context') CW += adjustment;
  if (worst === 'stats') SW -= adjustment;
  if (worst === 'market') MW -= adjustment;
  if (worst === 'context') CW -= adjustment;

  // STEP 6: safety rails + normalize
  SW = Math.max(25, Math.min(60, SW));
  MW = Math.max(20, Math.min(55, MW));
  CW = Math.max(10, Math.min(40, CW));

  const total = SW + MW + CW;
  SW = Math.round((SW / total) * 100);
  MW = Math.round((MW / total) * 100);
  CW = 100 - SW - MW;

  // STEP 7: log
  await supabase.from('sbo_weight_history').insert({
    sport_key,
    reason: 'auto_adjusted',
    auto_adjusted: true,
    stats_weight_before: oldWeights.stats,
    market_weight_before: oldWeights.market,
    context_weight_before: oldWeights.context,
    stats_weight_after: SW,
    market_weight_after: MW,
    context_weight_after: CW,
    accuracy_before: sport.accuracy_rate,
    predictions_analyzed: 50,
    sample_size: 50,
  });

  // STEP 8: update sport
  await supabase
    .from('sbo_sports')
    .update({
      learned_stats_weight: SW,
      learned_market_weight: MW,
      learned_context_weight: CW,
      updated_at: new Date().toISOString(),
    })
    .eq('sport_key', sport_key);

  // STEP 9: return
  return {
    sport_key,
    adjusted: true,
    old_weights: oldWeights,
    new_weights: { stats: SW, market: MW, context: CW },
    brain_accuracy: brainAccuracy,
    sample_size: 50,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let sportKeys: string[] = [];
    if (body.sport_key) {
      sportKeys = [body.sport_key];
    } else {
      const { data, error } = await supabase
        .from('sbo_sports')
        .select('sport_key')
        .eq('is_active', true);
      if (error) {
        // fallback: no is_active column — pull all
        const { data: all } = await supabase.from('sbo_sports').select('sport_key');
        sportKeys = (all || []).map((r: any) => r.sport_key);
      } else {
        sportKeys = (data || []).map((r: any) => r.sport_key);
      }
    }

    const results = [];
    for (const sk of sportKeys) {
      try {
        results.push(await optimizeSport(supabase, sk));
      } catch (e: any) {
        results.push({ sport_key: sk, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, sports_processed: sportKeys.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('sbo-weight-optimizer error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
