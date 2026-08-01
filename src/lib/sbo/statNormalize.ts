// SBO stat/prop-type normalization — frontend port of the STAT_MAP + normalizeStat()
// layer in supabase/functions/sbo-match-capper-picks/index.ts. Kept byte-identical in
// behavior so capper picks and market props resolve to the SAME canonical vocabulary
// on both the edge and the client. If you extend one, extend the other.

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
  '3pm': 'threes', '3pt': 'threes', '3-pointers': 'threes', threes: 'threes',
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
  if (mapped.some((t, i) => t !== tokens[i])) return mapped.join('_');
  return lower;
}

// Some capper vocabularies are ambiguous against the market vocabulary: a capper writing
// "strikeouts" may mean a pitcher's (strikeouts_p) or a batter's (strikeouts_b) line.
// Return the canonical form first, then the plausible market spellings to try in order.
const AMBIGUOUS: Record<string, string[]> = {
  strikeouts: ['strikeouts_p', 'strikeouts_b'],
  hits: ['hits', 'total_hits'],
  hits_allowed: ['hits_allowed', 'hits'],
  home_runs: ['home_runs', 'total_bases'],
};

export function marketPropCandidates(propType: string): string[] {
  const canonical = normalizeStat(propType);
  const out = [canonical, ...(AMBIGUOUS[canonical] || [])];
  return [...new Set(out.filter(Boolean))];
}
