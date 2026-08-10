import { createClient } from 'npm:@supabase/supabase-js@2';
import { sideMatchesTeam, resetNylaSkipped, getNylaSkipped } from '../_shared/teamMatcher.ts';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// BUG-16: minimum GRADED picks before a capper is allowed to move a signal.
// Below this the win_rate/streak/weight fields are statistical noise.
const MIN_GRADED_PICKS_FOR_WEIGHT = 3;

interface CapperRow {
  id: string;
  name: string | null;
  win_rate: number | null;
  capper_weight: number | null;
  hot_streak: number | null;
  picks_by_sport: Record<string, any> | null;
  total_wins: number | null;
  total_losses: number | null;
  total_pushes: number | null;
}

interface PickRow {
  id: string;
  capper_id: string | null;
  sport: string | null;
  game_date: string | null;
  bet_type: string | null;
  direction: string | null;
  stake: number | null;
  team: string | null;
  opponent: string | null;
}

interface SignalRow {
  id: string;
  sport: string | null;
  game_date: string | null;
  pick_type: string | null;
  side: string | null;
  internal_confidence: number | null;
  home_team: string | null;
  away_team: string | null;
}

// Game identity: teams are free text on both sides, so reuse the shared SBO
// team matcher (alias map + normalization) rather than a local string compare.
export function normalizeTeam(t: string | null | undefined): string {
  if (!t) return '';
  return String(t).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A pick belongs to a signal's game only if one of its teams is a side of that game.
export function isSameGame(
  pick: { team: string | null; opponent: string | null },
  sideTeams: (string | null)[],
  sport?: string | null,
): boolean {
  const sides = sideTeams.filter((s): s is string => !!s && s.trim().length > 0);
  if (sides.length === 0) return false;
  for (const side of sides) {
    if (pick.team && sideMatchesTeam(pick.team, side, sport ?? undefined)) return true;
    if (pick.opponent && sideMatchesTeam(pick.opponent, side, sport ?? undefined)) return true;
  }
  return false;
}

// Which real team does the signal's side refer to?
// side is 'home' | 'away' (moneyline signals), else already a team name.
export function resolveSignalTeam(signal: {
  side: string | null; home_team: string | null; away_team: string | null;
}): string | null {
  const s = (signal.side ?? '').trim().toLowerCase();
  if (s === 'home') return signal.home_team;
  if (s === 'away') return signal.away_team;
  return signal.side && signal.side.trim() ? signal.side : null;
}

/**
 * Does this capper pick agree with the signal?
 * - moneyline: capper picks store the team in `team` and 'WIN'/'LOSS' in
 *   `direction`, so the side comparison MUST be pick.team vs the signal's
 *   resolved team. Returns null when the pick names neither side (unrelated).
 * - everything else (spread/total/props): unchanged direction comparison.
 */
export function pickAgrees(
  pick: { bet_type: string | null; direction: string | null; team: string | null },
  signal: { pick_type: string | null; side: string | null; home_team: string | null; away_team: string | null; sport: string | null },
): boolean | null {
  const type = (pick.bet_type ?? signal.pick_type ?? '').toLowerCase();
  if (type === 'moneyline') {
    const target = resolveSignalTeam(signal);
    if (!target || !pick.team) return null;
    if (sideMatchesTeam(pick.team, target, signal.sport ?? undefined)) return true;
    const other = normalizeTeam(target) === normalizeTeam(signal.home_team ?? '')
      ? signal.away_team : signal.home_team;
    if (other && sideMatchesTeam(pick.team, other, signal.sport ?? undefined)) return false;
    return null; // names neither side — not a real opinion on this game
  }
  if (!pick.direction || !signal.side) return null;
  return pick.direction.toLowerCase() === signal.side.toLowerCase();
}


function gradeFor(c: number): string {
  if (c >= 90) return 'LOCK';
  if (c >= 75) return 'BEST_BET';
  if (c >= 60) return 'PLAY';
  if (c >= 45) return 'LEAN';
  return 'NO_PLAY';
}

function sportWinRate(capper: CapperRow, sport: string | null): number {
  const fallback = Number(capper.win_rate ?? 0);
  if (!sport || !capper.picks_by_sport || typeof capper.picks_by_sport !== 'object') return fallback;
  const entry = (capper.picks_by_sport as any)[sport];
  const wr = entry && typeof entry === 'object' ? Number(entry.win_rate) : NaN;
  return Number.isFinite(wr) ? wr : fallback;
}

async function combineSignal(supabase: any, signal: SignalRow) {
  const { data: picks, error: picksErr } = await supabase
    .from('sbo_capper_picks')
    .select('id, capper_id, sport, game_date, bet_type, direction, stake, team, opponent')
    .eq('sport', signal.sport)
    .eq('game_date', signal.game_date)
    .eq('bet_type', signal.pick_type);
  if (picksErr) throw picksErr;

  // Require real game identity — sport + date + bet_type alone lumps an entire
  // slate together. No identity on the signal => confirm nothing.
  resetNylaSkipped();
  const gamePicks = ((picks ?? []) as PickRow[])
    .filter((p) => isSameGame(p, [signal.home_team, signal.away_team], signal.sport));


  const capperIds = Array.from(new Set(gamePicks.map((p: PickRow) => p.capper_id).filter(Boolean)));
  let cappers: CapperRow[] = [];
  if (capperIds.length > 0) {
    const { data: cData, error: cErr } = await supabase
      .from('sbo_cappers')
      .select('id, name, win_rate, capper_weight, hot_streak, picks_by_sport, total_wins, total_losses, total_pushes')
      .in('id', capperIds);
    if (cErr) throw cErr;
    cappers = cData ?? [];
  }
  const capperById = new Map(cappers.map((c) => [c.id, c]));

  let combined = Number(signal.internal_confidence ?? 0);
  const confirming: any[] = [];
  const fading: any[] = [];

  for (const pick of gamePicks) {
    if (!pick.capper_id) continue;
    const capper = capperById.get(pick.capper_id);
    if (!capper) continue;

    // BUG-16: a capper with no (or a trivially small) GRADED sample has no
    // demonstrated skill, so their win_rate/hot_streak/weight are noise. They
    // must not move a signal's confidence in either direction until they have
    // graded results. 35 cappers currently carry a weight on zero graded picks.
    const gradedSample =
      Number(capper.total_wins ?? 0) +
      Number(capper.total_losses ?? 0) +
      Number(capper.total_pushes ?? 0);
    if (gradedSample < MIN_GRADED_PICKS_FOR_WEIGHT) {
      unweighted.push({
        capper_id: capper.id,
        capper_name: capper.name,
        graded_sample: gradedSample,
        reason: `below ${MIN_GRADED_PICKS_FOR_WEIGHT}-graded-pick minimum`,
      });
      continue;
    }

    const sportWr = sportWinRate(capper, signal.sport);
    // Weights are multipliers on roughly a 0.5–1.5 scale (see calcWeight in
    // sbo-match-capper-picks). The old `?? 100` fallback silently applied a
    // 100x bonus to any capper whose weight had never been computed.
    const weight = Number(capper.capper_weight ?? 1);

    const sameSide = pickAgrees(pick, signal);
    if (sameSide === null) continue; // pick has no readable opinion on this signal
    if (sameSide) {

      let bonus = 0;
      if (sportWr >= 65) bonus += 15;
      else if (sportWr >= 58) bonus += 8;
      else if (sportWr >= 52) bonus += 4;
      if (Number(capper.hot_streak ?? 0) >= 5) bonus += 8;
      if (Number(pick.stake ?? 0) >= 2) bonus += 3;
      const applied = bonus * weight;
      combined += applied;
      confirming.push({
        capper_id: capper.id,
        capper_name: capper.name,
        sport_wr: sportWr,
        bonus_applied: Number(applied.toFixed(2)),
      });
    } else {
      let deduction = 3;
      if (sportWr >= 62) deduction = 12;
      else if (sportWr >= 55) deduction = 7;
      combined -= deduction;
      fading.push({
        capper_id: capper.id,
        capper_name: capper.name,
        sport_wr: sportWr,
        deduction_applied: deduction,
      });
    }
  }

  combined = Math.max(0, Math.min(100, Math.round(combined)));
  const grade = gradeFor(combined);

  const { error: updErr } = await supabase
    .from('sbo_signals')
    .update({
      combined_confidence: combined,
      signal_grade: grade,
      confirming_cappers: confirming,
      fading_cappers: fading,
    })
    .eq('id', signal.id);
  if (updErr) throw updErr;

  return {
    signal_id: signal.id,
    game: `${signal.away_team} @ ${signal.home_team}`,
    side_team: resolveSignalTeam(signal),
    combined_confidence: combined,
    signal_grade: grade,
    confirming_count: confirming.length,
    fading_count: fading.length,
    confirming,
    fading,
    ambiguous_ny_la_skipped: getNylaSkipped(),
  };

}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { signal_id, sport, game_date, pick_type, reprocess_all } = body ?? {};

    let signals: SignalRow[] = [];
    const base = () => supabase
      .from('sbo_signals')
      .select('id, sport, game_date, pick_type, side, internal_confidence, home_team, away_team');

    if (signal_id) {
      const { data, error } = await base().eq('id', signal_id);
      if (error) throw error;
      signals = data ?? [];
    } else if (sport && game_date && pick_type) {
      const { data, error } = await base()
        .eq('sport', sport)
        .eq('game_date', game_date)
        .eq('pick_type', pick_type);
      if (error) throw error;
      signals = data ?? [];
    } else if (reprocess_all) {
      const { data, error } = await base()
        .eq('result', 'pending')
        .is('signal_grade', null)
        .limit(500);
      if (error) throw error;
      signals = data ?? [];
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide signal_id, or (sport+game_date+pick_type), or reprocess_all=true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results = [];
    for (const s of signals) results.push(await combineSignal(supabase, s));

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
