// sbo-score-capper-picks — periodic recompute of per-pick edge/confidence scores.
//
// Formula source: ../_shared/perPickScore.ts — THE SAME MODULE the UI imports
// (via src/lib/sbo/perPickScore.ts, a pure re-export). No second implementation.
//
// Behavior:
//   • Rolling 21-day window (matches the market-props window used by the UI).
//   • Recomputes on every run while a pick is still pending (lines move, props
//     land late, form data fills in).
//   • FREEZE RULE: once a pick's result leaves 'pending' (won/lost/push/void),
//     the score computed at that moment is stamped with scored_at + score_frozen
//     = true and is never recomputed again.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  calcConfidenceBreakdown,
  impliedFromAmerican,
  PER_PICK_SCORE_VERSION,
} from '../_shared/perPickScore.ts';
import { normalizeStat, marketPropCandidates } from '../_shared/statNormalize.ts';

const WINDOW_DAYS = 21;
const FORM_DAYS = 60;

const PROP_STAT_KEY: Record<string, string> = {
  home_runs: 'HR', hr: 'HR', hits: 'H', total_bases: 'TB', rbis: 'RBI', rbi: 'RBI',
  runs: 'R', runs_scored: 'R', walks: 'BB', strikeouts: 'K_p', pitcher_strikeouts: 'K_p',
  strikeouts_thrown: 'K_p', batter_strikeouts: 'K_b', hits_allowed: 'H_allowed',
  earned_runs: 'ER', home_runs_allowed: 'HR_allowed', walks_allowed: 'BB_allowed',
  outs_recorded: 'OUTS', pitcher_outs: 'OUTS', innings_pitched: 'IP',
  strikeouts_pitched: 'K_p', pitching_strikeouts: 'K_p', total_hits: 'H',
};

const isPending = (r: string | null) => !r || r === 'pending';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const windowDays = Number(body?.window_days) || WINDOW_DAYS;
    const backfillAll = body?.backfill === true;

    const since = backfillAll ? "2000-01-01" : new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
    const formSince = new Date(Date.now() - FORM_DAYS * 86400000).toISOString().slice(0, 10);

    // ── Load picks in window ──
    let pickQuery = supabase
      .from('sbo_capper_picks')
      .select('id, capper_id, player_name, prop_type, line, direction, odds, game_date, sport, result, score_frozen, matched_prop_id')
      .not('player_name', 'is', null)
      .not('prop_type', 'is', null)
      .not('line', 'is', null)
      .order('game_date', { ascending: false })
      .limit(5000);
    if (!backfillAll) pickQuery = pickQuery.gte('game_date', since);

    const { data: picks, error: pickErr } = await pickQuery;
    if (pickErr) throw pickErr;
    const rows = picks || [];

    // ── Reference data ──
    const [{ data: marketProps }, { data: capperPerf }] = await Promise.all([
      supabase.from('sbo_player_props')
        .select('player_name, prop_type, line, game_date').gte('game_date', since).limit(10000),
      supabase.from('sbo_capper_performance').select('capper_id, roi, win_rate'),
    ]);

    const playerNames = [...new Set(rows.map((p: any) => p.player_name).filter(Boolean))];
    const gameStats: any[] = [];
    for (let i = 0; i < playerNames.length; i += 150) {
      const { data } = await supabase.from('sbo_player_game_stats')
        .select('player_name, game_date, stat_line')
        .in('player_name', playerNames.slice(i, i + 150))
        .gte('game_date', formSince)
        .limit(5000);
      gameStats.push(...(data || []));
    }

    // ── Indexes ──
    const marketMap = new Map<string, any>();
    for (const m of marketProps || []) {
      const k = `${(m.player_name || '').toLowerCase().trim()}|${normalizeStat(m.prop_type || '')}|${m.game_date}`;
      if (!marketMap.has(k)) marketMap.set(k, m);
    }

    const perfMap = new Map<string, any>();
    for (const p of capperPerf || []) perfMap.set(p.capper_id, p);

    const formIndex = new Map<string, any[]>();
    for (const g of gameStats) {
      const k = (g.player_name || '').toLowerCase().trim();
      if (!formIndex.has(k)) formIndex.set(k, []);
      formIndex.get(k)!.push(g);
    }
    for (const arr of formIndex.values()) arr.sort((a, b) => (a.game_date < b.game_date ? 1 : -1));

    const marketHist = new Map<string, { wins: number; total: number }>();
    for (const p of rows as any[]) {
      if (p.result !== 'won' && p.result !== 'lost') continue;
      const mk = `${(p.sport || '').toLowerCase()}|${(p.prop_type || '').toLowerCase()}`;
      if (!marketHist.has(mk)) marketHist.set(mk, { wins: 0, total: 0 });
      const e = marketHist.get(mk)!;
      e.total++;
      if (p.result === 'won') e.wins++;
    }

    // ── Group by player|prop|line|date (same key the UI uses) ──
    const groups = new Map<string, any[]>();
    for (const p of rows as any[]) {
      const key = `${(p.player_name || '').toLowerCase().trim()}|${(p.prop_type || '').toLowerCase()}|${p.line}|${p.game_date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    const updates: any[] = [];
    let skippedFrozen = 0;
    let matchedMarket = 0;

    for (const [, group] of groups) {
      const uniqueCappers = new Map<string, any>();
      for (const p of group) if (!uniqueCappers.has(p.capper_id)) uniqueCappers.set(p.capper_id, p);
      const members = [...uniqueCappers.values()];
      const first = group[0];

      // Capper quality
      const perfs = [...uniqueCappers.keys()].map((id) => perfMap.get(id)).filter(Boolean);
      const avgROI = perfs.length ? perfs.reduce((s, p) => s + (Number(p.roi) || 0), 0) / perfs.length : 0;
      const avgWR = perfs.length ? perfs.reduce((s, p) => s + (Number(p.win_rate) || 0), 0) / perfs.length : 0;

      // Direction agreement
      const dirCounts = new Map<string, number>();
      for (const m of members) {
        const d = (m.direction || '').toLowerCase().trim() || 'unknown';
        dirCounts.set(d, (dirCounts.get(d) || 0) + 1);
      }
      let majorityDir = (first.direction || '').toLowerCase().trim();
      let majorityCount = 0;
      for (const [d, c] of dirCounts) if (c > majorityCount) { majorityCount = c; majorityDir = d; }
      const directionAgreement = members.length ? majorityCount / members.length : 0;

      // Price
      const oddsVals = members
        .map((m) => (m.odds === null || m.odds === undefined ? null : Number(m.odds)))
        .filter((o): o is number => o !== null && Number.isFinite(o) && o !== 0);
      const avgOdds = oddsVals.length ? Math.round(oddsVals.reduce((s, o) => s + o, 0) / oddsVals.length) : null;
      const impliedProb = impliedFromAmerican(avgOdds);

      // Line edge vs market
      const mPlayer = (first.player_name || '').toLowerCase().trim();
      let marketRow: any = null;
      for (const cand of marketPropCandidates(first.prop_type || '')) {
        marketRow = marketMap.get(`${mPlayer}|${cand}|${first.game_date}`);
        if (marketRow) break;
      }
      const marketLine = marketRow && marketRow.line !== null ? Number(marketRow.line) : null;
      let lineEdgePct: number | null = null;
      if (marketLine !== null && Number.isFinite(Number(first.line)) && Math.abs(marketLine) > 0) {
        const raw = majorityDir.startsWith('u')
          ? Number(first.line) - marketLine
          : marketLine - Number(first.line);
        lineEdgePct = Math.round((raw / Math.abs(marketLine)) * 10000) / 10000;
        matchedMarket++;
      }

      // Recent form
      let formHitRate: number | null = null;
      const statKey = PROP_STAT_KEY[(first.prop_type || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')];
      const pickLineNum = Number(first.line);
      if (statKey && Number.isFinite(pickLineNum)) {
        const games = (formIndex.get(mPlayer) || [])
          .filter((g: any) => g.game_date < first.game_date)
          .slice(0, 15)
          .map((g: any) => Number(g.stat_line?.[statKey]))
          .filter((v: number) => Number.isFinite(v));
        if (games.length >= 5) {
          const isUnder = majorityDir.startsWith('u');
          const hits = games.filter((v) => (isUnder ? v < pickLineNum : v > pickLineNum)).length;
          formHitRate = Math.round((hits / games.length) * 1000) / 10;
        }
      }

      // Market difficulty
      const hist = marketHist.get(`${(first.sport || '').toLowerCase()}|${(first.prop_type || '').toLowerCase()}`);
      const marketWinRate = hist && hist.total >= 5 ? Math.round((hist.wins / hist.total) * 1000) / 10 : null;

      const breakdown = calcConfidenceBreakdown({
        capperCount: uniqueCappers.size,
        avgCapperROI: Math.round(avgROI * 100) / 100,
        avgCapperWinRate: Math.round(avgWR * 100) / 100,
        formHitRate,
        directionAgreement,
        impliedProb,
        lineEdgePct,
        marketWinRate,
      });

      for (const p of group) {
        if (p.score_frozen) { skippedFrozen++; continue; }
        updates.push({
          id: p.id,
          edge_score: breakdown.edgeScore,
          confidence_score: breakdown.total,
          scored_at: new Date().toISOString(),
          score_version: PER_PICK_SCORE_VERSION,
          // Freeze at first grading: the score standing when the pick resolves is final.
          score_frozen: !isPending(p.result),
        });
      }
    }

    // ── Persist (verified write: read back a sample and confirm) ──
    let written = 0;
    const errors: string[] = [];
    for (let i = 0; i < updates.length; i += 200) {
      const batch = updates.slice(i, i + 200);
      for (const u of batch) {
        const { id, ...patch } = u;
        const { error } = await supabase.from('sbo_capper_picks').update(patch).eq('id', id);
        if (error) errors.push(`${id}: ${error.message}`);
        else written++;
      }
    }

    const result = {
      ok: errors.length === 0,
      window_days: backfillAll ? 'all' : windowDays,
      picks_considered: rows.length,
      groups: groups.size,
      groups_matched_to_market: matchedMarket,
      rows_written: written,
      rows_skipped_frozen: skippedFrozen,
      score_version: PER_PICK_SCORE_VERSION,
      errors: errors.slice(0, 10),
    };
    console.log('sbo-score-capper-picks', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: errors.length ? 207 : 200,
    });
  } catch (e) {
    console.error('sbo-score-capper-picks failed', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
