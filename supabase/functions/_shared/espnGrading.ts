// ═══════════════════════════════════════════════════════════════
// SHARED — FREE ESPN GRADING (SPORT-PARAMETERIZED)
// ═══════════════════════════════════════════════════════════════
// Generalization of the proven MLB grading path. MLB is the FIRST
// config entry, not a parallel system: the MLB stat-line parser and
// prop field map below are byte-for-byte the code that graded 79
// games / 136 props on 2026-07-30, just relocated behind a config.
//
// Endpoints (free, no key):
//   scoreboard: https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates=YYYYMMDD
//   summary:    https://site.api.espn.com/apis/site/v2/sports/{path}/summary?event={eventId}
//
// findPlayerStats() is a VERBATIM copy of the 4-pass fuzzy matcher in
// sbo-verify-results. It stays duplicated from the NBA/SDIO path so
// that path keeps its own copy and cannot be affected from here.
//
// ADDING A SPORT: append a SportGradingConfig to GRADING_CONFIGS.
// Only three things are ever sport-specific — team aliases, the
// box-score stat-line parser, and the prop→field map. Everything
// else (fetching, finals filtering, name matching) is shared.

import { MLB_ALIASES, norm } from './teamMatcher.ts';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export function espnDateParam(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// ── Generic types ──────────────────────────────────────────────────

/** Minimum shape every sport's parser must produce. */
export type StatLine = {
  Name: string;
  athleteId: string | null;
  [key: string]: any;
};

export type SportGradingConfig<L extends StatLine = StatLine> = {
  /** Our internal sport_key (matches sbo_sports.sport_key). */
  sportKey: string;
  /** ESPN path segment, e.g. 'baseball/mlb'. */
  espnPath: string;
  /** Canonical team-name aliases for this sport. */
  aliases: Record<string, string>;
  /** Box-score (/summary payload) → normalized per-player stat lines. */
  buildStatLines: (summary: any) => L[];
  /** prop_type → numeric stat value. null MUST be treated as pending. */
  getPropValue: (line: L, propType: string) => number | null;
};

export type EspnFinal = {
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
  finals: EspnFinal[];
  error?: string;
};

// ── Shared fetchers (identical logic for every sport) ──────────────

/** Match our stored team string against an ESPN displayName/abbrev. */
export function teamMatches(
  config: SportGradingConfig<any>,
  ourTeam: string,
  espnName: string,
): boolean {
  const a = norm(ourTeam);
  const b = norm(espnName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const canonicalA = config.aliases[a];
  if (canonicalA && norm(canonicalA) === b) return true;
  const canonicalB = config.aliases[b];
  if (canonicalB && norm(canonicalB) === a) return true;
  return false;
}

/** Fetch one day of a sport's scoreboard and return only completed games. */
export async function fetchEspnFinals(
  config: SportGradingConfig<any>,
  dateStr: string,
): Promise<EspnScoreboardResult> {
  const base = `${ESPN_BASE}/${config.espnPath}`;
  try {
    const res = await fetch(`${base}/scoreboard?dates=${espnDateParam(dateStr)}`);
    if (!res.ok) {
      return {
        ok: false, httpStatus: res.status, totalEvents: 0, finals: [],
        error: `ESPN scoreboard ${res.status} for ${dateStr}`,
      };
    }
    const json = await res.json();
    const events = json?.events ?? [];
    const finals: EspnFinal[] = [];
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

export async function fetchEspnSummary(
  config: SportGradingConfig<any>,
  eventId: string,
): Promise<any | null> {
  try {
    const res = await fetch(`${ESPN_BASE}/${config.espnPath}/summary?event=${eventId}`);
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

// ═══════════════════════════════════════════════════════════════
// CONFIG 1 — MLB (relocated verbatim from _shared/espnMlb.ts)
// ═══════════════════════════════════════════════════════════════

export type MlbStatLine = StatLine & {
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

export const MLB_GRADING: SportGradingConfig<MlbStatLine> = {
  sportKey: 'mlb',
  espnPath: 'baseball/mlb',
  aliases: MLB_ALIASES,
  buildStatLines: buildMlbStatLines,
  getPropValue: getMlbPropValue,
};

// ═══════════════════════════════════════════════════════════════
// CONFIG 2 — WNBA (Stage 3)
// ═══════════════════════════════════════════════════════════════
// WNBA and NBA share the SAME ESPN box-score shape:
//   boxscore.players[].statistics[0].keys =
//     ['minutes','points','fieldGoalsMade-fieldGoalsAttempted',
//      'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
//      'freeThrowsMade-freeThrowsAttempted','rebounds','assists',
//      'turnovers','steals','blocks','offensiveRebounds',
//      'defensiveRebounds','fouls','plusMinus']
// (verified live against event 401857102, 2026-07-31).
// Made/attempted pairs arrive as "8-10" strings and are split here so
// downstream consumers only ever see numbers.

export type WnbaStatLine = StatLine & {
  played: boolean;
  MIN: number | null; PTS: number | null; REB: number | null; AST: number | null;
  STL: number | null; BLK: number | null; TOV: number | null; PF: number | null;
  FGM: number | null; FGA: number | null;
  TPM: number | null; TPA: number | null;
  FTM: number | null; FTA: number | null;
  OREB: number | null; DREB: number | null;
};

/** "8-10" → [8, 10]; anything unparseable → [null, null]. */
function madeAtt(v: any): [number | null, number | null] {
  const s = String(v ?? '').trim();
  const m = s.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
  if (!m) return [null, null];
  return [num(m[1]), num(m[2])];
}

export function buildWnbaStatLines(summary: any): WnbaStatLine[] {
  const byId = new Map<string, WnbaStatLine>();

  for (const teamBlock of summary?.boxscore?.players ?? []) {
    for (const group of teamBlock?.statistics ?? []) {
      const keys: string[] = group?.keys ?? [];
      for (const a of group?.athletes ?? []) {
        const name = a?.athlete?.displayName ?? '';
        if (!name) continue;
        const id = a?.athlete?.id ? String(a.athlete.id) : null;
        const stats: string[] = a?.stats ?? [];
        // DNPs come through with an empty stats array — skip, don't zero-fill.
        if (!stats.length) continue;
        const get = (k: string) => {
          const i = keys.indexOf(k);
          return i >= 0 ? stats[i] : undefined;
        };
        const [FGM, FGA] = madeAtt(get('fieldGoalsMade-fieldGoalsAttempted'));
        const [TPM, TPA] = madeAtt(get('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
        const [FTM, FTA] = madeAtt(get('freeThrowsMade-freeThrowsAttempted'));
        const key = id ?? `name:${name.toLowerCase()}`;
        byId.set(key, {
          Name: name,
          athleteId: id,
          played: true,
          MIN: num(get('minutes')),
          PTS: num(get('points')),
          REB: num(get('rebounds')),
          AST: num(get('assists')),
          STL: num(get('steals')),
          BLK: num(get('blocks')),
          TOV: num(get('turnovers')),
          PF: num(get('fouls')),
          FGM, FGA, TPM, TPA, FTM, FTA,
          OREB: num(get('offensiveRebounds')),
          DREB: num(get('defensiveRebounds')),
        });
      }
    }
  }

  return [...byId.values()];
}

/** Sum helper — null if ANY component is missing (pending, never a loss). */
function sumOrNull(...vals: (number | null)[]): number | null {
  if (vals.some((v) => v === null || v === undefined)) return null;
  return (vals as number[]).reduce((a, b) => a + b, 0);
}

export function getWnbaPropValue(ps: WnbaStatLine, propType: string): number | null {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s-]/g, '_');
  if (!ps.played) return null;

  switch (pt) {
    case 'points': case 'player_points': return ps.PTS;
    case 'rebounds': case 'player_rebounds': return ps.REB;
    case 'assists': case 'player_assists': return ps.AST;
    case 'threes': case 'player_threes': case 'three_pointers': return ps.TPM;
    case 'steals': case 'player_steals': return ps.STL;
    case 'blocks': case 'player_blocks': return ps.BLK;
    case 'turnovers': case 'player_turnovers': return ps.TOV;
    case 'pts_reb_ast': case 'pra': return sumOrNull(ps.PTS, ps.REB, ps.AST);
    case 'pts_reb': return sumOrNull(ps.PTS, ps.REB);
    case 'pts_ast': return sumOrNull(ps.PTS, ps.AST);
    case 'reb_ast': return sumOrNull(ps.REB, ps.AST);
    case 'blocks_steals': case 'stl_blk': return sumOrNull(ps.BLK, ps.STL);
    default:
      console.warn('UNMAPPED WNBA PROP TYPE:', propType, '→ cleaned:', pt);
      return null;
  }
}

/** Canonical WNBA team aliases (ESPN displayName is the canonical form). */
export const WNBA_ALIASES: Record<string, string> = {
  'atl': 'Atlanta Dream', 'dream': 'Atlanta Dream', 'atlanta': 'Atlanta Dream',
  'chi': 'Chicago Sky', 'sky': 'Chicago Sky', 'chicago': 'Chicago Sky',
  'con': 'Connecticut Sun', 'conn': 'Connecticut Sun', 'sun': 'Connecticut Sun', 'connecticut': 'Connecticut Sun',
  'dal': 'Dallas Wings', 'wings': 'Dallas Wings', 'dallas': 'Dallas Wings',
  'gs': 'Golden State Valkyries', 'gsv': 'Golden State Valkyries', 'valkyries': 'Golden State Valkyries', 'golden state': 'Golden State Valkyries',
  'ind': 'Indiana Fever', 'fever': 'Indiana Fever', 'indiana': 'Indiana Fever',
  'lv': 'Las Vegas Aces', 'lva': 'Las Vegas Aces', 'aces': 'Las Vegas Aces', 'las vegas': 'Las Vegas Aces',
  'la': 'Los Angeles Sparks', 'las': 'Los Angeles Sparks', 'sparks': 'Los Angeles Sparks', 'los angeles': 'Los Angeles Sparks',
  'min': 'Minnesota Lynx', 'lynx': 'Minnesota Lynx', 'minnesota': 'Minnesota Lynx',
  'ny': 'New York Liberty', 'nyl': 'New York Liberty', 'liberty': 'New York Liberty', 'new york': 'New York Liberty',
  'phx': 'Phoenix Mercury', 'phoenix': 'Phoenix Mercury', 'mercury': 'Phoenix Mercury',
  'por': 'Portland Fire', 'fire': 'Portland Fire', 'portland': 'Portland Fire',
  'sea': 'Seattle Storm', 'storm': 'Seattle Storm', 'seattle': 'Seattle Storm',
  'tor': 'Toronto Tempo', 'tempo': 'Toronto Tempo', 'toronto': 'Toronto Tempo',
  'wsh': 'Washington Mystics', 'was': 'Washington Mystics', 'mystics': 'Washington Mystics', 'washington': 'Washington Mystics',
};

export const WNBA_GRADING: SportGradingConfig<WnbaStatLine> = {
  sportKey: 'wnba',
  espnPath: 'basketball/wnba',
  aliases: WNBA_ALIASES,
  buildStatLines: buildWnbaStatLines,
  getPropValue: getWnbaPropValue,
};


// ═══════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════
// Stage 3 (WNBA) and Stage 4 (NFL) append here. Nothing else in the
// grading path needs to change to add a sport.
export const GRADING_CONFIGS: Record<string, SportGradingConfig<any>> = {
  mlb: MLB_GRADING,
  wnba: WNBA_GRADING,
};

/** Sports that currently have a working free-ESPN grading path. */
export const GRADED_SPORT_KEYS: string[] = Object.keys(GRADING_CONFIGS);

export function getGradingConfig(sportKey: string): SportGradingConfig<any> | null {
  return GRADING_CONFIGS[(sportKey || '').toLowerCase()] ?? null;
}

// ═══════════════════════════════════════
// FUZZY PLAYER NAME MATCHING (sport-agnostic)
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
