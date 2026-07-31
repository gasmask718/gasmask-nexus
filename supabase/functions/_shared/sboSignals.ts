// Shared: write game-level AI signals into sbo_signals.
//
// One row per (sport, game_date, home_team, away_team, pick_type) — enforced by
// the unique index sbo_signals_game_identity_uidx, so re-running predictions
// UPDATES the existing signal instead of creating duplicates.
//
// sbo_capper_picks stores sport as a short label ('MLB', 'NBA', ...) while
// predictions carry an odds-API style key ('baseball_mlb' / 'mlb'). The
// signal-combiner joins on sport equality, so the signal must be written with
// the capper-side label.
export function sportLabel(sportKey: string | null | undefined): string {
  const k = String(sportKey ?? '').toLowerCase();
  const map: Record<string, string> = {
    baseball_mlb: 'MLB',
    mlb: 'MLB',
    basketball_nba: 'NBA',
    nba: 'NBA',
    americanfootball_nfl: 'NFL',
    nfl: 'NFL',
    icehockey_nhl: 'NHL',
    nhl: 'NHL',
    basketball_wnba: 'WNBA',
    wnba: 'WNBA',
    basketball_ncaab: 'NCAAB',
    ncaab: 'NCAAB',
    americanfootball_ncaaf: 'NCAAF',
    ncaaf: 'NCAAF',
  };
  return map[k] ?? k.toUpperCase();
}

export interface MoneylineSignalInput {
  sport_key: string | null | undefined;
  home_team: string | null | undefined;
  away_team: string | null | undefined;
  game_date: string | null | undefined; // timestamptz or date string
  side: string;                          // 'home' | 'away'
  internal_confidence: number;
  odds?: number | null;
  pick_detail?: string | null;
}

export function buildMoneylineSignal(input: MoneylineSignalInput) {
  const home = input.home_team ?? null;
  const away = input.away_team ?? null;
  const d = input.game_date ? new Date(input.game_date) : null;
  const iso = d && !isNaN(d.getTime()) ? d.toISOString() : null;

  return {
    sport: sportLabel(input.sport_key),
    game: home && away ? `${away} @ ${home}` : null,
    home_team: home,
    away_team: away,
    game_date: iso ? iso.slice(0, 10) : null,
    game_time: iso ? iso.slice(11, 19) : null,
    pick_type: 'moneyline',
    pick_detail: input.pick_detail ?? (input.side === 'home' ? home : away),
    side: input.side,
    odds: input.odds ?? null,
    internal_confidence: Math.round(input.internal_confidence),
    result: 'pending',
  };
}

/** Idempotent write: update the matching game signal, else insert it. */
export async function upsertMoneylineSignal(supabase: any, input: MoneylineSignalInput) {
  const row = buildMoneylineSignal(input);
  if (!row.sport || !row.game_date || !row.home_team || !row.away_team) {
    return { skipped: true, reason: 'incomplete game identity' };
  }

  const { data, error } = await supabase
    .from('sbo_signals')
    .upsert(row, { onConflict: 'sport,game_date,home_team,away_team,pick_type' })
    .select('id')
    .maybeSingle();

  if (error) return { skipped: true, reason: error.message };
  return { skipped: false, signal_id: data?.id ?? null, row };
}
