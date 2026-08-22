import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendSms } from "../_shared/sendSms.ts";

// UT-facing ambassador approval notice. Transactional class: one approval =
// one send, triggered by the caller per approval. Sent via the send-sms
// chokepoint (suppression + legal-STOP, idempotency, outbound_messages).
// Sender parity preserved: same TWILIO_FROM_NUMBER this function always used.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, referral_code, name } = await req.json();

    if (!phone || !referral_code) {
      return new Response(JSON.stringify({ error: "phone and referral_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = `🎉 Congrats${name ? ` ${name}` : ''}! Your Unforgettable Times ambassador application has been approved. Your referral link is: unforgettable-times-usa.myshopify.com?ref=${referral_code} — Start sharing and earning today!`;

    const sms = await sendSms({
      to: phone,
      body,
      from: Deno.env.get("TWILIO_FROM_NUMBER"),
      idempotencyKey: `amb-approve-${referral_code}`,
      sendClass: "transactional",
      skipCooldown: true,
      purpose: "ambassador_approval",
      metadata: { referral_code },
    });

    if (!sms.success) {
      if (sms.status === "blocked") {
        // Suppressed / legal-STOP: a named non-error outcome, not a crash.
        console.log(`Approval SMS suppressed for ${phone}: ${sms.errorMessage}`);
        return new Response(JSON.stringify({ success: false, blocked: true, reason: sms.errorMessage }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("SMS via send-sms failed:", sms.status, sms.errorMessage);
      return new Response(JSON.stringify({ error: "SMS failed", details: sms.errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sid: sms.providerMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
