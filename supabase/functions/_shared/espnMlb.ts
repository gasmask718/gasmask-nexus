// ═══════════════════════════════════════════════════════════════
// SHARED — FREE ESPN MLB GRADING (COMPATIBILITY SHIM)
// ═══════════════════════════════════════════════════════════════
// Stage 1 generalization: the implementation moved verbatim into
// _shared/espnGrading.ts as the MLB config entry. This file is now a
// thin shim so existing import sites (sbo-verify-results,
// sbo-track-results) keep working unchanged and MLB behavior is
// provably identical — same functions, same code, new home.
//
// New code should import from ./espnGrading.ts directly.

import {
  MLB_GRADING,
  fetchEspnFinals,
  fetchEspnSummary,
  teamMatches,
  type EspnFinal,
  type EspnScoreboardResult,
} from './espnGrading.ts';

export {
  espnDateParam,
  buildMlbStatLines,
  getMlbPropValue,
  findPlayerStats,
  MLB_GRADING,
  type MlbStatLine,
  type EspnScoreboardResult,
} from './espnGrading.ts';

/** @deprecated use EspnFinal from ./espnGrading.ts */
export type EspnMlbFinal = EspnFinal;

export function mlbTeamMatches(ourTeam: string, espnName: string): boolean {
  return teamMatches(MLB_GRADING, ourTeam, espnName);
}

export function fetchEspnMlbFinals(dateStr: string): Promise<EspnScoreboardResult> {
  return fetchEspnFinals(MLB_GRADING, dateStr);
}

export function fetchEspnMlbSummary(eventId: string): Promise<any | null> {
  return fetchEspnSummary(MLB_GRADING, eventId);
}
