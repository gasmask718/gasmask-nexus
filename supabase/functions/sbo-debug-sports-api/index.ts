import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SPORTS_KEY = Deno.env.get('SPORTSDATAIO_API_KEY');
    const ODDS_KEY = Deno.env.get('ODDS_API_KEY');
    
    const results: any = {
      env_check: {
        sportsdataio_key_exists: !!SPORTS_KEY,
        sportsdataio_key_prefix: SPORTS_KEY ? SPORTS_KEY.substring(0, 8) + '...' : 'MISSING',
        odds_api_key_exists: !!ODDS_KEY,
      },
      api_tests: {}
    };

    // Test 1 — Team Season Stats
    try {
      const r1 = await fetch(
        `https://api.sportsdata.io/v3/nba/stats/json/TeamSeasonStats/2025?key=${SPORTS_KEY}`
      );
      const body1 = await r1.text();
      results.api_tests.team_season_stats = {
        status: r1.status,
        ok: r1.ok,
        sample: r1.ok ? JSON.parse(body1).slice(0, 2) : body1.slice(0, 300)
      };
    } catch (e: any) {
      results.api_tests.team_season_stats = { error: e.message };
    }

    // Test 2 — Standings
    try {
      const r2 = await fetch(
        `https://api.sportsdata.io/v3/nba/scores/json/Standings/2025?key=${SPORTS_KEY}`
      );
      const body2 = await r2.text();
      results.api_tests.standings = {
        status: r2.status,
        ok: r2.ok,
        sample: r2.ok ? JSON.parse(body2).slice(0, 2) : body2.slice(0, 300)
      };
    } catch (e: any) {
      results.api_tests.standings = { error: e.message };
    }

    // Test 3 — Today's games
    const today = new Date().toLocaleDateString('en-CA', { 
      timeZone: 'America/New_York' 
    });
    try {
      const r3 = await fetch(
        `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${today}?key=${SPORTS_KEY}`
      );
      const body3 = await r3.text();
      results.api_tests.games_today = {
        status: r3.status,
        ok: r3.ok,
        date_used: today,
        sample: r3.ok ? JSON.parse(body3).slice(0, 2) : body3.slice(0, 300)
      };
    } catch (e: any) {
      results.api_tests.games_today = { error: e.message };
    }

    // Test 4 — Player injuries
    try {
      const r4 = await fetch(
        `https://api.sportsdata.io/v3/nba/scores/json/PlayerInjuries?key=${SPORTS_KEY}`
      );
      const body4 = await r4.text();
      results.api_tests.injuries = {
        status: r4.status,
        ok: r4.ok,
        count: r4.ok ? JSON.parse(body4).length : 0,
        error_body: !r4.ok ? body4.slice(0, 300) : null
      };
    } catch (e: any) {
      results.api_tests.injuries = { error: e.message };
    }

    // Test 5 — Check what season string works
    for (const season of ['2025', '2026', '2024', '2024POST']) {
      try {
        const r = await fetch(
          `https://api.sportsdata.io/v3/nba/stats/json/TeamSeasonStats/${season}?key=${SPORTS_KEY}`
        );
        const body = await r.text();
        results.api_tests[`season_test_${season}`] = {
          status: r.status,
          ok: r.ok,
          count: r.ok ? JSON.parse(body).length : 0
        };
      } catch (e: any) {
        results.api_tests[`season_test_${season}`] = { error: e.message };
      }
    }

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
