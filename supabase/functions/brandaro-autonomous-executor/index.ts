import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DAILY_CONTACTS = 5;
const COOLDOWN_MINUTES = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const hasTwilio = !!(twilioAccountSid && twilioAuthToken);
    const authHeader = hasTwilio ? "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`) : "";

    const { dry_run } = await req.json().catch(() => ({ dry_run: false }));
    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-autonomous-executor", twilio: hasTwilio }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // ─────────────────────────────────────────────────────
    // PHASE 1: HOT LEADS — Immediate AI Call + SMS fallback
    // ─────────────────────────────────────────────────────
    const { data: hotLeads } = await supabase
      .from("brandaro_va_lead_heat")
      .select("id, lead_id, heat_score, phone, business_name")
      .gte("heat_score", 70)
      .limit(10);

    for (const lead of hotLeads || []) {
      const phone = lead.phone;
      const leadId = lead.lead_id || lead.id;
      if (!phone || !hasTwilio) continue;

      const canContact = await checkContactLimits(supabase, leadId);
      if (!canContact) {
        results.push({ trigger: "hot_lead", lead_id: leadId, action: "skipped_limit" });
        continue;
      }

      // Try call first
      const callResult = await executeCall(supabase, phone, leadId, twilioAccountSid!, twilioAuthToken!, twilioPhoneNumber!, supabaseUrl, authHeader);
      
      if (callResult.success) {
        await logExecution(supabase, leadId, phone, "ai_call", "hot_lead", callResult.sid);
        await updateContactLimits(supabase, leadId);
        results.push({ trigger: "hot_lead", lead_id: leadId, action: "call_initiated", sid: callResult.sid });
      } else {
        // Fallback to SMS
        const smsResult = await executeSMS(
          supabase, phone, leadId,
          `Hi! We noticed you're interested in growing your business online. We have a limited-time offer that could be perfect for you. Reply YES to learn more! 🔥`,
          twilioAccountSid!, twilioAuthToken!, twilioMessagingServiceSid!, authHeader
        );
        await logExecution(supabase, leadId, phone, "sms", "hot_lead", smsResult.sid, callResult.error);
        await updateContactLimits(supabase, leadId);
        results.push({ trigger: "hot_lead", lead_id: leadId, action: "sms_fallback", sid: smsResult.sid });
      }

      // Store memory
      await supabase.from("brandaro_lead_memory").insert({
        lead_id: leadId,
        memory_type: "context",
        memory_key: "auto_contacted",
        memory_value: `Autonomous hot-lead outreach. Heat: ${lead.heat_score}`,
        source: "automation",
      });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 2: STALE LEADS — Re-engagement SMS
    // ─────────────────────────────────────────────────────
    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleLeads } = await supabase
      .from("brandaro_va_lead_heat")
      .select("id, lead_id, heat_score, phone, business_name")
      .lt("updated_at", staleThreshold)
      .gt("heat_score", 10)
      .lt("heat_score", 70)
      .limit(10);

    const reEngagementMessages = [
      "Hey! Just checking in — still thinking about upgrading your online presence? We've helped dozens of businesses like yours grow. Want to chat?",
      "Quick question — if we could guarantee more customers finding you online, would that be worth a 5-minute conversation?",
      "Hi there! We had a great conversation earlier. Just wanted to follow up and see if you had any questions about getting your business online. 🚀",
    ];

    for (const lead of staleLeads || []) {
      const phone = lead.phone;
      const leadId = lead.lead_id || lead.id;
      if (!phone || !hasTwilio) continue;

      const canContact = await checkContactLimits(supabase, leadId);
      if (!canContact) continue;

      // Check if already re-engaged in last 24h
      const { count } = await supabase
        .from("brandaro_execution_log")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .eq("trigger_source", "stale_lead")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if ((count || 0) > 0) continue;

      const msg = reEngagementMessages[Math.floor(Math.random() * reEngagementMessages.length)];
      const smsResult = await executeSMS(supabase, phone, leadId, msg, twilioAccountSid!, twilioAuthToken!, twilioMessagingServiceSid!, authHeader);
      await logExecution(supabase, leadId, phone, "sms", "stale_lead", smsResult.sid);
      await updateContactLimits(supabase, leadId);
      results.push({ trigger: "stale_lead", lead_id: leadId, action: "re_engagement_sms" });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 3: FOLLOW-UP QUEUE — Execute scheduled messages
    // ─────────────────────────────────────────────────────
    const { data: dueFollowups } = await supabase
      .from("brandaro_followup_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(15);

    for (const fu of dueFollowups || []) {
      if (!hasTwilio) continue;

      // Get lead phone
      const { data: leadData } = await supabase
        .from("brandaro_va_lead_heat")
        .select("phone")
        .or(`lead_id.eq.${fu.lead_id},id.eq.${fu.lead_id}`)
        .limit(1)
        .single();

      const phone = leadData?.phone;
      if (!phone) {
        await supabase.from("brandaro_followup_queue").update({ status: "skipped" }).eq("id", fu.id);
        continue;
      }

      const canContact = await checkContactLimits(supabase, fu.lead_id);
      if (!canContact) continue;

      if (fu.channel === "call") {
        const callResult = await executeCall(supabase, phone, fu.lead_id, twilioAccountSid!, twilioAuthToken!, twilioPhoneNumber!, supabaseUrl, authHeader);
        await logExecution(supabase, fu.lead_id, phone, "ai_call", "followup", callResult.sid);
      } else {
        const msg = fu.message_template || `Following up on our conversation about your business. Ready to take the next step? Reply YES! 🚀`;
        await executeSMS(supabase, phone, fu.lead_id, msg, twilioAccountSid!, twilioAuthToken!, twilioMessagingServiceSid!, authHeader);
        await logExecution(supabase, fu.lead_id, phone, "sms", "followup");
      }

      await supabase.from("brandaro_followup_queue").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", fu.id);
      await updateContactLimits(supabase, fu.lead_id);
      results.push({ trigger: "followup", lead_id: fu.lead_id, step: fu.step_number, channel: fu.channel });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 4: PAYMENT PUSH — Leads with payment intent
    // ─────────────────────────────────────────────────────
    const { data: paymentLeads } = await supabase
      .from("brandaro_closer_sessions")
      .select("id, lead_id, phone, payment_link_sent, payment_link_url, close_probability")
      .gte("close_probability", 70)
      .eq("payment_link_sent", false)
      .not("payment_link_url", "is", null)
      .limit(5);

    for (const pl of paymentLeads || []) {
      if (!pl.phone || !hasTwilio || !pl.payment_link_url) continue;

      const canContact = await checkContactLimits(supabase, pl.lead_id);
      if (!canContact) continue;

      const msg = `🔥 Your custom website package is ready! Complete your payment here to lock in your spot:\n\n${pl.payment_link_url}\n\nLimited availability — don't miss out!`;
      const smsResult = await executeSMS(supabase, pl.phone, pl.lead_id, msg, twilioAccountSid!, twilioAuthToken!, twilioMessagingServiceSid!, authHeader);

      await supabase.from("brandaro_closer_sessions").update({
        payment_link_sent: true,
        payment_link_sent_at: new Date().toISOString(),
      }).eq("id", pl.id);

      await logExecution(supabase, pl.lead_id, pl.phone, "payment_link", "payment_intent", smsResult.sid);
      await updateContactLimits(supabase, pl.lead_id);
      results.push({ trigger: "payment_push", lead_id: pl.lead_id, action: "payment_link_sent" });
    }

    // ─────────────────────────────────────────────────────
    // PHASE 5: DAILY CONTACT LIMIT RESET
    // ─────────────────────────────────────────────────────
    const resetThreshold = new Date();
    resetThreshold.setHours(0, 0, 0, 0);
    await supabase
      .from("brandaro_contact_limits")
      .update({ daily_contacts: 0, updated_at: new Date().toISOString() })
      .lt("updated_at", resetThreshold.toISOString());

    return new Response(JSON.stringify({
      status: "ok",
      executed: results.length,
      results,
      twilio_active: hasTwilio,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Autonomous executor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── HELPERS ───

async function checkContactLimits(supabase: any, leadId: string): Promise<boolean> {
  const { data } = await supabase
    .from("brandaro_contact_limits")
    .select("*")
    .eq("lead_id", leadId)
    .single();

  if (!data) return true; // No record = never contacted

  // Check cooldown
  if (data.cooldown_until && new Date(data.cooldown_until) > new Date()) return false;
  
  // Check daily limit
  if (data.daily_contacts >= MAX_DAILY_CONTACTS) return false;

  // Check next allowed
  if (data.next_allowed_at && new Date(data.next_allowed_at) > new Date()) return false;

  return true;
}

async function updateContactLimits(supabase: any, leadId: string) {
  const now = new Date();
  const nextAllowed = new Date(now.getTime() + COOLDOWN_MINUTES * 60 * 1000);

  const { data: existing } = await supabase
    .from("brandaro_contact_limits")
    .select("id, daily_contacts, total_contacts")
    .eq("lead_id", leadId)
    .single();

  if (existing) {
    await supabase.from("brandaro_contact_limits").update({
      daily_contacts: (existing.daily_contacts || 0) + 1,
      total_contacts: (existing.total_contacts || 0) + 1,
      last_contacted_at: now.toISOString(),
      next_allowed_at: nextAllowed.toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("brandaro_contact_limits").insert({
      lead_id: leadId,
      daily_contacts: 1,
      total_contacts: 1,
      last_contacted_at: now.toISOString(),
      next_allowed_at: nextAllowed.toISOString(),
    });
  }
}

async function executeCall(
  supabase: any, phone: string, leadId: string,
  accountSid: string, authToken: string, fromNumber: string,
  supabaseUrl: string, authHeaderStr: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    let normalized = phone.replace(/\D/g, "");
    if (normalized.startsWith("1") && normalized.length === 11) normalized = normalized.substring(1);
    if (normalized.length !== 10) return { success: false, error: "Invalid phone" };

    const e164 = `+1${normalized}`;
    const callUrl = `${supabaseUrl}/functions/v1/twilio-voice-handler?type=closer_call&lead_id=${leadId}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: { Authorization: authHeaderStr, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: e164, From: fromNumber, Url: callUrl }).toString(),
      }
    );

    const result = await response.json();
    if (!response.ok || result?.error_code) {
      return { success: false, error: result?.message || "Call failed" };
    }

    return { success: true, sid: result.sid };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function executeSMS(
  supabase: any, phone: string, leadId: string, message: string,
  accountSid: string, authToken: string, messagingServiceSid: string,
  authHeaderStr: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    let normalized = phone.replace(/\D/g, "");
    if (normalized.startsWith("1") && normalized.length === 11) normalized = normalized.substring(1);
    if (normalized.length !== 10) return { success: false, error: "Invalid phone" };

    const e164 = `+1${normalized}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: authHeaderStr, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: e164, Body: message, MessagingServiceSid: messagingServiceSid }).toString(),
      }
    );

    const result = await response.json();
    if (!response.ok || result?.error_code) {
      return { success: false, error: result?.message || "SMS failed" };
    }

    // Log to communication_logs
    await supabase.from("communication_logs").insert({
      direction: "outbound",
      channel: "sms",
      phone_number: e164,
      message_body: message,
      status: "sent",
      provider: "twilio",
      provider_message_id: result.sid,
      metadata: { source: "brandaro_autonomous", lead_id: leadId },
    });

    return { success: true, sid: result.sid };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function logExecution(
  supabase: any, leadId: string, phone: string,
  actionType: string, triggerSource: string,
  providerSid?: string, errorMsg?: string
) {
  await supabase.from("brandaro_execution_log").insert({
    lead_id: leadId,
    phone,
    action_type: actionType,
    trigger_source: triggerSource,
    result: errorMsg ? "failed" : "success",
    provider_sid: providerSid,
    error_message: errorMsg,
  });

  await supabase.from("brandaro_automation_log").insert({
    trigger_type: triggerSource,
    lead_id: leadId,
    action_taken: `executed_${actionType}`,
    action_details: { phone, provider_sid: providerSid, error: errorMsg },
    result: errorMsg ? "failed" : "success",
    error_message: errorMsg,
  });
}
