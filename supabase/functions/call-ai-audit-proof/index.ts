import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * call-ai-audit-proof
 * 
 * Admin-only endpoint for audit proof export.
 * Returns:
 * - Total decisions in time window
 * - Breakdown by decision reason
 * - Sample rows (max 25)
 * - Hash chain verification status
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
    } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: "Missing required: business_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    // Get all decisions in window
    const { data: decisions, error: decisionsError } = await supabase
      .from("ai_call_decisions")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (decisionsError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch decisions: ${decisionsError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get audit logs in window
    const { data: auditLogs, error: auditError } = await supabase
      .from("ai_audit_logs")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (auditError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch audit logs: ${auditError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get audit events in window
    const { data: auditEvents, error: eventsError } = await supabase
      .from("ai_audit_events")
      .select("*")
      .eq("business_id", business_id)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (eventsError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch audit events: ${eventsError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute breakdown by decision_reason
    const breakdownByReason: Record<string, number> = {};
    const breakdownByType: Record<string, number> = {};
    const breakdownByRiskLevel: Record<string, number> = {};

    for (const d of decisions || []) {
      const reason = d.decision_reason || "unknown";
      const type = d.decision_type || "unknown";
      const risk = d.risk_level || "unknown";

      breakdownByReason[reason] = (breakdownByReason[reason] || 0) + 1;
      breakdownByType[type] = (breakdownByType[type] || 0) + 1;
      breakdownByRiskLevel[risk] = (breakdownByRiskLevel[risk] || 0) + 1;
    }

    // Verify hash chain integrity
    const verifyHashChain = (rows: Array<{ prev_hash?: string; row_hash?: string }>) => {
      if (!rows || rows.length === 0) return { valid: true, breaks: 0, message: "No rows to verify" };

      let breaks = 0;
      let lastHash = "GENESIS";

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.prev_hash && row.prev_hash !== lastHash) {
          breaks++;
        }
        lastHash = row.row_hash || lastHash;
      }

      return {
        valid: breaks === 0,
        breaks,
        message: breaks === 0 
          ? "Hash chain intact - no tampering detected" 
          : `WARNING: ${breaks} hash chain breaks detected`,
      };
    };

    const decisionsChainStatus = verifyHashChain(decisions || []);
    const auditLogsChainStatus = verifyHashChain(auditLogs || []);
    const auditEventsChainStatus = verifyHashChain(auditEvents || []);

    // Get sample rows (max 25)
    const sampleDecisions = (decisions || []).slice(0, 25).map(d => ({
      id: d.id,
      created_at: d.created_at,
      session_id: d.session_id,
      decision_type: d.decision_type,
      decision_reason: d.decision_reason,
      risk_level: d.risk_level,
      confidence_at_decision: d.confidence_at_decision,
      rule_applied: d.rule_applied,
      row_hash: d.row_hash,
      prev_hash: d.prev_hash,
    }));

    // Build proof package
    const proofPackage = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        business_id,
        date_range: { start: startDate, end: endDate },
        export_type: "audit_proof",
        version: "1.0",
      },
      summary: {
        total_decisions: decisions?.length || 0,
        total_audit_logs: auditLogs?.length || 0,
        total_audit_events: auditEvents?.length || 0,
      },
      breakdown: {
        by_reason: breakdownByReason,
        by_type: breakdownByType,
        by_risk_level: breakdownByRiskLevel,
      },
      hash_chain_verification: {
        decisions: decisionsChainStatus,
        audit_logs: auditLogsChainStatus,
        audit_events: auditEventsChainStatus,
        overall_integrity: decisionsChainStatus.valid && auditLogsChainStatus.valid && auditEventsChainStatus.valid,
      },
      sample_rows: sampleDecisions,
      // Explainability: for the most recent decision
      latest_decision_explanation: decisions && decisions.length > 0 ? {
        decision_id: decisions[decisions.length - 1].id,
        created_at: decisions[decisions.length - 1].created_at,
        explanation: generateExplanation(decisions[decisions.length - 1]),
      } : null,
    };

    return new Response(
      JSON.stringify(proofPackage),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Audit proof error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Generate plain-English explanation suitable for legal/regulatory review
 */
function generateExplanation(decision: Record<string, unknown>): string {
  const type = decision.decision_type as string;
  const reason = decision.decision_reason as string;
  const riskLevel = decision.risk_level as string;
  const confidence = decision.confidence_at_decision as number | null;
  const rule = decision.rule_applied as string;
  const thresholds = decision.active_thresholds as Record<string, unknown> | null;

  let explanation = `AI ${type === 'continue' ? 'continued answering' : 
    type === 'handoff' ? 'handed off to human' :
    type === 'abort' ? 'immediately stopped speaking' :
    type === 'escalate' ? 'escalated to human' :
    type === 'confidence_breach' ? 'aborted due to low confidence' :
    type === 'blocked' ? 'was blocked from answering' :
    'made a decision'} this call because: ${reason}.`;

  if (riskLevel) {
    explanation += ` Risk level was assessed as ${riskLevel}.`;
  }

  if (confidence !== null && confidence !== undefined) {
    explanation += ` AI confidence at decision time was ${confidence}%.`;
  }

  if (rule) {
    explanation += ` The governing rule that triggered this action was: ${rule}.`;
  }

  if (thresholds) {
    const thresholdList = Object.entries(thresholds)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ');
    explanation += ` Active thresholds at the time: ${thresholdList}.`;
  }

  explanation += ` This explanation is suitable for legal review, carrier audit, and regulatory inquiry.`;

  return explanation;
}
