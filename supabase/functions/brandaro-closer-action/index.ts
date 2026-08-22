import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, phone, message, lead_id, session_id, payment_url } = await req.json();

    if (!action) throw new Error("action is required (sms, call, payment_link)");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID")!;
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error("Twilio credentials not configured");
    }

    const authHeader = "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Normalize phone
    let normalized = (phone || "").replace(/\D/g, "");
    if (normalized.startsWith("1") && normalized.length === 11) normalized = normalized.substring(1);
    if (normalized.length !== 10) throw new Error("Invalid phone number");

    const e164 = `+1${normalized}`;
    let result: any = {};

    if (action === "sms") {
      // Send SMS
      if (!message) throw new Error("message is required for SMS");

      // Outbound SMS routes through send-sms (suppression + idempotency +
      // outbound_messages audit). Sender parity: previously MessagingServiceSid
      // only — send-sms applies the same TWILIO_MESSAGING_SERVICE_SID
      // globally, so the presented sender is unchanged.
      // Class: conversational — a human at the closer desk types this per lead.
      const hourBucket = new Date().toISOString().slice(0, 13);
      const smsResult = await sendSms({
        to: e164,
        body: message,
        sendClass: "conversational",
        idempotencyKey: `closer-sms-${lead_id || normalized}-${shortHash(message)}-${hourBucket}`,
        skipCooldown: true, // human-paced, one tap = one send
        purpose: "closer_desk_sms",
        metadata: { source: "brandaro_closer_desk", lead_id, session_id },
      });

      if (smsResult.blocked) {
        console.warn(`[brandaro-closer-action] BLOCKED ${e164} — ${smsResult.errorMessage}`);
        await supabase.from("communication_logs").insert({
          direction: "outbound",
          channel: "sms",
          phone_number: e164,
          message_body: message,
          status: "blocked",
          provider: "twilio",
          metadata: { source: "brandaro_closer_desk", lead_id, session_id, blocker: smsResult.errorCode },
        });
        throw new Error(`SMS not sent — recipient has opted out (${smsResult.errorMessage}). Call instead.`);
      }
      if (!smsResult.success) {
        throw new Error(`SMS failed: ${smsResult.errorMessage || "unknown"}`);
      }
      result = { sid: smsResult.providerMessageId };

      // Log to communication_logs
      await supabase.from("communication_logs").insert({
        direction: "outbound",
        channel: "sms",
        phone_number: e164,
        message_body: message,
        status: "sent",
        provider: "twilio",
        provider_message_id: result?.sid,
        metadata: { source: "brandaro_closer_desk", lead_id, session_id },
      });

      console.log(`✅ SMS sent to ${e164}`);

    } else if (action === "call") {
      // Initiate call via Twilio
      const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
      const formData = new URLSearchParams({
        To: e164,
        From: twilioPhoneNumber,
        Url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-voice-handler?type=closer_call&lead_id=${lead_id || ""}`,
      });

      const response = await fetch(twilioApiUrl, {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const responseText = await response.text();
      try { result = responseText ? JSON.parse(responseText) : {}; } catch { result = { raw: responseText }; }

      // FIX (c): a dial only counts as success when Twilio returns 2xx, no
      // error_code, AND a call SID. Anything else is written to
      // communication_logs as a real `failed` row (previously failures were
      // never logged at all, so the true failure rate was invisible) and then
      // surfaced to the caller with the provider's own error text.
      const callFailed = !response.ok || Boolean(result?.error_code) || !result?.sid;
      if (callFailed) {
        const providerError =
          result?.message || result?.detail || result?.raw || `HTTP ${response.status}`;
        console.error(`❌ Twilio call failed to ${e164} [${response.status}]:`, responseText);
        await supabase.from("communication_logs").insert({
          direction: "outbound",
          channel: "call",
          phone_number: e164,
          status: "failed",
          provider: "twilio",
          provider_message_id: result?.sid ?? null,
          metadata: {
            source: "brandaro_closer_desk",
            lead_id,
            session_id,
            error: providerError,
            twilio_status: response.status,
            twilio_code: result?.code ?? result?.error_code ?? null,
          },
        });
        throw new Error(
          `Call failed (Twilio ${result?.code ?? result?.error_code ?? response.status}): ${providerError}`,
        );
      }

      // Log call
      await supabase.from("communication_logs").insert({
        direction: "outbound",
        channel: "call",
        phone_number: e164,
        status: "initiated",
        provider: "twilio",
        provider_message_id: result?.sid,
        metadata: { source: "brandaro_closer_desk", lead_id, session_id },
      });

      console.log(`✅ Call initiated to ${e164} sid=${result?.sid}`);


    } else if (action === "payment_link") {
      // Shorten the payment URL so the SMS body stays compact and trackable.
      let shortPaymentUrl: string | null = payment_url || null;
      if (payment_url) {
        const siteBase =
          Deno.env.get("PUBLIC_SITE_URL") ||
          Deno.env.get("SITE_URL") ||
          "https://gasmask-os-nexus.lovable.app";
        const { data: shortCode, error: shortErr } = await supabase.rpc("create_short_link", {
          p_target_url: payment_url,
          p_kind: "closer_payment",
          p_invoice_id: null,
          p_lead_id: lead_id || null,
          p_session_id: session_id || null,
          p_context: { source: "brandaro-closer-action" },
          p_expires_at: null,
        });
        if (!shortErr && shortCode) {
          shortPaymentUrl = `${siteBase.replace(/\/$/, "")}/p/${shortCode}`;
        } else if (shortErr) {
          console.warn("create_short_link failed, using original URL:", shortErr.message);
        }
      }

      // Send payment link via SMS. If caller supplied a custom message that embeds
      // the long URL, swap it for the short one so SMS bodies stay compact.
      let paymentMessage = message
        || `Your custom quote is ready! Complete your payment here: ${shortPaymentUrl || "[link]"}\n\nLock in your spot today 🔥`;
      if (message && payment_url && shortPaymentUrl && shortPaymentUrl !== payment_url) {
        paymentMessage = paymentMessage.split(payment_url).join(shortPaymentUrl);
      }

      // Payment link via send-sms. Class: transactional (post-quote, one
      // session = one link). Same MessagingServiceSid parity as above.
      const payResult = await sendSms({
        to: e164,
        body: paymentMessage,
        sendClass: "transactional",
        idempotencyKey: `closer-pay-${session_id || lead_id || normalized}-${shortHash(paymentMessage)}`,
        skipCooldown: true,
        purpose: "closer_payment_link",
        metadata: { source: "brandaro_payment_push", lead_id, session_id },
      });

      if (payResult.blocked) {
        console.warn(`[brandaro-closer-action] payment link BLOCKED ${e164} — ${payResult.errorMessage}`);
        await supabase.from("communication_logs").insert({
          direction: "outbound",
          channel: "sms",
          phone_number: e164,
          message_body: paymentMessage,
          status: "blocked",
          provider: "twilio",
          metadata: { source: "brandaro_payment_push", lead_id, session_id, blocker: payResult.errorCode },
        });
        throw new Error(`Payment link not sent — recipient has opted out (${payResult.errorMessage}). Call instead.`);
      }
      if (!payResult.success) {
        throw new Error(`Payment link SMS failed: ${payResult.errorMessage || "unknown"}`);
      }
      result = { sid: payResult.providerMessageId };

      // Update session
      if (session_id) {
        await supabase.from("brandaro_closer_sessions").update({
          payment_link_sent: true,
          payment_link_sent_at: new Date().toISOString(),
        }).eq("id", session_id);
      }

      // Log
      await supabase.from("communication_logs").insert({
        direction: "outbound",
        channel: "sms",
        phone_number: e164,
        message_body: paymentMessage,
        status: "sent",
        provider: "twilio",
        provider_message_id: result?.sid,
        metadata: { source: "brandaro_payment_push", lead_id, session_id },
      });

      console.log(`✅ Payment link sent to ${e164}`);
    }

    return new Response(JSON.stringify({ success: true, action, result: { sid: result?.sid } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Closer action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
