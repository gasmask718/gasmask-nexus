import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-track-revenue
 * 
 * Tracks revenue events and recalculates revenue scores for templates/profiles.
 * 
 * Actions:
 * - record_event: Log a revenue event (proposal_sent, payment_completed, etc.)
 * - recalculate: Recalculate all revenue scores across profiles, templates, patterns
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, dry_run, ...params } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record_event") {
      return await handleRecordEvent(supabase, params);
    }

    if (action === "recalculate") {
      return await handleRecalculate(supabase);
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: record_event, recalculate" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[REVENUE-TRACK] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleRecordEvent(supabase: any, params: any) {
  const { client_id, event_type, event_value, project_id, build_job_id, metadata } = params;

  if (!client_id || !event_type) {
    return new Response(JSON.stringify({ error: "client_id and event_type required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve template/profile from build job
  let templateId = null;
  let designProfileId = null;
  const resolvedBuildJobId = build_job_id || null;

  if (resolvedBuildJobId) {
    const { data: job } = await supabase
      .from("brandaro_build_jobs")
      .select("design_profile_id")
      .eq("id", resolvedBuildJobId)
      .single();
    if (job) {
      designProfileId = job.design_profile_id;
    }
  } else if (client_id) {
    // Find latest build job for this client
    const { data: job } = await supabase
      .from("brandaro_build_jobs")
      .select("id, design_profile_id")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (job) {
      designProfileId = job.design_profile_id;
    }
  }

  // Insert revenue event
  const { data: evt, error } = await supabase.from("brandaro_revenue_events").insert({
    client_id,
    project_id: project_id || null,
    build_job_id: resolvedBuildJobId,
    template_id: templateId,
    design_profile_id: designProfileId,
    event_type,
    event_value: event_value || 0,
    metadata: metadata || {},
  }).select().single();

  if (error) throw error;

  // If payment event, update revenue attribution
  if (event_type === "payment_completed" && (event_value || 0) > 0) {
    await updateRevenueAttribution(supabase, client_id, designProfileId, event_value);
  }

  console.log(`[REVENUE-TRACK] Recorded ${event_type} for client ${client_id} ($${event_value || 0})`);

  return new Response(JSON.stringify({ ok: true, event_id: evt.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateRevenueAttribution(supabase: any, clientId: string, profileId: string | null, amount: number) {
  // Update attribution record
  const { data: attr } = await supabase
    .from("brandaro_revenue_attribution")
    .select("*")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (attr) {
    await supabase.from("brandaro_revenue_attribution").update({
      revenue_generated: (attr.revenue_generated || 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq("id", attr.id);
  }

  // Update design profile revenue totals
  if (profileId) {
    const { data: profile } = await supabase
      .from("brandaro_design_profiles")
      .select("total_revenue, builds_with_payment")
      .eq("id", profileId)
      .single();

    if (profile) {
      await supabase.from("brandaro_design_profiles").update({
        total_revenue: (profile.total_revenue || 0) + amount,
        builds_with_payment: (profile.builds_with_payment || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", profileId);
    }
  }
}

async function handleRecalculate(supabase: any) {
  console.log("[REVENUE-TRACK] Starting full revenue recalculation...");

  // === DESIGN PROFILES ===
  const { data: profiles } = await supabase
    .from("brandaro_design_profiles")
    .select("id, usage_count, total_revenue, builds_with_payment, avg_conversion_rate");

  let profilesUpdated = 0;
  for (const p of (profiles || [])) {
    const closeRate = p.usage_count > 0 ? ((p.builds_with_payment || 0) / p.usage_count) * 100 : 0;
    const avgOrderValue = (p.builds_with_payment || 0) > 0 ? (p.total_revenue || 0) / p.builds_with_payment : 0;

    // Revenue score: 40% revenue, 20% close rate, 20% conversion, 10% AOV, 10% volume
    const revNorm = Math.min((p.total_revenue || 0) / 50000, 1); // $50k = max
    const closeNorm = Math.min(closeRate / 50, 1); // 50% = max
    const convNorm = Math.min((p.avg_conversion_rate || 0) / 20, 1); // 20% = max
    const aovNorm = Math.min(avgOrderValue / 5000, 1); // $5k = max
    const volNorm = Math.min((p.usage_count || 0) / 100, 1); // 100 builds = max

    const revenueScore = (revNorm * 40 + closeNorm * 20 + convNorm * 20 + aovNorm * 10 + volNorm * 10);

    await supabase.from("brandaro_design_profiles").update({
      revenue_score: Math.round(revenueScore * 100) / 100,
      close_rate: Math.round(closeRate * 100) / 100,
      avg_order_value: avgOrderValue,
      updated_at: new Date().toISOString(),
    }).eq("id", p.id);
    profilesUpdated++;
  }

  // === CONVERSION PATTERNS ===
  const { data: patterns } = await supabase
    .from("brandaro_conversion_patterns")
    .select("id, times_used_in_builds, total_revenue, builds_with_payment, pattern_score");

  let patternsUpdated = 0;
  for (const p of (patterns || [])) {
    const used = p.times_used_in_builds || 0;
    const closeRate = used > 0 ? ((p.builds_with_payment || 0) / used) * 100 : 0;
    const revNorm = Math.min((p.total_revenue || 0) / 50000, 1);
    const closeNorm = Math.min(closeRate / 50, 1);
    const baseNorm = Math.min((p.pattern_score || 0) / 100, 1);

    // Revenue score for patterns: 50% revenue, 30% close rate, 20% base score
    const revenueScore = (revNorm * 50 + closeNorm * 30 + baseNorm * 20);

    await supabase.from("brandaro_conversion_patterns").update({
      revenue_score: Math.round(revenueScore * 100) / 100,
      close_rate: Math.round(closeRate * 100) / 100,
    }).eq("id", p.id);
    patternsUpdated++;
  }

  console.log(`[REVENUE-TRACK] Recalculated ${profilesUpdated} profiles, ${patternsUpdated} patterns`);

  return new Response(JSON.stringify({
    ok: true,
    profiles_updated: profilesUpdated,
    patterns_updated: patternsUpdated,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
