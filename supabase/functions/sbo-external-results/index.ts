import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPORTSDATAIO_BASE: Record<string, string> = {
  NBA: 'https://api.sportsdata.io/v3/nba',
  NFL: 'https://api.sportsdata.io/v3/nfl',
  MLB: 'https://api.sportsdata.io/v3/mlb',
  NHL: 'https://api.sportsdata.io/v3/nhl',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const bodyText = await req.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(bodyText); } catch { body = {}; }

  const mode = (body.mode as string) || 'resolve';
  const apiKey = Deno.env.get('SPORTSDATAIO_API_KEY');

  try {
    // ── MODE: fetch ── Pull real results from SportsDataIO
    if (mode === 'fetch') {
      if (!apiKey) throw new Error('SPORTSDATAIO_API_KEY not configured');

      const sport = ((body.sport as string) || 'NBA').toUpperCase();
      const gameDate = body.game_date as string; // YYYY-MM-DD
      if (!gameDate) throw new Error('game_date required (YYYY-MM-DD)');

      const base = SPORTSDATAIO_BASE[sport];
      if (!base) throw new Error(`Unsupported sport: ${sport}`);

      let gameRows: Array<Record<string, unknown>> = [];
      let playerRows: Array<Record<string, unknown>> = [];

      if (sport === 'NBA') {
        // Fetch box scores by date
        const dateFormatted = gameDate.replace(/-/g, '-'); // already YYYY-MM-DD
        const url = `${base}/stats/json/BoxScores/${dateFormatted}?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`SportsDataIO NBA error [${resp.status}]: ${errText}`);
        }
        const boxScores = await resp.json();

        for (const box of boxScores) {
          const game = box.Game;
          if (!game) continue;

          const homeScore = game.HomeTeamScore ?? null;
          const awayScore = game.AwayTeamScore ?? null;
          const totalScore = homeScore != null && awayScore != null ? homeScore + awayScore : null;
          const winner = homeScore != null && awayScore != null
            ? (homeScore > awayScore ? game.HomeTeam : game.AwayTeam)
            : null;
          const spreadResult = homeScore != null && awayScore != null
            ? homeScore - awayScore
            : null;

          // Game-level row
          gameRows.push({
            event_id: `sdio-nba-${game.GameID}`,
            sport: 'NBA',
            league: 'NBA',
            game_date: gameDate,
            home_team: game.HomeTeam,
            away_team: game.AwayTeam,
            home_score: homeScore,
            away_score: awayScore,
            winner,
            total_score: totalScore,
            spread_result: spreadResult,
            source: 'api',
            api_provider: 'sportsdataio',
            verified: true,
            raw_payload: game,
          });

          // Player stats
          const allPlayers = [...(box.PlayerGames || [])];
          for (const pg of allPlayers) {
            const playerName = pg.Name;
            if (!playerName) continue;

            const statMap: Record<string, number | null> = {
              points: pg.Points,
              rebounds: pg.Rebounds,
              assists: pg.Assists,
              steals: pg.Steals,
              blocks: pg.BlockedShots,
              threes: pg.ThreePointersMade,
              turnovers: pg.Turnovers,
              minutes: pg.Minutes,
              pts_rebs_asts: (pg.Points || 0) + (pg.Rebounds || 0) + (pg.Assists || 0),
              pts_rebs: (pg.Points || 0) + (pg.Rebounds || 0),
              pts_asts: (pg.Points || 0) + (pg.Assists || 0),
              rebs_asts: (pg.Rebounds || 0) + (pg.Assists || 0),
            };

            for (const [statType, value] of Object.entries(statMap)) {
              if (value == null) continue;
              playerRows.push({
                event_id: `sdio-nba-${game.GameID}-${pg.PlayerID}-${statType}`,
                sport: 'NBA',
                league: 'NBA',
                game_date: gameDate,
                player_name: playerName,
                team: pg.Team,
                stat_type: statType,
                actual_value: value,
                home_team: game.HomeTeam,
                away_team: game.AwayTeam,
                home_score: homeScore,
                away_score: awayScore,
                winner,
                total_score: totalScore,
                spread_result: spreadResult,
                source: 'api',
                api_provider: 'sportsdataio',
                verified: true,
                raw_payload: pg,
              });
            }
          }
        }
      } else if (sport === 'NFL') {
        // NFL uses week-based scoring; use scores by date
        const url = `${base}/stats/json/BoxScoresByDate/${gameDate}?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`SportsDataIO NFL error [${resp.status}]: ${errText}`);
        }
        const boxScores = await resp.json();

        for (const box of (Array.isArray(boxScores) ? boxScores : [boxScores])) {
          const game = box.Score || box.Game;
          if (!game) continue;

          const homeScore = game.HomeScore ?? null;
          const awayScore = game.AwayScore ?? null;
          const totalScore = homeScore != null && awayScore != null ? homeScore + awayScore : null;
          const winner = homeScore != null && awayScore != null
            ? (homeScore > awayScore ? game.HomeTeam : game.AwayTeam)
            : null;

          gameRows.push({
            event_id: `sdio-nfl-${game.GameKey || game.ScoreID}`,
            sport: 'NFL',
            league: 'NFL',
            game_date: gameDate,
            home_team: game.HomeTeam,
            away_team: game.AwayTeam,
            home_score: homeScore,
            away_score: awayScore,
            winner,
            total_score: totalScore,
            spread_result: homeScore != null && awayScore != null ? homeScore - awayScore : null,
            source: 'api',
            api_provider: 'sportsdataio',
            verified: true,
            raw_payload: game,
          });

          for (const pg of [...(box.PlayerGames || [])]) {
            if (!pg.Name) continue;
            const stats: Record<string, number | null> = {
              passing_yards: pg.PassingYards,
              rushing_yards: pg.RushingYards,
              receiving_yards: pg.ReceivingYards,
              passing_touchdowns: pg.PassingTouchdowns,
              rushing_touchdowns: pg.RushingTouchdowns,
              receptions: pg.Receptions,
            };
            for (const [st, val] of Object.entries(stats)) {
              if (val == null) continue;
              playerRows.push({
                event_id: `sdio-nfl-${game.GameKey || game.ScoreID}-${pg.PlayerID}-${st}`,
                sport: 'NFL', league: 'NFL', game_date: gameDate,
                player_name: pg.Name, team: pg.Team, stat_type: st,
                actual_value: val, home_team: game.HomeTeam, away_team: game.AwayTeam,
                home_score: homeScore, away_score: awayScore, winner,
                total_score: totalScore, source: 'api', api_provider: 'sportsdataio',
                verified: true, raw_payload: pg,
              });
            }
          }
        }
      } else if (sport === 'MLB') {
        const url = `${base}/stats/json/BoxScores/${gameDate}?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`SportsDataIO MLB error [${resp.status}]: ${errText}`);
        }
        const boxScores = await resp.json();
        for (const box of boxScores) {
          const game = box.Game;
          if (!game) continue;
          const homeScore = game.HomeTeamRuns ?? null;
          const awayScore = game.AwayTeamRuns ?? null;
          gameRows.push({
            event_id: `sdio-mlb-${game.GameID}`,
            sport: 'MLB', league: 'MLB', game_date: gameDate,
            home_team: game.HomeTeam, away_team: game.AwayTeam,
            home_score: homeScore, away_score: awayScore,
            winner: homeScore != null && awayScore != null ? (homeScore > awayScore ? game.HomeTeam : game.AwayTeam) : null,
            total_score: homeScore != null && awayScore != null ? homeScore + awayScore : null,
            source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: game,
          });
        }
      }

      // Upsert all rows
      const allRows = [...gameRows, ...playerRows];
      if (!allRows.length) {
        return new Response(JSON.stringify({ success: true, games: 0, players: 0, message: 'No results found for this date' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Upsert in batches of 50
      let ingested = 0;
      for (let i = 0; i < allRows.length; i += 50) {
        const batch = allRows.slice(i, i + 50);
        const { data, error } = await supabase
          .from('sbo_external_results')
          .upsert(batch, { onConflict: 'event_id' })
          .select('id');
        if (error) {
          console.error('Upsert batch error:', error);
          continue;
        }
        ingested += data?.length || 0;
      }

      return new Response(JSON.stringify({
        success: true,
        sport,
        game_date: gameDate,
        games: gameRows.length,
        player_stats: playerRows.length,
        ingested,
        isolation: 'ACTIVE — does NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: ingest ── Manual bulk insert
    if (mode === 'ingest') {
      const results = body.results as Array<Record<string, unknown>>;
      if (!results?.length) {
        return new Response(JSON.stringify({ error: 'No results provided' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const rows = results.map(r => ({
        event_id: (r.event_id as string) || null,
        sport: (r.sport as string) || 'NBA',
        league: (r.league as string) || null,
        player_name: r.player_name as string,
        team: (r.team as string) || null,
        stat_type: r.stat_type as string,
        actual_value: r.actual_value as number,
        game_date: r.game_date as string,
        home_team: (r.home_team as string) || null,
        away_team: (r.away_team as string) || null,
        home_score: (r.home_score as number) || null,
        away_score: (r.away_score as number) || null,
        winner: (r.winner as string) || null,
        total_score: (r.total_score as number) || null,
        spread_result: (r.spread_result as number) || null,
        source: 'api',
        api_provider: (r.api_provider as string) || 'manual',
        verified: true,
        raw_payload: (r.raw_data as Record<string, unknown>) || null,
      }));

      const { data, error } = await supabase
        .from('sbo_external_results')
        .upsert(rows, { onConflict: 'player_name,stat_type,game_date,sport' })
        .select('id');
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, ingested: data?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── MODE: resolve ── Match capper picks to external results (ALL market types)
    if (mode === 'resolve') {
      const sport = (body.sport as string) || 'NBA';
      const dateFrom = body.date_from as string;
      const dateTo = body.date_to as string;

      // Get unresolved capper picks
      let picksQuery = supabase
        .from('sbo_capper_picks')
        .select('id, player_name, team, stat_type, line, direction, game_date, capper_id, market_type')
        .is('result', null);

      if (dateFrom) picksQuery = picksQuery.gte('game_date', dateFrom);
      if (dateTo) picksQuery = picksQuery.lte('game_date', dateTo);

      const { data: picks, error: picksErr } = await picksQuery.limit(500);
      if (picksErr) throw picksErr;
      if (!picks?.length) {
        return new Response(JSON.stringify({ resolved: 0, message: 'No unresolved picks found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const dates = [...new Set(picks.map(p => p.game_date).filter(Boolean))];
      if (!dates.length) {
        return new Response(JSON.stringify({ resolved: 0, message: 'No dates to match' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: extResults, error: extErr } = await supabase
        .from('sbo_external_results')
        .select('*')
        .in('game_date', dates);
      if (extErr) throw extErr;
      if (!extResults?.length) {
        return new Response(JSON.stringify({ resolved: 0, message: 'No external results for these dates' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let resolved = 0;
      const updates: Array<{ id: string; result: string; external_result_id: string; capper_id: string }> = [];

      for (const pick of picks) {
        const marketType = (pick.market_type || 'player_prop').toLowerCase();
        let result: string | null = null;
        let matchId: string | null = null;

        if (marketType === 'moneyline') {
          // Match by team
          const teamNorm = normalizeName(pick.team || '');
          const match = extResults.find(r =>
            r.winner && r.game_date === pick.game_date &&
            (normalizeName(r.home_team || '') === teamNorm || normalizeName(r.away_team || '') === teamNorm)
          );
          if (match?.winner) {
            matchId = match.id;
            result = normalizeName(match.winner) === teamNorm ? 'win' : 'loss';
          }

        } else if (marketType === 'spread') {
          const teamNorm = normalizeName(pick.team || '');
          const match = extResults.find(r =>
            r.spread_result != null && r.game_date === pick.game_date &&
            (normalizeName(r.home_team || '') === teamNorm || normalizeName(r.away_team || '') === teamNorm)
          );
          if (match && match.spread_result != null && pick.line != null) {
            matchId = match.id;
            const isHome = normalizeName(match.home_team || '') === teamNorm;
            const margin = isHome ? Number(match.spread_result) : -Number(match.spread_result);
            const adjusted = margin + (pick.line || 0);
            result = adjusted > 0 ? 'win' : adjusted < 0 ? 'loss' : 'push';
          }

        } else if (marketType === 'total' || marketType === 'over_under') {
          const match = extResults.find(r =>
            r.total_score != null && r.game_date === pick.game_date &&
            pick.team && (
              normalizeName(r.home_team || '') === normalizeName(pick.team) ||
              normalizeName(r.away_team || '') === normalizeName(pick.team)
            )
          );
          if (match && match.total_score != null && pick.line != null) {
            matchId = match.id;
            const direction = (pick.direction || '').toLowerCase();
            if (match.total_score === pick.line) {
              result = 'push';
            } else if (['over', 'more'].includes(direction)) {
              result = match.total_score > pick.line ? 'win' : 'loss';
            } else if (['under', 'less'].includes(direction)) {
              result = match.total_score < pick.line ? 'win' : 'loss';
            }
          }

        } else {
          // Player prop (default)
          const playerNorm = normalizeName(pick.player_name || '');
          const match = extResults.find(r =>
            normalizeName(r.player_name || '') === playerNorm &&
            (r.stat_type || '').toLowerCase() === (pick.stat_type || '').toLowerCase() &&
            r.game_date === pick.game_date
          );
          if (match?.actual_value != null) {
            matchId = match.id;
            const direction = (pick.direction || '').toLowerCase();
            const line = pick.line || 0;
            const actual = Number(match.actual_value);
            if (actual === line) {
              result = 'push';
            } else if (['over', 'more', 'yes'].includes(direction)) {
              result = actual > line ? 'win' : 'loss';
            } else if (['under', 'less', 'no'].includes(direction)) {
              result = actual < line ? 'win' : 'loss';
            }
          }
        }

        if (result && matchId) {
          updates.push({ id: pick.id, result, external_result_id: matchId, capper_id: pick.capper_id });
          resolved++;
        }
      }

      // Batch update picks
      for (const u of updates) {
        await supabase
          .from('sbo_capper_picks')
          .update({ result: u.result, external_result_id: u.external_result_id, data_source: 'external' })
          .eq('id', u.id);
      }

      // Update capper stats (ONLY capper stats, NOT props_master)
      const capperIds = [...new Set(updates.map(u => u.capper_id).filter(Boolean))];
      for (const capperId of capperIds) {
        const { data: capperPicks } = await supabase
          .from('sbo_capper_picks')
          .select('result')
          .eq('capper_id', capperId)
          .not('result', 'is', null);

        if (capperPicks?.length) {
          const wins = capperPicks.filter(p => p.result === 'win').length;
          const total = capperPicks.length;
          await supabase.from('sbo_cappers').update({
            win_rate: Math.round((wins / total) * 100),
            total_picks: total,
            last_active: new Date().toISOString(),
          }).eq('id', capperId);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        resolved,
        cappers_updated: capperIds.length,
        isolation: 'ACTIVE — capper stats ONLY, main engine untouched',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: backfill ── Fetch multiple dates
    if (mode === 'backfill') {
      if (!apiKey) throw new Error('SPORTSDATAIO_API_KEY not configured');
      const sport = ((body.sport as string) || 'NBA').toUpperCase();
      const startDate = body.start_date as string;
      const endDate = body.end_date as string;
      if (!startDate || !endDate) throw new Error('start_date and end_date required');

      const dates: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      let totalGames = 0;
      let totalPlayers = 0;
      const errors: string[] = [];

      for (const date of dates) {
        try {
          const innerResp = await fetch(Deno.env.get('SUPABASE_URL')! + '/functions/v1/sbo-external-results', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({ mode: 'fetch', sport, game_date: date }),
          });
          const innerData = await innerResp.json();
          totalGames += innerData.games || 0;
          totalPlayers += innerData.player_stats || 0;
        } catch (e) {
          errors.push(`${date}: ${e.message}`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        dates_processed: dates.length,
        total_games: totalGames,
        total_player_stats: totalPlayers,
        errors: errors.length ? errors : undefined,
        isolation: 'ACTIVE — does NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: status ──
    if (mode === 'status') {
      const { count: totalResults } = await supabase
        .from('sbo_external_results')
        .select('*', { count: 'exact', head: true });

      const { count: unresolvedPicks } = await supabase
        .from('sbo_capper_picks')
        .select('*', { count: 'exact', head: true })
        .is('result', null);

      const { count: externallyResolved } = await supabase
        .from('sbo_capper_picks')
        .select('*', { count: 'exact', head: true })
        .eq('data_source', 'external');

      const { data: sportBreakdown } = await supabase
        .from('sbo_external_results')
        .select('sport')
        .limit(1000);

      const bySport: Record<string, number> = {};
      for (const r of sportBreakdown || []) {
        bySport[r.sport || 'unknown'] = (bySport[r.sport || 'unknown'] || 0) + 1;
      }

      return new Response(JSON.stringify({
        external_results_count: totalResults || 0,
        unresolved_capper_picks: unresolvedPicks || 0,
        externally_resolved_picks: externallyResolved || 0,
        by_sport: bySport,
        isolation: 'ACTIVE — external results do NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('sbo-external-results error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase()
    .trim();
}
