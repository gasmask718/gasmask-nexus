// supabase/functions/sbo-fetch-odds/index.ts
// SBO Multi-Sport Odds Fetcher — additive, NBA-safe
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPORT_MAP: Record<string, string> = {
  nba: 'basketball_nba',
  wnba: 'basketball_wnba',
  nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  mma: 'mma_mixed_martial_arts',
  soccer_epl: 'soccer_epl',
  ncaab: 'basketball_ncaab',
  ncaaf: 'americanfootball_ncaaf',
};

const PROP_MARKETS: Record<string, string[]> = {
  nba: ['player_points','player_rebounds','player_assists','player_threes','player_blocks','player_steals'],
  // WNBA — same market vocabulary as NBA on The Odds API (basketball_wnba)
  wnba: ['player_points','player_rebounds','player_assists','player_threes','player_blocks','player_steals'],
  nfl: ['player_pass_yds','player_rush_yds','player_reception_yds','player_pass_tds','player_anytime_td'],
  mlb: ['batter_strikeouts','pitcher_strikeouts','batter_hits','batter_home_runs','batter_total_bases'],
  nhl: ['player_goals','player_assists','player_shots_on_goal','player_total_saves'],
  mma: ['fighter_to_win_by_ko_tko_dq','fight_goes_to_decision','fight_total_rounds'],
};

const PROP_TYPE_MAP: Record<string, string> = {
  player_points: 'points', player_rebounds: 'rebounds', player_assists: 'assists',
  player_threes: 'threes', player_blocks: 'blocks', player_steals: 'steals',
  player_turnovers: 'turnovers',
  player_points_rebounds_assists: 'pts_reb_ast', player_points_rebounds: 'pts_reb',
  player_points_assists: 'pts_ast', player_rebounds_assists: 'reb_ast',
  player_pass_yds: 'pass_yards', player_rush_yds: 'rush_yards',
  player_reception_yds: 'rec_yards', player_pass_tds: 'pass_tds',
  player_anytime_td: 'anytime_td', player_receptions: 'receptions',
  batter_strikeouts: 'strikeouts_b', pitcher_strikeouts: 'strikeouts_p',
  batter_hits: 'hits', batter_home_runs: 'home_runs', batter_total_bases: 'total_bases',
  player_goals: 'goals', player_shots_on_goal: 'shots', player_total_saves: 'saves',
  goalie_saves: 'saves',
  fighter_to_win_by_ko_tko_dq: 'ko_win', fight_goes_to_decision: 'decision',
  fight_total_rounds: 'rounds',
};

// ---------------------------------------------------------------------------
// DAY BOUNDARY CONVENTION
// A sports "day" is the America/New_York calendar date. That is how US books,
// PrizePicks slates, and sbo_player_props.game_date (a DATE column) label a
// slate: a 10:05pm ET first pitch belongs to that ET date, not the next UTC
// date. We therefore label rows with the ET date, but query timestamptz
// columns with real UTC instants derived from that ET date.
// ---------------------------------------------------------------------------
function getEtOffsetHours(d: Date): number {
  // Difference between UTC and America/New_York for this instant (4 EDT / 5 EST)
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return Math.round((utc.getTime() - et.getTime()) / 3600000);
}

function etDayWindow(now = new Date()) {
  const etToday = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
  const offset = getEtOffsetHours(now);
  const start = new Date(`${etToday}T00:00:00${offset >= 0 ? '-' : '+'}${String(Math.abs(offset)).padStart(2, '0')}:00`);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 1);
  return { etToday, dayStartUtc: start.toISOString(), dayEndUtc: end.toISOString() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const errors: Array<{ stage: string; detail: string }> = [];
  let sport_key = 'nba';
  let include_props = true;

  try {
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.sport_key && typeof body.sport_key === 'string') sport_key = body.sport_key;
        if (typeof body?.include_props === 'boolean') include_props = body.include_props;
      } catch { /* empty body = defaults */ }
    }

    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const oddsApiSport = SPORT_MAP[sport_key] ?? 'basketball_nba';

    const { data: sportRow, error: sportErr } = await supabase
      .from('sbo_sports')
      .select('is_active, sport_name')
      .eq('sport_key', sport_key)
      .maybeSingle();

    if (sportErr) errors.push({ stage: 'sport_lookup', detail: sportErr.message });

    if (sportRow && sportRow.is_active === false) {
      return new Response(JSON.stringify({
        sport_key, games_fetched: 0, games_inserted: 0,
        props_fetched: 0, props_inserted: 0,
        message: `sport not active: ${sportRow.sport_name}`,
        errors,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { etToday, dayStartUtc, dayEndUtc } = etDayWindow();

    let games_inserted = 0;
    let props_fetched = 0;
    let props_inserted = 0;

    // The games cache is about GAMES ONLY. Props are fetched independently:
    // having games cached never implies props were ever fetched.
    const { data: cachedGames, error: cacheErr } = await supabase
      .from('sbo_games')
      .select('id, external_id, home_team, away_team, game_date')
      .eq('sport_key', sport_key)
      .gte('game_date', dayStartUtc)
      .lt('game_date', dayEndUtc);

    if (cacheErr) errors.push({ stage: 'games_cache_lookup', detail: cacheErr.message });

    const gamesAreCached = (cachedGames?.length ?? 0) > 0;

    type Target = { id: string; external_id: string; home_team: string; away_team: string };
    let gameTargets: Target[] = [];
    let games_fetched = 0;
    let source: 'cache' | 'api' = 'api';

    if (gamesAreCached) {
      source = 'cache';
      games_fetched = cachedGames!.length;
      gameTargets = cachedGames!.map((g: any) => ({
        id: g.id, external_id: g.external_id,
        home_team: g.home_team, away_team: g.away_team,
      }));
    } else {
      const gamesUrl = `https://api.the-odds-api.com/v4/sports/${oddsApiSport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars`;
      const gamesResp = await fetch(gamesUrl);
      if (!gamesResp.ok) throw new Error(`Odds API games error ${gamesResp.status}: ${await gamesResp.text()}`);
      const games: any[] = await gamesResp.json();
      games_fetched = games.length;

      for (const game of games) {
        try {
          const { data: gameRecord, error: gErr } = await supabase
            .from('sbo_games').upsert({
              external_id: game.id,
              sport: oddsApiSport,
              sport_key,
              home_team: game.home_team,
              away_team: game.away_team,
              game_date: game.commence_time,
              status: 'upcoming',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'external_id' }).select().single();

          if (gErr || !gameRecord) {
            errors.push({ stage: 'game_upsert', detail: gErr?.message ?? 'no record' });
            continue;
          }
          games_inserted++;
          gameTargets.push({
            id: gameRecord.id, external_id: game.id,
            home_team: game.home_team, away_team: game.away_team,
          });

          for (const bookmaker of game.bookmakers || []) {
            for (const market of bookmaker.markets || []) {
              try {
                const oddsData: any = {
                  game_id: gameRecord.id, sport_key,
                  sportsbook: bookmaker.key,
                  market_type: market.key === 'h2h' ? 'moneyline'
                    : market.key === 'spreads' ? 'spreads' : 'totals',
                  fetched_at: new Date().toISOString(),
                };
                if (market.key === 'h2h') {
                  for (const o of market.outcomes) {
                    if (o.name === game.home_team) oddsData.home_odds = o.price;
                    if (o.name === game.away_team) oddsData.away_odds = o.price;
                  }
                } else if (market.key === 'spreads') {
                  for (const o of market.outcomes) {
                    if (o.name === game.home_team) { oddsData.home_spread = o.point; oddsData.home_odds = o.price; }
                    if (o.name === game.away_team) { oddsData.away_spread = o.point; oddsData.away_odds = o.price; }
                  }
                } else if (market.key === 'totals') {
                  for (const o of market.outcomes) {
                    if (o.name === 'Over') { oddsData.total_line = o.point; oddsData.over_odds = o.price; }
                    if (o.name === 'Under') oddsData.under_odds = o.price;
                  }
                }
                await supabase.from('sbo_odds').insert(oddsData);
              } catch (mErr: any) {
                errors.push({ stage: 'odds_insert', detail: mErr?.message ?? String(mErr) });
              }
            }
          }
        } catch (gameErr: any) {
          errors.push({ stage: 'game_loop', detail: gameErr?.message ?? String(gameErr) });
        }
      }
    }

    // ---- Props pass: always runs, cached games or not ----
    if (include_props && PROP_MARKETS[sport_key]?.length) {
      const propMarkets = PROP_MARKETS[sport_key].join(',');
      for (const target of gameTargets) {
        if (!target.external_id) continue;
        const propsUrl = `https://api.the-odds-api.com/v4/sports/${oddsApiSport}/events/${target.external_id}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${propMarkets}&oddsFormat=american&bookmakers=draftkings,fanduel,prizepicks`;
        try {
          const pr = await fetch(propsUrl);
          if (!pr.ok) {
            errors.push({ stage: 'props_fetch', detail: `${target.external_id} status ${pr.status}` });
            continue;
          }
          const propData = await pr.json();
          for (const bm of propData.bookmakers || []) {
            for (const mk of bm.markets || []) {
              const stdType = PROP_TYPE_MAP[mk.key] ?? mk.key;
              const byPlayer: Record<string, any> = {};
              for (const oc of mk.outcomes || []) {
                const name = oc.description || oc.name;
                if (!name) continue;
                props_fetched++;
                if (!byPlayer[name]) byPlayer[name] = { line: oc.point };
                if (oc.name === 'Over') byPlayer[name].over_odds = oc.price;
                else if (oc.name === 'Under') byPlayer[name].under_odds = oc.price;
                byPlayer[name].line = oc.point ?? byPlayer[name].line;
              }
              for (const [player, v] of Object.entries<any>(byPlayer)) {
                try {
                  // team is NOT NULL; Odds API prop outcomes carry no team,
                  // so the matchup string is the honest fallback.
                  const { error: pErr } = await supabase.from('sbo_player_props').upsert({
                    game_id: target.id,
                    sport_key,
                    player_name: player,
                    team: `${target.away_team} @ ${target.home_team}`,
                    prop_type: stdType,
                    line: v.line,
                    over_odds: v.over_odds ?? null,
                    under_odds: v.under_odds ?? null,
                    source: bm.key,
                    game_date: etToday,
                    updated_at: new Date().toISOString(),
                  }, { onConflict: 'player_name,prop_type,game_date,source' });
                  if (pErr) errors.push({ stage: 'prop_insert', detail: pErr.message });
                  else props_inserted++;
                } catch (pe: any) {
                  errors.push({ stage: 'prop_insert', detail: pe?.message ?? String(pe) });
                }
              }
            }
          }
        } catch (fe: any) {
          errors.push({ stage: 'props_fetch', detail: fe?.message ?? String(fe) });
        }
      }
    }

    try {
      await supabase.from('ai_instinct_log').insert({
        action_type: 'sbo_odds_fetched',
        reasoning: `[${sport_key}] ${games_inserted} games (${source}), ${props_inserted}/${props_fetched} props (${errors.length} errors)`,
        input_data: { sport_key, source: 'the_odds_api', games_source: source, et_date: etToday },
        decision_path: { games_inserted, props_inserted, errors: errors.length },
      });
    } catch { /* ignore audit failures */ }

    // A provider auth/quota rejection is a FAILURE, not a quiet zero. The prop
    // loop only pushes `{stage:'props_fetch', detail:'... status 401'}` into
    // `errors`, so this used to return HTTP 200 with props_inserted: 0 — the
    // caller (sbo-day-engine) recorded a successful run and the dead Odds API
    // key went unnoticed for days. Normalize those to a real non-2xx.
    const authFailure = errors.find((e: any) =>
      /\bstatus (401|403|429)\b/.test(String(e?.detail ?? '')) ||
      /DEACTIVATED_KEY|INVALID_KEY|out of usage credits|quota/i.test(String(e?.detail ?? ''))
    );

    return new Response(JSON.stringify({
      sport_key,
      games_fetched,
      games_inserted,
      props_fetched,
      props_inserted,
      source,
      et_date: etToday,
      provider_auth_failure: authFailure ? String((authFailure as any).detail) : undefined,
      errors,
    }), {
      status: authFailure ? 502 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });



  } catch (e: any) {
    return new Response(JSON.stringify({
      sport_key,
      games_fetched: 0, games_inserted: 0,
      props_fetched: 0, props_inserted: 0,
      errors: [...errors, { stage: 'fatal', detail: e?.message ?? 'Unknown error' }],
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
