// sbo-result-tracker
// Resolves pending picks (signals, capper picks, prop picks) against ESPN public scoreboards,
// updates capper win/loss/push counters + streaks + win_rate, upserts weekly sport performance,
// then calls sbo-signal-combiner to refresh combined_confidence/signal_grade.
//
// No secrets required. ESPN public scoreboard endpoints are unauthenticated.
// TODO: Tennis/Golf/Boxing/NASCAR require a paid data source
// for result resolution — leaving as pending for now.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  type Game,
  findGameForRow,
  getNylaSkipped,
  resetNylaSkipped,
  sideMatchesTeam,
} from "../_shared/teamMatcher.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ESPN_ENDPOINTS: Record<string, string> = {
  NFL:   "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  NBA:   "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  MLB:   "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  NHL:   "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  NCAAF: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
  NCAAB: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard",
  MLS:   "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard",
  UFC:   "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard",
  WNBA:  "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard",
};

const ET_TZ = "America/New_York";

/**
 * Calendar date (YYYY-MM-DD) for a moment as seen in America/New_York.
 * en-CA locale yields ISO-ordered YYYY-MM-DD. Used everywhere a "slate date"
 * is needed so evening games never bleed into the next UTC day.
 */
function etDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: ET_TZ });
}

/** Half-open UTC instant range [start, end) covering one ET calendar day. */
function etDayWindowUtc(ymd: string): { startIso: string; endIso: string } {
  const [y, m, day] = ymd.split("-").map(Number);
  // Probe noon UTC on that date to read the ET offset without DST edge cases.
  const probe = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  const etWall = new Date(probe.toLocaleString("en-US", { timeZone: ET_TZ }));
  const offsetMs = probe.getTime() - etWall.getTime(); // e.g. +4h in EDT
  const startUtc = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) + offsetMs);
  const endUtc = new Date(startUtc.getTime() + 86400_000);
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString() };
}

/**
 * True when a stored game_date lands exactly on midnight ET — the signature of
 * a date-only placeholder row (272 NBA rows), never a real tip-off.
 */
function isMidnightEtPlaceholder(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  return (hour === "00" || hour === "24") && minute === "00";
}

/** Stable key bridging in-memory ESPN games to resolved sbo_games UUIDs. */
function gameKey(sport: string, ymd: string, home: string, away: string): string {
  return [sport, ymd, home, away].map((s) => String(s ?? "").trim().toLowerCase()).join("|");
}

// Game type + team-matching primitives imported from _shared/teamMatcher.ts

async function fetchCompletedGames(sport: string, url: string, errors: any[], dateYYYYMMDD?: string): Promise<Game[]> {
  try {
    const finalUrl = dateYYYYMMDD ? `${url}?dates=${dateYYYYMMDD}` : url;
    // The requested slate date is authoritative — ESPN returns UTC instants,
    // so parsing ev.date buckets 7pm ET night games into the NEXT day.
    const requestedDate = dateYYYYMMDD
      ? `${dateYYYYMMDD.slice(0, 4)}-${dateYYYYMMDD.slice(4, 6)}-${dateYYYYMMDD.slice(6, 8)}`
      : etDate();
    const res = await fetch(finalUrl);
    if (!res.ok) { errors.push({ sport, stage: "fetch", status: res.status, date: dateYYYYMMDD ?? "today" }); return []; }
    const json = await res.json();
    const events = json?.events ?? [];
    const games: Game[] = [];
    for (const ev of events) {
      if (ev?.status?.type?.completed !== true) continue;
      const comp = ev?.competitions?.[0];
      const competitors = comp?.competitors ?? [];
      const home = competitors.find((c: any) => c.homeAway === "home");
      const away = competitors.find((c: any) => c.homeAway === "away");
      if (!home || !away) continue;
      const homeScore = Number(home.score);
      const awayScore = Number(away.score);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      
      const gameDate = requestedDate;
      if (!gameDate) continue;
      games.push({
        sport, game_date: gameDate,
        home_team: String(home?.team?.displayName ?? home?.team?.name ?? "").trim(),
        away_team: String(away?.team?.displayName ?? away?.team?.name ?? "").trim(),
        home_score: homeScore, away_score: awayScore,
        final_total: homeScore + awayScore,
      });
    }
    return games;
  } catch (e: any) {
    errors.push({ sport, stage: "fetch_exception", message: e?.message });
    return [];
  }
}

// norm / MLB_ALIASES / AMBIGUOUS_MLB_TOKENS / splitSideCandidates /
// sideMatchesTeam / findGameForRow moved to ../_shared/teamMatcher.ts
// (imported at top). Behavior unchanged.


type Resolution = { result: "win" | "loss" | "push" | "pending"; pnl: number };

function winPnl(stake: number, oddsIn: number | null): number {
  const odds = oddsIn ?? -110;
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}
function resolveSpread(game: Game, side: string, line: number, stake: number, odds: number | null): Resolution {
  const { takingHome, takingAway } = sideTakes(game, side);
  // No-match guard: an unrecognized side is ungradeable, never a loss.
  if (!takingHome && !takingAway) return { result: "pending", pnl: 0 };
  const margin = takingHome ? game.home_score - game.away_score : game.away_score - game.home_score;

  // `line` is stored from the perspective of the picked side (e.g. +1.5 for a
  // dog, -7.5 for a favorite). Cover math is margin + line: losing by 1 with
  // +1.5 → net +0.5 → win. Never take the absolute value of the line.
  const net = margin + line;
  if (net === 0) return { result: "push", pnl: 0 };
  const won = net > 0;
  return { result: won ? "win" : "loss", pnl: won ? winPnl(stake, odds) : -stake };
}

function resolveTotal(game: Game, side: string, line: number, stake: number, odds: number | null): Resolution {
  if (game.final_total === line) return { result: "push", pnl: 0 };
  const s = side.toLowerCase();
  const isOver = s.includes("over") || s === "o";
  const isUnder = s.includes("under") || s === "u";
  if (!isOver && !isUnder) return { result: "loss", pnl: -stake };
  const won = isOver ? game.final_total > line : game.final_total < line;
  return { result: won ? "win" : "loss", pnl: won ? winPnl(stake, odds) : -stake };
}
// `side` may be a team name (capper picks) OR the literal 'home'/'away'
// (sbo_signals, written by _shared/sboSignals.ts). Handle both explicitly —
// previously 'home'/'away' matched no team and fell through to the loss
// fallback, marking every AI signal a fabricated loss.
function sideTakes(game: Game, side: string): { takingHome: boolean; takingAway: boolean } {
  const s = String(side ?? "").trim().toLowerCase();
  if (s === "home") return { takingHome: true, takingAway: false };
  if (s === "away") return { takingHome: false, takingAway: true };
  return {
    takingHome: sideMatchesTeam(side, game.home_team, game.sport),
    takingAway: sideMatchesTeam(side, game.away_team, game.sport),
  };
}
function resolveMoneyline(game: Game, side: string, stake: number, odds: number | null): Resolution {
  const { takingHome, takingAway } = sideTakes(game, side);
  // No-match guard: if the side matches neither team, the pick is ungradeable
  // against this game. Leave it pending instead of fabricating a loss.
  if (!takingHome && !takingAway) return { result: "pending", pnl: 0 };
  if (game.home_score === game.away_score) return { result: "push", pnl: 0 };
  const won = takingHome ? game.home_score > game.away_score : game.away_score > game.home_score;
  return { result: won ? "win" : "loss", pnl: won ? winPnl(stake, odds) : -stake };
}

function classifyBetType(betType: string | null, pickType?: string | null): "spread" | "total" | "moneyline" | "prop" | "unknown" {
  const s = (betType || pickType || "").toLowerCase();

  // Must check exact segment types FIRST — 'f5_total' and 'team_total' both
  // contain "total" so they would match the total branch below without this
  // guard. Segment picks have no ESPN data source (sbo_games stores only
  // final full-game scores) and must stay pending rather than be graded
  // against home_score + away_score.
  if (s === "f5_total" || s === "team_total") return "unknown";

  if (s.includes("spread") || s === "ats") return "spread";
  if (s.includes("total") || s === "ou" || s.includes("over") || s.includes("under")) return "total";
  if (s.includes("money") || s === "ml") return "moneyline";
  if (s.includes("prop")) return "prop";
  return "unknown";
}
function weekStartUTC(d = new Date()): string {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const wk = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return wk.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Reset the module-level ambiguity counter per invocation.
  resetNylaSkipped();

  // ?mark_unsupported=true → flag MLB prop/parlay pending picks (past dates) as
  // ungradeable by this source. Leaves result='pending' untouched → downstream
  // rollups (win_rate, consensus, weekly buckets) unaffected.
  const reqUrl = new URL(req.url);
  if (reqUrl.searchParams.get("mark_unsupported") === "true") {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("sbo_capper_picks")
      .update({ unsupported: true })
      .eq("sport", "MLB")
      .eq("result", "pending")
      .eq("unsupported", false)
      .in("bet_type", ["prop", "parlay"])
      .lt("game_date", today)
      .select("id");
    return new Response(
      JSON.stringify({ ok: !error, marked: data?.length ?? 0, error: error?.message ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const summary = {
    sports_checked: 0, games_resolved: 0,
    signals_updated: 0, picks_updated: 0, props_updated: 0, cappers_updated: 0,
    nyla_skipped: 0,
    errors: [] as any[],
  };

  const sportsList = Object.entries(ESPN_ENDPOINTS);
  summary.sports_checked = sportsList.length;

  // 180-day historical backfill: query distinct (sport, game_date) from pending capper picks,
  // then call ESPN once per (sport, date) using ?dates=YYYYMMDD. Today always included.
  const CUTOFF_DAYS = 180;
  const cutoffIso = new Date(Date.now() - CUTOFF_DAYS * 86400_000).toISOString().slice(0, 10);
  const todayYmd = etDate();

  const supportedSports = new Set(Object.keys(ESPN_ENDPOINTS));
  const dateSetBySport = new Map<string, Set<string>>();
  for (const s of supportedSports) dateSetBySport.set(s, new Set([todayYmd]));

  const { data: pendingRows, error: pendErr } = await supabase
    .from("sbo_capper_picks")
    .select("sport, game_date")
    .or("result.is.null,result.eq.pending")
    .eq("unsupported", false)
    .gte("game_date", cutoffIso)
    .not("game_date", "is", null);
  if (pendErr) {
    summary.errors.push({ stage: "pending_scan", message: pendErr.message });
  } else {
    for (const r of pendingRows ?? []) {
      const sport = String((r as any).sport ?? "").toUpperCase();
      if (!supportedSports.has(sport)) continue;
      const d = String((r as any).game_date).slice(0, 10);
      if (d < cutoffIso) continue;
      dateSetBySport.get(sport)!.add(d);
    }
  }

  const allGames: Game[] = [];
  const fetchPlan: Array<{ sport: string; date: string }> = [];
  for (const [sport, url] of sportsList) {
    for (const ymd of dateSetBySport.get(sport) ?? []) {
      const isToday = ymd === todayYmd;
      const dateArg = isToday ? undefined : ymd.replace(/-/g, "");
      fetchPlan.push({ sport, date: dateArg ?? "today" });
      const games = await fetchCompletedGames(sport, url, summary.errors, dateArg);
      allGames.push(...games);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  (summary as any).fetch_plan_count = fetchPlan.length;
  (summary as any).cutoff_date = cutoffIso;
  summary.games_resolved = allGames.length;

  const capperDeltas = new Map<string, { w: number; l: number; p: number }>();
  const sportBuckets = new Map<string, {
    spread_w: number; spread_l: number; spread_p: number; spread_pnl: number;
    ml_w: number; ml_l: number; ml_p: number; ml_pnl: number;
    total_w: number; total_l: number; total_p: number; total_pnl: number;
    prop_w: number; prop_l: number; prop_p: number; prop_pnl: number;
    overall_w: number; overall_l: number; overall_p: number; overall_pnl: number;
  }>();
  const bucketFor = (sport: string) => {
    let b = sportBuckets.get(sport);
    if (!b) {
      b = { spread_w:0, spread_l:0, spread_p:0, spread_pnl:0, ml_w:0, ml_l:0, ml_p:0, ml_pnl:0,
            total_w:0, total_l:0, total_p:0, total_pnl:0, prop_w:0, prop_l:0, prop_p:0, prop_pnl:0,
            overall_w:0, overall_l:0, overall_p:0, overall_pnl:0 };
      sportBuckets.set(sport, b);
    }
    return b;
  };
  const addBucket = (sport: string, kind: "spread"|"total"|"moneyline"|"prop", r: Resolution) => {
    const b = bucketFor(sport);
    const key = kind === "moneyline" ? "ml" : kind;
    if (r.result === "win")  { (b as any)[`${key}_w`]++; b.overall_w++; }
    if (r.result === "loss") { (b as any)[`${key}_l`]++; b.overall_l++; }
    if (r.result === "push") { (b as any)[`${key}_p`]++; b.overall_p++; }
    (b as any)[`${key}_pnl`] += r.pnl;
    b.overall_pnl += r.pnl;
  };

  // STEP 3: sbo_signals
  try {
    const { data: signals, error } = await supabase
      .from("sbo_signals")
      .select("id, sport, game, game_date, home_team, away_team, pick_type, side, line, odds")
      .eq("result", "pending")
      .in("sport", Object.keys(ESPN_ENDPOINTS))
      .limit(2000);
    if (error) throw error;

    for (const s of signals ?? []) {
      // Match on real team names, never on the 'home'/'away' token.
      const sideTok = String(s.side ?? "").trim().toLowerCase();
      const teamHint = sideTok === "home" ? (s.home_team ?? "")
        : sideTok === "away" ? (s.away_team ?? "")
        : String(s.side ?? "");
      const game = findGameForRow(allGames, s.sport, s.game_date, teamHint, s.game);
      if (!game) continue;

      const kind = classifyBetType(s.pick_type);
      if (kind === "unknown" || kind === "prop") continue;
      const stake = 1;
      const odds = s.odds ?? null;
      const line = Number(s.line ?? 0);
      let r: Resolution;
      if (kind === "spread")     r = resolveSpread(game, String(s.side ?? ""), line, stake, odds);
      else if (kind === "total") r = resolveTotal(game, String(s.side ?? ""), line, stake, odds);
      else                       r = resolveMoneyline(game, String(s.side ?? ""), stake, odds);
      if (r.result === "pending") continue;


      const { error: uerr } = await supabase
        .from("sbo_signals")
        .update({ result: r.result, pnl_units: r.pnl, resolved_at: new Date().toISOString() })
        .eq("id", s.id)
        .eq("result", "pending");
      if (uerr) { summary.errors.push({ stage: "signal_update", id: s.id, message: uerr.message }); continue; }
      summary.signals_updated++;
      addBucket(s.sport, kind, r);
    }
  } catch (e: any) {
    summary.errors.push({ stage: "signals", message: e?.message });
  }

  // STEP 4: sbo_capper_picks
  try {
    const { data: picks, error } = await supabase
      .from("sbo_capper_picks")
      .select("id, capper_id, sport, game_date, direction, bet_type, stake, odds, line, team, player_name, pick_text")
      .eq("result", "pending")
      .eq("unsupported", false)
      .in("sport", Object.keys(ESPN_ENDPOINTS))
      .limit(5000);
    if (error) throw error;

    for (const p of picks ?? []) {
      // Decouple game lookup from bet direction: team is the team hint,
      // pick_text is fallback for multi-team strings. direction is only
      // used later for actual over/under/moneyline resolution.
      const teamHint = p.team || "";
      const game = findGameForRow(allGames, p.sport, p.game_date, teamHint, p.pick_text ?? null);
      if (!game) continue;
      const kind = classifyBetType(p.bet_type);
      if (kind === "unknown" || kind === "prop") continue;
      const stake = Number(p.stake ?? 1);
      const odds = p.odds ?? null;
      const line = Number(p.line ?? 0);
      const side    = String(p.team      || "");  // moneyline + spread
      const totSide = String(p.direction || "");  // totals only
      let r: Resolution;
      if (kind === "spread")     r = resolveSpread(game, side, line, stake, odds);
      else if (kind === "total") r = resolveTotal(game, totSide, line, stake, odds);
      else                       r = resolveMoneyline(game, side, stake, odds);
      if (r.result === "pending") continue;

      const capperResult = r.result === "win" ? "won" : r.result === "loss" ? "lost" : "push";


      const { error: uerr } = await supabase
        .from("sbo_capper_picks")
        .update({
          result: capperResult,
          pnl_units: r.pnl,
          profit_loss: r.pnl,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", p.id)
        .eq("result", "pending");
      if (uerr) { summary.errors.push({ stage: "pick_update", id: p.id, message: uerr.message }); continue; }
      summary.picks_updated++;
      addBucket(p.sport, kind, r);

      if (p.capper_id) {
        const d = capperDeltas.get(p.capper_id) ?? { w: 0, l: 0, p: 0 };
        if (r.result === "win")  d.w++;
        if (r.result === "loss") d.l++;
        if (r.result === "push") d.p++;
        capperDeltas.set(p.capper_id, d);
      }
    }
  } catch (e: any) {
    summary.errors.push({ stage: "capper_picks", message: e?.message });
  }

  // STEP 5: sbo_prop_picks — ESPN scoreboard lacks player boxscore stats; skip.
  try {
    const { data: props, error } = await supabase
      .from("sbo_prop_picks")
      .select("id, sport, game_date")
      .eq("result", "pending")
      .in("sport", Object.keys(ESPN_ENDPOINTS))
      .limit(2000);
    if (error) throw error;
    if ((props?.length ?? 0) > 0) {
      summary.errors.push({ stage: "prop_picks_skipped", count: props!.length, reason: "ESPN scoreboard lacks player boxscore stats" });
    }
  } catch (e: any) {
    summary.errors.push({ stage: "prop_picks", message: e?.message });
  }

  // STEP 6: sbo_cappers
  for (const [capperId, d] of capperDeltas) {
    try {
      const { data: c, error } = await supabase
        .from("sbo_cappers")
        .select("total_wins, total_losses, total_pushes, hot_streak, cold_streak")
        .eq("id", capperId)
        .maybeSingle();
      if (error || !c) { summary.errors.push({ stage: "capper_read", id: capperId, message: error?.message }); continue; }

      const total_wins   = (c.total_wins   ?? 0) + d.w;
      const total_losses = (c.total_losses ?? 0) + d.l;
      const total_pushes = (c.total_pushes ?? 0) + d.p;
      const decided = total_wins + total_losses;
      const win_rate = decided > 0 ? Number(((total_wins / decided) * 100).toFixed(2)) : 0;

      let hot_streak  = c.hot_streak  ?? 0;
      let cold_streak = c.cold_streak ?? 0;
      if (d.w > 0) { hot_streak += d.w; cold_streak = 0; }
      if (d.l > 0) { cold_streak += d.l; hot_streak = 0; }

      const { error: uerr } = await supabase
        .from("sbo_cappers")
        .update({ total_wins, total_losses, total_pushes, win_rate, hot_streak, cold_streak, updated_at: new Date().toISOString() })
        .eq("id", capperId);
      if (uerr) { summary.errors.push({ stage: "capper_update", id: capperId, message: uerr.message }); continue; }
      summary.cappers_updated++;
    } catch (e: any) {
      summary.errors.push({ stage: "capper_update_exception", id: capperId, message: e?.message });
    }
  }

  // STEP 7: sbo_sport_performance upsert (schema-verified column names)
  const week_start = weekStartUTC();
  for (const [sport, b] of sportBuckets) {
    const spread_total = b.spread_w + b.spread_l;
    const total_total  = b.total_w + b.total_l;
    const prop_total   = b.prop_w + b.prop_l;
    const overall_total = b.overall_w + b.overall_l;

    const row = {
      sport,
      week_start,

      spread_picks: b.spread_w + b.spread_l + b.spread_p,
      spread_wins: b.spread_w,
      spread_losses: b.spread_l,
      spread_pushes: b.spread_p,
      spread_win_rate: spread_total > 0 ? Number((b.spread_w / spread_total).toFixed(4)) : 0,
      spread_units_pnl: b.spread_pnl,

      ml_picks: b.ml_w + b.ml_l + b.ml_p,
      ml_wins: b.ml_w,
      ml_losses: b.ml_l,
      ml_units_pnl: b.ml_pnl,

      total_picks: b.total_w + b.total_l + b.total_p,
      total_wins: b.total_w,
      total_losses: b.total_l,
      total_win_rate: total_total > 0 ? Number((b.total_w / total_total).toFixed(4)) : 0,
      total_units_pnl: b.total_pnl,

      prop_picks: b.prop_w + b.prop_l + b.prop_p,
      prop_wins: b.prop_w,
      prop_losses: b.prop_l,
      prop_win_rate: prop_total > 0 ? Number((b.prop_w / prop_total).toFixed(4)) : 0,
      prop_units_pnl: b.prop_pnl,

      overall_win_rate: overall_total > 0 ? Number((b.overall_w / overall_total).toFixed(4)) : 0,
      overall_units_pnl: b.overall_pnl,
    };

    const { error } = await supabase
      .from("sbo_sport_performance")
      .upsert(row, { onConflict: "sport,week_start" });
    if (error) summary.errors.push({ stage: "sport_perf_upsert", sport, message: error.message });
  }

  // STEP 8: trigger sbo-signal-combiner reprocess
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sbo-signal-combiner`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ reprocess_all: true }),
    });
    if (!res.ok) summary.errors.push({ stage: "combiner_invoke", status: res.status, body: await res.text() });
  } catch (e: any) {
    summary.errors.push({ stage: "combiner_invoke_exception", message: e?.message });
  }

  summary.nyla_skipped = getNylaSkipped();
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
