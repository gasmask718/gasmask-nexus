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

    const { store_ids, voice_engine, mode, speed_preset, business_id, user_id } = await req.json();

    if (!store_ids?.length || !business_id) {
      return new Response(
        JSON.stringify({ error: "store_ids and business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve phones for all stores ──
    const phoneMap: Record<string, string | null> = {};

    // Priority 1: store_contacts
    for (let i = 0; i < store_ids.length; i += 50) {
      const chunk = store_ids.slice(i, i + 50);
      const { data } = await supabase
        .from("store_contacts")
        .select("store_id, phone")
        .in("store_id", chunk)
        .not("phone", "is", null);
      (data || []).forEach((r: any) => {
        if (r.phone && !phoneMap[r.store_id]) phoneMap[r.store_id] = r.phone;
      });
    }

    // Priority 2: store_master
    for (let i = 0; i < store_ids.length; i += 50) {
      const chunk = store_ids.slice(i, i + 50);
      const { data } = await supabase
        .from("store_master")
        .select("id, phone")
        .in("id", chunk)
        .not("phone", "is", null);
      (data || []).forEach((r: any) => {
        if (r.phone && !phoneMap[r.id]) phoneMap[r.id] = r.phone;
      });
    }

    // Normalize phones to E.164
    const normalize = (raw: string | null): string | null => {
      if (!raw) return null;
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      if (digits.length > 7) return `+${digits}`;
      return null;
    };

    // ── Compute concurrency from speed preset ──
    const { count: agentCount } = await supabase
      .from("dialer_agent_availability")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business_id)
      .eq("status", "available");

    const agents = agentCount || 1;
    let concurrency = agents;
    let batchSize = 25;
    if (speed_preset === "fast") { concurrency = agents * 2; batchSize = 50; }
    if (speed_preset === "ai_burst") { concurrency = Math.min(20, 10); batchSize = 50; }

    // ── Build targets ──
    const targets = store_ids.map((sid: string) => {
      const phone = normalize(phoneMap[sid] || null);
      return { store_id: sid, resolved_phone: phone, status: phone ? "pending" : "skipped" };
    });

    const callableCount = targets.filter((t: any) => t.status === "pending").length;

    // ── Create run ──
    const { data: run, error: runErr } = await supabase
      .from("follow_up_execution_runs")
      .insert({
        business_id,
        created_by: user_id || null,
        status: "queued",
        total_targets: store_ids.length,
        callable_targets: callableCount,
        mode: mode || "human",
        voice_engine: voice_engine || "auto",
        concurrency_limit: concurrency,
        batch_size: batchSize,
        throttle_ms: 250,
      })
      .select("id")
      .single();

    if (runErr || !run) {
      return new Response(
        JSON.stringify({ error: "Failed to create run", details: runErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Insert targets in batches ──
    for (let i = 0; i < targets.length; i += 100) {
      const batch = targets.slice(i, i + 100).map((t: any) => ({
        run_id: run.id,
        store_id: t.store_id,
        resolved_phone: t.resolved_phone,
        status: t.status,
      }));
      await supabase.from("follow_up_execution_targets").insert(batch);
    }

    // ── Set run to running ──
    await supabase
      .from("follow_up_execution_runs")
      .update({ status: "running" })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        total_targets: store_ids.length,
        callable_targets: callableCount,
        skipped: store_ids.length - callableCount,
        concurrency,
        batch_size: batchSize,
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
