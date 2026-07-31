/**
 * De-vigged moneyline consensus — Option A market-favorite derivation.
 *
 * Pure logic, no I/O. Used by:
 *   - sbo-run-predictions  (authoritative derivation of predicted_outcome + market brain implied prob)
 *   - sbo-analyze-tonight  (stops sending a hardcoded 'home')
 *
 * Method:
 *   1. For each book with BOTH sides priced, convert American odds → implied probability.
 *   2. Normalize that book's (home, away) pair to sum to 1.0 — removes the vig for that book.
 *   3. Average the de-vigged probabilities across books.
 *   4. Higher average probability = predicted_outcome.
 *
 * Everything produced from this path is odds-only by definition — no stats feed is
 * consulted — so callers must label it data_quality: 'odds_only' and let the existing
 * 54-point clamp in sbo-run-predictions apply unchanged.
 */

export interface MoneylineOddsRow {
  sportsbook?: string | null;
  home_odds?: number | string | null;
  away_odds?: number | string | null;
  fetched_at?: string | null;
}

export interface BookDevig {
  sportsbook: string;
  home_odds: number;
  away_odds: number;
  raw_home: number;
  raw_away: number;
  vig: number;
  home_prob: number;
  away_prob: number;
}

export interface DevigConsensus {
  predicted_outcome: 'home' | 'away';
  home_prob: number;   // 0-1, de-vigged consensus
  away_prob: number;   // 0-1, de-vigged consensus
  favorite_prob: number; // prob of the selected side, 0-1
  books_used: number;
  books: BookDevig[];
  method: 'devig_consensus';
}

/** American odds → raw implied probability (0-1). Includes the book's vig. */
export function americanToImplied(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return NaN;
  return odds < 0
    ? Math.abs(odds) / (Math.abs(odds) + 100)
    : 100 / (odds + 100);
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Derive the de-vigged consensus favorite across all supplied books.
 * Returns null when no book has a complete two-sided price.
 */
export function deriveMoneylineConsensus(rows: MoneylineOddsRow[]): DevigConsensus | null {
  const books: BookDevig[] = [];

  // One row per sportsbook — keep the most recent when duplicates exist.
  const latestByBook = new Map<string, MoneylineOddsRow>();
  for (const r of rows || []) {
    const key = (r.sportsbook || 'unknown').toLowerCase();
    const prev = latestByBook.get(key);
    if (!prev) { latestByBook.set(key, r); continue; }
    const a = prev.fetched_at ? Date.parse(prev.fetched_at) : 0;
    const b = r.fetched_at ? Date.parse(r.fetched_at) : 0;
    if (b >= a) latestByBook.set(key, r);
  }

  for (const [book, r] of latestByBook) {
    const home = toNum(r.home_odds);
    const away = toNum(r.away_odds);
    if (!Number.isFinite(home) || !Number.isFinite(away)) continue;

    const rawHome = americanToImplied(home);
    const rawAway = americanToImplied(away);
    if (!Number.isFinite(rawHome) || !Number.isFinite(rawAway)) continue;

    const total = rawHome + rawAway;
    if (!(total > 0)) continue;

    books.push({
      sportsbook: book,
      home_odds: home,
      away_odds: away,
      raw_home: rawHome,
      raw_away: rawAway,
      vig: total - 1,
      home_prob: rawHome / total,
      away_prob: rawAway / total,
    });
  }

  if (books.length === 0) return null;

  const homeProb = books.reduce((s, b) => s + b.home_prob, 0) / books.length;
  const awayProb = books.reduce((s, b) => s + b.away_prob, 0) / books.length;
  const outcome: 'home' | 'away' = homeProb >= awayProb ? 'home' : 'away';

  return {
    predicted_outcome: outcome,
    home_prob: homeProb,
    away_prob: awayProb,
    favorite_prob: outcome === 'home' ? homeProb : awayProb,
    books_used: books.length,
    books,
    method: 'devig_consensus',
  };
}

/** Convenience: de-vigged implied probability (%) of a specific side. */
export function sideProbPct(consensus: DevigConsensus, side: 'home' | 'away'): number {
  return (side === 'home' ? consensus.home_prob : consensus.away_prob) * 100;
}
