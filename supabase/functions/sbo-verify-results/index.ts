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

    // Use Eastern Time for yesterday
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayET = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    let gamesToVerify: any[] = [];

    if (game_id) {
      const { data } = await supabase
        .from('sbo_games')
        .select('*')
        .eq('id', game_id)
        .single();
      if (data) gamesToVerify = [data];
    } else {
      // First check for games already marked closed with scores
      const { data: closedGames } = await supabase
        .from('sbo_games')
        .select('*')
        .in('status', ['closed', 'completed', 'final'])
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      gamesToVerify = closedGames || [];

      // Also try to fetch yesterday's scores from SportsDataIO
      const apiKey = Deno.env.get('SPORTSDATAIO_API_KEY');
      if (apiKey) {
        // Fetch yesterday's final scores
        try {
          const res = await fetch(
            `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${yesterdayET}?key=${apiKey}`
          );
          if (res.ok) {
            const apiGames = await res.json();
            console.log(`SportsDataIO: ${apiGames.length} games found for ${yesterdayET}`);
            
            for (const ag of apiGames) {
              if (ag.Status === 'Final' || ag.Status === 'F/OT') {
                // Update sbo_games with final scores — match by team names or external_id
                const { data: updated } = await supabase
                  .from('sbo_games')
                  .update({
                    home_score: ag.HomeTeamScore,
                    away_score: ag.AwayTeamScore,
                    score_home: ag.HomeTeamScore,
                    score_away: ag.AwayTeamScore,
                    status: 'closed',
                    winner: ag.HomeTeamScore > ag.AwayTeamScore ? ag.HomeTeam : ag.AwayTeam,
                  })
                  .eq('external_id', String(ag.GameID))
                  .select();

                // If external_id didn't match, try matching by team abbreviations in game_id
                if (!updated?.length) {
                  await supabase
                    .from('sbo_games')
                    .update({
                      home_score: ag.HomeTeamScore,
                      away_score: ag.AwayTeamScore,
                      score_home: ag.HomeTeamScore,
                      score_away: ag.AwayTeamScore,
                      status: 'closed',
                      winner: ag.HomeTeamScore > ag.AwayTeamScore ? ag.HomeTeam : ag.AwayTeam,
                    })
                    .like('game_id', `%${ag.HomeTeam}%`)
                    .gte('game_date', `${yesterdayET}T00:00:00`)
                    .lte('game_date', `${yesterdayET}T23:59:59`);
                }
              }
            }
          }
        } catch (e) {
          console.warn('SportsDataIO fetch failed for yesterday:', e);
        }

        // Also check today's games that might be finished
        try {
          const resToday = await fetch(
            `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${todayET}?key=${apiKey}`
          );
          if (resToday.ok) {
            const todayApiGames = await resToday.json();
            for (const ag of todayApiGames) {
              if (ag.Status === 'Final' || ag.Status === 'F/OT') {
                await supabase
                  .from('sbo_games')
                  .update({
                    home_score: ag.HomeTeamScore,
                    away_score: ag.AwayTeamScore,
                    score_home: ag.HomeTeamScore,
                    score_away: ag.AwayTeamScore,
                    status: 'closed',
                    winner: ag.HomeTeamScore > ag.AwayTeamScore ? ag.HomeTeam : ag.AwayTeam,
                  })
                  .eq('external_id', String(ag.GameID));
              }
            }
          }
        } catch { /* continue */ }

        // Re-fetch all closed games with scores
        const { data: allClosed } = await supabase
          .from('sbo_games')
          .select('*')
          .in('status', ['closed', 'completed', 'final'])
          .not('home_score', 'is', null)
          .not('away_score', 'is', null);
        gamesToVerify = allClosed || [];
      }
    }

    let verified = 0;
    let correct = 0;
    let incorrect = 0;
    let pushes = 0;

    for (const game of gamesToVerify) {
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

      const homeScore = game.home_score ?? game.score_home;
      const awayScore = game.away_score ?? game.score_away;
      if (homeScore === null || awayScore === null) continue;

      for (const pred of predictions) {
        let verdict: string;

        if (pred.prediction_type === 'moneyline') {
          const actualWinner = homeScore > awayScore ? 'home' : 'away';
          verdict = pred.predicted_outcome === actualWinner ? 'correct' : 'incorrect';
        } else {
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
          actual_result: `${game.home_team} ${homeScore} - ${game.away_team} ${awayScore}`,
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
      message: verified === 0 ? 'No unverified games with final scores found' : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Verify results error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
