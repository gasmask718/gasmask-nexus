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

// ── Fuzzy similarity (Dice coefficient on bigrams) ──
function bigrams(str: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
  return s;
}
function similarity(a: string, b: string): number {
  if (a === b) return 100;
  if (!a || !b) return 0;
  const bA = bigrams(a), bB = bigrams(b);
  let intersection = 0;
  for (const bg of bA) if (bB.has(bg)) intersection++;
  return Math.round((2 * intersection * 100) / (bA.size + bB.size));
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase()
    .trim();
}

// Team abbreviation map for fuzzy matching
const TEAM_ALIASES: Record<string, string[]> = {
  lakers: ['lal', 'los angeles lakers', 'la lakers'],
  celtics: ['bos', 'boston celtics'],
  warriors: ['gsw', 'golden state warriors', 'gs warriors'],
  bucks: ['mil', 'milwaukee bucks'],
  nuggets: ['den', 'denver nuggets'],
  suns: ['phx', 'phoenix suns'],
  heat: ['mia', 'miami heat'],
  sixers: ['phi', 'philadelphia 76ers', '76ers'],
  knicks: ['nyk', 'new york knicks', 'ny knicks'],
  nets: ['bkn', 'brooklyn nets'],
  bulls: ['chi', 'chicago bulls'],
  cavaliers: ['cle', 'cleveland cavaliers', 'cavs'],
  mavericks: ['dal', 'dallas mavericks', 'mavs'],
  timberwolves: ['min', 'minnesota timberwolves', 'wolves'],
  thunder: ['okc', 'oklahoma city thunder'],
  clippers: ['lac', 'la clippers', 'los angeles clippers'],
  raptors: ['tor', 'toronto raptors'],
  kings: ['sac', 'sacramento kings'],
  hawks: ['atl', 'atlanta hawks'],
  hornets: ['cha', 'charlotte hornets'],
  pacers: ['ind', 'indiana pacers'],
  magic: ['orl', 'orlando magic'],
  pistons: ['det', 'detroit pistons'],
  grizzlies: ['mem', 'memphis grizzlies'],
  pelicans: ['nop', 'new orleans pelicans'],
  spurs: ['sas', 'san antonio spurs'],
  blazers: ['por', 'portland trail blazers', 'trail blazers'],
  jazz: ['uta', 'utah jazz'],
  wizards: ['was', 'washington wizards'],
  rockets: ['hou', 'houston rockets'],
};

function normalizeTeam(name: string): string {
  const n = normalizeName(name);
  for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
    if (n === canonical || aliases.some(a => n.includes(a) || a.includes(n))) return canonical;
  }
  return n;
}

// Stat type normalization
const STAT_ALIASES: Record<string, string[]> = {
  points: ['pts', 'point', 'scoring'],
  rebounds: ['rebs', 'reb', 'rebound', 'total rebounds'],
  assists: ['ast', 'asts', 'assist'],
  steals: ['stl', 'steal'],
  blocks: ['blk', 'block', 'blocked shots'],
  threes: ['3pt', '3pm', 'three pointers', 'three pointers made', 'threepointersmade'],
  turnovers: ['tov', 'to', 'turnover'],
  pts_rebs_asts: ['pra', 'points rebounds assists', 'pts+rebs+asts'],
  pts_rebs: ['pr', 'points rebounds', 'pts+rebs'],
  pts_asts: ['pa', 'points assists', 'pts+asts'],
  rebs_asts: ['ra', 'rebounds assists', 'rebs+asts'],
  passing_yards: ['pass yds', 'passing yds'],
  rushing_yards: ['rush yds', 'rushing yds'],
  receiving_yards: ['rec yds', 'receiving yds'],
  receptions: ['rec', 'catches'],
};

function normalizeStat(stat: string): string {
  const s = stat.toLowerCase().replace(/[_\-]/g, ' ').trim();
  for (const [canonical, aliases] of Object.entries(STAT_ALIASES)) {
    if (s === canonical.replace(/_/g, ' ') || aliases.includes(s)) return canonical;
  }
  return s.replace(/\s+/g, '_');
}

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
    // ── MODE: fetch ──
    if (mode === 'fetch') {
      if (!apiKey) throw new Error('SPORTSDATAIO_API_KEY not configured');

      const sport = ((body.sport as string) || 'NBA').toUpperCase();
      const gameDate = body.game_date as string;
      if (!gameDate) throw new Error('game_date required (YYYY-MM-DD)');

      const base = SPORTSDATAIO_BASE[sport];
      if (!base) throw new Error(`Unsupported sport: ${sport}`);

      let gameRows: Array<Record<string, unknown>> = [];
      let playerRows: Array<Record<string, unknown>> = [];

      if (sport === 'NBA') {
        const url = `${base}/stats/json/BoxScores/${gameDate}?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) { const t = await resp.text(); throw new Error(`SportsDataIO NBA [${resp.status}]: ${t}`); }
        const boxScores = await resp.json();

        for (const box of boxScores) {
          const game = box.Game;
          if (!game) continue;
          const hs = game.HomeTeamScore ?? null, as_ = game.AwayTeamScore ?? null;
          const ts = hs != null && as_ != null ? hs + as_ : null;
          const w = hs != null && as_ != null ? (hs > as_ ? game.HomeTeam : game.AwayTeam) : null;
          const sr = hs != null && as_ != null ? hs - as_ : null;

          gameRows.push({
            event_id: `sdio-nba-${game.GameID}`, sport: 'NBA', league: 'NBA', game_date: gameDate,
            home_team: game.HomeTeam, away_team: game.AwayTeam,
            home_score: hs, away_score: as_, winner: w, total_score: ts, spread_result: sr,
            source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: game,
          });

          for (const pg of (box.PlayerGames || [])) {
            if (!pg.Name) continue;
            const statMap: Record<string, number | null> = {
              points: pg.Points, rebounds: pg.Rebounds, assists: pg.Assists,
              steals: pg.Steals, blocks: pg.BlockedShots, threes: pg.ThreePointersMade,
              turnovers: pg.Turnovers, minutes: pg.Minutes,
              pts_rebs_asts: (pg.Points||0)+(pg.Rebounds||0)+(pg.Assists||0),
              pts_rebs: (pg.Points||0)+(pg.Rebounds||0),
              pts_asts: (pg.Points||0)+(pg.Assists||0),
              rebs_asts: (pg.Rebounds||0)+(pg.Assists||0),
            };
            for (const [st, val] of Object.entries(statMap)) {
              if (val == null) continue;
              playerRows.push({
                event_id: `sdio-nba-${game.GameID}-${pg.PlayerID}-${st}`,
                sport: 'NBA', league: 'NBA', game_date: gameDate,
                player_name: pg.Name, team: pg.Team, stat_type: st, actual_value: val,
                home_team: game.HomeTeam, away_team: game.AwayTeam,
                home_score: hs, away_score: as_, winner: w, total_score: ts, spread_result: sr,
                source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: pg,
              });
            }
          }
        }
      } else if (sport === 'NFL') {
        const url = `${base}/stats/json/BoxScoresByDate/${gameDate}?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) { const t = await resp.text(); throw new Error(`SportsDataIO NFL [${resp.status}]: ${t}`); }
        const boxScores = await resp.json();

        for (const box of (Array.isArray(boxScores) ? boxScores : [boxScores])) {
          const game = box.Score || box.Game;
          if (!game) continue;
          const hs = game.HomeScore ?? null, as_ = game.AwayScore ?? null;
          const ts = hs != null && as_ != null ? hs + as_ : null;
          const w = hs != null && as_ != null ? (hs > as_ ? game.HomeTeam : game.AwayTeam) : null;

          gameRows.push({
            event_id: `sdio-nfl-${game.GameKey || game.ScoreID}`,
            sport: 'NFL', league: 'NFL', game_date: gameDate,
            home_team: game.HomeTeam, away_team: game.AwayTeam,
            home_score: hs, away_score: as_, winner: w, total_score: ts,
            spread_result: hs != null && as_ != null ? hs - as_ : null,
            source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: game,
          });

          for (const pg of (box.PlayerGames || [])) {
            if (!pg.Name) continue;
            const stats: Record<string, number | null> = {
              passing_yards: pg.PassingYards, rushing_yards: pg.RushingYards,
              receiving_yards: pg.ReceivingYards, passing_touchdowns: pg.PassingTouchdowns,
              rushing_touchdowns: pg.RushingTouchdowns, receptions: pg.Receptions,
            };
            for (const [st, val] of Object.entries(stats)) {
              if (val == null) continue;
              playerRows.push({
                event_id: `sdio-nfl-${game.GameKey || game.ScoreID}-${pg.PlayerID}-${st}`,
                sport: 'NFL', league: 'NFL', game_date: gameDate,
                player_name: pg.Name, team: pg.Team, stat_type: st, actual_value: val,
                home_team: game.HomeTeam, away_team: game.AwayTeam,
                home_score: hs, away_score: as_, winner: w, total_score: ts,
                source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: pg,
              });
            }
          }
        }
      } else if (sport === 'MLB') {
        const url = `${base}/stats/json/BoxScores/${gameDate}?key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) { const t = await resp.text(); throw new Error(`SportsDataIO MLB [${resp.status}]: ${t}`); }
        const boxScores = await resp.json();
        for (const box of boxScores) {
          const game = box.Game;
          if (!game) continue;
          const hs = game.HomeTeamRuns ?? null, as_ = game.AwayTeamRuns ?? null;
          gameRows.push({
            event_id: `sdio-mlb-${game.GameID}`,
            sport: 'MLB', league: 'MLB', game_date: gameDate,
            home_team: game.HomeTeam, away_team: game.AwayTeam,
            home_score: hs, away_score: as_,
            winner: hs != null && as_ != null ? (hs > as_ ? game.HomeTeam : game.AwayTeam) : null,
            total_score: hs != null && as_ != null ? hs + as_ : null,
            source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: game,
          });
        }
      }

      // Upsert all rows
      const allRows = [...gameRows, ...playerRows];
      if (!allRows.length) {
        return new Response(JSON.stringify({ success: true, games: 0, players: 0, message: 'No results found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let ingested = 0;
      for (let i = 0; i < allRows.length; i += 50) {
        const batch = allRows.slice(i, i + 50);
        const { data, error } = await supabase
          .from('sbo_external_results')
          .upsert(batch, { onConflict: 'event_id' })
          .select('id');
        if (error) { console.error('Upsert batch error:', error); continue; }
        ingested += data?.length || 0;
      }

      return new Response(JSON.stringify({
        success: true, sport, game_date: gameDate,
        games: gameRows.length, player_stats: playerRows.length, ingested,
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
        sport: (r.sport as string) || 'NBA', league: (r.league as string) || null,
        player_name: r.player_name as string, team: (r.team as string) || null,
        stat_type: r.stat_type as string, actual_value: r.actual_value as number,
        game_date: r.game_date as string, home_team: (r.home_team as string) || null,
        away_team: (r.away_team as string) || null, home_score: (r.home_score as number) || null,
        away_score: (r.away_score as number) || null, winner: (r.winner as string) || null,
        total_score: (r.total_score as number) || null, spread_result: (r.spread_result as number) || null,
        source: 'api', api_provider: (r.api_provider as string) || 'manual', verified: true,
        raw_payload: (r.raw_data as Record<string, unknown>) || null,
      }));

      const { data, error } = await supabase
        .from('sbo_external_results')
        .upsert(rows, { onConflict: 'event_id' })
        .select('id');
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, ingested: data?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── MODE: resolve ── Smart matching with fuzzy fallback + match logging
    if (mode === 'resolve') {
      const sport = (body.sport as string) || null;
      const dateFrom = body.date_from as string;
      const dateTo = body.date_to as string;
      const FUZZY_THRESHOLD = 85;

      let picksQuery = supabase
        .from('sbo_capper_picks')
        .select('id, player_name, team, stat_type, line, direction, game_date, capper_id, market_type')
        .is('result', null);

      if (dateFrom) picksQuery = picksQuery.gte('game_date', dateFrom);
      if (dateTo) picksQuery = picksQuery.lte('game_date', dateTo);

      const { data: picks, error: picksErr } = await picksQuery.limit(500);
      if (picksErr) throw picksErr;
      if (!picks?.length) {
        return new Response(JSON.stringify({ resolved: 0, unmatched: 0, message: 'No unresolved picks found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const dates = [...new Set(picks.map(p => p.game_date).filter(Boolean))];
      if (!dates.length) {
        return new Response(JSON.stringify({ resolved: 0, unmatched: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Paginated fetch of external results
      let extResults: any[] = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data: batch, error: extErr } = await supabase
          .from('sbo_external_results')
          .select('*')
          .in('game_date', dates)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (extErr) throw extErr;
        if (!batch?.length) break;
        extResults = extResults.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      }

      if (!extResults.length) {
        return new Response(JSON.stringify({ resolved: 0, unmatched: picks.length, message: 'No external results for these dates' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let resolved = 0;
      let unmatched = 0;
      const updates: Array<{ id: string; result: string; external_result_id: string; capper_id: string }> = [];
      const matchLogs: Array<Record<string, unknown>> = [];

      for (const pick of picks) {
        const marketType = (pick.market_type || 'player_prop').toLowerCase();
        let result: string | null = null;
        let matchId: string | null = null;
        let matchType = 'unmatched';
        let matchConfidence = 0;
        let matchDetails: Record<string, unknown> = {};

        if (marketType === 'moneyline') {
          const teamNorm = normalizeTeam(pick.team || '');
          const match = extResults.find(r =>
            r.winner && r.game_date === pick.game_date &&
            (normalizeTeam(r.home_team || '') === teamNorm || normalizeTeam(r.away_team || '') === teamNorm)
          );
          if (match?.winner) {
            matchId = match.id;
            matchType = 'team';
            matchConfidence = 100;
            result = normalizeTeam(match.winner) === teamNorm ? 'win' : 'loss';
            matchDetails = { team: pick.team, matched_winner: match.winner };
          }

        } else if (marketType === 'spread') {
          const teamNorm = normalizeTeam(pick.team || '');
          const match = extResults.find(r =>
            r.spread_result != null && r.game_date === pick.game_date &&
            (normalizeTeam(r.home_team || '') === teamNorm || normalizeTeam(r.away_team || '') === teamNorm)
          );
          if (match && match.spread_result != null && pick.line != null) {
            matchId = match.id;
            matchType = 'team';
            matchConfidence = 100;
            const isHome = normalizeTeam(match.home_team || '') === teamNorm;
            const margin = isHome ? Number(match.spread_result) : -Number(match.spread_result);
            const adjusted = margin + (pick.line || 0);
            result = adjusted > 0 ? 'win' : adjusted < 0 ? 'loss' : 'push';
            matchDetails = { team: pick.team, spread: match.spread_result, line: pick.line };
          }

        } else if (marketType === 'total' || marketType === 'over_under') {
          const teamNorm = normalizeTeam(pick.team || '');
          const match = extResults.find(r =>
            r.total_score != null && r.game_date === pick.game_date &&
            pick.team && (normalizeTeam(r.home_team || '') === teamNorm || normalizeTeam(r.away_team || '') === teamNorm)
          );
          if (match && match.total_score != null && pick.line != null) {
            matchId = match.id;
            matchType = 'team';
            matchConfidence = 100;
            const dir = (pick.direction || '').toLowerCase();
            if (match.total_score === pick.line) result = 'push';
            else if (['over', 'more'].includes(dir)) result = match.total_score > pick.line ? 'win' : 'loss';
            else if (['under', 'less'].includes(dir)) result = match.total_score < pick.line ? 'win' : 'loss';
            matchDetails = { total: match.total_score, line: pick.line, direction: dir };
          }

        } else {
          // Player prop — exact then fuzzy
          const playerNorm = normalizeName(pick.player_name || '');
          const statNorm = normalizeStat(pick.stat_type || '');

          // Exact match
          let match = extResults.find(r =>
            normalizeName(r.player_name || '') === playerNorm &&
            normalizeStat(r.stat_type || '') === statNorm &&
            r.game_date === pick.game_date
          );

          if (match) {
            matchType = 'exact';
            matchConfidence = 100;
          } else {
            // Fuzzy fallback on player name
            let bestSim = 0;
            let bestMatch: any = null;
            for (const r of extResults) {
              if (r.game_date !== pick.game_date) continue;
              if (normalizeStat(r.stat_type || '') !== statNorm) continue;
              const sim = similarity(normalizeName(r.player_name || ''), playerNorm);
              if (sim > bestSim && sim >= FUZZY_THRESHOLD) {
                bestSim = sim;
                bestMatch = r;
              }
            }
            if (bestMatch) {
              match = bestMatch;
              matchType = 'fuzzy';
              matchConfidence = bestSim;
            }
          }

          if (match?.actual_value != null) {
            matchId = match.id;
            const dir = (pick.direction || '').toLowerCase();
            const line = pick.line || 0;
            const actual = Number(match.actual_value);
            if (actual === line) result = 'push';
            else if (['over', 'more', 'yes'].includes(dir)) result = actual > line ? 'win' : 'loss';
            else if (['under', 'less', 'no'].includes(dir)) result = actual < line ? 'win' : 'loss';
            matchDetails = {
              pick_player: pick.player_name, matched_player: match.player_name,
              pick_stat: pick.stat_type, matched_stat: match.stat_type,
              actual: match.actual_value, line: pick.line, similarity: matchConfidence,
            };
          }
        }

        // Log every match attempt
        matchLogs.push({
          pick_id: pick.id,
          external_result_id: matchId,
          match_type: matchType,
          match_confidence: matchConfidence,
          match_details: matchDetails,
          result,
        });

        if (result && matchId) {
          updates.push({ id: pick.id, result, external_result_id: matchId, capper_id: pick.capper_id });
          resolved++;
        } else {
          unmatched++;
        }
      }

      // Batch insert match logs
      if (matchLogs.length) {
        for (let i = 0; i < matchLogs.length; i += 50) {
          await supabase.from('sbo_external_match_logs').insert(matchLogs.slice(i, i + 50));
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
        success: true, resolved, unmatched, cappers_updated: capperIds.length,
        match_logs: matchLogs.length,
        isolation: 'ACTIVE — capper stats ONLY, main engine untouched',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: backfill ──
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

      let totalGames = 0, totalPlayers = 0;
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
        success: true, dates_processed: dates.length,
        total_games: totalGames, total_player_stats: totalPlayers,
        errors: errors.length ? errors : undefined,
        isolation: 'ACTIVE — does NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: match_logs ── Get recent match logs
    if (mode === 'match_logs') {
      const limit = Math.min(Number(body.limit) || 100, 500);
      const filterType = body.filter_type as string;

      let query = supabase
        .from('sbo_external_match_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filterType) query = query.eq('match_type', filterType);

      const { data, error } = await query;
      if (error) throw error;

      const summary = {
        total: data?.length || 0,
        exact: data?.filter(l => l.match_type === 'exact').length || 0,
        fuzzy: data?.filter(l => l.match_type === 'fuzzy').length || 0,
        team: data?.filter(l => l.match_type === 'team').length || 0,
        unmatched: data?.filter(l => l.match_type === 'unmatched').length || 0,
      };

      return new Response(JSON.stringify({ logs: data, summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

      // Match quality stats
      const { data: matchStats } = await supabase
        .from('sbo_external_match_logs')
        .select('match_type')
        .limit(1000);

      const matchQuality = { exact: 0, fuzzy: 0, team: 0, unmatched: 0 };
      for (const m of matchStats || []) {
        const t = m.match_type as keyof typeof matchQuality;
        if (t in matchQuality) matchQuality[t]++;
      }

      return new Response(JSON.stringify({
        external_results_count: totalResults || 0,
        unresolved_capper_picks: unresolvedPicks || 0,
        externally_resolved_picks: externallyResolved || 0,
        by_sport: bySport,
        match_quality: matchQuality,
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
