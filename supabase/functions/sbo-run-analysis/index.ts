import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let jobId: string | undefined;
  try {
    // Safe body parse
    let body: Record<string, unknown> = {};
    try {
      const rawBody = await req.text();
      if (rawBody?.trim()) body = JSON.parse(rawBody);
    } catch { body = {}; }

    jobId = typeof body.jobId === 'string' ? body.jobId : undefined;

    const updateJob = async (payload: Record<string, unknown>) => {
      if (!jobId) return;
      await supabase.from('sbo_analysis_jobs').update(payload).eq('id', jobId);
    };

    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let gameDate = todayEST;

    if (jobId) {
      await updateJob({ status: 'running', started_at: new Date().toISOString(), progress: 5 });
      const { data: job } = await supabase
        .from('sbo_analysis_jobs').select('*').eq('id', jobId).single();
      if (job?.params?.game_date) gameDate = job.params.game_date;
    }

    console.log(`[analysis] Starting for gameDate=${gameDate}, mode=${jobId ? 'job' : 'ad-hoc'}`);

    // ── STEP 1: Gather props from sbo_player_props ──
    await updateJob({ progress: 15 });

    const { data: allProps, error: propsError } = await supabase
      .from('sbo_player_props')
      .select('*')
      .eq('game_date', gameDate)
      .order('player_name');

    if (propsError) throw propsError;
    console.log(`[analysis] sbo_player_props for ${gameDate}: ${(allProps || []).length} rows`);

    // If no props for today, try ALL props that haven't been analyzed
    let propsToAnalyze = allProps || [];
    if (propsToAnalyze.length === 0) {
      console.log('[analysis] No props for today, fetching all unanalyzed props...');
      const { data: allUnanalyzed } = await supabase
        .from('sbo_player_props')
        .select('*')
        .order('game_date', { ascending: false })
        .limit(500);
      propsToAnalyze = allUnanalyzed || [];
      if (propsToAnalyze.length > 0) {
        gameDate = propsToAnalyze[0].game_date;
        console.log(`[analysis] Using latest available date: ${gameDate} (${propsToAnalyze.length} props)`);
      }
    }

    if (propsToAnalyze.length === 0) {
      await updateJob({
        status: 'completed', completed_at: new Date().toISOString(), progress: 100,
        results: { total_props: 0, message: 'No props available for analysis' },
      });
      return new Response(JSON.stringify({
        success: true,
        summary: { total_props: 0, message: 'No props found in sbo_player_props for any date' },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── STEP 2: Get stat context for enrichment ──
    await updateJob({ progress: 30 });

    const { data: statContext } = await supabase
      .from('sbo_prop_stat_context')
      .select('*')
      .eq('game_date', gameDate);

    const statMap: Record<string, any> = {};
    for (const s of statContext || []) {
      statMap[`${s.player_name}::${s.stat_type}`] = s;
    }
    console.log(`[analysis] Stat context entries: ${Object.keys(statMap).length}`);

    // ── STEP 3: Build unified props with predictions ──
    await updateJob({ progress: 50 });

    const unifiedRows: any[] = [];
    const propsMasterUpdates: any[] = [];

    // Group by player+stat for best-platform detection
    const groupMap: Record<string, any[]> = {};
    for (const p of propsToAnalyze) {
      const key = `${p.player_name}::${p.prop_type}`;
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(p);
    }

    for (const [key, props] of Object.entries(groupMap)) {
      const stats = statMap[key];
      const lines = props.map((p: any) => p.line);
      const minLine = Math.min(...lines);
      const maxLine = Math.max(...lines);

      for (const p of props) {
        const seasonAvg = stats?.season_avg || null;
        const l5Avg = stats?.l5_avg || null;
        const l10Avg = stats?.l10_avg || null;
        const edgeVsLine = seasonAvg ? +(seasonAvg - p.line).toFixed(2) : null;

        let aiDirection: string | null = null;
        let aiConfidence: number | null = null;
        if (seasonAvg) {
          const diff = seasonAvg - p.line;
          const pctDiff = Math.abs(diff / p.line);
          aiDirection = diff > 0 ? 'OVER' : 'UNDER';
          aiConfidence = Math.min(95, Math.round(50 + pctDiff * 100));
          if (seasonAvg < p.line * 0.8) aiDirection = 'UNDER';
        } else {
          // No stats — assign neutral prediction
          aiDirection = 'HOLD';
          aiConfidence = 30;
        }

        const isBestOver = p.line === minLine;
        const isBestUnder = p.line === maxLine;

        unifiedRows.push({
          player_name: p.player_name,
          team: p.team,
          stat_type: p.prop_type,
          platform: p.source || 'odds_api',
          line: p.line,
          over_odds: p.over_odds,
          under_odds: p.under_odds,
          game_date: p.game_date || gameDate,
          game_id: p.game_id,
          season_avg: seasonAvg,
          l5_avg: l5Avg,
          l10_avg: l10Avg,
          edge_vs_line: edgeVsLine,
          ai_direction: aiDirection,
          ai_confidence: aiConfidence,
          best_platform: aiDirection === 'OVER' ? isBestOver : isBestUnder,
          analysis_job_id: jobId || null,
        });

        // Build props_master update to sync predictions directly
        propsMasterUpdates.push({
          player_name: p.player_name,
          stat_type: p.prop_type,
          line: p.line,
          platform: p.source || 'odds_api',
          game_date: p.game_date || gameDate,
          prediction: aiDirection === 'OVER' ? 'more' : aiDirection === 'UNDER' ? 'less' : null,
          confidence_score: aiConfidence,
          edge_score: edgeVsLine,
          season_avg: seasonAvg,
          last_5_avg: l5Avg,
          last_10_avg: l10Avg,
        });
      }
    }

    // ── STEP 4: Write to sbo_unified_props ──
    await updateJob({ progress: 70 });

    if (unifiedRows.length > 0) {
      await supabase.from('sbo_unified_props').delete().eq('game_date', gameDate);
      for (let i = 0; i < unifiedRows.length; i += 100) {
        const batch = unifiedRows.slice(i, i + 100);
        const { error: insErr } = await supabase.from('sbo_unified_props').insert(batch);
        if (insErr) console.warn(`[analysis] unified insert batch ${i} error:`, insErr.message);
      }
    }
    console.log(`[analysis] Wrote ${unifiedRows.length} rows to sbo_unified_props`);

    // ── STEP 5: Write predictions directly to props_master (CRITICAL FIX) ──
    await updateJob({ progress: 85 });

    let propsUpdated = 0;
    for (const upd of propsMasterUpdates) {
      const { error: updErr, count } = await supabase
        .from('props_master')
        .update({
          prediction: upd.prediction || 'hold',
          confidence_score: upd.confidence_score,
          edge_score: upd.edge_score,
          season_avg: upd.season_avg,
          last_5_avg: upd.last_5_avg,
          last_10_avg: upd.last_10_avg,
          updated_at: new Date().toISOString(),
        })
        .eq('player_name', upd.player_name)
        .eq('stat_type', upd.stat_type)
        .eq('line', upd.line)
        .eq('platform', upd.platform)
        .eq('game_date', upd.game_date);
      if (!updErr) propsUpdated++;
    }
    console.log(`[analysis] Updated ${propsUpdated} props_master rows with predictions`);

    // ── STEP 6: Complete ──
    const summary = {
      total_props: unifiedRows.length,
      props_master_updated: propsUpdated,
      platforms: [...new Set(unifiedRows.map(r => r.platform))],
      players: [...new Set(unifiedRows.map(r => r.player_name))].length,
      with_stats: unifiedRows.filter(r => r.season_avg).length,
      without_stats: unifiedRows.filter(r => !r.season_avg).length,
      best_picks: unifiedRows.filter(r => r.best_platform && r.ai_confidence && r.ai_confidence >= 70).length,
      game_date_used: gameDate,
    };

    await updateJob({
      status: 'completed', completed_at: new Date().toISOString(), progress: 100, results: summary,
    });

    console.log(`[analysis] Complete:`, JSON.stringify(summary));

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[analysis] Error:', error);
    if (jobId) {
      try {
        await supabase.from('sbo_analysis_jobs')
          .update({ status: 'failed', error_message: error instanceof Error ? error.message : String(error) })
          .eq('id', jobId);
      } catch {}
    }
    return new Response(JSON.stringify({
      success: false, error: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
