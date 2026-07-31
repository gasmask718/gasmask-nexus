import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SDIO_KEY = () => Deno.env.get('VITE_SPORTSDATAIO_NBA_KEY')!;
const BASE = 'https://api.sportsdata.io/v3/nba';

// MLB finals come from the free ESPN scoreboard (additive; NBA path untouched).
import { fetchEspnMlbFinals, mlbTeamMatches } from '../_shared/espnMlb.ts';

async function sdioGet(endpoint: string) {
  const res = await fetch(`${BASE}${endpoint}?key=${SDIO_KEY()}`);
  if (!res.ok) throw new Error(`SDIO error: ${res.status} ${endpoint}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const parts = date.split('-');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const sdioDate = `${parts[0]}-${months[parseInt(parts[1])-1]}-${parts[2]}`;

    const results: Record<string, any> = { date };
    let gamesUpdated = 0;
    let predictionsGraded = 0;
    let propsGraded = 0;

    // 1. PULL FINAL SCORES
    let finalGames: any[] = [];
    try {
      const games = await sdioGet(`/scores/json/GamesByDate/${sdioDate}`);
      finalGames = games.filter((g: any) => g.Status === 'Final');

      for (const game of finalGames) {
        const winner = game.HomeTeamScore > game.AwayTeamScore ? 'home' : 'away';
        await supabase
          .from('sbo_games')
          .update({
            status: 'final',
            home_score: game.HomeTeamScore,
            away_score: game.AwayTeamScore,
            winner,
            updated_at: new Date().toISOString(),
          })
          .eq('external_id', game.GameID.toString());
        gamesUpdated++;
      }
      results.games_updated = gamesUpdated;
    } catch (e: any) {
      results.games_error = e.message;
    }

    // 2. GRADE MONEYLINE PREDICTIONS
    try {
      const { data: pendingPredictions } = await supabase
        .from('sbo_predictions')
        .select('*, sbo_games(external_id, winner, home_team, away_team, status)')
        .eq('prediction_type', 'moneyline')
        .is('was_correct', null)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');

      for (const pred of pendingPredictions || []) {
        const game = (pred as any).sbo_games;
        if (!game || game.status !== 'final' || !game.winner) continue;
        const wasCorrect = pred.predicted_outcome === game.winner;
        await supabase
          .from('sbo_predictions')
          .update({
            actual_outcome: wasCorrect ? 'correct' : 'incorrect',
            was_correct: wasCorrect,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pred.id);
        predictionsGraded++;
      }
      results.moneyline_graded = predictionsGraded;
    } catch (e: any) {
      results.moneyline_error = e.message;
    }

    // 3. GRADE PLAYER PROP PREDICTIONS
    try {
      const playerStats = await sdioGet(`/stats/json/PlayerGameStatsByDate/${sdioDate}`);
      const statsByPlayer: Record<string, any> = {};
      for (const stat of playerStats) {
        const name = stat.Name?.toLowerCase().trim();
        if (name) statsByPlayer[name] = stat;
      }

      const { data: pendingProps } = await supabase
        .from('sbo_predictions')
        .select('*, sbo_player_props(player_name, prop_type, line, team)')
        .eq('prediction_type', 'player_prop')
        .is('was_correct', null)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');

      const propFieldMap: Record<string, string> = {
        points: 'Points',
        assists: 'Assists',
        rebounds: 'Rebounds',
        threes: 'ThreePointersMade',
        steals: 'Steals',
        blocks: 'BlockedShots',
        turnovers: 'Turnovers',
      };

      for (const pred of pendingProps || []) {
        const prop = (pred as any).sbo_player_props;
        if (!prop) continue;

        const playerName = prop.player_name?.toLowerCase().trim();
        const playerData = statsByPlayer[playerName];
        if (!playerData || !playerData.Minutes) continue;

        const propType = prop.prop_type;
        let actualValue: number | null = null;

        if (propFieldMap[propType]) {
          actualValue = playerData[propFieldMap[propType]] ?? null;
        } else if (propType === 'pts_reb_ast') {
          actualValue = (playerData.Points || 0) + (playerData.Rebounds || 0) + (playerData.Assists || 0);
        } else if (propType === 'pts_reb') {
          actualValue = (playerData.Points || 0) + (playerData.Rebounds || 0);
        } else if (propType === 'pts_ast') {
          actualValue = (playerData.Points || 0) + (playerData.Assists || 0);
        } else if (propType === 'reb_ast') {
          actualValue = (playerData.Rebounds || 0) + (playerData.Assists || 0);
        }

        if (actualValue === null) continue;

        const line = parseFloat(prop.line);
        const hitOver = actualValue > line;
        const hitUnder = actualValue < line;
        const isPush = actualValue === line;

        let wasCorrect: boolean | null = null;
        let verdict: 'correct' | 'incorrect' | 'push';
        if (isPush) {
          verdict = 'push';
        } else {
          wasCorrect = pred.predicted_outcome === 'over' ? hitOver : hitUnder;
          verdict = wasCorrect ? 'correct' : 'incorrect';
        }

        await supabase
          .from('sbo_predictions')
          .update({
            actual_outcome: verdict,
            was_correct: isPush ? null : wasCorrect,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pred.id);
        propsGraded++;
      }
      results.props_graded = propsGraded;
    } catch (e: any) {
      results.props_error = e.message;
    }

    // 4. UPDATE ACCURACY LOG
    try {
      const { data: todayPreds } = await supabase
        .from('sbo_predictions')
        .select('*')
        .not('was_correct', 'is', null)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');

      if ((todayPreds?.length || 0) > 0) {
        const total = todayPreds!.length;
        const correct = todayPreds!.filter((p: any) => p.was_correct).length;
        const accuracyPct = parseFloat(((correct / total) * 100).toFixed(1));

        const byTier: Record<string, any> = {};
        const byType: Record<string, any> = {};

        for (const pred of todayPreds!) {
          const tier = (pred as any).confidence_tier || 'unknown';
          const type = (pred as any).prediction_type || 'unknown';

          if (!byTier[tier]) byTier[tier] = { total: 0, correct: 0 };
          byTier[tier].total++;
          if ((pred as any).was_correct) byTier[tier].correct++;

          if (!byType[type]) byType[type] = { total: 0, correct: 0 };
          byType[type].total++;
          if ((pred as any).was_correct) byType[type].correct++;
        }

        for (const tier of Object.keys(byTier)) {
          byTier[tier].accuracy_pct = parseFloat(
            ((byTier[tier].correct / byTier[tier].total) * 100).toFixed(1)
          );
        }
        for (const type of Object.keys(byType)) {
          byType[type].accuracy_pct = parseFloat(
            ((byType[type].correct / byType[type].total) * 100).toFixed(1)
          );
        }

        await supabase.from('sbo_accuracy_log').upsert({
          date,
          total_predictions: total,
          correct_predictions: correct,
          accuracy_pct: accuracyPct,
          by_tier: byTier,
          by_type: byType,
        }, { onConflict: 'date' });

        results.accuracy_logged = { total, correct, accuracy_pct: accuracyPct };
      }
    } catch (e: any) {
      results.accuracy_error = e.message;
    }

    // 5. RESOLVE POLYMARKET MARKETS
    try {
      const { data: openMarkets } = await supabase
        .from('sbo_polymarket')
        .select('*')
        .eq('status', 'open')
        .not('game_id', 'is', null);

      for (const market of openMarkets || []) {
        const { data: game } = await supabase
          .from('sbo_games')
          .select('status, winner')
          .eq('id', market.game_id)
          .maybeSingle();

        if (game?.status === 'final') {
          await supabase
            .from('sbo_polymarket')
            .update({
              status: 'resolved',
              resolution: game.winner,
              updated_at: new Date().toISOString(),
            })
            .eq('id', market.id);
        }
      }
    } catch (e: any) {
      results.polymarket_resolve_error = e.message;
    }

    // 5b. TRIGGER WEIGHT OPTIMIZER per sport when total graded hits a 50-multiple
    try {
      const gradedSports = new Set<string>();
      const { data: recentGraded } = await supabase
        .from('sbo_predictions')
        .select('sport_key')
        .not('was_correct', 'is', null)
        .gte('updated_at', new Date(Date.now() - 3600000).toISOString());
      for (const r of recentGraded || []) {
        if ((r as any).sport_key) gradedSports.add((r as any).sport_key);
      }
      for (const sk of gradedSports) {
        const { count } = await supabase
          .from('sbo_predictions')
          .select('id', { count: 'exact', head: true })
          .eq('sport_key', sk)
          .not('was_correct', 'is', null);
        if (count && count > 0 && count % 50 === 0) {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sbo-weight-optimizer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ sport_key: sk }),
          }).catch((err) => console.error('weight-optimizer trigger failed', sk, err));
        }
      }
    } catch (e: any) {
      results.weight_optimizer_error = e.message;
    }



    // 6. LOG
    await supabase.from('sbo_sync_log').insert({
      feed_name: 'result_tracking',
      last_synced_at: new Date().toISOString(),
      records_synced: predictionsGraded + propsGraded + gamesUpdated,
      status: 'success',
    });

    return new Response(JSON.stringify({
      success: true,
      date,
      results,
      summary: {
        games_updated: gamesUpdated,
        moneyline_predictions_graded: predictionsGraded,
        prop_predictions_graded: propsGraded,
        total_graded: predictionsGraded + propsGraded,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Result tracking error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
