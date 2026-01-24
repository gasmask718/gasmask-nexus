import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Auto-Downgrade Handler - Self-policing mode transitions
 * 
 * Triggers for automatic downgrade:
 * - N consecutive failures
 * - Spike in human overrides
 * - Drop in trust score
 * - Missed call due to AI error
 * - System health degradation
 * 
 * Downgrade path: Live → Canary → Assisted
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      business_id,
      trigger_type, // 'consecutive_failures', 'override_spike', 'trust_drop', 'ai_error', 'system_health'
      trigger_details,
      force_downgrade,
    } = await req.json();

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

    // Get current config
    const { data: config } = await supabase
      .from("ai_call_agent_config")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "No config found", downgraded: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentMode = config.mode;
    let shouldDowngrade = force_downgrade || false;
    let downgradeReason = trigger_type || "manual";

    // Evaluate auto-downgrade conditions
    if (!force_downgrade) {
      // Check consecutive failures
      const { data: trustData } = await supabase
        .from("ai_trust_scores")
        .select("*")
        .eq("business_id", business_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const consecutiveFailures = trustData?.consecutive_failures || 0;
      const maxFailures = config.max_consecutive_failures || 3;

      if (consecutiveFailures >= maxFailures) {
        shouldDowngrade = true;
        downgradeReason = `${consecutiveFailures} consecutive failures (max: ${maxFailures})`;
      }

      // Check trust score drop
      const trustScore = trustData?.trust_score || 0;
      const liveThreshold = config.live_trust_threshold || 92;
      const canaryThreshold = config.confidence_threshold || 85;

      if (currentMode === "live" && trustScore < liveThreshold) {
        shouldDowngrade = true;
        downgradeReason = `Trust score dropped to ${trustScore.toFixed(1)}% (threshold: ${liveThreshold}%)`;
      } else if (currentMode === "canary" && trustScore < canaryThreshold) {
        shouldDowngrade = true;
        downgradeReason = `Trust score dropped to ${trustScore.toFixed(1)}% (threshold: ${canaryThreshold}%)`;
      }

      // Check override rate spike
      const overrideRate = trustData?.human_override_rate || 0;
      const maxOverrideRate = config.live_max_override_rate || 10;

      if (currentMode === "live" && overrideRate > maxOverrideRate) {
        shouldDowngrade = true;
        downgradeReason = `Override rate spiked to ${overrideRate.toFixed(1)}% (max: ${maxOverrideRate}%)`;
      }
    }

    if (!shouldDowngrade) {
      return new Response(
        JSON.stringify({
          downgraded: false,
          current_mode: currentMode,
          reason: "No downgrade conditions met",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate new mode (downgrade path)
    const modeHierarchy = ["shadow", "assisted", "canary", "live"];
    const currentIndex = modeHierarchy.indexOf(currentMode);
    const newMode = currentIndex > 0 ? modeHierarchy[currentIndex - 1] : "shadow";

    // Update config
    const updatePayload: Record<string, unknown> = {
      mode: newMode,
      updated_at: new Date().toISOString(),
    };

    // If downgrading from live, also disable live mode
    if (currentMode === "live") {
      updatePayload.live_mode_enabled = false;
    }

    await supabase
      .from("ai_call_agent_config")
      .update(updatePayload)
      .eq("business_id", business_id);

    // Log the transition
    await supabase.from("mode_transition_logs").insert({
      business_id,
      from_mode: currentMode,
      to_mode: newMode,
      trigger_reason: downgradeReason,
      trigger_details: trigger_details || {},
      was_automatic: !force_downgrade,
    });

    // Create audit log
    await supabase.from("ai_audit_logs").insert({
      business_id,
      audit_type: "mode_downgrade",
      payload: {
        from_mode: currentMode,
        to_mode: newMode,
        reason: downgradeReason,
        was_automatic: !force_downgrade,
        trigger_type,
      },
    });

    // Reset consecutive failures after downgrade
    if (trigger_type === "consecutive_failures") {
      await supabase
        .from("ai_trust_scores")
        .update({ consecutive_failures: 0 })
        .eq("business_id", business_id);
    }

    return new Response(
      JSON.stringify({
        downgraded: true,
        from_mode: currentMode,
        to_mode: newMode,
        reason: downgradeReason,
        was_automatic: !force_downgrade,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-downgrade error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, downgraded: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});