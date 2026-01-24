import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EscalationRule {
  id: string;
  business_id: string;
  rule_name: string;
  trigger_type: string;
  trigger_threshold_minutes: number;
  action_type: string;
  action_target_role: string | null;
  action_target_user_id: string | null;
  auto_sms_template: string | null;
  is_enabled: boolean;
  priority: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, business_id } = body;

    let result: Record<string, unknown> = {};

    switch (action) {
      case "process_escalations": {
        // Get all enabled escalation rules
        let rulesQuery = supabase
          .from("call_escalation_rules")
          .select("*")
          .eq("is_enabled", true)
          .order("priority", { ascending: false });

        if (business_id) {
          rulesQuery = rulesQuery.eq("business_id", business_id);
        }

        const { data: rules } = await rulesQuery;
        if (!rules?.length) {
          result = { processed: 0, message: "No escalation rules configured" };
          break;
        }

        let escalationsCreated = 0;
        let tasksCreated = 0;
        let notificationsSent = 0;

        for (const rule of rules as EscalationRule[]) {
          const thresholdTime = new Date(Date.now() - rule.trigger_threshold_minutes * 60 * 1000).toISOString();

          switch (rule.trigger_type) {
            case "missed_call": {
              // Find unresolved missed calls older than threshold
              const { data: missedCalls } = await supabase
                .from("call_outcomes")
                .select("id, caller_number, business_id")
                .eq("business_id", rule.business_id)
                .eq("outcome", "missed")
                .eq("resolution_status", "unresolved")
                .lt("created_at", thresholdTime);

              for (const call of missedCalls || []) {
                await handleEscalationAction(supabase, rule, call, "missed_call");
                escalationsCreated++;
              }
              break;
            }

            case "voicemail_unresolved": {
              // Find unresolved voicemails older than threshold
              const { data: voicemails } = await supabase
                .from("voicemails")
                .select("id, caller_number, business_id, caller_name")
                .eq("business_id", rule.business_id)
                .eq("status", "new")
                .lt("created_at", thresholdTime);

              for (const vm of voicemails || []) {
                await handleEscalationAction(supabase, rule, vm, "voicemail_unresolved");
                tasksCreated++;
              }
              break;
            }

            case "repeat_caller": {
              // Find callers with 3+ voicemails without resolution
              const { data: repeatCallers } = await supabase
                .from("voicemails")
                .select("caller_number")
                .eq("business_id", rule.business_id)
                .eq("status", "new")
                .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

              // Count occurrences
              const callerCounts: Record<string, number> = {};
              for (const vm of repeatCallers || []) {
                if (vm.caller_number) {
                  callerCounts[vm.caller_number] = (callerCounts[vm.caller_number] || 0) + 1;
                }
              }

              // Escalate repeat callers
              for (const [number, count] of Object.entries(callerCounts)) {
                if (count >= 3) {
                  await handleEscalationAction(supabase, rule, { 
                    caller_number: number, 
                    business_id: rule.business_id,
                    repeat_count: count 
                  }, "repeat_caller");
                  notificationsSent++;
                }
              }
              break;
            }

            case "after_hours": {
              // Find after-hours missed calls without follow-up
              const { data: afterHoursMissed } = await supabase
                .from("call_outcomes")
                .select("id, caller_number, business_id")
                .eq("business_id", rule.business_id)
                .eq("outcome", "missed")
                .eq("is_business_hours", false)
                .eq("resolution_status", "unresolved")
                .lt("created_at", thresholdTime);

              for (const call of afterHoursMissed || []) {
                await handleEscalationAction(supabase, rule, call, "after_hours");
                escalationsCreated++;
              }
              break;
            }
          }
        }

        result = {
          processed: rules.length,
          escalations_created: escalationsCreated,
          tasks_created: tasksCreated,
          notifications_sent: notificationsSent,
        };
        break;
      }

      case "check_sla_breaches": {
        // Find follow-ups past their SLA deadline
        const { data: breachedFollowups } = await supabase
          .from("call_followups")
          .select("id, business_id, caller_number, title, sla_deadline, escalation_level")
          .eq("status", "pending")
          .lt("sla_deadline", new Date().toISOString())
          .eq("escalation_level", 0);

        let escalated = 0;
        for (const followup of breachedFollowups || []) {
          // Escalate the follow-up
          await supabase
            .from("call_followups")
            .update({
              escalation_level: 1,
              escalated_at: new Date().toISOString(),
              priority: "critical",
            })
            .eq("id", followup.id);

          // Create intelligence signal
          await supabase
            .from("call_intelligence_signals")
            .insert({
              business_id: followup.business_id,
              signal_type: "sla_breach",
              severity: "critical",
              title: `SLA Breached: ${followup.title}`,
              description: `Follow-up for ${followup.caller_number} exceeded SLA deadline`,
              suggested_action: "Immediate callback required",
              related_entity_type: "call_followup",
              related_entity_id: followup.id,
            });

          escalated++;
        }

        result = { sla_breaches_processed: escalated };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-escalation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleEscalationAction(
  supabase: any,
  rule: EscalationRule,
  entity: Record<string, unknown>,
  triggerType: string
) {
  switch (rule.action_type) {
    case "create_task": {
      await supabase.from("call_followups").insert({
        business_id: rule.business_id,
        source_type: triggerType,
        caller_number: entity.caller_number,
        followup_type: "callback",
        title: `[Auto] ${rule.rule_name}: ${entity.caller_number}`,
        description: `Auto-escalated: ${triggerType} threshold exceeded`,
        priority: "high",
        status: "pending",
        assigned_to: rule.action_target_user_id,
        sla_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      break;
    }
    case "notify_admin": {
      await supabase.from("communication_alerts").insert({
        business_id: rule.business_id,
        alert_type: "escalation",
        severity: "high",
        message: `${rule.rule_name}: ${entity.caller_number} requires attention`,
      });
      break;
    }
    case "escalate": {
      await supabase.from("communication_escalations").insert({
        business_id: rule.business_id,
        escalation_type: triggerType,
        severity: "high",
        ai_notes: `Auto-escalated by rule: ${rule.rule_name}. Threshold: ${rule.trigger_threshold_minutes} minutes.`,
      });
      break;
    }
    case "auto_sms": {
      if (rule.auto_sms_template && entity.caller_number) {
        await supabase.from("sms_logs").insert({
          business_id: rule.business_id,
          direction: "outbound",
          to_number: entity.caller_number,
          content: rule.auto_sms_template,
          status: "pending",
          ai_generated: true,
        });
      }
      break;
    }
  }

  if (entity.id) {
    if (triggerType === "voicemail_unresolved") {
      await supabase.from("voicemails").update({ status: "escalated" }).eq("id", entity.id);
    } else if (triggerType.includes("call")) {
      await supabase.from("call_outcomes").update({ resolution_status: "escalated" }).eq("id", entity.id);
    }
  }
}
