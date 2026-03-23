import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SDIO_KEY = () => Deno.env.get('VITE_SPORTSDATAIO_NBA_KEY')!;
const BASE = 'https://api.sportsdata.io/v3/nba';

async function sdioGet(endpoint: string) {
  const url = `${BASE}${endpoint}?key=${SDIO_KEY()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SportsDataIO ${res.status}: ${endpoint}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];
    const parts = date.split('-');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const sdioFormatted = `${parts[0]}-${months[parseInt(parts[1])-1]}-${parts[2]}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: Record<string, any> = { date };

    // ── 1. YESTERDAY'S GAME LOGS ──────────────────────────────
    try {
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yParts = yesterday.toISOString().split('T')[0].split('-');
      const yFormatted = `${yParts[0]}-${months[parseInt(yParts[1])-1]}-${yParts[2]}`;

      const gameLogs = await sdioGet(`/stats/json/PlayerGameStatsByDate/${yFormatted}`);
      let count = 0;

      for (const log of gameLogs) {
        if (!log.Minutes || log.Minutes === 0) continue;
        await supabase.from('sbo_player_game_logs').upsert({
          player_id: log.PlayerID,
          player_name: log.Name,
          team: log.Team,
          game_id: log.GameID,
          game_date: log.GameDate ? log.GameDate.split('T')[0] : yesterday.toISOString().split('T')[0],
          opponent: log.Opponent,
          home_away: log.HomeOrAway?.toLowerCase() === 'home' ? 'home' : 'away',
          started: (log.Started || 0) > 0,
          minutes: log.Minutes,
          points: log.Points,
          assists: log.Assists,
          rebounds: log.Rebounds,
          steals: log.Steals,
          blocks: log.BlockedShots,
          threes: log.ThreePointersMade,
          turnovers: log.Turnovers,
          field_goals_made: log.FieldGoalsMade,
          field_goals_attempted: log.FieldGoalsAttempted,
          free_throws_made: log.FreeThrowsMade,
          free_throws_attempted: log.FreeThrowsAttempted,
          fantasy_points: log.FantasyPoints,
          plus_minus: log.PlusMinus,
        }, { onConflict: 'player_id,game_id' });
        count++;
      }

      results.game_logs = count;
    } catch (e: any) {
      results.game_logs_error = e.message;
    }

    // ── 2. TONIGHT'S PROJECTIONS ──────────────────────────────
    try {
      const projections = await sdioGet(`/projections/json/PlayerGameProjectionStatsByDate/${sdioFormatted}`);
      let count = 0;

      for (const proj of projections) {
        await supabase.from('sbo_player_projections').upsert({
          player_id: proj.PlayerID,
          player_name: proj.Name,
          team: proj.Team,
          game_id: proj.GameID,
          game_date: date,
          opponent: proj.Opponent,
          projected_minutes: proj.Minutes,
          projected_points: proj.Points,
          projected_assists: proj.Assists,
          projected_rebounds: proj.Rebounds,
          projected_steals: proj.Steals,
          projected_blocks: proj.BlockedShots,
          projected_threes: proj.ThreePointersMade,
          projected_turnovers: proj.Turnovers,
          projected_fantasy_points: proj.FantasyPoints,
          draftkings_salary: proj.DraftKingsSalary,
          fanduel_salary: proj.FanDuelSalary,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id,game_date' });
        count++;
      }

      results.projections = count;
    } catch (e: any) {
      results.projections_error = e.message;
    }

    // ── 3. TONIGHT'S PLAYER PROPS ─────────────────────────────
    try {
      const props = await sdioGet(`/odds/json/PlayerPropsByDate/${sdioFormatted}`);
      let count = 0;

      await supabase.from('sbo_sdio_props').delete().eq('game_date', date);

      for (const prop of props) {
        for (const market of prop.PlayerProps || []) {
          await supabase.from('sbo_sdio_props').insert({
            game_id: prop.GameID,
            game_date: date,
            player_id: market.PlayerID,
            player_name: market.PlayerName,
            team: market.Team,
            opponent: prop.AwayTeam === market.Team ? prop.HomeTeam : prop.AwayTeam,
            sportsbook: market.Sportsbook,
            bet_type: market.BetType,
            over_under: market.OverUnder,
            value: market.Value,
            over_payout: market.OverPayout,
            under_payout: market.UnderPayout,
            updated_at: new Date().toISOString(),
          });
          count++;
        }
      }

      results.props = count;
      await supabase.from('sbo_sync_log').insert({
        feed_name: 'player_props',
        last_synced_at: new Date().toISOString(),
        records_synced: count,
        status: 'success',
      });
    } catch (e: any) {
      results.props_error = e.message;
    }

    // ── 4. AUTO-POPULATE sbo_player_props FROM SDIO PROPS ─────
    try {
      const { data: sdioProps } = await supabase
        .from('sbo_sdio_props')
        .select('*')
        .eq('game_date', date)
        .eq('sportsbook', 'DraftKings');

      const { data: todayGames } = await supabase
        .from('sbo_games')
        .select('id, home_team, away_team')
        .gte('game_date', date + 'T00:00:00')
        .lte('game_date', date + 'T23:59:59');

      const propTypeMap: Record<string, string> = {
        'PlayerPoints': 'points',
        'PlayerAssists': 'assists',
        'PlayerRebounds': 'rebounds',
        'PlayerThreePointersMade': 'threes',
        'PlayerSteals': 'steals',
        'PlayerBlockedShots': 'blocks',
        'PlayerPointsReboundsAssists': 'pts_reb_ast',
        'PlayerPointsRebounds': 'pts_reb',
        'PlayerPointsAssists': 'pts_ast',
        'PlayerReboundsAssists': 'reb_ast',
        'PlayerTurnovers': 'turnovers',
      };

      let inserted = 0;
      const seenProps = new Set<string>();

      for (const prop of sdioProps || []) {
        if (prop.over_under !== 'Over') continue;
        const propType = propTypeMap[prop.bet_type];
        if (!propType) continue;

        const propKey = `${prop.player_id}-${prop.bet_type}`;
        if (seenProps.has(propKey)) continue;
        seenProps.add(propKey);

        const matchingGame = todayGames?.find(g =>
          g.home_team === prop.team || g.away_team === prop.team
        );
        if (!matchingGame) continue;

        const underProp = sdioProps?.find(p =>
          p.player_id === prop.player_id &&
          p.bet_type === prop.bet_type &&
          p.over_under === 'Under'
        );

        const { data: existing } = await supabase
          .from('sbo_player_props')
          .select('id')
          .eq('game_id', matchingGame.id)
          .eq('player_name', prop.player_name)
          .eq('prop_type', propType)
          .maybeSingle();

        if (!existing) {
          await supabase.from('sbo_player_props').insert({
            game_id: matchingGame.id,
            player_name: prop.player_name,
            team: prop.team,
            prop_type: propType,
            line: prop.value,
            over_odds: prop.over_payout,
            under_odds: underProp?.under_payout || -110,
            source: 'draftkings',
            entered_by: 'api',
            game_date: new Date(matchingGame.game_date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
          });
          inserted++;
        }
      }

      results.props_auto_populated = inserted;
    } catch (e: any) {
      results.props_populate_error = e.message;
    }

    return new Response(JSON.stringify({ success: true, date, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
