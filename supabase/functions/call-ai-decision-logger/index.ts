import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Decision Logger - Creates immutable records of every AI decision
 * 
 * For every AI decision logs:
 * - Why AI continued
 * - Why AI escalated (or didn't)
 * - Which rule allowed it
 * - Which thresholds were active
 * 
 * This ledger must be queryable, exportable, and human-readable.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      session_id,
      business_id,
      decision_type, // 'continue', 'escalate', 'handoff', 'terminate'
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
        JSON.stringify({ error: "session_id and decision_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log the decision
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
      throw decisionError;
    }

    // If this is an escalation or high-risk event, log to risk events
    if (decision_type === "escalate" || risk_level === "high" || risk_level === "critical") {
      await supabase.from("ai_risk_events").insert({
        session_id,
        business_id,
        risk_level: risk_level || "high",
        risk_triggers: [decision_reason],
        escalation_required: decision_type === "escalate",
        escalation_executed: decision_type === "escalate",
      });
    }

    // Create audit log entry
    await supabase.from("ai_audit_logs").insert({
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
      },
      transcript_at_event: transcript_snapshot,
    });

    // Check if we need to trigger auto-downgrade
    if (decision_type === "escalate" || risk_level === "critical") {
      // Fetch recent failures
      const { count: recentFailures } = await supabase
        .from("ai_call_decisions")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business_id)
        .eq("decision_type", "escalate")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      // If too many escalations, trigger auto-downgrade consideration
      if ((recentFailures || 0) >= 3) {
        await supabase.from("ai_audit_logs").insert({
          session_id,
          business_id,
          audit_type: "auto_downgrade_warning",
          payload: {
            reason: "Multiple escalations in past hour",
            escalation_count: recentFailures,
            threshold: 3,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        decision_id: decision.id,
        logged_at: decision.created_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Decision logger error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});