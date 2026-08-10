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
