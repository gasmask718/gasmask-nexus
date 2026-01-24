import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Live Mode Gate - Validates ALL hard requirements before AI can answer autonomously
 * 
 * AUDIT HARDENED: Every code path logs a decision before returning.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate trace ID for this gate check (survives even if session_id is null)
  const decision_trace_id = crypto.randomUUID();
  let auditLogId: string | null = null;
  let auditLogStatus = "pending";

  try {
    const { business_id, session_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Helper to log decision and capture result
    // NOTE: session_id may be null or not exist in ai_call_sessions yet
    // Use ai_audit_events which doesn't require session_id FK
    const logAuditDecision = async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("ai_audit_events")
        .insert({
          business_id: business_id || "00000000-0000-0000-0000-000000000000",
          session_id: null, // Don't use session_id to avoid FK issues
          event_type: "live_gate_check",
          event_severity: payload.allowed ? "info" : "warning",
          event_payload: { ...payload, decision_trace_id },
          triggered_by: "system",
        })
        .select("id")
        .single();

      if (error) {
        console.error("AUDIT EVENT INSERT FAILED:", { error, payload, decision_trace_id });
        auditLogStatus = "failed";
        return null;
      }
      auditLogStatus = "ok";
      return data?.id || null;
    };

    if (!business_id) {
      auditLogId = await logAuditDecision({
        decision: "blocked",
        reason: "MISSING_BUSINESS_ID",
        allowed: false,
      });

      return new Response(
        JSON.stringify({ 
          error: "business_id required",
          allowed: false,
          mode: "shadow",
          audit_log_id: auditLogId,
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "x-audit-log-status": auditLogStatus,
          } 
        }
      );
    }

    // Fetch live mode config
    const { data: config } = await supabase
      .from("ai_call_agent_config")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (!config) {
      auditLogId = await logAuditDecision({
        decision: "blocked",
        reason: "NO_CONFIG",
        allowed: false,
        business_id,
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          mode: "shadow",
          blockers: ["No AI agent config found for business"],
          audit_log_id: auditLogId,
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "x-audit-log-status": auditLogStatus,
          } 
        }
      );
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    // Gate 1: Live mode must be explicitly enabled
    if (!config.live_mode_enabled) {
      blockers.push("Live mode not enabled by admin");
    }

    // Gate 2: Config kill switch must be OFF
    if (config.live_kill_switch) {
      blockers.push("Live mode kill switch is active (config)");
    }

    // Gate 2b: Check GLOBAL kill switch state
    const { data: globalKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active, activation_reason")
      .eq("scope", "global")
      .eq("is_active", true)
      .maybeSingle();

    if (globalKill?.is_active) {
      blockers.push(`GLOBAL_KILL_SWITCH: ${globalKill.activation_reason || "Emergency stop"}`);
    }

    // Gate 2c: Check BUSINESS-level kill switch state
    const { data: businessKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active, activation_reason")
      .eq("scope", "business")
      .eq("business_id", business_id)
      .eq("is_active", true)
      .maybeSingle();

    if (businessKill?.is_active) {
      blockers.push(`BUSINESS_KILL_SWITCH: ${businessKill.activation_reason || "Emergency stop"}`);
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
      blockers.push("NO_CALLABLE_FALLBACK");
    }

    // Gate 10: EXPLICIT AUTHORIZATION REQUIRED
    const { data: authorization } = await supabase
      .from("ai_live_authorizations")
      .select("*")
      .eq("business_id", business_id)
      .eq("status", "approved")
      .order("authorized_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!authorization) {
      blockers.push("No explicit Live Mode authorization record exists - admin approval required");
    } else if (authorization.expires_at && new Date(authorization.expires_at) < new Date()) {
      blockers.push(`Live Mode authorization expired at ${authorization.expires_at}`);
    }

    // Determine if AI can proceed
    const allowLiveMode = blockers.length === 0;
    const fallbackMode = blockers.length > 0 
      ? (config.mode === "live" ? "canary" : config.mode) 
      : "live";

    // LOG THE DECISION (MANDATORY - before any return)
    auditLogId = await logAuditDecision({
      decision: allowLiveMode ? "allowed" : "blocked",
      reason: allowLiveMode ? "ALL_GATES_PASSED" : blockers.join("; "),
      allowed: allowLiveMode,
      blockers,
      warnings,
      trust_score: currentTrustScore,
      override_rate: overrideRate,
      consecutive_failures: consecutiveFailures,
      callable_humans: callableCount,
      authorization_id: authorization?.id || null,
    });

    return new Response(
      JSON.stringify({
        allowed: allowLiveMode,
        mode: allowLiveMode ? "live" : fallbackMode,
        blockers,
        warnings,
        audit_log_id: auditLogId,
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
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "x-audit-log-status": auditLogStatus,
        } 
      }
    );
  } catch (error) {
    console.error("Live gate error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    
    // Log system error before returning
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data, error: logError } = await supabase
        .from("ai_audit_events")
        .insert({
          business_id: "00000000-0000-0000-0000-000000000000",
          event_type: "live_gate_error",
          event_severity: "error",
          event_payload: { 
            decision: "blocked",
            reason: "SYSTEM_ERROR",
            error: message, 
            decision_trace_id,
          },
          triggered_by: "system",
        })
        .select("id")
        .single();
      
      if (logError) {
        console.error("AUDIT LOG INSERT FAILED ON ERROR PATH:", logError);
        auditLogStatus = "failed";
      } else {
        auditLogId = data?.id;
        auditLogStatus = "ok";
      }
    } catch (logErr) {
      console.error("Failed to log error audit:", logErr);
      auditLogStatus = "failed";
    }

    return new Response(
      JSON.stringify({ 
        error: message, 
        allowed: false, 
        mode: "shadow",
        audit_log_id: auditLogId,
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "x-audit-log-status": auditLogStatus,
        } 
      }
    );
  }
});
