// ═══════════════════════════════════════════════════════════════
// SHARED — ESPN SCOREBOARD (GAME/MATCH-LEVEL ONLY)
// ═══════════════════════════════════════════════════════════════
// SCOPE (deliberately narrow, do not widen without a spec change):
// this module exists ONLY to resolve final game/fight outcomes for
// sports that have NO odds vendor and NO stats brain. It is used by
// sbo-grade-capper-picks-alt to grade *capper picks* and nothing else.
//
// EXPLICITLY OUT OF SCOPE — none of these read from this file:
//   • player props (sbo_player_props)
//   • sbo_predictions generation or grading
//   • the stats brain (sbo_player_game_stats / season splits)
//   • clamp / readiness gates
//   • market lines, CLV, odds ingestion
//
// It is a SEPARATE registry from GRADING_CONFIGS in espnGrading.ts on
// purpose: adding a sport here must NOT enrol it in GRADED_SPORT_KEYS,
// which drives prop grading and stats ingestion.

import { fetchEspnFinals, findPlayerStats, type EspnFinal, type EspnScoreboardResult, type SportGradingConfig } from './espnGrading.ts';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export type AltSportConfig = {
  /** Our stored sbo_capper_picks.sport value(s), upper-cased. */
  pickSports: string[];
  /** ESPN path segment. */
  espnPath: string;
  /** 'team' → final score events; 'fight' → per-bout winner. */
  kind: 'team' | 'fight';
  aliases: Record<string, string>;
};

export const CFL_ALIASES: Record<string, string> = {
  bc: 'BC Lions',
  bclions: 'BC Lions',
  lions: 'BC Lions',
  calgary: 'Calgary Stampeders',
  stampeders: 'Calgary Stampeders',
  stamps: 'Calgary Stampeders',
  edmonton: 'Edmonton Elks',
  elks: 'Edmonton Elks',
  saskatchewan: 'Saskatchewan Roughriders',
  roughriders: 'Saskatchewan Roughriders',
  riders: 'Saskatchewan Roughriders',
  winnipeg: 'Winnipeg Blue Bombers',
  bluebombers: 'Winnipeg Blue Bombers',
  bombers: 'Winnipeg Blue Bombers',
  hamilton: 'Hamilton Tiger-Cats',
  tigercats: 'Hamilton Tiger-Cats',
  ticats: 'Hamilton Tiger-Cats',
  toronto: 'Toronto Argonauts',
  argonauts: 'Toronto Argonauts',
  argos: 'Toronto Argonauts',
  ottawa: 'Ottawa Redblacks',
  redblacks: 'Ottawa Redblacks',
  montreal: 'Montreal Alouettes',
  alouettes: 'Montreal Alouettes',
  als: 'Montreal Alouettes',
};

/** Registry. CFL + MMA only for this pass — tennis/golf are NOT built. */
export const ALT_SCOREBOARD_CONFIGS: Record<string, AltSportConfig> = {
  cfl: { pickSports: ['CFL'], espnPath: 'football/cfl', kind: 'team', aliases: CFL_ALIASES },
  mma: { pickSports: ['UFC', 'MMA'], espnPath: 'mma/ufc', kind: 'fight', aliases: {} },
};

export const ALT_PICK_SPORTS: string[] = Object.values(ALT_SCOREBOARD_CONFIGS).flatMap(c => c.pickSports);

export function altConfigForPickSport(sport: string): AltSportConfig | null {
  const s = (sport || '').toUpperCase();
  for (const cfg of Object.values(ALT_SCOREBOARD_CONFIGS)) {
    if (cfg.pickSports.includes(s)) return cfg;
  }
  return null;
}

/** Strip accents so "Milošević" matches a stored "Milosevic". */
export function stripDiacritics(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function altNorm(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Team sports (CFL) ──────────────────────────────────────────────
// Reuses fetchEspnFinals verbatim via a minimal config shim; the
// stat-line/prop hooks are intentionally inert (never called here).
export async function fetchAltTeamFinals(cfg: AltSportConfig, dateStr: string): Promise<EspnScoreboardResult> {
  const shim: SportGradingConfig<any> = {
    sportKey: 'alt',
    espnPath: cfg.espnPath,
    aliases: cfg.aliases,
    buildStatLines: () => [],
    getPropValue: () => null,
  };
  return await fetchEspnFinals(shim, dateStr);
}

/** Which side of a final does our stored team string refer to? */
export function sideForTeam(cfg: AltSportConfig, ourTeam: string, f: EspnFinal): 'home' | 'away' | null {
  const a = altNorm(ourTeam);
  if (!a) return null;
  const canonical = altNorm(cfg.aliases[a] ?? '');
  const test = (name: string, abbrev: string) => {
    const n = altNorm(name);
    const ab = altNorm(abbrev);
    if (!n) return false;
    if (n === a || ab === a) return true;
    if (a.length >= 3 && (n.includes(a) || a.includes(n))) return true;
    if (canonical && canonical === n) return true;
    return false;
  };
  if (test(f.homeName, f.homeAbbrev)) return 'home';
  if (test(f.awayName, f.awayAbbrev)) return 'away';
  return null;
}

// ── Fight sports (MMA/UFC) ─────────────────────────────────────────
export type FightResult = {
  eventId: string;
  fightId: string;
  /** Both competitors, diacritics preserved. */
  competitors: { name: string; winner: boolean }[];
};

export async function fetchFightResults(cfg: AltSportConfig, dateStr: string): Promise<{
  ok: boolean; httpStatus: number | null; totalFights: number; fights: FightResult[]; error?: string;
}> {
  const url = `${ESPN_BASE}/${cfg.espnPath}/scoreboard?dates=${dateStr.replace(/-/g, '')}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, totalFights: 0, fights: [], error: `ESPN mma scoreboard ${res.status}` };
    }
    const json = await res.json();
    const fights: FightResult[] = [];
    let total = 0;
    for (const ev of json?.events ?? []) {
      for (const comp of ev?.competitions ?? []) {
        total++;
        const state = comp?.status?.type?.state;
        const completed = comp?.status?.type?.completed;
        if (state !== 'post' || !completed) continue;
        const competitors = (comp?.competitors ?? []).map((c: any) => ({
          name: c?.athlete?.displayName ?? c?.athlete?.fullName ?? '',
          winner: c?.winner === true,
        })).filter((c: any) => c.name);
        if (competitors.length < 2) continue;
        if (!competitors.some((c: any) => c.winner)) continue; // draw / NC → leave pending
        fights.push({ eventId: String(ev.id), fightId: String(comp.id), competitors });
      }
    }
    return { ok: true, httpStatus: 200, totalFights: total, fights };
  } catch (e: any) {
    return { ok: false, httpStatus: null, totalFights: 0, fights: [], error: e?.message ?? 'unknown ESPN error' };
  }
}

/**
 * Resolve a stored fighter name (often a bare surname) to a fight outcome.
 * Reuses findPlayerStats() from espnGrading.ts — the existing 4-pass
 * athlete matcher — rather than introducing new matching logic. Names are
 * de-accented before they reach the matcher.
 */
export function findFighterOutcome(fights: FightResult[], fighterName: string): { won: boolean; fight: FightResult; matched: string } | null {
  const pool: any[] = [];
  for (const f of fights) {
    for (const c of f.competitors) {
      pool.push({ Name: stripDiacritics(c.name), _orig: c.name, _winner: c.winner, _fight: f });
    }
  }
  const hit = findPlayerStats(pool, stripDiacritics(fighterName));
  if (!hit) return null;
  return { won: hit._winner === true, fight: hit._fight, matched: hit._orig };
}

export type { EspnFinal };
