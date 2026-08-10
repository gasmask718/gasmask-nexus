// SBO stat/prop-type normalization — THE single canonical implementation.
// Both the edge functions (sbo-match-capper-picks, sbo-score-capper-picks) and the
// client (src/lib/sbo/statNormalize.ts, a re-export) import from this file. Never
// mirror or re-implement this map anywhere — extend it here only.

// Sentinel for capper vocabulary that has NO counterpart in the market feed.
// A pick normalizing to this must never be matched against a market prop: a
// silent wrong match corrupts the line-edge math worse than no match at all.
export const UNMATCHABLE = '__unmatchable__';

const STAT_MAP: Record<string, string> = {
  pts: 'points', point: 'points',
  reb: 'rebounds', rebound: 'rebounds',
  ast: 'assists', assist: 'assists',
  stl: 'steals', steal: 'steals',
  blk: 'blocks', block: 'blocks',
  tov: 'turnovers', turnover: 'turnovers',
  // Combo props — target vocabulary is sbo_player_props.prop_type
  'pts+reb+ast': 'pts_reb_ast', pra: 'pts_reb_ast', 'pts+rebs+asts': 'pts_reb_ast',
  'pts+reb': 'pts_reb', 'pts+rebs': 'pts_reb', pr: 'pts_reb',
  'pts+ast': 'pts_ast', 'pts+asts': 'pts_ast', pa: 'pts_ast',
  'reb+ast': 'reb_ast', 'rebs+asts': 'reb_ast', ra: 'reb_ast',
  // NOTE: normalizeStat() collapses '-' and ' ' to '_' BEFORE the lookup, so the
  // underscore spellings are the ones that actually get hit. Keep both.
  '3pm': 'threes', '3pt': 'threes', '3_pointers': 'threes', '3_pointer': 'threes',
  three_pointers: 'threes', threes: 'threes',
  passing_yards: 'passing_yards', pass_yds: 'passing_yards',
  rushing_yards: 'rushing_yards', rush_yds: 'rushing_yards',
  receiving_yards: 'receiving_yards', rec_yds: 'receiving_yards',
  td: 'touchdowns', touchdown: 'touchdowns',
  hr: 'home_runs', home_run: 'home_runs',
  strikeouts_pitched: 'strikeouts_p', pitcher_strikeouts: 'strikeouts_p',
  strikeouts_thrown: 'strikeouts_p', batter_strikeouts: 'strikeouts_b',
  so: 'strikeouts', strikeout: 'strikeouts', k: 'strikeouts',
  rbi: 'rbis',
  total_bases: 'total_bases', tb: 'total_bases',
  blocked_shots: 'blocks',
  rebounding: 'rebounds', boards: 'rebounds',
  // MLB pitcher outs: the Odds API feed carries no outs/innings market at all.
  // Previously these fell through as 'pitcher_outs'/'outs' and quietly failed;
  // now they are explicitly unmatchable so the reason is legible.
  pitcher_outs: UNMATCHABLE, outs: UNMATCHABLE, pitching_outs: UNMATCHABLE,
  innings_pitched: UNMATCHABLE, ip: UNMATCHABLE,
  // NRFI / first-inning runs are GAME-level markets. Cappers attach the
  // starting pitcher's name to them, which previously made them look like
  // player props and sent 43 picks down the player-prop matcher, where they
  // could only ever mis-match. There is no player-prop counterpart.
  nrfi: UNMATCHABLE, yrfi: UNMATCHABLE,
  no_runs_first_inning: UNMATCHABLE, runs_first_inning: UNMATCHABLE,
  first_inning_runs: UNMATCHABLE,

  // Tennis / MMA vocabulary. These arrive tagged with a competitor's name so
  // they look like player props, but no player-prop market exists for them in
  // the feed and no ESPN grading provider is wired for those sports. Marking
  // them unmatchable keeps them out of the funnel with a legible reason
  // instead of burning candidate scans every run.
  games_won: UNMATCHABLE, sets_won: UNMATCHABLE, total_games: UNMATCHABLE,
  set_handicap: UNMATCHABLE, game_handicap: UNMATCHABLE,
  method_of_victory: UNMATCHABLE, moneyline: UNMATCHABLE,

};


// Values STAT_MAP can produce are already canonical and must pass through untouched —
// token replacement would otherwise corrupt them ('strikeouts_p' tokenizes to include 'k').
const CANONICAL_STATS = new Set(Object.values(STAT_MAP));

export function normalizeStat(s: string): string {
  if (!s) return '';
  const lower = s.toLowerCase().trim().replace(/[_\-\s]+/g, '_');
  if (CANONICAL_STATS.has(lower)) return lower;
  if (STAT_MAP[lower]) return STAT_MAP[lower];
  const tokens = lower.split('_');
  const mapped = tokens.map((t) => STAT_MAP[t] ?? t);
  // A single unmatchable token poisons the whole stat (e.g. 'pitcher_outs').
  if (mapped.includes(UNMATCHABLE)) return UNMATCHABLE;
  if (mapped.some((t, i) => t !== tokens[i])) return mapped.join('_');
  return lower;
}


// Some capper vocabularies are ambiguous against the market vocabulary: a capper writing
// "strikeouts" may mean a pitcher's (strikeouts_p) or a batter's (strikeouts_b) line.
// Return the canonical form first, then the plausible market spellings to try in order.
// Only spellings of the SAME underlying stat belong here — never a different stat,
// since the line-edge math compares the two lines directly.
const AMBIGUOUS: Record<string, string[]> = {
  strikeouts: ['strikeouts_p', 'strikeouts_b'],
  hits: ['hits', 'total_hits'],
  hits_allowed: ['hits_allowed'],
};

export function marketPropCandidates(propType: string): string[] {
  const canonical = normalizeStat(propType);
  // Unmatchable stats must yield NO candidates — the caller skips the pick.
  if (!canonical || canonical === UNMATCHABLE) return [];
  const out = [canonical, ...(AMBIGUOUS[canonical] || [])];
  return [...new Set(out.filter(Boolean))];
}

// Shared line tolerance. A flat ±1.0 is far too tight on large combo lines
// (35.5 PRA) and slightly loose on small ones, so scale with the line.
export function lineTolerance(line: number): number {
  return Math.max(1.0, Math.abs(line) * 0.04);
}

