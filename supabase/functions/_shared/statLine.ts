// ═══════════════════════════════════════════════════════════════
// SBO — CANONICAL STAT → BOX-SCORE ACCESSOR (MLB v1)
// ═══════════════════════════════════════════════════════════════
// Maps capper prop vocabulary onto the keys actually stored in
// sbo_player_game_stats.stat_line. ONE implementation, same discipline as
// _shared/statNormalize.ts and _shared/perPickScore.ts — never mirror it.
//
// MLB stat_line shape (source: sbo-ingest ESPN box scores):
//   { H, R, AB, BB, ER, HR, IP, TB, K_b, K_p, RBI, OUTS,
//     batted, pitched, H_allowed, BB_allowed, HR_allowed, Name, athleteId }
//
// IMPORTANT: normalizeStat() maps MLB pitcher outs to UNMATCHABLE because the
// ODDS FEED carries no outs market. That is a *matching* constraint, not a
// *grading* one — the box score does carry OUTS. So grading resolves the raw
// prop_type through its own table first and only falls back to normalizeStat().

import { normalizeStat } from './statNormalize.ts';

export type StatSpec = {
  /** stat_line keys summed to produce the actual value. */
  keys: string[];
  /** Human label for the dry-run/grade note. */
  label: string;
  /** Which side of the box score must be present for the row to be usable. */
  side: 'batting' | 'pitching' | 'basketball';
};


/** Raw prop_type spellings resolved directly, before normalizeStat(). */
const RAW_OVERRIDES: Record<string, StatSpec> = {
  pitcher_outs: { keys: ['OUTS'], label: 'pitcher outs', side: 'pitching' },
  'pitcher outs': { keys: ['OUTS'], label: 'pitcher outs', side: 'pitching' },
  outs: { keys: ['OUTS'], label: 'pitcher outs', side: 'pitching' },
  pitching_outs: { keys: ['OUTS'], label: 'pitcher outs', side: 'pitching' },
  'hits+runs+rbi': { keys: ['H', 'R', 'RBI'], label: 'hits+runs+RBI', side: 'batting' },
  'hits+runs+rbis': { keys: ['H', 'R', 'RBI'], label: 'hits+runs+RBI', side: 'batting' },
  'hits + runs + rbis': { keys: ['H', 'R', 'RBI'], label: 'hits+runs+RBI', side: 'batting' },
  'hits + runs + rbi': { keys: ['H', 'R', 'RBI'], label: 'hits+runs+RBI', side: 'batting' },
  hrr: { keys: ['H', 'R', 'RBI'], label: 'hits+runs+RBI', side: 'batting' },
};

/** Canonical (post-normalizeStat) stat → box-score accessor. */
const CANONICAL_SPECS: Record<string, StatSpec> = {
  hits: { keys: ['H'], label: 'hits', side: 'batting' },
  runs: { keys: ['R'], label: 'runs', side: 'batting' },
  home_runs: { keys: ['HR'], label: 'home runs', side: 'batting' },
  rbis: { keys: ['RBI'], label: 'RBIs', side: 'batting' },
  total_bases: { keys: ['TB'], label: 'total bases', side: 'batting' },
  walks: { keys: ['BB'], label: 'walks', side: 'batting' },
  strikeouts_b: { keys: ['K_b'], label: 'batter strikeouts', side: 'batting' },
  strikeouts_p: { keys: ['K_p'], label: 'pitcher strikeouts', side: 'pitching' },
  hits_allowed: { keys: ['H_allowed'], label: 'hits allowed', side: 'pitching' },
  walks_allowed: { keys: ['BB_allowed'], label: 'walks allowed', side: 'pitching' },
  earned_runs: { keys: ['ER'], label: 'earned runs', side: 'pitching' },
  at_bats: { keys: ['AB'], label: 'at bats', side: 'batting' },
};

/**
 * Resolve a capper prop_type to a box-score accessor.
 * Returns null when the stat has no gradable counterpart (NRFI, team totals,
 * "hitter fs", bare ambiguous "strikeouts", etc.) — the caller leaves the pick
 * pending with a legible reason rather than guessing.
 */
export function statSpecFor(propType: string): StatSpec | null {
  if (!propType) return null;
  const raw = propType.toLowerCase().trim().replace(/\s+/g, ' ');
  if (RAW_OVERRIDES[raw]) return RAW_OVERRIDES[raw];
  const collapsed = raw.replace(/[\s\-]+/g, '_');
  if (RAW_OVERRIDES[collapsed]) return RAW_OVERRIDES[collapsed];

  const canonical = normalizeStat(propType);
  // Bare 'strikeouts' is ambiguous (pitcher vs batter). Disambiguated below by
  // the caller via the box-score side; here it deliberately has no spec.
  return CANONICAL_SPECS[canonical] ?? null;
}

/** True when the prop is the ambiguous bare "strikeouts" vocabulary. */
export function isAmbiguousStrikeouts(propType: string): boolean {
  return normalizeStat(propType) === 'strikeouts';
}

// ═══════════════════════════════════════════════════════════════
// BASKETBALL (NBA / WNBA) — Phase 7a
// ═══════════════════════════════════════════════════════════════
// stat_line shape comes from buildWnbaStatLines() (shared by NBA and WNBA):
//   { PTS, REB, AST, STL, BLK, TOV, PF, FGM/FGA, TPM/TPA, FTM/FTA, OREB, DREB, MIN, played }
// Combos are SUMS of those keys; actualValue() already returns null when any
// component is missing, so a DNP can never be graded as a zero.
const BASKETBALL_SPECS: Record<string, StatSpec> = {
  points: { keys: ['PTS'], label: 'points', side: 'basketball' },
  rebounds: { keys: ['REB'], label: 'rebounds', side: 'basketball' },
  assists: { keys: ['AST'], label: 'assists', side: 'basketball' },
  steals: { keys: ['STL'], label: 'steals', side: 'basketball' },
  blocks: { keys: ['BLK'], label: 'blocks', side: 'basketball' },
  turnovers: { keys: ['TOV'], label: 'turnovers', side: 'basketball' },
  threes: { keys: ['TPM'], label: 'three-pointers made', side: 'basketball' },
  pts_reb_ast: { keys: ['PTS', 'REB', 'AST'], label: 'points+rebounds+assists', side: 'basketball' },
  pts_reb: { keys: ['PTS', 'REB'], label: 'points+rebounds', side: 'basketball' },
  pts_ast: { keys: ['PTS', 'AST'], label: 'points+assists', side: 'basketball' },
  reb_ast: { keys: ['REB', 'AST'], label: 'rebounds+assists', side: 'basketball' },
  stl_blk: { keys: ['STL', 'BLK'], label: 'steals+blocks', side: 'basketball' },
};

/** Capper spellings → BASKETBALL_SPECS keys. */
const BASKETBALL_ALIASES: Record<string, string> = {
  pts: 'points', player_points: 'points', points: 'points',
  reb: 'rebounds', rebs: 'rebounds', player_rebounds: 'rebounds', rebounds: 'rebounds',
  ast: 'assists', asts: 'assists', player_assists: 'assists', assists: 'assists',
  stl: 'steals', steals: 'steals', player_steals: 'steals',
  blk: 'blocks', blocks: 'blocks', player_blocks: 'blocks',
  to: 'turnovers', tov: 'turnovers', turnovers: 'turnovers',
  threes: 'threes', three_pointers: 'threes', threes_made: 'threes', player_threes: 'threes', '3pm': 'threes',
  pra: 'pts_reb_ast', pts_reb_ast: 'pts_reb_ast',
  points_rebounds_assists: 'pts_reb_ast',
  pts_rebs_asts: 'pts_reb_ast',
  pr: 'pts_reb', pts_reb: 'pts_reb', points_rebounds: 'pts_reb',
  pa: 'pts_ast', pts_ast: 'pts_ast', points_assists: 'pts_ast',
  ra: 'reb_ast', reb_ast: 'reb_ast', rebounds_assists: 'reb_ast',
  stl_blk: 'stl_blk', blocks_steals: 'stl_blk', steals_blocks: 'stl_blk',
};

/**
 * Sport-aware resolution. Basketball sports use the basketball table; every
 * other sport keeps the existing MLB path byte-for-byte (statSpecFor is
 * unchanged and still exported for existing callers).
 */
export function statSpecForSport(sport: string, propType: string): StatSpec | null {
  const s = (sport || '').toLowerCase().trim();
  if (s !== 'nba' && s !== 'wnba') return statSpecFor(propType);
  if (!propType) return null;
  const cleaned = propType.toLowerCase().trim()
    .replace(/\band\b/g, '+')
    .replace(/[\s\-]+/g, '_')
    .replace(/_*\+_*/g, '_')
    .replace(/^_+|_+$/g, '');
  const key = BASKETBALL_ALIASES[cleaned] ?? cleaned;
  return BASKETBALL_SPECS[key] ?? null;
}


export const STRIKEOUTS_PITCHING: StatSpec = CANONICAL_SPECS.strikeouts_p;
export const STRIKEOUTS_BATTING: StatSpec = CANONICAL_SPECS.strikeouts_b;

/**
 * Sum the spec's keys off a stat_line. Returns null if ANY component is
 * missing/null — a partial sum would silently grade a pick on bad data.
 */
export function actualValue(statLine: Record<string, unknown>, spec: StatSpec): number | null {
  let total = 0;
  for (const k of spec.keys) {
    const v = statLine?.[k];
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}

/**
 * House grading rule, identical to sbo-verify-results: exact equality is a
 * push — no tolerance, no rounding.
 */
export function gradeOverUnder(
  actual: number,
  line: number,
  direction: string,
): 'won' | 'lost' | 'push' {
  if (actual === line) return 'push';
  const wentOver = actual > line;
  const dir = (direction || '').toUpperCase();
  return (dir === 'OVER') === wentOver ? 'won' : 'lost';
}
