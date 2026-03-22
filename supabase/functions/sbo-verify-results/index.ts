import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { game_id, prediction_id } = body;

    let gamesToVerify: any[] = [];

    if (game_id) {
      // Single game verification
      const { data } = await supabase
        .from('sbo_games')
        .select('*')
        .eq('id', game_id)
        .single();
      if (data) gamesToVerify = [data];
    } else {
      // Bulk: all closed/completed games with unverified predictions
      const { data } = await supabase
        .from('sbo_games')
        .select('*')
        .in('status', ['closed', 'completed', 'final'])
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      gamesToVerify = data || [];
    }

    // If no games have scores yet, try fetching from SportsDataIO
    if (gamesToVerify.length === 0 && !game_id) {
      // Try to fetch completed scores from API
      const apiKey = Deno.env.get('SPORTSDATAIO_API_KEY');
      if (apiKey) {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(
          `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${today}?key=${apiKey}`
        );
        if (res.ok) {
          const apiGames = await res.json();
          for (const ag of apiGames) {
            if (ag.Status === 'Final' || ag.Status === 'F/OT') {
              // Update sbo_games with final scores
              await supabase
                .from('sbo_games')
                .update({
                  home_score: ag.HomeTeamScore,
                  away_score: ag.AwayTeamScore,
                  status: 'closed',
                  winner: ag.HomeTeamScore > ag.AwayTeamScore ? ag.HomeTeam : ag.AwayTeam,
                })
                .eq('external_id', String(ag.GameID));
            }
          }
          // Re-fetch updated games
          const { data } = await supabase
            .from('sbo_games')
            .select('*')
            .in('status', ['closed', 'completed', 'final'])
            .not('home_score', 'is', null)
            .not('away_score', 'is', null);
          gamesToVerify = data || [];
        }
      }
    }

    let verified = 0;
    let correct = 0;
    let incorrect = 0;
    let pushes = 0;

    for (const game of gamesToVerify) {
      // Get unverified predictions for this game
      let predQuery = supabase
        .from('sbo_predictions')
        .select('*')
        .eq('game_id', game.id)
        .eq('verified', false);

      if (prediction_id) {
        predQuery = predQuery.eq('id', prediction_id);
      }

      const { data: predictions } = await predQuery;
      if (!predictions?.length) continue;

      for (const pred of predictions) {
        const homeScore = game.home_score;
        const awayScore = game.away_score;
        let verdict: string;

        if (pred.prediction_type === 'moneyline') {
          const actualWinner = homeScore > awayScore ? 'home' : 'away';
          verdict = pred.predicted_outcome === actualWinner ? 'correct' : 'incorrect';
        } else {
          // For props, skip if no actual value available
          continue;
        }

        // Write to sbo_results_verification
        await supabase.from('sbo_results_verification').insert({
          prediction_id: pred.id,
          game_id: game.id,
          pick_type: pred.prediction_type === 'moneyline' ? 'game' : 'prop',
          our_pick: pred.predicted_outcome,
          our_confidence: pred.final_confidence,
          final_score_home: homeScore,
          final_score_away: awayScore,
          actual_result: homeScore > awayScore ? 'home' : 'away',
          verdict,
          profit_loss: verdict === 'correct' ? 100 : verdict === 'push' ? 0 : -100,
        });

        // Update sbo_predictions
        await supabase
          .from('sbo_predictions')
          .update({
            verified: true,
            verdict,
            was_correct: verdict === 'correct',
            actual_outcome: verdict,
            final_score_home: homeScore,
            final_score_away: awayScore,
            verified_at: new Date().toISOString(),
          })
          .eq('id', pred.id);

        // Update matching saved picks
        await supabase
          .from('sbo_saved_picks')
          .update({
            result: verdict === 'correct' ? 'won' : verdict === 'push' ? 'push' : 'lost',
          })
          .eq('source_id', pred.id);

        verified++;
        if (verdict === 'correct') correct++;
        else if (verdict === 'incorrect') incorrect++;
        else pushes++;
      }
    }

    const accuracy = (correct + incorrect) > 0
      ? ((correct / (correct + incorrect)) * 100)
      : 0;

    // Log to run_log
    if (verified > 0) {
      await supabase.from('sbo_run_log').insert({
        run_type: 'auto-verify',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        games_predicted: verified,
        status: 'completed',
      });
    }

    return new Response(JSON.stringify({
      verified,
      correct,
      incorrect,
      pushes,
      accuracy: parseFloat(accuracy.toFixed(1)),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
