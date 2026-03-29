import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════
// NORMALIZATION LAYER
// ═══════════════════════════════════════════════════════════════

const STAT_MAP: Record<string, string> = {
  'pts': 'points', 'point': 'points',
  'reb': 'rebounds', 'rebound': 'rebounds',
  'ast': 'assists', 'assist': 'assists',
  'stl': 'steals', 'steal': 'steals',
  'blk': 'blocks', 'block': 'blocks',
  'tov': 'turnovers', 'turnover': 'turnovers',
  'pra': 'pts+reb+ast', 'pts+rebs+asts': 'pts+reb+ast',
  '3pm': '3-pointers', '3pt': '3-pointers', 'threes': '3-pointers',
  'passing_yards': 'passing_yards', 'pass_yds': 'passing_yards',
  'rushing_yards': 'rushing_yards', 'rush_yds': 'rushing_yards',
  'receiving_yards': 'receiving_yards', 'rec_yds': 'receiving_yards',
  'td': 'touchdowns', 'touchdown': 'touchdowns',
  'hr': 'home_runs', 'home_run': 'home_runs',
  'so': 'strikeouts', 'strikeout': 'strikeouts', 'k': 'strikeouts',
  'rbi': 'rbis',
  'total_bases': 'total_bases', 'tb': 'total_bases',
};

function normalizeStat(s: string): string {
  if (!s) return '';
  let lower = s.toLowerCase().trim().replace(/[_\-\s]+/g, '_');
  // Check direct map first
  if (STAT_MAP[lower]) return STAT_MAP[lower];
  // Try partial replacements
  for (const [k, v] of Object.entries(STAT_MAP)) {
    if (lower.includes(k)) { lower = lower.replace(k, v); break; }
  }
  return lower;
}

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

function matchPick(pick: any, props: any[]): MatchResult | null {
  const pickName = (pick.player_name || '').trim();
  const pickStat = normalizeStat(pick.prop_type || '');
  const pickLine = pick.line;
  const pickDate = pick.game_date;
  const normPick = normalizePlayer(pickName);

  let bestMatch: MatchResult | null = null;

  for (const prop of props) {
    const propName = (prop.player_name || '').trim();
    const propStat = normalizeStat(prop.stat_type || '');
    const propLine = prop.line;
    const propDate = prop.game_date;

    // Date check: must be within ±1 day
    if (pickDate && propDate) {
      const d1 = new Date(pickDate).getTime();
      const d2 = new Date(propDate).getTime();
      if (Math.abs(d1 - d2) > 86400000 * 1.5) continue;
    }

    // Stat type must match (after normalization)
    if (pickStat && propStat && pickStat !== propStat) continue;

    // Line tolerance ±1.0
    if (pickLine != null && propLine != null && Math.abs(pickLine - propLine) > 1.0) continue;

    // ── STEP 1: Exact Match ──
    if (pickName.toLowerCase() === propName.toLowerCase()) {
      const score = 100;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { propId: prop.id, score, method: 'exact' };
      }
      continue;
    }

    // ── STEP 2: Normalized Match ──
    const normProp = normalizePlayer(propName);
    if (normPick === normProp) {
      const score = 95;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { propId: prop.id, score, method: 'normalized' };
      }
      continue;
    }

    // ── STEP 3: Fuzzy Match (Dice Coefficient) ──
    const nameSim = diceCoefficient(normPick, normProp);
    if (nameSim >= 0.80) {
      const score = Math.round(80 + nameSim * 15); // 80-95 range
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { propId: prop.id, score, method: 'fuzzy' };
      }
      continue;
    }

    // ── STEP 4: Context Match (composite) ──
    // Last name match + first initial
    const pickWords = normPick.split(' ');
    const propWords = normProp.split(' ');
    if (pickWords.length >= 2 && propWords.length >= 2) {
      const lastMatch = pickWords[pickWords.length - 1] === propWords[propWords.length - 1];
      const firstInitial = pickWords[0][0] === propWords[0][0];
      if (lastMatch && firstInitial) {
        // Composite: name_sim * 0.5 + team * 0.2 + date * 0.2 + stat * 0.1
        const dateMatch = pickDate === propDate ? 1 : 0.5;
        const statMatch = pickStat === propStat ? 1 : 0;
        const compositeScore = Math.round(
          (0.7 * 0.5 + 0.2 * dateMatch + 0.1 * statMatch) * 100
        );
        if (compositeScore >= 70 && (!bestMatch || compositeScore > bestMatch.score)) {
          bestMatch = { propId: prop.id, score: compositeScore, method: 'context' };
        }
      }
    }
  }

  return bestMatch;
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
    if (mode === 'match' || mode === 'full') {
      const { data: unmatched } = await supabase
        .from('sbo_capper_picks')
        .select('id, player_name, prop_type, line, game_date, sport, direction')
        .is('matched_prop_id', null)
        .not('player_name', 'is', null)
        .limit(500);

      if (unmatched && unmatched.length > 0) {
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
          const { data: props } = await supabase
            .from('props_master')
            .select('id, player_name, stat_type, line, game_date, sport')
            .eq('game_date', d)
            .limit(1000);
          if (props) allProps.push(...props);
        }

        console.log(`[match] ${unmatched.length} unmatched, ${allProps.length} candidate props`);

        for (const pick of unmatched) {
          if (!pick.player_name) continue;
          const result = matchPick(pick, allProps);

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
              await supabase.from('sbo_capper_picks')
                .update({ matched_prop_id: result.propId })
                .eq('id', pick.id);
              matched++;
            }
          }
        }

        // Batch insert match logs
        if (matchLogs.length > 0) {
          await supabase.from('sbo_external_match_logs').insert(matchLogs);
        }
        console.log(`[match] ${matched} auto-matched, ${matchLogs.length} total logged`);
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
          const { data: props } = await supabase.from('props_master')
            .select('id, actual_result, result, line').in('id', chunk);
          if (props) resolvedProps.push(...props);
        }
        const propMap = new Map(resolvedProps.map(p => [p.id, p]));

        for (const pick of pending) {
          const prop = propMap.get(pick.matched_prop_id);
          if (!prop || prop.actual_result == null) continue;

          const pickLine = pick.line ?? prop.line;
          const dir = (pick.direction || '').toUpperCase();
          let result: string;

          if (prop.actual_result === pickLine) result = 'push';
          else if (['OVER', 'MORE', 'YES'].includes(dir)) result = prop.actual_result > pickLine ? 'won' : 'lost';
          else if (['UNDER', 'LESS', 'NO'].includes(dir)) result = prop.actual_result < pickLine ? 'won' : 'lost';
          else result = prop.result === 'won' || prop.result === 'W' ? 'won' : 'lost';

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
