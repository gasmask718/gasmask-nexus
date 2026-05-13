import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

      const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const formData = new URLSearchParams({
        To: e164,
        Body: message,
        MessagingServiceSid: twilioMessagingServiceSid,
      });

      const response = await fetch(twilioApiUrl, {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const responseText = await response.text();
      result = JSON.parse(responseText);

      if (!response.ok || result?.error_code) {
        throw new Error(`SMS failed: ${result?.message || "unknown"}`);
      }

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
      result = JSON.parse(responseText);

      if (!response.ok || result?.error_code) {
        throw new Error(`Call failed: ${result?.message || "unknown"}`);
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

      console.log(`✅ Call initiated to ${e164}`);

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

      // Send payment link via SMS
      const paymentMessage = message
        || `Your custom quote is ready! Complete your payment here: ${shortPaymentUrl || "[link]"}\n\nLock in your spot today 🔥`;

      const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const formData = new URLSearchParams({
        To: e164,
        Body: paymentMessage,
        MessagingServiceSid: twilioMessagingServiceSid,
      });

      const response = await fetch(twilioApiUrl, {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const responseText = await response.text();
      result = JSON.parse(responseText);

      if (!response.ok || result?.error_code) {
        throw new Error(`Payment link SMS failed: ${result?.message || "unknown"}`);
      }

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
