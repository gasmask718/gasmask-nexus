// Canonical sport vocabulary shared across SBO edge functions.
// Canonical values: MLB, NBA, NFL, NHL, WNBA, NCAAB, NCAAF,
// UFC, Tennis, Golf, Soccer, CFL, Boxing, Rugby

export const SPORT_CANONICAL: Record<string, string> = {
  // Odds API keys
  'baseball_mlb': 'MLB',
  'basketball_nba': 'NBA',
  'basketball_wnba': 'WNBA',
  'americanfootball_nfl': 'NFL',
  'icehockey_nhl': 'NHL',
  'americanfootball_ncaaf': 'NCAAF',
  'basketball_ncaab': 'NCAAB',
  'mma_mixed_martial_arts': 'UFC',

  // sport_key values (lowercase)
  'mlb': 'MLB',
  'nba': 'NBA',
  'nfl': 'NFL',
  'nhl': 'NHL',
  'wnba': 'WNBA',
  'ncaaf': 'NCAAF',
  'ncaab': 'NCAAB',

  // Free-text variants Claude has produced
  'baseball': 'MLB',
  'basketball': 'NBA',
  'football': 'NFL',
  'hockey': 'NHL',
  'mma': 'UFC',
  'pga tour': 'Golf',
  'pga': 'Golf',
  'golf': 'Golf',
  'tennis': 'Tennis',
  'soccer': 'Soccer',
  'cfl': 'CFL',
  'boxing': 'Boxing',
  'rugby': 'Rugby',
  'ufc': 'UFC',
};

export const VALID_SPORTS = new Set([
  'MLB', 'NBA', 'NFL', 'NHL', 'WNBA',
  'NCAAB', 'NCAAF', 'UFC', 'Tennis',
  'Golf', 'Soccer', 'CFL', 'Boxing', 'Rugby',
]);

export function canonicalizeSport(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const mapped = SPORT_CANONICAL[trimmed.toLowerCase()];
  if (mapped) return mapped;

  // If already a valid canonical value, return as-is
  const upper = trimmed.toUpperCase();
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();

  if (VALID_SPORTS.has(trimmed)) return trimmed;
  if (VALID_SPORTS.has(upper)) return upper;
  if (VALID_SPORTS.has(titleCase)) return titleCase;

  return null;
}
