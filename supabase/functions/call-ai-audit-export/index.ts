import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * call-ai-audit-export
 * 
 * Regulatory-grade export of all AI Call Agent audit data.
 * One button. One package.
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
      start_date,
      end_date,
      include_transcripts = false,
      redact_pii = true,
    } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: "Missing required: business_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    // 1. Get Live Mode Authorizations
    const { data: authorizations } = await supabase
      .from("ai_live_authorizations")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    // 2. Get Audit Events
    const { data: auditEvents } = await supabase
      .from("ai_audit_events")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    // 3. Get Mode Transitions
    const { data: modeTransitions } = await supabase
      .from("mode_transition_logs")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    // 4. Get AI Decisions
    const { data: decisions } = await supabase
      .from("ai_call_decisions")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    // 5. Get AI Predictions with accuracy
    const { data: predictions } = await supabase
      .from("ai_call_predictions")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    // 6. Get Trust Score History
    const { data: trustScores } = await supabase
      .from("ai_trust_scores")
      .select("*")
      .eq("business_id", business_id);

    // 7. Get Kill Switch Events
    const { data: killSwitchLogs } = await supabase
      .from("ai_kill_switch_state")
      .select("*")
      .or(`scope.eq.global,business_id.eq.${business_id}`);

    // 8. Get Canary Logs
    const { data: canaryLogs } = await supabase
      .from("canary_call_log")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    // 9. Get Human Overrides
    const overridePredictions = predictions?.filter(p => p.human_overrode) || [];

    // 10. Get AI Agent Failures
    const { data: failures } = await supabase
      .from("ai_agent_failures")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // Calculate summary statistics
    const totalPredictions = predictions?.length || 0;
    const accuratePredictions = predictions?.filter(p => p.was_accurate).length || 0;
    const overrideCount = overridePredictions.length;
    const failureCount = failures?.length || 0;

    // Redact PII if requested
    const redactPhone = (phone: string | null) => {
      if (!phone || !redact_pii) return phone;
      return phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2");
    };

    const redactTranscript = (transcript: string | null) => {
      if (!transcript || !redact_pii) return include_transcripts ? transcript : "[REDACTED]";
      if (!include_transcripts) return "[REDACTED]";
      // Basic PII redaction patterns
      return transcript
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
        .replace(/\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, "[SSN]");
    };

    // Build export package
    const exportPackage = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        business_id,
        date_range: { start: startDate, end: endDate },
        include_transcripts,
        redact_pii,
        export_version: "1.0",
      },
      summary: {
        total_predictions: totalPredictions,
        accurate_predictions: accuratePredictions,
        accuracy_rate: totalPredictions > 0 ? ((accuratePredictions / totalPredictions) * 100).toFixed(2) + "%" : "N/A",
        human_overrides: overrideCount,
        override_rate: totalPredictions > 0 ? ((overrideCount / totalPredictions) * 100).toFixed(2) + "%" : "N/A",
        failures: failureCount,
        mode_transitions: modeTransitions?.length || 0,
        audit_events: auditEvents?.length || 0,
        canary_calls: canaryLogs?.length || 0,
      },
      current_trust_state: trustScores?.[0] || null,
      authorizations: authorizations?.map(a => ({
        ...a,
        // Keep evidence but note it's a snapshot
        evidence_snapshot: a.evidence_snapshot,
      })) || [],
      mode_transitions: modeTransitions || [],
      audit_events: auditEvents?.map(e => ({
        ...e,
        transcript_snapshot: redactTranscript(e.transcript_snapshot),
      })) || [],
      decisions: decisions?.map(d => ({
        ...d,
        transcript_snapshot: redactTranscript(d.transcript_snapshot),
      })) || [],
      predictions: predictions?.map(p => ({
        ...p,
        caller_phone: redactPhone(p.caller_phone),
      })) || [],
      human_overrides: overridePredictions.map(p => ({
        prediction_id: p.id,
        predicted_intent: p.predicted_intent,
        actual_outcome: p.actual_outcome,
        override_reason: p.override_reason,
        created_at: p.created_at,
      })),
      failures: failures || [],
      canary_logs: canaryLogs?.map(c => ({
        ...c,
        // Redact sensitive details
      })) || [],
      kill_switch_history: killSwitchLogs || [],
    };

    return new Response(
      JSON.stringify(exportPackage),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
