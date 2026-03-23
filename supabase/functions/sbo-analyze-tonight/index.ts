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

    // Get today's date in EST — games are stored with game_date as midnight EDT in UTC
    const todayEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = `${todayEST.getFullYear()}-${String(todayEST.getMonth() + 1).padStart(2, '0')}-${String(todayEST.getDate()).padStart(2, '0')}`;
    
    // Query sbo_games directly — games already persisted via Load Games button
    // game_date is stored as timestamptz, e.g. 2026-03-23T04:00:00+00 (midnight EDT = 4am UTC)
    const startOfDay = `${todayStr}T00:00:00+00:00`;
    const endOfDay = `${todayStr}T23:59:59+00:00`;
    
    const { data: tonightGames, error: gamesError } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team, game_date, status, external_id')
      .gte('game_date', startOfDay)
      .lte('game_date', endOfDay)
      .in('status', ['scheduled', 'Scheduled']);

    if (gamesError) {
      console.error('Failed to query sbo_games:', gamesError);
      throw new Error(`Database query failed: ${gamesError.message}`);
    }

    const games = tonightGames || [];
    console.log(`Found ${games.length} scheduled games in sbo_games for ${todayStr}`);

    if (games.length === 0) {
      // Try broader query in case timezone offset put them on a different UTC date
      const { data: broaderGames } = await supabase
        .from('sbo_games')
        .select('id, home_team, away_team, game_date, status')
        .in('status', ['scheduled', 'Scheduled'])
        .order('game_date', { ascending: false })
        .limit(20);
      
      const count = broaderGames?.length || 0;
      console.log(`Broader query found ${count} scheduled games total`);
      
      return new Response(JSON.stringify({
        success: true,
        games_found: 0,
        predictions_created: 0,
        message: `No scheduled games found for ${todayStr}. Found ${count} total scheduled games. Hit Load Games first to persist tonight's games.`,
        debug: { todayStr, startOfDay, endOfDay, broaderGamesCount: count, sampleDates: broaderGames?.slice(0, 3).map(g => g.game_date) },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get odds for each game
    const gameIds = games.map(g => g.id);
    const { data: allOdds } = await supabase
      .from('sbo_odds')
      .select('*')
      .in('game_id', gameIds);

    const oddsMap: Record<string, any> = {};
    for (const o of (allOdds || [])) {
      oddsMap[o.game_id] = o;
    }

    // Run predictions for each game
    let predictionsCreated = 0;
    const errors: string[] = [];

    for (const game of games) {
      const odds = oddsMap[game.id];
      console.log(`Analyzing: ${game.away_team} @ ${game.home_team} (${game.id})`);

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
            // Pass odds context so sbo-run-predictions doesn't need to look them up
            home_odds: odds?.home_odds ?? null,
            away_odds: odds?.away_odds ?? null,
          }),
        });

        const predData = await predRes.json();
        if (predData?.success) {
          predictionsCreated++;
          console.log(`✅ ${game.home_team}: ${predData.final_confidence}% (${predData.confidence_tier}) [${predData.source || 'fresh'}]`);
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

      // Small delay between AI calls
      await new Promise(r => setTimeout(r, 300));
    }

    // Get summary
    const { data: todayPreds } = await supabase
      .from('sbo_predictions')
      .select('id, prediction_type, final_confidence, confidence_tier, data_quality, predicted_outcome')
      .gte('created_at', `${todayStr}T00:00:00`)
      .eq('prediction_type', 'moneyline');

    console.log(`Done. ${predictionsCreated} predictions created, ${errors.length} errors, ${todayPreds?.length || 0} total today`);

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
