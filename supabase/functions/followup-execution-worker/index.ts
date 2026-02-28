import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { run_id } = await req.json();

    if (!run_id) {
      return new Response(
        JSON.stringify({ error: "run_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch run ──
    const { data: run, error: runErr } = await supabase
      .from("follow_up_execution_runs")
      .select("*")
      .eq("id", run_id)
      .single();

    if (runErr || !run) {
      return new Response(
        JSON.stringify({ error: "Run not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (run.status !== "running") {
      return new Response(
        JSON.stringify({ message: `Run is ${run.status}, not processing` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Clean stale queue items (stuck > 30 min) ──
    await supabase
      .from("outbound_call_queue")
      .update({ status: "failed" })
      .eq("business_id", run.business_id)
      .in("status", ["queued", "dialing"])
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // ── Compute active capacity ──
    const { count: activeInQueue } = await supabase
      .from("outbound_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("business_id", run.business_id)
      .in("status", ["queued", "dialing", "ringing", "answered"]);

    const activeCalls = activeInQueue || 0;

    // AI mode: minimum 10 concurrency; human: minimum 1
    const effectiveConcurrency = run.mode === "ai"
      ? Math.max(run.concurrency_limit || 10, 10)
      : Math.max(run.concurrency_limit || 1, 1);

    // Wave size: never more than batch_size per tick
    const waveSize = run.mode === "ai" ? 25 : Math.min(run.batch_size || 5, 10);
    const availableSlots = Math.max(0, effectiveConcurrency - activeCalls);
    const toQueueThisWave = Math.min(availableSlots, waveSize);

    // ── Count remaining pending targets ──
    const { count: remainingCount } = await supabase
      .from("follow_up_execution_targets")
      .select("id", { count: "exact", head: true })
      .eq("run_id", run_id)
      .eq("status", "pending");

    const remaining = remainingCount || 0;

    if (remaining === 0) {
      // No more pending — mark run completed
      await supabase
        .from("follow_up_execution_runs")
        .update({ status: "completed", notes: "All targets processed" })
        .eq("id", run_id);

      return new Response(
        JSON.stringify({ status: "completed", message: "Run completed — no more pending targets" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (toQueueThisWave === 0) {
      // Capacity full — update notes with flow state
      await supabase
        .from("follow_up_execution_runs")
        .update({
          notes: JSON.stringify({
            state: "waiting",
            active_calls: activeCalls,
            capacity: effectiveConcurrency,
            available_slots: 0,
            remaining_targets: remaining,
            wave_size: waveSize,
          }),
        })
        .eq("id", run_id);

      return new Response(
        JSON.stringify({
          status: "waiting",
          active_calls: activeCalls,
          capacity: effectiveConcurrency,
          available_slots: 0,
          remaining: remaining,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Dynamic Exploration: ratio adapts to run confidence ──
    // Fetch all pending targets' store_ids + probabilities
    const { data: allPending } = await supabase
      .from("follow_up_execution_targets")
      .select("id, store_id, pickup_probability")
      .eq("run_id", run_id)
      .eq("status", "pending");

    const pendingProbs = (allPending || []).map((t: any) => t.pickup_probability ?? 0.35);
    const confidenceScore = pendingProbs.length > 0
      ? pendingProbs.reduce((a: number, b: number) => a + b, 0) / pendingProbs.length
      : 0.35;

    // ── Temporal Intelligence: fetch best_hour + best_day_of_week ──
    const pendingStoreIds = [...new Set((allPending || []).map((t: any) => t.store_id).filter(Boolean))];
    const temporalMap: Record<string, { best_hour: number | null; best_day_of_week: number | null }> = {};
    for (let i = 0; i < pendingStoreIds.length; i += 50) {
      const chunk = pendingStoreIds.slice(i, i + 50);
      const { data: profiles } = await supabase
        .from("store_answer_profile")
        .select("store_id, best_hour, best_day_of_week")
        .in("store_id", chunk);
      (profiles || []).forEach((p: any) => {
        temporalMap[p.store_id] = { best_hour: p.best_hour, best_day_of_week: p.best_day_of_week };
      });
    }

    const currentHour = new Date().getUTCHours();
    const currentDay = new Date().getUTCDay(); // 0=Sun

    // Compute temporal scores per target
    const computeTemporalScore = (storeId: string) => {
      const t = temporalMap[storeId];
      if (!t) return { temporal_score: 1.0, day_score: 1.0 };
      let temporal_score = 1.0;
      if (t.best_hour != null) {
        const diff = Math.abs(currentHour - t.best_hour);
        temporal_score = diff === 0 ? 1.25 : diff <= 1 ? 1.10 : 1.0;
      }
      let day_score = 1.0;
      if (t.best_day_of_week != null) {
        day_score = currentDay === t.best_day_of_week ? 1.15 : 1.0;
      }
      return { temporal_score, day_score };
    };

    // Dynamic exploration ratio based on confidence
    const explorationRatio = confidenceScore < 0.35 ? 0.30
      : confidenceScore < 0.55 ? 0.20
      : 0.10;

    const explorationMode = explorationRatio >= 0.25 ? 'HIGH'
      : explorationRatio >= 0.15 ? 'BALANCED'
      : 'PRECISION';

    const exploitCount = Math.max(1, Math.ceil(toQueueThisWave * (1 - explorationRatio)));
    const exploreCount = Math.max(0, toQueueThisWave - exploitCount);

    // Exploitation: high-confidence targets ordered by probability DESC
    const { data: exploitTargets, error: tErr1 } = await supabase
      .from("follow_up_execution_targets")
      .select("*")
      .eq("run_id", run_id)
      .eq("status", "pending")
      .or("pickup_probability.gte.0.35,pickup_probability.is.null")
      .order("pickup_probability", { ascending: false, nullsFirst: false })
      .limit(exploitCount);

    // Exploration: low-confidence targets, random sample
    let exploreTargets: any[] = [];
    if (exploreCount > 0) {
      const { data: pool } = await supabase
        .from("follow_up_execution_targets")
        .select("*")
        .eq("run_id", run_id)
        .eq("status", "pending")
        .lt("pickup_probability", 0.35)
        .limit(exploreCount * 3); // oversample then shuffle
      if (pool && pool.length > 0) {
        // Fisher-Yates shuffle for true random sampling
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        exploreTargets = pool.slice(0, exploreCount);
      }
    }

    // Deduplicate (exploration pool might overlap if NULL probability)
    const seenIds = new Set((exploitTargets || []).map((t: any) => t.id));
    const uniqueExplore = exploreTargets.filter((t: any) => !seenIds.has(t.id));
    const targets = [...(exploitTargets || []), ...uniqueExplore];
    const tErr = tErr1;

    if (tErr || !targets) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch targets", details: tErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch-fetch store names for observability
    const storeIds = [...new Set(targets.map(t => t.store_id).filter(Boolean))];
    const storeNameMap: Record<string, string> = {};
    if (storeIds.length > 0) {
      const { data: stores } = await supabase
        .from("store_master")
        .select("id, store_name")
        .in("id", storeIds);
      if (stores) {
        for (const s of stores) storeNameMap[s.id] = s.store_name;
      }
    }

    let queuedCount = 0;
    let failedCount = 0;

    for (const target of targets) {
      if (!target.resolved_phone) {
        await supabase
          .from("follow_up_execution_targets")
          .update({ status: "skipped", last_error: "No phone", updated_at: new Date().toISOString() })
          .eq("id", target.id);
        failedCount++;
        continue;
      }

      const isExploration = uniqueExplore.some((e: any) => e.id === target.id);
      const { temporal_score, day_score } = computeTemporalScore(target.store_id);
      const prob = target.pickup_probability ?? 0.35;
      const finalPriorityScore = prob * temporal_score * day_score;

      const queueMeta = {
        execution_run_id: run_id,
        execution_target_id: target.id,
        source_reason: "followup_execution",
        voice_engine: run.voice_engine,
        route_mode: run.mode,
        exploration_call: isExploration,
        pickup_probability: prob,
        temporal_score,
        day_score,
        final_priority_score: Math.round(finalPriorityScore * 100) / 100,
      };

      // Adaptive priority: boosted by temporal score
      const adaptivePriority = finalPriorityScore > 0.6 ? 3 : finalPriorityScore > 0.3 ? 5 : 7;

      const { error: qErr } = await supabase.from("outbound_call_queue").insert({
        business_id: run.business_id,
        phone_number: target.resolved_phone,
        store_id: target.store_id,
        status: "queued",
        priority: adaptivePriority,
        contact_name: storeNameMap[target.store_id] || null,
        campaign_id: null,
        metadata: queueMeta,
      });

      // Create live_calls entry for observability
      if (!qErr) {
        await supabase.from("live_calls").insert({
          business_id: run.business_id,
          store_id: target.store_id,
          phone_number: target.resolved_phone,
          agent_type: run.mode === "ai" ? "ai" : "human",
          voice_provider: run.voice_engine || null,
          state: "queued",
          entity_name: storeNameMap[target.store_id] || null,
          run_id: run_id,
          source_reason: "followup_execution",
          started_at: new Date().toISOString(),
          metadata: queueMeta,
        });
      }

      if (qErr) {
        await supabase
          .from("follow_up_execution_targets")
          .update({ status: "failed", last_error: qErr.message, attempt_count: target.attempt_count + 1, updated_at: new Date().toISOString() })
          .eq("id", target.id);
        failedCount++;
      } else {
        await supabase
          .from("follow_up_execution_targets")
          .update({ status: "queued", attempt_count: target.attempt_count + 1, updated_at: new Date().toISOString() })
          .eq("id", target.id);
        queuedCount++;
      }
    }

    // ── Compute wave intelligence diagnostics ──
    const waveProbs = targets.map(t => t.pickup_probability ?? 0.35);
    const avgProbability = waveProbs.length > 0 ? waveProbs.reduce((a, b) => a + b, 0) / waveProbs.length : 0;
    const predictedConnections = Math.round(queuedCount * avgProbability);
    const exploitationCalls = targets.length - uniqueExplore.length;
    const explorationCalls = uniqueExplore.length;
    const learningRate = targets.length > 0 ? Math.round((explorationCalls / targets.length) * 100) : 0;

    // Temporal diagnostics
    const temporalScores = targets.map(t => {
      const { temporal_score, day_score } = computeTemporalScore(t.store_id);
      return temporal_score * day_score;
    });
    const bestTimeMatches = temporalScores.filter(s => s > 1.0).length;
    const avgTemporalBoost = temporalScores.length > 0
      ? Math.round((temporalScores.reduce((a, b) => a + b, 0) / temporalScores.length) * 100) / 100
      : 1.0;

    // ── Update run counters + flow state notes ──
    const newQueued = (run.queued_targets || 0) + queuedCount;
    const newFailed = (run.failed_targets || 0) + failedCount;
    const newRemaining = remaining - targets.length;

    await supabase
      .from("follow_up_execution_runs")
      .update({
        queued_targets: newQueued,
        failed_targets: newFailed,
        notes: JSON.stringify({
          state: "flowing",
          active_calls: activeCalls + queuedCount,
          capacity: effectiveConcurrency,
          available_slots: availableSlots - queuedCount,
          remaining_targets: newRemaining,
          wave_size: waveSize,
          last_wave_queued: queuedCount,
          last_wave_failed: failedCount,
          smart_dial: true,
          avg_pickup_probability: Math.round(avgProbability * 100),
          predicted_connections: predictedConnections,
          exploitation_calls: exploitationCalls,
          exploration_calls: explorationCalls,
          learning_rate: learningRate,
          adaptive_exploration: true,
          exploration_ratio: Math.round(explorationRatio * 100),
          confidence_score: Math.round(confidenceScore * 100),
          exploration_mode: explorationMode,
          temporal_optimization: true,
          best_time_matches: bestTimeMatches,
          avg_temporal_boost: avgTemporalBoost,
        }),
      })
      .eq("id", run_id);

    return new Response(
      JSON.stringify({
        status: "flowing",
        queued: queuedCount,
        failed: failedCount,
        active_calls: activeCalls + queuedCount,
        capacity: effectiveConcurrency,
        remaining: newRemaining,
        wave_size: waveSize,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
