import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEAM_KEYWORDS: Record<string, string[]> = {
  'ATL': ['hawks', 'atlanta'], 'BOS': ['celtics', 'boston'], 'BKN': ['nets', 'brooklyn'],
  'CHA': ['hornets', 'charlotte'], 'CHI': ['bulls', 'chicago'], 'CLE': ['cavaliers', 'cleveland'],
  'DAL': ['mavericks', 'dallas'], 'DEN': ['nuggets', 'denver'], 'DET': ['pistons', 'detroit'],
  'GS': ['warriors', 'golden state'], 'GSW': ['warriors', 'golden state'],
  'HOU': ['rockets', 'houston'], 'IND': ['pacers', 'indiana'],
  'LAC': ['clippers', 'los angeles clippers'], 'LAL': ['lakers', 'los angeles lakers'],
  'MEM': ['grizzlies', 'memphis'], 'MIA': ['heat', 'miami'], 'MIL': ['bucks', 'milwaukee'],
  'MIN': ['timberwolves', 'minnesota'], 'NO': ['pelicans', 'new orleans'],
  'NOP': ['pelicans', 'new orleans'], 'NY': ['knicks', 'new york'], 'NYK': ['knicks', 'new york'],
  'OKC': ['thunder', 'oklahoma'], 'ORL': ['magic', 'orlando'],
  'PHI': ['76ers', 'philadelphia', 'sixers'], 'PHO': ['suns', 'phoenix'], 'PHX': ['suns', 'phoenix'],
  'POR': ['trail blazers', 'portland', 'blazers'], 'SA': ['spurs', 'san antonio'],
  'SAS': ['spurs', 'san antonio'], 'SAC': ['kings', 'sacramento'], 'TOR': ['raptors', 'toronto'],
  'UTA': ['jazz', 'utah'], 'UTAH': ['jazz', 'utah'], 'WAS': ['wizards', 'washington'],
};

function teamMatchesAbbrev(teamName: string, abbrev: string): boolean {
  const lower = teamName.toLowerCase();
  const keywords = TEAM_KEYWORDS[abbrev] || TEAM_KEYWORDS[abbrev.toUpperCase()];
  if (!keywords) return false;
  return keywords.some(kw => lower.includes(kw));
}

// ═══════════════════════════════════════
// COMPREHENSIVE PROP TYPE → STAT MAPPING
// ═══════════════════════════════════════
function getPropValue(ps: any, propType: string): number | null {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s_-]/g, '');

  // Points
  if (['points', 'pts', 'playerpoints', 'point', 'pointsscored'].includes(pt)) return ps.Points ?? null;
  // Rebounds
  if (['rebounds', 'reb', 'playerrebounds', 'totalrebounds', 'rebound'].includes(pt)) return ps.Rebounds ?? null;
  // Assists
  if (['assists', 'ast', 'playerassists', 'assist'].includes(pt)) return ps.Assists ?? null;
  // 3-Pointers
  if (['threes', 'threepointers', '3pt', 'threesmade', '3ptmade', 'playerthrees', 'threepointfieldgoalsmade', '3pmade', 'threepointersmade'].includes(pt)) return ps.ThreePointersMade ?? null;
  // Blocks
  if (['blocks', 'blk', 'playerblocks', 'blockedshots', 'blockshots', 'blks', 'block'].includes(pt)) return ps.BlockedShots ?? null;
  // Steals
  if (['steals', 'stl', 'playersteals', 'stls', 'steal'].includes(pt)) return ps.Steals ?? null;
  // Turnovers
  if (['turnovers', 'tov', 'playerturnovers', 'to', 'turnover'].includes(pt)) return ps.Turnovers ?? null;
  // Combos
  if (['pra', 'ptsrebast', 'pointsreboundsassists', 'pts+reb+ast', 'ptsrebasst'].includes(pt))
    return (ps.Points ?? 0) + (ps.Rebounds ?? 0) + (ps.Assists ?? 0);
  if (['ptsreb', 'pointsrebounds', 'pts+reb', 'pr'].includes(pt))
    return (ps.Points ?? 0) + (ps.Rebounds ?? 0);
  if (['ptsast', 'pointsassists', 'pts+ast', 'pa'].includes(pt))
    return (ps.Points ?? 0) + (ps.Assists ?? 0);
  if (['rebast', 'reboundsassists', 'reb+ast', 'ra'].includes(pt))
    return (ps.Rebounds ?? 0) + (ps.Assists ?? 0);
  if (['blksstls', 'blocksteals', 'blks+stls', 'blockssteals', 'stealsblocks', 'stlblk', 'blkstl'].includes(pt))
    return (ps.BlockedShots ?? 0) + (ps.Steals ?? 0);
  // Other
  if (['fantasypoints', 'fantasy', 'fp', 'dkfp'].includes(pt)) return ps.FantasyPoints ?? null;
  if (['minutes', 'min', 'mins'].includes(pt)) return ps.Minutes ?? null;
  if (['freethrowsmade', 'ftm', 'freethrows'].includes(pt)) return ps.FreeThrowsMade ?? null;
  if (['offensiverebounds', 'oreb'].includes(pt)) return ps.OffensiveRebounds ?? null;
  if (['defensiverebounds', 'dreb'].includes(pt)) return ps.DefensiveRebounds ?? null;
  if (['personalfouls', 'fouls', 'pf'].includes(pt)) return ps.PersonalFouls ?? null;

  console.warn('UNMAPPED PROP TYPE:', propType, '→ cleaned:', pt);
  return null;
}

// ═══════════════════════════════════════
// FUZZY PLAYER NAME MATCHING
// ═══════════════════════════════════════
function findPlayerStats(allStats: any[], playerName: string): any | null {
  if (!playerName || !allStats.length) return null;
  const target = playerName.toLowerCase().trim();
  const targetParts = target.split(' ').filter(Boolean);
  const targetFirst = targetParts[0] || '';
  const targetLast = targetParts[targetParts.length - 1] || '';

  // Remove suffixes for matching
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'];
  const targetClean = targetParts.filter(p => !suffixes.includes(p)).join(' ');
  const targetLastClean = targetClean.split(' ').pop() || targetLast;

  // Pass 1: Exact full name
  let match = allStats.find(ps => (ps.Name || '').toLowerCase().trim() === target);
  if (match) return match;

  // Pass 2: Cleaned name (without Jr/Sr)
  match = allStats.find(ps => {
    const name = (ps.Name || '').toLowerCase().trim();
    const parts = name.split(' ').filter((p: string) => !suffixes.includes(p));
    return parts.join(' ') === targetClean;
  });
  if (match) return match;

  // Pass 3: Last name + first initial
  match = allStats.find(ps => {
    const name = (ps.Name || '').toLowerCase().trim();
    const parts = name.split(' ').filter((p: string) => !suffixes.includes(p));
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    return last === targetLastClean && first[0] === targetFirst[0];
  });
  if (match) return match;

  // Pass 4: Unique last name match
  const lastMatches = allStats.filter(ps => {
    const parts = (ps.Name || '').toLowerCase().split(' ').filter((p: string) => !suffixes.includes(p));
    return (parts[parts.length - 1] || '') === targetLastClean;
  });
  if (lastMatches.length === 1) return lastMatches[0];

  console.log(`No stats found for: "${playerName}"`);
  return null;
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

    // ═══════════════════════════════════════
    // PHASE 1 — FETCH & UPDATE GAME SCORES
    // ═══════════════════════════════════════
    const fetchAndUpdateScores = async (dateStr: string) => {
      if (!apiKey) return 0;
      let updated = 0;
      try {
        const res = await fetch(
          `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${dateStr}?key=${apiKey}`
        );
        if (!res.ok) { console.warn(`SportsDataIO ${res.status} for ${dateStr}`); return 0; }
        const apiGames = await res.json();
        console.log(`SportsDataIO: ${apiGames.length} games for ${dateStr}`);

        const start = `${dateStr}T00:00:00${etOffset}`;
        const end = `${dateStr}T23:59:59${etOffset}`;

        const { data: ourGames } = await supabase
          .from('sbo_games')
          .select('id, home_team, away_team, external_id')
          .gte('game_date', start)
          .lte('game_date', end);

        if (!ourGames?.length) return 0;

        for (const ag of apiGames) {
          if (ag.HomeTeamScore === null || ag.AwayTeamScore === null) continue;
          if (!['Final', 'F/OT', 'F/2OT', 'F/3OT', 'F'].includes(ag.Status)) continue;
          if (ag.HomeTeamScore < 60 || ag.AwayTeamScore < 60) continue;

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
            if (!error) { updated++; console.log(`Score: ${matched.home_team} ${ag.HomeTeamScore}-${ag.AwayTeamScore}`); }
          }
        }
      } catch (e: any) { console.warn(`Score fetch failed for ${dateStr}:`, e.message); }
      return updated;
    };

    if (force_yesterday) scoresUpdated += await fetchAndUpdateScores(yesterdayET);
    scoresUpdated += await fetchAndUpdateScores(yesterdayET);
    scoresUpdated += await fetchAndUpdateScores(todayET);

    // ═══════════════════════════════════════
    // PHASE 2 — VERIFY MONEYLINE PREDICTIONS
    // ═══════════════════════════════════════
    let gamesToVerify: any[] = [];
    if (game_id) {
      const { data } = await supabase.from('sbo_games').select('*').eq('id', game_id).single();
      if (data) gamesToVerify = [data];
    } else {
      const { data } = await supabase.from('sbo_games').select('*')
        .in('status', ['closed', 'completed', 'final'])
        .not('home_score', 'is', null).not('away_score', 'is', null);
      gamesToVerify = data || [];
    }

    let verified = 0, correct = 0, incorrect = 0, pushes = 0;

    for (const game of gamesToVerify) {
      let predQuery = supabase.from('sbo_predictions').select('*').eq('game_id', game.id);
      if (!force_rerun) predQuery = predQuery.eq('verified', false);
      if (prediction_id) predQuery = predQuery.eq('id', prediction_id);

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
        } else continue;

        const actualWinnerTeam = homeScore > awayScore ? game.home_team : game.away_team;
        const winScore = Math.max(homeScore, awayScore);
        const loseScore = Math.min(homeScore, awayScore);
        const verdictNote = `${actualWinnerTeam} won ${winScore}-${loseScore}. Predicted: ${pred.predicted_outcome === 'home' ? game.home_team : game.away_team}. ${verdict === 'correct' ? '✅ CORRECT' : '❌ INCORRECT'}`;

        await supabase.from('sbo_results_verification').upsert({
          prediction_id: pred.id, game_id: game.id, pick_type: 'game',
          our_pick: pred.predicted_outcome, our_confidence: pred.final_confidence,
          final_score_home: homeScore, final_score_away: awayScore,
          actual_result: `${game.home_team} ${homeScore} - ${game.away_team} ${awayScore}`,
          actual_winner: homeScore > awayScore ? 'home' : 'away',
          was_correct: verdict === 'correct', verdict, verdict_note: verdictNote,
          profit_loss: verdict === 'correct' ? 100 : -100,
          verified_at: new Date().toISOString(),
        }, { onConflict: 'prediction_id' });

        await supabase.from('sbo_predictions').update({
          verified: true, verdict, was_correct: verdict === 'correct',
          actual_outcome: verdict, final_score_home: homeScore, final_score_away: awayScore,
          verified_at: new Date().toISOString(),
        }).eq('id', pred.id);

        await supabase.from('sbo_saved_picks')
          .update({ result: verdict === 'correct' ? 'won' : 'lost' })
          .eq('source_id', pred.id);

        verified++;
        if (verdict === 'correct') correct++;
        else incorrect++;
      }
    }

    // ═══════════════════════════════════════
    // PHASE 3 — VERIFY PROP PREDICTIONS
    // (Uses bulk PlayerGameStatsByDate endpoint)
    // ═══════════════════════════════════════
    let propsVerified = 0, propsCorrect = 0, propsIncorrect = 0, propsPush = 0;
    let propsPending = 0;

    if (apiKey) {
      // Determine which dates to check
      const datesToCheck = specific_date ? [specific_date] : [yesterdayET, todayET];

      // Fetch all player stats using BULK endpoint (not per-game BoxScore)
      let allPlayerStats: any[] = [];
      for (const dateStr of datesToCheck) {
        try {
          const url = `https://api.sportsdata.io/v3/nba/stats/json/PlayerGameStatsByDate/${dateStr}?key=${apiKey}`;
          console.log(`Fetching bulk player stats for ${dateStr}`);
          const res = await fetch(url);
          if (res.ok) {
            const stats = await res.json();
            allPlayerStats = [...allPlayerStats, ...stats];
            console.log(`Got ${stats.length} player stat lines for ${dateStr}`);
          } else {
            console.warn(`PlayerGameStatsByDate ${res.status} for ${dateStr}`);
          }
        } catch (e: any) {
          console.warn(`Stats fetch failed for ${dateStr}:`, e.message);
        }
      }

      console.log(`Total player stat lines: ${allPlayerStats.length}`);

      // Get props that need verification — use game_date not created_at
      const targetDates = specific_date ? [specific_date] : [yesterdayET, todayET];

      for (const targetDate of targetDates) {
        let propsQuery = supabase
          .from('sbo_player_props')
          .select(`
            *,
            sbo_predictions(
              id, predicted_outcome, final_confidence, verdict, verified
            )
          `)
          .eq('game_date', targetDate);

        if (!force_rerun) {
          propsQuery = propsQuery.or('verdict.is.null,verified.is.null,verified.eq.false');
        }

        const { data: propsToVerify } = await propsQuery;
        console.log(`Props to verify for ${targetDate}: ${propsToVerify?.length || 0}`);

        if (!propsToVerify?.length) continue;

        for (const prop of propsToVerify) {
          try {
            // Use fuzzy player name matching
            const playerStat = findPlayerStats(allPlayerStats, prop.player_name);

            if (!playerStat) {
              propsPending++;
              continue;
            }

            // Use comprehensive prop type mapping
            const actualValue = getPropValue(playerStat, prop.prop_type);

            if (actualValue === null) {
              propsPending++;
              continue;
            }

            // Numeric comparison with epsilon
            const line = parseFloat(String(prop.line));
            const actualNum = parseFloat(String(actualValue));

            if (isNaN(line) || isNaN(actualNum)) {
              console.warn(`Invalid line/actual for ${prop.player_name}: line=${prop.line} actual=${actualValue}`);
              propsPending++;
              continue;
            }

            const epsilon = 0.001;
            const aiPick = prop.sbo_predictions?.[0]?.predicted_outcome?.toLowerCase() || null;

            let predictionVerdict: string;
            if (Math.abs(actualNum - line) < epsilon) {
              predictionVerdict = 'push';
            } else if (actualNum > line + epsilon) {
              predictionVerdict = aiPick === 'over' ? 'correct' : (aiPick === 'under' ? 'incorrect' : 'over');
            } else {
              predictionVerdict = aiPick === 'under' ? 'correct' : (aiPick === 'over' ? 'incorrect' : 'under');
            }

            console.log(
              `VERIFY: ${prop.player_name} ${prop.prop_type} line=${line} actual=${actualNum} pick=${aiPick} → ${predictionVerdict}`
            );

            const propVerdictNote = `${prop.player_name} had ${actualNum} ${prop.prop_type} (line: ${line}). Pick: ${(aiPick || 'N/A').toUpperCase()}. ${predictionVerdict === 'correct' ? '✅ CORRECT' : predictionVerdict === 'push' ? '➖ PUSH' : '❌ INCORRECT'}`;

            // Update sbo_player_props directly
            await supabase.from('sbo_player_props').update({
              actual_value: actualNum,
              verdict: predictionVerdict,
              verified: true,
              verified_at: new Date().toISOString(),
            }).eq('id', prop.id);

            // Update sbo_predictions
            if (prop.sbo_predictions?.[0]?.id) {
              await supabase.from('sbo_predictions').update({
                verified: true, verdict: predictionVerdict,
                was_correct: predictionVerdict === 'correct',
                actual_outcome: predictionVerdict,
                verified_at: new Date().toISOString(),
              }).eq('id', prop.sbo_predictions[0].id);

              // Upsert verification record
              await supabase.from('sbo_results_verification').upsert({
                prediction_id: prop.sbo_predictions[0].id,
                game_id: prop.game_id || null,
                pick_type: 'prop',
                our_pick: aiPick || 'unknown',
                our_confidence: prop.sbo_predictions[0].final_confidence || null,
                actual_result: `${prop.player_name} ${prop.prop_type}: ${actualNum} (line was ${line})`,
                actual_value: actualNum,
                was_correct: predictionVerdict === 'correct',
                verdict: predictionVerdict,
                verdict_note: propVerdictNote,
                profit_loss: predictionVerdict === 'correct' ? 100 : predictionVerdict === 'push' ? 0 : -100,
                verified_at: new Date().toISOString(),
              }, { onConflict: 'prediction_id' });

              // Update saved picks
              await supabase.from('sbo_saved_picks')
                .update({ result: predictionVerdict === 'correct' ? 'won' : predictionVerdict === 'push' ? 'push' : 'lost' })
                .eq('source_id', prop.sbo_predictions[0].id);
            }

            propsVerified++;
            if (predictionVerdict === 'correct') propsCorrect++;
            else if (predictionVerdict === 'incorrect') propsIncorrect++;
            else propsPush++;

          } catch (e: any) {
            console.error(`Prop verify failed for ${prop.player_name}:`, e.message);
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
    const accuracy = (correct + incorrect) > 0
      ? parseFloat(((correct / (correct + incorrect)) * 100).toFixed(1))
      : 0;

    console.log(`Games: ${correct - propsCorrect}W-${incorrect - propsIncorrect}L | Props: ${propsCorrect}W-${propsIncorrect}L (${propAccuracy}%) | Pending: ${propsPending}`);

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
      verified, correct, incorrect, pushes, scores_updated: scoresUpdated, accuracy,
      props_verified: propsVerified, props_correct: propsCorrect, props_incorrect: propsIncorrect,
      props_accuracy: propAccuracy, props_pending: propsPending,
      overall_correct: correct, overall_incorrect: incorrect,
      overall_accuracy: accuracy,
      message: verified === 0 && scoresUpdated === 0 ? 'No unverified games or props with final scores found' : undefined,
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
