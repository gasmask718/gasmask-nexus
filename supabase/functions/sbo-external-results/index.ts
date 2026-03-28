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
    .replace(/\b(jr|sr|ii|iii|iv)\b/gi, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

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

// ── Context-based composite matching ──
function computeCompositeScore(pick: any, candidate: any): { score: number; details: Record<string, number> } {
  const nameSim = similarity(normalizeName(pick.player_name || ''), normalizeName(candidate.player_name || ''));
  const teamMatch = pick.team && candidate.team
    ? (normalizeTeam(pick.team) === normalizeTeam(candidate.team) ? 100 : 0)
    : (pick.team && candidate.home_team
      ? (normalizeTeam(pick.team) === normalizeTeam(candidate.home_team) || normalizeTeam(pick.team) === normalizeTeam(candidate.away_team) ? 100 : 0)
      : 50); // no team info = neutral
  const dateMatch = pick.game_date === candidate.game_date ? 100 : 0;
  const statMatch = normalizeStat(pick.stat_type || '') === normalizeStat(candidate.stat_type || '') ? 100 : 0;

  const score = Math.round(nameSim * 0.5 + teamMatch * 0.2 + dateMatch * 0.2 + statMatch * 0.1);
  return { score, details: { name: nameSim, team: teamMatch, date: dateMatch, stat: statMatch } };
}

// ── Grading logic ──
function computeGrade(winRate: number, total: number, hotStreak: number, coldStreak: number): string {
  if (total < 10) return 'C'; // insufficient data
  let grade = 'D';
  if (winRate >= 60) grade = 'A';
  else if (winRate >= 55) grade = 'B';
  else if (winRate >= 50) grade = 'C';
  // Streak modifiers
  if (hotStreak >= 5 && grade !== 'A') {
    grade = grade === 'B' ? 'A' : grade === 'C' ? 'B' : 'C';
  }
  if (coldStreak >= 5 && grade !== 'D') {
    grade = grade === 'A' ? 'B' : grade === 'B' ? 'C' : 'D';
  }
  return grade;
}

function computeStreaks(results: string[]): { hot: number; cold: number; bestEver: number; worstEver: number } {
  let hot = 0, cold = 0, bestEver = 0, worstEver = 0, cur = 0;
  for (const r of results) {
    if (r === 'win') { cur = cur > 0 ? cur + 1 : 1; }
    else if (r === 'loss') { cur = cur < 0 ? cur - 1 : -1; }
    else continue;
    if (cur > 0) { bestEver = Math.max(bestEver, cur); }
    else { worstEver = Math.max(worstEver, Math.abs(cur)); }
  }
  hot = cur > 0 ? cur : 0;
  cold = cur < 0 ? Math.abs(cur) : 0;
  return { hot, cold, bestEver, worstEver };
}

function computeROI(wins: number, losses: number, pushes: number, avgOdds: number): number {
  const total = wins + losses + pushes;
  if (total === 0) return 0;
  // Convert American odds to decimal payout
  const payout = avgOdds >= 100 ? avgOdds / 100 : 100 / Math.abs(avgOdds);
  const profit = wins * payout - losses;
  return Math.round((profit / total) * 10000) / 100; // percentage with 2 decimals
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
    // ══════════════════════════════════════
    // MODE: fetch
    // ══════════════════════════════════════
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
        if (!resp.ok) throw new Error(`SportsDataIO NBA [${resp.status}]: ${await resp.text()}`);
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
        if (!resp.ok) throw new Error(`SportsDataIO NFL [${resp.status}]: ${await resp.text()}`);
        const boxScores = await resp.json();
        for (const box of (Array.isArray(boxScores) ? boxScores : [boxScores])) {
          const game = box.Score || box.Game;
          if (!game) continue;
          const hs = game.HomeScore ?? null, as_ = game.AwayScore ?? null;
          const ts = hs != null && as_ != null ? hs + as_ : null;
          const w = hs != null && as_ != null ? (hs > as_ ? game.HomeTeam : game.AwayTeam) : null;
          gameRows.push({
            event_id: `sdio-nfl-${game.GameKey || game.ScoreID}`, sport: 'NFL', league: 'NFL', game_date: gameDate,
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
        if (!resp.ok) throw new Error(`SportsDataIO MLB [${resp.status}]: ${await resp.text()}`);
        const boxScores = await resp.json();
        for (const box of boxScores) {
          const game = box.Game;
          if (!game) continue;
          const hs = game.HomeTeamRuns ?? null, as_ = game.AwayTeamRuns ?? null;
          gameRows.push({
            event_id: `sdio-mlb-${game.GameID}`, sport: 'MLB', league: 'MLB', game_date: gameDate,
            home_team: game.HomeTeam, away_team: game.AwayTeam,
            home_score: hs, away_score: as_,
            winner: hs != null && as_ != null ? (hs > as_ ? game.HomeTeam : game.AwayTeam) : null,
            total_score: hs != null && as_ != null ? hs + as_ : null,
            source: 'api', api_provider: 'sportsdataio', verified: true, raw_payload: game,
          });
        }
      }

      let allRows = [...gameRows, ...playerRows];
      
      // ── AUTO-FALLBACK: try adjacent days if no games found ──
      if (!allRows.length && !body.no_fallback) {
        const fallbackDates = [];
        const d = new Date(gameDate);
        const prev = new Date(d); prev.setDate(prev.getDate() - 1);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        fallbackDates.push(prev.toISOString().split('T')[0], next.toISOString().split('T')[0]);
        
        for (const fbDate of fallbackDates) {
          // Check if we already have data for this date
          const { count } = await supabase.from('sbo_external_results')
            .select('*', { count: 'exact', head: true })
            .eq('game_date', fbDate).eq('sport', sport);
          if ((count || 0) > 0) continue;
          
          // Try fetching via recursive call (with no_fallback to prevent infinite loop)
          const fnUrl = Deno.env.get('SUPABASE_URL')! + '/functions/v1/sbo-external-results';
          const fnAuth = `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`;
          try {
            const fbResp = await fetch(fnUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': fnAuth },
              body: JSON.stringify({ mode: 'fetch', sport, game_date: fbDate, no_fallback: true }),
            });
            const fbData = await fbResp.json();
            if ((fbData.games || 0) > 0) {
              return new Response(JSON.stringify({
                success: true, sport, game_date: fbDate,
                games: fbData.games, player_stats: fbData.player_stats, ingested: fbData.ingested,
                fallback: true, original_date: gameDate,
                message: `No games on ${gameDate}. Found ${fbData.games} games on ${fbDate} instead.`,
                isolation: 'ACTIVE — does NOT affect props_master',
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } catch { /* skip fallback date */ }
        }
        
        return new Response(JSON.stringify({
          success: true, games: 0, players: 0,
          message: `No games found for ${sport} on ${gameDate} or adjacent days`,
          dates_checked: [gameDate, ...fallbackDates],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      if (!allRows.length) {
        return new Response(JSON.stringify({ success: true, games: 0, players: 0, message: 'No results found for this date' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let ingested = 0;
      for (let i = 0; i < allRows.length; i += 50) {
        const batch = allRows.slice(i, i + 50);
        const { data, error } = await supabase.from('sbo_external_results').upsert(batch, { onConflict: 'event_id' }).select('id');
        if (error) { console.error('Upsert batch error:', error); continue; }
        ingested += data?.length || 0;
      }

      return new Response(JSON.stringify({
        success: true, sport, game_date: gameDate, games: gameRows.length, player_stats: playerRows.length, ingested,
        isolation: 'ACTIVE — does NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════
    // MODE: ingest (manual bulk)
    // ══════════════════════════════════════
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
      const { data, error } = await supabase.from('sbo_external_results').upsert(rows, { onConflict: 'event_id' }).select('id');
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, ingested: data?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ══════════════════════════════════════════════════════════════
    // MODE: resolve — 5-layer matching + grading + ROI
    // ══════════════════════════════════════════════════════════════
    if (mode === 'resolve') {
      const sport = (body.sport as string) || null;
      const dateFrom = body.date_from as string;
      const dateTo = body.date_to as string;

      let picksQuery = supabase
        .from('sbo_capper_picks')
        .select('id, player_name, team, prop_type, line, direction, game_date, capper_id, bet_type, odds')
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
          .from('sbo_external_results').select('*').in('game_date', dates)
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

      let resolved = 0, unmatched = 0, needsReview = 0;
      const updates: Array<{ id: string; result: string; external_result_id: string; capper_id: string; bet_type: string; odds: number | null }> = [];
      const matchLogs: Array<Record<string, unknown>> = [];

      for (const pick of picks) {
        const marketType = (pick.bet_type || 'player_prop').toLowerCase();
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
            matchId = match.id; matchType = 'team'; matchConfidence = 100;
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
            matchId = match.id; matchType = 'team'; matchConfidence = 100;
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
            matchId = match.id; matchType = 'team'; matchConfidence = 100;
            const dir = (pick.direction || '').toLowerCase();
            if (match.total_score === pick.line) result = 'push';
            else if (['over', 'more'].includes(dir)) result = match.total_score > pick.line ? 'win' : 'loss';
            else if (['under', 'less'].includes(dir)) result = match.total_score < pick.line ? 'win' : 'loss';
            matchDetails = { total: match.total_score, line: pick.line, direction: dir };
          }
        } else {
          // ── Player prop: 5-layer matching ──
          const playerNorm = normalizeName(pick.player_name || '');
          const statNorm = normalizeStat(pick.prop_type || '');

          // LAYER 1: Exact match
          let match = extResults.find(r =>
            normalizeName(r.player_name || '') === playerNorm &&
            normalizeStat(r.stat_type || '') === statNorm &&
            r.game_date === pick.game_date
          );
          if (match) { matchType = 'exact'; matchConfidence = 100; }

          // LAYER 2: Normalized match (handles Jr/Sr/III removal)
          if (!match) {
            match = extResults.find(r =>
              r.game_date === pick.game_date &&
              normalizeStat(r.stat_type || '') === statNorm &&
              normalizeName(r.player_name || '') === playerNorm
            );
            if (match) { matchType = 'normalized'; matchConfidence = 95; }
          }

          // LAYER 3: Fuzzy name match (≥85%)
          if (!match) {
            let bestSim = 0;
            let bestMatch: any = null;
            for (const r of extResults) {
              if (r.game_date !== pick.game_date) continue;
              if (normalizeStat(r.stat_type || '') !== statNorm) continue;
              const sim = similarity(normalizeName(r.player_name || ''), playerNorm);
              if (sim > bestSim && sim >= 85) { bestSim = sim; bestMatch = r; }
            }
            if (bestMatch) { match = bestMatch; matchType = 'fuzzy'; matchConfidence = bestSim; }
          }

          // LAYER 4: Context composite match (70-84 → needs_review)
          if (!match) {
            let bestScore = 0;
            let bestCandidate: any = null;
            for (const r of extResults) {
              if (r.game_date !== pick.game_date) continue;
              if (!r.player_name) continue;
              const { score } = computeCompositeScore(pick, r);
              if (score > bestScore) { bestScore = score; bestCandidate = r; }
            }
            if (bestCandidate && bestScore >= 70) {
              match = bestCandidate;
              matchConfidence = bestScore;
              matchType = bestScore >= 85 ? 'context' : 'needs_review';
            }
          }

          if (match?.actual_value != null && matchType !== 'needs_review') {
            matchId = match.id;
            const dir = (pick.direction || '').toLowerCase();
            const line = pick.line || 0;
            const actual = Number(match.actual_value);
            if (actual === line) result = 'push';
            else if (['over', 'more', 'yes'].includes(dir)) result = actual > line ? 'win' : 'loss';
            else if (['under', 'less', 'no'].includes(dir)) result = actual < line ? 'win' : 'loss';
            matchDetails = {
              pick_player: pick.player_name, matched_player: match.player_name,
              pick_stat: pick.prop_type, matched_stat: match.stat_type,
              actual: match.actual_value, line: pick.line, similarity: matchConfidence,
            };
          } else if (matchType === 'needs_review') {
            matchId = match?.id || null;
            matchDetails = {
              pick_player: pick.player_name,
              best_candidate: match?.player_name,
              composite_score: matchConfidence,
              status: 'needs_review',
            };
          }
        }

        matchLogs.push({
          pick_id: pick.id, external_result_id: matchId, match_type: matchType,
          match_confidence: matchConfidence, match_details: matchDetails, result,
        });

        if (result && matchId && matchType !== 'needs_review') {
          updates.push({ id: pick.id, result, external_result_id: matchId, capper_id: pick.capper_id, bet_type: marketType, odds: pick.odds });
          resolved++;
        } else if (matchType === 'needs_review') {
          needsReview++;
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
        await supabase.from('sbo_capper_picks')
          .update({ result: u.result, external_result_id: u.external_result_id, data_source: 'external' })
          .eq('id', u.id);
      }

      // ── CAPPER GRADING + ROI ENGINE ──
      const capperIds = [...new Set(updates.map(u => u.capper_id).filter(Boolean))];
      for (const capperId of capperIds) {
        const { data: allPicks } = await supabase
          .from('sbo_capper_picks')
          .select('result, bet_type, game_date, odds, prop_type')
          .eq('capper_id', capperId)
          .not('result', 'is', null)
          .order('game_date', { ascending: true });

        if (!allPicks?.length) continue;

        const wins = allPicks.filter(p => p.result === 'win').length;
        const losses = allPicks.filter(p => p.result === 'loss').length;
        const pushes = allPicks.filter(p => p.result === 'push').length;
        const total = allPicks.length;
        const winRate = Math.round((wins / total) * 100);
        const results = allPicks.map(p => p.result!);
        const streaks = computeStreaks(results);
        const grade = computeGrade(winRate, total, streaks.hot, streaks.cold);
        const avgOdds = -110; // default assumption
        const roi = computeROI(wins, losses, pushes, avgOdds);

        // Weight calculation
        const gradeMultiplier: Record<string, number> = { A: 1.5, B: 1.2, C: 1.0, D: 0.6 };
        const roiMult = roi > 0 ? 1 + Math.min(roi / 100, 0.5) : Math.max(0.5, 1 + roi / 200);
        const capperWeight = Math.round((gradeMultiplier[grade] || 1) * roiMult * 100) / 100;

        // Find best market
        const marketMap: Record<string, { w: number; t: number }> = {};
        for (const p of allPicks) {
          const mt = p.bet_type || 'player_prop';
          if (!marketMap[mt]) marketMap[mt] = { w: 0, t: 0 };
          marketMap[mt].t++;
          if (p.result === 'win') marketMap[mt].w++;
        }
        let bestMarket = 'player_prop';
        let bestMarketWR = 0;
        for (const [mt, stats] of Object.entries(marketMap)) {
          const wr = stats.t >= 3 ? stats.w / stats.t : 0;
          if (wr > bestMarketWR) { bestMarketWR = wr; bestMarket = mt; }
        }

        // Update sbo_cappers
        await supabase.from('sbo_cappers').update({
          win_rate: winRate, total_picks: total, last_active: new Date().toISOString(),
          grade, capper_weight: capperWeight,
          hot_streak: streaks.hot, cold_streak: streaks.cold, best_market: bestMarket,
        }).eq('id', capperId);

        // ── ROI per market type ──
        for (const [mt, stats] of Object.entries(marketMap)) {
          const mLosses = allPicks.filter(p => (p.market_type || 'player_prop') === mt && p.result === 'loss').length;
          const mPushes = allPicks.filter(p => (p.market_type || 'player_prop') === mt && p.result === 'push').length;
          const mROI = computeROI(stats.w, mLosses, mPushes, avgOdds);
          const mWR = stats.t > 0 ? Math.round((stats.w / stats.t) * 100) : 0;

          await supabase.from('sbo_capper_roi').upsert({
            capper_id: capperId, sport: 'ALL', market_type: mt,
            total_bets: stats.t, wins: stats.w, losses: mLosses, pushes: mPushes,
            win_rate: mWR, total_profit: Math.round((stats.w * 0.909 - mLosses) * 100) / 100,
            roi_percentage: mROI, avg_odds: avgOdds,
            best_streak: streaks.bestEver, worst_streak: streaks.worstEver,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'capper_id,sport,market_type' });
        }
      }

      return new Response(JSON.stringify({
        success: true, resolved, unmatched, needs_review: needsReview,
        cappers_graded: capperIds.length, match_logs: matchLogs.length,
        isolation: 'ACTIVE — capper stats + ROI ONLY, main engine untouched',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════
    // MODE: backfill (fetch + auto-resolve + log)
    // ══════════════════════════════════════
    if (mode === 'backfill') {
      if (!apiKey) throw new Error('SPORTSDATAIO_API_KEY not configured');
      const sport = ((body.sport as string) || 'NBA').toUpperCase();
      const startDate = body.start_date as string;
      const endDate = body.end_date as string;
      if (!startDate || !endDate) throw new Error('start_date and end_date required');

      // Create backfill log entry
      const { data: logEntry } = await supabase.from('sbo_backfill_log').insert({
        sport, start_date: startDate, end_date: endDate, status: 'running',
      }).select('id').single();
      const logId = logEntry?.id;

      const dates: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      let totalGames = 0, totalPlayers = 0;
      const errors: string[] = [];
      const fnUrl = Deno.env.get('SUPABASE_URL')! + '/functions/v1/sbo-external-results';
      const fnAuth = `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`;

      // Phase 1: Fetch all dates
      for (const date of dates) {
        try {
          const innerResp = await fetch(fnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': fnAuth },
            body: JSON.stringify({ mode: 'fetch', sport, game_date: date }),
          });
          const innerData = await innerResp.json();
          totalGames += innerData.games || 0;
          totalPlayers += innerData.player_stats || 0;
        } catch (e) { errors.push(`fetch ${date}: ${e.message}`); }
      }

      // Phase 2: Auto-resolve all picks in this date range
      let resolvedCount = 0, failedCount = 0, unmatchedCount = 0;
      let wins = 0, losses = 0, pushes = 0;
      try {
        const resolveResp = await fetch(fnUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': fnAuth },
          body: JSON.stringify({ mode: 'resolve', sport, date_from: startDate, date_to: endDate }),
        });
        const resolveData = await resolveResp.json();
        resolvedCount = resolveData.resolved || 0;
        unmatchedCount = resolveData.unmatched || 0;
      } catch (e) { errors.push(`resolve: ${e.message}`); }

      // Phase 3: Count wins/losses in resolved range
      const { data: resolvedPicks } = await supabase.from('sbo_capper_picks')
        .select('result')
        .gte('game_date', startDate).lte('game_date', endDate)
        .not('result', 'is', null);
      if (resolvedPicks) {
        wins = resolvedPicks.filter(p => p.result === 'win').length;
        losses = resolvedPicks.filter(p => p.result === 'loss').length;
        pushes = resolvedPicks.filter(p => p.result === 'push').length;
      }

      // ROI summary
      const roiSummary = (wins + losses) > 0
        ? Math.round(((wins * 0.909 - losses) / (wins + losses + pushes)) * 10000) / 100
        : 0;

      // Update backfill log
      if (logId) {
        await supabase.from('sbo_backfill_log').update({
          total_dates: dates.length, total_games: totalGames, total_player_stats: totalPlayers,
          total_picks_found: resolvedCount + unmatchedCount,
          resolved_count: resolvedCount, failed_count: failedCount, unmatched_count: unmatchedCount,
          wins, losses, pushes, roi_summary: roiSummary,
          status: errors.length ? 'completed_with_errors' : 'completed',
          errors: errors.length ? errors : [],
          completed_at: new Date().toISOString(),
        }).eq('id', logId);
      }

      return new Response(JSON.stringify({
        success: true, log_id: logId, dates_processed: dates.length,
        total_games: totalGames, total_player_stats: totalPlayers,
        resolved: resolvedCount, unmatched: unmatchedCount, wins, losses, pushes, roi_summary: roiSummary,
        errors: errors.length ? errors : undefined,
        isolation: 'ACTIVE — does NOT affect props_master',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════
    // MODE: backfill_logs — get historical backfill runs
    // ══════════════════════════════════════
    if (mode === 'backfill_logs') {
      const { data, error } = await supabase
        .from('sbo_backfill_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ logs: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ══════════════════════════════════════
    // MODE: match_logs
    // ══════════════════════════════════════
    if (mode === 'match_logs') {
      const limit = Math.min(Number(body.limit) || 100, 500);
      const filterType = body.filter_type as string;
      let query = supabase.from('sbo_external_match_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (filterType) query = query.eq('match_type', filterType);
      const { data, error } = await query;
      if (error) throw error;
      const summary = {
        total: data?.length || 0,
        exact: data?.filter(l => l.match_type === 'exact').length || 0,
        normalized: data?.filter(l => l.match_type === 'normalized').length || 0,
        fuzzy: data?.filter(l => l.match_type === 'fuzzy').length || 0,
        context: data?.filter(l => l.match_type === 'context').length || 0,
        needs_review: data?.filter(l => l.match_type === 'needs_review').length || 0,
        team: data?.filter(l => l.match_type === 'team').length || 0,
        unmatched: data?.filter(l => l.match_type === 'unmatched').length || 0,
      };
      return new Response(JSON.stringify({ logs: data, summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ══════════════════════════════════════
    // MODE: capper_rankings
    // ══════════════════════════════════════
    if (mode === 'capper_rankings') {
      const { data: cappers } = await supabase
        .from('sbo_cappers')
        .select('id, name, telegram_username, win_rate, total_picks, grade, capper_weight, hot_streak, cold_streak, best_market, best_sport, status')
        .order('win_rate', { ascending: false })
        .limit(100);

      const { data: roiData } = await supabase
        .from('sbo_capper_roi')
        .select('capper_id, sport, market_type, wins, losses, pushes, total_bets, win_rate, roi_percentage, total_profit');

      const roiMap: Record<string, any[]> = {};
      for (const r of roiData || []) {
        if (!roiMap[r.capper_id]) roiMap[r.capper_id] = [];
        roiMap[r.capper_id].push(r);
      }

      const rankings = (cappers || []).map(c => ({
        ...c,
        roi_breakdown: roiMap[c.id] || [],
        badges: [
          ...(c.hot_streak && c.hot_streak >= 3 ? ['🔥 Hot'] : []),
          ...(c.cold_streak && c.cold_streak >= 3 ? ['❄️ Cold'] : []),
          ...((roiMap[c.id] || []).some(r => r.roi_percentage > 10) ? ['💰 High ROI'] : []),
          ...(c.grade === 'D' ? ['⚠️ Risky'] : []),
          ...(c.grade === 'A' ? ['👑 Elite'] : []),
        ],
      }));

      return new Response(JSON.stringify({ rankings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ══════════════════════════════════════
    // MODE: status
    // ══════════════════════════════════════
    if (mode === 'status') {
      const { count: totalResults } = await supabase.from('sbo_external_results').select('*', { count: 'exact', head: true });
      const { count: unresolvedPicks } = await supabase.from('sbo_capper_picks').select('*', { count: 'exact', head: true }).is('result', null);
      const { count: externallyResolved } = await supabase.from('sbo_capper_picks').select('*', { count: 'exact', head: true }).eq('data_source', 'external');
      const { data: sportBreakdown } = await supabase.from('sbo_external_results').select('sport').limit(1000);
      const bySport: Record<string, number> = {};
      for (const r of sportBreakdown || []) { bySport[r.sport || 'unknown'] = (bySport[r.sport || 'unknown'] || 0) + 1; }
      const { data: matchStats } = await supabase.from('sbo_external_match_logs').select('match_type').limit(1000);
      const matchQuality: Record<string, number> = { exact: 0, normalized: 0, fuzzy: 0, context: 0, needs_review: 0, team: 0, unmatched: 0 };
      for (const m of matchStats || []) { const t = m.match_type as string; if (t in matchQuality) matchQuality[t]++; }

      // ── AUTO-DETECT: find sports with unresolved picks ──
      const { data: pickSports } = await supabase
        .from('sbo_capper_picks')
        .select('sport')
        .is('result', null)
        .limit(500);
      const unresolvedBySport: Record<string, number> = {};
      for (const p of pickSports || []) {
        const s = (p.sport || 'NBA').toUpperCase();
        unresolvedBySport[s] = (unresolvedBySport[s] || 0) + 1;
      }
      const suggestedSports = Object.entries(unresolvedBySport)
        .sort((a, b) => b[1] - a[1])
        .map(([sport, count]) => ({ sport, unresolved_count: count }));

      return new Response(JSON.stringify({
        external_results_count: totalResults || 0, unresolved_capper_picks: unresolvedPicks || 0,
        externally_resolved_picks: externallyResolved || 0, by_sport: bySport, match_quality: matchQuality,
        suggested_sports: suggestedSports, unresolved_by_sport: unresolvedBySport,
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
