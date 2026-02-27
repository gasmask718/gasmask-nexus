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

    // ── Fetch wave of pending targets ──
    const { data: targets, error: tErr } = await supabase
      .from("follow_up_execution_targets")
      .select("*")
      .eq("run_id", run_id)
      .eq("status", "pending")
      .limit(toQueueThisWave);

    if (tErr || !targets) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch targets", details: tErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

      const { error: qErr } = await supabase.from("outbound_call_queue").insert({
        business_id: run.business_id,
        phone_number: target.resolved_phone,
        store_id: target.store_id,
        status: "queued",
        priority: 5,
        contact_name: null,
        campaign_id: null,
        metadata: {
          execution_run_id: run_id,
          execution_target_id: target.id,
          source_reason: "followup_execution",
          voice_engine: run.voice_engine,
          route_mode: run.mode,
        },
      });

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
