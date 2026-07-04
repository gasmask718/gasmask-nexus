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
  nfl: ['player_pass_yds','player_rush_yds','player_reception_yds','player_pass_tds','player_anytime_td'],
  mlb: ['batter_strikeouts','pitcher_strikeouts','batter_hits','batter_home_runs','batter_total_bases'],
  nhl: ['player_goals','player_assists','player_shots_on_goal','goalie_saves'],
  mma: ['fighter_to_win_by_ko_tko_dq','fight_goes_to_decision','fight_total_rounds'],
};

const PROP_TYPE_MAP: Record<string, string> = {
  player_points: 'points', player_rebounds: 'rebounds', player_assists: 'assists',
  player_threes: 'threes', player_blocks: 'blocks', player_steals: 'steals',
  player_pass_yds: 'pass_yards', player_rush_yds: 'rush_yards',
  player_reception_yds: 'rec_yards', player_pass_tds: 'pass_tds',
  player_anytime_td: 'anytime_td', player_receptions: 'receptions',
  batter_strikeouts: 'strikeouts_b', pitcher_strikeouts: 'strikeouts_p',
  batter_hits: 'hits', batter_home_runs: 'home_runs', batter_total_bases: 'total_bases',
  player_goals: 'goals', player_shots_on_goal: 'shots', goalie_saves: 'saves',
  fighter_to_win_by_ko_tko_dq: 'ko_win', fight_goes_to_decision: 'decision',
  fight_total_rounds: 'rounds',
};

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

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const { count } = await supabase
      .from('sbo_games').select('*', { count: 'exact', head: true })
      .eq('sport_key', sport_key)
      .gte('game_date', `${today}T00:00:00`).lte('game_date', `${today}T23:59:59`);

    if (count && count > 0) {
      return new Response(JSON.stringify({
        sport_key, games_fetched: count, games_inserted: 0,
        props_fetched: 0, props_inserted: 0,
        source: 'cache', message: `Using ${count} ${sport_key} games already fetched today`,
        errors,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const gamesUrl = `https://api.the-odds-api.com/v4/sports/${oddsApiSport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars`;
    const gamesResp = await fetch(gamesUrl);
    if (!gamesResp.ok) throw new Error(`Odds API games error ${gamesResp.status}: ${await gamesResp.text()}`);
    const games: any[] = await gamesResp.json();

    let games_inserted = 0;
    let props_fetched = 0;
    let props_inserted = 0;

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

        if (include_props && PROP_MARKETS[sport_key]?.length) {
          const propMarkets = PROP_MARKETS[sport_key].join(',');
          const propsUrl = `https://api.the-odds-api.com/v4/sports/${oddsApiSport}/events/${game.id}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${propMarkets}&oddsFormat=american&bookmakers=draftkings,fanduel,prizepicks`;
          try {
            const pr = await fetch(propsUrl);
            if (!pr.ok) {
              errors.push({ stage: 'props_fetch', detail: `${game.id} status ${pr.status}` });
            } else {
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
                      const { error: pErr } = await supabase.from('sbo_player_props').insert({
                        game_id: gameRecord.id,
                        sport_key,
                        player_name: player,
                        prop_type: stdType,
                        line: v.line,
                        over_odds: v.over_odds ?? null,
                        under_odds: v.under_odds ?? null,
                        source: bm.key,
                        game_date: today,
                      });
                      if (pErr) errors.push({ stage: 'prop_insert', detail: pErr.message });
                      else props_inserted++;
                    } catch (pe: any) {
                      errors.push({ stage: 'prop_insert', detail: pe?.message ?? String(pe) });
                    }
                  }
                }
              }
            }
          } catch (fe: any) {
            errors.push({ stage: 'props_fetch', detail: fe?.message ?? String(fe) });
          }
        }
      } catch (gameErr: any) {
        errors.push({ stage: 'game_loop', detail: gameErr?.message ?? String(gameErr) });
      }
    }

    try {
      await supabase.from('ai_instinct_log').insert({
        action_type: 'sbo_odds_fetched',
        reasoning: `[${sport_key}] ${games_inserted} games, ${props_inserted}/${props_fetched} props (${errors.length} errors)`,
        input_data: { sport_key, source: 'the_odds_api' },
        decision_path: { games_inserted, props_inserted, errors: errors.length },
      });
    } catch { /* ignore audit failures */ }

    return new Response(JSON.stringify({
      sport_key,
      games_fetched: games.length,
      games_inserted,
      props_fetched,
      props_inserted,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({
      sport_key,
      games_fetched: 0, games_inserted: 0,
      props_fetched: 0, props_inserted: 0,
      errors: [...errors, { stage: 'fatal', detail: e?.message ?? 'Unknown error' }],
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
