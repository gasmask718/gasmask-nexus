import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    let body: Record<string, unknown> = {};
    try {
      const rawBody = await req.text();
      if (rawBody?.trim()) {
        body = JSON.parse(rawBody);
      }
    } catch (parseError) {
      console.warn('Failed to parse request body, proceeding with empty payload:', parseError);
      body = {};
    }

    jobId = typeof body.jobId === 'string' ? body.jobId : undefined;

    const updateJob = async (payload: Record<string, unknown>) => {
      if (!jobId) return;
      const { error } = await supabase
        .from('sbo_analysis_jobs')
        .update(payload)
        .eq('id', jobId);
      if (error) {
        console.warn('Job update warning:', error.message);
      }
    };

    const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let gameDate = todayEST;

    if (jobId) {
      await updateJob({ status: 'running', started_at: new Date().toISOString(), progress: 5 });

      const { data: job, error: jobError } = await supabase
        .from('sbo_analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) throw new Error('Job not found');
      gameDate = job.params?.game_date || todayEST;
    }

    console.log(`Starting analysis for gameDate=${gameDate}, mode=${jobId ? 'job' : 'ad-hoc'}`);

    // STEP 1: Gather all props from sbo_player_props (all sources)
    await updateJob({ progress: 15 });

    const { data: allProps, error: propsError } = await supabase
      .from('sbo_player_props')
      .select('*')
      .gte('game_date', gameDate)
      .lte('game_date', gameDate + 'T23:59:59')
      .order('player_name');

    if (propsError) throw propsError;
    console.log(`Fetched player props: ${(allProps || []).length}`);

    // STEP 2: Gather all book props
    await updateJob({ progress: 25 });

    const { data: bookProps } = await supabase
      .from('sbo_book_props')
      .select('*')
      .eq('game_date', gameDate);
    console.log(`Fetched book props: ${(bookProps || []).length}`);

    // STEP 3: Normalize and unify all props
    await updateJob({ progress: 40 });

    const unifiedMap: Record<string, any[]> = {};

    // Add player props (Odds API, manual, etc.)
    for (const p of allProps || []) {
      const key = `${p.player_name}::${p.prop_type}`;
      if (!unifiedMap[key]) unifiedMap[key] = [];
      unifiedMap[key].push({
        player_name: p.player_name,
        team: p.team,
        stat_type: p.prop_type,
        platform: p.source || 'odds_api',
        line: p.line,
        over_odds: p.over_odds,
        under_odds: p.under_odds,
        game_date: gameDate,
        game_id: p.game_id,
      });
    }

    // Add book props (Bovada, DraftKings, etc.)
    for (const bp of bookProps || []) {
      const key = `${bp.player_name}::${bp.prop_type}`;
      if (!unifiedMap[key]) unifiedMap[key] = [];
      unifiedMap[key].push({
        player_name: bp.player_name,
        team: bp.team,
        stat_type: bp.prop_type,
        platform: bp.book || 'unknown',
        line: bp.line,
        over_odds: bp.over_odds,
        under_odds: bp.under_odds,
        game_date: gameDate,
        game_id: bp.game_id,
      });
    }

    // STEP 4: Get stat context for enrichment
    await updateJob({ progress: 55 });

    const { data: statContext } = await supabase
      .from('sbo_prop_stat_context')
      .select('*')
      .eq('game_date', gameDate);

    const statMap: Record<string, any> = {};
    for (const s of statContext || []) {
      statMap[`${s.player_name}::${s.prop_type}`] = s;
    }

    // STEP 5: Build unified props with enrichment + best platform detection
    await updateJob({ progress: 70 });

    const unifiedRows: any[] = [];

    for (const [key, props] of Object.entries(unifiedMap)) {
      const stats = statMap[key];
      const lines = props.map((p: any) => p.line);
      const minLine = Math.min(...lines);
      const maxLine = Math.max(...lines);

      for (const p of props) {
        const seasonAvg = stats?.season_avg || null;
        const l5Avg = stats?.l5_avg || null;
        const l10Avg = stats?.l10_avg || null;
        const edgeVsLine = seasonAvg ? +(seasonAvg - p.line).toFixed(2) : null;

        // Simple direction heuristic
        let aiDirection = null;
        let aiConfidence = null;
        if (seasonAvg) {
          const diff = seasonAvg - p.line;
          const pctDiff = Math.abs(diff / p.line);
          aiDirection = diff > 0 ? 'OVER' : 'UNDER';
          aiConfidence = Math.min(95, Math.round(50 + pctDiff * 100));
          // Enforce under rule: if avg is >20% below line, pick UNDER
          if (seasonAvg < p.line * 0.8) {
            aiDirection = 'UNDER';
          }
        }

        // Best platform = lowest line for OVER, highest line for UNDER
        const isBestOver = p.line === minLine;
        const isBestUnder = p.line === maxLine;

        unifiedRows.push({
          player_name: p.player_name,
          team: p.team,
          stat_type: p.stat_type,
          platform: p.platform,
          line: p.line,
          over_odds: p.over_odds,
          under_odds: p.under_odds,
          game_date: p.game_date,
          game_id: p.game_id,
          season_avg: seasonAvg,
          l5_avg: l5Avg,
          l10_avg: l10Avg,
          edge_vs_line: edgeVsLine,
          ai_direction: aiDirection,
          ai_confidence: aiConfidence,
          best_platform: aiDirection === 'OVER' ? isBestOver : isBestUnder,
          analysis_job_id: jobId,
        });
      }
    }

    // STEP 6: Upsert unified props
    await updateJob({ progress: 85 });

    if (unifiedRows.length > 0) {
      // Clear old data for this date first
      await supabase
        .from('sbo_unified_props')
        .delete()
        .eq('game_date', gameDate);

      // Insert in batches of 100
      for (let i = 0; i < unifiedRows.length; i += 100) {
        const batch = unifiedRows.slice(i, i + 100);
        await supabase.from('sbo_unified_props').insert(batch);
      }
    }

    // STEP 7: Complete
    const summary = {
      total_props: unifiedRows.length,
      platforms: [...new Set(unifiedRows.map(r => r.platform))],
      players: [...new Set(unifiedRows.map(r => r.player_name))].length,
      with_stats: unifiedRows.filter(r => r.season_avg).length,
      best_picks: unifiedRows.filter(r => r.best_platform && r.ai_confidence && r.ai_confidence >= 70).length,
    };

    await updateJob({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
      results: summary,
    });

    console.log(`Analysis complete: total=${summary.total_props}, players=${summary.players}, with_stats=${summary.with_stats}`);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Analysis error:', error);

    // Try to mark job as failed
    if (jobId) {
      try {
        await supabase
          .from('sbo_analysis_jobs')
          .update({ status: 'failed', error_message: error instanceof Error ? error.message : String(error) })
          .eq('id', jobId);
      } catch {}
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
