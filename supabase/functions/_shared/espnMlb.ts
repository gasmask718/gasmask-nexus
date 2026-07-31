// ═══════════════════════════════════════════════════════════════
// SHARED — FREE ESPN MLB GRADING HELPERS
// ═══════════════════════════════════════════════════════════════
// Additive only. Nothing here is imported by any NBA/SportsDataIO
// code path; the NBA graders are untouched.
//
// Endpoints (both free, no key, already proven working in
// sbo-result-tracker for capper-pick grading):
//   scoreboard: https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=YYYYMMDD
//   summary:    https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={eventId}
//
// findPlayerStats() below is a VERBATIM copy of the 4-pass fuzzy
// matcher in sbo-verify-results. It is duplicated rather than
// re-exported so the NBA path keeps its own byte-for-byte copy and
// cannot be affected by any future MLB-driven change here.

import { MLB_ALIASES, norm } from './teamMatcher.ts';

const ESPN_MLB = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';

export function espnDateParam(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/** Match our stored team string against an ESPN displayName/abbrev. */
export function mlbTeamMatches(ourTeam: string, espnName: string): boolean {
  const a = norm(ourTeam);
  const b = norm(espnName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const canonicalA = MLB_ALIASES[a];
  if (canonicalA && norm(canonicalA) === b) return true;
  const canonicalB = MLB_ALIASES[b];
  if (canonicalB && norm(canonicalB) === a) return true;
  return false;
}

export type EspnMlbFinal = {
  eventId: string;
  homeName: string;
  awayName: string;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
};

export type EspnScoreboardResult = {
  ok: boolean;
  httpStatus: number | null;
  totalEvents: number;
  finals: EspnMlbFinal[];
  error?: string;
};

/** Fetch one day of the MLB scoreboard and return only completed games. */
export async function fetchEspnMlbFinals(dateStr: string): Promise<EspnScoreboardResult> {
  try {
    const res = await fetch(`${ESPN_MLB}/scoreboard?dates=${espnDateParam(dateStr)}`);
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, totalEvents: 0, finals: [], error: `ESPN scoreboard ${res.status} for ${dateStr}` };
    }
    const json = await res.json();
    const events = json?.events ?? [];
    const finals: EspnMlbFinal[] = [];
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      const state = comp?.status?.type?.state ?? ev?.status?.type?.state;
      const completed = comp?.status?.type?.completed ?? ev?.status?.type?.completed;
      if (state !== 'post' || !completed) continue;
      const home = (comp?.competitors ?? []).find((c: any) => c.homeAway === 'home');
      const away = (comp?.competitors ?? []).find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;
      const hs = Number(home.score);
      const as = Number(away.score);
      if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
      finals.push({
        eventId: String(ev.id),
        homeName: home.team?.displayName ?? '',
        awayName: away.team?.displayName ?? '',
        homeAbbrev: home.team?.abbreviation ?? '',
        awayAbbrev: away.team?.abbreviation ?? '',
        homeScore: hs,
        awayScore: as,
      });
    }
    return { ok: true, httpStatus: 200, totalEvents: events.length, finals };
  } catch (e: any) {
    return { ok: false, httpStatus: null, totalEvents: 0, finals: [], error: e?.message ?? 'unknown ESPN error' };
  }
}

// ── Boxscore → normalized per-player stat lines ────────────────────

export type MlbStatLine = {
  Name: string;
  athleteId: string | null;
  batted: boolean;
  pitched: boolean;
  // batting
  AB: number | null; R: number | null; H: number | null; RBI: number | null;
  HR: number | null; BB: number | null; K_b: number | null; TB: number | null;
  // pitching
  IP: number | null; OUTS: number | null; H_allowed: number | null;
  ER: number | null; BB_allowed: number | null; K_p: number | null; HR_allowed: number | null;
};

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** IP like "3.2" means 3 innings + 2 outs → 11 outs. */
function ipToOuts(ip: any): number | null {
  const s = String(ip ?? '').trim();
  if (!s) return null;
  const [wholeStr, fracStr] = s.split('.');
  const whole = Number(wholeStr);
  if (!Number.isFinite(whole)) return null;
  const frac = fracStr ? Number(fracStr) : 0;
  if (![0, 1, 2].includes(frac)) return whole * 3;
  return whole * 3 + frac;
}

const TB_VALUE: Record<string, number> = {
  'single': 1, 'double': 2, 'triple': 3, 'home run': 4,
};

/**
 * Build normalized stat lines from an ESPN /summary payload.
 * Total bases are derived from the play-by-play (the box score does
 * not expose 2B/3B). If `plays` is missing, TB stays null → pending.
 */
export function buildMlbStatLines(summary: any): MlbStatLine[] {
  const byId = new Map<string, MlbStatLine>();

  const ensure = (id: string | null, name: string): MlbStatLine => {
    const key = id ?? `name:${name.toLowerCase()}`;
    let line = byId.get(key);
    if (!line) {
      line = {
        Name: name, athleteId: id, batted: false, pitched: false,
        AB: null, R: null, H: null, RBI: null, HR: null, BB: null, K_b: null, TB: null,
        IP: null, OUTS: null, H_allowed: null, ER: null, BB_allowed: null, K_p: null, HR_allowed: null,
      };
      byId.set(key, line);
    }
    return line;
  };

  for (const teamBlock of summary?.boxscore?.players ?? []) {
    for (const group of teamBlock?.statistics ?? []) {
      const keys: string[] = group?.keys ?? [];
      const isPitching = keys.includes('fullInnings.partInnings');
      for (const a of group?.athletes ?? []) {
        const name = a?.athlete?.displayName ?? '';
        if (!name) continue;
        const id = a?.athlete?.id ? String(a.athlete.id) : null;
        const stats: string[] = a?.stats ?? [];
        const get = (k: string) => {
          const i = keys.indexOf(k);
          return i >= 0 ? stats[i] : undefined;
        };
        const line = ensure(id, name);
        if (isPitching) {
          line.pitched = true;
          line.IP = num(get('fullInnings.partInnings'));
          line.OUTS = ipToOuts(get('fullInnings.partInnings'));
          line.H_allowed = num(get('hits'));
          line.ER = num(get('earnedRuns'));
          line.BB_allowed = num(get('walks'));
          line.K_p = num(get('strikeouts'));
          line.HR_allowed = num(get('homeRuns'));
        } else {
          line.batted = true;
          line.AB = num(get('atBats'));
          line.R = num(get('runs'));
          line.H = num(get('hits'));
          line.RBI = num(get('RBIs'));
          line.HR = num(get('homeRuns'));
          line.BB = num(get('walks'));
          line.K_b = num(get('strikeouts'));
        }
      }
    }
  }

  // Derive total bases from play-by-play, attributed to the batter.
  const plays = summary?.plays;
  if (Array.isArray(plays) && plays.length > 0) {
    for (const line of byId.values()) {
      if (line.batted) line.TB = 0;
    }
    for (const p of plays) {
      const label = String(p?.type?.text ?? '').toLowerCase();
      const value = TB_VALUE[label];
      if (!value) continue;
      const batter = (p?.participants ?? []).find((x: any) => x?.type === 'batter');
      const bid = batter?.athlete?.id ? String(batter.athlete.id) : null;
      if (!bid) continue;
      const line = byId.get(bid);
      if (!line) continue;
      line.TB = (line.TB ?? 0) + value;
    }
  }

  return [...byId.values()];
}

export async function fetchEspnMlbSummary(eventId: string): Promise<any | null> {
  try {
    const res = await fetch(`${ESPN_MLB}/summary?event=${eventId}`);
    if (!res.ok) {
      console.warn(`ESPN summary ${res.status} for event ${eventId}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.warn(`ESPN summary failed for event ${eventId}:`, e?.message);
    return null;
  }
}

// ── MLB prop type → stat field ─────────────────────────────────────
// strikeouts_p (pitcher Ks) and strikeouts_b (batter Ks) are kept
// STRICTLY separate. An unrecognized or ambiguous type returns null,
// which callers must treat as pending — never as a loss.
export function getMlbPropValue(ps: MlbStatLine, propType: string): number | null {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s-]/g, '_');

  switch (pt) {
    // batting
    case 'hits': case 'batter_hits': case 'player_hits':
      return ps.batted ? ps.H : null;
    case 'total_bases': case 'batter_total_bases': case 'player_total_bases':
      return ps.batted ? ps.TB : null;
    case 'home_runs': case 'homeruns': case 'batter_home_runs':
      return ps.batted ? ps.HR : null;
    case 'rbis': case 'rbi': case 'batter_rbis':
      return ps.batted ? ps.RBI : null;
    case 'runs': case 'runs_scored': case 'batter_runs_scored':
      return ps.batted ? ps.R : null;
    case 'walks': case 'batter_walks':
      return ps.batted ? ps.BB : null;
    case 'strikeouts_b': case 'batter_strikeouts':
      return ps.batted ? ps.K_b : null;
    case 'hits_runs_rbis': case 'hits_+_runs_+_rbis':
      return ps.batted && ps.H !== null && ps.R !== null && ps.RBI !== null
        ? ps.H + ps.R + ps.RBI : null;

    // pitching
    case 'strikeouts_p': case 'pitcher_strikeouts':
      return ps.pitched ? ps.K_p : null;
    case 'hits_allowed': case 'pitcher_hits_allowed':
      return ps.pitched ? ps.H_allowed : null;
    case 'earned_runs': case 'pitcher_earned_runs':
      return ps.pitched ? ps.ER : null;
    case 'walks_allowed': case 'pitcher_walks':
      return ps.pitched ? ps.BB_allowed : null;
    case 'outs': case 'pitcher_outs': case 'outs_recorded':
      return ps.pitched ? ps.OUTS : null;

    default:
      console.warn('UNMAPPED MLB PROP TYPE:', propType, '→ cleaned:', pt);
      return null;
  }
}

// ═══════════════════════════════════════
// FUZZY PLAYER NAME MATCHING
// (verbatim copy of sbo-verify-results' 4-pass matcher)
// ═══════════════════════════════════════
export function findPlayerStats(allStats: any[], playerName: string): any | null {
  if (!playerName || !allStats.length) return null;
  const target = playerName.toLowerCase().trim();
  const targetParts = target.split(' ').filter(Boolean);
  const targetFirst = targetParts[0] || '';
  const targetLast = targetParts[targetParts.length - 1] || '';

  // Remove suffixes for matching
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'];
  const targetClean = targetParts.filter(p => !suffixes.includes(p)).join(' ');
  const targetLastClean = targetClean.split(' ').pop() || targetLast;

  // Pass 1: Exact full name
  let match = allStats.find(ps => (ps.Name || '').toLowerCase().trim() === target);
  if (match) return match;

  // Pass 2: Cleaned name (without Jr/Sr)
  match = allStats.find(ps => {
    const name = (ps.Name || '').toLowerCase().trim();
    const parts = name.split(' ').filter((p: string) => !suffixes.includes(p));
    return parts.join(' ') === targetClean;
  });
  if (match) return match;

  // Pass 3: Last name + first initial
  match = allStats.find(ps => {
    const name = (ps.Name || '').toLowerCase().trim();
    const parts = name.split(' ').filter((p: string) => !suffixes.includes(p));
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    return last === targetLastClean && first[0] === targetFirst[0];
  });
  if (match) return match;

  // Pass 4: Unique last name match
  const lastMatches = allStats.filter(ps => {
    const parts = (ps.Name || '').toLowerCase().split(' ').filter((p: string) => !suffixes.includes(p));
    return (parts[parts.length - 1] || '') === targetLastClean;
  });
  if (lastMatches.length === 1) return lastMatches[0];

  console.log(`No stats found for: "${playerName}"`);
  return null;
}
