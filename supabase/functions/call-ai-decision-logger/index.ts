import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Decision Logger - Creates immutable records of every AI decision
 * 
 * AUDIT HARDENED: Every insert is checked for errors.
 * Returns x-audit-log-status header and audit_log_id in response.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const decision_trace_id = crypto.randomUUID();
  let auditLogStatus = "pending";
  let decisionId: string | null = null;

  try {
    const {
      session_id,
      business_id,
      decision_type,
      decision_reason,
      confidence,
      risk_level,
      active_thresholds,
      rule_applied,
      caller_sentiment,
      intent,
      transcript_snapshot,
    } = await req.json();

    if (!session_id || !decision_type) {
      return new Response(
        JSON.stringify({ 
          error: "session_id and decision_type required",
          decision_trace_id,
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "x-audit-log-status": "failed",
          } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log the decision with error checking
    const { data: decision, error: decisionError } = await supabase
      .from("ai_call_decisions")
      .insert({
        session_id,
        business_id,
        decision_type,
        decision_reason,
        confidence_at_decision: confidence,
        risk_level: risk_level || "low",
        active_thresholds: active_thresholds || {},
        rule_applied,
        caller_sentiment,
        intent_at_decision: intent,
        transcript_snapshot,
      })
      .select()
      .single();

    if (decisionError) {
      console.error("DECISION INSERT FAILED:", { 
        error: decisionError, 
        session_id, 
        decision_type,
        decision_trace_id,
      });
      auditLogStatus = "failed";
      
      return new Response(
        JSON.stringify({ 
          error: `Decision log failed: ${decisionError.message}`,
          decision_trace_id,
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

    decisionId = decision.id;
    auditLogStatus = "ok";

    // If this is an escalation or high-risk event, log to risk events
    if (decision_type === "escalate" || risk_level === "high" || risk_level === "critical") {
      const { error: riskError } = await supabase.from("ai_risk_events").insert({
        session_id,
        business_id,
        risk_level: risk_level || "high",
        risk_triggers: [decision_reason],
        escalation_required: decision_type === "escalate",
        escalation_executed: decision_type === "escalate",
      });

      if (riskError) {
        console.error("RISK EVENT INSERT FAILED:", riskError);
        // Don't fail the whole request, but note it
      }
    }

    // Create audit log entry
    const { error: auditError } = await supabase.from("ai_audit_logs").insert({
      session_id,
      business_id,
      audit_type: "decision",
      payload: {
        decision_id: decision.id,
        decision_type,
        decision_reason,
        confidence,
        risk_level,
        rule_applied,
        decision_trace_id,
      },
      transcript_at_event: transcript_snapshot,
    });

    if (auditError) {
      console.error("AUDIT LOG INSERT FAILED:", auditError);
      // Primary decision logged, but audit log failed
    }

    // Check if we need to trigger auto-downgrade
    if (decision_type === "escalate" || risk_level === "critical") {
      const { count: recentFailures } = await supabase
        .from("ai_call_decisions")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business_id)
        .eq("decision_type", "escalate")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if ((recentFailures || 0) >= 3) {
        const { error: warningError } = await supabase.from("ai_audit_logs").insert({
          session_id,
          business_id,
          audit_type: "auto_downgrade_warning",
          payload: {
            reason: "Multiple escalations in past hour",
            escalation_count: recentFailures,
            threshold: 3,
            decision_trace_id,
          },
        });

        if (warningError) {
          console.error("AUTO-DOWNGRADE WARNING INSERT FAILED:", warningError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        decision_id: decision.id,
        logged_at: decision.created_at,
        decision_trace_id,
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
    console.error("Decision logger error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ 
        error: message,
        decision_trace_id,
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "x-audit-log-status": "failed",
        } 
      }
    );
  }
});
