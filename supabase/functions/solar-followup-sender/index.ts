import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
// Retry delays in minutes
const RETRY_DELAYS = [5, 15, 60];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // OUTREACH GATE (2026-08-23): no solar follow-up sends unless a human armed the switch.
  if (!(await outreachAllowed("solar_followup_sender"))) {
    return new Response(JSON.stringify({ ok: true, gated: true, switch: "solar_followup_sender" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Credentials live in send-sms now; this worker only needs the sender id.
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");


  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch pending follow-ups ready to send
    const now = new Date().toISOString();
    const { data: followups, error: fetchError } = await supabase
      .from("solar_followups")
      .select("id, lead_id, message, channel, retry_count, attempt_number")
      .eq("status", "pending")
      .eq("delivery_status", "pending")
      .lte("send_time", now)
      .order("send_time", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!followups || followups.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending follow-ups" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect unique lead_ids to batch-fetch phone numbers
    const leadIds = [...new Set(followups.map((f) => f.lead_id).filter(Boolean))];

    // Try solar_master_leads first for phone numbers
    const { data: leads } = await supabase
      .from("solar_master_leads")
      .select("id, phone, name")
      .in("id", leadIds);

    const leadMap = new Map<string, { phone: string; name: string }>();
    (leads || []).forEach((l: any) => {
      if (l.phone) leadMap.set(l.id, { phone: l.phone, name: l.name || "" });
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const followup of followups) {
      const lead = followup.lead_id ? leadMap.get(followup.lead_id) : null;

      if (!lead?.phone) {
        // Skip - no phone number
        await supabase
          .from("solar_followups")
          .update({
            status: "failed",
            delivery_status: "failed",
            error_message: "No phone number found for lead",
          })
          .eq("id", followup.id);
        skipped++;
        continue;
      }

      // Validate phone (basic E.164 check)
      const phone = lead.phone.startsWith("+") ? lead.phone : `+1${lead.phone.replace(/\D/g, "")}`;
      if (phone.replace(/\D/g, "").length < 10) {
        await supabase
          .from("solar_followups")
          .update({
            status: "failed",
            delivery_status: "failed",
            error_message: "Invalid phone number",
          })
          .eq("id", followup.id);
        skipped++;
        continue;
      }

      // Only send SMS channel
      if (followup.channel !== "sms") {
        skipped++;
        continue;
      }

      try {
        // Try AI-generated message if lead_id exists
        let messageToSend = followup.message;
        try {
          const aiUrl = `${supabaseUrl}/functions/v1/solar-followup-ai-generator`;
          const aiRes = await fetch(aiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              lead_id: followup.lead_id,
              attempt_number: followup.attempt_number || 1,
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            if (aiData.message) {
              messageToSend = aiData.message;
              console.log(`AI-generated message for lead ${followup.lead_id}: tone=${aiData.tone_type}`);
            }
          }
        } catch (aiErr) {
          console.warn("AI generator failed, using static message:", aiErr);
        }

        // Campaign class: solar follow-ups are marketing outreach, so they
        // carry full suppression and count against the campaign day budget.
        const res = await sendSms({
          to: phone,
          body: messageToSend,
          idempotencyKey: `solar-fu-${followup.id}-${followup.retry_count || 0}`,
          sendClass: "campaign",
          from: twilioFrom || undefined,
          purpose: "solar_followup",
          metadata: { followup_id: followup.id, lead_id: followup.lead_id },
        });

        if (res.success) {
          await supabase
            .from("solar_followups")
            .update({
              status: "sent",
              delivery_status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", followup.id);
          sent++;
        } else if (res.blocked) {
          // Opted out: terminal. Retrying a suppressed number is illegal,
          // not just useless — stop the row instead of scheduling a retry.
          await supabase
            .from("solar_followups")
            .update({
              status: "blocked",
              delivery_status: "blocked",
              error_message: res.errorMessage || "suppressed",
            })
            .eq("id", followup.id);
          failed++;
        } else {
          throw new Error(res.errorMessage || res.status);
        }
      } catch (smsError: any) {
        const retryCount = (followup.retry_count || 0) + 1;

        if (retryCount >= MAX_RETRIES) {
          // Max retries reached — mark failed
          await supabase
            .from("solar_followups")
            .update({
              status: "failed",
              delivery_status: "failed",
              error_message: smsError.message,
              retry_count: retryCount,
            })
            .eq("id", followup.id);
        } else {
          // Schedule retry with exponential delay
          const delayMinutes = RETRY_DELAYS[retryCount - 1] || 60;
          const retrySendTime = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

          await supabase
            .from("solar_followups")
            .update({
              retry_count: retryCount,
              send_time: retrySendTime,
              error_message: smsError.message,
            })
            .eq("id", followup.id);
        }
        failed++;
      }
    }

    console.log(`Follow-up sender: sent=${sent}, failed=${failed}, skipped=${skipped}`);

    return new Response(
      JSON.stringify({ processed: followups.length, sent, failed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Solar follow-up sender error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
