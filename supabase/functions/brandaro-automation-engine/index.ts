import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { dry_run } = await req.json().catch(() => ({ dry_run: false }));
    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-automation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // ─── TRIGGER 1: NEW LEADS (no task assigned within 5 min) ───
    const { data: newLeads } = await supabase
      .from("brandaro_va_lead_heat")
      .select("id, lead_id, heat_score")
      .eq("heat_score", 0)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(20);

    for (const lead of newLeads || []) {
      // Auto-create a task for this lead
      await supabase.from("brandaro_va_task_queue").insert({
        lead_id: lead.lead_id || lead.id,
        task_type: "first_contact",
        status: "pending",
        priority: "high",
        notes: "Auto-generated: New lead requires first contact",
      });
      await logAutomation(supabase, "new_lead", lead.lead_id || lead.id, "create_task", { task_type: "first_contact" });
      results.push({ trigger: "new_lead", lead_id: lead.id, action: "task_created" });
    }

    // ─── TRIGGER 2: HOT LEADS (heat_score >= 70, not yet escalated) ───
    const { data: hotLeads } = await supabase
      .from("brandaro_va_lead_heat")
      .select("id, lead_id, heat_score")
      .gte("heat_score", 70)
      .limit(20);

    for (const lead of hotLeads || []) {
      // Check if already has a hot_lead log in last hour
      const { count } = await supabase
        .from("brandaro_automation_log")
        .select("id", { count: "exact", head: true })
        .eq("trigger_type", "hot_lead")
        .eq("lead_id", lead.lead_id || lead.id)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if ((count || 0) === 0) {
        // Create urgent callback task
        await supabase.from("brandaro_va_task_queue").insert({
          lead_id: lead.lead_id || lead.id,
          task_type: "hot_lead_callback",
          status: "pending",
          priority: "urgent",
          notes: `Auto-escalated: Heat score ${lead.heat_score}. Immediate callback required.`,
        });
        // Create alert
        await supabase.from("brandaro_va_alerts").insert({
          title: `🔥 Hot Lead Detected (Score: ${lead.heat_score})`,
          severity: "critical",
          alert_type: "hot_lead",
          lead_id: lead.lead_id || lead.id,
          dismissed: false,
        });
        await logAutomation(supabase, "hot_lead", lead.lead_id || lead.id, "escalate_and_alert", { heat_score: lead.heat_score });
        results.push({ trigger: "hot_lead", lead_id: lead.id, action: "escalated" });
      }
    }

    // ─── TRIGGER 3: STALE LEADS (no activity 48h+) ───
    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleLeads } = await supabase
      .from("brandaro_va_lead_heat")
      .select("id, lead_id, heat_score")
      .lt("updated_at", staleThreshold)
      .gt("heat_score", 0)
      .lt("heat_score", 70)
      .limit(20);

    for (const lead of staleLeads || []) {
      const { count } = await supabase
        .from("brandaro_automation_log")
        .select("id", { count: "exact", head: true })
        .eq("trigger_type", "stale_lead")
        .eq("lead_id", lead.lead_id || lead.id)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if ((count || 0) === 0) {
        await supabase.from("brandaro_va_task_queue").insert({
          lead_id: lead.lead_id || lead.id,
          task_type: "re_engagement",
          status: "pending",
          priority: "medium",
          notes: "Auto-generated: Lead inactive 48h+. Re-engagement required.",
        });
        await logAutomation(supabase, "stale_lead", lead.lead_id || lead.id, "re_engagement_task", { last_activity: lead.lead_id });
        results.push({ trigger: "stale_lead", lead_id: lead.id, action: "re_engagement" });
      }
    }

    // ─── TRIGGER 4: PENDING FOLLOW-UP QUEUE ───
    const { data: dueFollowups } = await supabase
      .from("brandaro_followup_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(20);

    for (const fu of dueFollowups || []) {
      // Create task from followup
      await supabase.from("brandaro_va_task_queue").insert({
        lead_id: fu.lead_id,
        task_type: `followup_step_${fu.step_number}`,
        status: "pending",
        priority: fu.step_number >= 3 ? "high" : "medium",
        notes: fu.message_template || `Auto follow-up step ${fu.step_number}`,
      });
      await supabase
        .from("brandaro_followup_queue")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("id", fu.id);
      await logAutomation(supabase, "followup_due", fu.lead_id, "execute_followup", { step: fu.step_number, channel: fu.channel });
      results.push({ trigger: "followup", lead_id: fu.lead_id, step: fu.step_number });
    }

    // ─── TRIGGER 5: PERSONALITY AUTO-OPTIMIZATION ───
    // Demote personalities with <10% conversion after 20+ uses
    const { data: personalities } = await supabase
      .from("brandaro_personalities")
      .select("id, name, total_uses, conversion_rate, is_active")
      .eq("is_active", true)
      .gte("total_uses", 20)
      .lt("conversion_rate", 10);

    for (const p of personalities || []) {
      await supabase.from("brandaro_personalities").update({ is_active: false }).eq("id", p.id);
      await supabase.from("brandaro_va_alerts").insert({
        title: `⚠️ Personality "${p.name}" auto-disabled (${p.conversion_rate}% conv after ${p.total_uses} uses)`,
        severity: "warning",
        alert_type: "personality_disabled",
        dismissed: false,
      });
      await logAutomation(supabase, "personality_optimization", p.id, "disable_low_performer", { conversion_rate: p.conversion_rate, total_uses: p.total_uses });
      results.push({ trigger: "personality_opt", personality: p.name, action: "disabled" });
    }

    // Update automation execution counts
    const triggerCounts: Record<string, number> = {};
    for (const r of results) {
      triggerCounts[r.trigger] = (triggerCounts[r.trigger] || 0) + 1;
    }

    return new Response(JSON.stringify({
      status: "ok",
      processed: results.length,
      triggers: triggerCounts,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Automation engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logAutomation(
  supabase: any,
  triggerType: string,
  leadId: string,
  action: string,
  details: any
) {
  await supabase.from("brandaro_automation_log").insert({
    trigger_type: triggerType,
    lead_id: leadId,
    action_taken: action,
    action_details: details,
    result: "success",
  });
}
