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

/**
 * A pre-ESPN scoring/stats provider that a sport is still allowed to use.
 * Declared as data so no sport can reach a legacy vendor path by accident:
 * if a sport has no entry in LEGACY_SCORE_SOURCES, the branch is unreachable
 * for it. Today NBA is the only such sport (SportsDataIO).
 */
export type LegacyScoreSource = {
  provider: 'sportsdataio';
  /** Env var holding the API key. Absent key ⇒ branch is skipped entirely. */
  apiKeyEnv: string;
  /** `${dateStr}` is substituted; `${key}` is the api key. */
  scoresUrl: (dateStr: string, key: string) => string;
  playerStatsUrl: (dateStr: string, key: string) => string;
  /** Sanity floor on a final score; guards against bogus/forfeit rows. */
  minScore: number;
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
// CONFIG 2b — NBA (Phase 7a, free ESPN)
// ═══════════════════════════════════════════════════════════════
// NBA shares the WNBA box-score shape byte-for-byte (verified live against
// basketball/nba scoreboard 2026-03-19, 8 FINAL events), so the WNBA parser
// and prop accessor are REUSED verbatim — never mirrored.
// NOTE: this config is registered in GRADING_CONFIGS (so sbo-ingest-player-stats
// can resolve 'nba') but is deliberately NOT added to GRADED_SPORT_KEYS: that
// list drives the sbo-day-engine / sbo-verify-results fanout, and enrolling NBA
// there is a separate governance decision with its own evidence.
export const NBA_ALIASES: Record<string, string> = {
  'atl': 'Atlanta Hawks', 'hawks': 'Atlanta Hawks',
  'bos': 'Boston Celtics', 'celtics': 'Boston Celtics',
  'bkn': 'Brooklyn Nets', 'nets': 'Brooklyn Nets',
  'cha': 'Charlotte Hornets', 'hornets': 'Charlotte Hornets',
  'chi': 'Chicago Bulls', 'bulls': 'Chicago Bulls',
  'cle': 'Cleveland Cavaliers', 'cavaliers': 'Cleveland Cavaliers', 'cavs': 'Cleveland Cavaliers',
  'dal': 'Dallas Mavericks', 'mavericks': 'Dallas Mavericks', 'mavs': 'Dallas Mavericks',
  'den': 'Denver Nuggets', 'nuggets': 'Denver Nuggets',
  'det': 'Detroit Pistons', 'pistons': 'Detroit Pistons',
  'gsw': 'Golden State Warriors', 'warriors': 'Golden State Warriors',
  'hou': 'Houston Rockets', 'rockets': 'Houston Rockets',
  'ind': 'Indiana Pacers', 'pacers': 'Indiana Pacers',
  'lac': 'LA Clippers', 'clippers': 'LA Clippers',
  'lal': 'Los Angeles Lakers', 'lakers': 'Los Angeles Lakers',
  'mem': 'Memphis Grizzlies', 'grizzlies': 'Memphis Grizzlies',
  'mia': 'Miami Heat', 'heat': 'Miami Heat',
  'mil': 'Milwaukee Bucks', 'bucks': 'Milwaukee Bucks',
  'min': 'Minnesota Timberwolves', 'timberwolves': 'Minnesota Timberwolves', 'wolves': 'Minnesota Timberwolves',
  'nop': 'New Orleans Pelicans', 'pelicans': 'New Orleans Pelicans',
  'nyk': 'New York Knicks', 'knicks': 'New York Knicks',
  'okc': 'Oklahoma City Thunder', 'thunder': 'Oklahoma City Thunder',
  'orl': 'Orlando Magic', 'magic': 'Orlando Magic',
  'phi': 'Philadelphia 76ers', '76ers': 'Philadelphia 76ers', 'sixers': 'Philadelphia 76ers',
  'phx': 'Phoenix Suns', 'suns': 'Phoenix Suns',
  'por': 'Portland Trail Blazers', 'blazers': 'Portland Trail Blazers',
  'sac': 'Sacramento Kings', 'kings': 'Sacramento Kings',
  'sas': 'San Antonio Spurs', 'spurs': 'San Antonio Spurs',
  'tor': 'Toronto Raptors', 'raptors': 'Toronto Raptors',
  'uta': 'Utah Jazz', 'jazz': 'Utah Jazz',
  'was': 'Washington Wizards', 'wsh': 'Washington Wizards', 'wizards': 'Washington Wizards',
};

export const NBA_GRADING: SportGradingConfig<WnbaStatLine> = {
  sportKey: 'nba',
  espnPath: 'basketball/nba',
  aliases: NBA_ALIASES,
  buildStatLines: buildWnbaStatLines,
  getPropValue: getWnbaPropValue,
};


// ═══════════════════════════════════════════════════════════════
// CONFIG 3 — NFL (Stage 4)
// ═══════════════════════════════════════════════════════════════
// PROBED LIVE against event 401772966 (Saints, 2026-01-04). NFL does
// NOT share NBA/WNBA's single-group shape: boxscore.players[].statistics
// is an ARRAY OF CATEGORY GROUPS, each with its own keys[], and the SAME
// athlete appears in several groups (e.g. receiving + fumbles). Real
// observed groups and keys:
//   passing     ['completions/passingAttempts','passingYards','yardsPerPassAttempt',
//                'passingTouchdowns','interceptions','sacks-sackYardsLost','adjQBR','QBRating']
//   rushing     ['rushingAttempts','rushingYards','yardsPerRushAttempt','rushingTouchdowns','longRushing']
//   receiving   ['receptions','receivingYards','yardsPerReception','receivingTouchdowns',
//                'longReception','receivingTargets']
//   fumbles     ['fumbles','fumblesLost','fumblesRecovered']
//   defensive   ['totalTackles','soloTackles','sacks','tacklesForLoss','passesDefended','QBHits','defensiveTouchdowns']
//   interceptions ['interceptions','interceptionYards','interceptionTouchdowns']   ← DEFENSIVE INTs
//   kickReturns / puntReturns / kicking / punting
// NOTE the 'interceptions' key collides across the passing group (INTs
// THROWN) and the interceptions group (INTs CAUGHT). They are therefore
// read per-group, never by key alone.
// Lines are merged per athlete id so one player carries pass+rush+rec.

export type NflStatLine = StatLine & {
  passed: boolean; rushed: boolean; received: boolean; defended: boolean; kicked: boolean;
  // passing
  CMP: number | null; ATT: number | null; PASS_YDS: number | null;
  PASS_TD: number | null; INT_THROWN: number | null; SACKED: number | null;
  // rushing
  CAR: number | null; RUSH_YDS: number | null; RUSH_TD: number | null; LONG_RUSH: number | null;
  // receiving
  REC: number | null; REC_YDS: number | null; REC_TD: number | null; TGTS: number | null;
  // fumbles
  FUM: number | null; FUM_LOST: number | null;
  // defense
  TACKLES: number | null; SOLO: number | null; SACKS: number | null; TFL: number | null;
  PD: number | null; QB_HITS: number | null; DEF_TD: number | null;
  INT_CAUGHT: number | null; INT_TD: number | null;
  // returns
  KR_TD: number | null; PR_TD: number | null;
  // kicking
  FGM: number | null; FGA: number | null; XPM: number | null; XPA: number | null;
  KICK_PTS: number | null;
};

/** "23/35" → [23, 35]; unparseable → [null, null]. */
function slashPair(v: any): [number | null, number | null] {
  const m = String(v ?? '').trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return [null, null];
  return [num(m[1]), num(m[2])];
}

/** "4-27" (sacks-yardsLost) → the leading count only. */
function dashLead(v: any): number | null {
  const m = String(v ?? '').trim().match(/^(-?\d+)/);
  return m ? num(m[1]) : null;
}

export function buildNflStatLines(summary: any): NflStatLine[] {
  const byId = new Map<string, NflStatLine>();

  const ensure = (id: string | null, name: string): NflStatLine => {
    const key = id ?? `name:${name.toLowerCase()}`;
    let line = byId.get(key);
    if (!line) {
      line = {
        Name: name, athleteId: id,
        passed: false, rushed: false, received: false, defended: false, kicked: false,
        CMP: null, ATT: null, PASS_YDS: null, PASS_TD: null, INT_THROWN: null, SACKED: null,
        CAR: null, RUSH_YDS: null, RUSH_TD: null, LONG_RUSH: null,
        REC: null, REC_YDS: null, REC_TD: null, TGTS: null,
        FUM: null, FUM_LOST: null,
        TACKLES: null, SOLO: null, SACKS: null, TFL: null, PD: null, QB_HITS: null, DEF_TD: null,
        INT_CAUGHT: null, INT_TD: null,
        KR_TD: null, PR_TD: null,
        FGM: null, FGA: null, XPM: null, XPA: null, KICK_PTS: null,
      };
      byId.set(key, line);
    }
    return line;
  };

  for (const teamBlock of summary?.boxscore?.players ?? []) {
    for (const group of teamBlock?.statistics ?? []) {
      const groupName = String(group?.name ?? '');
      const keys: string[] = group?.keys ?? [];
      for (const a of group?.athletes ?? []) {
        const name = a?.athlete?.displayName ?? '';
        if (!name) continue;
        const stats: string[] = a?.stats ?? [];
        if (!stats.length) continue;
        const id = a?.athlete?.id ? String(a.athlete.id) : null;
        const get = (k: string) => {
          const i = keys.indexOf(k);
          return i >= 0 ? stats[i] : undefined;
        };
        const line = ensure(id, name);

        switch (groupName) {
          case 'passing': {
            line.passed = true;
            const [cmp, att] = slashPair(get('completions/passingAttempts'));
            line.CMP = cmp; line.ATT = att;
            line.PASS_YDS = num(get('passingYards'));
            line.PASS_TD = num(get('passingTouchdowns'));
            line.INT_THROWN = num(get('interceptions'));
            line.SACKED = dashLead(get('sacks-sackYardsLost'));
            break;
          }
          case 'rushing': {
            line.rushed = true;
            line.CAR = num(get('rushingAttempts'));
            line.RUSH_YDS = num(get('rushingYards'));
            line.RUSH_TD = num(get('rushingTouchdowns'));
            line.LONG_RUSH = num(get('longRushing'));
            break;
          }
          case 'receiving': {
            line.received = true;
            line.REC = num(get('receptions'));
            line.REC_YDS = num(get('receivingYards'));
            line.REC_TD = num(get('receivingTouchdowns'));
            line.TGTS = num(get('receivingTargets'));
            break;
          }
          case 'fumbles': {
            line.FUM = num(get('fumbles'));
            line.FUM_LOST = num(get('fumblesLost'));
            break;
          }
          case 'defensive': {
            line.defended = true;
            line.TACKLES = num(get('totalTackles'));
            line.SOLO = num(get('soloTackles'));
            line.SACKS = num(get('sacks'));
            line.TFL = num(get('tacklesForLoss'));
            line.PD = num(get('passesDefended'));
            line.QB_HITS = num(get('QBHits'));
            line.DEF_TD = num(get('defensiveTouchdowns'));
            break;
          }
          case 'interceptions': {
            // DEFENSIVE interceptions — same key name, different meaning.
            line.defended = true;
            line.INT_CAUGHT = num(get('interceptions'));
            line.INT_TD = num(get('interceptionTouchdowns'));
            break;
          }
          case 'kickReturns': {
            line.KR_TD = num(get('kickReturnTouchdowns'));
            break;
          }
          case 'puntReturns': {
            line.PR_TD = num(get('puntReturnTouchdowns'));
            break;
          }
          case 'kicking': {
            line.kicked = true;
            const [fgm, fga] = slashPair(get('fieldGoalsMade/fieldGoalAttempts'));
            const [xpm, xpa] = slashPair(get('extraPointsMade/extraPointAttempts'));
            line.FGM = fgm; line.FGA = fga; line.XPM = xpm; line.XPA = xpa;
            line.KICK_PTS = num(get('totalKickingPoints'));
            break;
          }
          default:
            break; // punting etc. — no props ride on them
        }
      }
    }
  }

  return [...byId.values()];
}

// prop_type → stat field. Types come from sbo-fetch-odds PROP_TYPE_MAP:
// pass_yards, rush_yards, rec_yards, pass_tds, anytime_td, receptions.
export function getNflPropValue(ps: NflStatLine, propType: string): number | null {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s-]/g, '_');

  switch (pt) {
    case 'pass_yards': case 'passing_yards': case 'player_pass_yds':
      return ps.passed ? ps.PASS_YDS : null;
    case 'pass_tds': case 'passing_touchdowns':
      return ps.passed ? ps.PASS_TD : null;
    case 'pass_completions': case 'completions':
      return ps.passed ? ps.CMP : null;
    case 'pass_attempts':
      return ps.passed ? ps.ATT : null;
    case 'interceptions_thrown':
      return ps.passed ? ps.INT_THROWN : null;

    case 'rush_yards': case 'rushing_yards': case 'player_rush_yds':
      return ps.rushed ? ps.RUSH_YDS : null;
    case 'rush_attempts': case 'carries':
      return ps.rushed ? ps.CAR : null;
    case 'longest_rush':
      return ps.rushed ? ps.LONG_RUSH : null;

    case 'rec_yards': case 'receiving_yards': case 'player_reception_yds':
      return ps.received ? ps.REC_YDS : null;
    case 'receptions':
      return ps.received ? ps.REC : null;
    case 'targets':
      return ps.received ? ps.TGTS : null;

    case 'rush_rec_yards': case 'rush_+_rec_yards':
      // Only meaningful when the player actually appears in both groups; a
      // player with rushes but no receiving line legitimately has 0 rec yards.
      if (!ps.rushed && !ps.received) return null;
      return (ps.RUSH_YDS ?? 0) + (ps.REC_YDS ?? 0);

    // anytime_td is a YES/NO market on the book side, not an over/under.
    // We return the COUNT of scoring touchdowns (rush + rec + return + def);
    // callers must compare it as `value >= 1`, not against a line.
    case 'anytime_td': case 'anytime_touchdown': {
      if (!ps.rushed && !ps.received && !ps.defended) return null;
      return (ps.RUSH_TD ?? 0) + (ps.REC_TD ?? 0) + (ps.KR_TD ?? 0) + (ps.PR_TD ?? 0) +
        (ps.DEF_TD ?? 0) + (ps.INT_TD ?? 0);
    }

    case 'tackles': case 'tackles_assists':
      return ps.defended ? ps.TACKLES : null;
    case 'sacks':
      return ps.defended ? ps.SACKS : null;
    case 'kicking_points':
      return ps.kicked ? ps.KICK_PTS : null;
    case 'field_goals': case 'field_goals_made':
      return ps.kicked ? ps.FGM : null;

    default:
      console.warn('UNMAPPED NFL PROP TYPE:', propType, '→ cleaned:', pt);
      return null;
  }
}

/** All 32 NFL teams (ESPN displayName is canonical). */
export const NFL_ALIASES: Record<string, string> = {
  'ari': 'Arizona Cardinals', 'arz': 'Arizona Cardinals', 'cardinals': 'Arizona Cardinals', 'arizona': 'Arizona Cardinals',
  'atl': 'Atlanta Falcons', 'falcons': 'Atlanta Falcons', 'atlanta': 'Atlanta Falcons',
  'bal': 'Baltimore Ravens', 'blt': 'Baltimore Ravens', 'ravens': 'Baltimore Ravens', 'baltimore': 'Baltimore Ravens',
  'buf': 'Buffalo Bills', 'bills': 'Buffalo Bills', 'buffalo': 'Buffalo Bills',
  'car': 'Carolina Panthers', 'panthers': 'Carolina Panthers', 'carolina': 'Carolina Panthers',
  'chi': 'Chicago Bears', 'bears': 'Chicago Bears', 'chicago': 'Chicago Bears',
  'cin': 'Cincinnati Bengals', 'bengals': 'Cincinnati Bengals', 'cincinnati': 'Cincinnati Bengals',
  'cle': 'Cleveland Browns', 'clv': 'Cleveland Browns', 'browns': 'Cleveland Browns', 'cleveland': 'Cleveland Browns',
  'dal': 'Dallas Cowboys', 'cowboys': 'Dallas Cowboys', 'dallas': 'Dallas Cowboys',
  'den': 'Denver Broncos', 'broncos': 'Denver Broncos', 'denver': 'Denver Broncos',
  'det': 'Detroit Lions', 'lions': 'Detroit Lions', 'detroit': 'Detroit Lions',
  'gb': 'Green Bay Packers', 'gnb': 'Green Bay Packers', 'packers': 'Green Bay Packers', 'green bay': 'Green Bay Packers',
  'hou': 'Houston Texans', 'hst': 'Houston Texans', 'texans': 'Houston Texans', 'houston': 'Houston Texans',
  'ind': 'Indianapolis Colts', 'colts': 'Indianapolis Colts', 'indianapolis': 'Indianapolis Colts',
  'jax': 'Jacksonville Jaguars', 'jac': 'Jacksonville Jaguars', 'jaguars': 'Jacksonville Jaguars', 'jacksonville': 'Jacksonville Jaguars',
  'kc': 'Kansas City Chiefs', 'kan': 'Kansas City Chiefs', 'chiefs': 'Kansas City Chiefs', 'kansas city': 'Kansas City Chiefs',
  'lv': 'Las Vegas Raiders', 'lvr': 'Las Vegas Raiders', 'oak': 'Las Vegas Raiders', 'raiders': 'Las Vegas Raiders', 'las vegas': 'Las Vegas Raiders',
  'lac': 'Los Angeles Chargers', 'chargers': 'Los Angeles Chargers', 'los angeles chargers': 'Los Angeles Chargers',
  'lar': 'Los Angeles Rams', 'rams': 'Los Angeles Rams', 'los angeles rams': 'Los Angeles Rams',
  'mia': 'Miami Dolphins', 'dolphins': 'Miami Dolphins', 'miami': 'Miami Dolphins',
  'min': 'Minnesota Vikings', 'vikings': 'Minnesota Vikings', 'minnesota': 'Minnesota Vikings',
  'ne': 'New England Patriots', 'nwe': 'New England Patriots', 'patriots': 'New England Patriots', 'new england': 'New England Patriots',
  'no': 'New Orleans Saints', 'nor': 'New Orleans Saints', 'saints': 'New Orleans Saints', 'new orleans': 'New Orleans Saints',
  'nyg': 'New York Giants', 'giants': 'New York Giants', 'new york giants': 'New York Giants',
  'nyj': 'New York Jets', 'jets': 'New York Jets', 'new york jets': 'New York Jets',
  'phi': 'Philadelphia Eagles', 'eagles': 'Philadelphia Eagles', 'philadelphia': 'Philadelphia Eagles',
  'pit': 'Pittsburgh Steelers', 'steelers': 'Pittsburgh Steelers', 'pittsburgh': 'Pittsburgh Steelers',
  'sf': 'San Francisco 49ers', 'sfo': 'San Francisco 49ers', '49ers': 'San Francisco 49ers', 'niners': 'San Francisco 49ers', 'san francisco': 'San Francisco 49ers',
  'sea': 'Seattle Seahawks', 'seahawks': 'Seattle Seahawks', 'seattle': 'Seattle Seahawks',
  'tb': 'Tampa Bay Buccaneers', 'tam': 'Tampa Bay Buccaneers', 'buccaneers': 'Tampa Bay Buccaneers', 'bucs': 'Tampa Bay Buccaneers', 'tampa bay': 'Tampa Bay Buccaneers',
  'ten': 'Tennessee Titans', 'titans': 'Tennessee Titans', 'tennessee': 'Tennessee Titans',
  'wsh': 'Washington Commanders', 'was': 'Washington Commanders', 'commanders': 'Washington Commanders', 'washington': 'Washington Commanders',
};

export const NFL_GRADING: SportGradingConfig<NflStatLine> = {
  sportKey: 'nfl',
  espnPath: 'football/nfl',
  aliases: NFL_ALIASES,
  buildStatLines: buildNflStatLines,
  getPropValue: getNflPropValue,
};

// ═══════════════════════════════════════════════════════════════
// CONFIG 4 — NHL (Stage 4)
// ═══════════════════════════════════════════════════════════════
// PROBED LIVE against event 401803539 (VAN @ COL, 2026-04-01). The
// skater/goalie split IS real, and mirrors MLB's batting/pitching split
// in SHAPE only. Real observed groups:
//   forwards / defenses / skaters  (identical key list; 'skaters' was empty
//     on the probed game — it is a rollup slot, so all three are read and
//     merged by athlete id, which also makes double-counting impossible)
//   goalies  (a completely different key list)
// skater keys: ['blockedShots','hits','takeaways','plusMinus','timeOnIce',
//   'powerPlayTimeOnIce','shortHandedTimeOnIce','evenStrengthTimeOnIce','shifts',
//   'goals','ytdGoals','assists','shotsTotal','shotsMissed','shootoutGoals',
//   'faceoffsWon','faceoffsLost','faceoffPercent','giveaways','penalties','penaltyMinutes']
// goalie keys: ['goalsAgainst','shotsAgainst','shootoutSaves','shootoutShotsAgainst',
//   'saves','savePct','evenStrengthSaves','powerPlaySaves','shortHandedSaves',
//   'timeOnIce','ytdGoals','penaltyMinutes']
// TRAP: 'ytdGoals' is a SEASON-TO-DATE total sitting inside a per-game box
// score. It is deliberately NOT parsed — reading it would poison every
// rollup. Only 'goals' is the in-game value.
// VERIFIED: summing skater 'goals' per team reproduced the final score
// exactly (VAN 8, COL 6), so the key/stat index alignment is correct.
// timeOnIce arrives as "19:48" and is converted to decimal minutes.

export type NhlStatLine = StatLine & {
  skated: boolean; goalie: boolean;
  // skater
  G: number | null; A: number | null; SOG: number | null; SHOTS_MISSED: number | null;
  BLK: number | null; HITS: number | null; TK: number | null; GV: number | null;
  PLUS_MINUS: number | null; PIM: number | null; SHIFTS: number | null;
  FOW: number | null; FOL: number | null; TOI: number | null;
  // goalie
  SAVES: number | null; SHOTS_AGAINST: number | null; GOALS_AGAINST: number | null;
  SAVE_PCT: number | null; G_TOI: number | null;
};

/** "19:48" → 19.8 decimal minutes; unparseable → null. */
function toiToMinutes(v: any): number | null {
  const m = String(v ?? '').trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return num(v);
  const mins = Number(m[1]); const secs = Number(m[2]);
  if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
  return Math.round((mins + secs / 60) * 100) / 100;
}

/** ".800" or "0.800" → 0.8 */
function pct(v: any): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.startsWith('.') ? `0${s}` : s);
  return Number.isFinite(n) ? n : null;
}

const NHL_SKATER_GROUPS = new Set(['forwards', 'defenses', 'skaters']);

export function buildNhlStatLines(summary: any): NhlStatLine[] {
  const byId = new Map<string, NhlStatLine>();

  const ensure = (id: string | null, name: string): NhlStatLine => {
    const key = id ?? `name:${name.toLowerCase()}`;
    let line = byId.get(key);
    if (!line) {
      line = {
        Name: name, athleteId: id, skated: false, goalie: false,
        G: null, A: null, SOG: null, SHOTS_MISSED: null,
        BLK: null, HITS: null, TK: null, GV: null,
        PLUS_MINUS: null, PIM: null, SHIFTS: null,
        FOW: null, FOL: null, TOI: null,
        SAVES: null, SHOTS_AGAINST: null, GOALS_AGAINST: null, SAVE_PCT: null, G_TOI: null,
      };
      byId.set(key, line);
    }
    return line;
  };

  for (const teamBlock of summary?.boxscore?.players ?? []) {
    for (const group of teamBlock?.statistics ?? []) {
      const groupName = String(group?.name ?? '');
      const isSkater = NHL_SKATER_GROUPS.has(groupName);
      const isGoalie = groupName === 'goalies';
      if (!isSkater && !isGoalie) continue;
      const keys: string[] = group?.keys ?? [];

      for (const a of group?.athletes ?? []) {
        const name = a?.athlete?.displayName ?? '';
        if (!name) continue;
        const stats: string[] = a?.stats ?? [];
        // Scratches arrive with an empty stats array — skip, never zero-fill.
        if (!stats.length) continue;
        const id = a?.athlete?.id ? String(a.athlete.id) : null;
        const get = (k: string) => {
          const i = keys.indexOf(k);
          return i >= 0 ? stats[i] : undefined;
        };
        const line = ensure(id, name);

        if (isSkater) {
          // 'skaters' overlaps forwards+defenses on some payloads; writing the
          // same values into the same merged line makes that a no-op.
          line.skated = true;
          line.G = num(get('goals'));            // NOT ytdGoals
          line.A = num(get('assists'));
          line.SOG = num(get('shotsTotal'));
          line.SHOTS_MISSED = num(get('shotsMissed'));
          line.BLK = num(get('blockedShots'));
          line.HITS = num(get('hits'));
          line.TK = num(get('takeaways'));
          line.GV = num(get('giveaways'));
          line.PLUS_MINUS = num(get('plusMinus'));
          line.PIM = num(get('penaltyMinutes'));
          line.SHIFTS = num(get('shifts'));
          line.FOW = num(get('faceoffsWon'));
          line.FOL = num(get('faceoffsLost'));
          line.TOI = toiToMinutes(get('timeOnIce'));
        } else {
          line.goalie = true;
          line.SAVES = num(get('saves'));
          line.SHOTS_AGAINST = num(get('shotsAgainst'));
          line.GOALS_AGAINST = num(get('goalsAgainst'));
          line.SAVE_PCT = pct(get('savePct'));
          line.G_TOI = toiToMinutes(get('timeOnIce'));
        }
      }
    }
  }

  return [...byId.values()];
}

// prop_type → stat field. Types come from sbo-fetch-odds PROP_TYPE_MAP:
// goals, assists, shots, saves.
export function getNhlPropValue(ps: NhlStatLine, propType: string): number | null {
  const pt = (propType || '').toLowerCase().trim().replace(/[\s-]/g, '_');

  switch (pt) {
    // skater
    case 'goals': case 'player_goals':
      return ps.skated ? ps.G : null;
    case 'assists': case 'player_assists':
      return ps.skated ? ps.A : null;
    case 'points': case 'player_points':
      return ps.skated ? sumOrNull(ps.G, ps.A) : null;
    case 'shots': case 'shots_on_goal': case 'player_shots_on_goal':
      return ps.skated ? ps.SOG : null;
    case 'blocked_shots': case 'blocks':
      return ps.skated ? ps.BLK : null;
    case 'hits':
      return ps.skated ? ps.HITS : null;
    case 'power_play_points':
      // ESPN's box score exposes PP time on ice but NOT power-play points.
      // Returning null keeps these pending instead of grading them wrong.
      return null;

    // goalie
    case 'saves': case 'player_total_saves': case 'goalie_saves':
      return ps.goalie ? ps.SAVES : null;
    case 'goals_against':
      return ps.goalie ? ps.GOALS_AGAINST : null;
    case 'shots_against':
      return ps.goalie ? ps.SHOTS_AGAINST : null;

    default:
      console.warn('UNMAPPED NHL PROP TYPE:', propType, '→ cleaned:', pt);
      return null;
  }
}

/** All 32 NHL teams (ESPN displayName is canonical). */
export const NHL_ALIASES: Record<string, string> = {
  'ana': 'Anaheim Ducks', 'ducks': 'Anaheim Ducks', 'anaheim': 'Anaheim Ducks',
  'ari': 'Utah Mammoth', 'uta': 'Utah Mammoth', 'utah': 'Utah Mammoth', 'mammoth': 'Utah Mammoth',
  'bos': 'Boston Bruins', 'bruins': 'Boston Bruins', 'boston': 'Boston Bruins',
  'buf': 'Buffalo Sabres', 'sabres': 'Buffalo Sabres', 'buffalo': 'Buffalo Sabres',
  'cgy': 'Calgary Flames', 'cal': 'Calgary Flames', 'flames': 'Calgary Flames', 'calgary': 'Calgary Flames',
  'car': 'Carolina Hurricanes', 'hurricanes': 'Carolina Hurricanes', 'canes': 'Carolina Hurricanes', 'carolina': 'Carolina Hurricanes',
  'chi': 'Chicago Blackhawks', 'blackhawks': 'Chicago Blackhawks', 'chicago': 'Chicago Blackhawks',
  'col': 'Colorado Avalanche', 'avalanche': 'Colorado Avalanche', 'avs': 'Colorado Avalanche', 'colorado': 'Colorado Avalanche',
  'cbj': 'Columbus Blue Jackets', 'clb': 'Columbus Blue Jackets', 'blue jackets': 'Columbus Blue Jackets', 'columbus': 'Columbus Blue Jackets',
  'dal': 'Dallas Stars', 'stars': 'Dallas Stars', 'dallas': 'Dallas Stars',
  'det': 'Detroit Red Wings', 'red wings': 'Detroit Red Wings', 'detroit': 'Detroit Red Wings',
  'edm': 'Edmonton Oilers', 'oilers': 'Edmonton Oilers', 'edmonton': 'Edmonton Oilers',
  'fla': 'Florida Panthers', 'panthers': 'Florida Panthers', 'florida': 'Florida Panthers',
  'la': 'Los Angeles Kings', 'lak': 'Los Angeles Kings', 'kings': 'Los Angeles Kings', 'los angeles': 'Los Angeles Kings',
  'min': 'Minnesota Wild', 'wild': 'Minnesota Wild', 'minnesota': 'Minnesota Wild',
  'mtl': 'Montreal Canadiens', 'mon': 'Montreal Canadiens', 'canadiens': 'Montreal Canadiens', 'habs': 'Montreal Canadiens', 'montreal': 'Montreal Canadiens',
  'nsh': 'Nashville Predators', 'predators': 'Nashville Predators', 'preds': 'Nashville Predators', 'nashville': 'Nashville Predators',
  'nj': 'New Jersey Devils', 'njd': 'New Jersey Devils', 'devils': 'New Jersey Devils', 'new jersey': 'New Jersey Devils',
  'nyi': 'New York Islanders', 'islanders': 'New York Islanders', 'isles': 'New York Islanders',
  'nyr': 'New York Rangers', 'rangers': 'New York Rangers',
  'ott': 'Ottawa Senators', 'senators': 'Ottawa Senators', 'sens': 'Ottawa Senators', 'ottawa': 'Ottawa Senators',
  'phi': 'Philadelphia Flyers', 'flyers': 'Philadelphia Flyers', 'philadelphia': 'Philadelphia Flyers',
  'pit': 'Pittsburgh Penguins', 'penguins': 'Pittsburgh Penguins', 'pens': 'Pittsburgh Penguins', 'pittsburgh': 'Pittsburgh Penguins',
  'sj': 'San Jose Sharks', 'sjs': 'San Jose Sharks', 'sharks': 'San Jose Sharks', 'san jose': 'San Jose Sharks',
  'sea': 'Seattle Kraken', 'kraken': 'Seattle Kraken', 'seattle': 'Seattle Kraken',
  'stl': 'St. Louis Blues', 'blues': 'St. Louis Blues', 'st louis': 'St. Louis Blues', 'st. louis': 'St. Louis Blues',
  'tb': 'Tampa Bay Lightning', 'tbl': 'Tampa Bay Lightning', 'lightning': 'Tampa Bay Lightning', 'bolts': 'Tampa Bay Lightning', 'tampa bay': 'Tampa Bay Lightning',
  'tor': 'Toronto Maple Leafs', 'maple leafs': 'Toronto Maple Leafs', 'leafs': 'Toronto Maple Leafs', 'toronto': 'Toronto Maple Leafs',
  'van': 'Vancouver Canucks', 'canucks': 'Vancouver Canucks', 'vancouver': 'Vancouver Canucks',
  'vgk': 'Vegas Golden Knights', 'vgs': 'Vegas Golden Knights', 'golden knights': 'Vegas Golden Knights', 'vegas': 'Vegas Golden Knights',
  'wsh': 'Washington Capitals', 'was': 'Washington Capitals', 'capitals': 'Washington Capitals', 'caps': 'Washington Capitals',
  'wpg': 'Winnipeg Jets', 'win': 'Winnipeg Jets', 'jets': 'Winnipeg Jets', 'winnipeg': 'Winnipeg Jets',
};

export const NHL_GRADING: SportGradingConfig<NhlStatLine> = {
  sportKey: 'nhl',
  espnPath: 'hockey/nhl',
  aliases: NHL_ALIASES,
  buildStatLines: buildNhlStatLines,
  getPropValue: getNhlPropValue,
};


// ═══════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════
// Adding a sport here is the ONLY change needed to light up the stats
// brain (sbo-get-player-context) and stats ingestion (sbo-ingest-player-stats,
// which fans out over GRADED_SPORT_KEYS from sbo-day-engine).
export const GRADING_CONFIGS: Record<string, SportGradingConfig<any>> = {
  mlb: MLB_GRADING,
  wnba: WNBA_GRADING,
  nfl: NFL_GRADING,
  nhl: NHL_GRADING,
};


/** Sports that currently have a working free-ESPN grading path. */
export const GRADED_SPORT_KEYS: string[] = Object.keys(GRADING_CONFIGS);

export function getGradingConfig(sportKey: string): SportGradingConfig<any> | null {
  return GRADING_CONFIGS[(sportKey || '').toLowerCase()] ?? null;
}

// ═══════════════════════════════════════════════════════════════
// LEGACY (PRE-ESPN) SCORE/STAT SOURCES
// ═══════════════════════════════════════════════════════════════
// Deliberately a SEPARATE registry from GRADING_CONFIGS: NBA has no
// free-ESPN grading path yet, and adding it to GRADING_CONFIGS would
// silently enrol NBA in the GRADED_SPORT_KEYS fanout used by
// sbo-ingest-player-stats and sbo-day-engine. Keeping it here declares
// the vendor path as data without changing any other system's behavior.
//
// A sport absent from this map CANNOT reach a vendor endpoint.
export const LEGACY_SCORE_SOURCES: Record<string, LegacyScoreSource> = {
  nba: {
    provider: 'sportsdataio',
    apiKeyEnv: 'SPORTSDATAIO_API_KEY',
    scoresUrl: (dateStr, key) =>
      `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${dateStr}?key=${key}`,
    playerStatsUrl: (dateStr, key) =>
      `https://api.sportsdata.io/v3/nba/stats/json/PlayerGameStatsByDate/${dateStr}?key=${key}`,
    minScore: 60,
  },
};

export function getLegacyScoreSource(sportKey: string): LegacyScoreSource | null {
  return LEGACY_SCORE_SOURCES[(sportKey || '').toLowerCase()] ?? null;
}



// ═══════════════════════════════════════
// SEASON CALENDAR (cross-calendar-year aware)
// ═══════════════════════════════════════
// Sports whose season spans two calendar years, keyed by the month
// (1-12) the season starts in. The season LABEL is the year it starts:
// NFL "2025" = Sep 2025 → Feb 2026.
const SEASON_START_MONTH: Record<string, number> = {
  nfl: 8,   // Aug (preseason) → Feb
  nhl: 9,   // Sep → Jun
  nba: 9,   // Sep → Jun
};

export function seasonSpansCalendarYear(sportKey: string): boolean {
  return SEASON_START_MONTH[(sportKey || '').toLowerCase()] !== undefined;
}

/** The season label a given YYYY-MM-DD game belongs to, for this sport. */
export function seasonForDate(sportKey: string, dateStr: string): string {
  const start = SEASON_START_MONTH[(sportKey || '').toLowerCase()];
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  if (!start) return String(year);
  return String(month >= start ? year : year - 1);
}

/** Inclusive [from, to] game_date window covering a whole season. */
export function seasonWindow(
  sportKey: string,
  season: string,
): { from: string; to: string } {
  const start = SEASON_START_MONTH[(sportKey || '').toLowerCase()];
  const y = Number(season);
  if (!start) return { from: `${y}-01-01`, to: `${y}-12-31` };
  const mm = String(start).padStart(2, '0');
  const endMm = String(start - 1).padStart(2, '0');
  const endDay = start - 1 === 2 ? '28' : '31'; // never lands on Feb in practice
  return { from: `${y}-${mm}-01`, to: `${y + 1}-${endMm}-${endDay}` };
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
