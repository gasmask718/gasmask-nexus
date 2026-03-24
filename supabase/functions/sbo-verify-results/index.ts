import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NBA team abbreviation to last-word-of-name mapping for flexible matching
const TEAM_KEYWORDS: Record<string, string[]> = {
  'ATL': ['hawks', 'atlanta'],
  'BOS': ['celtics', 'boston'],
  'BKN': ['nets', 'brooklyn'],
  'CHA': ['hornets', 'charlotte'],
  'CHI': ['bulls', 'chicago'],
  'CLE': ['cavaliers', 'cleveland'],
  'DAL': ['mavericks', 'dallas'],
  'DEN': ['nuggets', 'denver'],
  'DET': ['pistons', 'detroit'],
  'GS': ['warriors', 'golden state'],
  'GSW': ['warriors', 'golden state'],
  'HOU': ['rockets', 'houston'],
  'IND': ['pacers', 'indiana'],
  'LAC': ['clippers', 'los angeles clippers'],
  'LAL': ['lakers', 'los angeles lakers'],
  'MEM': ['grizzlies', 'memphis'],
  'MIA': ['heat', 'miami'],
  'MIL': ['bucks', 'milwaukee'],
  'MIN': ['timberwolves', 'minnesota'],
  'NO': ['pelicans', 'new orleans'],
  'NOP': ['pelicans', 'new orleans'],
  'NY': ['knicks', 'new york'],
  'NYK': ['knicks', 'new york'],
  'OKC': ['thunder', 'oklahoma'],
  'ORL': ['magic', 'orlando'],
  'PHI': ['76ers', 'philadelphia', 'sixers'],
  'PHO': ['suns', 'phoenix'],
  'PHX': ['suns', 'phoenix'],
  'POR': ['trail blazers', 'portland', 'blazers'],
  'SA': ['spurs', 'san antonio'],
  'SAS': ['spurs', 'san antonio'],
  'SAC': ['kings', 'sacramento'],
  'TOR': ['raptors', 'toronto'],
  'UTA': ['jazz', 'utah'],
  'UTAH': ['jazz', 'utah'],
  'WAS': ['wizards', 'washington'],
};

function teamMatchesAbbrev(teamName: string, abbrev: string): boolean {
  const lower = teamName.toLowerCase();
  const keywords = TEAM_KEYWORDS[abbrev] || TEAM_KEYWORDS[abbrev.toUpperCase()];
  if (!keywords) return false;
  return keywords.some(kw => lower.includes(kw));
}

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
    const { game_id, prediction_id, force_yesterday, force_rerun = false, specific_date = null } = body;

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayET = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Determine ET offset
    const etOffset = (() => {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', timeZoneName: 'shortOffset'
        }).formatToParts(now);
        const tz = parts.find(p => p.type === 'timeZoneName')?.value || '';
        return tz.includes('-4') ? '-04:00' : '-05:00';
      } catch { return '-05:00'; }
    })();

    const apiKey = Deno.env.get('SPORTSDATAIO_API_KEY');
    let scoresUpdated = 0;

    // Helper to fetch scores for a given date and update matching games
    const fetchAndUpdateScores = async (dateStr: string) => {
      if (!apiKey) return 0;
      let updated = 0;
      try {
        const res = await fetch(
          `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${dateStr}?key=${apiKey}`
        );
        if (!res.ok) {
          console.warn(`SportsDataIO returned ${res.status} for ${dateStr}`);
          return 0;
        }
        const apiGames = await res.json();
        console.log(`SportsDataIO: ${apiGames.length} games for ${dateStr}`);

        const start = `${dateStr}T00:00:00${etOffset}`;
        const end = `${dateStr}T23:59:59${etOffset}`;

        // Get our games for this date
        const { data: ourGames } = await supabase
          .from('sbo_games')
          .select('id, home_team, away_team, external_id')
          .gte('game_date', start)
          .lte('game_date', end);

        if (!ourGames?.length) return 0;

        for (const ag of apiGames) {
          if (ag.HomeTeamScore === null || ag.AwayTeamScore === null) continue;
          if (ag.Status !== 'Final' && ag.Status !== 'F/OT' && ag.Status !== 'F') continue;

          // Validate scores are realistic — NBA games score 60+ points
          if (ag.HomeTeamScore < 60 || ag.AwayTeamScore < 60) {
            console.log(`Skipping ${ag.HomeTeam} vs ${ag.AwayTeam} — scores too low: ${ag.HomeTeamScore}-${ag.AwayTeamScore} (likely partial)`);
            continue;
          }

          // Match by team names
          const matched = ourGames.find(g =>
            teamMatchesAbbrev(g.home_team, ag.HomeTeam) &&
            teamMatchesAbbrev(g.away_team, ag.AwayTeam)
          );

          if (matched) {
            const { error } = await supabase
              .from('sbo_games')
              .update({
                home_score: ag.HomeTeamScore,
                away_score: ag.AwayTeamScore,
                status: 'closed',
                winner: ag.HomeTeamScore > ag.AwayTeamScore ? matched.home_team : matched.away_team,
              })
              .eq('id', matched.id);

            if (!error) {
              console.log(`Updated ${matched.home_team}: ${ag.HomeTeamScore}-${ag.AwayTeamScore}`);
              updated++;
            }
          } else {
            console.warn(`No match for ${ag.HomeTeam} vs ${ag.AwayTeam}`);
          }
        }
      } catch (e) {
        console.warn(`Score fetch failed for ${dateStr}:`, e);
      }
      return updated;
    };

    // Force yesterday mode: always fetch scores
    if (force_yesterday) {
      scoresUpdated += await fetchAndUpdateScores(yesterdayET);
    }

    // Normal flow: also try to update scores for yesterday and today
    scoresUpdated += await fetchAndUpdateScores(yesterdayET);
    scoresUpdated += await fetchAndUpdateScores(todayET);

    // Now verify predictions
    let gamesToVerify: any[] = [];

    if (game_id) {
      const { data } = await supabase
        .from('sbo_games')
        .select('*')
        .eq('id', game_id)
        .single();
      if (data) gamesToVerify = [data];
    } else {
      const { data: closedGames } = await supabase
        .from('sbo_games')
        .select('*')
        .in('status', ['closed', 'completed', 'final'])
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      gamesToVerify = closedGames || [];
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

      const homeScore = game.home_score;
      const awayScore = game.away_score;
      if (homeScore === null || awayScore === null) continue;

      for (const pred of predictions) {
        let verdict: string;

        if (pred.prediction_type === 'moneyline') {
          const actualWinner = homeScore > awayScore ? 'home' : 'away';
          verdict = pred.predicted_outcome === actualWinner ? 'correct' : 'incorrect';
        } else {
          continue;
        }

        // Write to sbo_results_verification (upsert to handle re-runs)
        const actualWinnerTeam = homeScore > awayScore ? game.home_team : game.away_team;
        const loserTeam = homeScore > awayScore ? game.away_team : game.home_team;
        const winScore = Math.max(homeScore, awayScore);
        const loseScore = Math.min(homeScore, awayScore);
        const verdictNote = `${actualWinnerTeam} won ${winScore}-${loseScore}. Predicted: ${pred.predicted_outcome === 'home' ? game.home_team : game.away_team}. ${verdict === 'correct' ? '✅ CORRECT' : '❌ INCORRECT'}`;

        await supabase.from('sbo_results_verification').upsert({
          prediction_id: pred.id,
          game_id: game.id,
          pick_type: pred.prediction_type === 'moneyline' ? 'game' : 'prop',
          our_pick: pred.predicted_outcome,
          our_confidence: pred.final_confidence,
          final_score_home: homeScore,
          final_score_away: awayScore,
          actual_result: `${game.home_team} ${homeScore} - ${game.away_team} ${awayScore}`,
          actual_winner: homeScore > awayScore ? 'home' : 'away',
          was_correct: verdict === 'correct',
          verdict,
          verdict_note: verdictNote,
          profit_loss: verdict === 'correct' ? 100 : verdict === 'push' ? 0 : -100,
          verified_at: new Date().toISOString(),
        }, { onConflict: 'prediction_id' });

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

    // ═══════════════════════════════════════
    // PROP VERIFICATION
    // ═══════════════════════════════════════
    let propsVerified = 0;
    let propsCorrect = 0;
    let propsIncorrect = 0;
    let propsPush = 0;

    if (apiKey) {
      // Get unverified props from yesterday and today
      const { data: unverifiedProps } = await supabase
        .from('sbo_player_props')
        .select(`
          *,
          sbo_predictions(
            id,
            predicted_outcome,
            final_confidence,
            verdict,
            verified
          )
        `)
        .is('verdict', null)
        .gte('created_at', `${yesterdayET}T00:00:00${etOffset}`)
        .lte('created_at', `${todayET}T23:59:59${etOffset}`);

      console.log(`Props to verify: ${unverifiedProps?.length || 0}`);

      if (unverifiedProps?.length) {
        // Fetch player box scores from SportsDataIO for yesterday and today
        let playerStats: any[] = [];

        for (const dateStr of [yesterdayET, todayET]) {
          try {
            const gamesRes = await fetch(
              `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${dateStr}?key=${apiKey}`
            );
            if (!gamesRes.ok) continue;
            const games = await gamesRes.json();

            for (const game of games) {
              if (game.Status !== 'Final' && game.Status !== 'F/OT') continue;
              try {
                const boxRes = await fetch(
                  `https://api.sportsdata.io/v3/nba/stats/json/BoxScore/${game.GameID}?key=${apiKey}`
                );
                if (boxRes.ok) {
                  const boxScore = await boxRes.json();
                  playerStats = [...playerStats, ...(boxScore.PlayerGames || [])];
                }
              } catch (e: any) {
                console.error(`BoxScore fetch failed for ${game.GameID}:`, e.message);
              }
              await new Promise(r => setTimeout(r, 150));
            }
          } catch (e: any) {
            console.error(`Games fetch failed for ${dateStr}:`, e.message);
          }
        }

        console.log(`Total player stat lines fetched: ${playerStats.length}`);

        // Build lookup map
        const playerStatsMap = new Map<string, any>();
        for (const ps of playerStats) {
          const fullName = `${ps.Name || ''}`.toLowerCase().trim();
          const lastName = fullName.split(' ').pop() || '';
          playerStatsMap.set(fullName, ps);
          if (lastName.length > 3) playerStatsMap.set(lastName, ps);
        }

        for (const prop of unverifiedProps) {
          try {
            const playerName = prop.player_name?.toLowerCase().trim() || '';
            const lastName = playerName.split(' ').pop() || '';
            const playerStat = playerStatsMap.get(playerName) || playerStatsMap.get(lastName);

            if (!playerStat) {
              console.log(`No stats found for: ${prop.player_name}`);
              continue;
            }

            // Map prop type to SportsDataIO field
            let actualValue: number | null = null;
            const pt = (prop.prop_type || '').toLowerCase();

            if (pt.includes('point') || pt === 'pts' || pt === 'points') actualValue = playerStat.Points ?? null;
            else if (pt.includes('rebound') || pt === 'reb' || pt === 'rebounds') actualValue = playerStat.Rebounds ?? null;
            else if (pt.includes('assist') || pt === 'ast' || pt === 'assists') actualValue = playerStat.Assists ?? null;
            else if (pt.includes('three') || pt.includes('3pt') || pt === 'threes') actualValue = playerStat.ThreePointersMade ?? null;
            else if (pt.includes('steal') || pt === 'stl' || pt === 'steals') actualValue = playerStat.Steals ?? null;
            else if (pt.includes('block') || pt === 'blk' || pt === 'blocks') actualValue = playerStat.BlockedShots ?? null;
            else if (pt.includes('turnover') || pt === 'tov' || pt === 'turnovers') actualValue = playerStat.Turnovers ?? null;
            else if (pt === 'pts_reb' || pt.includes('points_rebounds')) actualValue = (playerStat.Points ?? 0) + (playerStat.Rebounds ?? 0);
            else if (pt === 'pts_ast' || pt.includes('points_assists')) actualValue = (playerStat.Points ?? 0) + (playerStat.Assists ?? 0);
            else if (pt === 'pts_reb_ast' || pt.includes('points_rebounds_assists')) actualValue = (playerStat.Points ?? 0) + (playerStat.Rebounds ?? 0) + (playerStat.Assists ?? 0);
            else if (pt === 'reb_ast') actualValue = (playerStat.Rebounds ?? 0) + (playerStat.Assists ?? 0);
            else if (pt.includes('minute') || pt === 'min') actualValue = playerStat.Minutes ?? null;

            if (actualValue === null) {
              console.log(`Could not map prop type: ${prop.prop_type} for ${prop.player_name}`);
              continue;
            }

            const line = parseFloat(String(prop.line));
            const resultDirection = actualValue > line ? 'over' : actualValue < line ? 'under' : 'push';

            const aiPick = prop.sbo_predictions?.[0]?.predicted_outcome?.toLowerCase() || null;

            let predictionVerdict: string;
            if (resultDirection === 'push') predictionVerdict = 'push';
            else if (aiPick && aiPick === resultDirection) predictionVerdict = 'correct';
            else if (aiPick) predictionVerdict = 'incorrect';
            else predictionVerdict = resultDirection;

            console.log(
              `${prop.player_name} ${prop.prop_type} ${line}: actual=${actualValue}, pick=${aiPick?.toUpperCase()}, result=${resultDirection.toUpperCase()}, verdict=${predictionVerdict}`
            );

            // Update sbo_player_props
            await supabase
              .from('sbo_player_props')
              .update({
                actual_value: actualValue,
                verdict: predictionVerdict,
                verified: true,
                verified_at: new Date().toISOString(),
              })
              .eq('id', prop.id);

            // Update sbo_predictions
            if (prop.sbo_predictions?.[0]?.id) {
              await supabase
                .from('sbo_predictions')
                .update({
                  verified: true,
                  verdict: predictionVerdict,
                  was_correct: predictionVerdict === 'correct',
                  actual_outcome: predictionVerdict,
                  verified_at: new Date().toISOString(),
                })
                .eq('id', prop.sbo_predictions[0].id);
            }

            // Upsert into sbo_results_verification
            const propVerdictNote = `${prop.player_name} had ${actualValue} ${prop.prop_type} (line: ${line}). Pick: ${(aiPick || 'N/A').toUpperCase()}. ${predictionVerdict === 'correct' ? '✅ CORRECT' : predictionVerdict === 'push' ? '➖ PUSH' : '❌ INCORRECT'}`;

            if (prop.sbo_predictions?.[0]?.id) {
              await supabase
                .from('sbo_results_verification')
                .upsert({
                  prediction_id: prop.sbo_predictions[0].id,
                  game_id: prop.game_id || null,
                  pick_type: 'prop',
                  our_pick: aiPick || 'unknown',
                  our_confidence: prop.sbo_predictions?.[0]?.final_confidence || null,
                  actual_result: `${prop.player_name} ${prop.prop_type}: ${actualValue} (line was ${line})`,
                  actual_value: actualValue,
                  was_correct: predictionVerdict === 'correct',
                  verdict: predictionVerdict,
                  verdict_note: propVerdictNote,
                  profit_loss: predictionVerdict === 'correct' ? 100 : predictionVerdict === 'push' ? 0 : -100,
                  verified_at: new Date().toISOString(),
                }, { onConflict: 'prediction_id' });
            }

            // Update saved picks
            if (prop.sbo_predictions?.[0]?.id) {
              await supabase
                .from('sbo_saved_picks')
                .update({
                  result: predictionVerdict === 'correct' ? 'won' : predictionVerdict === 'push' ? 'push' : 'lost',
                })
                .eq('source_id', prop.sbo_predictions[0].id);
            }

            propsVerified++;
            if (predictionVerdict === 'correct') propsCorrect++;
            else if (predictionVerdict === 'incorrect') propsIncorrect++;
            else propsPush++;

          } catch (e: any) {
            console.error(`Prop verification failed for ${prop.player_name}:`, e.message);
          }
        }
      }
    }

    verified += propsVerified;
    correct += propsCorrect;
    incorrect += propsIncorrect;
    pushes += propsPush;

    const propAccuracy = (propsCorrect + propsIncorrect) > 0
      ? Math.round((propsCorrect / (propsCorrect + propsIncorrect)) * 100)
      : 0;

    console.log(`Props verified: ${propsVerified} | Correct: ${propsCorrect} | Incorrect: ${propsIncorrect} | Accuracy: ${propAccuracy}%`);

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
      scores_updated: scoresUpdated,
      accuracy: parseFloat(accuracy.toFixed(1)),
      props_verified: propsVerified,
      props_correct: propsCorrect,
      props_incorrect: propsIncorrect,
      props_accuracy: propAccuracy,
      message: verified === 0 && scoresUpdated === 0
        ? 'No unverified games or props with final scores found'
        : undefined,
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
