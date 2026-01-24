import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * call-ai-authorize-live
 * 
 * Grants explicit Live Mode authorization for a business.
 * This is the ONLY way to enable Live Mode - no implicit promotion.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      business_id,
      justification,
      authorized_by,
      expires_at,
      auto_renew = false,
    } = await req.json();

    if (!business_id || !justification || !authorized_by) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: business_id, justification, authorized_by" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Check prerequisites
    // Get current trust score
    const { data: trustScore } = await supabase
      .from("ai_trust_scores")
      .select("*")
      .eq("business_id", business_id)
      .is("route_id", null)
      .single();

    // Get config
    const { data: config } = await supabase
      .from("ai_call_agent_config")
      .select("*")
      .eq("business_id", business_id)
      .single();

    const currentTrustScore = trustScore?.trust_score || 0;
    const accuracyRate = trustScore?.accuracy_rate || 0;
    const trustThreshold = config?.live_trust_threshold || 92;

    // Get canary metrics
    const { data: canaryLogs } = await supabase
      .from("canary_call_log")
      .select("id, created_at")
      .eq("business_id", business_id);

    const canaryCallsEvaluated = canaryLogs?.length || 0;
    
    // Calculate canary days
    let canaryDaysCompleted = 0;
    if (canaryLogs && canaryLogs.length > 0) {
      const firstCanary = new Date(canaryLogs[canaryLogs.length - 1].created_at);
      canaryDaysCompleted = Math.floor((Date.now() - firstCanary.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Check kill switches
    const { data: globalKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active")
      .eq("scope", "global")
      .single();

    const { data: businessKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active")
      .eq("scope", "business")
      .eq("business_id", business_id)
      .maybeSingle();

    // Build blockers list
    const blockers: string[] = [];

    if (currentTrustScore < trustThreshold) {
      blockers.push(`Trust score ${currentTrustScore}% is below ${trustThreshold}% threshold`);
    }
    if (accuracyRate < 80) {
      blockers.push(`Accuracy rate ${accuracyRate}% is below 80% minimum`);
    }
    if (trustScore?.consecutive_failures > 0) {
      blockers.push(`${trustScore.consecutive_failures} consecutive failures must be resolved`);
    }
    if (canaryDaysCompleted < (config?.live_min_canary_days || 7)) {
      blockers.push(`Canary mode must run for ${config?.live_min_canary_days || 7} days (completed: ${canaryDaysCompleted})`);
    }
    if (canaryCallsEvaluated < 50) {
      blockers.push(`At least 50 canary calls required (completed: ${canaryCallsEvaluated})`);
    }
    if (globalKill?.is_active) {
      blockers.push("Global kill switch is active");
    }
    if (businessKill?.is_active) {
      blockers.push("Business kill switch is active");
    }

    // If blockers exist, return them
    if (blockers.length > 0) {
      return new Response(
        JSON.stringify({
          authorized: false,
          blockers,
          evidence: {
            trust_score: currentTrustScore,
            accuracy_rate: accuracyRate,
            canary_days: canaryDaysCompleted,
            canary_calls: canaryCallsEvaluated,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Create authorization record
    const evidenceSnapshot = {
      trust_score: currentTrustScore,
      accuracy_rate: accuracyRate,
      total_predictions: trustScore?.total_predictions || 0,
      accurate_predictions: trustScore?.accurate_predictions || 0,
      human_override_count: trustScore?.human_override_count || 0,
      canary_calls: canaryCallsEvaluated,
      canary_days: canaryDaysCompleted,
      config_snapshot: config,
      captured_at: new Date().toISOString(),
    };

    const { data: authorization, error: authError } = await supabase
      .from("ai_live_authorizations")
      .insert({
        business_id,
        justification,
        authorized_by,
        authorized_at: new Date().toISOString(),
        status: "approved",
        evidence_snapshot: evidenceSnapshot,
        trust_score_at_approval: currentTrustScore,
        accuracy_rate_at_approval: accuracyRate,
        canary_days_completed: canaryDaysCompleted,
        canary_calls_evaluated: canaryCallsEvaluated,
        expires_at: expires_at || null,
        auto_renew,
      })
      .select()
      .single();

    if (authError) throw authError;

    // Step 3: Update config to Live mode
    await supabase
      .from("ai_call_agent_config")
      .update({
        mode: "live",
        live_mode_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business_id);

    // Step 4: Log mode transition
    await supabase.from("mode_transition_logs").insert({
      business_id,
      from_mode: config?.mode || "canary",
      to_mode: "live",
      trigger_reason: `Admin authorized Live Mode: ${justification}`,
      was_automatic: false,
    });

    // Step 5: Log audit event
    await supabase.rpc("log_ai_audit_event", {
      p_business_id: business_id,
      p_event_type: "authorization_granted",
      p_event_severity: "info",
      p_authorization_id: authorization.id,
      p_event_payload: {
        justification,
        evidence: evidenceSnapshot,
        expires_at,
      },
      p_trust_score: currentTrustScore,
      p_triggered_by: "human",
      p_actor_user_id: authorized_by,
    });

    return new Response(
      JSON.stringify({
        authorized: true,
        authorization_id: authorization.id,
        evidence: evidenceSnapshot,
        expires_at: authorization.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Authorization error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
