import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];

    // Fetch PrizePicks NBA projections from their public API
    const res = await fetch('https://api.prizepicks.com/projections?league_id=7&per_page=250', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!res.ok) {
      throw new Error(`PrizePicks API error: ${res.status}`);
    }

    const ppData = await res.json();
    const projections = ppData?.data || [];
    const included = ppData?.included || [];

    // Build player lookup from included
    const playerMap: Record<string, any> = {};
    for (const inc of included) {
      if (inc.type === 'new_player') {
        playerMap[inc.id] = {
          name: inc.attributes?.display_name || inc.attributes?.name,
          team: inc.attributes?.team,
          position: inc.attributes?.position,
          image_url: inc.attributes?.image_url,
        };
      }
    }

    // Map PrizePicks stat types to our prop types
    const statTypeMap: Record<string, string> = {
      'Points': 'points',
      'Assists': 'assists',
      'Rebounds': 'rebounds',
      'Pts+Rebs+Asts': 'pts_reb_ast',
      'Pts+Asts': 'pts_ast',
      'Pts+Rebs': 'pts_reb',
      'Rebs+Asts': 'reb_ast',
      'Blocked Shots': 'blocks',
      'Steals': 'steals',
      'Turnovers': 'turnovers',
      '3-PT Made': 'threes',
      'Fantasy Score': 'fantasy',
    };

    // Get today's games to match props to game IDs
    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select('id, home_team, away_team')
      .gte('game_date', date + 'T00:00:00')
      .lte('game_date', date + 'T23:59:59');

    let inserted = 0;
    let skipped = 0;

    for (const proj of projections) {
      const attrs = proj.attributes;
      if (!attrs) continue;

      const playerId = proj.relationships?.new_player?.data?.id;
      const player = playerMap[playerId];
      if (!player) continue;

      const propType = statTypeMap[attrs.stat_type];
      if (!propType) {
        skipped++;
        continue;
      }

      const line = parseFloat(attrs.line_score);
      if (isNaN(line)) continue;

      // Match to a game
      const matchingGame = todayGames?.find(g =>
        g.home_team?.includes(player.team) || g.away_team?.includes(player.team) ||
        player.team?.includes(g.home_team) || player.team?.includes(g.away_team)
      );

      // Check if this prop already exists
      const { data: existing } = await supabase
        .from('sbo_player_props')
        .select('id')
        .eq('player_name', player.name)
        .eq('prop_type', propType)
        .eq('source', 'prizepicks')
        .gte('created_at', date + 'T00:00:00')
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      await supabase.from('sbo_player_props').insert({
        game_id: matchingGame?.id || null,
        player_name: player.name,
        team: player.team,
        prop_type: propType,
        line,
        over_odds: -120,
        under_odds: -120,
        source: 'prizepicks',
        entered_by: 'api',
        game_date: matchingGame?.game_date
          ? new Date(matchingGame.game_date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
          : new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      });
      inserted++;
    }

    // Log sync result
    await supabase.from('sbo_sync_log').insert({
      feed_name: 'prizepicks_props',
      last_synced_at: new Date().toISOString(),
      records_synced: inserted,
      status: 'success',
    });

    return new Response(JSON.stringify({
      success: true,
      date,
      inserted,
      skipped,
      total_projections: projections.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabase.from('sbo_sync_log').insert({
      feed_name: 'prizepicks_props',
      status: 'error',
      error_message: e instanceof Error ? e.message : 'Unknown error',
      last_synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
