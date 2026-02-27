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

    // ── Fetch next batch of pending targets ──
    const { data: targets, error: tErr } = await supabase
      .from("follow_up_execution_targets")
      .select("*")
      .eq("run_id", run_id)
      .eq("status", "pending")
      .limit(run.batch_size || 25);

    if (tErr) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch targets", details: tErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targets || targets.length === 0) {
      // No more pending — mark run completed
      await supabase
        .from("follow_up_execution_runs")
        .update({ status: "completed" })
        .eq("id", run_id);

      return new Response(
        JSON.stringify({ message: "Run completed — no more pending targets", queued: 0 }),
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

    // ── Check current queue depth to respect concurrency ──
    const { count: activeInQueue } = await supabase
      .from("outbound_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("business_id", run.business_id)
      .in("status", ["queued", "dialing"]);

    const currentActive = activeInQueue || 0;
    // AI mode gets minimum 10 concurrency, human gets at least 1
    const effectiveConcurrency = run.mode === "ai"
      ? Math.max(run.concurrency_limit || 10, 10)
      : Math.max(run.concurrency_limit || 1, 1);
    const maxToQueue = Math.max(0, effectiveConcurrency - currentActive);

    if (maxToQueue === 0) {
      await supabase
        .from("follow_up_execution_runs")
        .update({ notes: `Waiting — concurrency limit reached (active: ${currentActive}, limit: ${effectiveConcurrency})` })
        .eq("id", run_id);

      return new Response(
        JSON.stringify({ status: "waiting", reason: "concurrency_limit", active: currentActive, limit: effectiveConcurrency }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toProcess = targets.slice(0, maxToQueue);
    let queuedCount = 0;
    let failedCount = 0;

    for (const target of toProcess) {
      if (!target.resolved_phone) {
        await supabase
          .from("follow_up_execution_targets")
          .update({ status: "skipped", last_error: "No phone", updated_at: new Date().toISOString() })
          .eq("id", target.id);
        failedCount++;
        continue;
      }

      // Insert into outbound_call_queue
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

    // ── Update run counters ──
    await supabase
      .from("follow_up_execution_runs")
      .update({
        queued_targets: (run.queued_targets || 0) + queuedCount,
        failed_targets: (run.failed_targets || 0) + failedCount,
      })
      .eq("id", run_id);

    return new Response(
      JSON.stringify({ success: true, queued: queuedCount, failed: failedCount, remaining: targets.length - toProcess.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
