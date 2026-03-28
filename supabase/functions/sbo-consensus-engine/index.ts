import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text().then(t => { try { return JSON.parse(t); } catch { return {}; } });
    const gameDate = body.game_date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 1. Rebuild sbo_capper_performance ──
    const { data: allPicks } = await supabase
      .from('sbo_capper_picks')
      .select('capper_id, sport, prop_type, result, odds, created_at, direction')
      .neq('result', 'pending');

    if (allPicks && allPicks.length > 0) {
      // Group by capper+sport+prop_type
      const perfMap: Record<string, any> = {};
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000);
      const d30 = new Date(now.getTime() - 30 * 86400000);

      for (const p of allPicks) {
        const key = `${p.capper_id}::${p.sport || 'NBA'}::${p.prop_type || '_all'}`;
        if (!perfMap[key]) {
          perfMap[key] = {
            capper_id: p.capper_id, sport: p.sport || 'NBA', prop_type: p.prop_type || null,
            wins: 0, losses: 0, pushes: 0, total: 0,
            l7_picks: 0, l7_wins: 0, l30_picks: 0, l30_wins: 0,
            odds_sum: 0, odds_count: 0, results: [] as string[],
          };
        }
        const e = perfMap[key];
        e.total++;
        if (p.result === 'won') e.wins++;
        else if (p.result === 'lost') e.losses++;
        else if (p.result === 'push') e.pushes++;

        const created = new Date(p.created_at);
        if (created >= d7) { e.l7_picks++; if (p.result === 'won') e.l7_wins++; }
        if (created >= d30) { e.l30_picks++; if (p.result === 'won') e.l30_wins++; }
        if (p.odds) { e.odds_sum += p.odds; e.odds_count++; }
        e.results.push(p.result);
      }

      // Upsert performance records
      for (const e of Object.values(perfMap) as any[]) {
        const winRate = e.total > 0 ? (e.wins / (e.wins + e.losses)) * 100 : 0;
        const l7wr = e.l7_picks > 0 ? (e.l7_wins / e.l7_picks) * 100 : 0;
        const l30wr = e.l30_picks > 0 ? (e.l30_wins / e.l30_picks) * 100 : 0;

        // Calculate streaks
        let hotStreak = 0, coldStreak = 0;
        const recent = e.results.slice(-20).reverse();
        for (const r of recent) {
          if (r === 'won') { hotStreak++; if (coldStreak > 0) break; }
          else if (r === 'lost') { coldStreak++; if (hotStreak > 0) break; }
          else break;
        }

        // Grade: A (>60%), B (>55%), C (>50%), D (<50%)
        const grade = winRate >= 60 ? 'A' : winRate >= 55 ? 'B' : winRate >= 50 ? 'C' : 'D';

        // ROI calculation (simplified: assume -110 standard odds)
        const roi = e.total >= 5 ? ((e.wins * 0.909 - e.losses) / e.total) * 100 : 0;

        await supabase.from('sbo_capper_performance').upsert({
          capper_id: e.capper_id, sport: e.sport, prop_type: e.prop_type,
          total_picks: e.total, wins: e.wins, losses: e.losses, pushes: e.pushes,
          win_rate: Math.round(winRate * 10) / 10,
          last_7_picks: e.l7_picks, last_7_wins: e.l7_wins,
          last_7_win_rate: Math.round(l7wr * 10) / 10,
          last_30_picks: e.l30_picks, last_30_wins: e.l30_wins,
          last_30_win_rate: Math.round(l30wr * 10) / 10,
          avg_odds: e.odds_count > 0 ? Math.round(e.odds_sum / e.odds_count) : null,
          roi: Math.round(roi * 10) / 10,
          hot_streak: hotStreak, cold_streak: coldStreak,
          confidence_grade: grade, updated_at: new Date().toISOString(),
        }, { onConflict: 'capper_id,sport,prop_type' });
      }

      console.log(`[perf] Updated ${Object.keys(perfMap).length} performance records`);
    }

    // ── 2. Build consensus for today's props ──
    const { data: todayProps } = await supabase
      .from('props_master')
      .select('id, player_name, stat_type, line, game_date, ai_confidence, ai_recommendation')
      .eq('game_date', gameDate);

    const { data: todayPicks } = await supabase
      .from('sbo_capper_picks')
      .select('id, player_name, prop_type, line, direction, capper_id, matched_prop_id, sport, edge_score')
      .eq('game_date', gameDate)
      .eq('review_status', 'verified');

    // Get capper grades for weighting
    const { data: capperPerfs } = await supabase
      .from('sbo_capper_performance')
      .select('capper_id, sport, win_rate, confidence_grade, hot_streak');

    const capperGradeMap: Record<string, { grade: string; wr: number; hot: number }> = {};
    for (const cp of capperPerfs || []) {
      const key = `${cp.capper_id}::${cp.sport}`;
      capperGradeMap[key] = { grade: cp.confidence_grade, wr: cp.win_rate, hot: cp.hot_streak };
    }

    let consensusUpdated = 0;
    let valueDetected = 0;

    if (todayProps && todayPicks) {
      for (const prop of todayProps) {
        // Find capper picks linked to this prop
        const linked = todayPicks.filter(p => p.matched_prop_id === prop.id);
        // Also find by fuzzy match (unlinked but same player/stat)
        const fuzzy = todayPicks.filter(p =>
          !p.matched_prop_id &&
          p.player_name?.toLowerCase().includes(prop.player_name?.toLowerCase().split(' ').pop() || '___') &&
          p.prop_type?.toLowerCase().includes(prop.stat_type?.toLowerCase().substring(0, 3) || '___')
        );
        const allMatched = [...linked, ...fuzzy];

        if (allMatched.length === 0) continue;

        let overCount = 0, underCount = 0;
        let weightedOver = 0, weightedUnder = 0;
        let eliteOverCount = 0, eliteUnderCount = 0;

        for (const pick of allMatched) {
          const dir = (pick.direction || '').toUpperCase();
          const sport = pick.sport || 'NBA';
          const capKey = `${pick.capper_id}::${sport}`;
          const capper = capperGradeMap[capKey];
          const weight = capper ? (capper.wr / 50) * (1 + capper.hot * 0.05) : 1;
          const isElite = capper?.grade === 'A' || capper?.grade === 'B';

          if (['OVER', 'MORE', 'YES'].includes(dir)) {
            overCount++;
            weightedOver += weight;
            if (isElite) eliteOverCount++;
          } else if (['UNDER', 'LESS', 'NO'].includes(dir)) {
            underCount++;
            weightedUnder += weight;
            if (isElite) eliteUnderCount++;
          }
        }

        const total = overCount + underCount;
        if (total === 0) continue;

        // Consensus score: 0-100, where 100 = perfect agreement
        const majorityPct = Math.max(overCount, underCount) / total;
        const eliteBias = eliteOverCount > eliteUnderCount ? 'OVER' : eliteUnderCount > eliteOverCount ? 'UNDER' : null;
        const weightedBias = weightedOver > weightedUnder ? 'OVER' : 'UNDER';

        // Model alignment bonus
        const modelDir = (prop.ai_recommendation || '').toUpperCase();
        const modelAligns = modelDir === weightedBias;
        const alignmentBonus = modelAligns ? 10 : -5;

        const consensusScore = Math.min(100, Math.round(majorityPct * 80 + alignmentBonus + (eliteBias === weightedBias ? 10 : 0)));

        // Signal strength
        let signalStrength: string;
        if (consensusScore >= 80 && total >= 3) signalStrength = 'STRONG';
        else if (consensusScore >= 65 && total >= 2) signalStrength = 'MEDIUM';
        else signalStrength = 'LOW';

        // ── Value detection ──
        // Implied probability from standard -110 odds ≈ 52.4%
        // If model + consensus agree and confidence > implied, it's value
        const modelConf = prop.ai_confidence || 50;
        const impliedProb = 52.4; // standard -110
        const edgeVsImplied = modelConf - impliedProb;
        const isValue = edgeVsImplied > 5 && consensusScore >= 65 && modelAligns;
        const valueScore = isValue ? Math.round(edgeVsImplied * (consensusScore / 100)) : 0;

        await supabase.from('props_master').update({
          consensus_over: overCount,
          consensus_under: underCount,
          consensus_score: consensusScore,
          signal_strength: signalStrength,
          is_value_play: isValue,
          value_score: valueScore,
        }).eq('id', prop.id);

        consensusUpdated++;
        if (isValue) valueDetected++;
      }
    }

    console.log(`[consensus] Updated ${consensusUpdated} props, ${valueDetected} value plays`);

    return new Response(JSON.stringify({
      success: true,
      performance_records: allPicks?.length || 0,
      consensus_updated: consensusUpdated,
      value_plays: valueDetected,
      game_date: gameDate,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
