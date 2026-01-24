import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Live Mode Gate - Validates ALL hard requirements before AI can answer autonomously
 * 
 * Entry Requirements (ALL must be true):
 * 1. Canary Mode has run for minimum configurable period
 * 2. Trust Score ≥ 92 (configurable)
 * 3. Human override rate ≤ 10% (configurable)
 * 4. Consecutive failure count = 0
 * 5. No unresolved critical incidents
 * 6. Admin explicitly enabled Live Mode
 * 7. Kill switch is OFF
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { business_id, session_id } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: "business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch live mode config
    const { data: config } = await supabase
      .from("ai_call_agent_config")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({
          allowed: false,
          mode: "shadow",
          blockers: ["No AI agent config found for business"],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    // Gate 1: Live mode must be explicitly enabled
    if (!config.live_mode_enabled) {
      blockers.push("Live mode not enabled by admin");
    }

    // Gate 2: Kill switch must be OFF
    if (config.live_kill_switch) {
      blockers.push("Live mode kill switch is active");
    }

    // Gate 3: Mode must be 'live'
    if (config.mode !== "live") {
      blockers.push(`Current mode is '${config.mode}', not 'live'`);
    }

    // Gate 4: Trust score threshold
    const { data: trustData } = await supabase
      .from("ai_trust_scores")
      .select("*")
      .eq("business_id", business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const currentTrustScore = trustData?.trust_score || 0;
    const trustThreshold = config.live_trust_threshold || 92;

    if (currentTrustScore < trustThreshold) {
      blockers.push(`Trust score ${currentTrustScore.toFixed(1)}% below ${trustThreshold}% threshold`);
    }

    // Gate 5: Override rate check
    const overrideRate = trustData?.human_override_rate || 0;
    const maxOverrideRate = config.live_max_override_rate || 10;

    if (overrideRate > maxOverrideRate) {
      blockers.push(`Override rate ${overrideRate.toFixed(1)}% exceeds ${maxOverrideRate}% limit`);
    }

    // Gate 6: Consecutive failures must be 0
    const consecutiveFailures = trustData?.consecutive_failures || 0;
    if (consecutiveFailures > 0) {
      blockers.push(`${consecutiveFailures} consecutive failures exist`);
    }

    // Gate 7: Check canary minimum days
    const minCanaryDays = config.live_min_canary_days || 7;
    const { data: modeTransitions } = await supabase
      .from("mode_transition_logs")
      .select("*")
      .eq("business_id", business_id)
      .eq("to_mode", "canary")
      .order("created_at", { ascending: false })
      .limit(1);

    if (modeTransitions && modeTransitions.length > 0) {
      const canaryStart = new Date(modeTransitions[0].created_at);
      const daysSinceCanary = Math.floor(
        (Date.now() - canaryStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCanary < minCanaryDays) {
        blockers.push(`Canary mode ran for ${daysSinceCanary} days, minimum ${minCanaryDays} required`);
      }
    } else {
      blockers.push("No canary mode history found - canary must run first");
    }

    // Gate 8: No unresolved critical incidents
    const { count: unresolvedCount } = await supabase
      .from("call_outcomes")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business_id)
      .in("resolution_status", ["pending", "in_progress"])
      .eq("is_critical", true);

    if ((unresolvedCount || 0) > 0) {
      blockers.push(`${unresolvedCount} unresolved critical incidents`);
    }

    // Gate 9: Callable human fallback must exist
    const { count: callableCount } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_callable", true)
      .not("phone", "is", null);

    if ((callableCount || 0) === 0) {
      blockers.push("No callable human fallback available");
    }

    // Determine if AI can proceed in live mode
    const allowLiveMode = blockers.length === 0;
    const fallbackMode = blockers.length > 0 
      ? (config.mode === "live" ? "canary" : config.mode) 
      : "live";

    // Log the gate check
    await supabase.from("ai_audit_logs").insert({
      session_id,
      business_id,
      audit_type: "live_gate_check",
      payload: {
        allowed: allowLiveMode,
        blockers,
        warnings,
        trust_score: currentTrustScore,
        override_rate: overrideRate,
        consecutive_failures: consecutiveFailures,
        callable_humans: callableCount,
      },
    });

    return new Response(
      JSON.stringify({
        allowed: allowLiveMode,
        mode: allowLiveMode ? "live" : fallbackMode,
        blockers,
        warnings,
        metrics: {
          trust_score: currentTrustScore,
          trust_threshold: trustThreshold,
          override_rate: overrideRate,
          max_override_rate: maxOverrideRate,
          consecutive_failures: consecutiveFailures,
          callable_humans: callableCount,
        },
        config: {
          disclosure_script: config.ai_disclosure_script,
          escape_phrases: config.escape_phrases,
          high_risk_keywords: config.high_risk_keywords,
          consent_recording_enabled: config.consent_recording_enabled,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Live gate error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, allowed: false, mode: "shadow" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});