import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════
// NORMALIZATION LAYER
// ═══════════════════════════════════════════════════════════════
// The stat vocabulary lives in ONE place: ../_shared/statNormalize.ts.
// This file used to carry a mirrored copy of STAT_MAP/normalizeStat, which
// drifted. Same discipline as _shared/perPickScore.ts — import, never copy.
export { normalizeStat } from '../_shared/statNormalize.ts';
import {
  normalizeStat,
  marketPropCandidates,
  lineTolerance,
  UNMATCHABLE,
} from '../_shared/statNormalize.ts';


function normalizePlayer(name: string): string {
  if (!name) return '';
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics (Jokić → Jokic)
    .replace(/[^a-z\s]/g, '')         // remove punctuation
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '') // remove suffixes
    .replace(/\s+/g, ' ').trim();
}

// ═══════════════════════════════════════════════════════════════
// DICE COEFFICIENT (Bigram Similarity)
// ═══════════════════════════════════════════════════════════════

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const bi of ba) { if (bb.has(bi)) intersection++; }
  return (2 * intersection) / (ba.size + bb.size);
}

// ═══════════════════════════════════════════════════════════════
// MULTI-LAYER MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════

interface MatchResult {
  propId: string;
  score: number;
  method: 'exact' | 'normalized' | 'fuzzy' | 'context';
}

// Props are pre-normalized once at fetch time and bucketed by normalized last
// name. Scanning all candidates per pick is O(picks x props) and exhausts the
// worker's CPU/memory budget at real volumes (500 x 5,000+).
export interface IndexedProp {
  id: string;
  rawName: string;
  normName: string;
  lastName: string;
  stat: string;
  line: number | null;
  date: string | null;
}

export function buildPropIndex(props: any[]): Map<string, IndexedProp[]> {
  const index = new Map<string, IndexedProp[]>();
  for (const prop of props) {
    const rawName = (prop.player_name || '').trim();
    if (!rawName) continue;
    const normName = normalizePlayer(rawName);
    const words = normName.split(' ').filter(Boolean);
    if (words.length === 0) continue;
    const lastName = words[words.length - 1];
    const entry: IndexedProp = {
      id: prop.id,
      rawName,
      normName,
      lastName,
      stat: normalizeStat(prop.prop_type || prop.stat_type || ''),
      line: prop.line == null ? null : Number(prop.line),
      date: prop.game_date ?? null,
    };
    if (!index.has(lastName)) index.set(lastName, []);
    index.get(lastName)!.push(entry);
  }
  return index;
}

// Why a pick did NOT match. Written to sbo_external_match_logs.match_details
// so the miss distribution is measurable instead of guessed. Ordered by the
// stage at which the pick fell out of the funnel.
export type MissReason =
  | 'NO_PLAYER_NAME'      // game-level bet (moneyline/spread/total) — no player prop can exist
  | 'UNMATCHABLE_STAT'    // stat has no market counterpart (pitcher outs, NRFI)
  | 'NO_CANDIDATE'        // no prop row anywhere for that surname
  | 'NAME_FUZZY_FAIL'     // surname bucket exists but no name cleared the similarity bar
  | 'DATE_MISMATCH'       // name matched, but no prop within ±1 day
  | 'PROP_TYPE_MISMATCH'  // name + date matched, but that stat was never priced for them
  | 'LINE_MISMATCH';      // everything matched except the line

export interface MatchAttempt {
  result: MatchResult | null;
  reason: MissReason | null;
  candidateCount: number;
}

function matchPick(pick: any, index: Map<string, IndexedProp[]>): MatchAttempt {
  const pickName = (pick.player_name || '').trim();
  const pickStat = normalizeStat(pick.prop_type || '');
  if (!pickName) return { result: null, reason: 'NO_PLAYER_NAME', candidateCount: 0 };
  // Stats with no market counterpart (MLB pitcher outs / innings) must never match.
  if (pickStat === UNMATCHABLE) return { result: null, reason: 'UNMATCHABLE_STAT', candidateCount: 0 };
  // Accepted market spellings for this pick's stat (e.g. strikeouts → strikeouts_p).
  const acceptedStats = new Set(marketPropCandidates(pick.prop_type || ''));
  const pickLine = pick.line == null ? null : Number(pick.line);
  const pickDate = pick.game_date;
  const normPick = normalizePlayer(pickName);
  const pickWords = normPick.split(' ').filter(Boolean);
  if (pickWords.length === 0) return { result: null, reason: 'NO_PLAYER_NAME', candidateCount: 0 };

  // Only props sharing the pick's normalized last name are plausible candidates.
  const candidates = index.get(pickWords[pickWords.length - 1]) ?? [];
  if (candidates.length === 0) return { result: null, reason: 'NO_CANDIDATE', candidateCount: 0 };

  let bestMatch: MatchResult | null = null;
  // Furthest stage reached across all candidates — this is what makes the miss
  // reason honest (a pick that cleared name+date for one prop is a prop_type
  // miss, not a name miss, even if other candidates failed earlier).
  let reachedName = false, reachedDate = false, reachedStat = false;

  for (const prop of candidates) {
    const propName = prop.rawName;
    const propStat = prop.stat;
    const propLine = prop.line;
    const propDate = prop.date;

    // Name gate first so the funnel stages are attributable.
    const normProp = prop.normName;
    const exact = pickName.toLowerCase() === propName.toLowerCase();
    const normalized = normPick === normProp;
    const nameSim = exact || normalized ? 1 : diceCoefficient(normPick, normProp);
    const propWords = normProp.split(' ').filter(Boolean);
    const contextName = pickWords.length >= 2 && propWords.length >= 2 &&
      pickWords[pickWords.length - 1] === propWords[propWords.length - 1] &&
      pickWords[0][0] === propWords[0][0];
    if (!exact && !normalized && nameSim < 0.80 && !contextName) continue;
    reachedName = true;

    // Date check: must be within ±1 day
    if (pickDate && propDate) {
      const d1 = new Date(pickDate).getTime();
      const d2 = new Date(propDate).getTime();
      if (Math.abs(d1 - d2) > 86400000 * 1.5) continue;
    }
    reachedDate = true;

    // Stat type must match one of the accepted market spellings
    if (pickStat && propStat && acceptedStats.size && !acceptedStats.has(propStat)) continue;
    reachedStat = true;

    // Line tolerance: max(1.0, 4% of line) — flat ±1.0 was too tight on combos
    if (pickLine != null && propLine != null &&
        Math.abs(pickLine - propLine) > lineTolerance(pickLine)) continue;

    let score: number;
    let method: MatchResult['method'];
    if (exact) { score = 100; method = 'exact'; }
    else if (normalized) { score = 95; method = 'normalized'; }
    else if (nameSim >= 0.80) { score = Math.round(80 + nameSim * 15); method = 'fuzzy'; }
    else {
      const dateMatch = pickDate === propDate ? 1 : 0.5;
      const statMatch = acceptedStats.has(propStat) ? 1 : 0;
      score = Math.round((0.7 * 0.5 + 0.2 * dateMatch + 0.1 * statMatch) * 100);
      method = 'context';
      if (score < 70) continue;
    }
    if (!bestMatch || score > bestMatch.score) bestMatch = { propId: prop.id, score, method };
  }

  if (bestMatch) return { result: bestMatch, reason: null, candidateCount: candidates.length };
  const reason: MissReason = !reachedName ? 'NAME_FUZZY_FAIL'
    : !reachedDate ? 'DATE_MISMATCH'
    : !reachedStat ? 'PROP_TYPE_MISMATCH'
    : 'LINE_MISMATCH';
  return { result: null, reason, candidateCount: candidates.length };
}


// ═══════════════════════════════════════════════════════════════
// GRADING ENGINE
// ═══════════════════════════════════════════════════════════════

function calcGrade(winRate: number, totalPicks: number, hotStreak: number, coldStreak: number): string {
  if (totalPicks < 5) return 'D'; // not enough data
  let grade = 'D';
  if (winRate >= 60) grade = 'A';
  else if (winRate >= 55) grade = 'B';
  else if (winRate >= 50) grade = 'C';
  // Streak modifiers
  if (hotStreak >= 5 && grade !== 'A') {
    grade = grade === 'D' ? 'C' : grade === 'C' ? 'B' : 'A';
  }
  if (coldStreak >= 5 && grade !== 'D') {
    grade = grade === 'A' ? 'B' : grade === 'B' ? 'C' : 'D';
  }
  return grade;
}

function calcStreaks(results: string[]): { hot: number; cold: number } {
  let hot = 0, cold = 0;
  // Count current streak from most recent
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === 'won') {
      if (cold > 0) break;
      hot++;
    } else if (results[i] === 'lost') {
      if (hot > 0) break;
      cold++;
    }
  }
  return { hot, cold };
}

function calcWeight(grade: string, roi: number): number {
  const gradeMultiplier: Record<string, number> = { A: 1.5, B: 1.2, C: 1.0, D: 0.6 };
  const roiMultiplier = roi > 10 ? 1.3 : roi > 0 ? 1.1 : roi > -10 ? 0.9 : 0.7;
  return Math.round((gradeMultiplier[grade] || 1.0) * roiMultiplier * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};
    const mode = body.mode || 'full'; // 'match', 'resolve', 'grade', 'full'

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let matched = 0, resolved = 0, graded = 0;
    const errors: string[] = [];
    const matchLogs: any[] = [];

    // ── MATCH ──
    // dry_run: compute the full funnel and return the miss distribution
    // WITHOUT writing matched_prop_id or match logs. This is how BUG-03 is
    // measured between attempts instead of guessed at.
    const dryRun = body.dry_run === true;
    const missReasons: Record<string, number> = {};
    let gameLevelSkipped = 0;
    if (mode === 'match' || mode === 'full') {
      // Full population, paginated. The old flat .limit(1000) silently hid the
      // tail of the backlog, so the "0.96% matched" figure was measured against
      // an arbitrary slice rather than the real denominator.
      const unmatched: any[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data: page, error: pageErr } = await supabase
          .from('sbo_capper_picks')
          .select('id, player_name, prop_type, line, game_date, sport, direction')
          .is('matched_prop_id', null)
          .not('player_name', 'is', null)
          // Newest first: props only exist for recent dates, so the early pages
          // carry the picks that can actually match.
          .order('game_date', { ascending: false })
          .range(from, from + 999);
        if (pageErr) { errors.push(`unmatched page ${from}: ${pageErr.message}`); break; }
        if (!page || page.length === 0) break;
        unmatched.push(...page);
        if (page.length < 1000) break;
      }

      // Game-level picks can never match a player prop. Counted, not scanned,
      // so the funnel denominator is honest.
      const { count: noNameCount } = await supabase
        .from('sbo_capper_picks')
        .select('id', { count: 'exact', head: true })
        .is('matched_prop_id', null)
        .is('player_name', null);
      gameLevelSkipped = noNameCount ?? 0;

      if (unmatched.length > 0) {
        const dates = [...new Set(unmatched.map(p => p.game_date).filter(Boolean))];
        // Also include ±1 day for each date
        const expandedDates = new Set<string>();
        for (const d of dates) {
          expandedDates.add(d);
          const dt = new Date(d);
          expandedDates.add(new Date(dt.getTime() - 86400000).toISOString().slice(0, 10));
          expandedDates.add(new Date(dt.getTime() + 86400000).toISOString().slice(0, 10));
        }

        let allProps: any[] = [];
        for (const d of expandedDates) {
          // Busy slates exceed a single PostgREST page — paginate or candidates
          // get silently truncated.
          for (let from = 0; from < 5000; from += 1000) {
            const { data: props } = await supabase
              .from('sbo_player_props')
              .select('id, player_name, prop_type, line, game_date, sport_key')
              .eq('game_date', d)
              .order('id', { ascending: true })
              .range(from, from + 999);
            if (!props || props.length === 0) break;
            allProps.push(...props);
            if (props.length < 1000) break;
          }
        }

        console.log(`[match] ${unmatched.length} unmatched, ${allProps.length} candidate props, dry_run=${dryRun}`);

        const propIndex = buildPropIndex(allProps);
        allProps = [];
        const toLink: { id: string; propId: string }[] = [];

        for (const pick of unmatched) {
          if (!pick.player_name) continue;
          const attempt = matchPick(pick, propIndex);
          const result = attempt.result;

          if (result && result.score >= 70) {
            const status = result.score >= 85 ? 'matched' : 'needs_review';

            // Log match
            matchLogs.push({
              pick_id: pick.id,
              external_result_id: result.propId,
              match_type: result.method,
              match_confidence: result.score,
              match_details: { method: result.method, score: result.score, status },
              result: status,
            });

            if (status === 'matched') {
              toLink.push({ id: pick.id, propId: result.propId });
              matched++;
            }
          } else {
            const reason = attempt.reason ?? 'LINE_MISMATCH';
            missReasons[reason] = (missReasons[reason] || 0) + 1;
            // Unmatched attempts are logged too — without them the funnel has
            // no denominator and every regression looks like noise.
            matchLogs.push({
              pick_id: pick.id,
              external_result_id: null,
              match_type: 'none',
              match_confidence: 0,
              match_details: {
                status: 'unmatched',
                reason,
                candidate_count: attempt.candidateCount,
                pick_stat: pick.prop_type ?? null,
                pick_date: pick.game_date ?? null,
              },
              result: 'unmatched',
            });
          }
        }

        if (!dryRun) {
          // Persist links in bounded batches rather than one round trip per pick.
          for (let i = 0; i < toLink.length; i += 25) {
            const chunk = toLink.slice(i, i + 25);
            await Promise.all(chunk.map((l) =>
              supabase.from('sbo_capper_picks')
                .update({ matched_prop_id: l.propId })
                .eq('id', l.id)
            ));
          }

          // Batch insert match logs
          for (let i = 0; i < matchLogs.length; i += 200) {
            await supabase.from('sbo_external_match_logs').insert(matchLogs.slice(i, i + 200));
          }
        }
        console.log(`[match] ${matched} auto-matched of ${unmatched.length}; misses=${JSON.stringify(missReasons)}`);
      }
    }


    // ── RESOLVE ──
    if (mode === 'resolve' || mode === 'full') {
      const { data: pending } = await supabase
        .from('sbo_capper_picks')
        .select('id, capper_id, matched_prop_id, direction, line, prop_type')
        .eq('result', 'pending')
        .not('matched_prop_id', 'is', null)
        .limit(500);

      if (pending && pending.length > 0) {
        const propIds = [...new Set(pending.map(p => p.matched_prop_id).filter(Boolean))];
        let resolvedProps: any[] = [];
        for (let i = 0; i < propIds.length; i += 50) {
          const chunk = propIds.slice(i, i + 50);
          const { data: props } = await supabase.from('sbo_player_props')
            .select('id, actual_value, verdict, line').in('id', chunk);
          if (props) resolvedProps.push(...props);
        }
        const propMap = new Map(resolvedProps.map(p => [p.id, p]));

        for (const pick of pending) {
          const prop = propMap.get(pick.matched_prop_id);
          if (!prop || prop.actual_value == null) continue;

          const pickLine = pick.line ?? prop.line;
          const dir = (pick.direction || '').toUpperCase();
          let result: string;

          if (prop.actual_value === pickLine) result = 'push';
          else if (['OVER', 'MORE', 'YES'].includes(dir)) result = prop.actual_value > pickLine ? 'won' : 'lost';
          else if (['UNDER', 'LESS', 'NO'].includes(dir)) result = prop.actual_value < pickLine ? 'won' : 'lost';
          else result = prop.verdict === 'hit' ? 'won' : 'lost';

          const { error } = await supabase.from('sbo_capper_picks').update({ result }).eq('id', pick.id);
          if (!error) resolved++;
        }
        console.log(`[resolve] ${resolved}/${pending.length}`);
      }
    }

    // ── GRADE + ROI ──
    if (mode === 'grade' || mode === 'full') {
      const { data: allCappers } = await supabase.from('sbo_cappers').select('id, name');
      if (allCappers) {
        for (const capper of allCappers) {
          const { data: picks } = await supabase.from('sbo_capper_picks')
            .select('result, sport, prop_type, bet_type, game_date')
            .eq('capper_id', capper.id)
            .order('game_date', { ascending: true });
          if (!picks || picks.length === 0) continue;

          const resolvedPicks = picks.filter(p => p.result === 'won' || p.result === 'lost' || p.result === 'push');
          const wins = resolvedPicks.filter(p => p.result === 'won').length;
          const losses = resolvedPicks.filter(p => p.result === 'lost').length;
          const pushes = resolvedPicks.filter(p => p.result === 'push').length;
          const total = wins + losses;
          const winRate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
          const totalProfit = wins * 0.909 - losses; // -110 odds
          const roi = total > 0 ? Math.round((totalProfit / total) * 10000) / 100 : 0;

          // Streaks
          const resultSeq = resolvedPicks.map(p => p.result!);
          const { hot, cold } = calcStreaks(resultSeq);
          const grade = calcGrade(winRate, total, hot, cold);
          const weight = calcWeight(grade, roi);

          // Last 7 / Last 30
          const now = Date.now();
          const d7 = resolvedPicks.filter(p => (now - new Date(p.game_date).getTime()) <= 7 * 86400000);
          const d30 = resolvedPicks.filter(p => (now - new Date(p.game_date).getTime()) <= 30 * 86400000);
          const l7w = d7.filter(p => p.result === 'won').length;
          const l7t = d7.filter(p => p.result !== 'push').length;
          const l30w = d30.filter(p => p.result === 'won').length;
          const l30t = d30.filter(p => p.result !== 'push').length;

          // Best market
          const marketMap = new Map<string, { w: number; t: number }>();
          for (const p of resolvedPicks) {
            const mkt = p.prop_type || p.bet_type || 'unknown';
            if (!marketMap.has(mkt)) marketMap.set(mkt, { w: 0, t: 0 });
            const m = marketMap.get(mkt)!;
            m.t++;
            if (p.result === 'won') m.w++;
          }
          let bestMkt = '—', bestWR = 0;
          for (const [k, v] of marketMap) {
            if (v.t >= 2 && (v.w / v.t) > bestWR) { bestWR = v.w / v.t; bestMkt = k; }
          }

          // Update cappers table
          await supabase.from('sbo_cappers').update({
            total_picks: picks.length, win_rate: winRate, roi_pct: roi,
            grade, confidence_grade: grade, capper_weight: weight,
            hot_streak: hot, cold_streak: cold, best_market: bestMkt,
            updated_at: new Date().toISOString(),
          }).eq('id', capper.id);

          // Upsert performance by sport
          const sportGroups = new Map<string, any[]>();
          for (const p of resolvedPicks) {
            const s = p.sport || 'NBA';
            if (!sportGroups.has(s)) sportGroups.set(s, []);
            sportGroups.get(s)!.push(p);
          }
          for (const [sport, sp] of sportGroups) {
            const sw = sp.filter(p => p.result === 'won').length;
            const sl = sp.filter(p => p.result === 'lost').length;
            const st = sw + sl;
            const swr = st > 0 ? Math.round((sw / st) * 10000) / 100 : 0;
            const sroi = st > 0 ? Math.round(((sw * 0.909 - sl) / st) * 10000) / 100 : 0;
            const { hot: sh, cold: sc } = calcStreaks(sp.map(p => p.result!));

            await supabase.from('sbo_capper_performance').upsert({
              capper_id: capper.id, sport,
              total_picks: sp.length, wins: sw, losses: sl,
              pushes: sp.filter(p => p.result === 'push').length,
              win_rate: swr, roi: sroi,
              hot_streak: sh, cold_streak: sc,
              confidence_grade: calcGrade(swr, st, sh, sc),
              last_7_picks: d7.filter(p => (p.sport || 'NBA') === sport).length,
              last_7_wins: d7.filter(p => (p.sport || 'NBA') === sport && p.result === 'won').length,
              last_7_win_rate: 0,
              last_30_picks: d30.filter(p => (p.sport || 'NBA') === sport).length,
              last_30_wins: d30.filter(p => (p.sport || 'NBA') === sport && p.result === 'won').length,
              last_30_win_rate: 0,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'capper_id,sport,prop_type', ignoreDuplicates: false });
          }

          // Upsert ROI by sport+market
          for (const [mkt, stats] of marketMap) {
            const mr = stats.t > 0 ? Math.round(((stats.w * 0.909 - (stats.t - stats.w)) / stats.t) * 10000) / 100 : 0;
            // Find the sport for this market from picks
            const mktPick = resolvedPicks.find(p => (p.prop_type || p.bet_type || 'unknown') === mkt);
            const mktSport = mktPick?.sport || 'ALL';

            await supabase.from('sbo_capper_roi').upsert({
              capper_id: capper.id, sport: mktSport, market_type: mkt,
              total_bets: stats.t, wins: stats.w, losses: stats.t - stats.w,
              win_rate: stats.t > 0 ? Math.round((stats.w / stats.t) * 10000) / 100 : 0,
              total_profit: Math.round((stats.w * 0.909 - (stats.t - stats.w)) * 100) / 100,
              roi_percentage: mr,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'capper_id,sport,market_type', ignoreDuplicates: false });
          }

          graded++;
        }
        console.log(`[grade] Graded ${graded} cappers`);
      }
    }

    return new Response(JSON.stringify({
      success: true, matched, resolved, graded,
      matchLogs: matchLogs.length,
      needsReview: matchLogs.filter(l => l.result === 'needs_review').length,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
