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
