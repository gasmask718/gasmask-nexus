import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  console.log('sbo-analyze-tonight started');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch and persist tonight's games by calling get-todays-games
    console.log('Step 1: Fetching and persisting tonight\'s games...');
    const gamesRes = await fetch(`${supabaseUrl}/functions/v1/get-todays-games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    });
    const gamesData = await gamesRes.json();
    console.log(`Games fetched: ${gamesData?.meta?.merged || 0}, persisted: ${gamesData?.meta?.persisted || 0}`);

    // Step 2: Query sbo_games for today's scheduled games
    const todayEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = `${todayEST.getFullYear()}-${String(todayEST.getMonth() + 1).padStart(2, '0')}-${String(todayEST.getDate()).padStart(2, '0')}`;

    const { data: tonightGames, error: gamesError } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team, game_date, status')
      .gte('game_date', `${todayStr}T00:00:00`)
      .lt('game_date', `${todayStr}T23:59:59`)
      .in('status', ['scheduled', 'Scheduled']);

    if (gamesError) {
      console.error('Failed to query sbo_games:', gamesError);
      throw new Error(`Database query failed: ${gamesError.message}`);
    }

    const games = tonightGames || [];
    console.log(`Step 2: Found ${games.length} scheduled games in sbo_games`);

    if (games.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        games_found: 0,
        predictions_created: 0,
        message: 'No scheduled games found for tonight. Make sure to Load Games first.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Step 3: Run predictions for each game
    let predictionsCreated = 0;
    let errors: string[] = [];

    for (const game of games) {
      console.log(`Analyzing: ${game.away_team} @ ${game.home_team} (${game.id})`);

      // Run prediction for the game (moneyline — the AI determines the best pick)
      try {
        const predRes = await fetch(`${supabaseUrl}/functions/v1/sbo-run-predictions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            game_id: game.id,
            prediction_type: 'moneyline',
            predicted_outcome: 'home',
            force_rerun: false,
          }),
        });

        const predData = await predRes.json();
        if (predData?.success) {
          predictionsCreated++;
          console.log(`✅ ${game.home_team} ML: ${predData.final_confidence}% (${predData.confidence_tier}) [${predData.source || 'fresh'}]`);
        } else {
          const errMsg = `${game.home_team} vs ${game.away_team}: ${predData?.error || 'Unknown error'}`;
          console.error('❌', errMsg);
          errors.push(errMsg);
        }
      } catch (e) {
        const errMsg = `${game.home_team} vs ${game.away_team}: ${e instanceof Error ? e.message : 'Failed'}`;
        console.error('❌', errMsg);
        errors.push(errMsg);
      }

      // Small delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    // Step 4: Get summary of today's predictions
    const { data: todayPreds } = await supabase
      .from('sbo_predictions')
      .select('id, prediction_type, final_confidence, confidence_tier, data_quality, predicted_outcome')
      .gte('created_at', `${todayStr}T00:00:00`)
      .eq('prediction_type', 'moneyline');

    console.log(`Done. ${predictionsCreated} predictions created, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      games_found: games.length,
      predictions_created: predictionsCreated,
      total_predictions_today: todayPreds?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
      predictions: todayPreds || [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('sbo-analyze-tonight fatal error:', e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
