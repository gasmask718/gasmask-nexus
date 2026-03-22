import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SDIO_KEY = () => Deno.env.get('VITE_SPORTSDATAIO_NBA_KEY')!;
const BASE = 'https://api.sportsdata.io/v3/nba';
const SEASON = '2025';

async function sdioGet(endpoint: string) {
  const url = `${BASE}${endpoint}?key=${SDIO_KEY()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SportsDataIO error: ${res.status} ${endpoint}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: Record<string, any> = {};

    // ── 1. PLAYER SEASON STATS ─────────────────────────────────
    try {
      const players = await sdioGet(`/stats/json/PlayerSeasonStats/${SEASON}`);
      let count = 0;

      for (const p of players) {
        const gp = p.Games || 1;
        await supabase.from('sbo_player_season_stats').upsert({
          player_id: p.PlayerID,
          player_name: `${p.Name}`,
          team: p.Team,
          team_id: p.TeamID,
          season: parseInt(SEASON),
          position: p.Position,
          games_played: gp,
          minutes_per_game: parseFloat((p.Minutes / gp).toFixed(1)),
          points_avg: parseFloat((p.Points / gp).toFixed(1)),
          assists_avg: parseFloat((p.Assists / gp).toFixed(1)),
          rebounds_avg: parseFloat((p.Rebounds / gp).toFixed(1)),
          steals_avg: parseFloat((p.Steals / gp).toFixed(1)),
          blocks_avg: parseFloat((p.BlockedShots / gp).toFixed(1)),
          threes_avg: parseFloat((p.ThreePointersMade / gp).toFixed(1)),
          turnovers_avg: parseFloat((p.Turnovers / gp).toFixed(1)),
          field_goal_pct: p.FieldGoalsPercentage || 0,
          three_point_pct: p.ThreePointersPercentage || 0,
          free_throw_pct: p.FreeThrowsPercentage || 0,
          fantasy_points_avg: parseFloat((p.FantasyPoints / gp).toFixed(1)),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id,season' });
        count++;
      }

      results.player_season_stats = count;
      await supabase.from('sbo_sync_log').insert({
        feed_name: 'player_season_stats',
        last_synced_at: new Date().toISOString(),
        records_synced: count,
        status: 'success',
      });
    } catch (e: any) {
      results.player_season_stats_error = e.message;
      await supabase.from('sbo_sync_log').insert({
        feed_name: 'player_season_stats',
        status: 'error',
        error_message: e.message,
        last_synced_at: new Date().toISOString(),
      });
    }

    // ── 2. INJURIES ────────────────────────────────────────────
    try {
      const injuries = await sdioGet('/scores/json/Injuries');
      let count = 0;

      await supabase.from('sbo_injuries').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

      for (const inj of injuries) {
        await supabase.from('sbo_injuries').upsert({
          player_id: inj.PlayerID,
          player_name: inj.Name,
          team: inj.Team,
          status: inj.Status,
          injury_type: inj.Injury,
          body_part: inj.BodyPart,
          practice_status: inj.PracticeStatus,
          start_date: inj.StartDate ? inj.StartDate.split('T')[0] : null,
          expected_return: inj.ExpectedReturn ? inj.ExpectedReturn.split('T')[0] : null,
          notes: inj.News,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id' });
        count++;
      }

      results.injuries = count;
      await supabase.from('sbo_sync_log').insert({
        feed_name: 'injuries',
        last_synced_at: new Date().toISOString(),
        records_synced: count,
        status: 'success',
      });
    } catch (e: any) {
      results.injuries_error = e.message;
    }

    // ── 3. TEAM STANDINGS / STATS ──────────────────────────────
    try {
      const standings = await sdioGet(`/scores/json/Standings/${SEASON}`);
      let count = 0;

      for (const t of standings) {
        await supabase.from('sbo_team_stats').upsert({
          team_id: t.TeamID,
          team_name: t.Name,
          team_key: t.Key,
          season: parseInt(SEASON),
          wins: t.Wins || 0,
          losses: t.Losses || 0,
          home_wins: t.HomeWins || 0,
          home_losses: t.HomeLosses || 0,
          away_wins: t.AwayWins || 0,
          away_losses: t.AwayLosses || 0,
          last_10_wins: t.LastTenWins || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'team_id,season' });
        count++;
      }

      results.team_stats = count;
      await supabase.from('sbo_sync_log').insert({
        feed_name: 'team_standings',
        last_synced_at: new Date().toISOString(),
        records_synced: count,
        status: 'success',
      });
    } catch (e: any) {
      results.team_stats_error = e.message;
    }

    await supabase.from('ai_instinct_log').insert({
      action_type: 'sbo_daily_sync',
      reasoning: 'SportsDataIO daily sync completed',
      input_data: { season: SEASON },
      decision_path: results,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
