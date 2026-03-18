import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Business hours check (EST, 9am-7pm Mon-Sat)
function isBusinessHours(): boolean {
  const now = new Date();
  // Convert to EST (UTC-5)
  const estOffset = -5;
  const utcHour = now.getUTCHours();
  const estHour = (utcHour + estOffset + 24) % 24;
  const day = now.getUTCDay(); // 0=Sun
  if (day === 0) return false; // no Sunday calls
  return estHour >= 9 && estHour < 19;
}

// Calculate next business hour start
function nextBusinessHourStart(): string {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  est.setHours(9, 0, 0, 0);
  if (est <= now) est.setDate(est.getDate() + 1);
  // Skip Sunday
  if (est.getDay() === 0) est.setDate(est.getDate() + 1);
  return est.toISOString();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { lead_ids, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-auto-striker" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      throw new Error("lead_ids array is required");
    }

    const MAX_DAILY_ATTEMPTS = 2;
    const results: any[] = [];

    for (const leadId of lead_ids.slice(0, 20)) { // cap at 20 per batch
      try {
        // Fetch lead details
        const { data: lead } = await supabase
          .from("brandaro_qualified_leads")
          .select("id, business_name, phone_number, city, state, industry, website_status")
          .eq("id", leadId)
          .single();

        if (!lead || !lead.phone_number) {
          results.push({ lead_id: leadId, status: "skipped", reason: "no_phone" });
          continue;
        }

        // Safety check: max attempts per day
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("brandaro_auto_actions")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", leadId)
          .gte("created_at", todayStart.toISOString());

        if ((count || 0) >= MAX_DAILY_ATTEMPTS) {
          results.push({ lead_id: leadId, status: "skipped", reason: "daily_limit" });
          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId,
            action_type: "ai_call",
            status: "skipped",
            trigger_source: "webhook",
            error_message: `Daily limit reached (${MAX_DAILY_ATTEMPTS})`,
          });
          continue;
        }

        // Business hours check
        if (!isBusinessHours()) {
          const scheduledTime = nextBusinessHourStart();
          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId,
            action_type: "ai_call",
            status: "skipped",
            trigger_source: "webhook",
            error_message: "Outside business hours — scheduled for next window",
            scheduled_for: scheduledTime,
          });
          results.push({ lead_id: leadId, status: "scheduled", scheduled_for: scheduledTime });
          continue;
        }

        // STRIKE — AI call first
        const callResponse = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: "call",
            phone: lead.phone_number,
            lead_id: leadId,
          }),
        });

        const callResult = await callResponse.json();

        if (callResult.success) {
          // Log success
          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId,
            action_type: "ai_call",
            status: "success",
            trigger_source: "webhook",
            provider_sid: callResult.result?.sid,
            executed_at: new Date().toISOString(),
          });

          // Update lead status
          await supabase.from("brandaro_qualified_leads")
            .update({ lead_status: "calling", updated_at: new Date().toISOString() })
            .eq("id", leadId);

          results.push({ lead_id: leadId, status: "call_triggered", sid: callResult.result?.sid });
        } else {
          // Call failed — fall back to SMS
          console.warn(`[AUTO-STRIKER] Call failed for ${leadId}, falling back to SMS: ${callResult.error}`);

          const smsMessage = `Hey! Quick question — is ${lead.business_name || "your business"} currently taking on new customers? We help businesses like yours get found online. Reply YES if interested!`;

          const smsResponse = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              action: "sms",
              phone: lead.phone_number,
              message: smsMessage,
              lead_id: leadId,
            }),
          });

          const smsResult = await smsResponse.json();

          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId,
            action_type: smsResult.success ? "sms" : "ai_call",
            status: smsResult.success ? "success" : "failed",
            trigger_source: "webhook",
            provider_sid: smsResult.result?.sid,
            error_message: smsResult.success ? "Call failed, SMS fallback sent" : `Both failed: ${callResult.error} / ${smsResult.error}`,
            executed_at: new Date().toISOString(),
          });

          results.push({
            lead_id: leadId,
            status: smsResult.success ? "sms_fallback" : "failed",
            call_error: callResult.error,
          });
        }
      } catch (leadErr: any) {
        console.error(`[AUTO-STRIKER] Error for lead ${leadId}:`, leadErr);
        await supabase.from("brandaro_auto_actions").insert({
          lead_id: leadId,
          action_type: "ai_call",
          status: "failed",
          trigger_source: "webhook",
          error_message: leadErr.message,
        });
        results.push({ lead_id: leadId, status: "error", error: leadErr.message });
      }
    }

    console.log(`[AUTO-STRIKER] Processed ${results.length} leads:`, JSON.stringify(results));

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
