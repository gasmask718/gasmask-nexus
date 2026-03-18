import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── SMS SCRIPT VARIANTS (A/B) ──
const SMS_OPENERS = [
  // Variant A — Curiosity + question
  (name: string) =>
    `Hey — quick question, are you currently getting customers from Google or mostly word of mouth? Noticed ${name} doesn't have a website yet.`,
  // Variant B — Direct value
  (name: string) =>
    `Hey — I came across ${name} and noticed you don't have a website. Are you losing customers to competitors who do? Would love to show you something quick.`,
];

const SMS_FOLLOWUPS = [
  // 15-min follow-up
  (name: string) =>
    `Not sure if you saw this — I noticed ${name} doesn't have a website. I might be able to help you get more customers. Want me to show you how?`,
  // 2-hour follow-up
  (name: string) =>
    `Last thing — businesses like ${name} without a website lose 70%+ of potential customers. I built a quick demo for you. Want to see it? Reply YES`,
];

function isBusinessHours(): boolean {
  const now = new Date();
  const estOffset = -5;
  const utcHour = now.getUTCHours();
  const estHour = (utcHour + estOffset + 24) % 24;
  const day = now.getUTCDay();
  if (day === 0) return false;
  return estHour >= 9 && estHour < 19;
}

function nextBusinessHourStart(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(14, 0, 0, 0); // 9am EST = 14:00 UTC
  if (next <= now) next.setDate(next.getDate() + 1);
  if (next.getUTCDay() === 0) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { lead_ids, mode, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-auto-striker" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      throw new Error("lead_ids array is required");
    }

    const isFollowUp = mode === "follow_up";
    const MAX_DAILY_ATTEMPTS = 2;
    const results: any[] = [];

    for (const leadId of lead_ids.slice(0, 20)) {
      try {
        // Fetch lead
        const { data: lead } = await supabase
          .from("brandaro_qualified_leads")
          .select("id, business_name, phone_number, city, state, industry, website_status, lead_status")
          .eq("id", leadId)
          .single();

        if (!lead || !lead.phone_number) {
          results.push({ lead_id: leadId, status: "skipped", reason: "no_phone" });
          continue;
        }

        // Skip if already responded positively or sold
        if (["interested", "hot_lead", "sold", "not_interested", "do_not_call"].includes(lead.lead_status || "")) {
          results.push({ lead_id: leadId, status: "skipped", reason: `status_${lead.lead_status}` });
          continue;
        }

        // Daily limit check
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("brandaro_auto_actions")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", leadId)
          .gte("created_at", todayStart.toISOString());

        if ((count || 0) >= MAX_DAILY_ATTEMPTS) {
          results.push({ lead_id: leadId, status: "skipped", reason: "daily_limit" });
          continue;
        }

        // Business hours
        if (!isBusinessHours()) {
          const scheduledTime = nextBusinessHourStart();
          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId,
            action_type: isFollowUp ? "follow_up_sms" : "ai_call",
            status: "skipped",
            trigger_source: isFollowUp ? "follow_up" : "webhook",
            error_message: "Outside business hours",
            scheduled_for: scheduledTime,
          });
          results.push({ lead_id: leadId, status: "scheduled", scheduled_for: scheduledTime });
          continue;
        }

        const bizName = lead.business_name || "your business";

        if (isFollowUp) {
          // ── FOLLOW-UP SMS ──
          const attemptNum = (count || 0);
          const followUpMsg = SMS_FOLLOWUPS[Math.min(attemptNum, SMS_FOLLOWUPS.length - 1)](bizName);

          const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: followUpMsg, lead_id: leadId }),
          });
          const smsResult = await smsRes.json();

          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId,
            action_type: "follow_up_sms",
            status: smsResult.success ? "success" : "failed",
            attempt_number: (count || 0) + 1,
            trigger_source: "follow_up",
            provider_sid: smsResult.result?.sid,
            error_message: smsResult.success ? null : smsResult.error,
            executed_at: new Date().toISOString(),
          });

          results.push({ lead_id: leadId, status: smsResult.success ? "follow_up_sent" : "follow_up_failed" });
        } else {
          // ── PRIMARY STRIKE: AI CALL ──
          const callRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: "call", phone: lead.phone_number, lead_id: leadId }),
          });
          const callResult = await callRes.json();

          if (callResult.success) {
            await supabase.from("brandaro_auto_actions").insert({
              lead_id: leadId, action_type: "ai_call", status: "success",
              trigger_source: "webhook", provider_sid: callResult.result?.sid,
              executed_at: new Date().toISOString(),
            });
            await supabase.from("brandaro_qualified_leads")
              .update({ lead_status: "calling", updated_at: new Date().toISOString() })
              .eq("id", leadId);
            results.push({ lead_id: leadId, status: "call_triggered", sid: callResult.result?.sid });
          } else {
            // ── FALLBACK: SMS (A/B variant) ──
            console.warn(`[AUTO-STRIKER] Call failed for ${leadId}, sending SMS fallback`);
            const variant = Math.random() < 0.5 ? 0 : 1;
            const smsMessage = SMS_OPENERS[variant](bizName);

            const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: smsMessage, lead_id: leadId }),
            });
            const smsResult = await smsRes.json();

            await supabase.from("brandaro_auto_actions").insert({
              lead_id: leadId,
              action_type: smsResult.success ? "sms" : "ai_call",
              status: smsResult.success ? "success" : "failed",
              trigger_source: "webhook",
              provider_sid: smsResult.result?.sid,
              error_message: smsResult.success
                ? `Call failed, SMS variant ${variant === 0 ? "A" : "B"} sent`
                : `Both failed: ${callResult.error} / ${smsResult.error}`,
              executed_at: new Date().toISOString(),
            });

            // Schedule follow-up in 15 minutes if SMS sent
            if (smsResult.success) {
              const followUpTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
              await supabase.from("brandaro_auto_actions").insert({
                lead_id: leadId,
                action_type: "follow_up_sms",
                status: "skipped",
                trigger_source: "scheduled",
                error_message: "Follow-up scheduled",
                scheduled_for: followUpTime,
              });
            }

            results.push({
              lead_id: leadId,
              status: smsResult.success ? "sms_fallback" : "failed",
              variant: variant === 0 ? "A" : "B",
            });
          }
        }
      } catch (leadErr: any) {
        console.error(`[AUTO-STRIKER] Error for lead ${leadId}:`, leadErr);
        await supabase.from("brandaro_auto_actions").insert({
          lead_id: leadId, action_type: "ai_call", status: "failed",
          trigger_source: isFollowUp ? "follow_up" : "webhook",
          error_message: leadErr.message,
        });
        results.push({ lead_id: leadId, status: "error", error: leadErr.message });
      }
    }

    console.log(`[AUTO-STRIKER] Processed ${results.length} leads`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[AUTO-STRIKER] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
