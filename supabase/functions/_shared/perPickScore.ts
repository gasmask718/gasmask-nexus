// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL per-pick scoring formula for SBO capper picks.
//
// SINGLE SOURCE OF TRUTH. This file is the only implementation.
//   • Edge functions import it directly ('../_shared/perPickScore.ts').
//   • The frontend imports it through `src/lib/sbo/perPickScore.ts`, which is a
//     pure re-export of THIS file — not a copy. There is no mirrored logic, so
//     the UI number and the persisted number cannot drift.
//
// 25 pts: WHO backed it (consensus size + real capper ROI / win rate)
// 75 pts: THE PICK ITSELF (recent player form vs the line, direction agreement,
//         price, line edge vs the live market, market difficulty)
// ─────────────────────────────────────────────────────────────────────────────

export const PER_PICK_SCORE_VERSION = 'v1.0';

export interface PerPickScoreInput {
  capperCount: number;
  avgCapperROI: number;
  avgCapperWinRate: number;
  formHitRate: number | null;
  directionAgreement: number;
  impliedProb: number | null;
  lineEdgePct: number | null;
  marketWinRate: number | null;
}

export interface PerPickScoreBreakdown {
  consensusWeight: number;
  roiWeight: number;
  wrWeight: number;
  formWeight: number;
  dirWeight: number;
  priceWeight: number;
  lineWeight: number;
  marketWeight: number;
  /** 0-100 confidence score (capper quality + pick quality). */
  total: number;
  /** 0-100 pick-quality-only score (the 75-pt per-pick block, rescaled). */
  edgeScore: number;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function calcConfidenceBreakdown(pick: PerPickScoreInput): PerPickScoreBreakdown {
  // Capper-quality component (max 25)
  const consensusWeight = Math.min(pick.capperCount / 5, 1) * 12;
  const roiWeight = clamp01((pick.avgCapperROI + 20) / 40) * 8;
  const wrWeight = clamp01(pick.avgCapperWinRate / 100) * 5;

  // Per-pick component (max 75)
  // Recent player form: share of the player's last 15 games clearing this exact
  // line in the pick's direction, mapped 20% → 70%. The strongest per-pick signal.
  const formWeight = pick.formHitRate === null
    ? 15
    : clamp01((pick.formHitRate - 20) / 50) * 30;

  // Directional agreement: 50/50 split = 0, unanimous = full credit
  const dirWeight = clamp01((pick.directionAgreement - 0.5) * 2) * 10;

  // Price quality: implied probability of the taken odds, mapped 40% → 60%
  const priceWeight = pick.impliedProb === null
    ? 8
    : clamp01((pick.impliedProb - 0.40) / 0.20) * 16;

  // Line edge vs live market line, in the pick's direction: -5% → +5%
  const lineWeight = pick.lineEdgePct === null
    ? 6
    : clamp01((pick.lineEdgePct + 0.05) / 0.10) * 12;

  // Market difficulty: historical hit rate for this sport + prop type, 35% → 65%
  const marketWeight = pick.marketWinRate === null
    ? 3.5
    : clamp01((pick.marketWinRate - 35) / 30) * 7;

  const total = consensusWeight + roiWeight + wrWeight + formWeight + dirWeight + priceWeight + lineWeight + marketWeight;
  const perPick = formWeight + dirWeight + priceWeight + lineWeight + marketWeight;

  return {
    consensusWeight, roiWeight, wrWeight, formWeight, dirWeight, priceWeight, lineWeight, marketWeight,
    total: Math.round(total),
    edgeScore: Math.round((perPick / 75) * 100),
  };
}

export function calcConfidence(pick: PerPickScoreInput): number {
  return calcConfidenceBreakdown(pick).total;
}

export function impliedFromAmerican(odds: number | null | undefined): number | null {
  if (odds === null || odds === undefined || !Number.isFinite(Number(odds)) || Number(odds) === 0) return null;
  const o = Number(odds);
  return o < 0 ? -o / (-o + 100) : 100 / (o + 100);
}
