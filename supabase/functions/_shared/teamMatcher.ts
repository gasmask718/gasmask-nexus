// Shared team-matching logic for SBO.
// Extracted verbatim from sbo-result-tracker (Phase 1). Behavior-neutral:
// sideMatchesTeam still mutates a module-scoped counter; callers must
// resetNylaSkipped() at the start of a run and getNylaSkipped() at the end.

export type Game = {
  sport: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  final_total: number;
};

export function norm(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// MLB alias map: any of these tokens (normalized) → canonical ESPN displayName.
// Ambiguous 2-letter codes NY/LA/SF are intentionally omitted — see splitSideCandidates + nyla counter.
export const MLB_ALIASES: Record<string, string> = {
  ari: "Arizona Diamondbacks", diamondbacks: "Arizona Diamondbacks",
  atl: "Atlanta Braves", braves: "Atlanta Braves",
  bal: "Baltimore Orioles", orioles: "Baltimore Orioles",
  bos: "Boston Red Sox", redsox: "Boston Red Sox",
  chc: "Chicago Cubs", cubs: "Chicago Cubs",
  cws: "Chicago White Sox", chw: "Chicago White Sox", whitesox: "Chicago White Sox",
  cin: "Cincinnati Reds", reds: "Cincinnati Reds",
  cle: "Cleveland Guardians", guardians: "Cleveland Guardians",
  col: "Colorado Rockies", rockies: "Colorado Rockies",
  det: "Detroit Tigers", tigers: "Detroit Tigers",
  hou: "Houston Astros", astros: "Houston Astros",
  kc: "Kansas City Royals", kcr: "Kansas City Royals", royals: "Kansas City Royals",
  laa: "Los Angeles Angels", angels: "Los Angeles Angels",
  lad: "Los Angeles Dodgers", dodgers: "Los Angeles Dodgers",
  mia: "Miami Marlins", marlins: "Miami Marlins",
  mil: "Milwaukee Brewers", brewers: "Milwaukee Brewers",
  min: "Minnesota Twins", twins: "Minnesota Twins",
  nym: "New York Mets", mets: "New York Mets",
  nyy: "New York Yankees", yankees: "New York Yankees",
  oak: "Oakland Athletics", ath: "Oakland Athletics", athletics: "Oakland Athletics",
  phi: "Philadelphia Phillies", phillies: "Philadelphia Phillies",
  pit: "Pittsburgh Pirates", pirates: "Pittsburgh Pirates",
  sd: "San Diego Padres", sdp: "San Diego Padres", padres: "San Diego Padres",
  sfg: "San Francisco Giants", giants: "San Francisco Giants",
  sea: "Seattle Mariners", mariners: "Seattle Mariners",
  stl: "St. Louis Cardinals", cardinals: "St. Louis Cardinals",
  tb: "Tampa Bay Rays", tbr: "Tampa Bay Rays", rays: "Tampa Bay Rays",
  tex: "Texas Rangers", rangers: "Texas Rangers",
  tor: "Toronto Blue Jays", bluejays: "Toronto Blue Jays",
  wsh: "Washington Nationals", was: "Washington Nationals", nationals: "Washington Nationals",
  dbacks: "Arizona Diamondbacks", az: "Arizona Diamondbacks",
  sf: "San Francisco Giants", laa2: "Los Angeles Angels",
};


// Tokens that are ambiguous between MLB teams (NY = Yankees|Mets, LA = Angels|Dodgers).
export const AMBIGUOUS_MLB_TOKENS = new Set(["ny", "la"]);

// Module-level counter for ambiguous NY/LA skips observed during a run.
let nylaSkippedCount = 0;
export function resetNylaSkipped(): void { nylaSkippedCount = 0; }
export function getNylaSkipped(): number { return nylaSkippedCount; }

// Split multi-team strings ("Yankees/Phillies", "SEA-TEX", "TB Rays vs BOS")
// into individual candidate tokens for matching. Preserves the original as fallback.
export function splitSideCandidates(side: string): string[] {
  const raw = String(side ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(/[\/\-,]|\s+vs\.?\s+|\s+@\s+/i).map(x => x.trim()).filter(Boolean);
  return parts.length > 1 ? [raw, ...parts] : [raw];
}

// ── Nickname matching ──────────────────────────────────────────────────────
// Cappers write team names as abbreviation + nickname ("TB Rays", "BOS Red
// Sox", "NY Mets", "SA Spurs", "Vegas"). The original whole-string comparison
// could never match those against an ESPN displayName ("Tampa Bay Rays"):
// neither string contains the other, and the MLB alias map is keyed on single
// tokens only. That single gap left ~155 in-window game-level picks pending.
//
// Rules (deliberately conservative — a wrong grade is worse than a pending one):
//   • Compare the side's word/word-pair tokens against the TEAM'S NICKNAME
//     tokens only (last word + last two words joined), never its city words.
//     This is what keeps "Los Angeles Angels" from matching "Los Angeles
//     Dodgers" — {dodgers, angelesdodgers} shares nothing with the side.
//   • Bare nicknames that are ambiguous inside their own league require the
//     two-word form ("sox" alone is Red Sox OR White Sox).
//   • Tokens shorter than 3 characters never match on their own.

const AMBIGUOUS_NICKNAMES = new Set(["sox", "cats", "jays", "sox"]);

/** Word + adjacent-word-pair tokens for an arbitrary team string. */
function wordTokens(s: string): string[] {
  const words = String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    if (i + 1 < words.length) out.push(words[i] + words[i + 1]);
  }
  return out;
}

/** Nickname tokens of an ESPN display name: last word, and last two joined. */
function nicknameTokens(team: string): Set<string> {
  const words = String(team ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set<string>();
  if (words.length === 0) return set;
  const last = words[words.length - 1];
  if (!AMBIGUOUS_NICKNAMES.has(last)) set.add(last);
  if (words.length >= 2) set.add(words[words.length - 2] + last);
  return set;
}

export function sideMatchesTeam(side: string, team: string, sport?: string): boolean {
  const t = norm(team);
  if (!t) return false;
  const isMlb = (sport ?? "").toUpperCase() === "MLB";
  for (const candidate of splitSideCandidates(side)) {
    const c = norm(candidate);
    if (!c) continue;
    if (isMlb && AMBIGUOUS_MLB_TOKENS.has(c)) { nylaSkippedCount++; continue; }
    if (c === t || c.includes(t) || t.includes(c)) return true;
    if (isMlb) {
      const canonical = MLB_ALIASES[c];
      if (canonical && norm(canonical) === t) return true;
    }
  }

  // Token-level pass. Runs only after the whole-string pass has failed.
  const sideToks = wordTokens(side);
  if (sideToks.length === 0) return false;

  if (isMlb) {
    for (const tok of sideToks) {
      if (AMBIGUOUS_MLB_TOKENS.has(tok)) { nylaSkippedCount++; continue; }
      const canonical = MLB_ALIASES[tok];
      if (canonical && norm(canonical) === t) return true;
    }
  }

  const nicks = nicknameTokens(team);
  for (const tok of sideToks) {
    if (tok.length < 3) continue;
    if (nicks.has(tok)) return true;
  }
  return false;
}


// NOTE (doubleheader limitation): candidates are filtered only by sport +
// game_date, and the first team match wins. When the same two teams play twice
// on one calendar day (an MLB doubleheader), both games share sport, date,
// home_team and away_team, so they are indistinguishable here and game 1 is
// always returned — even for a pick on game 2.
//
// True tie-breaking is impossible without a start-time signal: the Game type
// carries no time field, only a YYYY-MM-DD slate date. Adding `game_time` to
// Game (and populating it from the ESPN event timestamp) is the prerequisite
// for disambiguating these. Until then, callers that must not guess should
// detect the multi-match case themselves and skip rather than pick one.
export function findGameForRow(
  games: Game[],
  sport: string,
  gameDate: string,
  side: string | null,
  gameStr: string | null,
): Game | null {
  const candidates = games.filter(g => g.sport === sport && g.game_date === gameDate);
  if (candidates.length === 0) return null;
  if (side) {
    const bySide = candidates.find(g => sideMatchesTeam(side, g.home_team, sport) || sideMatchesTeam(side, g.away_team, sport));
    if (bySide) return bySide;
  }
  if (gameStr) {
    const g = norm(gameStr);
    const byGame = candidates.find(c => g.includes(norm(c.home_team)) || g.includes(norm(c.away_team)));
    if (byGame) return byGame;
  }
  return null;
}
