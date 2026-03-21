import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find unread alerts older than 24 hours
    const { data: staleAlerts } = await supabase
      .from("ai_drift_alerts")
      .select("*")
      .eq("status", "open")
      .lt("created_at", twentyFourHoursAgo)
      .limit(50);

    let escalated = 0;

    for (const alert of staleAlerts || []) {
      const newSeverity = alert.severity === "info" ? "warning"
        : alert.severity === "warning" ? "critical"
        : "critical";

      // Only escalate if severity actually changes
      if (newSeverity === alert.severity) continue;

      await supabase
        .from("ai_drift_alerts")
        .update({ severity: newSeverity, metadata: { ...((alert.metadata as any) || {}), escalated: true, previous_severity: alert.severity } })
        .eq("id", alert.id);

      // Create escalation task
      const storeId = (alert.metadata as any)?.store_id;
      await supabase.from("ai_work_tasks").insert({
        task_title: `ESCALATED: ${alert.message?.substring(0, 80)}`,
        task_details: `Alert unread for 24+ hours. Severity escalated from ${alert.severity} to ${newSeverity}. Original alert: ${alert.message}`,
        status: "pending",
        priority: "critical",
        task_type: "alert_escalation",
        department: "operations",
        input_data: { alert_id: alert.id, store_id: storeId, original_severity: alert.severity },
      });

      // Log to instinct log
      await supabase.from("ai_instinct_log").insert({
        action_type: "alert_escalated",
        reasoning: `Alert "${alert.message}" unread for 24h. Escalated from ${alert.severity} to ${newSeverity}.`,
        input_data: { alert_id: alert.id },
        decision_path: { agent: "Alert Escalation Engine", from: alert.severity, to: newSeverity },
        confidence_score: 1.0,
      });

      escalated++;
    }

    return new Response(JSON.stringify({ success: true, escalated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Alert escalation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
