import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function formatSDIODate(date: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${date.getFullYear()}-${months[date.getMonth()]}-${String(date.getDate()).padStart(2, '0')}`;
}

function getLastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY');
  const SPORTSDATA_KEY = Deno.env.get('SPORTSDATAIO_API_KEY');

  const results: any[] = [];
  let oddsGames: any[] = [];
  let sdioGames: any[] = [];
  let oddsError: string | null = null;
  let sdioError: string | null = null;

  // Fetch from The Odds API
  try {
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`;
    const oddsRes = await fetch(oddsUrl);
    const oddsStatus = oddsRes.status;
    if (oddsRes.ok) {
      oddsGames = await oddsRes.json();
    } else {
      oddsError = `Odds API ${oddsStatus}: ${await oddsRes.text()}`;
    }
    try { await supabase.from('api_fetch_logs').insert({ source: 'odds_api', status_code: oddsStatus, error_message: oddsError, games_returned: oddsGames.length }); } catch {}
  } catch (e) {
    oddsError = e instanceof Error ? e.message : 'Odds API fetch failed';
    try { await supabase.from('api_fetch_logs').insert({ source: 'odds_api', status_code: 0, error_message: oddsError, games_returned: 0 }); } catch {}
  }

  // Fetch from SportsDataIO
  try {
    const now = new Date();
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = formatSDIODate(estDate);
    const sdioUrl = `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${dateStr}?key=${SPORTSDATA_KEY}`;
    const sdioRes = await fetch(sdioUrl);
    const sdioStatus = sdioRes.status;
    if (sdioRes.ok) {
      sdioGames = await sdioRes.json();
    } else {
      sdioError = `SportsDataIO ${sdioStatus}: ${await sdioRes.text()}`;
    }
    try { await supabase.from('api_fetch_logs').insert({ source: 'sportsdata', status_code: sdioStatus, error_message: sdioError, games_returned: sdioGames.length }); } catch {}
  } catch (e) {
    sdioError = e instanceof Error ? e.message : 'SportsDataIO fetch failed';
    try { await supabase.from('api_fetch_logs').insert({ source: 'sportsdata', status_code: 0, error_message: sdioError, games_returned: 0 }); } catch {}
  }

  // Today's date in EST for game_date
  const todayEST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${todayEST.getFullYear()}-${String(todayEST.getMonth() + 1).padStart(2, '0')}-${String(todayEST.getDate()).padStart(2, '0')}`;

  let persisted = 0;

  // Merge data
  const gamesToProcess = oddsGames.length > 0 ? oddsGames : sdioGames.map(sg => ({
    id: sg.GameID?.toString() || crypto.randomUUID(),
    home_team: sg.HomeTeam,
    away_team: sg.AwayTeam,
    commence_time: sg.DateTime,
    bookmakers: [],
    _sdio: sg,
  }));

  for (const og of gamesToProcess) {
    const homeTeam = og.home_team || '';
    const awayTeam = og.away_team || '';
    const homeKey = getLastWord(homeTeam);
    const awayKey = getLastWord(awayTeam);

    // Find matching SDIO game
    const sdioMatch = sdioGames.find(sg =>
      getLastWord(sg.HomeTeam || '') === homeKey ||
      getLastWord(sg.AwayTeam || '') === awayKey
    );

    // Extract odds from DraftKings or first bookmaker
    let homeML: number | null = null;
    let awayML: number | null = null;
    let spread: number | null = null;
    let spreadOdds: number | null = null;
    let total: number | null = null;
    let totalOverOdds: number | null = null;
    let totalUnderOdds: number | null = null;

    const dk = og.bookmakers?.find((b: any) => b.key === 'draftkings') || og.bookmakers?.[0];
    if (dk) {
      const h2h = dk.markets?.find((m: any) => m.key === 'h2h');
      if (h2h) {
        homeML = h2h.outcomes?.find((o: any) => o.name === homeTeam)?.price ?? null;
        awayML = h2h.outcomes?.find((o: any) => o.name === awayTeam)?.price ?? null;
      }
      const spreads = dk.markets?.find((m: any) => m.key === 'spreads');
      if (spreads) {
        const homeSpread = spreads.outcomes?.find((o: any) => o.name === homeTeam);
        spread = homeSpread?.point ?? null;
        spreadOdds = homeSpread?.price ?? null;
      }
      const totals = dk.markets?.find((m: any) => m.key === 'totals');
      if (totals) {
        const over = totals.outcomes?.find((o: any) => o.name === 'Over');
        total = over?.point ?? null;
        totalOverOdds = over?.price ?? null;
        totalUnderOdds = totals.outcomes?.find((o: any) => o.name === 'Under')?.price ?? null;
      }
    }

    // ========== PERSIST TO sbo_games + sbo_odds ==========
    const externalId = og.id || sdioMatch?.GameID?.toString() || `${homeKey}-${awayKey}-${todayStr}`;

    try {
      // Check if game already exists by external_id
      const { data: existingGame } = await supabase
        .from('sbo_games')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();

      let gameUUID: string;

      if (existingGame) {
        gameUUID = existingGame.id;
        // Update scores/status if available
        await supabase.from('sbo_games').update({
          home_score: sdioMatch?.HomeTeamScore ?? null,
          away_score: sdioMatch?.AwayTeamScore ?? null,
          status: sdioMatch?.Status === 'Final' || sdioMatch?.Status === 'F/OT' ? 'closed' : 'scheduled',
        }).eq('id', gameUUID);
      } else {
        // Insert new game
        const { data: newGame } = await supabase.from('sbo_games').insert({
          external_id: externalId,
          home_team: homeTeam,
          away_team: awayTeam,
          game_date: `${todayStr}T00:00:00-04:00`,
          sport: 'NBA',
          status: 'scheduled',
          home_score: sdioMatch?.HomeTeamScore ?? null,
          away_score: sdioMatch?.AwayTeamScore ?? null,
        }).select('id').single();

        gameUUID = newGame?.id;
      }

      // Upsert odds if we have them and have a game UUID
      if (gameUUID && homeML != null) {
        // Delete old odds for this game+sportsbook+market, then insert fresh
        await supabase.from('sbo_odds')
          .delete()
          .eq('game_id', gameUUID)
          .eq('market_type', 'moneyline')
          .eq('sportsbook', 'draftkings');

        await supabase.from('sbo_odds').insert({
          game_id: gameUUID,
          market_type: 'moneyline',
          sportsbook: 'draftkings',
          home_odds: homeML,
          away_odds: awayML,
          home_spread: spread,
          total_line: total,
          over_odds: totalOverOdds,
          under_odds: totalUnderOdds,
          fetched_at: new Date().toISOString(),
        });
      }

      persisted++;
    } catch (persistErr) {
      console.error(`Failed to persist game ${homeTeam} vs ${awayTeam}:`, persistErr);
    }

    results.push({
      homeTeam,
      awayTeam,
      commenceTime: og.commence_time,
      homeMoneyline: homeML,
      awayMoneyline: awayML,
      spread,
      spreadOdds,
      total,
      totalOverOdds,
      totalUnderOdds,
      homeScore: sdioMatch?.HomeTeamScore ?? (og._sdio?.HomeTeamScore ?? null),
      awayScore: sdioMatch?.AwayTeamScore ?? (og._sdio?.AwayTeamScore ?? null),
      status: sdioMatch?.Status ?? (og._sdio?.Status ?? 'Scheduled'),
      quarter: sdioMatch?.Quarter ?? (og._sdio?.Quarter ?? null),
      clock: sdioMatch?.TimeRemainingMinutes != null
        ? `${sdioMatch.TimeRemainingMinutes}:${String(sdioMatch.TimeRemainingSeconds || 0).padStart(2, '0')}`
        : null,
    });
  }

  return new Response(JSON.stringify({
    games: results,
    meta: {
      oddsApiGames: oddsGames.length,
      sportsDataGames: sdioGames.length,
      merged: results.length,
      persisted,
      oddsError,
      sdioError,
      fetchedAt: new Date().toISOString(),
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
