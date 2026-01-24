import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SentinelRequest {
  business_id?: string;
  evaluation_type?: string;
  trigger_event?: string;
}

interface DriftResult {
  severity: "info" | "warning" | "critical";
  drift_type: string;
  metric_name: string;
  baseline_value: number;
  current_value: number;
  deviation_magnitude: number;
  deviation_percentage: number;
  drift_direction: string;
}

function computeHash(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { business_id, evaluation_type = "scheduled", trigger_event }: SentinelRequest = 
      await req.json().catch(() => ({}));

    // 1. Get or create sentinel status
    let { data: sentinelStatus } = await supabase
      .from("sentinel_status")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (!sentinelStatus) {
      const { data: newStatus } = await supabase
        .from("sentinel_status")
        .insert({ business_id, sentinel_enabled: true })
        .select()
        .single();
      sentinelStatus = newStatus;
    }

    // Check if sentinel is enabled
    if (!sentinelStatus?.sentinel_enabled) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Sentinel is disabled - this has been logged as a critical event" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get active baseline
    const { data: baseline } = await supabase
      .from("compliance_baselines")
      .select("*")
      .eq("is_active", true)
      .eq("business_id", business_id)
      .single();

    if (!baseline) {
      // No baseline - cannot evaluate
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No active compliance baseline. Certify a baseline first.",
          requires_baseline: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get previous evaluation for hash chain
    const { data: prevEvaluation } = await supabase
      .from("sentinel_evaluations")
      .select("id, evaluation_hash")
      .eq("business_id", business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 4. Create evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from("sentinel_evaluations")
      .insert({
        business_id,
        baseline_id: baseline.id,
        evaluation_type,
        trigger_event,
        started_at: new Date().toISOString(),
        status: "running",
        prev_evaluation_id: prevEvaluation?.id,
        prev_evaluation_hash: prevEvaluation?.evaluation_hash,
      })
      .select()
      .single();

    if (evalError) throw evalError;

    // 5. Get current metrics (from latest compliance snapshot)
    const { data: currentMetrics } = await supabase
      .from("compliance_metrics_snapshots")
      .select("*")
      .eq("business_id", business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 6. Compare against baseline thresholds
    const drifts: DriftResult[] = [];

    if (currentMetrics) {
      // Permission rate check
      if (currentMetrics.ai_permission_rate < baseline.min_permission_rate) {
        const deviation = baseline.min_permission_rate - currentMetrics.ai_permission_rate;
        drifts.push({
          severity: deviation > 5 ? "critical" : deviation > 2 ? "warning" : "info",
          drift_type: "permission_rate_low",
          metric_name: "ai_permission_rate",
          baseline_value: baseline.min_permission_rate,
          current_value: currentMetrics.ai_permission_rate,
          deviation_magnitude: deviation,
          deviation_percentage: (deviation / baseline.min_permission_rate) * 100,
          drift_direction: "below_threshold",
        });
      }

      // Kill switch latency check
      if (currentMetrics.kill_switch_avg_latency_ms > baseline.max_kill_switch_latency_ms) {
        const deviation = currentMetrics.kill_switch_avg_latency_ms - baseline.max_kill_switch_latency_ms;
        drifts.push({
          severity: deviation > 100 ? "critical" : deviation > 50 ? "warning" : "info",
          drift_type: "kill_switch_latency_high",
          metric_name: "kill_switch_avg_latency_ms",
          baseline_value: baseline.max_kill_switch_latency_ms,
          current_value: currentMetrics.kill_switch_avg_latency_ms,
          deviation_magnitude: deviation,
          deviation_percentage: (deviation / baseline.max_kill_switch_latency_ms) * 100,
          drift_direction: "above_threshold",
        });
      }

      // Confidence breach check
      const breachRate = currentMetrics.confidence_breach_count > 0 ? 
        (currentMetrics.confidence_breach_count / Math.max(1, currentMetrics.confidence_breach_count + 100)) * 100 : 0;
      if (breachRate > baseline.max_confidence_breach_rate) {
        drifts.push({
          severity: breachRate > 5 ? "critical" : breachRate > 2 ? "warning" : "info",
          drift_type: "confidence_breach_rate_high",
          metric_name: "confidence_breach_rate",
          baseline_value: baseline.max_confidence_breach_rate,
          current_value: breachRate,
          deviation_magnitude: breachRate - baseline.max_confidence_breach_rate,
          deviation_percentage: ((breachRate - baseline.max_confidence_breach_rate) / baseline.max_confidence_breach_rate) * 100,
          drift_direction: "above_threshold",
        });
      }

      // Human takeover latency check
      if (currentMetrics.human_takeover_avg_latency_ms > baseline.max_human_takeover_latency_ms) {
        const deviation = currentMetrics.human_takeover_avg_latency_ms - baseline.max_human_takeover_latency_ms;
        drifts.push({
          severity: deviation > 3000 ? "critical" : deviation > 1000 ? "warning" : "info",
          drift_type: "human_takeover_latency_high",
          metric_name: "human_takeover_avg_latency_ms",
          baseline_value: baseline.max_human_takeover_latency_ms,
          current_value: currentMetrics.human_takeover_avg_latency_ms,
          deviation_magnitude: deviation,
          deviation_percentage: (deviation / baseline.max_human_takeover_latency_ms) * 100,
          drift_direction: "above_threshold",
        });
      }

      // Unapproved technique check (ZERO TOLERANCE)
      if (currentMetrics.unapproved_technique_count > baseline.max_unapproved_technique_count) {
        drifts.push({
          severity: "critical", // Always critical
          drift_type: "unapproved_technique_detected",
          metric_name: "unapproved_technique_count",
          baseline_value: baseline.max_unapproved_technique_count,
          current_value: currentMetrics.unapproved_technique_count,
          deviation_magnitude: currentMetrics.unapproved_technique_count,
          deviation_percentage: 100,
          drift_direction: "above_threshold",
        });
      }

      // Audit completeness check
      if (currentMetrics.audit_completeness_rate < baseline.min_audit_completeness_rate) {
        const deviation = baseline.min_audit_completeness_rate - currentMetrics.audit_completeness_rate;
        drifts.push({
          severity: deviation > 5 ? "critical" : deviation > 2 ? "warning" : "info",
          drift_type: "audit_completeness_low",
          metric_name: "audit_completeness_rate",
          baseline_value: baseline.min_audit_completeness_rate,
          current_value: currentMetrics.audit_completeness_rate,
          deviation_magnitude: deviation,
          deviation_percentage: (deviation / baseline.min_audit_completeness_rate) * 100,
          drift_direction: "below_threshold",
        });
      }
    }

    // 7. Store drift events
    const criticalDrifts = drifts.filter(d => d.severity === "critical");
    const warningDrifts = drifts.filter(d => d.severity === "warning");

    for (const drift of drifts) {
      await supabase.from("compliance_drift_events").insert({
        business_id,
        baseline_id: baseline.id,
        evaluation_id: evaluation.id,
        severity: drift.severity,
        drift_type: drift.drift_type,
        metric_name: drift.metric_name,
        baseline_value: drift.baseline_value,
        current_value: drift.current_value,
        deviation_magnitude: drift.deviation_magnitude,
        deviation_percentage: drift.deviation_percentage,
        drift_direction: drift.drift_direction,
        event_hash: computeHash(drift),
      });
    }

    // 8. Auto-containment for critical drifts
    let containmentAction = null;
    if (criticalDrifts.length > 0) {
      // Determine containment level based on severity
      const newMode = criticalDrifts.some(d => 
        d.drift_type === "unapproved_technique_detected" || 
        d.deviation_percentage > 50
      ) ? "assisted" : "canary";

      const { data: action } = await supabase
        .from("sentinel_containment_actions")
        .insert({
          business_id,
          evaluation_id: evaluation.id,
          action_type: `downgrade_to_${newMode}`,
          action_reason: `Critical drift detected: ${criticalDrifts.map(d => d.drift_type).join(", ")}`,
          severity_at_action: "critical",
          previous_mode: "live",
          new_mode: newMode,
          action_hash: computeHash({ criticalDrifts, timestamp: Date.now() }),
        })
        .select()
        .single();

      containmentAction = action;

      // Update AI call agent config to downgrade mode
      await supabase
        .from("ai_call_agent_config")
        .update({ 
          mode: newMode,
          live_mode_enabled: false,
        })
        .eq("business_id", business_id);
    }

    // 9. Calculate final evaluation status
    const evalStatus = criticalDrifts.length > 0 ? "critical" : 
                       warningDrifts.length > 0 ? "warning" : "passed";

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // 10. Update evaluation with results
    const evaluationData = {
      status: evalStatus,
      completed_at: completedAt,
      duration_ms: durationMs,
      drift_detected: drifts.length > 0,
      drift_count: drifts.length,
      metrics_evaluated: currentMetrics || {},
      thresholds_checked: {
        min_permission_rate: baseline.min_permission_rate,
        max_kill_switch_latency_ms: baseline.max_kill_switch_latency_ms,
        max_confidence_breach_rate: baseline.max_confidence_breach_rate,
        max_human_takeover_latency_ms: baseline.max_human_takeover_latency_ms,
        max_unapproved_technique_count: baseline.max_unapproved_technique_count,
        min_audit_completeness_rate: baseline.min_audit_completeness_rate,
      },
    };

    await supabase
      .from("sentinel_evaluations")
      .update({
        ...evaluationData,
        evaluation_hash: computeHash(evaluationData),
      })
      .eq("id", evaluation.id);

    // 11. Update sentinel status
    const complianceState = criticalDrifts.length > 0 ? "degraded" : 
                           warningDrifts.length > 0 ? "warning" : "compliant";

    await supabase
      .from("sentinel_status")
      .update({
        compliance_state: complianceState,
        last_evaluation_at: completedAt,
        last_evaluation_id: evaluation.id,
        last_evaluation_status: evalStatus,
        active_drift_count: drifts.length,
        active_critical_count: criticalDrifts.length,
        active_warning_count: warningDrifts.length,
        is_contained: criticalDrifts.length > 0,
        containment_level: criticalDrifts.length > 0 ? containmentAction?.new_mode : null,
        containment_reason: criticalDrifts.length > 0 ? containmentAction?.action_reason : null,
        containment_started_at: criticalDrifts.length > 0 ? completedAt : null,
        last_clean_evaluation_at: drifts.length === 0 ? completedAt : sentinelStatus?.last_clean_evaluation_at,
        updated_at: completedAt,
      })
      .eq("business_id", business_id);

    return new Response(
      JSON.stringify({
        success: true,
        evaluation_id: evaluation.id,
        status: evalStatus,
        compliance_state: complianceState,
        drifts_detected: drifts.length,
        critical_count: criticalDrifts.length,
        warning_count: warningDrifts.length,
        containment_triggered: !!containmentAction,
        containment_action: containmentAction?.action_type,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Sentinel evaluation error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
